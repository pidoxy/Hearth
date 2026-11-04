# Hearth — Product Requirements Document

**Status:** v1.0 (MVP) · **Owner:** Emmanuel Idoko · **Last updated:** 2026-11-04

> Hearth turns the paper, PDFs and emails that run a household — school flyers, appointment letters, bills, permission slips, renewal notices — into calendar events and tasks the whole family can see, in seconds, with a human always approving what goes on the calendar.

---

## 1. Problem

Households run on unstructured admin. A school sends a PDF newsletter with three dates buried in paragraph four. A dentist confirms by email. A council letter says the bin day changes next month. A permission slip needs a signature by Friday.

Today this information lives in five places (inbox, school app, fridge, group chat, one parent's head) and is turned into calendar entries by hand — usually by the same person every time. The result is missed deadlines, forgotten "bring £3 for the bake sale" days, late fees, and an invisible, unevenly shared mental load.

**Evidence (from our Nov 2026 research):**
- Repeated "is there an app that reads school emails and puts them on my calendar" requests across Reddit and parenting forums; Gmail extracts flights and hotels but ignores school mail and PDFs.
- Parent essays about calendar failure ("Dear Google Calendar…", Motherly) and a fragmented crop of small tools (Daywell, Nuet, PAM, Task Mama) — demand is real, no clear winner.
- Adult children coordinating care for an ageing parent describe the same pain with appointment letters and medication refills, split across 3+ apps.
- On-device and low-cost vision models (Claude, Gemini Nano, Apple Foundation Models) now read a crumpled photo or a 10-page PDF accurately for fractions of a cent — this was impractical two years ago.

## 2. Goals & non-goals

### Goals (MVP)
1. **Capture in under 10 seconds** — photo, PDF, pasted text, or forwarded email.
2. **Extract accurately** — events, deadlines and tasks with dates, times, locations, and who it's for.
3. **Human in the loop** — nothing lands on the calendar until a household member approves it (one tap).
4. **One shared household context** — partners, kids, an ageing parent; items can be *about* someone and *assigned to* someone.
5. **Works with the calendars people already use** — subscribe once via an ICS feed in Google, Apple or Outlook Calendar. No OAuth, no inbox access.
6. **Reminders that arrive** — a daily digest email and "night-before" reminders for things that need prep.
7. **Deployable by one person** in under 15 minutes (Docker, single container, SQLite on a volume).

### Non-goals (MVP)
- Reading a user's full inbox (we deliberately use *forwarding only*: trust and platform-review reasons).
- Two-way sync into Google Calendar via OAuth (ICS subscription first; OAuth later).
- Native mobile apps (responsive PWA-style web app first).
- Payments/billing inside the app.
- Autonomous actions (paying, replying, booking). Hearth proposes; humans decide.

## 3. Users & personas

| Persona | Situation | Job to be done |
|---|---|---|
| **Ada — the default organiser** | Two kids, works full time, gets ~15 school/club emails a week | "Get the dates out of these emails and onto the family calendar without me retyping them." |
| **Tunde — the partner who wants to help** | Willing, but never sees the emails | "Tell me what's mine to handle this week, and remind me the night before." |
| **Ngozi — caring for a parent** | Coordinates her dad's appointments with two siblings | "When a hospital letter arrives, everyone should know the date and who's driving." |

## 4. User stories (MVP)

**Capture**
- US-1 As a member, I can drag/drop or pick a photo or PDF and Hearth extracts proposed items.
- US-2 As a member, I can paste text (e.g. an email body or WhatsApp message) and get proposed items.
- US-3 As a member, I can forward an email to my household's private address (`<code>@inbound.domain`) and its body and attachments are processed automatically.
- US-4 As a member, I can see each capture's original source next to what was extracted from it.

**Review**
- US-5 As a member, I see a "To review" queue of proposed items with confidence and the exact quote they came from.
- US-6 I can accept, edit-then-accept, or dismiss each item; or accept all from a capture.
- US-7 I can set who an item is *for* (e.g. "Zara") and who is *responsible* (e.g. "Tunde").

**Plan**
- US-8 I see a **Today/This week** home: upcoming events, tasks due, and items awaiting review.
- US-9 I see a month **calendar** and an agenda list, colour-coded by person.
- US-10 I see **tasks** (things to do, with due dates), can tick them off, and filter "mine".

**Sync & remind**
- US-11 I can copy a private ICS link (household-wide or "just mine") and subscribe in any calendar app.
- US-12 I receive a morning digest email (opt-in) and a night-before reminder for events flagged "needs prep".

**Household**
- US-13 I can sign up, create a household, and invite others with a link.
- US-14 I can add people who don't have accounts (kids, grandparents) for labelling.
- US-15 I can rotate my forwarding address and calendar links if they leak.

## 5. Functional requirements

### 5.1 Extraction
- Input types: `image/jpeg|png|webp|gif`, `application/pdf`, plain text, inbound email (text + HTML + attachments).
- Output per item: `kind` (event | deadline | task), `title`, `start` (date or datetime), optional `end`, `all_day`, `location`, `notes`, `for_people` (names), `needs_prep` (bool + prep note), `confidence` (0–1), `source_quote`.
- Relative dates ("next Friday", "the 14th") resolve against the document date (email `Date` header or upload time) and the household timezone.
- Primary extractor: Claude (vision + PDF) with JSON structured output. Fallback extractor (no API key / API error): deterministic natural-language date parsing so the product still works in demo/self-hosted-offline mode.
- Names in the household are passed to the model so "Zara's class" maps to the person *Zara*.
- Extraction must never auto-approve. All items enter `proposed` state.

### 5.2 Inbound email
- Each household has a random, rotatable inbound code. Address: `<code>@<INBOUND_DOMAIN>`.
- Webhook endpoint accepts Postmark's inbound JSON format (most providers can be adapted) and is protected by a shared secret.
- Sender allow-list: only emails from household members' account addresses (plus an optional allow-list) are processed; others are held as "unverified" for review (prevents spam injecting calendar items).

### 5.3 Calendar feeds
- RFC 5545 ICS output; stable UIDs; `VEVENT` for events/deadlines; tasks appear as all-day events on their due date prefixed "☐".
- Feed URLs contain an unguessable token; rotating the token invalidates old links.

### 5.4 Reminders
- `POST /api/cron/reminders` (secured with `CRON_SECRET`) — idempotent; run every 15 min by any scheduler.
- Morning digest at 07:00 household local time; night-before reminder at 19:00 for `needs_prep` items. Each reminder is sent once (dedupe table).
- Email via SMTP (any provider). If SMTP isn't configured, reminders are logged (dev mode).

### 5.5 Auth & security
- Email + password (scrypt-hashed), httpOnly SameSite=Lax session cookie, 30-day sessions.
- All data scoped by household; every query filters by `household_id` from the session.
- Uploaded files stored on disk under the data volume, served only to household members.
- Untrusted content (emails, documents) is treated as data in the prompt, never instructions. The model has no tools and cannot take actions — worst case of a prompt-injection is a bad *proposed* item, which a human must approve.
- Rate limit captures (per household: 60/hour) to cap API spend.

## 6. UX principles
1. **Calm, not busy.** Warm neutral palette, generous spacing, one primary action per screen.
2. **Show your work.** Every extracted item shows the quote it came from.
3. **One-tap trust.** Accept is always the biggest button; edit is one tap away.
4. **People are colours.** Each household member has a colour used consistently on chips, calendar dots and filters.
5. **Mobile-first.** Capture is most often a phone photo of paper.

## 7. Success metrics
| Metric | Target (first 90 days) |
|---|---|
| Time from capture to approved item | median < 30 s |
| Extraction precision (items accepted without edit) | ≥ 80 % |
| Weekly active households / signed-up households | ≥ 40 % |
| Households with ≥ 2 active members | ≥ 35 % |
| ICS feed subscribed | ≥ 50 % of active households |

## 8. Architecture (summary)
- **Next.js 15 (App Router) + TypeScript**, server actions and route handlers; single Node process.
- **SQLite** (better-sqlite3, WAL) on a mounted volume; SQL migrations on boot.
- **Claude API** (`@anthropic-ai/sdk`) for extraction, structured JSON output validated with Zod; chrono-node fallback.
- **Tailwind CSS v4** design tokens; no component library dependency.
- **Docker** single-container deploy (Fly.io / Render / Railway / any VPS); health check at `/api/health`.

See `docs/DESIGN.md` for the design system and `README.md` for setup & deployment.

## 9. Release plan
| Phase | Scope |
|---|---|
| **MVP (this release)** | Everything in §4 |
| v1.1 | Web push notifications; Google Calendar OAuth two-way sync; per-item recurrence |
| v1.2 | Native share-sheet capture (iOS/Android); WhatsApp forwarding |
| v2 | Care circles (ageing parent mode), shared lists, Stripe billing ($5/mo family plan) |

## 10. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Wrong dates cause missed events | Human approval; show source quote; confidence badges; edit before accept |
| Spam/injection via forwarding address | Sender allow-list, unverified queue, rotatable address, no model tools |
| API cost runaway | Per-household rate limit; low-effort extraction; fallback parser |
| Privacy of children's data | Minimal data, no inbox access, self-hostable, delete capture deletes file |
| Crowded category | Differentiate on shared household context + source transparency + calendars people already use |

## 11. Open questions
- Should accepted items be editable by any member or only the accepter? (MVP: any member.)
- Default reminder times per member vs per household? (MVP: per household timezone, fixed times.)
