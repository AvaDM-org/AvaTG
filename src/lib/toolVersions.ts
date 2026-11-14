// Which copy of each tool AvaTG runs, and whether its version is good enough.
// A tool can come from the system (found on PATH), AvaTG's own downloaded copy, or a file the user picked.

export type ToolId = "ytdlp" | "deno" | "ffmpeg";
export type ToolSource = "auto" | "app" | "custom";

export interface ToolChoice {
  /** "auto": a good system copy if there is one, else AvaTG's own */
  source: ToolSource;
  customPath: string;
}

export interface VersionCheck {
  ok: boolean;
  /** shown even when ok (e.g. an old yt-dlp still runs but may fail on YouTube) */
  note: string | null;
}

/** yt-dlp older than this is still used, with a warning: YouTube changes often. */
const YTDLP_STALE_DAYS = 90;

export function checkVersion(id: ToolId, version: string | null, today = new Date()): VersionCheck {
  if (!version) return { ok: false, note: "Does not run" };
  if (id === "deno") {
    const [maj, min] = version.split(".").map(Number);
    const ok = maj > 2 || (maj === 2 && min >= 3);
    return { ok, note: ok ? null : "yt-dlp needs Deno 2.3 or newer" };
  }
  if (id === "ffmpeg") {
    // Release builds report "8.1.3" or "n7.1"; development builds report "N-118000-g1234abcd".
    if (/^N-|git/i.test(version)) return { ok: true, note: null };
    const major = Number(version.replace(/^n/, "").split(".")[0]);
    const ok = Number.isFinite(major) && major >= 5;
    return { ok, note: ok ? null : "FFmpeg 5 or newer is needed" };
  }
  // yt-dlp versions are dates: 2026.10.26 (nightlies add .123456).
  const m = version.match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  if (!m) return { ok: true, note: null };
  const age = (today.getTime() - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86_400_000;
  return { ok: true, note: age > YTDLP_STALE_DAYS ? "Older than 3 months; YouTube downloads may fail" : null };
}

export interface ToolCandidates {
  /** AvaTG's own copy */
  app: { path: string; version: string | null } | null;
  /** found on PATH */
  system: { path: string; version: string | null } | null;
  /** the user's file, when the source is "custom" */
  custom: { path: string; version: string | null } | null;
}

export interface ResolvedTool {
  path: string | null;
  from: "system" | "app" | "custom" | null;
  version: string | null;
  check: VersionCheck;
}

const NONE: ResolvedTool = { path: null, from: null, version: null, check: { ok: false, note: "Not installed" } };

export function resolveTool(id: ToolId, choice: ToolChoice, c: ToolCandidates, today = new Date()): ResolvedTool {
  const pick = (from: ResolvedTool["from"], copy: { path: string; version: string | null } | null): ResolvedTool =>
    copy ? { path: copy.path, from, version: copy.version, check: checkVersion(id, copy.version, today) } : NONE;

  if (choice.source === "custom") return choice.customPath ? pick("custom", c.custom) : NONE;
  if (choice.source === "app") return pick("app", c.app);
  const system = pick("system", c.system);
  if (system.check.ok) return system;
  const app = pick("app", c.app);
  return app.check.ok ? app : system.path ? system : app;
}
