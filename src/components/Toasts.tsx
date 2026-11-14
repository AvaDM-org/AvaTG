// In-app notices at the bottom right. Errors stay until dismissed; other notices fade after a few seconds.
import { create } from "zustand";
import { IconButton } from "./ui/controls";
import s from "./layout.module.css";

interface Toast {
  id: number;
  text: string;
  bad: boolean;
}

interface ToastStore {
  toasts: Toast[];
  show: (text: string, bad?: boolean) => void;
  dismiss: (id: number) => void;
}

let next = 0;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  show: (text, bad = false) => {
    const id = next++;
    set({ toasts: [...get().toasts.slice(-3), { id, text, bad }] });
    if (!bad) setTimeout(() => get().dismiss(id), 5000);
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
          <IconButton icon="x" label="Dismiss" small ghost onClick={() => dismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
