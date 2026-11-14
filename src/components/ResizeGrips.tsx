// The window has no system frame, so it draws its own invisible resize grips on every edge and corner.
// Each one hands the drag to the window manager (startResizeDragging), so resizing feels native.
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import s from "./layout.module.css";

type ResizeDirection = Parameters<Window["startResizeDragging"]>[0];

const GRIPS: { dir: ResizeDirection; className: string }[] = [
  { dir: "North", className: s.gripN },
  { dir: "South", className: s.gripS },
  { dir: "West", className: s.gripW },
  { dir: "East", className: s.gripE },
  { dir: "NorthWest", className: s.gripNW },
  { dir: "NorthEast", className: s.gripNE },
  { dir: "SouthWest", className: s.gripSW },
  { dir: "SouthEast", className: s.gripSE },
];

export function ResizeGrips() {
  return (
    <>
      {GRIPS.map((g) => (
        <div
          key={g.dir}
          className={`${s.grip} ${g.className}`}
          aria-hidden="true"
          onMouseDown={(e) => {
            if (e.button === 0) void getCurrentWindow().startResizeDragging(g.dir);
          }}
        />
      ))}
    </>
  );
}
