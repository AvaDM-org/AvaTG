// The format choices shared by the video dialog and the playlist/channel side panel.
import { Button, Chip, Field, Segmented } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, MenuItem, MenuTitle } from "../../components/ui/Menu";
import { fmtBytes } from "../../lib/format";
import {
  matchingQuickPreset,
  QUICK_PRESETS,
  STANDARD_HEIGHTS,
  type AudioFormat,
  type Mode,
  type Preset,
  type VideoContainer,
} from "../../lib/presets";
import type { HeightOption, SubtitleLang } from "../../lib/youtube";
import s from "./picker.module.css";

const AUDIO_FORMATS: { value: AudioFormat; label: string }[] = [
  { value: "mp3", label: "MP3" },
  { value: "m4a", label: "M4A" },
  { value: "opus", label: "Opus" },
  { value: "flac", label: "FLAC" },
  { value: "best", label: "Original" },
];
const BITRATES = [
  { value: "0", label: "Best" },
  { value: "320K", label: "320 kbps" },
  { value: "192K", label: "192 kbps" },
  { value: "128K", label: "128 kbps" },
];
const CONTAINERS: { value: VideoContainer; label: string }[] = [
  { value: "mp4", label: "MP4" },
  { value: "mkv", label: "MKV" },
  { value: "webm", label: "WebM" },
];

/** Common subtitle languages offered for playlists and channels, where the real list is not known. */
const COMMON_LANGS: SubtitleLang[] = [
  ["en", "English"],
  ["de", "German"],
  ["fr", "French"],
  ["es", "Spanish"],
  ["it", "Italian"],
  ["pt", "Portuguese"],
  ["ru", "Russian"],
  ["fa", "Persian"],
  ["ar", "Arabic"],
  ["tr", "Turkish"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh-Hans", "Chinese"],
].map(([code, name]) => ({ code, name, auto: false }));

export function PresetMenu({ preset, onChange }: { preset: Preset; onChange: (p: Preset) => void }) {
  const current = matchingQuickPreset(preset) ?? "Custom";
  return (
    <Dropdown
      label="Presets"
      width={220}
      trigger={({ toggle }) => (
        <Button small onClick={toggle} aria-haspopup="menu">
          <span style={{ color: "var(--fg3)" }}>Preset</span>
          <b>{current}</b>
          <Icon name="chevronDown" size={13} />
        </Button>
      )}
    >
      {(close) =>
        QUICK_PRESETS.map((q) => (
          <MenuItem
            key={q.name}
            checked={q.name === current}
            hint={q.hint}
            onSelect={() => {
              onChange({ ...preset, ...q.patch });
              close();
            }}
          >
            {q.name}
          </MenuItem>
        ))
      }
    </Dropdown>
  );
}

export function FormatOptions({
  preset,
  onChange,
  heights,
  subtitles,
  compact,
}: {
  preset: Preset;
  onChange: (p: Preset) => void;
  /** a single video's real resolutions; omitted for playlists and channels */
  heights?: HeightOption[];
  /** a single video's subtitle languages */
  subtitles?: SubtitleLang[];
  /** narrow side panel */
  compact?: boolean;
}) {
  const p = preset;
  const set = (patch: Partial<Preset>) => onChange({ ...p, ...patch });
  const modes: { value: Mode; label: string }[] = [
    { value: "av", label: compact ? "Video" : "Video and audio" },
    { value: "video", label: "Video only" },
    { value: "audio", label: "Audio only" },
  ];
  const langs = subtitles ?? COMMON_LANGS;

  return (
    <>
      <Field label="Download">
        <Segmented label="Download" options={modes} value={p.mode} onChange={(mode) => set({ mode })} />
      </Field>

      {p.mode !== "audio" ? (
        <>
          {heights?.length ? (
            <Field label="Quality" hint="Sizes are estimates">
              <div className={s.tiles}>
                <QualityTile
                  on={p.maxHeight === null}
                  label="Best"
                  sub={heights[0] ? `${heights[0].height}p` : ""}
                  onClick={() => set({ maxHeight: null })}
                />
                {heights
                  .filter((h) => h.height >= 144)
                  .slice(0, 7)
                  .map((h) => (
                    <QualityTile
                      key={h.height}
                      on={p.maxHeight === h.height}
                      label={`${h.height}p${h.fps && h.fps > 30 ? Math.round(h.fps) : ""}`}
                      sub={h.size ? `~${fmtBytes(h.size)}` : ""}
                      onClick={() => set({ maxHeight: h.height })}
                    />
                  ))}
              </div>
            </Field>
          ) : (
            <Field label="Quality">
              <Dropdown
                label="Quality"
                width={240}
                trigger={({ toggle }) => (
                  <button type="button" className={s.select} onClick={toggle}>
                    <b>{p.maxHeight ? `Up to ${p.maxHeight}p` : "Best available"}</b>
                    <span>{p.maxHeight ? "lower if missing" : ""}</span>
                    <Icon name="chevronDown" size={14} />
                  </button>
                )}
              >
                {(close) =>
                  [null, ...STANDARD_HEIGHTS].map((h) => (
                    <MenuItem
                      key={String(h)}
                      checked={p.maxHeight === h}
                      onSelect={() => {
                        set({ maxHeight: h });
                        close();
                      }}
                    >
                      {h ? `Up to ${h}p` : "Best available"}
                    </MenuItem>
                  ))
                }
              </Dropdown>
            </Field>
          )}
          <Field
            label="Format"
            hint={compact ? undefined : p.container === "mp4" ? "MP4 plays on almost everything" : undefined}
          >
            <Segmented
              label="Format"
              options={CONTAINERS}
              value={p.container}
              onChange={(container) => set({ container })}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label="Format">
            <Segmented
              label="Audio format"
              options={AUDIO_FORMATS}
              value={p.audioFormat}
              onChange={(audioFormat) => set({ audioFormat })}
            />
          </Field>
          {(p.audioFormat === "mp3" || p.audioFormat === "opus") && (
            <Field label="Bitrate">
              <Segmented
                label="Bitrate"
                options={BITRATES}
                value={p.audioQuality}
                onChange={(audioQuality) => set({ audioQuality })}
              />
            </Field>
          )}
        </>
      )}

      <Field
        label="Include"
        hint={p.description && !compact ? "Description saved as a .txt next to the video" : undefined}
      >
        <div className={s.chips}>
          {p.mode !== "audio" && (
            <span className={s.subChip} data-on={p.subtitles || undefined}>
              <Chip on={p.subtitles} onClick={() => set({ subtitles: !p.subtitles })}>
                Subtitles
              </Chip>
              {p.subtitles && (
                <LanguageMenu langs={langs} selected={p.subLangs} onChange={(subLangs) => set({ subLangs })} />
              )}
            </span>
          )}
          <Chip on={p.description} onClick={() => set({ description: !p.description })}>
            Description
          </Chip>
          <Chip on={p.thumbnail} onClick={() => set({ thumbnail: !p.thumbnail })}>
            Thumbnail
          </Chip>
          <Chip on={p.chapters} onClick={() => set({ chapters: !p.chapters })}>
            Chapters
          </Chip>
          <Chip on={p.sponsorBlock} onClick={() => set({ sponsorBlock: !p.sponsorBlock })}>
            Cut sponsors
          </Chip>
        </div>
      </Field>
    </>
  );
}

function QualityTile({ on, label, sub, onClick }: { on: boolean; label: string; sub: string; onClick: () => void }) {
  return (
    <button type="button" className={s.tile} aria-pressed={on} onClick={onClick}>
      <span>{label}</span>
      <small>{sub}</small>
    </button>
  );
}

function LanguageMenu({
  langs,
  selected,
  onChange,
}: {
  langs: SubtitleLang[];
  selected: string[];
  onChange: (codes: string[]) => void;
}) {
  const names = selected.map((c) => langs.find((l) => l.code === c)?.name ?? c);
  const toggle = (code: string) =>
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  return (
    <Dropdown
      label="Subtitle languages"
      width={260}
      trigger={({ toggle: open }) => (
        <button type="button" className={s.langButton} onClick={open} aria-label="Subtitle languages">
          {names.length ? names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "") : "Choose"}
          <Icon name="chevronDown" size={12} />
        </button>
      )}
    >
      {() => (
        <>
          <MenuTitle>SUBTITLES</MenuTitle>
          {langs.length === 0 && (
            <MenuItem onSelect={() => {}} disabled>
              This video has no subtitles
            </MenuItem>
          )}
          {langs.map((l) => (
            <MenuItem
              key={l.code + l.auto}
              checked={selected.includes(l.code)}
              hint={l.auto ? "auto" : undefined}
              onSelect={() => toggle(l.code)}
            >
              {l.name}
            </MenuItem>
          ))}
        </>
      )}
    </Dropdown>
  );
}
