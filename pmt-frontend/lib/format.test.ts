/**
 * Unit tests for display formatting.
 *
 * These pin the contract that keeps ADR 0003 true: formatting is the last step,
 * it never loses information that something downstream needs, and the fallback
 * copy is whatever the call site asked for rather than whichever duplicate
 * implementation it happened to reach.
 */

import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  formatEnumLabel,
  formatFileSize,
  formatHours,
  formatMinutes,
} from "./format";

describe("absent values", () => {
  it.each([
    ["formatDate", formatDate],
    ["formatDateTime", formatDateTime],
    ["formatDateOnly", formatDateOnly],
  ])('%s falls back to "Not set" by default', (_name, fn) => {
    expect(fn(null)).toBe("Not set");
    expect(fn(undefined)).toBe("Not set");
  });

  it.each([
    ["formatDate", formatDate],
    ["formatDateTime", formatDateTime],
    ["formatDateOnly", formatDateOnly],
  ])("%s takes the call site's own fallback copy", (_name, fn) => {
    // Before lib/format.ts these were twenty separate declarations with
    // different fallbacks baked in: "Not set", "Recently", "Not reviewed",
    // "Not available", "No deadline". Making it an argument is what allowed
    // them to merge without silently rewriting UI copy.
    expect(fn(null, "Recently")).toBe("Recently");
  });

  it("handles absent numbers too", () => {
    expect(formatMinutes(null, "Still open")).toBe("Still open");
    expect(formatHours(null)).toBe("Not set");
    expect(formatFileSize(null, "No file size")).toBe("No file size");
  });

  it("does NOT treat zero as absent", () => {
    // 0 minutes logged is a fact, not a missing value. A truthiness check here
    // would render it as "Not set", which is a different and wrong claim.
    expect(formatMinutes(0)).toBe("0m");
    expect(formatHours(0)).toBe("0h");
    expect(formatFileSize(0)).toBe("0 B");
  });
});

describe("formatMinutes", () => {
  it("splits into hours and minutes exactly, losing nothing", () => {
    expect(formatMinutes(450)).toBe("7h 30m");
    expect(formatMinutes(61)).toBe("1h 1m");
  });

  it("omits a zero remainder on the hour", () => {
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(540)).toBe("9h");
  });

  it("omits the hour part under an hour", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(1)).toBe("1m");
  });
});

describe("formatHours", () => {
  it("drops the decimals on a whole number", () => {
    expect(formatHours(12)).toBe("12h");
  });

  it("shows two decimals otherwise, matching the precision the server uses", () => {
    // Always two, not "as many as needed": 0.5 renders as 0.50h. Consistent
    // width is what makes a column of hours readable, and it matches the 2dp
    // the report services round to (ADR 0003).
    expect(formatHours(12.25)).toBe("12.25h");
    expect(formatHours(0.5)).toBe("0.50h");
  });

  it("rounds to two decimals rather than showing float noise", () => {
    expect(formatHours(1 / 3)).toBe("0.33h");
  });
});

describe("formatEnumLabel", () => {
  it("title cases each underscore separated word", () => {
    expect(formatEnumLabel("READY_FOR_WORK")).toBe("Ready For Work");
    expect(formatEnumLabel("IN_PROGRESS")).toBe("In Progress");
  });

  it("handles a single word", () => {
    expect(formatEnumLabel("COMPLETED")).toBe("Completed");
  });

  it("reproduces the acronym flaw the component copies had", () => {
    // Deliberate. This function exists only to let the duplicates be deleted
    // without changing pixels, so it must be bug compatible with them. The fix
    // is a server supplied label (ADR 0001), not a cleverer guess here.
    expect(formatEnumLabel("AI_SUMMARY")).toBe("Ai Summary");
  });
});

describe("formatFileSize", () => {
  it("shows bytes under a kilobyte", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("steps up through the units", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1 MB");
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1 GB");
  });

  it("shows one decimal for a partial unit", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("caps at gigabytes rather than inventing a larger unit", () => {
    expect(formatFileSize(5 * 1024 ** 4)).toMatch(/GB$/);
  });
});

describe("formatDateOnly", () => {
  it("renders the day that was stored, not the day it is in your timezone", () => {
    // The whole reason this is separate from formatDate. "2026-08-12" parses as
    // UTC midnight; rendering it in any timezone behind UTC would show the 11th.
    expect(formatDateOnly("2026-08-12")).toContain("12");
    expect(formatDateOnly("2026-08-12")).not.toContain("11");
  });

  it("ignores a time component on a value the API sent as a full ISO string", () => {
    expect(formatDateOnly("2026-08-12T23:30:00.000Z")).toBe(formatDateOnly("2026-08-12"));
  });

  it("survives the boundary that breaks the naive version", () => {
    // Late-evening UTC is the previous day in the Americas and the next day in
    // Asia. A calendar date must be immune to both.
    expect(formatDateOnly("2026-01-01T00:00:00.000Z")).toContain("1");
    expect(formatDateOnly("2026-12-31T23:59:59.000Z")).toContain("31");
  });
});

describe("dates", () => {
  it("formats a date and a date-time differently", () => {
    const iso = "2026-08-12T14:32:00.000Z";
    expect(formatDate(iso)).not.toBe(formatDateTime(iso));
    expect(formatDateTime(iso).length).toBeGreaterThan(formatDate(iso).length);
  });

  it("accepts a Date and an epoch number as well as an ISO string", () => {
    // project-activity-timeline passes epoch milliseconds, everything else
    // passes ISO strings. One signature has to take both.
    const iso = "2026-08-12T14:32:00.000Z";
    expect(formatDate(new Date(iso))).toBe(formatDate(iso));
    expect(formatDate(new Date(iso).getTime())).toBe(formatDate(iso));
  });
});
