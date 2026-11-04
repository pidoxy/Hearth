import * as chrono from "chrono-node";
import { wallToUtc } from "../time";
import type { ExtractedItem } from "../types";
import type { ExtractInput, ExtractResult } from "./index";

const pad = (n: number) => String(n).padStart(2, "0");

const DEADLINE = /\b(by|due|deadline|before|no later than|return|submit|deadline|closes?)\b/i;
const PREP = /\b(bring|pack|wear|remember|pay|£|\$|€|₦|costume|lunch|kit|sign(ed)?)\b/i;
const TASK = /\b(buy|order|book|sign|pay|renew|call|email|send)\b/i;

/** Split into sentence-ish chunks, keeping line structure from emails/flyers. */
function sentences(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function cleanTitle(sentence: string, dateText: string): string {
  let t = sentence.replace(dateText, " ");
  t = t
    .replace(/\b(on|at|from|by|until|before|this|next|is|will be|takes place|will take place)\s*[,.:;-]*\s*$/i, "")
    .replace(/^[\s,.:;\-–—•*]+|[\s,.:;\-–—•*]+$/g, "")
    .replace(/\s{2,}/g, " ");
  if (t.length > 80) t = t.slice(0, 77).replace(/\s+\S*$/, "") + "…";
  return t ? t[0].toUpperCase() + t.slice(1) : "Untitled";
}

/** Offline extractor: deterministic natural-language date parsing. Text only. */
export function extractWithFallback(input: ExtractInput): ExtractResult {
  const text = input.text ?? "";
  const docInstant = wallToUtc(`${input.docDate}T12:00`, input.timezone);
  // Offset (minutes) of the household timezone at the document date.
  const offset = Math.round((Date.parse(`${input.docDate}T12:00:00Z`) - docInstant.getTime()) / 60000);
  const ref = { instant: docInstant, timezone: offset };

  const items: ExtractedItem[] = [];
  const seen = new Set<string>();
  const lowerPeople = input.people.map((p) => [p, p.toLowerCase()] as const);

  const all = sentences(text);
  const parsed = all.map((s) => chrono.parse(s, ref, { forwardDate: true }));
  for (let si = 0; si < all.length; si++) {
    const s = all[si];
    const results = parsed[si];
    // A following sentence with no date of its own ("Please bring £3.") belongs to this one.
    const follow = si + 1 < all.length && parsed[si + 1].length === 0 ? all[si + 1] : "";
    for (const r of results) {
      const y = r.start.get("year");
      const m = r.start.get("month");
      const d = r.start.get("day");
      if (!y || !m || !d) continue;
      // Ignore vague matches like "the year" or "this month" — we need an actual day.
      if (!r.start.isCertain("day") && !r.start.isCertain("weekday")) continue;
      const day = `${y}-${pad(m)}-${pad(d)}`;
      if (day < input.docDate) continue;
      const timed = r.start.isCertain("hour");
      const start = timed ? `${day}T${pad(r.start.get("hour") ?? 0)}:${pad(r.start.get("minute") ?? 0)}` : day;
      let end: string | null = null;
      if (r.end && timed && r.end.isCertain("hour")) {
        const ey = r.end.get("year") ?? y, em = r.end.get("month") ?? m, ed = r.end.get("day") ?? d;
        end = `${ey}-${pad(em)}-${pad(ed)}T${pad(r.end.get("hour") ?? 0)}:${pad(r.end.get("minute") ?? 0)}`;
        if (end <= start) end = null;
      }
      const title = cleanTitle(s, r.text);
      const key = `${title}|${start}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const kind = DEADLINE.test(s) ? "deadline" : TASK.test(s) && !timed ? "task" : "event";
      const lower = s.toLowerCase();
      items.push({
        kind,
        title,
        start,
        end,
        all_day: !timed,
        location: null,
        notes: null,
        for_people: lowerPeople.filter(([, l]) => lower.includes(l)).map(([p]) => p),
        needs_prep: PREP.test(s) || PREP.test(follow),
        prep_note: PREP.test(follow) ? follow.slice(0, 160) : PREP.test(s) ? s.slice(0, 160) : null,
        confidence: timed ? 0.55 : 0.45,
        source_quote: (follow && PREP.test(follow) ? `${s} ${follow}` : s).slice(0, 300),
      });
    }
  }

  // Skip greetings ("Dear Parents,") when picking a title.
  const firstLine =
    sentences(text).find((l) => !/^(dear|hi|hello|hey|good (morning|afternoon|evening)|to)\b/i.test(l))?.replace(/[,:]$/, "") ?? "";
  return {
    summary: input.subject || (firstLine ? firstLine.slice(0, 80) : null),
    items,
    extractor: "fallback:chrono",
  };
}
