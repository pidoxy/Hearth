import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization");
  const q = new URL(req.url).searchParams.get("secret");
  return header === `Bearer ${secret}` || q === secret;
}

async function handle(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const sent = await runReminders();
  return Response.json({ ok: true, sent });
}

export const GET = handle;
export const POST = handle;
