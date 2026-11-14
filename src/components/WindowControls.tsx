// Minimize / maximize / close for the frameless window. Close follows Settings > General > Close the window
// (handled in Rust: hide to the tray, or quit).
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IconButton } from "./ui/controls";

export function WindowControls() {
  const win = getCurrentWindow();
  return (
    <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
      <IconButton icon="minimize" label="Minimize" small ghost onClick={() => void win.minimize()} />
      <IconButton icon="maximize" label="Maximize" small ghost onClick={() => void win.toggleMaximize()} />
      <IconButton icon="x" label="Close" small ghost onClick={() => void win.close()} />
    </div>
  );
}
