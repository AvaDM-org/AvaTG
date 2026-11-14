// Shows yt-dlp / Deno / ffmpeg status and installs or updates them into the app data folder.
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState } from "react";
import { binDir, installTool, latestVersions, onToolProgress, toolsStatus, type ToolId, type ToolInfo, type ToolProgress } from "../lib/api";
import { fmtBytes } from "../lib/youtube";

interface Props {
  /** first-run mode: big "Download tools" button, calls onReady when all installed */
  setup?: boolean;
  onReady?: () => void;
}

export function ToolsPanel({ setup, onReady }: Props) {
  const [tools, setTools] = useState<ToolInfo[]>([]);
  const [latest, setLatest] = useState<{ ytdlp: string | null; deno: string | null } | null>(null);
  const [progress, setProgress] = useState<Record<string, ToolProgress>>({});
  const [busy, setBusy] = useState<Set<ToolId>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    toolsStatus().then(setTools).catch((e) => setError(String(e)));
    const un = onToolProgress((p) => setProgress((s) => ({ ...s, [p.id]: p })));
    return () => {
      un.then((f) => f());
    };
  }, []);

  const install = async (ids: ToolId[]) => {
    setError(null);
    setBusy((b) => new Set([...b, ...ids]));
    // sequential: keeps bandwidth for one at a time and progress readable
    for (const id of ids) {
      try {
        const info = await installTool(id);
        setTools((ts) => ts.map((t) => (t.id === id ? info : t)));
      } catch (e) {
        setError(`${id}: ${e}`);
      } finally {
        setBusy((b) => {
          const n = new Set(b);
          n.delete(id);
          return n;
        });
      }
    }
    const all = await toolsStatus();
    setTools(all);
    if (all.every((t) => t.installed)) onReady?.();
  };

  const check = async () => {
    setChecking(true);
    setLatest(await latestVersions());
    setChecking(false);
  };

  const missing = tools.filter((t) => !t.installed).map((t) => t.id);
  const updatable = (t: ToolInfo) =>
    latest && t.installed && t.id !== "ffmpeg" && latest[t.id] && latest[t.id] !== t.version;

  return (
    <div className="tools">
      {setup && (
        <p>
          TubeGrab uses three free tools: <b>yt-dlp</b> (the downloader), <b>Deno</b> (a JavaScript runtime yt-dlp needs
          for YouTube) and <b>ffmpeg</b> (merging and converting). They are downloaded once from their official
          releases (~150–250 MB) and can be updated from Settings later.
        </p>
      )}
      <table>
        <tbody>
          {tools.map((t) => {
            const p = progress[t.id];
            const isBusy = busy.has(t.id);
            return (
              <tr key={t.id}>
                <td>
                  <b>{t.name}</b>
                </td>
                <td className="muted">
                  {t.installed ? t.version : "Not installed"}
                  {updatable(t) && <span className="update"> → {latest![t.id as "ytdlp" | "deno"]} available</span>}
                  {latest && t.installed && !updatable(t) && t.id !== "ffmpeg" && <span> ✓ latest</span>}
                </td>
                <td className="tool-progress">
                  {isBusy && p && p.stage === "download" && (
                    <span>
                      {fmtBytes(p.downloaded)}
                      {p.total ? ` / ${fmtBytes(p.total)}` : ""}
                    </span>
                  )}
                  {isBusy && p?.stage === "extract" && <span>Extracting…</span>}
                  {isBusy && !p && <span>Starting…</span>}
                </td>
                <td>
                  {!setup && (
                    <button disabled={isBusy} onClick={() => install([t.id])}>
                      {t.installed ? (updatable(t) ? "Update" : "Reinstall") : "Install"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <div className="error">{error}</div>}
      <div className="actions">
        {setup ? (
          <button className="primary big" disabled={busy.size > 0 || !missing.length} onClick={() => install(missing)}>
            {busy.size > 0 ? "Downloading…" : "Download tools"}
          </button>
        ) : (
          <>
            <button onClick={check} disabled={checking}>
              {checking ? "Checking…" : "Check for updates"}
            </button>
            {latest && tools.some(updatable) && (
              <button className="primary" onClick={() => install(tools.filter(updatable).map((t) => t.id))}>
                Update all
              </button>
            )}
            <button onClick={async () => openPath(await binDir())}>Open tools folder</button>
          </>
        )}
      </div>
      {!setup && <p className="muted small">ffmpeg has no version feed; "Reinstall" fetches the newest build.</p>}
    </div>
  );
}
