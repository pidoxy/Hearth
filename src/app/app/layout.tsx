import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { db } from "@/lib/db";
import { listPeople } from "@/lib/households";
import { LogoutIcon, SettingsIcon, Wordmark } from "@/components/icons";
import { SideNav, TabBar } from "@/components/nav";
import { Avatar } from "@/components/people";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { household, user, me } = await requireCtx();
  const people = listPeople(household.id);
  const { n: reviewCount } = db
    .prepare(`SELECT COUNT(*) AS n FROM items WHERE household_id = ? AND status = 'proposed'`)
    .get(household.id) as { n: number };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-bg px-4 py-5 lg:flex">
        <Link href="/app" className="px-2"><Wordmark /></Link>
        <SideNav reviewCount={reviewCount} />
        <div className="mt-8 px-3">
          <p className="eyebrow">Household</p>
          <ul className="mt-3 space-y-2.5">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 text-sm text-ink-2">
                <span className="size-2.5 rounded-full" style={{ background: p.color }} />
                {p.name}
                {p.id === me?.id && <span className="text-xs text-muted">(you)</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-auto flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
          {me ? <Avatar person={me} size={34} /> : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{household.name}</p>
          </div>
          <form action={logout}>
            <button className="btn btn-ghost btn-sm px-2" aria-label="Sign out" title="Sign out">
              <LogoutIcon size={18} />
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/app"><Wordmark /></Link>
          <Link href="/app/settings" className="btn btn-ghost btn-sm px-2" aria-label="Settings">
            <SettingsIcon />
          </Link>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-32 pt-6 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
      </div>
      <TabBar reviewCount={reviewCount} />
    </div>
  );
}
