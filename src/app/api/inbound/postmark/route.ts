import { timingSafeEqual } from "node:crypto";
import { CaptureError, checkRateLimit, createCapture, processInBackground } from "@/lib/captures";
import { SUPPORTED_MIME } from "@/lib/extract";
import { getHouseholdByInbound, householdMembers } from "@/lib/households";
import { inboundCodeFrom, parsePostmark } from "@/lib/inbound";

export const dynamic = "force-dynamic";

function secretOk(req: Request): boolean {
  const secret = process.env.INBOUND_SECRET;
  if (!secret) return false;
  const url = new URL(req.url);
  let given = url.searchParams.get("secret") ?? "";
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const decoded = Buffer.from(auth.slice(6), "base64").toString();
    given = decoded.split(":").slice(1).join(":") || decoded;
  }
  const a = Buffer.from(given), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretOk(req)) return new Response("Unauthorized", { status: 401 });
  const email = parsePostmark(await req.json());
  const code = inboundCodeFrom(email.to, process.env.INBOUND_DOMAIN);
  const household = code ? getHouseholdByInbound(code) : undefined;
  // Always 200 for unknown recipients so the provider doesn't retry forever.
  if (!household) return Response.json({ ok: true, ignored: "unknown recipient" });

  const members = householdMembers(household.id);
  const allowed = new Set([
    ...members.map((m) => m.email.toLowerCase()),
    ...household.allowed_senders.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean),
  ]);
  const verified = allowed.has(email.from);
  const sender = members.find((m) => m.email.toLowerCase() === email.from);

  try {
    checkRateLimit(household.id);
    const attachment = email.attachments.find((a) => SUPPORTED_MIME.has(a.mime) && a.data.length > 0);
    const cap = createCapture({
      household,
      userId: sender?.id ?? null,
      source: "email",
      title: email.subject,
      text: email.text || null,
      file: attachment ?? null,
      emailFrom: email.from,
      docDate: email.date,
      unverified: !verified,
    });
    if (verified) processInBackground(household, cap.id);
    return Response.json({ ok: true, id: cap.id, verified });
  } catch (err) {
    if (err instanceof CaptureError) return Response.json({ ok: false, error: err.message });
    throw err;
  }
}
