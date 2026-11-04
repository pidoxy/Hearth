import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import {
  BagIcon,
  CalendarIcon,
  CameraIcon,
  CheckIcon,
  MailIcon,
  QuoteIcon,
  SparkIcon,
  Wordmark,
} from "@/components/icons";

export const dynamic = "force-dynamic";

function Flyer() {
  return (
    <div className="relative rotate-[-3deg] rounded-xl bg-[#fffdf6] p-5 text-[#2b2620] shadow-lg ring-1 ring-black/5 w-[290px] max-w-full">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 h-6 w-20 rotate-2 rounded-sm bg-[#f4d58d]/80" />
      <p className="font-[Georgia,serif] text-lg font-bold">Oakfield Primary</p>
      <p className="text-[11px] uppercase tracking-widest text-[#8a7f70]">Year 4 · Parent update</p>
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed">
        <p>
          Our <mark className="bg-[#ffe3a3] px-0.5">bake sale is Friday 13 Nov at 3:15pm</mark> in the hall — please
          send £3 with your child.
        </p>
        <p>
          Museum trip slips must be <mark className="bg-[#ffe3a3] px-0.5">returned by 20 November</mark>.
        </p>
        <p>
          Zara&apos;s class assembly: <mark className="bg-[#ffe3a3] px-0.5">27 Nov, 9am</mark>. Families welcome!
        </p>
      </div>
    </div>
  );
}

function Extracted() {
  const rows = [
    { when: "Fri 13 Nov · 3:15pm", title: "Bake sale", who: "Zara", color: "#3F7FBF", prep: "Send £3", kind: "Event" },
    { when: "Fri 20 Nov", title: "Return museum trip slip", who: "Tunde", color: "#5E8C6A", kind: "Deadline" },
    { when: "Fri 27 Nov · 9am", title: "Zara's class assembly", who: "Zara", color: "#3F7FBF", kind: "Event" },
  ];
  return (
    <div className="card w-[330px] max-w-full p-4 shadow-lg">
      <div className="flex items-center justify-between">
        <span className="eyebrow">3 found · review</span>
        <span className="chip text-sage border-transparent bg-sage-soft">
          <SparkIcon size={12} /> 2s
        </span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r, i) => (
          <li
            key={r.title}
            className="animate-rise rounded-2xl border border-line bg-surface-2 p-3"
            style={{ animationDelay: `${0.2 + i * 0.15}s` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-muted">{r.when}</p>
                <p className="font-semibold leading-snug">{r.title}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className="chip"
                    style={{ background: `color-mix(in srgb, ${r.color} 14%, transparent)`, borderColor: "transparent" }}
                  >
                    <span className="size-2 rounded-full" style={{ background: r.color }} />
                    {r.who}
                  </span>
                  {r.prep && (
                    <span className="chip border-transparent bg-honey-soft text-honey">
                      <BagIcon size={12} />
                      {r.prep}
                    </span>
                  )}
                </div>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ember text-ember-ink">
                <CheckIcon size={16} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const STEPS = [
  {
    icon: CameraIcon,
    title: "Capture it",
    body: "Snap the flyer on the fridge, drop in a PDF, paste a WhatsApp message, or forward the email to your household address.",
  },
  {
    icon: SparkIcon,
    title: "Hearth reads it",
    body: "Dates, times, places, who it's for, and what to prep the night before — with the exact quote it came from.",
  },
  {
    icon: CalendarIcon,
    title: "One tap to the calendar",
    body: "Approve and it lands on the family calendar you already use — Google, Apple or Outlook — plus reminders.",
  },
];

const FEATURES = [
  { icon: QuoteIcon, title: "Shows its work", body: "Every item links to the sentence it came from. No mystery dates." },
  { icon: CheckIcon, title: "You approve everything", body: "Nothing reaches your calendar until someone in the house taps accept." },
  { icon: MailIcon, title: "No inbox access", body: "Forward only what matters. Hearth never reads the rest of your email." },
  { icon: BagIcon, title: "Night-before nudges", body: "“Bring £3 tomorrow” arrives at 7pm, not at the school gate." },
];

export default async function Landing() {
  const user = await currentUser();
  if (user?.household_id) redirect("/app");

  return (
    <div className="overflow-x-hidden">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn btn-primary">Get started</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
          <div>
            <span className="chip border-transparent bg-ember-soft text-ember">For busy households</span>
            <h1 className="h-display mt-5 text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[3.4rem] xl:text-6xl">
              The fridge door,
              <br />
              <span className="text-ember">finally organised.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
              School letters, appointment emails, club schedules, bills. Snap or forward them to Hearth and it puts
              every date and deadline on your family calendar — and tells the right person the night before.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn btn-primary h-12 px-6 text-base">Start your household — free</Link>
              <a href="#how" className="btn btn-secondary h-12 px-6 text-base">See how it works</a>
            </div>
            <p className="mt-4 text-sm text-muted">No inbox access. Works with Google, Apple &amp; Outlook calendars.</p>
          </div>

          <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center lg:justify-end">
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[3rem] bg-[radial-gradient(ellipse_at_center,var(--ember-soft),transparent_70%)]" />
            <Flyer />
            <div className="text-ember sm:-mx-3 rotate-90 sm:rotate-0">
              <svg width="40" height="24" viewBox="0 0 40 24" fill="none" aria-hidden>
                <path d="M2 12h32m0 0-8-8m8 8-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <Extracted />
          </div>
        </section>

        <section id="how" className="border-y border-line bg-surface-2">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="eyebrow">How it works</p>
            <h2 className="h-display mt-2 text-3xl sm:text-4xl">From paper to plan in ten seconds.</h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="card p-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-ember-soft text-ember">
                      <s.icon />
                    </span>
                    <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-ink-2">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow">Built on trust</p>
              <h2 className="h-display mt-2 text-3xl sm:text-4xl">A helper, not a robot in charge.</h2>
              <p className="mt-4 leading-relaxed text-ink-2">
                Hearth proposes; your household decides. It can&apos;t send, pay or book anything — it just makes sure
                nobody has to retype a date ever again.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-line p-5">
                  <f.icon className="text-ember" />
                  <h3 className="mt-3 font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
          <div className="rounded-[2rem] bg-ember px-6 py-12 text-center text-ember-ink sm:px-12">
            <h2 className="h-display text-3xl sm:text-4xl">Share the mental load.</h2>
            <p className="mx-auto mt-3 max-w-xl opacity-90">
              Invite your partner, add the kids and grandparents, and let everyone see what&apos;s theirs this week.
            </p>
            <Link href="/signup" className="btn mt-7 h-12 bg-white px-6 text-base text-[#9a3412] hover:bg-white/90">
              Create your household
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <Wordmark />
          <p>Made for the people who remember everything.</p>
        </div>
      </footer>
    </div>
  );
}
