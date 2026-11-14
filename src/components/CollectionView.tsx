// Playlist and channel views: pick entries on the left, preset on the right.
import { useMemo, useState } from "react";
import { queueItems, queuePlaylists } from "../lib/actions";
import { updateSettings, useSettings } from "../lib/settings";
import type { ChannelInfo, Entry, PlaylistInfo } from "../lib/youtube";
import { EntryList } from "./EntryList";
import { PresetPanel } from "./PresetPanel";

interface Props {
  info: PlaylistInfo | ChannelInfo;
  onQueued: () => void;
}

type TabId = "videos" | "shorts" | "playlists";

export function CollectionView({ info, onQueued }: Props) {
  const settings = useSettings();
  const isChannel = info.type === "channel";

  const tabs = useMemo(() => {
    if (info.type === "playlist") return [{ id: "videos" as TabId, label: "Videos", entries: info.entries }];
    return (
      [
        { id: "videos" as TabId, label: "Videos", entries: info.videos },
        { id: "shorts" as TabId, label: "Shorts", entries: info.shorts },
        { id: "playlists" as TabId, label: "Playlists", entries: info.playlists },
      ] as const
    ).filter((t) => t.entries.length > 0);
  }, [info]);

  const [tab, setTab] = useState<TabId>(tabs[0]?.id ?? "videos");
  // Playlists start with nothing selected; a playlist starts with everything selected.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(info.type === "playlist" ? info.entries.map((e) => e.id) : []),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  const all: Entry[] = tabs.flatMap((t) => t.entries);
  const picked = all.filter((e) => selected.has(e.id));
  const pickedVideos = picked.filter((e) => e.kind === "video");
  const pickedPlaylists = picked.filter((e) => e.kind === "playlist");

  const download = async () => {
    setError(null);
    const preset = settings.preset;
    const folder = settings.playlistSubfolder ? info.title : null;
    if (pickedVideos.length) {
      const order = new Map(all.map((e, i) => [e.id, i + 1]));
      queueItems(
        pickedVideos.map((e) => ({
          url: e.url,
          title: e.title,
          subfolder: folder,
          index: !isChannel && settings.numberFiles ? order.get(e.id) : null,
        })),
        preset,
      );
    }
    if (pickedPlaylists.length) {
      setBusy(`Reading playlists 0/${pickedPlaylists.length}…`);
      try {
        await queuePlaylists(pickedPlaylists, preset, (n) =>
          setBusy(`Reading playlists ${n}/${pickedPlaylists.length}…`),
        );
      } catch (e) {
        setError(String(e));
      }
      setBusy(null);
    }
    onQueued();
  };

  const summary = [
    pickedVideos.length ? `${pickedVideos.length} video${pickedVideos.length > 1 ? "s" : ""}` : "",
    pickedPlaylists.length ? `${pickedPlaylists.length} playlist${pickedPlaylists.length > 1 ? "s" : ""}` : "",
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <div className="view collection-view">
      <div className="collection-main">
        <div className="collection-head">
          <h2>{info.title}</h2>
          <span className="muted">{isChannel ? "Channel" : `Playlist · ${info.type === "playlist" && info.channel ? info.channel : ""}`}</span>
        </div>
        {tabs.length > 1 && (
          <div className="tabs">
            {tabs.map((t) => {
              const n = t.entries.filter((e) => selected.has(e.id)).length;
              return (
                <button key={t.id} className={t.id === current?.id ? "active" : ""} onClick={() => setTab(t.id)}>
                  {t.label} <span className="muted">({t.entries.length})</span>
                  {n > 0 && <span className="badge">{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        {current ? (
          <EntryList key={current.id} entries={current.entries} selected={selected} onSelectedChange={setSelected} />
        ) : (
          <div className="empty muted">No videos found.</div>
        )}
      </div>

      <aside className="collection-side">
        <PresetPanel value={settings.preset} onChange={(p) => updateSettings({ preset: p })} />
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.playlistSubfolder}
              onChange={(e) => updateSettings({ playlistSubfolder: e.target.checked })}
            />
            Save into a folder named after the {isChannel ? "channel / playlist" : "playlist"}
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={settings.numberFiles}
              onChange={(e) => updateSettings({ numberFiles: e.target.checked })}
            />
            Number files in playlist order
          </label>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="primary big" disabled={!picked.length || !!busy} onClick={download}>
          {busy ?? (picked.length ? `Download ${summary}` : "Select something to download")}
        </button>
      </aside>
    </div>
  );
}
