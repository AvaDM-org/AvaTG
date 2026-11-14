// Keeps the tray tooltip and its Pause all / Resume all item in step with the queue.
import { useEffect } from "react";
import { updateTray } from "../../ipc";
import { useDownloads } from "./store";

export function useTraySync() {
  useEffect(() => {
    let last = "";
    return useDownloads.subscribe(({ items, held }) => {
      const running = items.filter((d) => d.status === "running");
      const waiting = items.filter((d) => d.status === "queued").length;
      const resumable = items.some((d) => d.status === "paused" || d.status === "interrupted");
      let tooltip = "AvaTG";
      if (held) tooltip += " · Paused";
      else if (running.length === 1 && running[0].percent != null)
        tooltip += ` · 1 downloading, ${Math.floor(running[0].percent)}%`;
      else if (running.length) tooltip += ` · ${running.length} downloading`;
      if (waiting) tooltip += ` · ${waiting} waiting`;
      const allPaused = held || (!running.length && resumable);
      const key = `${tooltip}|${allPaused}`;
      if (key !== last) {
        last = key;
        void updateTray(tooltip, allPaused).catch(() => {});
      }
    });
  }, []);
}
