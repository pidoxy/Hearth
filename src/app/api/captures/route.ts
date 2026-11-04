import { currentUser } from "@/lib/auth";
import { CaptureError, checkRateLimit, createCapture, processInBackground } from "@/lib/captures";
import { db } from "@/lib/db";
import type { Household } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Multipart upload: `file` (photo/PDF) and/or `text`. Returns the new capture id; extraction runs in background. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.household_id) return Response.json({ error: "Please sign in." }, { status: 401 });
  const household = db.prepare(`SELECT * FROM households WHERE id = ?`).get(user.household_id) as Household;

  try {
    checkRateLimit(household.id);
    const form = await req.formData();
    const file = form.get("file");
    const text = (form.get("text") as string | null)?.trim() || null;
    let filePart: { data: Buffer; mime: string; name: string } | null = null;
    if (file && typeof file !== "string" && file.size > 0) {
      filePart = { data: Buffer.from(await file.arrayBuffer()), mime: file.type, name: file.name };
    }
    const title = filePart?.name.replace(/\.[^.]+$/, "") || (text ? text.split("\n")[0].slice(0, 80) : "Capture");
    const cap = createCapture({
      household,
      userId: user.id,
      source: filePart ? "upload" : "paste",
      title,
      text,
      file: filePart,
    });
    processInBackground(household, cap.id);
    return Response.json({ id: cap.id });
  } catch (err) {
    if (err instanceof CaptureError) return Response.json({ error: err.message }, { status: 400 });
    console.error(err);
    return Response.json({ error: "Something went wrong saving that." }, { status: 500 });
  }
}
