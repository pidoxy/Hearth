"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { destroySession, requireCtx } from "@/lib/auth";
import { deleteCapture, getCapture, processCapture } from "@/lib/captures";
import { db } from "@/lib/db";
import { addPerson, listPeople } from "@/lib/households";
import { token } from "@/lib/ids";
import { createManualItem, deleteItem, setDone, setStatus, updateItem } from "@/lib/items";
import { isValidTimeZone } from "@/lib/time";
import type { ItemKind } from "@/lib/types";

function refresh() {
  revalidatePath("/app", "layout");
}

export async function acceptItems(itemIds: string[]) {
  const { household, user } = await requireCtx();
  setStatus(household.id, itemIds, "accepted", user.id);
  refresh();
}

export async function dismissItems(itemIds: string[]) {
  const { household, user } = await requireCtx();
  setStatus(household.id, itemIds, "dismissed", user.id);
  refresh();
}

export async function restoreItem(itemId: string) {
  const { household, user } = await requireCtx();
  setStatus(household.id, [itemId], "proposed", user.id);
  refresh();
}

export async function toggleDone(itemId: string, done: boolean) {
  const { household } = await requireCtx();
  setDone(household.id, itemId, done);
  refresh();
}

export async function removeItem(itemId: string) {
  const { household } = await requireCtx();
  deleteItem(household.id, itemId);
  refresh();
}

/** Parses the shared item editor form. */
function readItemForm(form: FormData) {
  const kind = (form.get("kind") as ItemKind) || "event";
  const title = String(form.get("title") ?? "").trim();
  const date = String(form.get("date") ?? "");
  const allDay = form.get("all_day") === "on";
  const time = String(form.get("time") ?? "");
  const endTime = String(form.get("end_time") ?? "");
  const endDate = String(form.get("end_date") ?? "");
  if (!title) throw new Error("Give it a title.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a date.");
  const timed = !allDay && /^\d{2}:\d{2}$/.test(time);
  const start = timed ? `${date}T${time}` : date;
  let end: string | null = null;
  if (timed && /^\d{2}:\d{2}$/.test(endTime) && endTime > time) end = `${date}T${endTime}`;
  if (!timed && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && endDate > date) end = endDate;
  const needsPrep = form.get("needs_prep") === "on";
  return {
    kind,
    title: title.slice(0, 200),
    start,
    end,
    all_day: !timed,
    location: String(form.get("location") ?? "").trim() || null,
    notes: String(form.get("notes") ?? "").trim() || null,
    needs_prep: needsPrep,
    prep_note: needsPrep ? String(form.get("prep_note") ?? "").trim() || null : null,
    assignee_id: String(form.get("assignee_id") ?? "") || null,
    people: form.getAll("people").map(String),
  };
}

export type FormState = { error?: string; ok?: boolean } | undefined;

export async function saveItem(_prev: FormState, form: FormData): Promise<FormState> {
  const { household, user } = await requireCtx();
  try {
    const itemId = String(form.get("id") ?? "");
    const data = readItemForm(form);
    if (itemId) {
      updateItem(household.id, itemId, data);
      if (form.get("accept") === "1") setStatus(household.id, [itemId], "accepted", user.id);
    } else {
      const newId = createManualItem(
        household.id,
        user.id,
        { ...data, for_people: data.people, confidence: 1, source_quote: null },
        listPeople(household.id),
      );
      if (data.assignee_id) updateItem(household.id, newId, { assignee_id: data.assignee_id });
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't save that." };
  }
}

export async function retryCapture(captureId: string) {
  const { household } = await requireCtx();
  const cap = getCapture(household.id, captureId);
  if (!cap) return;
  await processCapture(household, cap.id);
  refresh();
}

export async function removeCapture(captureId: string) {
  const { household } = await requireCtx();
  deleteCapture(household.id, captureId);
  refresh();
  redirect("/app/inbox");
}

// ───────── Household settings ─────────

export async function addPersonAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { household } = await requireCtx();
  const name = String(form.get("name") ?? "").trim().slice(0, 40);
  if (!name) return { error: "Add a name." };
  if (listPeople(household.id).some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return { error: `${name} is already in your household.` };
  }
  addPerson(household.id, name);
  refresh();
  return { ok: true };
}

export async function removePerson(personId: string) {
  const { household } = await requireCtx();
  const linked = db.prepare(`SELECT 1 FROM users WHERE person_id = ?`).get(personId);
  if (linked) return; // people with accounts can't be removed here
  db.prepare(`DELETE FROM people WHERE id = ? AND household_id = ?`).run(personId, household.id);
  refresh();
}

export async function updateHousehold(_prev: FormState, form: FormData): Promise<FormState> {
  const { household } = await requireCtx();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const tz = String(form.get("timezone") ?? "");
  const senders = String(form.get("allowed_senders") ?? "").slice(0, 2000);
  if (!name) return { error: "Household name can't be empty." };
  if (!isValidTimeZone(tz)) return { error: "That timezone isn't recognised." };
  db.prepare(
    `UPDATE households SET name = ?, timezone = ?, digest_enabled = ?, allowed_senders = ? WHERE id = ?`,
  ).run(name, tz, form.get("digest_enabled") === "on" ? 1 : 0, senders, household.id);
  refresh();
  return { ok: true };
}

export async function rotateInbound() {
  const { household } = await requireCtx();
  db.prepare(`UPDATE households SET inbound_code = ? WHERE id = ?`).run(token(10), household.id);
  refresh();
}

export async function rotateCalendarLinks() {
  const { household } = await requireCtx();
  db.transaction(() => {
    db.prepare(`UPDATE households SET ics_token = ? WHERE id = ?`).run(token(32), household.id);
    for (const p of listPeople(household.id)) {
      db.prepare(`UPDATE people SET ics_token = ? WHERE id = ?`).run(token(32), p.id);
    }
  })();
  refresh();
}

export async function createInvite(): Promise<string> {
  const { household, user } = await requireCtx();
  const t = token(24);
  const expires = new Date(Date.now() + 7 * 86400_000).toISOString();
  db.prepare(`INSERT INTO invites (token, household_id, created_by, expires_at) VALUES (?, ?, ?, ?)`).run(
    t,
    household.id,
    user.id,
    expires,
  );
  return t;
}

export async function approveUnverified(captureId: string) {
  const { household } = await requireCtx();
  const cap = getCapture(household.id, captureId);
  if (!cap || cap.status !== "unverified") return;
  await processCapture(household, cap.id);
  refresh();
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
