import { describe, expect, it } from "vitest";
import {
  buildArgs,
  DEFAULT_PRESET,
  formatLabel,
  matchingQuickPreset,
  type DownloadOptions,
  type Preset,
} from "./presets";

const opts: DownloadOptions = {
  subtitleMode: "embed",
  autoCaptions: false,
  fragments: 4,
  limitMbps: null,
  retries: 10,
  socketTimeout: 20,
};
const out = { outputDir: "/videos" };
const after = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe("buildArgs", () => {
  it("1080p MP4: sorts by resolution, H.264 and mp4, merges into mp4", () => {
    const a = buildArgs(DEFAULT_PRESET, out, opts);
    expect(after(a, "-f")).toBe("bv*+ba/b");
    expect(after(a, "-S")).toBe("res:1080,vcodec:h264,ext:mp4:m4a");
    expect(after(a, "--merge-output-format")).toBe("mp4");
    expect(after(a, "-o")).toBe("%(title)s.%(ext)s");
    expect(a).not.toContain("--limit-rate");
  });

  it("keeps unfinished files in the download's working folder", () => {
    const a = buildArgs(DEFAULT_PRESET, { outputDir: "/v", partsDir: "/v/.tubegrab-parts/d1" }, opts);
    expect(a).toContain("temp:/v/.tubegrab-parts/d1");
  });

  it("MP3: extracts audio at best VBR", () => {
    const a = buildArgs({ ...DEFAULT_PRESET, mode: "audio", audioFormat: "mp3" }, out, opts);
    expect(a.slice(0, 3)).toEqual(["-f", "ba/b", "-x"]);
    expect(after(a, "--audio-format")).toBe("mp3");
    expect(after(a, "--audio-quality")).toBe("0");
  });

  it("subtitles embedded only: written, embedded, then deleted", () => {
    const p: Preset = { ...DEFAULT_PRESET, subtitles: true, subLangs: ["en", "de"] };
    const a = buildArgs(p, out, { ...opts, autoCaptions: true });
    expect(after(a, "--sub-langs")).toBe("en,de");
    expect(a).toEqual(expect.arrayContaining(["--write-subs", "--write-auto-subs", "--embed-subs"]));
    expect(after(a, "--compat-options")).toBe("no-keep-subs");
    expect(a).not.toContain("--convert-subs");
  });

  it("subtitles as separate files: srt, not embedded", () => {
    const a = buildArgs({ ...DEFAULT_PRESET, subtitles: true }, out, { ...opts, subtitleMode: "separate" });
    expect(after(a, "--convert-subs")).toBe("srt");
    expect(a).not.toContain("--embed-subs");
  });

  it("description, speed limit and playlist numbering", () => {
    const a = buildArgs(
      { ...DEFAULT_PRESET, description: true },
      { outputDir: "/v", subfolder: "My: List", index: 7 },
      {
        ...opts,
        limitMbps: 5,
      },
    );
    expect(a).toContain("--write-description");
    expect(after(a, "--limit-rate")).toBe("5M");
    expect(after(a, "-o")).toBe("My_ List/007 - %(title)s.%(ext)s");
  });
});

describe("labels", () => {
  it("formats the Format column", () => {
    expect(formatLabel(DEFAULT_PRESET)).toBe("MP4 · 1080p");
    expect(formatLabel({ ...DEFAULT_PRESET, maxHeight: null, container: "mkv" })).toBe("MKV · Best");
    expect(formatLabel({ ...DEFAULT_PRESET, mode: "audio", audioFormat: "mp3", audioQuality: "320K" })).toBe(
      "MP3 · 320 kbps",
    );
  });

  it("recognises quick presets", () => {
    expect(matchingQuickPreset(DEFAULT_PRESET)).toBe("1080p MP4");
    expect(matchingQuickPreset({ ...DEFAULT_PRESET, mode: "audio", audioFormat: "m4a" })).toBe("M4A audio");
    expect(matchingQuickPreset({ ...DEFAULT_PRESET, maxHeight: 480 })).toBeNull();
  });
});
