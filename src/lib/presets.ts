// Download presets and their translation into yt-dlp arguments.
// This is the one place to change how quality/format choices map to yt-dlp flags.

export type Mode = "av" | "video" | "audio";
export type VideoContainer = "mp4" | "mkv" | "webm";
export type AudioFormat = "best" | "mp3" | "m4a" | "opus" | "flac" | "wav";

export interface Preset {
  mode: Mode;
  /** null = best available */
  maxHeight: number | null;
  container: VideoContainer;
  audioFormat: AudioFormat;
  /** for lossy re-encodes: "0" (best VBR) or a bitrate like "192K" */
  audioQuality: string;
  embedSubs: boolean;
  subLangs: string;
  embedThumbnail: boolean;
  embedMetadata: boolean;
  sponsorBlock: boolean;
}

export const STANDARD_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

export const DEFAULT_PRESET: Preset = {
  mode: "av",
  maxHeight: 1080,
  container: "mp4",
  audioFormat: "mp3",
  audioQuality: "0",
  embedSubs: false,
  subLangs: "en.*",
  embedThumbnail: true,
  embedMetadata: true,
  sponsorBlock: false,
};

export const QUICK_PRESETS: { name: string; hint: string; preset: Preset }[] = [
  { name: "Best quality", hint: "Highest resolution, MKV", preset: { ...DEFAULT_PRESET, maxHeight: null, container: "mkv" } },
  { name: "1080p MP4", hint: "Plays everywhere", preset: { ...DEFAULT_PRESET, maxHeight: 1080, container: "mp4" } },
  { name: "720p MP4", hint: "Smaller files", preset: { ...DEFAULT_PRESET, maxHeight: 720, container: "mp4" } },
  { name: "MP3 audio", hint: "Best VBR MP3", preset: { ...DEFAULT_PRESET, mode: "audio", audioFormat: "mp3", audioQuality: "0" } },
  { name: "M4A audio", hint: "Original AAC, no re-encode", preset: { ...DEFAULT_PRESET, mode: "audio", audioFormat: "m4a" } },
];

export function presetEquals(a: Preset, b: Preset): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function describePreset(p: Preset): string {
  if (p.mode === "audio") {
    const fmt = p.audioFormat === "best" ? "original audio" : p.audioFormat.toUpperCase();
    const q = lossy(p.audioFormat) && p.audioQuality !== "0" ? ` ${p.audioQuality.replace("K", " kbps")}` : "";
    return `Audio · ${fmt}${q}`;
  }
  const res = p.maxHeight ? `≤${p.maxHeight}p` : "best";
  return `${p.mode === "av" ? "Video+audio" : "Video only"} · ${res} · ${p.container.toUpperCase()}`;
}

const lossy = (f: AudioFormat) => f === "mp3" || f === "m4a" || f === "opus";

/** Remove characters that are illegal in file names or special in yt-dlp templates. */
export function safeName(s: string): string {
  return s.replace(/[<>:"/\\|?*%\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").trim().slice(0, 120) || "untitled";
}

export interface OutputOptions {
  outputDir: string;
  /** e.g. playlist title → files go into <outputDir>/<subfolder>/ */
  subfolder?: string | null;
  /** 1-based position, prefixed as "001 - " */
  index?: number | null;
}

export function buildArgs(p: Preset, out: OutputOptions): string[] {
  const a: string[] = [];

  if (p.mode === "audio") {
    a.push("-f", p.audioFormat === "m4a" ? "ba[ext=m4a]/ba/b" : "ba/b", "-x");
    if (p.audioFormat !== "best") a.push("--audio-format", p.audioFormat);
    if (lossy(p.audioFormat)) a.push("--audio-quality", p.audioQuality || "0");
  } else {
    a.push("-f", p.mode === "av" ? "bv*+ba/b" : "bv/bv*");
    const sort: string[] = [];
    if (p.maxHeight) sort.push(`res:${p.maxHeight}`);
    if (p.container === "mp4") sort.push("ext:mp4:m4a");
    else if (p.container === "webm") sort.push("ext:webm:webm");
    if (sort.length) a.push("-S", sort.join(","));
    if (p.mode === "av") a.push("--merge-output-format", p.container);
    else a.push("--remux-video", p.container);
    if (p.embedSubs && p.mode === "av") a.push("--write-subs", "--sub-langs", p.subLangs || "en.*", "--embed-subs");
  }

  const thumbOk = p.mode === "audio" ? p.audioFormat !== "wav" : p.container !== "webm";
  if (p.embedThumbnail && thumbOk) a.push("--embed-thumbnail");
  if (p.embedMetadata) a.push("--embed-metadata", "--embed-chapters");
  if (p.sponsorBlock) a.push("--sponsorblock-remove", "sponsor");

  a.push("--no-mtime", "-P", out.outputDir);
  const folder = out.subfolder ? `${safeName(out.subfolder)}/` : "";
  const prefix = out.index ? `${String(out.index).padStart(3, "0")} - ` : "";
  a.push("-o", `${folder}${prefix}%(title)s [%(id)s].%(ext)s`);
  return a;
}
