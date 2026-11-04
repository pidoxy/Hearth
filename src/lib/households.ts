import "server-only";
import { db } from "./db";
import { id, PERSON_COLORS, token } from "./ids";
import type { Household, Person } from "./types";

export function createHousehold(opts: { name: string; timezone: string; ownerUserId: string; ownerName: string }) {
  const hid = id("hh");
  const pid = id("per");
  db.transaction(() => {
    db.prepare(
      `INSERT INTO households (id, name, timezone, inbound_code, ics_token) VALUES (?, ?, ?, ?, ?)`,
    ).run(hid, opts.name, opts.timezone, token(10), token(32));
    db.prepare(`INSERT INTO people (id, household_id, name, color, ics_token) VALUES (?, ?, ?, ?, ?)`).run(
      pid,
      hid,
      opts.ownerName,
      PERSON_COLORS[0],
      token(32),
    );
    db.prepare(`UPDATE users SET household_id = ?, person_id = ? WHERE id = ?`).run(hid, pid, opts.ownerUserId);
  })();
  return hid;
}

export function listPeople(householdId: string): Person[] {
  return db
    .prepare(`SELECT * FROM people WHERE household_id = ? ORDER BY created_at, rowid`)
    .all(householdId) as Person[];
}

export function addPerson(householdId: string, name: string, color?: string): Person {
  const existing = listPeople(householdId);
  const used = new Set(existing.map((p) => p.color));
  const pick = color ?? PERSON_COLORS.find((c) => !used.has(c)) ?? PERSON_COLORS[existing.length % PERSON_COLORS.length];
  const p: Person = { id: id("per"), household_id: householdId, name, color: pick, ics_token: token(32) };
  db.prepare(`INSERT INTO people (id, household_id, name, color, ics_token) VALUES (?, ?, ?, ?, ?)`).run(
    p.id,
    p.household_id,
    p.name,
    p.color,
    p.ics_token,
  );
  return p;
}

export function getHouseholdByInbound(code: string): Household | undefined {
  return db.prepare(`SELECT * FROM households WHERE inbound_code = ?`).get(code.toLowerCase()) as
    | Household
    | undefined;
}

export function householdMembers(householdId: string) {
  return db
    .prepare(`SELECT id, email, name, person_id FROM users WHERE household_id = ? ORDER BY created_at`)
    .all(householdId) as { id: string; email: string; name: string; person_id: string | null }[];
}

export function inboundAddress(h: Household): string {
  const domain = process.env.INBOUND_DOMAIN || "inbound.example.com";
  return `${h.inbound_code}@${domain}`;
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
