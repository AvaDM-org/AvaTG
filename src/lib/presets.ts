// Download presets and their translation into yt-dlp arguments.
// This is the one place to change how quality, format and extras map to yt-dlp flags.

export type Mode = "av" | "video" | "audio";
export type VideoContainer = "mp4" | "mkv" | "webm";
export type AudioFormat = "best" | "mp3" | "m4a" | "opus" | "flac" | "wav";
export type SubtitleMode = "embed" | "separate" | "both";

/** What one download should produce. Chosen per download in the picker. */
export interface Preset {
  mode: Mode;
  /** null = best available */
  maxHeight: number | null;
  container: VideoContainer;
  audioFormat: AudioFormat;
  /** for lossy re-encodes: "0" (best VBR) or a bitrate like "192K" */
  audioQuality: string;
  subtitles: boolean;
  /** yt-dlp language codes, e.g. ["en", "de"] */
  subLangs: string[];
  /** save the description as a .txt next to the video */
  description: boolean;
  thumbnail: boolean;
  /** embed metadata and chapters */
  chapters: boolean;
  sponsorBlock: boolean;
}

/** App-wide settings that also shape the yt-dlp command (Settings > Downloads and Files). */
export interface DownloadOptions {
  subtitleMode: SubtitleMode;
  autoCaptions: boolean;
  /** pieces of one video fetched at once (-N) */
  fragments: number;
  /** MB/s cap for each download, or null for no limit */
  limitMbps: number | null;
  retries: number;
  /** seconds without data before yt-dlp retries */
  socketTimeout: number;
}

export interface OutputOptions {
  outputDir: string;
  /** e.g. playlist title → files go into <outputDir>/<subfolder>/ */
  subfolder?: string | null;
  /** 1-based position, prefixed as "001 - " */
  index?: number | null;
}

export const STANDARD_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

export const DEFAULT_PRESET: Preset = {
  mode: "av",
  maxHeight: 1080,
  container: "mp4",
  audioFormat: "mp3",
  audioQuality: "0",
  subtitles: false,
  subLangs: ["en"],
  description: false,
  thumbnail: true,
  chapters: true,
  sponsorBlock: false,
};

export const QUICK_PRESETS: { name: string; hint: string; patch: Partial<Preset> }[] = [
  { name: "Best quality", hint: "Highest resolution, MKV", patch: { mode: "av", maxHeight: null, container: "mkv" } },
  { name: "1080p MP4", hint: "Plays everywhere", patch: { mode: "av", maxHeight: 1080, container: "mp4" } },
  { name: "720p MP4", hint: "Smaller files", patch: { mode: "av", maxHeight: 720, container: "mp4" } },
  { name: "MP3 audio", hint: "Best VBR MP3", patch: { mode: "audio", audioFormat: "mp3", audioQuality: "0" } },
  { name: "M4A audio", hint: "Original AAC, no re-encode", patch: { mode: "audio", audioFormat: "m4a" } },
];

/** The quick preset whose choices match `p`, if any (extras are ignored). */
export function matchingQuickPreset(p: Preset): string | null {
  const keys: (keyof Preset)[] = ["mode", "maxHeight", "container", "audioFormat", "audioQuality"];
  const hit = QUICK_PRESETS.find((q) =>
    keys.every((k) => !(k in q.patch) || q.patch[k] === p[k] || (p.mode === "audio" && k === "maxHeight")),
  );
  return hit?.name ?? null;
}

const isLossy = (f: AudioFormat) => f === "mp3" || f === "m4a" || f === "opus";

/** Short label for the Format column: "MP4 · 1080p", "MKV · Best", "MP3 · 320 kbps", "M4A · Original". */
export function formatLabel(p: Preset): string {
  if (p.mode === "audio") {
    if (p.audioFormat === "best") return "Audio · Original";
    const q = isLossy(p.audioFormat) && p.audioQuality !== "0" ? p.audioQuality.replace("K", " kbps") : "Best";
    return `${p.audioFormat.toUpperCase()} · ${p.audioFormat === "m4a" && p.audioQuality === "0" ? "Original" : q}`;
  }
  const res = p.maxHeight ? `${p.maxHeight}p` : "Best";
  return `${p.container.toUpperCase()} · ${res}${p.mode === "video" ? " (no audio)" : ""}`;
}

/** Remove characters that are illegal in file names or special in yt-dlp templates. */
export function safeName(s: string): string {
  return (
    s
      // eslint-disable-next-line no-control-regex -- control characters are illegal in file names
      .replace(/[<>:"/\\|?*%\u0000-\u001f]/g, "_")
      .replace(/[. ]+$/, "")
      .trim()
      .slice(0, 120) || "untitled"
  );
}

function subtitleArgs(p: Preset, o: DownloadOptions): string[] {
  if (!p.subtitles || p.mode === "audio") return [];
  const a = ["--sub-langs", p.subLangs.join(",") || "en.*", "--write-subs"];
  if (o.autoCaptions) a.push("--write-auto-subs");
  if (o.subtitleMode !== "embed") a.push("--convert-subs", "srt");
  if (o.subtitleMode !== "separate") a.push("--embed-subs");
  // Embedded only: delete the subtitle files after embedding them.
  if (o.subtitleMode === "embed") a.push("--compat-options", "no-keep-subs");
  return a;
}

export function buildArgs(p: Preset, out: OutputOptions, o: DownloadOptions): string[] {
  const a: string[] = [];

  if (p.mode === "audio") {
    a.push("-f", p.audioFormat === "m4a" ? "ba[ext=m4a]/ba/b" : "ba/b", "-x");
    if (p.audioFormat !== "best") a.push("--audio-format", p.audioFormat);
    if (isLossy(p.audioFormat)) a.push("--audio-quality", p.audioQuality || "0");
  } else {
    a.push("-f", p.mode === "av" ? "bv*+ba/b" : "bv/bv*");
    const sort: string[] = [];
    if (p.maxHeight) sort.push(`res:${p.maxHeight}`);
    if (p.container === "mp4") sort.push("ext:mp4:m4a");
    else if (p.container === "webm") sort.push("ext:webm:webm");
    if (sort.length) a.push("-S", sort.join(","));
    if (p.mode === "av") a.push("--merge-output-format", p.container);
    else a.push("--remux-video", p.container);
  }

  a.push(...subtitleArgs(p, o));
  const thumbOk = p.mode === "audio" ? p.audioFormat !== "wav" : p.container !== "webm";
  if (p.thumbnail && thumbOk) a.push("--embed-thumbnail");
  if (p.chapters) a.push("--embed-metadata", "--embed-chapters");
  if (p.sponsorBlock) a.push("--sponsorblock-remove", "sponsor");
  if (p.description) a.push("--write-description");

  a.push("-N", String(o.fragments), "--retries", String(o.retries), "--fragment-retries", String(o.retries));
  a.push("--socket-timeout", String(o.socketTimeout));
  if (o.limitMbps) a.push("--limit-rate", `${o.limitMbps}M`);

  a.push("--no-mtime", "-P", out.outputDir);
  const folder = out.subfolder ? `${safeName(out.subfolder)}/` : "";
  const prefix = out.index ? `${String(out.index).padStart(3, "0")} - ` : "";
  a.push("-o", `${folder}${prefix}%(title)s [%(id)s].%(ext)s`);
  return a;
}
