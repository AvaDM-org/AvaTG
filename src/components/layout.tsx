// Window chrome shared by every page.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import s from "./layout.module.css";

/** The top bar. It is also the window's title bar: empty space in it drags the window. */
export function TopBar({ children }: { children: ReactNode }) {
  return (
    <header className={s.topbar} data-tauri-drag-region>
      {children}
    </header>
  );
}

/** Flexible empty space in the top bar that still drags the window. */
export const DragSpace = () => <div style={{ flex: 1, alignSelf: "stretch" }} data-tauri-drag-region />;

export function StatusBar({ children }: { children: ReactNode }) {
  return <footer className={s.statusbar}>{children}</footer>;
}

export function StatusChip({ on, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return <button type="button" className={`${s.chip} ${on ? s.chipOn : ""} ${className ?? ""}`} {...rest} />;
}

export { s as layoutStyles };
