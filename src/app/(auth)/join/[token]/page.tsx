import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { JoinForm } from "./form";

export const metadata = { title: "Join household" };

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = db
    .prepare(`SELECT h.name, i.expires_at FROM invites i JOIN households h ON h.id = i.household_id WHERE i.token = ?`)
    .get(token) as { name: string; expires_at: string } | undefined;
  const user = await currentUser();
  const valid = invite && new Date(invite.expires_at) > new Date();

  return (
    <div className="card p-7 sm:p-9">
      {valid ? (
        <>
          <p className="eyebrow">You&apos;re invited</p>
          <h1 className="h-display mt-1 text-3xl">Join {invite.name}</h1>
          <p className="mt-1.5 text-ink-2">See the family calendar, review what comes in, and get reminders for what&apos;s yours.</p>
          <div className="mt-7">
            {user ? (
              <JoinForm token={token} />
            ) : (
              <div className="grid gap-3">
                <Link className="btn btn-primary h-11" href={`/signup?next=/join/${token}`}>Create an account to join</Link>
                <Link className="btn btn-secondary h-11" href={`/login?next=/join/${token}`}>I already have an account</Link>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="h-display text-3xl">This invite has expired</h1>
          <p className="mt-2 text-ink-2">Ask whoever sent it for a fresh link from Settings.</p>
        </>
      )}
    </div>
  );
}
