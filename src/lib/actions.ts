// Turns user selections into queued download jobs.
import { enqueue } from "./queue";
import { buildArgs, describePreset, type Preset } from "./presets";
import { getSettings } from "./settings";
import { playlistEntries, type Entry } from "./youtube";

export interface QueueItem {
  url: string;
  title: string;
  subfolder?: string | null;
  index?: number | null;
}

export function queueItems(items: QueueItem[], preset: Preset) {
  const { outputDir } = getSettings();
  const label = describePreset(preset);
  enqueue(
    items.map((it) => ({
      url: it.url,
      title: it.title,
      label,
      args: buildArgs(preset, { outputDir, subfolder: it.subfolder, index: it.index }),
    })),
  );
}

/** Expand playlists (from a channel) into their videos and queue them, one folder per playlist. */
export async function queuePlaylists(playlists: Entry[], preset: Preset, onProgress?: (done: number) => void) {
  const { playlistSubfolder, numberFiles, cookiesBrowser } = getSettings();
  let done = 0;
  const errors: string[] = [];
  for (const pl of playlists) {
    try {
      const info = await playlistEntries(pl.url, cookiesBrowser);
      queueItems(
        info.entries.map((e, i) => ({
          url: e.url,
          title: e.title,
          subfolder: playlistSubfolder ? info.title : null,
          index: numberFiles ? i + 1 : null,
        })),
        preset,
      );
    } catch (e) {
      errors.push(`${pl.title}: ${e}`);
    }
    onProgress?.(++done);
  }
  if (errors.length) throw new Error(errors.join("\n"));
}
