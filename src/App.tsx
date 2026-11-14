// The app shell: loads settings and downloads, picks the page, and wires the window-wide helpers
// (Ctrl+V, drag and drop, tray menu actions, tray tooltip).
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useState } from "react";
import { DropOverlay, useDropLinks } from "./components/DropOverlay";
import { layoutStyles } from "./components/layout";
import { toast, Toasts } from "./components/Toasts";
import { DownloadsPage, DownloadsStatusBar } from "./features/downloads/DownloadsPage";
import { useDownloads } from "./features/downloads/store";
import { useTraySync } from "./features/downloads/useTraySync";
import { AddLinkDialog } from "./features/picker/AddLinkDialog";
import { CollectionPage } from "./features/picker/CollectionPage";
import { usePicker } from "./features/picker/store";
import { VideoDialog } from "./features/picker/VideoDialog";
import { SettingsPage } from "./features/settings/SettingsPage";
import { useSettings } from "./features/settings/store";
import { SetupScreen } from "./features/tools/SetupScreen";
import { onTrayAction, toolsStatus } from "./ipc";
import { extractLinks } from "./lib/links";

type Page = "downloads" | "settings";

export default function App() {
  const [ready, setReady] = useState<"loading" | "setup" | "ready">("loading");
  const [page, setPage] = useState<Page>("downloads");
  const picker = usePicker((st) => st.state);
  const openLinks = usePicker((st) => st.open);
  const drop = useDropLinks((links) => void openLinks(links));

  useEffect(() => {
    void (async () => {
      await useSettings.getState().load();
      await useDownloads.getState().load();
      const tools = await toolsStatus().catch(() => []);
      setReady(tools.length && tools.every((t) => t.installed) ? "ready" : "setup");
    })();
  }, []);

  useTraySync();

  const addFromClipboard = async () => {
    const text = (await readText().catch(() => "")) ?? "";
    const links = extractLinks(text);
    if (links.length) void openLinks(links);
    else toast("There is no link on the clipboard");
  };

  // Ctrl+V anywhere outside a text field (and with no dialog open) adds the clipboard's links.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "v") return;
      if ((e.target as HTMLElement).closest("input, textarea, [role=dialog]")) return;
      if (ready !== "ready" || usePicker.getState().state.phase !== "idle") return;
      e.preventDefault();
      void addFromClipboard();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addFromClipboard only reads stores
  }, [ready]);

  useEffect(() => {
    const un = onTrayAction((action) => {
      const dl = useDownloads.getState();
      if (action === "pauseAll") (dl.held ? dl.resumeAll : dl.pauseAll)();
      if (action === "paste") {
        void getCurrentWindow().show();
        void getCurrentWindow().setFocus();
        void addFromClipboard();
      }
    });
    return () => void un.then((f) => f());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- registered once
  }, []);

  const collection = picker.phase === "ready" && picker.result.type !== "video" ? picker.result : null;
  const video = picker.phase === "ready" && picker.result.type === "video" ? picker.result : null;

  return (
    <div className={layoutStyles.window} {...(ready === "ready" ? drop.handlers : {})}>
      {ready === "setup" && <SetupScreen onReady={() => setReady("ready")} />}
      {ready === "ready" &&
        (collection ? (
          <CollectionPage info={collection} statusBar={<DownloadsStatusBar />} />
        ) : page === "settings" ? (
          <SettingsPage onBack={() => setPage("downloads")} />
        ) : (
          <DownloadsPage
            onOpenSettings={() => setPage("settings")}
            onAddFromClipboard={() => void addFromClipboard()}
          />
        ))}
      {(picker.phase === "input" || picker.phase === "loading") && <AddLinkDialog />}
      {video && <VideoDialog info={video} />}
      {drop.state && <DropOverlay state={drop.state} />}
      <Toasts />
    </div>
  );
}
