import { queueItems } from "../lib/actions";
import { updateSettings, useSettings } from "../lib/settings";
import { fmtDuration, type VideoInfo } from "../lib/youtube";
import { PresetPanel } from "./PresetPanel";

interface Props {
  info: VideoInfo;
  onOpenUrl: (url: string) => void;
  onQueued: () => void;
}

export function VideoView({ info, onOpenUrl, onQueued }: Props) {
  const settings = useSettings();
  const preset = settings.preset;

  return (
    <div className="view video-view">
      {info.playlistUrl && (
        <div className="banner">
          This video is part of a playlist.
          <button className="link" onClick={() => onOpenUrl(info.playlistUrl!)}>
            Show the whole playlist
          </button>
        </div>
      )}
      <div className="video-head">
        {info.thumbnail && <img className="poster" src={info.thumbnail} alt="" />}
        <div>
          <h2>{info.title}</h2>
          <p className="muted">
            {[info.channel, fmtDuration(info.duration)].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <PresetPanel
        value={preset}
        onChange={(p) => updateSettings({ preset: p })}
        heights={info.heights}
        audioSize={info.audioSize}
      />
      <div className="actions">
        <button
          className="primary big"
          onClick={() => {
            queueItems([{ url: info.url, title: info.title }], preset);
            onQueued();
          }}
        >
          Download
        </button>
      </div>
    </div>
  );
}
