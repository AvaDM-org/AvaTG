// Building blocks for settings pages: an uppercase section heading over a group of rows.
import type { ReactNode } from "react";
import s from "./settings.module.css";

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2>{heading}</h2>
      <div className={s.group}>{children}</div>
    </section>
  );
}

export function Row({
  title,
  desc,
  descTone,
  tile,
  children,
}: {
  title: string;
  desc?: ReactNode;
  descTone?: "ok" | "warn" | "bad";
  tile?: string;
  children?: ReactNode;
}) {
  return (
    <div className={s.row}>
      {tile && <div className={s.tile}>{tile}</div>}
      <div className={s.rowText}>
        <b>{title}</b>
        {desc && <small className={descTone ? s[descTone] : undefined}>{desc}</small>}
      </div>
      {children && <div className={s.control}>{children}</div>}
    </div>
  );
}
