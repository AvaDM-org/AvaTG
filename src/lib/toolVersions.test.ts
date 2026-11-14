import { describe, expect, it } from "vitest";
import { checkVersion, resolveTool, type ToolCandidates } from "./toolVersions";

const today = new Date(Date.UTC(2026, 10, 14));

describe("checkVersion", () => {
  it("Deno needs 2.3 or newer", () => {
    expect(checkVersion("deno", "2.9.8").ok).toBe(true);
    expect(checkVersion("deno", "2.2.0").ok).toBe(false);
    expect(checkVersion("deno", "3.0.0").ok).toBe(true);
  });

  it("FFmpeg needs 5 or newer; development builds pass", () => {
    expect(checkVersion("ffmpeg", "8.1.3").ok).toBe(true);
    expect(checkVersion("ffmpeg", "n7.1").ok).toBe(true);
    expect(checkVersion("ffmpeg", "4.4.2").ok).toBe(false);
    expect(checkVersion("ffmpeg", "N-118000-g1234abcd").ok).toBe(true);
  });

  it("yt-dlp older than 3 months still runs, with a note", () => {
    expect(checkVersion("ytdlp", "2026.10.26", today)).toEqual({ ok: true, note: null });
    expect(checkVersion("ytdlp", "2026.01.01", today).note).toMatch(/Older/);
  });

  it("a tool that does not run is not ok", () => {
    expect(checkVersion("ffmpeg", null).ok).toBe(false);
  });
});

describe("resolveTool", () => {
  const c = (system: string | null, app: string | null): ToolCandidates => ({
    system: system ? { path: "/usr/bin/x", version: system } : null,
    app: app ? { path: "/data/bin/x", version: app } : null,
    custom: null,
  });

  it("automatic prefers a good system copy", () => {
    expect(resolveTool("ffmpeg", { source: "auto", customPath: "" }, c("8.1.3", "9.0.2"), today).from).toBe("system");
  });

  it("automatic falls back to TubeGrab's copy when the system one is too old", () => {
    expect(resolveTool("ffmpeg", { source: "auto", customPath: "" }, c("4.4", "9.0.2"), today).from).toBe("app");
  });

  it("automatic with only an old system copy reports it as not ok", () => {
    const r = resolveTool("deno", { source: "auto", customPath: "" }, c("2.1.0", null), today);
    expect(r.from).toBe("system");
    expect(r.check.ok).toBe(false);
  });

  it("custom uses the user's file", () => {
    const r = resolveTool(
      "ytdlp",
      { source: "custom", customPath: "/opt/yt-dlp" },
      { ...c(null, null), custom: { path: "/opt/yt-dlp", version: "2026.11.01" } },
      today,
    );
    expect(r).toMatchObject({ from: "custom", path: "/opt/yt-dlp", check: { ok: true } });
  });
});
