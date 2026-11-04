import { beforeAll, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string }[] = [];
vi.mock("@/lib/mailer", () => ({
  sendMail: async (m: { to: string; subject: string }) => { sent.push(m); return { delivered: true }; },
  mailConfigured: () => true,
}));

import { db } from "@/lib/db";
import { createHousehold, listPeople } from "@/lib/households";
import { createManualItem } from "@/lib/items";
import { runReminders } from "@/lib/reminders";

describe("reminders", () => {
  let hid = "";
  beforeAll(() => {
    db.prepare(`INSERT INTO users (id, email, name, password_hash) VALUES ('u1','ada@example.com','Ada','x')`).run();
    hid = createHousehold({ name: "Test home", timezone: "Europe/London", ownerUserId: "u1", ownerName: "Ada" });
    const people = listPeople(hid);
    const base = { end: null, location: null, notes: null, for_people: [], confidence: 1, source_quote: null };
    createManualItem(hid, "u1", { ...base, kind: "event", title: "Dentist", start: "2026-11-10T10:40", all_day: false, needs_prep: false, prep_note: null }, people);
    createManualItem(hid, "u1", { ...base, kind: "event", title: "Bake sale", start: "2026-11-11T15:15", all_day: false, needs_prep: true, prep_note: "Pack £3" }, people);
  });

  it("sends the morning digest once", async () => {
    const morning = new Date("2026-11-10T07:30:00Z"); // 07:30 London
    await runReminders(morning);
    await runReminders(morning);
    const digests = sent.filter((m) => m.subject.startsWith("Today at"));
    expect(digests).toHaveLength(1);
    expect(digests[0].subject).toContain("2 things");
  });

  it("sends night-before prep reminders once", async () => {
    const evening = new Date("2026-11-10T19:15:00Z");
    await runReminders(evening);
    await runReminders(evening);
    const prep = sent.filter((m) => m.subject.startsWith("For tomorrow"));
    expect(prep).toHaveLength(1);
    expect(prep[0].subject).toContain("Bake sale");
  });

  it("sends nothing outside the windows", async () => {
    const before = sent.length;
    await runReminders(new Date("2026-11-12T13:00:00Z"));
    expect(sent.length).toBe(before);
  });
});
