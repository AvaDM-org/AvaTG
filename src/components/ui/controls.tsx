// Basic controls. "The control matches the question": on/off is a Switch, one of a few is Segmented,
// a number is a Stepper, a path is a TextField with a folder button inside.
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import s from "./ui.module.css";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

type Variant = "primary" | "secondary" | "danger" | "text";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  icon?: IconName;
}

export function Button({ variant = "secondary", small, icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        s.button,
        variant === "primary" && s.primary,
        variant === "danger" && s.danger,
        variant === "text" && s.text,
        small && s.small,
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={small ? 14 : 16} strokeWidth={variant === "primary" ? 2 : 1.8} />}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** accessible name and tooltip */
  label: string;
  small?: boolean;
  ghost?: boolean;
}

export function IconButton({ icon, label, small, ghost, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(s.iconButton, small && s.iconButtonSm, ghost && s.ghost, className)}
      {...rest}
    >
      <Icon name={icon} size={small ? 14 : 16} />
    </button>
  );
}

export function Segmented<T extends string | number | boolean | null>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.segmented} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={s.segment}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <input
      type="checkbox"
      role="switch"
      className={s.switch}
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
  );
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: (v: boolean, e: React.MouseEvent) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className={s.checkbox}
      aria-label={label}
      checked={checked}
      disabled={disabled}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={() => {}}
      onClick={(e) => {
        e.stopPropagation();
        onChange?.(!checked, e);
      }}
    />
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  suffix = "",
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix?: string;
  label: string;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => set(value - 1)}>
        −
      </button>
      <span>
        {value}
        {suffix}
      </span>
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => set(value + 1)}>
        +
      </button>
    </div>
  );
}

export function TextField({
  value,
  onChange,
  label,
  placeholder,
  readOnly,
  trailing,
  leading,
  width,
  onKeyDown,
  autoFocus,
}: {
  value: string;
  onChange?: (v: string) => void;
  label: string;
  placeholder?: string;
  readOnly?: boolean;
  trailing?: ReactNode;
  leading?: ReactNode;
  width?: number | string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  return (
    <label className={s.field} style={{ width }}>
      {leading}
      <input
        value={value}
        aria-label={label}
        title={readOnly ? value : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        autoFocus={autoFocus}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange?.(e.target.value)}
        spellCheck={false}
      />
      {trailing}
    </label>
  );
}

/** A labelled block: label on the left, optional hint on the right, the control below. */
export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className={s.label}>
        <span>{label}</span>
        {hint && <span>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={s.chip} aria-pressed={on} onClick={onClick}>
      {on && <Icon name="check" size={12} strokeWidth={2.4} />}
      {children}
    </button>
  );
}

export function ProgressBar({
  percent,
  paused,
  done,
  indeterminate,
  height,
}: {
  percent: number | null;
  paused?: boolean;
  done?: boolean;
  indeterminate?: boolean;
  height?: number;
}) {
  return (
    <div
      className={s.progress}
      style={{ height }}
      data-paused={paused || undefined}
      data-done={done || undefined}
      data-indeterminate={indeterminate || percent == null || undefined}
      role="progressbar"
      aria-valuenow={percent ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div style={{ width: `${percent ?? 0}%` }} />
    </div>
  );
}
