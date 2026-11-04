"use client";
import { useActionState, useEffect, useState } from "react";
import { saveItem } from "@/app/app/actions";
import type { ItemWithPeople, Person } from "@/lib/types";
import { FormError, SubmitButton } from "./submit";

export function ItemEditor({
  item,
  people,
  defaultDate,
  acceptOnSave = false,
  onDone,
  submitLabel = "Save",
}: {
  item?: ItemWithPeople;
  people: Person[];
  defaultDate?: string;
  acceptOnSave?: boolean;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(saveItem, undefined);
  const [allDay, setAllDay] = useState(item ? item.all_day === 1 : false);
  const [prep, setPrep] = useState(item ? item.needs_prep === 1 : false);
  const [kind, setKind] = useState(item?.kind ?? "event");

  useEffect(() => {
    if (state?.ok) onDone?.();
  }, [state, onDone]);

  const date = item ? item.start.slice(0, 10) : (defaultDate ?? "");
  const time = item && item.start.length > 10 ? item.start.slice(11, 16) : "";
  const endTime = item?.end && item.end.length > 10 ? item.end.slice(11, 16) : "";
  const endDate = item?.end && item.all_day ? item.end.slice(0, 10) : "";

  return (
    <form action={action} className="space-y-4">
      {item && <input type="hidden" name="id" value={item.id} />}
      {acceptOnSave && <input type="hidden" name="accept" value="1" />}

      <fieldset>
        <legend className="label">Type</legend>
        <div className="inline-flex rounded-full border border-line bg-sunken p-1">
          {(["event", "deadline", "task"] as const).map((k) => (
            <label
              key={k}
              className={`cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize transition-colors ${
                kind === k ? "bg-surface text-ink shadow-sm" : "text-muted"
              }`}
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              {k}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor={`title-${item?.id ?? "new"}`}>Title</label>
        <input className="field" id={`title-${item?.id ?? "new"}`} name="title" defaultValue={item?.title} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div>
          <label className="label">Date</label>
          <input className="field" type="date" name="date" defaultValue={date} required />
        </div>
        <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium text-ink-2">
          <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-[var(--ember)]" />
          All day
        </label>
      </div>

      {allDay ? (
        <div>
          <label className="label">Ends (optional, for multi-day)</label>
          <input className="field" type="date" name="end_date" defaultValue={endDate} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Starts</label>
            <input className="field" type="time" name="time" defaultValue={time} required={!allDay} />
          </div>
          <div>
            <label className="label">Ends</label>
            <input className="field" type="time" name="end_time" defaultValue={endTime} />
          </div>
        </div>
      )}

      <div>
        <label className="label">Location</label>
        <input className="field" name="location" defaultValue={item?.location ?? ""} placeholder="Optional" />
      </div>

      {people.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="label">Who is it for?</legend>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => (
                <label key={p.id} className="cursor-pointer">
                  <input type="checkbox" name="people" value={p.id} defaultChecked={item?.people.includes(p.id)} className="peer sr-only" />
                  <span
                    className="chip transition-colors peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-ember peer-checked:[background:var(--pc)] peer-checked:[border-color:var(--pc)]"
                    style={{ ["--pc" as string]: p.color }}
                  >
                    {p.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label className="label">Who&apos;s handling it?</label>
            <select className="field" name="assignee_id" defaultValue={item?.assignee_id ?? ""}>
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-line bg-surface-2 p-3">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="needs_prep" checked={prep} onChange={(e) => setPrep(e.target.checked)} className="size-4 accent-[var(--ember)]" />
          Needs prep the night before
        </label>
        {prep && (
          <input className="field mt-3" name="prep_note" defaultValue={item?.prep_note ?? ""} placeholder="e.g. Pack £3 and a costume" />
        )}
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="field" name="notes" rows={2} defaultValue={item?.notes ?? ""} />
      </div>

      <FormError error={state?.error} />
      <div className="flex gap-2">
        <SubmitButton className="btn btn-primary flex-1" pendingText="Saving…">{submitLabel}</SubmitButton>
        {onDone && (
          <button type="button" className="btn btn-secondary" onClick={onDone}>Cancel</button>
        )}
      </div>
    </form>
  );
}
