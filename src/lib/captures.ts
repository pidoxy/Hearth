import "server-only";
import fs from "node:fs";
import path from "node:path";
import { db, UPLOAD_DIR } from "./db";
import { extract, SUPPORTED_MIME } from "./extract";
import { listPeople } from "./households";
import { id } from "./ids";
import { insertExtracted } from "./items";
import { zonedDate } from "./time";
import type { Capture, CaptureSource, Household } from "./types";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const CAPTURES_PER_HOUR = Number(process.env.CAPTURES_PER_HOUR || 60);

export class CaptureError extends Error {}

export function checkRateLimit(householdId: string) {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM captures WHERE household_id = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 hour')`,
    )
    .get(householdId) as { n: number };
  if (row.n >= CAPTURES_PER_HOUR) {
    throw new CaptureError(`Slow down — you've added ${row.n} things in the last hour. Try again shortly.`);
  }
}

interface NewCapture {
  household: Household;
  userId: string | null;
  source: CaptureSource;
  title: string;
  text?: string | null;
  file?: { data: Buffer; mime: string; name: string } | null;
  emailFrom?: string | null;
  docDate?: Date;
  unverified?: boolean;
}

export function createCapture(c: NewCapture): Capture {
  if (c.file) {
    if (!SUPPORTED_MIME.has(c.file.mime)) throw new CaptureError("That file type isn't supported yet. Use a photo or PDF.");
    if (c.file.data.length > MAX_FILE_BYTES) throw new CaptureError("That file is over 15 MB.");
  }
  if (!c.file && !c.text?.trim()) throw new CaptureError("There's nothing to read.");

  const cid = id("cap");
  let filePath: string | null = null;
  if (c.file) {
    const ext = path.extname(c.file.name).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 6);
    filePath = `${cid}${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filePath), c.file.data);
  }
  const docDate = zonedDate(c.docDate ?? new Date(), c.household.timezone);
  db.prepare(
    `INSERT INTO captures (id, household_id, created_by, source, title, text_content, file_path, file_mime, file_name,
       email_from, doc_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    cid,
    c.household.id,
    c.userId,
    c.source,
    c.title.slice(0, 200),
    c.text ?? null,
    filePath,
    c.file?.mime ?? null,
    c.file?.name.slice(0, 200) ?? null,
    c.emailFrom ?? null,
    docDate,
    c.unverified ? "unverified" : "processing",
  );
  return getCapture(c.household.id, cid)!;
}

export function getCapture(householdId: string, captureId: string): Capture | null {
  return (
    (db.prepare(`SELECT * FROM captures WHERE id = ? AND household_id = ?`).get(captureId, householdId) as
      | Capture
      | undefined) ?? null
  );
}

export function recentCaptures(householdId: string, limit = 20) {
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.capture_id = c.id) AS item_count,
              (SELECT COUNT(*) FROM items i WHERE i.capture_id = c.id AND i.status = 'proposed') AS proposed_count
       FROM captures c WHERE household_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(householdId, limit) as (Capture & { item_count: number; proposed_count: number })[];
}

export function deleteCapture(householdId: string, captureId: string) {
  const cap = getCapture(householdId, captureId);
  if (!cap) return;
  if (cap.file_path) fs.rmSync(path.join(UPLOAD_DIR, cap.file_path), { force: true });
  db.prepare(`DELETE FROM captures WHERE id = ? AND household_id = ?`).run(captureId, householdId);
}

export function readCaptureFile(cap: Capture): Buffer | null {
  if (!cap.file_path) return null;
  const p = path.join(UPLOAD_DIR, path.basename(cap.file_path));
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

/** Run extraction for a capture and store proposed items. Never throws. */
export async function processCapture(household: Household, captureId: string): Promise<void> {
  const cap = getCapture(household.id, captureId);
  if (!cap) return;
  db.prepare(`UPDATE captures SET status = 'processing', error = NULL WHERE id = ?`).run(cap.id);
  try {
    const people = listPeople(household.id);
    const file = readCaptureFile(cap);
    const result = await extract({
      text: cap.text_content,
      file: file && cap.file_mime ? { data: file, mime: cap.file_mime } : null,
      docDate: cap.doc_date,
      timezone: household.timezone,
      people: people.map((p) => p.name),
      subject: cap.source === "email" ? cap.title : null,
      from: cap.email_from,
    });
    db.transaction(() => {
      db.prepare(`DELETE FROM items WHERE capture_id = ? AND status = 'proposed'`).run(cap.id);
      insertExtracted(household.id, cap.id, result.items, people);
      // Emails keep their subject; uploads and pastes take the model's summary as a nicer title.
      const title = cap.source === "email" || !result.summary ? cap.title : result.summary;
      db.prepare(`UPDATE captures SET status = 'done', extractor = ?, title = ? WHERE id = ?`).run(
        result.extractor,
        title,
        cap.id,
      );
    })();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[capture ${cap.id}] extraction failed:`, err);
    db.prepare(`UPDATE captures SET status = 'failed', error = ? WHERE id = ?`).run(message.slice(0, 500), cap.id);
  }
}

/** Fire-and-forget processing (the server is a long-running Node process). */
export function processInBackground(household: Household, captureId: string) {
  void processCapture(household, captureId);
}
