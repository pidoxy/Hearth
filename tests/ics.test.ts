import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/ics";
import type { ItemWithPeople } from "@/lib/types";

const base: ItemWithPeople = {
  id: "itm_1", household_id: "hh", capture_id: null, kind: "event", title: "Bake sale, Year 4; hall",
  start: "2026-11-14T15:15", end: null, all_day: 0, location: "School hall", notes: null, needs_prep: 1,
  prep_note: "Bring £3", confidence: 0.9, source_quote: null, status: "accepted", done: 0, assignee_id: null,
  accepted_by: null, created_at: "2026-11-04T00:00:00Z", updated_at: "2026-11-04T00:00:00Z", people: ["p1"],
};

describe("ics", () => {
  const ics = buildIcs({
    name: "Okafor home", timezone: "Europe/London", host: "hearth.test",
    people: [{ id: "p1", household_id: "hh", name: "Zara", color: "#000", ics_token: "x" }],
    items: [base, { ...base, id: "itm_2", kind: "deadline", title: "Slip", start: "2026-11-20", all_day: 1, needs_prep: 0 }],
  });
  it("is a valid calendar with CRLF lines", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trim().endsWith("END:VCALENDAR")).toBe(true);
  });
  it("converts timed events to UTC and escapes text", () => {
    expect(ics).toContain("DTSTART:20261114T151500Z");
    expect(ics).toContain(String.raw`SUMMARY:Bake sale\, Year 4\; hall`);
    expect(ics).toContain("BEGIN:VALARM");
  });
  it("renders all-day deadlines with exclusive end", () => {
    expect(ics).toContain("DTSTART;VALUE=DATE:20261120");
    expect(ics).toContain("DTEND;VALUE=DATE:20261121");
    expect(ics).toContain("SUMMARY:Due: Slip");
  });
});
