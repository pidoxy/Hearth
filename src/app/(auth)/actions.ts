"use server";

import { redirect } from "next/navigation";
import { createSession, currentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { addPerson, createHousehold } from "@/lib/households";
import { id } from "@/lib/ids";
import { isValidTimeZone } from "@/lib/time";

export type AuthState = { error?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeNext(next: FormDataEntryValue | null): string | null {
  const s = typeof next === "string" ? next : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
}

export async function signup(_prev: AuthState, form: FormData): Promise<AuthState> {
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!name) return { error: "What should we call you?" };
  if (!EMAIL.test(email)) return { error: "That email doesn't look right." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  if (db.prepare(`SELECT 1 FROM users WHERE email = ?`).get(email)) {
    return { error: "There's already an account with that email. Try signing in." };
  }
  const uid = id("usr");
  db.prepare(`INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)`).run(
    uid,
    email,
    name,
    await hashPassword(password),
  );
  await createSession(uid);
  redirect(safeNext(form.get("next")) ?? "/onboarding");
}

export async function login(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const row = db.prepare(`SELECT id, password_hash FROM users WHERE email = ?`).get(email) as
    | { id: string; password_hash: string }
    | undefined;
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return { error: "Email or password is incorrect." };
  }
  await createSession(row.id);
  redirect(safeNext(form.get("next")) ?? "/app");
}

export async function createHouseholdAction(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.household_id) redirect("/app");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  const tz = String(form.get("timezone") ?? "UTC");
  if (!name) return { error: "Name your household." };
  const hid = createHousehold({
    name,
    timezone: isValidTimeZone(tz) ? tz : "UTC",
    ownerUserId: user.id,
    ownerName: user.name.split(" ")[0],
  });
  const others = String(form.get("people") ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 12);
  for (const p of new Set(others)) addPerson(hid, p);
  redirect("/app/inbox?welcome=1");
}

export async function acceptInvite(_prev: AuthState, form: FormData): Promise<AuthState> {
  const user = await currentUser();
  const t = String(form.get("token") ?? "");
  if (!user) redirect(`/signup?next=/join/${encodeURIComponent(t)}`);
  const invite = db.prepare(`SELECT * FROM invites WHERE token = ?`).get(t) as
    | { household_id: string; expires_at: string }
    | undefined;
  if (!invite || new Date(invite.expires_at) < new Date()) return { error: "This invite has expired. Ask for a new link." };
  if (user.household_id && user.household_id !== invite.household_id) {
    return { error: "You're already in another household." };
  }
  if (!user.household_id) {
    // Reuse a matching non-account person (e.g. "Tunde" added during onboarding), else create one.
    const firstName = user.name.split(" ")[0];
    const match = db
      .prepare(
        `SELECT p.id FROM people p WHERE p.household_id = ? AND lower(p.name) = lower(?)
           AND NOT EXISTS (SELECT 1 FROM users u WHERE u.person_id = p.id)`,
      )
      .get(invite.household_id, firstName) as { id: string } | undefined;
    const personId = match?.id ?? addPerson(invite.household_id, firstName).id;
    db.prepare(`UPDATE users SET household_id = ?, person_id = ? WHERE id = ?`).run(
      invite.household_id,
      personId,
      user.id,
    );
  }
  redirect("/app");
}
