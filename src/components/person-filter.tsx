import Link from "next/link";
import type { Person } from "@/lib/types";

export function PersonFilter({ people, active, base, extra = "" }: { people: Person[]; active?: string; base: string; extra?: string }) {
  const link = (who?: string) => `${base}?${[who ? `who=${who}` : "", extra].filter(Boolean).join("&")}`;
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Filter by person">
      <Link href={link()} className={`chip shrink-0 ${!active ? "border-ink bg-ink text-bg" : ""}`}>Everyone</Link>
      {people.map((p) => {
        const on = active === p.id;
        return (
          <Link
            key={p.id}
            href={link(p.id)}
            className="chip shrink-0"
            style={on ? { background: p.color, borderColor: p.color, color: "white" } : undefined}
          >
            <span className="size-2 rounded-full" style={{ background: on ? "white" : p.color }} />
            {p.name}
          </Link>
        );
      })}
    </div>
  );
}
