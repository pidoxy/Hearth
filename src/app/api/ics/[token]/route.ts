import { db } from "@/lib/db";
import { listPeople } from "@/lib/households";
import { allAccepted } from "@/lib/items";
import { buildIcs } from "@/lib/ics";
import type { Household, Person } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const raw = (await params).token.replace(/\.ics$/i, "");
  let household = db.prepare(`SELECT * FROM households WHERE ics_token = ?`).get(raw) as Household | undefined;
  let person: Person | undefined;
  if (!household) {
    person = db.prepare(`SELECT * FROM people WHERE ics_token = ?`).get(raw) as Person | undefined;
    if (person) household = db.prepare(`SELECT * FROM households WHERE id = ?`).get(person.household_id) as Household;
  }
  if (!household) return new Response("Not found", { status: 404 });

  const people = listPeople(household.id);
  let items = allAccepted(household.id);
  if (person) {
    const pid = person.id;
    items = items.filter((i) => i.assignee_id === pid || i.people.includes(pid) || (!i.assignee_id && !i.people.length));
  }
  const ics = buildIcs({
    name: person ? `${household.name} · ${person.name}` : household.name,
    timezone: household.timezone,
    items,
    people,
    host: new URL(req.url).hostname,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="hearth.ics"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
