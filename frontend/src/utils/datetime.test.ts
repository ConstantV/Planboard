import { describe, expect, it } from "vitest";

import { localInputToIso, toLocalInputValue } from "./datetime";

describe("datetime", () => {
  it("preserves wall-clock time in a timezone-aware ISO string", () => {
    const iso = localInputToIso("2026-08-26T10:00");
    expect(iso).toMatch(/^2026-08-26T10:00:00[+-]\d{2}:\d{2}$/);
  });

  it("round-trips a local datetime value", () => {
    const value = "2026-08-26T10:00";
    const iso = localInputToIso(value);
    expect(toLocalInputValue(new Date(iso))).toBe(value);
  });
});
