"use client";
import { useState, useTransition } from "react";
import { acceptItems, dismissItems } from "@/app/app/actions";
import { formatWhen } from "@/lib/time";
import type { ItemWithPeople, Person } from "@/lib/types";
import { BagIcon, CheckIcon, ClockIcon, PencilIcon, PinIcon, QuoteIcon, XIcon } from "./icons";
import { ItemEditor } from "./item-editor";
import { PersonChip } from "./people";

const KIND_STYLE: Record<string, string> = {
  event: "bg-sunken text-ink-2",
  deadline: "bg-danger-soft text-danger",
  task: "bg-sage-soft text-sage",
};

export function KindBadge({ kind }: { kind: string }) {
  return <span className={`chip border-transparent capitalize ${KIND_STYLE[kind] ?? ""}`}>{kind}</span>;
}

function Confidence({ value }: { value: number }) {
  if (value >= 0.8) return null;
  return (
    <span className="chip border-transparent bg-honey-soft text-honey" title="Hearth wasn't sure about this one — double-check the date.">
      Check date
    </span>
  );
}

export function ReviewCard({ item, people, today }: { item: ItemWithPeople; people: Person[]; today: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const byId = new Map(people.map((p) => [p.id, p]));
  const assignee = item.assignee_id ? byId.get(item.assignee_id) : null;

  if (gone) return null;

  if (editing) {
    return (
      <li className="card p-5 animate-rise">
        <p className="eyebrow mb-4">Edit before adding</p>
        <ItemEditor item={item} people={people} acceptOnSave submitLabel="Save & add to calendar" onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className={`card p-4 sm:p-5 animate-rise transition-opacity ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindBadge kind={item.kind} />
            <Confidence value={item.confidence} />
          </div>
          <h3 className="mt-2 text-[1.05rem] font-semibold leading-snug">{item.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon size={15} className="text-muted" />
              {formatWhen(item.start, item.end, item.all_day === 1, today)}
            </span>
            {item.location && (
              <span className="inline-flex items-center gap-1.5">
                <PinIcon size={15} className="text-muted" />
                {item.location}
              </span>
            )}
          </div>
          {(item.people.length > 0 || item.needs_prep === 1 || assignee) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {item.people.map((pid) => byId.get(pid)).filter(Boolean).map((p) => <PersonChip key={p!.id} person={p!} />)}
              {item.needs_prep === 1 && (
                <span className="chip border-transparent bg-honey-soft text-honey">
                  <BagIcon size={12} />
                  {item.prep_note || "Prep needed"}
                </span>
              )}
              {assignee && <span className="text-xs text-muted">Handled by {assignee.name}</span>}
            </div>
          )}
          {item.notes && <p className="mt-2 text-sm text-ink-2">{item.notes}</p>}
          {item.source_quote && (
            <blockquote className="mt-3 flex gap-2 rounded-xl bg-sunken px-3 py-2 text-[13px] italic leading-relaxed text-ink-2">
              <QuoteIcon size={14} className="mt-0.5 shrink-0 text-muted" />
              <span className="line-clamp-3">{item.source_quote}</span>
            </blockquote>
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button
          className="btn btn-primary flex-1 sm:flex-none"
          disabled={pending}
          onClick={() => start(async () => { setGone(true); await acceptItems([item.id]); })}
        >
          <CheckIcon size={18} /> Add to calendar
        </button>
        <button className="btn btn-secondary" disabled={pending} onClick={() => setEditing(true)}>
          <PencilIcon size={16} /> <span className="hidden sm:inline">Edit</span>
        </button>
        <button
          className="btn btn-ghost"
          disabled={pending}
          aria-label="Dismiss"
          onClick={() => start(async () => { setGone(true); await dismissItems([item.id]); })}
        >
          <XIcon size={18} /> <span className="hidden sm:inline">Dismiss</span>
        </button>
      </div>
    </li>
  );
}

export function AcceptAllButton({ ids }: { ids: string[] }) {
  const [pending, start] = useTransition();
  if (ids.length < 2) return null;
  return (
    <button className="btn btn-secondary btn-sm" disabled={pending} onClick={() => start(() => acceptItems(ids))}>
      <CheckIcon size={15} /> {pending ? "Adding…" : `Add all ${ids.length}`}
    </button>
  );
}
