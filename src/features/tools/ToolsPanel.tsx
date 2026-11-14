// yt-dlp, Deno and FFmpeg: which copy is used (system, TubeGrab's, or a custom file), versions, install, update.
// Used by the first-run screen and Settings > Tools.
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { Button, ProgressBar } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import { Dropdown, MenuItem } from "../../components/ui/Menu";
import {
  installTool,
  latestVersions,
  onToolProgress,
  type LatestVersions,
  type ToolInfo,
  type ToolProgress,
} from "../../ipc";
import { fmtBytes } from "../../lib/format";
import type { ResolvedTool, ToolId, ToolSource } from "../../lib/toolVersions";
import { Row, Section } from "../settings/rows";
import { useSettings } from "../settings/store";
import s from "../settings/settings.module.css";
import { useTools } from "./store";

const ABOUT: Record<ToolId, { tile: string; what: string }> = {
  ytdlp: { tile: "YT", what: "Downloads the videos" },
  deno: { tile: "JS", what: "Runs YouTube's player code for yt-dlp" },
  ffmpeg: { tile: "FF", what: "Joins video and audio, converts formats" },
};

const SOURCES: { value: ToolSource; label: string; hint: string }[] = [
  { value: "auto", label: "Automatic", hint: "System copy if good" },
  { value: "app", label: "TubeGrab's copy", hint: "Downloaded" },
  { value: "custom", label: "Custom file…", hint: "" },
];

const FROM: Record<NonNullable<ResolvedTool["from"]>, string> = {
  system: "System copy",
  app: "TubeGrab's copy",
  custom: "Your file",
};

/** Downloads TubeGrab's own copy of tools, one after the other, with progress. */
export function useInstaller() {
  const refresh = useTools((st) => st.refresh);
  const [progress, setProgress] = useState<ToolProgress | null>(null);
  const [busy, setBusy] = useState<ToolId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const un = onToolProgress(setProgress);
    return () => void un.then((f) => f());
  }, []);

  const install = async (ids: ToolId[]) => {
    setError(null);
    for (const id of ids) {
      setBusy(id);
      setProgress(null);
      try {
        await installTool(id);
      } catch (e) {
        setError(String(e));
        break;
      }
    }
    setBusy(null);
    return refresh();
  };

  return { progress, busy, error, install };
}

export function ToolsSettings() {
  const { infos, resolved, refresh } = useTools();
  const { progress, busy, error, install } = useInstaller();
  const { settings, set } = useSettings();
  const [latest, setLatest] = useState<LatestVersions | null>(null);
  const [checking, setChecking] = useState(false);
  const busyTool = infos.find((t) => t.id === busy);

  useEffect(() => void refresh(), [refresh]);

  const choose = async (id: ToolId, source: ToolSource) => {
    let customPath = settings.toolSources[id].customPath;
    if (source === "custom") {
      const picked = await openFile({ multiple: false, directory: false, title: `Choose the ${id} program` });
      if (typeof picked !== "string") return;
      customPath = picked;
    }
    set("toolSources", { ...settings.toolSources, [id]: { source, customPath } });
    await refresh();
  };

  const check = async () => {
    setChecking(true);
    setLatest(await latestVersions());
    setChecking(false);
  };

  return (
    <>
      {busyTool && <InstallCard tool={busyTool} progress={progress} />}
      <Section heading="TOOLS">
        {infos.map((t) => {
          const r = resolved[t.id];
          const newer = latest && t.id !== "ffmpeg" ? latest[t.id] : null;
          const updatable = !!newer && t.installed && newer !== t.version;
          const where = r?.from ? `${FROM[r.from]} · ${r.version ?? "?"} · ${r.path}` : "Not installed";
          const desc = [where, r?.check.note, updatable ? `TubeGrab's copy can update to ${newer}` : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <Row
              key={t.id}
              title={t.name}
              tile={ABOUT[t.id].tile}
              desc={<span title={r?.path ?? undefined}>{desc}</span>}
              descTone={!r?.check.ok ? "bad" : r.check.note || updatable ? "warn" : undefined}
            >
              <Dropdown
                label={`${t.name} source`}
                width={220}
                trigger={({ toggle }) => (
                  <Button onClick={toggle}>
                    {SOURCES.find((o) => o.value === settings.toolSources[t.id].source)?.label.replace("…", "")}
                    <Icon name="chevronDown" size={14} />
                  </Button>
                )}
              >
                {(close) =>
                  SOURCES.map((o) => (
                    <MenuItem
                      key={o.value}
                      checked={settings.toolSources[t.id].source === o.value}
                      hint={o.value === "auto" && t.system ? `found ${t.system.version ?? ""}` : o.hint}
                      onSelect={() => {
                        close();
                        void choose(t.id, o.value);
                      }}
                    >
                      {o.label}
                    </MenuItem>
                  ))
                }
              </Dropdown>
              <Button
                variant={updatable || (!t.installed && !r?.check.ok) ? "primary" : "secondary"}
                disabled={!!busy}
                onClick={() => void install([t.id])}
                title="Download TubeGrab's own copy"
              >
                {!t.installed ? "Download" : updatable ? "Update" : "Reinstall"}
              </Button>
            </Row>
          );
        })}
      </Section>
      <Section heading="UPDATES">
        <Row
          title="Check for new versions"
          desc={error ?? "YouTube changes often; a new yt-dlp usually fixes it. FFmpeg has no version feed."}
          descTone={error ? "bad" : undefined}
        >
          <Button disabled={checking || !!busy} onClick={check}>
            {checking ? "Checking…" : "Check now"}
          </Button>
        </Row>
      </Section>
    </>
  );
}

export function InstallCard({ tool, progress }: { tool: ToolInfo; progress: ToolProgress | null }) {
  const pct = progress?.total ? (progress.downloaded / progress.total) * 100 : null;
  const line =
    progress?.stage === "extract"
      ? "Unpacking…"
      : progress
        ? `${fmtBytes(progress.downloaded)}${progress.total ? ` of ${fmtBytes(progress.total)}` : ""}`
        : "Starting…";
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <div className={s.cardIcon}>
          <Icon name="download" size={20} strokeWidth={2} />
        </div>
        <div className={s.rowText}>
          <b>Downloading {tool.name}</b>
          <small className="tnum">{line}</small>
        </div>
      </div>
      <ProgressBar percent={progress?.stage === "extract" ? null : pct} height={8} />
    </div>
  );
}
