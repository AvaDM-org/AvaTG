import { describe, expect, it } from "vitest";
import { fmtBytes, fmtDate, fmtEta, fmtTook } from "./format";

describe("format", () => {
  it("formats sizes and times", () => {
    expect(fmtBytes(1536)).toBe("1.5 KB");
    expect(fmtEta(72)).toBe("1m 12s");
    expect(fmtTook(4200)).toBe("4s");
    expect(fmtTook(300)).toBe("1s");
  });

  it("formats dates relative to today", () => {
    const now = new Date(2026, 10, 15, 12, 0).getTime();
    expect(fmtDate(new Date(2026, 10, 15, 9, 5).getTime(), now)).toBe("Today, 09:05");
    expect(fmtDate(new Date(2026, 10, 14, 23, 59).getTime(), now)).toBe("Yesterday, 23:59");
    expect(fmtDate(new Date(2026, 8, 24, 14, 50).getTime(), now)).toBe("Sep 24, 14:50");
    expect(fmtDate(new Date(2025, 8, 24, 14, 50).getTime(), now)).toBe("Sep 24, 2025");
    expect(fmtDate(null, now)).toBe("");
  });
});
