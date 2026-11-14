// A closable panel under a list, with tabs: details of what is selected. The content is the caller's.
import type { ReactNode } from "react";
import { IconButton } from "./ui/controls";
import s from "./DetailPanel.module.css";

export interface PanelTab<T extends string> {
  id: T;
  label: string;
}

export function DetailPanel<T extends string>({
  label,
  tabs,
  tab,
  onTab,
  onClose,
  children,
}: {
  label: string;
  /** none or one tab: no tab strip, just the title */
  tabs: PanelTab<T>[];
  tab: T;
  onTab: (t: T) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className={s.panel} aria-label={label}>
      <div className={s.strip}>
        {tabs.length > 1 ? (
          <div role="tablist" className={s.tabs}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === tab}
                className={s.tab}
                onClick={() => onTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        ) : (
          <span className={s.title}>{label}</span>
        )}
        <IconButton icon="x" label="Close details" small ghost onClick={onClose} />
      </div>
      <div className={s.body} role="tabpanel">
        {children}
      </div>
    </section>
  );
}

/** A label above a value, for a row of facts. */
export function Stat({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={s.stat} data-wide={wide || undefined}>
      <span>{label}</span>
      <b>{children}</b>
    </div>
  );
}
