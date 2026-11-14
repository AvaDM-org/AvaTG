// Updates for AvaTG itself (updater.rs does the work). One state for the update card in Settings › About.
import { create } from "zustand";
import { installChannel, onUpdateProgress, updateCheck, updateInstall, type UpdateInfo } from "../../ipc";
import { getSettings } from "../settings/store";

export type UpdateStatus = "idle" | "checking" | "upToDate" | "available" | "downloading" | "installing" | "failed";

interface UpdatesStore {
  status: UpdateStatus;
  info: UpdateInfo | null;
  /** "package": a .deb/.rpm install; updates come from the release page */
  channel: "auto" | "package";
  downloaded: number;
  total: number | null;
  error: string | null;
  check: () => Promise<UpdateInfo | null>;
  install: () => Promise<void>;
}

export const useUpdates = create<UpdatesStore>((set, get) => ({
  status: "idle",
  info: null,
  channel: "auto",
  downloaded: 0,
  total: null,
  error: null,

  check: async () => {
    set({ status: "checking", error: null, channel: await installChannel().catch(() => "auto" as const) });
    try {
      const info = await updateCheck(getSettings().includePrereleases);
      set({ info, status: info ? "available" : "upToDate" });
      return info;
    } catch (e) {
      set({ status: "failed", error: String(e) });
      return null;
    }
  },

  install: async () => {
    if (get().status === "downloading" || get().status === "installing") return;
    set({ status: "downloading", downloaded: 0, total: null, error: null });
    const un = await onUpdateProgress(({ downloaded, total }) =>
      set({ downloaded, total, status: total && downloaded >= total ? "installing" : "downloading" }),
    );
    try {
      await updateInstall(); // restarts AvaTG when done
    } catch (e) {
      set({ status: "failed", error: String(e) });
    } finally {
      un();
    }
  },
}));
