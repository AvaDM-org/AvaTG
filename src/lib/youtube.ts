// Classifies links and turns yt-dlp JSON into the small models the UI needs.
import { ytdlpJson } from "../ipc";

// yt-dlp's JSON is large and loosely shaped; it is read defensively here and nowhere else.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export interface SubtitleLang {
  code: string;
  name: string;
  /** YouTube's machine captions */
  auto: boolean;
}

export interface Entry {
  id: string;
  title: string;
  url: string;
  duration: number | null;
  thumbnail: string | null;
  channel: string | null;
  /** "video" or "playlist" (channel playlists tab) */
  kind: "video" | "playlist";
  count?: number | null;
}

export interface HeightOption {
  height: number;
  fps: number | null;
  /** best video size at this height + best audio size, bytes (estimate) */
  size: number | null;
}

export interface VideoInfo {
  type: "video";
  id: string;
  title: string;
  url: string;
  channel: string | null;
  duration: number | null;
  thumbnail: string | null;
  heights: HeightOption[];
  audioSize: number | null;
  audioAbr: number | null;
  /** real subtitles first, then auto-generated captions */
  subtitles: SubtitleLang[];
  /** set when a watch URL also carried &list= */
  playlistUrl: string | null;
}

export interface PlaylistInfo {
  type: "playlist";
  id: string;
  title: string;
  channel: string | null;
  entries: Entry[];
}

export interface ChannelInfo {
  type: "channel";
  title: string;
  videos: Entry[];
  shorts: Entry[];
  playlists: Entry[];
}

export type Analysis = VideoInfo | PlaylistInfo | ChannelInfo;

const CHANNEL_RE = /^\/(@[^/]+|channel\/[^/]+|c\/[^/]+|user\/[^/]+)(\/.*)?$/;

export type LinkKind =
  | { kind: "channel"; base: string }
  | { kind: "playlist"; url: string }
  | { kind: "video"; url: string; playlistUrl: string | null };

export function classify(raw: string): LinkKind {
  let u: URL;
  try {
    u = new URL(raw.trim().match(/^https?:\/\//) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return { kind: "video", url: raw.trim(), playlistUrl: null };
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  if (host === "youtube.com") {
    const list = u.searchParams.get("list");
    if (u.pathname === "/playlist" && list) {
      return { kind: "playlist", url: `https://www.youtube.com/playlist?list=${list}` };
    }
    const m = u.pathname.match(CHANNEL_RE);
    if (m) return { kind: "channel", base: `https://www.youtube.com/${m[1]}` };
    if (u.pathname === "/watch" && list) {
      return {
        kind: "video",
        url: `https://www.youtube.com/watch?v=${u.searchParams.get("v")}`,
        playlistUrl: `https://www.youtube.com/playlist?list=${list}`,
      };
    }
  }
  return { kind: "video", url: u.toString(), playlistUrl: null };
}

function thumbFor(id: string, e: Json): string | null {
  if (/^[\w-]{11}$/.test(id)) return `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  const t = e.thumbnails;
  if (Array.isArray(t) && t.length) return t[Math.min(t.length - 1, 3)].url ?? null;
  return e.thumbnail ?? null;
}

function toEntry(e: Json, fallbackChannel: string | null): Entry {
  const isPlaylist = e.ie_key === "YoutubeTab" || e._type === "playlist" || String(e.url ?? "").includes("list=");
  const id = String(e.id ?? "");
  return {
    id,
    title: e.title ?? id,
    url: e.url ?? e.webpage_url ?? `https://www.youtube.com/watch?v=${id}`,
    duration: typeof e.duration === "number" ? e.duration : null,
    thumbnail: isPlaylist ? (e.thumbnails?.at?.(-1)?.url ?? null) : thumbFor(id, e),
    channel: e.channel ?? e.uploader ?? fallbackChannel,
    kind: isPlaylist ? "playlist" : "video",
    count: e.playlist_count ?? null,
  };
}

function parseVideo(j: Json, playlistUrl: string | null): VideoInfo {
  const formats: Json[] = j.formats ?? [];
  const size = (f: Json): number | null => f.filesize ?? f.filesize_approx ?? null;
  const audio = formats.filter((f) => f.vcodec === "none" && f.acodec && f.acodec !== "none");
  const bestAudio = audio.reduce<Json>((b, f) => ((f.abr ?? 0) > (b?.abr ?? 0) ? f : b), null);
  const byHeight = new Map<number, HeightOption>();
  for (const f of formats) {
    if (!f.height || !f.vcodec || f.vcodec === "none") continue;
    const cur = byHeight.get(f.height) ?? { height: f.height, fps: null, size: null };
    cur.fps = Math.max(cur.fps ?? 0, f.fps ?? 0) || null;
    const s = size(f);
    if (s && s > (cur.size ?? 0)) cur.size = s;
    byHeight.set(f.height, cur);
  }
  const aSize = bestAudio ? size(bestAudio) : null;
  const heights = [...byHeight.values()]
    .map((h) => ({ ...h, size: h.size != null && aSize != null ? h.size + aSize : h.size }))
    .sort((a, b) => b.height - a.height);
  return {
    type: "video",
    id: j.id,
    title: j.title ?? j.id,
    url: j.webpage_url ?? j.original_url,
    channel: j.channel ?? j.uploader ?? null,
    duration: j.duration ?? null,
    thumbnail: j.thumbnail ?? null,
    heights,
    audioSize: aSize,
    audioAbr: bestAudio?.abr ?? null,
    subtitles: subtitleLangs(j),
    playlistUrl,
  };
}

function subtitleLangs(j: Json): SubtitleLang[] {
  const list = (obj: Json, auto: boolean): SubtitleLang[] =>
    Object.entries(obj ?? {})
      .filter(([code]) => code !== "live_chat")
      .map(([code, tracks]) => ({ code, auto, name: (tracks as Json[])?.[0]?.name ?? code }));
  const real = list(j.subtitles, false);
  const have = new Set(real.map((l) => l.code));
  // Auto captions exist for every translation target; keep only the original-language ones ("-orig") and English.
  const auto = list(j.automatic_captions, true).filter(
    (l) => !have.has(l.code) && (l.code.endsWith("-orig") || l.code === "en"),
  );
  return [...real, ...auto];
}

export function parsePlaylist(j: Json): PlaylistInfo {
  const channel = j.channel ?? j.uploader ?? null;
  return {
    type: "playlist",
    id: j.id,
    title: j.title ?? j.id,
    channel,
    entries: (j.entries ?? []).filter(Boolean).map((e: Json) => toEntry(e, channel)),
  };
}

async function tab(url: string, cookies: string): Promise<{ title: string | null; entries: Entry[] }> {
  try {
    const j: Json = await ytdlpJson(url, true, cookies);
    const channel = j.channel ?? j.uploader ?? null;
    return {
      title: channel,
      entries: (j.entries ?? []).filter(Boolean).map((e: Json) => toEntry(e, channel)),
    };
  } catch {
    return { title: null, entries: [] }; // e.g. channel without a Shorts tab
  }
}

export async function analyze(raw: string, cookies: string): Promise<Analysis> {
  const link = classify(raw);
  if (link.kind === "channel") {
    const [videos, shorts, playlists] = await Promise.all([
      tab(`${link.base}/videos`, cookies),
      tab(`${link.base}/shorts`, cookies),
      tab(`${link.base}/playlists`, cookies),
    ]);
    if (!videos.entries.length && !shorts.entries.length && !playlists.entries.length) {
      // surface the real error
      await ytdlpJson(`${link.base}/videos`, true, cookies);
    }
    return {
      type: "channel",
      title: videos.title ?? shorts.title ?? playlists.title ?? link.base,
      videos: videos.entries,
      shorts: shorts.entries,
      playlists: playlists.entries.map((e) => ({ ...e, kind: "playlist" as const })),
    };
  }
  if (link.kind === "playlist") return parsePlaylist((await ytdlpJson(link.url, true, cookies)) as Json);

  // Unknown or video link: a flat query first tells us if a non-YouTube link is a playlist.
  const j: Json = await ytdlpJson(link.url, false, cookies);
  if (j._type === "playlist") return parsePlaylist(j);
  return parseVideo(j, link.playlistUrl);
}

/** Entries of one playlist (used when queueing playlists picked from a channel). */
export async function playlistEntries(url: string, cookies: string): Promise<PlaylistInfo> {
  return parsePlaylist((await ytdlpJson(url, true, cookies)) as Json);
}
