"use client";
import { useState, useTransition } from "react";
import { removeItem, toggleDone } from "@/app/app/actions";
import { formatTime, formatWhen, timeOf } from "@/lib/time";
import type { ItemWithPeople, Person } from "@/lib/types";
import { BagIcon, CheckIcon, PinIcon } from "./icons";
import { ItemEditor } from "./item-editor";
import { PeopleDots } from "./people";

export function ItemRow({
  item,
  people,
  today,
  showDate = false,
}: {
  item: ItemWithPeople;
  people: Person[];
  today: string;
  showDate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const byId = new Map(people.map((p) => [p.id, p]));
  const who = item.people.map((p) => byId.get(p)).filter(Boolean) as Person[];
  const assignee = item.assignee_id ? byId.get(item.assignee_id) : undefined;
  const accent = who[0]?.color ?? assignee?.color ?? "var(--line-strong)";
  const checkable = item.kind !== "event";
  const t = timeOf(item.start);
  const done = item.done === 1;

  return (
    <li className={`group relative rounded-2xl border border-line bg-surface transition-shadow hover:shadow-md ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-stretch gap-3 p-3 pl-0">
        <span className="w-1 shrink-0 rounded-r-full" style={{ background: accent }} />
        {checkable ? (
          <button
            aria-label={done ? "Mark not done" : "Mark done"}
            onClick={() => start(() => toggleDone(item.id, !done))}
            className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${
              done ? "border-sage bg-sage text-white" : "border-line-strong hover:border-ember"
            }`}
          >
            {done && <CheckIcon size={14} />}
          </button>
        ) : (
          <span className="w-14 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-ink-2">
            {t ? formatTime(t) : "All day"}
          </span>
        )}
        <button className="min-w-0 flex-1 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <p className={`font-semibold leading-snug ${done ? "text-muted line-through" : ""}`}>
            {item.kind === "deadline" && !done && <span className="mr-1.5 text-danger">Due</span>}
            {item.title}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[13px] text-muted">
            {(showDate || checkable) && <span>{formatWhen(item.start, item.end, item.all_day === 1, today)}</span>}
            {item.location && (
              <span className="inline-flex items-center gap-1"><PinIcon size={13} />{item.location}</span>
            )}
            {item.needs_prep === 1 && !done && (
              <span className="inline-flex items-center gap-1 text-honey"><BagIcon size={13} />{item.prep_note || "Prep"}</span>
            )}
            {assignee && <span>· {assignee.name}</span>}
          </p>
        </button>
        {who.length > 0 && <PeopleDots people={who} />}
      </div>
      {open && (
        <div className="border-t border-line p-4">
          <ItemEditor item={item} people={people} onDone={() => setOpen(false)} />
          <button
            className="btn btn-ghost btn-sm mt-3 text-danger"
            onClick={() => { if (confirm("Delete this from the calendar?")) start(() => removeItem(item.id)); }}
          >
            Delete
          </button>
        </div>
      )}
    </li>
  );
}
