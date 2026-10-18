"use client";

import { X } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "gold" | "ghost" | "danger" | "outline";

export function Button({
  variant = "outline",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "lg" && "h-12 px-6 text-base",
        variant === "primary" && "bg-ink text-arena hover:bg-white",
        variant === "gold" && "gold-plate hover:brightness-110",
        variant === "ghost" && "text-muted hover:bg-canvas-2 hover:text-ink",
        variant === "danger" && "bg-bad/15 text-bad ring-1 ring-bad/40 hover:bg-bad/25",
        variant === "outline" && "bg-canvas-2 text-ink ring-1 ring-rope hover:ring-muted",
        className,
      )}
    />
  );
}

export function Panel({ title, action, children, className, tone }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; tone?: "gold" | "mayhem" | "fury" }) {
  return (
    <section
      className={cn(
        "rounded-lg border border-rope bg-canvas/90 p-4 sm:p-5",
        tone === "gold" && "border-gold/40",
        tone === "mayhem" && "border-t-2 border-t-mayhem",
        tone === "fury" && "border-t-2 border-t-fury",
        className,
      )}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-cond text-lg font-semibold tracking-wide text-ink">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl sm:text-5xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "good" | "bad" | "gold" }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className={cn("font-cond text-2xl font-semibold tabular-nums", tone === "good" && "text-good", tone === "bad" && "text-bad", tone === "gold" && "gold-text")}>{value}</div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "mayhem" | "fury" | "gold" | "good" | "bad" | "legend"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold",
        tone === "neutral" && "bg-rope text-ink/80",
        tone === "mayhem" && "bg-mayhem/20 text-[#ff6b8a]",
        tone === "fury" && "bg-fury/20 text-[#7ea4ff]",
        tone === "gold" && "gold-plate",
        tone === "legend" && "bg-legend/20 text-legend",
        tone === "good" && "bg-good/15 text-good",
        tone === "bad" && "bg-bad/15 text-bad",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Meter({ value, max = 100, tone = "ink", label }: { value: number; max?: number; tone?: "ink" | "good" | "bad" | "gold" | "mayhem" | "fury"; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-rope" role="meter" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div
        className={cn(
          "h-full rounded-full",
          tone === "ink" && "bg-ink/70",
          tone === "good" && "bg-good",
          tone === "bad" && "bg-bad",
          tone === "gold" && "bg-gold",
          tone === "mayhem" && "bg-mayhem",
          tone === "fury" && "bg-fury",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  const full = Math.floor(value);
  const frac = value - full;
  const glyph = frac >= 0.75 ? "¾" : frac >= 0.5 ? "½" : frac >= 0.25 ? "¼" : "";
  return (
    <span className={cn("font-cond font-semibold text-gold-light", className)} aria-label={`${value} stars`}>
      {"★".repeat(full)}
      {glyph && <span className="text-sm">{glyph}</span>}
      {full === 0 && !glyph && "DUD"}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-md border border-rope bg-arena px-3 text-sm text-ink placeholder:text-muted/60 focus:border-gold/60 focus:outline-none";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn("max-h-[92dvh] w-full overflow-y-auto outline-none rounded-t-xl border border-rope bg-canvas p-5 shadow-2xl sm:rounded-xl", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={id} className="font-display text-2xl">
            {title}
          </h2>
          <button onClick={onClose} className="rounded p-1 text-muted hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmButton({ onConfirm, children, prompt, variant = "danger" }: { onConfirm: () => void; children: ReactNode; prompt: string; variant?: ButtonVariant }) {
  return (
    <Button
      variant={variant}
      onClick={() => {
        if (window.confirm(prompt)) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-rope p-8 text-center">
      <p className="font-cond text-xl font-semibold">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-canvas-2 p-1" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", o.value === value ? "bg-ink text-arena" : "text-muted hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
