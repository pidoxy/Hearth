"use client";
import { useActionState, useRef, useState, useTransition } from "react";
import { addPersonAction, createInvite, updateHousehold } from "../actions";
import { CopyIcon } from "@/components/icons";
import { FormError, SubmitButton } from "@/components/submit";

export function CopyField({ value, webcal }: { value: string; webcal?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={value} className="field h-10 min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        className="btn btn-secondary btn-sm h-10"
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        <CopyIcon size={15} /> {copied ? "Copied" : "Copy"}
      </button>
      {webcal && (
        <a className="btn btn-primary btn-sm h-10" href={value.replace(/^https?:/, "webcal:")}>Subscribe</a>
      )}
    </div>
  );
}

export function HouseholdForm(props: { name: string; timezone: string; digest: boolean; senders: string }) {
  const [state, action] = useActionState(updateHousehold, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="hh-name">Household name</label>
          <input id="hh-name" className="field" name="name" defaultValue={props.name} />
        </div>
        <div>
          <label className="label" htmlFor="hh-tz">Timezone</label>
          <input id="hh-tz" className="field" name="timezone" defaultValue={props.timezone} />
        </div>
      </div>
      <label className="flex items-center gap-2.5 text-sm font-medium">
        <input type="checkbox" name="digest_enabled" defaultChecked={props.digest} className="size-4 accent-[var(--ember)]" />
        Email everyone a morning digest of today &amp; tomorrow
      </label>
      <div>
        <label className="label" htmlFor="hh-senders">Also accept forwarded emails from</label>
        <textarea id="hh-senders" className="field" name="allowed_senders" rows={2} defaultValue={props.senders} placeholder="office@school.example, coach@club.example" />
        <p className="mt-1.5 text-xs text-muted">
          Members&apos; own addresses are always accepted. Anything else waits in your inbox as &ldquo;unknown sender&rdquo; until you OK it.
        </p>
      </div>
      <FormError error={state?.error} />
      {state?.ok && <p className="text-sm font-medium text-sage">Saved.</p>}
      <SubmitButton className="btn btn-primary" pendingText="Saving…">Save changes</SubmitButton>
    </form>
  );
}

export function AddPersonForm() {
  const [state, action] = useActionState(addPersonAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        await action(fd);
        ref.current?.reset();
      }}
      className="flex gap-2"
    >
      <input className="field h-10" name="name" placeholder="Add a name (e.g. Grandma)" aria-label="Name" />
      <SubmitButton className="btn btn-secondary h-10" pendingText="Adding…">Add</SubmitButton>
      <FormError error={state?.error} />
    </form>
  );
}

export function InviteLink({ appUrl }: { appUrl: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return link ? (
    <div className="space-y-2">
      <CopyField value={link} />
      <p className="text-xs text-muted">Valid for 7 days. Anyone with this link can join your household.</p>
    </div>
  ) : (
    <button
      className="btn btn-primary"
      disabled={pending}
      onClick={() => start(async () => setLink(`${appUrl}/join/${await createInvite()}`))}
    >
      {pending ? "Creating…" : "Create invite link"}
    </button>
  );
}
