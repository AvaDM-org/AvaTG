// Dev-only demo mode: the frontend runs in a normal browser (`bun run dev`, open http://127.0.0.1:1420/?demo)
// with every Rust command mocked. Nothing touches the disk, the network or the real database.
// URL options: `many=N` adds N finished rows; `empty` starts with no downloads; `setup` shows the tools screen.
// Loaded only from main.tsx behind `import.meta.env.DEV`, so release builds never contain it.
import { emit } from "@tauri-apps/api/event";
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { DownloadEvent, ToolInfo } from "../ipc";
import { DEFAULT_PRESET, formatLabel, type Preset } from "../lib/presets";
import type { DownloadRecord, DownloadStatus } from "../features/downloads/types";

const params = new URLSearchParams(location.search);
const HOME = "/home/demo";
const VIDEOS = `${HOME}/Videos`;
const HOUR = 3_600_000;

/** A coloured placeholder thumbnail, so the demo needs no network. */
function thumb(i: number): string {
  const hue = (i * 47) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue} 60% 45%)"/><stop offset="1" stop-color="hsl(${(hue + 60) % 360} 50% 20%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const TITLES = [
  "Building a tiny synthesizer from scratch",
  "The surprising physics of bicycles",
  "Lo-fi beats to download videos to",
  "How container ships actually find their way",
  "A very long title that keeps going so the name column has to cut it off somewhere near the end · Part 12",
  "Why every map you know is wrong",
  "Cooking with a cast-iron pan, the complete guide",
  "Live session: the quiet album",
];
const CHANNELS = ["Sound Lab", "Minute Science", "Chill Radio", "Real Engineering", "Long Talks", "Map Men"];

let seq = 0;
function record(status: DownloadStatus, patch: Partial<DownloadRecord> = {}, preset: Preset = DEFAULT_PRESET) {
  const i = seq++;
  const audioOnly = preset.mode === "audio";
  const title = TITLES[i % TITLES.length];
  const ext = audioOnly ? preset.audioFormat : preset.container;
  const done = status === "done";
  const base: DownloadRecord = {
    id: `demo${i}`,
    createdAt: Date.now() - (i + 1) * 5 * HOUR,
    url: `https://www.youtube.com/watch?v=demo${String(i).padStart(7, "0")}`,
    title,
    channel: CHANNELS[i % CHANNELS.length],
    duration: 120 + ((i * 397) % 3600),
    thumbnail: thumb(i),
    audioOnly,
    formatLabel: formatLabel(preset),
    preset,
    outputDir: VIDEOS,
    folder: null,
    index: null,
    dir: VIDEOS,
    saveDescription: false,
    status,
    percent: done ? 100 : status === "paused" || status === "interrupted" ? 42 : null,
    sizeBytes: 40_000_000 + ((i * 7_919_003) % 900_000_000),
    filepath: done ? `${VIDEOS}/${title}.${ext}` : null,
    error: status === "failed" ? "ERROR: [youtube] demo: Video unavailable. This video is private" : null,
    autoRetries: 0,
    ...(done
      ? { finishedAt: Date.now() - i * 4 * HOUR, activeMs: 95_000 + i * 1000, transferMs: 80_000 + i * 1000 }
      : {}),
  };
  return { ...base, ...patch };
}

function initialRecords(): DownloadRecord[] {
  if (params.has("empty")) return [];
  const mp3: Preset = { ...DEFAULT_PRESET, mode: "audio", audioFormat: "mp3" };
  const list = [
    record("queued", { status: "queued" }), // started by the queue on load (resume on launch)
    record("paused"),
    record("interrupted"),
    record("queued", { autoRetries: 1, error: "ERROR: unable to download video data: HTTP Error 503" }),
    record("failed"),
    record("cancelled", { sizeBytes: null }),
    record("done", {}, mp3),
    record("done", { folder: "Demo playlist", dir: `${VIDEOS}/Demo playlist`, index: 3 }),
  ];
  const many = Number(params.get("many") ?? 0);
  for (let n = 0; n < many; n++) list.push(record("done", {}, n % 3 ? DEFAULT_PRESET : mp3));
  return list;
}

const db = new Map<string, unknown>(initialRecords().map((r) => [r.id, r]));
const settings: Record<string, unknown> = {};

// Fake yt-dlp runs: progress events every 400 ms, then the post-processors, then the file.
const runs = new Map<string, { timer: number; reject: (e: string) => void }>();

function fakeRun(id: string): Promise<string | null> {
  const rec = db.get(id) as DownloadRecord | undefined;
  const total = rec?.sizeBytes ?? 120_000_000;
  const parts = rec?.audioOnly ? 1 : 2;
  let part = 0;
  let done = 0;
  return new Promise((resolve, reject) => {
    const send = (ev: Omit<DownloadEvent, "id">) => void emit("download-progress", { id, ...ev });
    const log = (message: string, level: DownloadEvent["level"] = "info") => send({ kind: "log", message, level });
    log(`[youtube] Extracting URL: ${rec?.url}`);
    log(`[info] ${id}: Downloading 1 format(s): 137+140`);
    if (rec?.title.startsWith("Building"))
      log("WARNING: [youtube] demo: Some formats are missing a URL (demo)", "warning");
    log(`[download] Destination: ${rec?.dir}/${rec?.title}.f137.mp4`);
    const timer = window.setInterval(() => {
      const partTotal = part === 0 ? total * 0.9 : total * 0.1;
      done = Math.min(partTotal, done + partTotal * 0.04);
      const speed = 3_000_000 + Math.random() * 2_000_000;
      send({
        kind: "progress",
        status: "downloading",
        downloaded: done,
        total: partTotal,
        speed,
        eta: (partTotal - done) / speed,
      });
      if (done < partTotal) return;
      send({ kind: "progress", status: "finished" });
      if (++part < parts) {
        done = 0;
        return;
      }
      window.clearInterval(timer);
      runs.delete(id);
      send({ kind: "postprocess", status: "started", postprocessor: "Merger" });
      const file = `${rec?.dir ?? VIDEOS}/${rec?.title ?? id}.mp4`;
      window.setTimeout(() => {
        send({ kind: "file", filepath: file });
        resolve(file);
      }, 1500);
    }, 400);
    runs.set(id, { timer, reject });
  });
}

const tool = (id: ToolInfo["id"], name: string, version: string): ToolInfo => ({
  id,
  name,
  installed: !params.has("setup"),
  version,
  appPath: `${HOME}/.local/share/org.avadm.avatg/bin/${id}`,
  system: null,
});

type Args = Record<string, unknown>;
const handlers: Record<string, (a: Args) => unknown> = {
  tools_status: () => [
    tool("ytdlp", "yt-dlp", "2026.10.26"),
    tool("deno", "Deno", "2.5.6"),
    tool("ffmpeg", "FFmpeg", "7.1"),
  ],
  latest_versions: () => ({ ytdlp: "2026.10.26", deno: "2.5.6" }),
  tool_version: () => null,
  open_bin_dir: () => `${HOME}/.local/share/org.avadm.avatg/bin`,
  downloads_list: () => [...db.values()],
  downloads_save: (a) => (a.records as DownloadRecord[]).forEach((r) => db.set(r.id, r)),
  downloads_delete: (a) => (a.ids as string[]).forEach((id) => db.delete(id)),
  settings_load: () => settings,
  settings_save: (a) => void (settings[a.key as string] = a.value),
  run_download: (a) => fakeRun(a.id as string),
  cancel_download: (a) => {
    const run = runs.get(a.id as string);
    if (!run) return;
    window.clearInterval(run.timer);
    runs.delete(a.id as string);
    run.reject("cancelled");
  },
  ytdlp_json: (a) => fakeVideoJson(String(a.url)),
  file_sizes: (a) => (a.paths as string[]).map(() => 123_456_789),
  window_blur: () => false,
  system_proxy: () => null,
  install_channel: () => "auto",
  update_check: () => null,
  themes_list: () => [],
  themes_folder: () => `${HOME}/.local/share/org.avadm.avatg/themes`,
  "plugin:path|resolve_directory": () => VIDEOS,
  "plugin:autostart|is_enabled": () => false,
  "plugin:clipboard-manager|read_text": () => "https://www.youtube.com/watch?v=jNQXAC9IVRw",
};

function fakeVideoJson(url: string) {
  const f = (height: number, filesize: number) => ({ height, vcodec: "avc1", fps: 30, filesize });
  return {
    id: "jNQXAC9IVRw",
    title: "Me at the zoo (demo)",
    webpage_url: url,
    channel: "jawed",
    duration: 19,
    thumbnail: thumb(99),
    formats: [
      f(1080, 9_000_000),
      f(720, 5_000_000),
      f(360, 1_500_000),
      { vcodec: "none", acodec: "mp4a", abr: 128, filesize: 300_000 },
    ],
    subtitles: { en: [{ name: "English" }] },
    automatic_captions: {},
  };
}

export function installDemo() {
  mockWindows("main");
  mockIPC(
    (cmd, payload) => {
      const h = handlers[cmd];
      if (h) return h((payload ?? {}) as Args);
      // Window, opener and dialog calls have nothing to do in a browser.
      if (!cmd.startsWith("plugin:")) console.debug("[demo] unmocked command", cmd, payload);
      return null;
    },
    { shouldMockEvents: true },
  );
  document.documentElement.dataset.demo = "";
}
