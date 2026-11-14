// Modal dialog shell: scrim, 18 px radius, title top-left, close top-right, footer with hint and buttons.
// Esc cancels; Ctrl+Enter confirms when `onConfirm` is given.
import { useEffect, type ReactNode } from "react";
import { Button, IconButton } from "./controls";
import s from "./ui.module.css";

export function Dialog({
  title,
  onClose,
  onConfirm,
  width = 480,
  head,
  headExtra,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  width?: number;
  /** replaces the plain title (e.g. a thumbnail header) */
  head?: ReactNode;
  headExtra?: ReactNode;
  footer: ReactNode;
  children?: ReactNode;
}) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && e.ctrlKey && onConfirm) onConfirm();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, onConfirm]);

  return (
    <div className={s.scrim} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={s.dialog} style={{ width }}>
        <div className={s.dialogHead}>
          {head ?? <h2>{title}</h2>}
          {headExtra}
          <IconButton icon="x" label="Close" small onClick={onClose} />
        </div>
        {children && <div className={s.dialogBody}>{children}</div>}
        <div className={s.dialogFoot}>{footer}</div>
      </div>
    </div>
  );
}

/** A plain confirmation: message, Cancel, and one action (danger by default). */
export function Confirm({
  title,
  message,
  action,
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  action: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirm = () => {
    onConfirm();
    onClose();
  };
  return (
    <Dialog
      title={title}
      onClose={onClose}
      onConfirm={confirm}
      footer={
        <>
          <span />
          <ConfirmButtons action={action} danger={danger} onCancel={onClose} onConfirm={confirm} />
        </>
      }
    >
      <div style={{ color: "var(--fg2)", lineHeight: 1.5 }}>{message}</div>
    </Dialog>
  );
}

function ConfirmButtons(props: { action: string; danger: boolean; onCancel: () => void; onConfirm: () => void }) {
  return (
    <>
      <Button onClick={props.onCancel}>Cancel</Button>
      <Button variant={props.danger ? "danger" : "primary"} onClick={props.onConfirm} autoFocus>
        {props.action}
      </Button>
    </>
  );
}
