import { addDays, wallToUtc } from "./time";
import type { ItemWithPeople, Person } from "./types";

/** RFC 5545 text escaping. */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Fold lines to 75 octets. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let i = 0;
  while (i < bytes.length) {
    let end = Math.min(i + (parts.length ? 74 : 75), bytes.length);
    // don't split a UTF-8 sequence
    while (end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    parts.push(bytes.subarray(i, end).toString("utf8"));
    i = end;
  }
  return parts.join("\r\n ");
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const ymd = (s: string) => s.slice(0, 10).replace(/-/g, "");

export function buildIcs(opts: {
  name: string;
  timezone: string;
  items: ItemWithPeople[];
  people: Person[];
  host: string;
}): string {
  const peopleById = new Map(opts.people.map((p) => [p.id, p]));
  const now = utcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hearth//Household Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    `X-WR-TIMEZONE:${opts.timezone}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  for (const item of opts.items) {
    const isTask = item.kind !== "event";
    const prefix = item.kind === "task" ? (item.done ? "☑ " : "☐ ") : item.kind === "deadline" ? (item.done ? "✓ Due: " : "Due: ") : "";
    const who = item.people.map((p) => peopleById.get(p)?.name).filter(Boolean);
    const assignee = item.assignee_id ? peopleById.get(item.assignee_id)?.name : null;
    const descParts = [
      item.notes,
      item.needs_prep && item.prep_note ? `Prep: ${item.prep_note}` : null,
      who.length ? `For: ${who.join(", ")}` : null,
      assignee ? `Owner: ${assignee}` : null,
      item.source_quote ? `Source: “${item.source_quote}”` : null,
    ].filter(Boolean) as string[];

    lines.push("BEGIN:VEVENT", `UID:${item.id}@${opts.host}`, `DTSTAMP:${now}`);
    const allDay = item.all_day === 1 || (isTask && item.start.length === 10);
    if (allDay) {
      const endDay = item.end ? addDays(item.end.slice(0, 10), 1) : addDays(item.start.slice(0, 10), 1);
      lines.push(`DTSTART;VALUE=DATE:${ymd(item.start)}`, `DTEND;VALUE=DATE:${ymd(endDay)}`);
    } else {
      const start = wallToUtc(item.start, opts.timezone);
      const end = item.end ? wallToUtc(item.end, opts.timezone) : new Date(start.getTime() + (isTask ? 30 : 60) * 60_000);
      lines.push(`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`);
    }
    lines.push(`SUMMARY:${esc(prefix + item.title)}`);
    if (item.location) lines.push(`LOCATION:${esc(item.location)}`);
    if (descParts.length) lines.push(`DESCRIPTION:${esc(descParts.join("\n"))}`);
    if (who.length) lines.push(`CATEGORIES:${who.map((w) => esc(w!)).join(",")}`);
    lines.push(`LAST-MODIFIED:${utcStamp(new Date(item.updated_at))}`);
    if (item.needs_prep) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(item.prep_note || `Prepare for ${item.title}`)}`,
        allDay ? "TRIGGER:-PT5H" : "TRIGGER:-PT14H",
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
