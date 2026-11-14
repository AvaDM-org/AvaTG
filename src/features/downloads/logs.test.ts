import { describe, expect, it } from "vitest";
import { useDownloadLogs, warningKey } from "./logs";

describe("download logs", () => {
  it("strips the prefix and video id from warnings", () => {
    expect(warningKey("WARNING: [youtube] jNQXAC9IVRw: Some formats are missing")).toBe("Some formats are missing");
    expect(warningKey("WARNING: Requested formats are incompatible")).toBe("Requested formats are incompatible");
  });

  it("keeps the newest lines per download", () => {
    const { add, forget } = useDownloadLogs.getState();
    for (let i = 0; i < 510; i++) add("a", { at: i, level: "info", text: String(i) });
    const lines = useDownloadLogs.getState().lines.a;
    expect(lines.length).toBe(500);
    expect(lines[0].text).toBe("10");
    forget(["a"]);
    expect(useDownloadLogs.getState().lines.a).toBeUndefined();
  });
});
