import { downloadDir } from "@tauri-apps/api/path";
import { useEffect, useState } from "react";
import "./App.css";
import { CollectionView } from "./components/CollectionView";
import { QueuePanel } from "./components/QueuePanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { ToolsPanel } from "./components/ToolsPanel";
import { VideoView } from "./components/VideoView";
import { toolsStatus } from "./lib/api";
import { initQueueEvents } from "./lib/queue";
import { getSettings, updateSettings } from "./lib/settings";
import { analyze, classify, type Analysis } from "./lib/youtube";

type ToolsState = "checking" | "missing" | "ready";

export default function App() {
  const [toolsState, setToolsState] = useState<ToolsState>("checking");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    initQueueEvents();
    if (!getSettings().outputDir) {
      downloadDir()
        .then((d) => updateSettings({ outputDir: d }))
        .catch(() => {});
    }
    toolsStatus()
      .then((ts) => setToolsState(ts.every((t) => t.installed) ? "ready" : "missing"))
      .catch(() => setToolsState("missing"));
  }, []);

  const run = async (target = url) => {
    if (!target.trim()) return;
    setUrl(target);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await analyze(target, getSettings().cookiesBrowser));
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const kind = url.trim() ? classify(url).kind : null;
  const loadingText =
    kind === "channel"
      ? "Reading channel videos and playlists… (large channels take a while)"
      : kind === "playlist"
        ? "Reading playlist…"
        : "Reading video info…";

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">TubeGrab</div>
        <form
          className="urlbar"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <input
            autoFocus
            placeholder="Paste a YouTube video, playlist or channel link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (/^https?:\/\//.test(text.trim()) && toolsState === "ready") {
                e.preventDefault();
                run(text.trim());
              }
            }}
            disabled={toolsState !== "ready"}
          />
          <button className="primary" type="submit" disabled={loading || toolsState !== "ready" || !url.trim()}>
            {loading ? "…" : "Go"}
          </button>
        </form>
        <button onClick={() => setShowSettings(true)}>Settings</button>
      </header>

      <div className="body">
        <main className="content">
          {toolsState === "missing" && (
            <div className="view setup">
              <h2>One-time setup</h2>
              <ToolsPanel setup onReady={() => setToolsState("ready")} />
            </div>
          )}
          {toolsState === "ready" && (
            <>
              {loading && (
                <div className="center muted">
                  <div className="spinner" />
                  {loadingText}
                </div>
              )}
              {error && (
                <div className="view">
                  <div className="error">{error}</div>
                </div>
              )}
              {!loading && !error && !result && (
                <div className="center muted hint">
                  <p>Paste a link above.</p>
                  <ul>
                    <li>A video → pick quality, video or audio</li>
                    <li>A playlist → choose which videos</li>
                    <li>A channel → choose videos, shorts and whole playlists</li>
                  </ul>
                </div>
              )}
              {result?.type === "video" && (
                <VideoView key={result.id} info={result} onOpenUrl={run} onQueued={() => {}} />
              )}
              {result && result.type !== "video" && (
                <CollectionView key={result.title} info={result} onQueued={() => {}} />
              )}
            </>
          )}
        </main>
        <QueuePanel />
      </div>

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  );
}
