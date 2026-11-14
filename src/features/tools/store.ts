// The tools TubeGrab runs: what is available (system, own copy, custom file), which copy is used, and whether
// its version is good enough. The chosen paths are handed to Rust, which runs them.
import { create } from "zustand";
import { setToolPaths, toolsStatus, toolVersion, type ToolInfo } from "../../ipc";
import { resolveTool, type ResolvedTool, type ToolId } from "../../lib/toolVersions";
import { getSettings } from "../settings/store";

interface ToolsStore {
  infos: ToolInfo[];
  resolved: Partial<Record<ToolId, ResolvedTool>>;
  /** true when every tool has a usable copy */
  ready: boolean;
  /** Re-read what is installed, pick a copy for each tool and tell Rust. */
  refresh: () => Promise<boolean>;
}

export const useTools = create<ToolsStore>((set) => ({
  infos: [],
  resolved: {},
  ready: false,

  refresh: async () => {
    const infos = await toolsStatus();
    const sources = getSettings().toolSources;
    const resolved: Partial<Record<ToolId, ResolvedTool>> = {};
    for (const info of infos) {
      const choice = sources[info.id];
      const custom =
        choice.source === "custom" && choice.customPath
          ? { path: choice.customPath, version: await toolVersion(info.id, choice.customPath).catch(() => null) }
          : null;
      resolved[info.id] = resolveTool(info.id, choice, {
        app: info.installed ? { path: info.appPath, version: info.version } : null,
        system: info.system,
        custom,
      });
    }
    const paths: Partial<Record<ToolId, string>> = {};
    for (const [id, r] of Object.entries(resolved) as [ToolId, ResolvedTool][]) {
      if (r.path && r.check.ok) paths[id] = r.path;
    }
    await setToolPaths(paths);
    const ready = infos.length > 0 && infos.every((i) => resolved[i.id]?.check.ok);
    set({ infos, resolved, ready });
    return ready;
  },
}));
