import { z } from "zod";
import type { ExtractedItem } from "../types";

export const ExtractionSchema = z.object({
  summary: z
    .string()
    .describe("A short, human title for the whole document, e.g. 'Year 4 newsletter — November'."),
  items: z.array(
    z.object({
      kind: z.enum(["event", "deadline", "task"]),
      title: z.string().describe("Short, specific, starts with the thing: 'Bake sale', 'Return permission slip'."),
      start: z
        .string()
        .describe("'YYYY-MM-DD' if all_day, else local time 'YYYY-MM-DDTHH:mm' in the household timezone."),
      end: z.string().nullable().describe("Same format as start, or null."),
      all_day: z.boolean(),
      location: z.string().nullable(),
      notes: z.string().nullable().describe("One or two lines of useful detail (cost, what to bring), or null."),
      for_people: z.array(z.string()).describe("Names from the household list this item concerns. Empty if unclear."),
      needs_prep: z.boolean().describe("True if someone must prepare the day before (pack, pay, sign, buy, wear)."),
      prep_note: z.string().nullable().describe("What to prepare, e.g. 'Pack £3 and a costume'."),
      confidence: z.number().describe("0 to 1. Lower when the date was inferred or ambiguous."),
      source_quote: z.string().nullable().describe("The exact short phrase from the document this came from."),
    }),
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** Normalise and validate model output; drops items with unusable dates. */
export function normalizeItems(raw: Extraction["items"]): ExtractedItem[] {
  const out: ExtractedItem[] = [];
  for (const r of raw) {
    let start = r.start.trim().slice(0, 16);
    let allDay = r.all_day;
    if (DATE.test(start)) allDay = true;
    else if (DATETIME.test(start)) {
      if (allDay) start = start.slice(0, 10);
    } else continue;

    let end = r.end ? r.end.trim().slice(0, 16) : null;
    if (end) {
      if (allDay) end = DATE.test(end.slice(0, 10)) ? end.slice(0, 10) : null;
      else if (!DATETIME.test(end)) end = DATE.test(end) ? null : null;
      if (end && end < start) end = null;
      if (end === start) end = null;
    }

    const title = r.title.trim().slice(0, 200);
    if (!title) continue;
    out.push({
      kind: r.kind,
      title,
      start,
      end,
      all_day: allDay,
      location: r.location?.trim() || null,
      notes: r.notes?.trim() || null,
      for_people: r.for_people.map((n) => n.trim()).filter(Boolean),
      needs_prep: r.needs_prep,
      prep_note: r.needs_prep ? r.prep_note?.trim() || null : null,
      confidence: Math.max(0, Math.min(1, Number.isFinite(r.confidence) ? r.confidence : 0.5)),
      source_quote: r.source_quote?.trim().slice(0, 400) || null,
    });
  }
  return out;
}
