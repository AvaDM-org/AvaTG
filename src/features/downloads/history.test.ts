import { describe, expect, it } from "vitest";
import { RunClock } from "./history";

describe("RunClock", () => {
  it("counts receiving time apart from the whole run", () => {
    const c = new RunClock(1000);
    c.receiving(1500);
    c.receiving(2000); // still the same stretch
    c.idle(3500); // video done
    c.receiving(4000);
    c.idle(4500); // audio done, merging starts
    expect(c.stop(6000)).toEqual({ activeMs: 5000, transferMs: 2500 });
  });

  it("closes an open stretch when the run stops", () => {
    const c = new RunClock(0);
    c.receiving(100);
    expect(c.stop(600)).toEqual({ activeMs: 600, transferMs: 500 });
  });
});
