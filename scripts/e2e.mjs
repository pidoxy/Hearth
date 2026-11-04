// End-to-end smoke test + screenshot capture.
// Usage: BASE_URL=http://localhost:3000 INBOUND_SECRET=... node scripts/e2e.mjs [--shots docs/screenshots]
import { createRequire } from "node:module";
// Uses a globally installed Playwright (npx playwright, or npm i -D playwright).
const { chromium, devices } = createRequire(import.meta.url)("playwright");
import fs from "node:fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const SECRET = process.env.INBOUND_SECRET || "testsecret";
const shotsIdx = process.argv.indexOf("--shots");
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const email = `ada+${Date.now()}@example.com`;
const assert = (cond, msg) => {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.log(`✓ ${msg}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: SHOTS ? 2 : 1 });
const page = await ctx.newPage();
const shot = async (name, p = page) => SHOTS && p.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

// Landing
await page.goto(BASE);
assert((await page.textContent("h1")).includes("finally organised"), "landing renders");
await page.waitForTimeout(900);
await shot("01-landing");

// Sign up
await page.click("text=Get started");
await page.fill("#name", "Ada Okafor");
await page.fill("#email", email);
await page.fill("#password", "correct-horse-battery");
await shot("02-signup");
await page.click("button[type=submit]");
await page.waitForURL("**/onboarding");
assert(true, "signup → onboarding");

// Onboarding
await page.fill("#people", "Tunde, Zara, Kemi");
await page.fill("#timezone", "Europe/London");
await shot("03-onboarding");
await page.click("button[type=submit]");
await page.waitForURL("**/app/inbox**");
assert(true, "household created → inbox");

// Paste a school letter
await page.click("button:has-text(\"Text\")");
await page.fill(
  "textarea",
  `Dear Parents,
The Year 4 bake sale is on Friday 13 November at 3:15pm in the school hall. Please bring £3 for cakes.
Permission slips for the museum trip must be returned by 20 November.
Zara's class assembly will be on 27 November at 9am.
Kemi has swimming on Thursday 5 November at 4:30pm. Bring goggles.`,
);
await page.click("text=Find dates");
await page.waitForSelector("text=Add to calendar", { timeout: 20000 });
const cards = await page.locator("li:has-text('Add to calendar')").count();
assert(cards >= 4, `extracted ${cards} proposed items`);
await page.waitForTimeout(500);
await shot("04-inbox-review");

// Edit one card
await page.locator("button:has-text('Edit')").first().click();
await page.waitForSelector("text=Edit before adding");
await shot("05-edit-item");
await page.click("text=Cancel");

// Accept all
await page.locator("button:has-text('Add all')").first().click();
await page.waitForSelector("text=All caught up", { timeout: 10000 });
assert(true, "accepted all items");

// Today
await page.goto(`${BASE}/app`);
assert(await page.isVisible("text=/bake sale/i"), "today shows accepted event");
await shot("06-today");

// Calendar for November 2026
await page.goto(`${BASE}/app/calendar?m=2026-11&d=2026-11-13`);
assert(await page.isVisible("text=November"), "calendar renders");
await shot("07-calendar");

// Tasks
await page.goto(`${BASE}/app/tasks`);
assert(await page.isVisible("text=Permission slips"), "deadline appears in tasks");
await shot("08-tasks");

// Settings + ICS
await page.goto(`${BASE}/app/settings`);
const icsUrl = await page.locator("input[readonly]").first().inputValue();
const inbound = await page.locator("input[readonly]").nth(5).inputValue().catch(() => "");
await shot("09-settings");
const ics = await (await fetch(icsUrl.replace(/^https?:\/\/[^/]+/, BASE))).text();
assert(ics.includes("BEGIN:VCALENDAR") && /bake sale/i.test(ics), "ICS feed contains accepted events");

// Inbound email webhook (from the member's own address → verified)
const code = (await page.locator("code, input[readonly]").allInnerTexts()).join(" ");
const addr = (await page.locator("input[readonly]").evaluateAll((els) => els.map((e) => e.value))).find((v) => v.includes("@"));
assert(Boolean(addr), `found forwarding address ${addr}`);
const res = await fetch(`${BASE}/api/inbound/postmark?secret=${SECRET}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    From: `Ada <${email}>`,
    To: addr,
    Subject: "Fwd: Dentist appointment confirmed",
    Date: new Date().toUTCString(),
    TextBody: "Your appointment for Tunde is confirmed for Tuesday 18 November at 10:40am at Bright Smiles Dental.",
  }),
});
const body = await res.json();
assert(res.ok && body.verified === true, "inbound email accepted from member");
const bad = await fetch(`${BASE}/api/inbound/postmark?secret=wrong`, { method: "POST", body: "{}" });
assert(bad.status === 401, "inbound rejects bad secret");

await page.goto(`${BASE}/app/inbox`);
await page.waitForSelector("text=Dentist", { timeout: 15000 });
assert(true, "forwarded email shows in inbox");

// Invite flow
await page.goto(`${BASE}/app/settings`);
await page.click("text=Create invite link");
const invite = await page.locator("input[readonly][value*='/join/']").inputValue();
assert(invite.includes("/join/"), "invite link created");

// Mobile screenshots
if (SHOTS) {
  const m = await browser.newContext({ ...devices["iPhone 14"] });
  await m.addCookies(await ctx.cookies());
  const mp = await m.newPage();
  await mp.goto(`${BASE}/app/inbox`);
  await mp.waitForTimeout(400);
  await mp.screenshot({ path: `${SHOTS}/10-mobile-inbox.png` });
  await mp.goto(`${BASE}/app`);
  await mp.screenshot({ path: `${SHOTS}/11-mobile-today.png` });
  await mp.goto(`${BASE}/app/calendar?m=2026-11&d=2026-11-13`);
  await mp.screenshot({ path: `${SHOTS}/12-mobile-calendar.png` });
  await mp.goto(BASE + "/?preview");
  await m.clearCookies();
  await mp.goto(BASE);
  await mp.screenshot({ path: `${SHOTS}/13-mobile-landing.png` });
  // Dark mode
  const d = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: "dark" });
  await d.addCookies(await ctx.cookies());
  const dp = await d.newPage();
  await dp.goto(`${BASE}/app`);
  await dp.screenshot({ path: `${SHOTS}/14-dark-today.png`, fullPage: true });
}

// Sign-out protects app
await ctx.clearCookies();
await page.goto(`${BASE}/app`);
assert(page.url().includes("/login"), "signed-out user redirected to login");

void code;
await browser.close();
console.log("\nAll e2e checks passed.");
