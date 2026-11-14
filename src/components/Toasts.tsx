// In-app notices at the bottom right. Errors stay until dismissed; other notices fade after a few seconds.
import { create } from "zustand";
import { Button, IconButton } from "./ui/controls";
import s from "./layout.module.css";

interface ToastAction {
  label: string;
  run: () => void;
}

interface Toast {
  id: number;
  text: string;
  bad: boolean;
  action?: ToastAction;
}

interface ToastStore {
  toasts: Toast[];
  /** Errors and notices with an action stay until dismissed; plain notices fade. */
  show: (text: string, bad?: boolean, action?: ToastAction) => void;
  dismiss: (id: number) => void;
}

let next = 0;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (text, bad = false, action) => {
    const id = next++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, bad, action }] });
    if (!bad && !action) setTimeout(() => get().dismiss(id), 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

export const toast = (text: string) => useToasts.getState().show(text);
export const toastError = (e: unknown) => useToasts.getState().show(String(e).replace(/^Error:\s*/, ""), true);

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  if (!toasts.length) return null;
  return (
    <div className={s.toasts} role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`${s.toast} ${t.bad ? s.toastBad : ""}`}>
          <span>{t.text}</span>
          {t.action && (
            <Button
              variant="primary"
              small
              onClick={() => {
                dismiss(t.id);
                t.action?.run();
              }}
            >
              {t.action.label}
            </Button>
          )}
          <IconButton icon="x" label="Dismiss" small ghost onClick={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
