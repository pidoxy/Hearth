import { currentUser } from "@/lib/auth";
import { getCapture, readCaptureFile } from "@/lib/captures";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user?.household_id) return new Response("Unauthorized", { status: 401 });
  const cap = getCapture(user.household_id, (await params).id);
  const data = cap ? readCaptureFile(cap) : null;
  if (!cap || !data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": cap.file_mime ?? "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(cap.file_name ?? "file")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox",
    },
  });
}
