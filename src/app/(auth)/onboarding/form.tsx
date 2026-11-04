"use client";
import { useActionState, useEffect, useState } from "react";
import { createHouseholdAction } from "../actions";
import { FormError, SubmitButton } from "@/components/submit";

export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useActionState(createHouseholdAction, undefined);
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  return (
    <form action={action} className="space-y-5">
      <div>
        <label className="label" htmlFor="name">Household name</label>
        <input className="field" id="name" name="name" defaultValue={defaultName} required />
      </div>
      <div>
        <label className="label" htmlFor="people">Who else is in your household?</label>
        <textarea className="field" id="people" name="people" rows={3} placeholder="Tunde, Zara, Kemi, Grandpa" />
        <p className="mt-1.5 text-xs text-muted">
          Comma-separated first names. Kids and grandparents don&apos;t need accounts — they&apos;re for labelling who an event is for.
        </p>
      </div>
      <div>
        <label className="label" htmlFor="timezone">Timezone</label>
        <input className="field" id="timezone" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
      </div>
      <FormError error={state?.error} />
      <SubmitButton pendingText="Setting up…">Create household</SubmitButton>
    </form>
  );
}
