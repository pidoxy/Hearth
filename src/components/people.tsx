import type { Person } from "@/lib/types";

export function Avatar({ person, size = 28 }: { person: Pick<Person, "name" | "color">; size?: number }) {
  const initials = person.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="inline-grid place-items-center rounded-full font-semibold text-white shrink-0"
      style={{ width: size, height: size, background: person.color, fontSize: size * 0.4 }}
      title={person.name}
    >
      {initials}
    </span>
  );
}

export function PersonChip({ person }: { person: Pick<Person, "name" | "color"> }) {
  return (
    <span
      className="chip"
      style={{
        borderColor: `color-mix(in srgb, ${person.color} 35%, transparent)`,
        background: `color-mix(in srgb, ${person.color} 12%, transparent)`,
        color: `color-mix(in srgb, ${person.color} 75%, var(--ink))`,
      }}
    >
      <span className="size-2 rounded-full" style={{ background: person.color }} />
      {person.name}
    </span>
  );
}

export function PeopleDots({ people, max = 4 }: { people: Pick<Person, "name" | "color">[]; max?: number }) {
  return (
    <span className="inline-flex -space-x-1.5">
      {people.slice(0, max).map((p) => (
        <span key={p.name} className="ring-2 ring-[var(--surface)] rounded-full">
          <Avatar person={p} size={20} />
        </span>
      ))}
    </span>
  );
}
