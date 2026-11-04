import { describe, expect, it } from "vitest";
import { extractWithFallback } from "@/lib/extract/fallback";

const letter = `Dear Parents,
The Year 4 bake sale is on Friday 14 November at 3:15pm in the school hall. Please bring £3 for cakes.
Permission slips for the museum trip must be returned by 20 November.
Zara's class assembly will be on 27 November at 9am.`;

describe("fallback extractor", () => {
  const res = extractWithFallback({
    text: letter,
    file: null,
    docDate: "2026-11-04",
    timezone: "Europe/London",
    people: ["Zara", "Tunde"],
  });

  it("finds each dated item", () => {
    expect(res.items.map((i) => i.start)).toEqual(["2026-11-14T15:15", "2026-11-20", "2026-11-27T09:00"]);
  });
  it("classifies deadlines and prep", () => {
    const [bake, slip, assembly] = res.items;
    expect(bake.kind).toBe("event");
    expect(bake.needs_prep).toBe(true);
    expect(slip.kind).toBe("deadline");
    expect(slip.all_day).toBe(true);
    expect(assembly.for_people).toEqual(["Zara"]);
  });
  it("produces readable titles", () => {
    expect(res.items[0].title).toMatch(/bake sale/i);
  });
});
