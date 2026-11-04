import { describe, expect, it } from "vitest";
import { addDays, formatWhen, wallToUtc, zonedDate, zonedDateTime } from "@/lib/time";

describe("time", () => {
  it("round-trips wall time through UTC across zones", () => {
    for (const tz of ["Europe/London", "America/New_York", "Africa/Lagos", "Asia/Kolkata", "UTC"]) {
      const d = wallToUtc("2026-11-14T09:30", tz);
      expect(zonedDateTime(d, tz)).toBe("2026-11-14T09:30");
    }
  });
  it("handles DST in London (BST, summer)", () => {
    expect(wallToUtc("2026-07-01T10:00", "Europe/London").toISOString()).toBe("2026-07-01T09:00:00.000Z");
    expect(wallToUtc("2026-12-01T10:00", "Europe/London").toISOString()).toBe("2026-12-01T10:00:00.000Z");
  });
  it("adds days across month ends", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
  it("formats relative days", () => {
    expect(formatWhen("2026-11-05T15:00", null, false, "2026-11-04")).toBe("Tomorrow, 3pm");
    expect(formatWhen("2026-11-04", null, true, "2026-11-04")).toBe("Today");
    expect(zonedDate(new Date("2026-11-04T23:30:00Z"), "Africa/Lagos")).toBe("2026-11-05");
  });
});
