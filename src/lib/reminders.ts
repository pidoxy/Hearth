import "server-only";
import { db } from "./db";
import { appUrl, householdMembers, listPeople } from "./households";
import { acceptedBetween } from "./items";
import { sendMail } from "./mailer";
import { addDays, formatDay, formatWhen, zonedDate, zonedParts } from "./time";
import type { Household, ItemWithPeople, Person } from "./types";

export const DIGEST_HOUR = Number(process.env.DIGEST_HOUR ?? 7);
export const PREP_HOUR = Number(process.env.PREP_HOUR ?? 19);

function claim(key: string): boolean {
  const res = db.prepare(`INSERT OR IGNORE INTO reminders_sent (key) VALUES (?)`).run(key);
  return res.changes === 1;
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function line(item: ItemWithPeople, people: Map<string, Person>, today: string) {
  const who = item.people.map((p) => people.get(p)?.name).filter(Boolean).join(", ");
  const when = formatWhen(item.start, item.end, item.all_day === 1, today);
  const prep = item.needs_prep && item.prep_note ? ` — prep: ${item.prep_note}` : "";
  return { text: `• ${when}: ${item.title}${who ? ` (${who})` : ""}${prep}`, item, who, when, prep };
}

function htmlEmail(title: string, intro: string, rows: ReturnType<typeof line>[], cta: string) {
  const items = rows
    .map(
      (r) => `<tr><td style="padding:10px 0;border-bottom:1px solid #EFE8DD">
        <div style="font-size:13px;color:#7A7066">${escHtml(r.when)}</div>
        <div style="font-size:16px;color:#1F1B16;font-weight:600">${escHtml(r.item.title)}</div>
        ${r.who ? `<div style="font-size:13px;color:#7A7066">For ${escHtml(r.who)}</div>` : ""}
        ${r.prep ? `<div style="font-size:13px;color:#B4441D">${escHtml(r.prep.replace(" — ", ""))}</div>` : ""}
      </td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#FBF8F3;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:28px;border:1px solid #EFE8DD">
  <tr><td><div style="font-family:Georgia,serif;font-size:22px;color:#1F1B16">${escHtml(title)}</div>
  <p style="color:#5C544B;font-size:15px">${escHtml(intro)}</p>
  <table width="100%" cellpadding="0" cellspacing="0">${items}</table>
  <p style="margin-top:24px"><a href="${cta}" style="background:#C2410C;color:#fff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:14px">Open Hearth</a></p>
  </td></tr></table></td></tr></table></body></html>`;
}

/**
 * Sends due reminders for every household. Idempotent: each digest/prep reminder is claimed once.
 * Call every ~15 minutes.
 */
export async function runReminders(now = new Date()) {
  const households = db.prepare(`SELECT * FROM households`).all() as Household[];
  const sent: string[] = [];
  for (const h of households) {
    const p = zonedParts(now, h.timezone);
    const today = zonedDate(now, h.timezone);
    const people = new Map(listPeople(h.id).map((x) => [x.id, x]));
    const members = householdMembers(h.id);
    if (!members.length) continue;

    // Morning digest: today + tomorrow.
    if (h.digest_enabled && p.hour >= DIGEST_HOUR && p.hour < DIGEST_HOUR + 3) {
      const items = acceptedBetween(h.id, today, addDays(today, 1)).filter((i) => !i.done);
      if (items.length && claim(`digest:${h.id}:${today}`)) {
        const rows = items.map((i) => line(i, people, today));
        for (const m of members) {
          await sendMail({
            to: m.email,
            subject: `Today at ${h.name}: ${items.length} thing${items.length === 1 ? "" : "s"}`,
            text: `Good morning ${m.name},\n\n${rows.map((r) => r.text).join("\n")}\n\n${appUrl()}/app`,
            html: htmlEmail(`Good morning, ${m.name}`, `Here's what's on for ${formatDay(today)} and tomorrow.`, rows, `${appUrl()}/app`),
          });
        }
        sent.push(`digest:${h.id}`);
      }
    }

    // Night-before prep reminders.
    if (p.hour >= PREP_HOUR && p.hour < PREP_HOUR + 3) {
      const tomorrow = addDays(today, 1);
      const items = acceptedBetween(h.id, tomorrow, tomorrow).filter(
        (i) => i.needs_prep && !i.done && i.start.slice(0, 10) === tomorrow,
      );
      const fresh = items.filter((i) => claim(`prep:${i.id}:${tomorrow}`));
      if (fresh.length) {
        const rows = fresh.map((i) => line(i, people, today));
        for (const m of members) {
          await sendMail({
            to: m.email,
            subject: `For tomorrow: ${fresh.map((i) => i.title).join(", ").slice(0, 90)}`,
            text: `Heads up for tomorrow:\n\n${rows.map((r) => r.text).join("\n")}\n\n${appUrl()}/app`,
            html: htmlEmail("Ready for tomorrow?", "These need a little prep tonight.", rows, `${appUrl()}/app`),
          });
        }
        sent.push(`prep:${h.id}:${fresh.length}`);
      }
    }
  }
  return sent;
}
