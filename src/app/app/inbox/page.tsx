import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { recentCaptures } from "@/lib/captures";
import { claudeAvailable } from "@/lib/extract/claude";
import { inboundAddress, listPeople } from "@/lib/households";
import { proposedItems } from "@/lib/items";
import { zonedDate } from "@/lib/time";
import type { ItemWithPeople } from "@/lib/types";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { CaptureBox } from "@/components/capture-box";
import { AlertIcon, CameraIcon, FileIcon, MailIcon, SparkIcon, TextIcon } from "@/components/icons";
import { AcceptAllButton, ReviewCard } from "@/components/review-card";
import { approveUnverified, retryCapture } from "../actions";

export const metadata = { title: "Inbox" };

const SOURCE_ICON = { upload: FileIcon, paste: TextIcon, email: MailIcon };

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { household } = await requireCtx();
  const { welcome } = await searchParams;
  const people = listPeople(household.id);
  const proposed = proposedItems(household.id);
  const captures = recentCaptures(household.id, 15);
  const today = zonedDate(new Date(), household.timezone);
  const processing = captures.some((c) => c.status === "processing");

  // Group proposed items by capture, preserving capture recency.
  const groups = new Map<string, ItemWithPeople[]>();
  for (const it of proposed) {
    const key = it.capture_id ?? "manual";
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const capTitle = new Map(captures.map((c) => [c.id, c]));

  return (
    <div className="space-y-8">
      <AutoRefresh active={processing} />
      <div>
        <h1 className="h-display text-3xl sm:text-4xl">Inbox</h1>
        <p className="mt-1 text-ink-2">Add letters, emails and screenshots. Review what Hearth found.</p>
      </div>

      {welcome && (
        <div className="flex items-start gap-3 rounded-2xl border border-ember/30 bg-ember-soft p-4 text-sm">
          <CameraIcon className="mt-0.5 shrink-0 text-ember" />
          <p>
            <strong>You&apos;re set up!</strong> Try it now: snap the nearest school letter or paste an email below.
            Everything Hearth finds waits here for your OK.
          </p>
        </div>
      )}

      <CaptureBox inboundAddress={inboundAddress(household)} aiEnabled={claudeAvailable()} />

      <section>
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-semibold">
            To review {proposed.length > 0 && <span className="text-muted">· {proposed.length}</span>}
          </h2>
        </div>

        {processing && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <SparkIcon className="animate-pulse-soft text-ember" />
            <p className="text-sm font-medium text-ink-2">Reading your document… this usually takes a few seconds.</p>
          </div>
        )}

        {proposed.length === 0 && !processing ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line-strong p-8 text-center">
            <p className="font-semibold">All caught up</p>
            <p className="mt-1 text-sm text-muted">New dates you capture will appear here for a quick check.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-8">
            {[...groups.entries()].map(([capId, items]) => {
              const cap = capTitle.get(capId);
              return (
                <div key={capId}>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm text-muted">
                      From{" "}
                      {cap ? (
                        <Link href={`/app/captures/${cap.id}`} className="font-semibold text-ink-2 underline-offset-2 hover:underline">
                          {cap.title}
                        </Link>
                      ) : (
                        "earlier"
                      )}
                    </p>
                    <AcceptAllButton ids={items.map((i) => i.id)} />
                  </div>
                  <ul className="space-y-3">
                    {items.map((it) => (
                      <ReviewCard key={it.id} item={it} people={people} today={today} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {captures.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">Recent captures</h2>
          <ul className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {captures.map((c) => {
              const Icon = SOURCE_ICON[c.source];
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink-2">
                    <Icon size={18} />
                  </span>
                  <Link href={`/app/captures/${c.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="truncate text-xs text-muted">
                      {timeAgo(c.created_at)}
                      {c.email_from ? ` · from ${c.email_from}` : ""}
                      {c.status === "done" ? ` · ${c.item_count} found` : ""}
                    </p>
                  </Link>
                  {c.status === "processing" && <span className="chip animate-pulse-soft border-transparent bg-ember-soft text-ember">Reading…</span>}
                  {c.status === "failed" && (
                    <div className="flex items-center gap-2">
                      <span className="chip border-transparent bg-danger-soft text-danger" title={c.error ?? ""}>
                        <AlertIcon size={12} /> Failed
                      </span>
                      <ActionButton action={retryCapture.bind(null, c.id)} pendingText="Retrying…">Retry</ActionButton>
                    </div>
                  )}
                  {c.status === "unverified" && (
                    <div className="flex items-center gap-2">
                      <span className="chip border-transparent bg-honey-soft text-honey" title="Sent from an address that isn't in your household">
                        Unknown sender
                      </span>
                      <ActionButton action={approveUnverified.bind(null, c.id)} pendingText="Reading…">Read it</ActionButton>
                    </div>
                  )}
                  {c.status === "done" && c.proposed_count > 0 && (
                    <span className="chip border-transparent bg-ember-soft text-ember">{c.proposed_count} to review</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
