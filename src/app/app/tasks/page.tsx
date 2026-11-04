import { requireCtx } from "@/lib/auth";
import { listPeople } from "@/lib/households";
import { openTasks } from "@/lib/items";
import { addDays, zonedDate } from "@/lib/time";
import type { ItemWithPeople } from "@/lib/types";
import { ItemRow } from "@/components/item-row";
import { NewItemButton } from "@/components/new-item";
import { PersonFilter } from "@/components/person-filter";

export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ who?: string; done?: string }> }) {
  const { household } = await requireCtx();
  const { who, done } = await searchParams;
  const people = listPeople(household.id);
  const today = zonedDate(new Date(), household.timezone);
  const all = openTasks(household.id).filter((i) => !who || i.assignee_id === who || i.people.includes(who));
  const open = all.filter((i) => !i.done);
  const week = addDays(today, 7);

  const sections: [string, ItemWithPeople[], string?][] = [
    ["Overdue", open.filter((i) => i.start.slice(0, 10) < today), "text-danger"],
    ["This week", open.filter((i) => i.start.slice(0, 10) >= today && i.start.slice(0, 10) <= week)],
    ["Later", open.filter((i) => i.start.slice(0, 10) > week)],
  ];
  const finished = all.filter((i) => i.done).reverse().slice(0, 30);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="h-display text-3xl sm:text-4xl">Tasks</h1>
          <p className="mt-1 text-ink-2">Deadlines and to-dos — forms, payments, things to buy.</p>
        </div>
        <NewItemButton people={people} defaultDate={today} label="New task" />
      </div>
      <PersonFilter people={people} active={who} base="/app/tasks" />

      {open.length === 0 && (
        <div className="rounded-3xl border border-dashed border-line-strong p-10 text-center">
          <p className="h-display text-2xl">Nothing to do. Enjoy it.</p>
          <p className="mt-2 text-ink-2">Deadlines Hearth finds in letters and emails will show up here.</p>
        </div>
      )}

      {sections.map(([title, list, tone]) =>
        list.length ? (
          <section key={title}>
            <h2 className={`mb-2.5 text-lg font-semibold ${tone ?? ""}`}>
              {title} <span className="text-muted">· {list.length}</span>
            </h2>
            <ul className="space-y-2">
              {list.map((i) => <ItemRow key={i.id} item={i} people={people} today={today} />)}
            </ul>
          </section>
        ) : null,
      )}

      {finished.length > 0 && (
        <details className="group" open={done === "1"}>
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted hover:text-ink">
            <span className="group-open:hidden">Show</span><span className="hidden group-open:inline">Hide</span> {finished.length} done
          </summary>
          <ul className="mt-3 space-y-2">
            {finished.map((i) => <ItemRow key={i.id} item={i} people={people} today={today} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
