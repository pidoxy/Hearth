import "server-only";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import type { Household, Person, User } from "./types";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "hearth_session";
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scrypt(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(keyHex, "hex");
  return expected.length === key.length && timingSafeEqual(expected, key);
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string) {
  const raw = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  db.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).run(
    sha(raw),
    userId,
    expires.toISOString(),
  );
  const jar = await cookies();
  jar.set(COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && !process.env.INSECURE_COOKIES,
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sha(raw));
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.household_id, u.person_id, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    )
    .get(sha(raw)) as (User & { expires_at: string }) | undefined;
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    db.prepare(`DELETE FROM sessions WHERE id = ?`).run(sha(raw));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, household_id: row.household_id, person_id: row.person_id };
}

export interface Ctx {
  user: User;
  household: Household;
  me: Person | null;
}

/** For pages/actions inside the app: requires a signed-in user with a household. */
export async function requireCtx(): Promise<Ctx> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!user.household_id) redirect("/onboarding");
  const household = db.prepare(`SELECT * FROM households WHERE id = ?`).get(user.household_id) as
    | Household
    | undefined;
  if (!household) redirect("/onboarding");
  const me = user.person_id
    ? ((db.prepare(`SELECT * FROM people WHERE id = ?`).get(user.person_id) as Person | undefined) ?? null)
    : null;
  return { user, household, me };
}
