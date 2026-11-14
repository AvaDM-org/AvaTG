// Menus: a context menu at a point, and a dropdown anchored to a trigger. Esc or a click outside closes them.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import s from "./ui.module.css";

export interface Point {
  x: number;
  y: number;
}

export function Menu({
  at,
  onClose,
  width = 244,
  children,
  label,
  above,
  anchor,
}: {
  at: Point;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  label: string;
  /** open upward, with the menu's bottom edge at `at.y` */
  above?: boolean;
  /** the trigger; a press on it is left to the trigger, which toggles the menu */
  anchor?: HTMLElement;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(at);

  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos({
      x: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(above ? at.y - r.height : at.y, window.innerHeight - r.height - 8)),
    });
  }, [at, above]);

  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !anchor?.contains(t)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("keydown", key);
    };
  }, [onClose, anchor]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      className={s.menu}
      style={{ left: pos.x, top: pos.y, width }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

export function MenuItem({
  children,
  hint,
  onSelect,
  danger,
  checked,
  disabled,
}: {
  children: ReactNode;
  hint?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  /** shows a check slot; undefined = no slot */
  checked?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      disabled={disabled}
      className={`${s.menuItem} ${danger ? s.menuDanger : ""}`}
      onClick={onSelect}
    >
      {checked !== undefined && (
        <span className={s.menuCheck}>{checked && <Icon name="check" size={14} strokeWidth={2.2} />}</span>
      )}
      <span className={s.menuLabel}>{children}</span>
      {hint && <small>{hint}</small>}
    </button>
  );
}

export const MenuDivider = () => <div className={s.menuDivider} role="separator" />;
export const MenuTitle = ({ children }: { children: ReactNode }) => <div className={s.menuTitle}>{children}</div>;

/** A trigger plus the menu it opens below it (or above, with `up`). Items close it by calling `close`. */
export function Dropdown({
  trigger,
  children,
  width,
  up,
  label,
}: {
  trigger: (props: { open: boolean; toggle: (e: React.MouseEvent<HTMLElement>) => void }) => ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  up?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState<{ at: Point; anchor: HTMLElement } | null>(null);
  const close = () => setOpen(null);
  const toggle = (e: React.MouseEvent<HTMLElement>) => {
    if (open) return close();
    const anchor = e.currentTarget;
    const r = anchor.getBoundingClientRect();
    setOpen({ at: { x: r.left, y: up ? r.top - 6 : r.bottom + 6 }, anchor });
  };
  return (
    <>
      {trigger({ open: !!open, toggle })}
      {open && (
        <Menu at={open.at} anchor={open.anchor} onClose={close} width={width} label={label} above={up}>
          {children(close)}
        </Menu>
      )}
    </>
  );
}
