// A playlist, a channel (Videos / Shorts / Playlists tabs) or several pasted links: pick items, then download.
// Selection works like a file manager: click, Shift+click for a range, the tri-state box, All / None / Invert.
import { useEffect, useMemo, useRef, useState } from "react";
import { DragSpace, TopBar } from "../../components/layout";
import { WindowControls } from "../../components/WindowControls";
import { Button, Checkbox, Field, IconButton, Switch, TextField } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { fmtDuration, fmtTotalLength, plural } from "../../lib/format";
import type { ChannelInfo, Entry, PlaylistInfo } from "../../lib/youtube";
import { fromEntry, queuePlaylists, queueVideos } from "../downloads/enqueue";
import { chooseFolder } from "../settings/chooseFolder";
import { useSettings } from "../settings/store";
import { FormatOptions, PresetMenu } from "./FormatOptions";
import { usePicker } from "./store";
import s from "./picker.module.css";

type TabId = "videos" | "shorts" | "playlists";

const UNAVAILABLE = /^\[(private|deleted) video\]$/i;
const isUnavailable = (e: Entry) => UNAVAILABLE.test(e.title);

export function CollectionPage({ info, statusBar }: { info: PlaylistInfo | ChannelInfo; statusBar: React.ReactNode }) {
  const { settings, set } = useSettings();
  const close = usePicker((st) => st.close);
  const isChannel = info.type === "channel";

  const tabs = useMemo(() => {
    if (info.type === "playlist") return [{ id: "videos" as TabId, label: "Videos", entries: info.entries }];
    const all = [
      { id: "videos" as TabId, label: "Videos", entries: info.videos },
      { id: "shorts" as TabId, label: "Shorts", entries: info.shorts },
      { id: "playlists" as TabId, label: "Playlists", entries: info.playlists },
    ];
    return all.filter((t) => t.entries.length > 0);
  }, [info]);

  const [tabId, setTabId] = useState<TabId>(tabs[0]?.id ?? "videos");
  // A playlist starts with everything available selected; a channel starts empty.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(info.type === "playlist" ? info.entries.filter((e) => !isUnavailable(e)).map((e) => e.id) : []),
  );
  const [filter, setFilter] = useState("");
  const [preset, setPreset] = useState(settings.preset);
  const [dir, setDir] = useState(settings.outputDir);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastClicked = useRef<number | null>(null);

  // Esc goes back to the downloads list (unless a menu or text field has it).
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement).closest("input, [role=menu]") && !busy) close();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close, busy]);

  const tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
  const entries = useMemo(() => tab?.entries ?? [], [tab]);
  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? entries.filter((e) => e.title.toLowerCase().includes(f)) : entries;
  }, [entries, filter]);
  const position = useMemo(() => new Map(entries.map((e, i) => [e.id, i + 1])), [entries]);

  const allEntries = tabs.flatMap((t) => t.entries);
  const picked = allEntries.filter((e) => selected.has(e.id));
  const pickedVideos = picked.filter((e) => e.kind === "video");
  const pickedPlaylists = picked.filter((e) => e.kind === "playlist");
  const selectable = visible.filter((e) => !isUnavailable(e));
  const visibleSelected = selectable.filter((e) => selected.has(e.id)).length;

  const setMany = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  };

  const onRowClick = (i: number, shift: boolean) => {
    const e = visible[i];
    if (isUnavailable(e)) return;
    const target = !selected.has(e.id);
    if (shift && lastClicked.current != null) {
      const [a, b] = [Math.min(lastClicked.current, i), Math.max(lastClicked.current, i)];
      setMany(
        visible
          .slice(a, b + 1)
          .filter((x) => !isUnavailable(x))
          .map((x) => x.id),
        target,
      );
    } else {
      setMany([e.id], target);
    }
    lastClicked.current = i;
  };

  const download = async () => {
    setError(null);
    set("preset", preset);
    const folder = settings.playlistFolder && info.type === "playlist" && info.id ? info.title : null;
    if (pickedVideos.length) {
      queueVideos(pickedVideos.map(fromEntry), preset, {
        outputDir: dir,
        folder,
        positions: settings.numberFiles && !isChannel ? pickedVideos.map((e) => position.get(e.id) ?? 0) : undefined,
      });
    }
    if (pickedPlaylists.length) {
      setBusy(`Reading playlists 0 of ${pickedPlaylists.length}…`);
      try {
        await queuePlaylists(pickedPlaylists, preset, dir, (n) =>
          setBusy(`Reading playlists ${n} of ${pickedPlaylists.length}…`),
        );
      } catch (e) {
        setError(String(e));
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    close();
  };

  const parts = [
    pickedVideos.length ? plural(pickedVideos.length, "video") : "",
    pickedPlaylists.length ? plural(pickedPlaylists.length, "playlist") : "",
  ].filter(Boolean);
  const totalSecs = pickedVideos.reduce((t, e) => t + (e.duration ?? 0), 0);
  const subtitle =
    info.type === "channel"
      ? `Channel · ${tabs.map((t) => `${t.entries.length.toLocaleString("en-US")} ${t.label.toLowerCase()}`).join(" · ")}`
      : info.id
        ? `Playlist${info.channel ? ` · ${info.channel}` : ""} · ${plural(info.entries.length, "video")}`
        : plural(info.entries.length, "video");

  return (
    <div className={s.page}>
      <TopBar>
        <IconButton icon="back" label="Back to downloads" onClick={close} />
        <div className={s.titleBlock} data-tauri-drag-region>
          <h1 title={info.title}>{info.title}</h1>
          <span>{subtitle}</span>
        </div>
        <DragSpace />
        <WindowControls />
      </TopBar>

      {tabs.length > 1 && (
        <div className={s.tabs} role="tablist">
          {tabs.map((t) => {
            const n = t.entries.filter((e) => selected.has(e.id)).length;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab?.id}
                className={s.tab}
                onClick={() => {
                  setTabId(t.id);
                  lastClicked.current = null;
                }}
              >
                {t.label}
                <small>{t.entries.length.toLocaleString("en-US")}</small>
                {n > 0 && <span className={s.badge}>{n}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className={s.body}>
        <div className={s.listCol}>
          <div className={s.toolbar}>
            <Checkbox
              label="Select all"
              checked={selectable.length > 0 && visibleSelected === selectable.length}
              indeterminate={visibleSelected > 0 && visibleSelected < selectable.length}
              onChange={(on) =>
                setMany(
                  selectable.map((e) => e.id),
                  on,
                )
              }
            />
            <b>
              {visibleSelected} of {selectable.length} selected
            </b>
            <div className={s.divider} />
            <Button
              variant="text"
              onClick={() =>
                setMany(
                  selectable.map((e) => e.id),
                  true,
                )
              }
            >
              Select all
            </Button>
            <Button
              variant="text"
              onClick={() =>
                setMany(
                  selectable.map((e) => e.id),
                  false,
                )
              }
            >
              Select none
            </Button>
            <Button
              variant="text"
              onClick={() => {
                const next = new Set(selected);
                selectable.forEach((e) => (next.has(e.id) ? next.delete(e.id) : next.add(e.id)));
                setSelected(next);
              }}
            >
              Invert
            </Button>
            <div style={{ flex: 1 }} />
            <TextField
              label="Filter by title"
              placeholder="Filter by title"
              value={filter}
              onChange={setFilter}
              width={220}
              leading={<Icon name="filter" size={15} />}
            />
          </div>
          <div className={s.list}>
            {visible.map((e, i) => {
              const off = isUnavailable(e);
              return (
                <div
                  key={e.id}
                  className={s.row}
                  data-selected={selected.has(e.id) || undefined}
                  data-disabled={off || undefined}
                  onClick={(ev) => onRowClick(i, ev.shiftKey)}
                >
                  <Checkbox
                    label={`Select ${e.title}`}
                    checked={selected.has(e.id)}
                    disabled={off}
                    onChange={(_, ev) => onRowClick(i, ev.shiftKey)}
                  />
                  {e.kind === "video" && <span className={s.index}>{position.get(e.id)}</span>}
                  <div
                    className={`${s.thumb} ${e.kind === "playlist" ? s.stack : ""}`}
                    style={{ backgroundImage: e.thumbnail && !off ? `url("${e.thumbnail}")` : undefined }}
                  >
                    {(e.duration != null || e.count != null) && (
                      <span className={s.duration}>{e.kind === "playlist" ? e.count : fmtDuration(e.duration)}</span>
                    )}
                  </div>
                  <div className={s.rowText}>
                    <span title={e.title}>{off ? e.title.replace(/[[\]]/g, "") : e.title}</span>
                    <small style={off ? { color: "var(--bad)" } : undefined}>
                      {off
                        ? "Unavailable, skipped"
                        : e.kind === "playlist"
                          ? e.count
                            ? plural(e.count, "video")
                            : "Playlist"
                          : (e.channel ?? "")}
                    </small>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className={s.empty}>{filter ? "No titles match the filter" : "Nothing here"}</div>
            )}
          </div>
        </div>

        <aside className={s.rail}>
          <div className={s.railBody}>
            <div className={s.railHead}>
              <span>FORMAT</span>
              <PresetMenu preset={preset} onChange={setPreset} />
            </div>
            <FormatOptions preset={preset} onChange={setPreset} compact />
            <Field label="Save to">
              <TextField
                label="Save to"
                value={dir}
                onChange={setDir}
                trailing={
                  <IconButton
                    icon="folder"
                    label="Choose folder"
                    small
                    onClick={async () => setDir((await chooseFolder(dir)) ?? dir)}
                  />
                }
              />
            </Field>
            <label className={s.switchRow}>
              <span>{isChannel ? "Own folder for each playlist" : "Own folder for this playlist"}</span>
              <Switch label="Own folder" checked={settings.playlistFolder} onChange={(v) => set("playlistFolder", v)} />
            </label>
            <label className={s.switchRow}>
              <span>Number files in playlist order</span>
              <Switch label="Number files" checked={settings.numberFiles} onChange={(v) => set("numberFiles", v)} />
            </label>
            {error && <div className={s.error}>{error}</div>}
          </div>
          <div className={s.railFoot}>
            <small>
              {parts.length ? parts.join(" and ") : "Nothing selected"}
              {totalSecs > 0 ? ` · about ${fmtTotalLength(totalSecs)}` : ""}
            </small>
            <div className={s.footButtons}>
              <Button onClick={close} disabled={!!busy} title="Esc">
                Cancel
              </Button>
              <Button variant="primary" disabled={!picked.length || !!busy} onClick={download}>
                {busy ?? (picked.length ? `Download ${parts.join(" + ")}` : "Select something to download")}
              </Button>
            </div>
          </div>
        </aside>
      </div>
      {statusBar}
    </div>
  );
}
