"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, CheckSquareIcon, HomeIcon, InboxIcon, PlusIcon, SettingsIcon } from "./icons";

const NAV = [
  { href: "/app", label: "Today", icon: HomeIcon },
  { href: "/app/inbox", label: "Inbox", icon: InboxIcon, badge: true },
  { href: "/app/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/app/tasks", label: "Tasks", icon: CheckSquareIcon },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function isActive(path: string, href: string) {
  return href === "/app" ? path === "/app" : path.startsWith(href);
}

export function SideNav({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  return (
    <nav className="mt-6 space-y-1" aria-label="Main">
      {NAV.map((n) => {
        const active = isActive(path, n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors ${
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-ink-2 hover:bg-sunken hover:text-ink"
            }`}
          >
            <n.icon className={active ? "text-ember" : ""} />
            <span className="flex-1">{n.label}</span>
            {n.badge && reviewCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1.5 text-[11px] font-bold text-ember-ink">
                {reviewCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ reviewCount }: { reviewCount: number }) {
  const path = usePathname();
  const items = [NAV[0], NAV[1], null, NAV[2], NAV[3]];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((n, i) =>
          n ? (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(path, n.href) ? "page" : undefined}
              className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold ${
                isActive(path, n.href) ? "text-ember" : "text-muted"
              }`}
            >
              <n.icon size={22} />
              {n.label}
              {n.badge && reviewCount > 0 && (
                <span className="absolute right-[22%] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-ember px-1 text-[10px] font-bold text-ember-ink">
                  {reviewCount}
                </span>
              )}
            </Link>
          ) : (
            <div key={i} className="flex items-center justify-center">
              <Link
                href="/app/inbox#capture"
                aria-label="Add something"
                className="-mt-6 grid size-14 place-items-center rounded-full bg-ember text-ember-ink shadow-lg ring-4 ring-bg"
              >
                <PlusIcon size={26} />
              </Link>
            </div>
          ),
        )}
      </div>
    </nav>
  );
}
