// yt-dlp, Deno and FFmpeg: versions, install, update. Used by the first-run screen and Settings > Tools.
import { useEffect, useState } from "react";
import { Button, ProgressBar } from "../../components/ui/controls";
import { Icon } from "../../components/ui/Icon";
import {
  installTool,
  latestVersions,
  onToolProgress,
  toolsStatus,
  type LatestVersions,
  type ToolId,
  type ToolInfo,
  type ToolProgress,
} from "../../ipc";
import { fmtBytes } from "../../lib/format";
import { Row, Section } from "../settings/rows";
import s from "../settings/settings.module.css";

const ABOUT: Record<ToolId, { tile: string; what: string }> = {
  ytdlp: { tile: "YT", what: "Downloads the videos" },
  deno: { tile: "JS", what: "Runs YouTube's player code for yt-dlp" },
  ffmpeg: { tile: "FF", what: "Joins video and audio, converts formats" },
};

export function useTools() {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [latest, setLatest] = useState<LatestVersions | null>(null);
  const [progress, setProgress] = useState<ToolProgress | null>(null);
  const [busy, setBusy] = useState<ToolId | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    toolsStatus().then(setTools, (e) => setError(String(e)));
    const un = onToolProgress(setProgress);
    return () => void un.then((f) => f());
  }, []);

  /** Install one after the other: keeps the bandwidth on one and the progress readable. */
  const install = async (ids: ToolId[]) => {
    setError(null);
    for (const id of ids) {
      setBusy(id);
      setProgress(null);
      try {
        const info = await installTool(id);
        setTools((ts) => ts.map((t) => (t.id === id ? info : t)));
      } catch (e) {
        setError(`${id}: ${e}`);
        break;
      }
    }
    setBusy(null);
    const all = await toolsStatus();
    setTools(all);
    return all.every((t) => t.installed);
  };

  const updatable = (t: ToolInfo) =>
    !!latest && t.installed && t.id !== "ffmpeg" && !!latest[t.id] && latest[t.id] !== t.version;

  return { tools, latest, setLatest, progress, busy, error, install, updatable };
}

export function ToolsSettings() {
  const { tools, latest, setLatest, progress, busy, error, install, updatable } = useTools();
  const [checking, setChecking] = useState(false);
  const busyTool = tools.find((t) => t.id === busy);

  const check = async () => {
    setChecking(true);
    setLatest(await latestVersions());
    setChecking(false);
  };

  return (
    <>
      {busyTool && <InstallCard tool={busyTool} progress={progress} />}
      <Section heading="INSTALLED">
        {tools.map((t) => {
          const upd = updatable(t);
          const desc = !t.installed
            ? "Not installed"
            : upd
              ? `${t.version} · ${latest?.[t.id as "ytdlp" | "deno"]} available`
              : latest && t.id !== "ffmpeg"
                ? `${t.version} · Up to date`
                : `${t.version ?? ""} · ${ABOUT[t.id].what}`;
          return (
            <Row
              key={t.id}
              title={t.name}
              tile={ABOUT[t.id].tile}
              desc={desc}
              descTone={!t.installed ? "bad" : upd ? "warn" : latest ? "ok" : undefined}
            >
              <Button
                variant={upd || !t.installed ? "primary" : "secondary"}
                disabled={!!busy}
                onClick={() => void install([t.id])}
              >
                {!t.installed ? "Install" : upd ? "Update" : "Reinstall"}
              </Button>
            </Row>
          );
        })}
      </Section>
      <Section heading="UPDATES">
        <Row
          title="Check for new versions"
          desc={
            error ??
            "YouTube changes often; a new yt-dlp usually fixes it. FFmpeg has no version feed, so it only offers Reinstall."
          }
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
