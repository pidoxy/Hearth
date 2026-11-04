import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { listPeople } from "@/lib/households";
import { acceptedBetween } from "@/lib/items";
import { addDays, formatDay, relativeDay, zonedDate, zonedParts } from "@/lib/time";
import type { ItemWithPeople } from "@/lib/types";
import { BagIcon, ChevronRight, InboxIcon } from "@/components/icons";
import { ItemRow } from "@/components/item-row";
import { NewItemButton } from "@/components/new-item";
import { PersonFilter } from "@/components/person-filter";

export const metadata = { title: "Today" };

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { household, user } = await requireCtx();
  const { who } = await searchParams;
  const people = listPeople(household.id);
  const now = new Date();
  const today = zonedDate(now, household.timezone);
  const hour = zonedParts(now, household.timezone).hour;
  const horizon = addDays(today, 13);

  const forWho = (i: ItemWithPeople) => !who || i.people.includes(who) || i.assignee_id === who;
  const items = acceptedBetween(household.id, today, horizon).filter(forWho);
  const overdue = (
    db
      .prepare(
        `SELECT id FROM items WHERE household_id = ? AND status = 'accepted' AND done = 0
           AND kind IN ('task','deadline') AND substr(start,1,10) < ?`,
      )
      .all(household.id, today) as { id: string }[]
  ).length;
  const { n: toReview } = db
    .prepare(`SELECT COUNT(*) AS n FROM items WHERE household_id = ? AND status = 'proposed'`)
    .get(household.id) as { n: number };

  const tomorrow = addDays(today, 1);
  const prepTonight = items.filter((i) => i.needs_prep && !i.done && i.start.slice(0, 10) === tomorrow);

  const byDay = new Map<string, ItemWithPeople[]>();
  for (const it of items) {
    const day = it.start.slice(0, 10) < today ? today : it.start.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), it]);
  }
  const days = [...byDay.keys()].sort();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{formatDay(today)}</p>
          <h1 className="h-display mt-1 text-3xl sm:text-4xl">
            {greeting(hour)}, {user.name.split(" ")[0]}.
          </h1>
        </div>
        <NewItemButton people={people} defaultDate={today} />
      </div>

      {(toReview > 0 || overdue > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {toReview > 0 && (
            <Link href="/app/inbox" className="group flex items-center gap-4 rounded-2xl bg-ember p-4 text-ember-ink shadow-md">
              <span className="grid size-11 place-items-center rounded-xl bg-white/15"><InboxIcon /></span>
              <div className="flex-1">
                <p className="font-semibold">{toReview} new {toReview === 1 ? "date" : "dates"} to review</p>
                <p className="text-sm opacity-85">Check them before they hit the calendar.</p>
              </div>
              <ChevronRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          {overdue > 0 && (
            <Link href="/app/tasks" className="flex items-center gap-4 rounded-2xl border border-danger/30 bg-danger-soft p-4 text-danger">
              <span className="text-2xl font-bold tabular-nums">{overdue}</span>
              <p className="flex-1 font-semibold">overdue {overdue === 1 ? "task" : "tasks"}</p>
              <ChevronRight />
            </Link>
          )}
        </div>
      )}

      <PersonFilter people={people} active={who} base="/app" />

      {prepTonight.length > 0 && (
        <section className="rounded-3xl border border-honey/30 bg-honey-soft p-5">
          <div className="flex items-center gap-2 text-honey">
            <BagIcon />
            <h2 className="font-semibold">Get ready tonight</h2>
          </div>
          <ul className="mt-3 space-y-2">
            {prepTonight.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                <span className="font-semibold">{i.prep_note || `Prepare for ${i.title}`}</span>
                <span className="text-sm text-ink-2">for {i.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {days.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-line-strong p-10 text-center">
          <p className="h-display text-2xl">A clear fortnight.</p>
          <p className="mx-auto mt-2 max-w-sm text-ink-2">
            Nothing on the calendar{who ? " for this person" : ""} for the next two weeks. Snap a school letter or
            forward an email to fill it in.
          </p>
          <Link href="/app/inbox#capture" className="btn btn-primary mt-6">Add something</Link>
        </div>
      ) : (
        <div className="space-y-7">
          {days.map((d) => (
            <section key={d}>
              <h2 className="mb-2.5 flex items-baseline gap-2">
                <span className={`text-lg font-semibold ${d === today ? "text-ember" : ""}`}>{relativeDay(d, today)}</span>
                {(d === today || d === tomorrow) && <span className="text-sm text-muted">{formatDay(d)}</span>}
              </h2>
              <ul className="space-y-2">
                {byDay.get(d)!.map((i) => (
                  <ItemRow key={i.id} item={i} people={people} today={today} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
