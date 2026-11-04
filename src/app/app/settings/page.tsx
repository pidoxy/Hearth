import { requireCtx } from "@/lib/auth";
import { claudeAvailable, MODEL } from "@/lib/extract/claude";
import { appUrl, householdMembers, inboundAddress, listPeople } from "@/lib/households";
import { mailConfigured } from "@/lib/mailer";
import { ActionButton } from "@/components/action-button";
import { Avatar } from "@/components/people";
import { logout, removePerson, rotateCalendarLinks, rotateInbound } from "../actions";
import { AddPersonForm, CopyField, HouseholdForm, InviteLink } from "./forms";

export const metadata = { title: "Settings" };

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {desc && <p className="mt-1 text-sm text-ink-2">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const { household, user } = await requireCtx();
  const people = listPeople(household.id);
  const members = householdMembers(household.id);
  const linked = new Map(members.filter((m) => m.person_id).map((m) => [m.person_id!, m]));
  const base = appUrl();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-display text-3xl sm:text-4xl">Settings</h1>
        <p className="mt-1 text-ink-2">{household.name}</p>
      </div>

      <Section title="Sync to your calendar" desc="Subscribe once in Google Calendar, Apple Calendar or Outlook. Accepted items appear automatically (calendar apps refresh every few hours).">
        <div className="space-y-4">
          <div>
            <p className="label">Whole household</p>
            <CopyField value={`${base}/api/ics/${household.ics_token}.ics`} webcal />
          </div>
          {people.map((p) => (
            <div key={p.id}>
              <p className="label flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: p.color }} /> Just {p.name}
              </p>
              <CopyField value={`${base}/api/ics/${p.ics_token}.ics`} webcal />
            </div>
          ))}
          <details className="text-sm text-ink-2">
            <summary className="cursor-pointer font-semibold">How do I add this to Google Calendar?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Copy the link above.</li>
              <li>On a computer, open Google Calendar → <em>Other calendars</em> → <em>+</em> → <em>From URL</em>.</li>
              <li>Paste and click <em>Add calendar</em>. It syncs to your phone automatically.</li>
            </ol>
          </details>
          <ActionButton
            action={rotateCalendarLinks}
            className="btn btn-ghost btn-sm text-danger"
            confirmText="Generate new links? Existing subscriptions will stop updating."
          >
            Reset all calendar links
          </ActionButton>
        </div>
      </Section>

      <Section title="Forwarding address" desc="Forward school emails, appointment confirmations and bills here. Attachments (PDFs, photos) are read too.">
        <CopyField value={inboundAddress(household)} />
        <ActionButton
          action={rotateInbound}
          className="btn btn-ghost btn-sm mt-3 text-danger"
          confirmText="Create a new forwarding address? The old one will stop working."
        >
          Change address
        </ActionButton>
      </Section>

      <Section title="People" desc="Everyone the household organises for. People without accounts are just for labelling.">
        <ul className="divide-y divide-line">
          {people.map((p) => {
            const m = linked.get(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <Avatar person={p} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}{m?.id === user.id && <span className="ml-1.5 text-sm font-normal text-muted">(you)</span>}</p>
                  <p className="truncate text-sm text-muted">{m ? m.email : "No account"}</p>
                </div>
                {!m && (
                  <ActionButton action={removePerson.bind(null, p.id)} className="btn btn-ghost btn-sm" confirmText={`Remove ${p.name}?`}>
                    Remove
                  </ActionButton>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4"><AddPersonForm /></div>
      </Section>

      <Section title="Invite someone" desc="Partners, older kids, a sibling sharing care for a parent — they get their own login, reminders and calendar link.">
        <InviteLink appUrl={base} />
      </Section>

      <Section title="Household">
        <HouseholdForm
          name={household.name}
          timezone={household.timezone}
          digest={household.digest_enabled === 1}
          senders={household.allowed_senders}
        />
      </Section>

      <Section title="System">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Document reading</dt><dd className="font-semibold">{claudeAvailable() ? `Claude (${MODEL})` : "Offline parser (text only)"}</dd></div>
          <div><dt className="text-muted">Email reminders</dt><dd className="font-semibold">{mailConfigured() ? "On" : "Not configured (logged only)"}</dd></div>
        </dl>
        <form action={logout} className="mt-5">
          <button className="btn btn-secondary">Sign out</button>
        </form>
      </Section>
    </div>
  );
}
