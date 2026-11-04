import "server-only";
import { db } from "./db";
import { id } from "./ids";
import type { ExtractedItem, Item, ItemWithPeople, Person } from "./types";

function attachPeople(items: Item[]): ItemWithPeople[] {
  if (!items.length) return [];
  const rows = db
    .prepare(
      `SELECT item_id, person_id FROM item_people WHERE item_id IN (${items.map(() => "?").join(",")})`,
    )
    .all(...items.map((i) => i.id)) as { item_id: string; person_id: string }[];
  const map = new Map<string, string[]>();
  for (const r of rows) {
    const list = map.get(r.item_id) ?? [];
    list.push(r.person_id);
    map.set(r.item_id, list);
  }
  return items.map((i) => ({ ...i, people: map.get(i.id) ?? [] }));
}

export function insertExtracted(householdId: string, captureId: string, extracted: ExtractedItem[], people: Person[]) {
  const byName = new Map(people.map((p) => [p.name.toLowerCase(), p.id]));
  const insert = db.prepare(
    `INSERT INTO items (id, household_id, capture_id, kind, title, start, end, all_day, location, notes,
       needs_prep, prep_note, confidence, source_quote, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed')`,
  );
  const link = db.prepare(`INSERT OR IGNORE INTO item_people (item_id, person_id) VALUES (?, ?)`);
  db.transaction(() => {
    for (const e of extracted) {
      const iid = id("itm");
      insert.run(
        iid,
        householdId,
        captureId,
        e.kind,
        e.title,
        e.start,
        e.end,
        e.all_day ? 1 : 0,
        e.location,
        e.notes,
        e.needs_prep ? 1 : 0,
        e.prep_note,
        e.confidence,
        e.source_quote,
      );
      for (const name of e.for_people) {
        const pid = byName.get(name.toLowerCase()) ?? byName.get(name.toLowerCase().split(" ")[0]);
        if (pid) link.run(iid, pid);
      }
    }
  })();
}

export function getItem(householdId: string, itemId: string): ItemWithPeople | null {
  const row = db.prepare(`SELECT * FROM items WHERE id = ? AND household_id = ?`).get(itemId, householdId) as
    | Item
    | undefined;
  return row ? attachPeople([row])[0] : null;
}

export function proposedItems(householdId: string): ItemWithPeople[] {
  return attachPeople(
    db
      .prepare(`SELECT * FROM items WHERE household_id = ? AND status = 'proposed' ORDER BY created_at DESC, start`)
      .all(householdId) as Item[],
  );
}

export function captureItems(householdId: string, captureId: string): ItemWithPeople[] {
  return attachPeople(
    db
      .prepare(`SELECT * FROM items WHERE household_id = ? AND capture_id = ? ORDER BY start`)
      .all(householdId, captureId) as Item[],
  );
}

/** Accepted items overlapping [fromDate, toDate] (inclusive, YYYY-MM-DD). */
export function acceptedBetween(householdId: string, fromDate: string, toDate: string): ItemWithPeople[] {
  return attachPeople(
    db
      .prepare(
        `SELECT * FROM items WHERE household_id = ? AND status = 'accepted'
           AND substr(start,1,10) <= ? AND substr(COALESCE(end,start),1,10) >= ?
         ORDER BY substr(start,1,10), all_day DESC, start`,
      )
      .all(householdId, toDate, fromDate) as Item[],
  );
}

export function openTasks(householdId: string): ItemWithPeople[] {
  return attachPeople(
    db
      .prepare(
        `SELECT * FROM items WHERE household_id = ? AND status = 'accepted' AND kind IN ('task','deadline')
         ORDER BY done, start`,
      )
      .all(householdId) as Item[],
  );
}

export function allAccepted(householdId: string): ItemWithPeople[] {
  return attachPeople(
    db
      .prepare(`SELECT * FROM items WHERE household_id = ? AND status = 'accepted' ORDER BY start`)
      .all(householdId) as Item[],
  );
}

export interface ItemPatch {
  kind?: Item["kind"];
  title?: string;
  start?: string;
  end?: string | null;
  all_day?: boolean;
  location?: string | null;
  notes?: string | null;
  needs_prep?: boolean;
  prep_note?: string | null;
  assignee_id?: string | null;
  people?: string[];
}

export function updateItem(householdId: string, itemId: string, patch: ItemPatch) {
  const fields: string[] = [];
  const values: unknown[] = [];
  const set = (col: string, v: unknown) => {
    fields.push(`${col} = ?`);
    values.push(v);
  };
  if (patch.kind) set("kind", patch.kind);
  if (patch.title !== undefined) set("title", patch.title);
  if (patch.start !== undefined) set("start", patch.start);
  if (patch.end !== undefined) set("end", patch.end);
  if (patch.all_day !== undefined) set("all_day", patch.all_day ? 1 : 0);
  if (patch.location !== undefined) set("location", patch.location);
  if (patch.notes !== undefined) set("notes", patch.notes);
  if (patch.needs_prep !== undefined) set("needs_prep", patch.needs_prep ? 1 : 0);
  if (patch.prep_note !== undefined) set("prep_note", patch.prep_note);
  if (patch.assignee_id !== undefined) set("assignee_id", patch.assignee_id);
  db.transaction(() => {
    if (fields.length) {
      fields.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
      db.prepare(`UPDATE items SET ${fields.join(", ")} WHERE id = ? AND household_id = ?`).run(
        ...values,
        itemId,
        householdId,
      );
    }
    if (patch.people) {
      const valid = new Set(
        (db.prepare(`SELECT id FROM people WHERE household_id = ?`).all(householdId) as { id: string }[]).map(
          (r) => r.id,
        ),
      );
      db.prepare(`DELETE FROM item_people WHERE item_id = ?`).run(itemId);
      const link = db.prepare(`INSERT OR IGNORE INTO item_people (item_id, person_id) VALUES (?, ?)`);
      for (const pid of patch.people) if (valid.has(pid)) link.run(itemId, pid);
    }
  })();
}

export function setStatus(householdId: string, itemIds: string[], status: Item["status"], userId: string | null) {
  const stmt = db.prepare(
    `UPDATE items SET status = ?, accepted_by = CASE WHEN ? = 'accepted' THEN ? ELSE accepted_by END,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND household_id = ?`,
  );
  db.transaction(() => {
    for (const iid of itemIds) stmt.run(status, status, userId, iid, householdId);
  })();
}

export function setDone(householdId: string, itemId: string, done: boolean) {
  db.prepare(
    `UPDATE items SET done = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND household_id = ?`,
  ).run(done ? 1 : 0, itemId, householdId);
}

export function createManualItem(householdId: string, userId: string, e: ExtractedItem, people: Person[]) {
  const iid = id("itm");
  db.prepare(
    `INSERT INTO items (id, household_id, capture_id, kind, title, start, end, all_day, location, notes,
       needs_prep, prep_note, confidence, source_quote, status, accepted_by)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, 'accepted', ?)`,
  ).run(
    iid,
    householdId,
    e.kind,
    e.title,
    e.start,
    e.end,
    e.all_day ? 1 : 0,
    e.location,
    e.notes,
    e.needs_prep ? 1 : 0,
    e.prep_note,
    userId,
  );
  const valid = new Set(people.map((p) => p.id));
  const link = db.prepare(`INSERT OR IGNORE INTO item_people (item_id, person_id) VALUES (?, ?)`);
  for (const pid of e.for_people) if (valid.has(pid)) link.run(iid, pid);
  return iid;
}

export function deleteItem(householdId: string, itemId: string) {
  db.prepare(`DELETE FROM items WHERE id = ? AND household_id = ?`).run(itemId, householdId);
}
