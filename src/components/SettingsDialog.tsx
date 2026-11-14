import { open } from "@tauri-apps/plugin-dialog";
import { updateSettings, useSettings } from "../lib/settings";
import { ToolsPanel } from "./ToolsPanel";

const BROWSERS = ["", "chrome", "edge", "firefox", "brave", "opera", "vivaldi", "chromium", "safari"];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings();
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button onClick={onClose}>Close</button>
        </div>

        <section>
          <h3>Downloads</h3>
          <div className="field">
            <label>Save to</label>
            <div className="row-inline">
              <input readOnly value={s.outputDir} />
              <button
                onClick={async () => {
                  const dir = await open({ directory: true, defaultPath: s.outputDir || undefined });
                  if (typeof dir === "string") updateSettings({ outputDir: dir });
                }}
              >
                Change…
              </button>
            </div>
          </div>
          <div className="field">
            <label>Parallel downloads</label>
            <div className="segmented">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={s.concurrency === n ? "active" : ""} onClick={() => updateSettings({ concurrency: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Use cookies from browser</label>
            <select value={s.cookiesBrowser} onChange={(e) => updateSettings({ cookiesBrowser: e.target.value })}>
              {BROWSERS.map((b) => (
                <option key={b} value={b}>
                  {b ? b[0].toUpperCase() + b.slice(1) : "None"}
                </option>
              ))}
            </select>
            <small className="muted">
              Only needed for age-restricted, members-only or private videos. The browser may need to be closed.
            </small>
          </div>
        </section>

        <section>
          <h3>Tools</h3>
          <ToolsPanel />
        </section>
      </div>
    </div>
  );
}
