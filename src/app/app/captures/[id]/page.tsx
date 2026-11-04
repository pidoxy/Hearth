import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCtx } from "@/lib/auth";
import { getCapture } from "@/lib/captures";
import { listPeople } from "@/lib/households";
import { captureItems } from "@/lib/items";
import { formatWhen, zonedDate } from "@/lib/time";
import { ActionButton } from "@/components/action-button";
import { AutoRefresh } from "@/components/auto-refresh";
import { AlertIcon, ChevronLeft } from "@/components/icons";
import { KindBadge, ReviewCard } from "@/components/review-card";
import { removeCapture, restoreItem, retryCapture } from "../../actions";

export const metadata = { title: "Capture" };

export default async function CapturePage({ params }: { params: Promise<{ id: string }> }) {
  const { household } = await requireCtx();
  const cap = getCapture(household.id, (await params).id);
  if (!cap) notFound();
  const people = listPeople(household.id);
  const items = captureItems(household.id, cap.id);
  const today = zonedDate(new Date(), household.timezone);
  const proposed = items.filter((i) => i.status === "proposed");
  const decided = items.filter((i) => i.status !== "proposed");

  return (
    <div className="space-y-6">
      <AutoRefresh active={cap.status === "processing"} />
      <Link href="/app/inbox" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
        <ChevronLeft size={16} /> Inbox
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow">{cap.source === "email" ? `Email from ${cap.email_from}` : cap.source === "upload" ? "Upload" : "Pasted text"}</p>
          <h1 className="h-display mt-1 text-3xl">{cap.title}</h1>
          <p className="mt-1 text-sm text-muted">
            Added {new Date(cap.created_at).toLocaleString("en-GB", { timeZone: household.timezone, dateStyle: "medium", timeStyle: "short" })}
            {cap.extractor ? ` · read by ${cap.extractor.startsWith("claude") ? "Claude" : "offline parser"}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <ActionButton action={retryCapture.bind(null, cap.id)} pendingText="Reading…">Re-read</ActionButton>
          <ActionButton
            action={removeCapture.bind(null, cap.id)}
            className="btn btn-ghost btn-sm text-danger"
            confirmText="Delete this capture and anything still waiting for review?"
          >
            Delete
          </ActionButton>
        </div>
      </div>

      {cap.status === "failed" && (
        <div className="flex items-start gap-3 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          <AlertIcon className="shrink-0" />
          <p>{cap.error || "Couldn't read this one."}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-4 py-3 text-sm font-semibold text-muted">Original</h2>
          {cap.file_path && cap.file_mime?.startsWith("image/") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/files/${cap.id}`} alt={cap.file_name ?? "Uploaded image"} className="max-h-[70vh] w-full object-contain bg-sunken" />
          )}
          {cap.file_path && cap.file_mime === "application/pdf" && (
            <iframe src={`/api/files/${cap.id}`} title={cap.file_name ?? "PDF"} className="h-[70vh] w-full bg-sunken" />
          )}
          {cap.text_content && (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-ink-2">{cap.text_content}</pre>
          )}
        </section>

        <section className="space-y-4">
          {cap.status === "processing" && <p className="animate-pulse-soft font-semibold text-ember">Reading…</p>}
          {proposed.length > 0 && (
            <ul className="space-y-3">
              {proposed.map((i) => <ReviewCard key={i.id} item={i} people={people} today={today} />)}
            </ul>
          )}
          {decided.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-semibold text-muted">Already handled</h2>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {decided.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <KindBadge kind={i.kind} />
                    <span className={`flex-1 ${i.status === "dismissed" ? "text-muted line-through" : "font-medium"}`}>{i.title}</span>
                    <span className="text-muted">{formatWhen(i.start, i.end, i.all_day === 1, today)}</span>
                    {i.status === "dismissed" && (
                      <ActionButton action={restoreItem.bind(null, i.id)} className="btn btn-ghost btn-sm">Restore</ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {cap.status === "done" && items.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line-strong p-6 text-center text-sm text-muted">
              No dates found in this one. You can add something manually from Today or Calendar.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
