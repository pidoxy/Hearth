import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { listPeople } from "@/lib/households";
import { acceptedBetween } from "@/lib/items";
import { addDays, daysInMonth, formatDay, monthName, weekdayOf, zonedDate } from "@/lib/time";
import type { ItemWithPeople } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { ItemRow } from "@/components/item-row";
import { NewItemButton } from "@/components/new-item";
import { PersonFilter } from "@/components/person-filter";

export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (n: number) => String(n).padStart(2, "0");

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string; who?: string }>;
}) {
  const { household } = await requireCtx();
  const sp = await searchParams;
  const people = listPeople(household.id);
  const byId = new Map(people.map((p) => [p.id, p]));
  const today = zonedDate(new Date(), household.timezone);

  const [y, m] = (/^\d{4}-\d{2}$/.test(sp.m ?? "") ? sp.m! : today.slice(0, 7)).split("-").map(Number);
  const first = `${y}-${pad(m)}-01`;
  const lead = (weekdayOf(first) + 6) % 7; // Monday-first
  const gridStart = addDays(first, -lead);
  const cells = Math.ceil((lead + daysInMonth(y, m)) / 7) * 7;
  const gridEnd = addDays(gridStart, cells - 1);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? sp.d! : today.slice(0, 7) === `${y}-${pad(m)}` ? today : first;

  const forWho = (i: ItemWithPeople) => !sp.who || i.people.includes(sp.who) || i.assignee_id === sp.who;
  const items = acceptedBetween(household.id, gridStart, gridEnd).filter(forWho);
  const onDay = (d: string) =>
    items.filter((i) => i.start.slice(0, 10) <= d && (i.end ?? i.start).slice(0, 10) >= d);

  const prev = m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`;
  const q = (extra: Record<string, string | undefined>) =>
    "?" + Object.entries({ who: sp.who, ...extra }).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join("&");
  const selectedItems = onDay(selected);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="h-display text-3xl sm:text-4xl">
          {monthName(m, true)} <span className="text-muted">{y}</span>
        </h1>
        <div className="flex items-center gap-2">
          <Link href={`/app/calendar${q({ m: prev })}`} className="btn btn-secondary px-2.5" aria-label="Previous month"><ChevronLeft size={18} /></Link>
          <Link href={`/app/calendar${q({})}`} className="btn btn-secondary">Today</Link>
          <Link href={`/app/calendar${q({ m: next })}`} className="btn btn-secondary px-2.5" aria-label="Next month"><ChevronRight size={18} /></Link>
          <NewItemButton people={people} defaultDate={selected} />
        </div>
      </div>

      <PersonFilter people={people} active={sp.who} base="/app/calendar" extra={`m=${y}-${pad(m)}`} />

      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: cells }, (_, i) => {
            const d = addDays(gridStart, i);
            const inMonth = d.slice(0, 7) === `${y}-${pad(m)}`;
            const list = onDay(d);
            const isSel = d === selected;
            return (
              <Link
                key={d}
                href={`/app/calendar${q({ m: `${y}-${pad(m)}`, d })}`}
                className={`relative min-h-16 border-b border-r border-line p-1.5 text-left transition-colors sm:min-h-28 sm:p-2 [&:nth-child(7n)]:border-r-0 ${
                  inMonth ? "" : "bg-sunken/60 text-muted"
                } ${isSel ? "bg-ember-soft/60" : "hover:bg-surface-2"}`}
              >
                <span
                  className={`grid size-7 place-items-center rounded-full text-sm font-semibold ${
                    d === today ? "bg-ember text-ember-ink" : isSel ? "ring-2 ring-ember" : ""
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <div className="mt-1 hidden space-y-1 sm:block">
                  {list.slice(0, 3).map((it) => {
                    const c = byId.get(it.people[0] ?? it.assignee_id ?? "")?.color ?? "var(--muted)";
                    return (
                      <div
                        key={it.id}
                        className={`truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${it.done ? "line-through opacity-60" : ""}`}
                        style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: `color-mix(in srgb, ${c} 70%, var(--ink))` }}
                      >
                        {it.title}
                      </div>
                    );
                  })}
                  {list.length > 3 && <div className="px-1 text-[11px] font-semibold text-muted">+{list.length - 3} more</div>}
                </div>
                <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((it) => (
                    <span
                      key={it.id}
                      className="size-1.5 rounded-full"
                      style={{ background: byId.get(it.people[0] ?? it.assignee_id ?? "")?.color ?? "var(--muted)" }}
                    />
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">{selected === today ? "Today" : formatDay(selected)}</h2>
        {selectedItems.length ? (
          <ul className="space-y-2">
            {selectedItems.map((i) => (
              <ItemRow key={i.id} item={i} people={people} today={today} />
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">Nothing planned.</p>
        )}
      </section>
    </div>
  );
}
