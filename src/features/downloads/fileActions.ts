// Opening files and folders for a download. Failures become toasts.
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { toast, toastError } from "../../components/Toasts";
import { openExternal } from "../../ipc";
import type { DownloadRecord } from "./types";

export const playFile = (d: DownloadRecord) => (d.filepath ? openExternal(d.filepath).catch(toastError) : undefined);

/** Shows the finished file in its folder, or opens the folder while it is still downloading. */
export const showInFolder = (d: DownloadRecord) =>
  (d.filepath && d.status === "done" ? revealItemInDir(d.filepath) : openExternal(d.dir)).catch(toastError);

export const openOnSite = (d: DownloadRecord) => openExternal(d.url).catch(toastError);

export const copyLinks = (items: DownloadRecord[]) =>
  writeText(items.map((d) => d.url).join("\n"))
    .then(() => toast(items.length === 1 ? "Link copied" : `${items.length} links copied`))
    .catch(toastError);
