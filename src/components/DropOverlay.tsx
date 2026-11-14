// Drag a link, text with links, or a .txt file over the window: a full-window overlay, then the picker.
// Nothing starts without a confirmation. (The window's native file-drop is off so the webview gets these events.)
import { useRef, useState } from "react";
import { LINK_LIST_EXTENSIONS, linksFromDataTransfer, parseLinkList } from "../lib/links";
import { Icon } from "./ui/Icon";
import { toast } from "./Toasts";
import s from "./layout.module.css";

type DropState = "links" | "none" | null;

const TEXT_TYPES = ["text/uri-list", "text/plain", "text/html", "Files"]; // list files hold links, .json is a theme

/** `onLinks` gets the links found; `onThemeText` gets each dropped .json file (a theme to import). */
export function useDropLinks(onLinks: (links: string[]) => void, onThemeText: (text: string) => Promise<void>) {
  const [state, setState] = useState<DropState>(null);
  const depth = useRef(0); // dragenter/dragleave fire for every child element

  const handlers = {
    onDragEnter: (e: React.DragEvent) => {
      e.preventDefault();
      depth.current++;
      // The data can't be read until the drop; only its types are known now.
      setState(e.dataTransfer.types.some((t) => TEXT_TYPES.includes(t)) ? "links" : "none");
    },
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDragLeave: () => {
      if (--depth.current <= 0) {
        depth.current = 0;
        setState(null);
      }
    },
    onDrop: async (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setState(null);
      const links = linksFromDataTransfer(e.dataTransfer);
      const files = Array.from(e.dataTransfer.files);
      // A dropped .json is a theme to import (like AvaDM), not a list of links.
      const themes = files.filter((f) => /\.json$/i.test(f.name));
      for (const f of themes) await onThemeText(await f.text());
      if (themes.length && !links.length) return;
      for (const file of files) {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        if (LINK_LIST_EXTENSIONS.includes(ext)) links.push(...parseLinkList(await file.text()));
      }
      if (links.length) onLinks([...new Set(links)]);
      else toast("No link found in what was dropped");
    },
  };
  return { state, handlers };
}

export function DropOverlay({ state }: { state: Exclude<DropState, null> }) {
  const none = state === "none";
  return (
    <div className={s.dropOverlay}>
      <div className={s.dropFrame} data-none={none || undefined}>
        <div className={s.dropIcon}>
          <Icon name={none ? "alert" : "link"} size={34} />
        </div>
        <h2>{none ? "No link found in this item" : "Drop to add"}</h2>
        <p>
          {none
            ? "Drop a link, text with links, or a .txt file"
            : "Videos, playlists and channels. You choose what to download next"}
        </p>
      </div>
    </div>
  );
}
