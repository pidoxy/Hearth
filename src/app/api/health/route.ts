import { db } from "@/lib/db";
import { claudeAvailable } from "@/lib/extract/claude";

export const dynamic = "force-dynamic";

export function GET() {
  db.prepare("SELECT 1").get();
  return Response.json({ ok: true, ai: claudeAvailable() ? "claude" : "fallback" });
}
