import {
  QUICK_PRESETS,
  STANDARD_HEIGHTS,
  presetEquals,
  type AudioFormat,
  type Mode,
  type Preset,
  type VideoContainer,
} from "../lib/presets";
import { fmtBytes, type HeightOption } from "../lib/youtube";

interface Props {
  value: Preset;
  onChange: (p: Preset) => void;
  /** exact resolutions of a single video (with size estimates); omitted for lists */
  heights?: HeightOption[];
  audioSize?: number | null;
}

const MODES: { id: Mode; label: string }[] = [
  { id: "av", label: "Video + audio" },
  { id: "video", label: "Video only" },
  { id: "audio", label: "Audio only" },
];

const AUDIO_FORMATS: { id: AudioFormat; label: string }[] = [
  { id: "mp3", label: "MP3" },
  { id: "m4a", label: "M4A (AAC)" },
  { id: "opus", label: "Opus" },
  { id: "flac", label: "FLAC" },
  { id: "wav", label: "WAV" },
  { id: "best", label: "Original" },
];

const AUDIO_QUALITIES = [
  { id: "0", label: "Best (VBR)" },
  { id: "320K", label: "320 kbps" },
  { id: "192K", label: "192 kbps" },
  { id: "128K", label: "128 kbps" },
];

export function PresetPanel({ value: p, onChange, heights, audioSize }: Props) {
  const set = (patch: Partial<Preset>) => onChange({ ...p, ...patch });

  const resOptions: { h: number | null; label: string; sub?: string }[] = heights?.length
    ? [
        { h: null, label: "Best", sub: heights[0] ? `${heights[0].height}p` : undefined },
        ...heights
          .filter((h) => h.height >= 144)
          .map((h) => ({
            h: h.height,
            label: `${h.height}p${h.fps && h.fps > 30 ? ` ${Math.round(h.fps)}` : ""}`,
            sub: h.size ? `~${fmtBytes(h.size)}` : undefined,
          })),
      ]
    : [{ h: null, label: "Best" }, ...STANDARD_HEIGHTS.map((h) => ({ h, label: `${h}p`, sub: "or lower" }))];

  return (
    <div className="preset-panel">
      <div className="quick-presets">
        {QUICK_PRESETS.map((q) => (
          <button
            key={q.name}
            className={`chip ${presetEquals(q.preset, p) ? "active" : ""}`}
            title={q.hint}
            onClick={() => onChange(q.preset)}
          >
            {q.name}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Download</label>
        <div className="segmented">
          {MODES.map((m) => (
            <button key={m.id} className={p.mode === m.id ? "active" : ""} onClick={() => set({ mode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {p.mode !== "audio" ? (
        <>
          <div className="field">
            <label>Quality</label>
            <div className="res-grid">
              {resOptions.map((r) => (
                <button
                  key={String(r.h)}
                  className={`res ${p.maxHeight === r.h ? "active" : ""}`}
                  onClick={() => set({ maxHeight: r.h })}
                >
                  <span>{r.label}</span>
                  {r.sub && <small>{r.sub}</small>}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Format</label>
            <div className="segmented">
              {(["mp4", "mkv", "webm"] as VideoContainer[]).map((c) => (
                <button key={c} className={p.container === c ? "active" : ""} onClick={() => set({ container: c })}>
                  {c.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>Format</label>
            <div className="segmented wrap">
              {AUDIO_FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={p.audioFormat === f.id ? "active" : ""}
                  onClick={() => set({ audioFormat: f.id })}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {audioSize ? <small className="muted">Source audio ~{fmtBytes(audioSize)}</small> : null}
          </div>
          {(p.audioFormat === "mp3" || p.audioFormat === "opus" || p.audioFormat === "m4a") && (
            <div className="field">
              <label>Bitrate</label>
              <div className="segmented">
                {AUDIO_QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    className={p.audioQuality === q.id ? "active" : ""}
                    onClick={() => set({ audioQuality: q.id })}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <details className="extras">
        <summary>Extras</summary>
        <label className="check">
          <input type="checkbox" checked={p.embedThumbnail} onChange={(e) => set({ embedThumbnail: e.target.checked })} />
          Embed thumbnail
        </label>
        <label className="check">
          <input type="checkbox" checked={p.embedMetadata} onChange={(e) => set({ embedMetadata: e.target.checked })} />
          Embed metadata &amp; chapters
        </label>
        {p.mode === "av" && (
          <label className="check">
            <input type="checkbox" checked={p.embedSubs} onChange={(e) => set({ embedSubs: e.target.checked })} />
            Embed subtitles
            {p.embedSubs && (
              <input
                className="small-input"
                value={p.subLangs}
                onChange={(e) => set({ subLangs: e.target.value })}
                title="Subtitle languages, e.g. en.*,de"
              />
            )}
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={p.sponsorBlock} onChange={(e) => set({ sponsorBlock: e.target.checked })} />
          Remove sponsor segments (SponsorBlock)
        </label>
      </details>
    </div>
  );
}
