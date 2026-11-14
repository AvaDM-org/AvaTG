import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";
import { cancel, cancelAll, clearFinished, retry, useJobs, type Job } from "../lib/queue";
import { useSettings } from "../lib/settings";
import { fmtBytes, fmtDuration } from "../lib/youtube";

function statusText(j: Job): string {
  switch (j.status) {
    case "queued":
      return "Waiting";
    case "running": {
      const bits = [j.phase ?? "Downloading"];
      if (j.percent != null && j.phase?.startsWith("Downloading")) bits.push(`${j.percent.toFixed(0)}%`);
      if (j.speed) bits.push(`${fmtBytes(j.speed)}/s`);
      if (j.eta) bits.push(`${fmtDuration(j.eta)} left`);
      return bits.join(" · ");
    }
    case "done":
      return "Done";
    case "cancelled":
      return "Cancelled";
    case "error":
      return "Failed";
  }
}

export function QueuePanel() {
  const jobs = useJobs();
  const { outputDir } = useSettings();
  const active = jobs.filter((j) => j.status === "running" || j.status === "queued").length;

  return (
    <aside className="queue">
      <div className="queue-head">
        <h3>
          Downloads {active > 0 && <span className="badge">{active}</span>}
        </h3>
        <div className="queue-actions">
          {outputDir && (
            <button title={outputDir} onClick={() => openPath(outputDir)}>
              Open folder
            </button>
          )}
          {active > 0 && <button onClick={cancelAll}>Stop all</button>}
          {jobs.length > active && <button onClick={clearFinished}>Clear</button>}
        </div>
      </div>
      <div className="queue-list">
        {jobs.length === 0 && <div className="empty muted">Downloads you start appear here.</div>}
        {[...jobs].reverse().map((j) => (
          <div key={j.id} className={`job ${j.status}`}>
            <div className="job-title" title={j.title}>
              {j.title}
            </div>
            <div className="muted job-label">{j.label}</div>
            {(j.status === "running" || j.status === "done") && (
              <div className={`bar ${j.percent == null && j.status === "running" ? "indeterminate" : ""}`}>
                <div style={{ width: `${j.status === "done" ? 100 : (j.percent ?? 0)}%` }} />
              </div>
            )}
            <div className="job-foot">
              <span className="muted">{statusText(j)}</span>
              <span className="job-buttons">
                {(j.status === "running" || j.status === "queued") && (
                  <button onClick={() => cancel(j.id)}>Cancel</button>
                )}
                {(j.status === "error" || j.status === "cancelled") && (
                  <button onClick={() => retry(j.id)}>Retry</button>
                )}
                {j.status === "done" && j.filepath && (
                  <>
                    <button onClick={() => openPath(j.filepath!)}>Play</button>
                    <button onClick={() => revealItemInDir(j.filepath!)}>Show</button>
                  </>
                )}
              </span>
            </div>
            {j.error && <div className="error small">{j.error}</div>}
          </div>
        ))}
      </div>
    </aside>
  );
}
