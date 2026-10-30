import { cva, type VariantProps } from "class-variance-authority";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import type { Letter } from "@/lib/parallax-store";
import type { Simulation, Source } from "@/lib/types";

export const buttonVariants = cva(
  "tap inline-flex items-center justify-center gap-2 rounded-full px-5 text-base font-medium transition-[background,color,border,box-shadow,opacity] duration-150 ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:opacity-90",
        outline: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        path: "border-2 border-path bg-path-soft text-foreground hover:bg-card",
        quiet: "px-3 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline",
      },
      size: { md: "", lg: "min-h-12 px-7 text-lg", sm: "px-4 text-sm" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function ParallaxMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <rect x="4" y="18" width="26" height="26" rx="7" fill="var(--path-a)" opacity="0.9" />
      <rect x="11" y="11" width="26" height="26" rx="7" fill="var(--path-b)" opacity="0.85" />
      <rect x="18" y="4" width="26" height="26" rx="7" fill="var(--path-c)" opacity="0.85" />
    </svg>
  );
}

export function LetterBadge({ letter, className }: { letter: Letter; className?: string }) {
  return (
    <span
      data-path={letter}
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-lg border-2 border-path bg-path-soft px-1.5 text-sm font-bold text-path-ink",
        className,
      )}
    >
      {letter}
    </span>
  );
}

export function Avatar({
  letter,
  src,
  size = 72,
  vtName,
  className,
}: {
  letter: Letter;
  src?: string;
  size?: number;
  vtName?: string;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth) setLoaded(true);
  }, [src]);
  return (
    <div
      data-path={letter}
      className={cn("relative shrink-0 overflow-hidden rounded-2xl bg-path-soft", className)}
      style={{ width: size, height: size, viewTransitionName: vtName }}
    >
      <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <circle cx="32" cy="25" r="12" fill="var(--path)" opacity="0.55" />
        <path d="M10 64c2-14 11-22 22-22s20 8 22 22z" fill="var(--path)" opacity="0.55" />
      </svg>
      {src && (
        <img
          ref={img}
          src={src}
          alt=""
          width={size}
          height={size}
          onLoad={() => setLoaded(true)}
          data-loaded={loaded}
          className="avatar-img absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

const SOURCE_TEXT: Record<Source, string> = {
  you: "you",
  default: "default",
  template: "template",
  ai: "AI-suggested",
};
export function SourceChip({ source }: { source?: Source }) {
  if (!source) return null;
  return (
    <span className={cn("chip", source === "you" ? "bg-path-soft" : "border border-dashed border-input bg-card")}>
      {SOURCE_TEXT[source]}
    </span>
  );
}

export function at(sim: Simulation, kase: "bad" | "likely" | "good", month: number) {
  return sim[kase].rows[month - 1]?.savings ?? 0;
}

/** Soft bad→good bar with a marker for likely. Figures are real text. */
export function SavingsBand({ sim, letter, month = 36 }: { sim: Simulation; letter: Letter; month?: number }) {
  const bad = at(sim, "bad", month);
  const likely = at(sim, "likely", month);
  const good = at(sim, "good", month);
  const span = Math.max(1, good - bad);
  const pos = (v: number) => `${Math.min(100, Math.max(0, ((v - bad) / span) * 100))}%`;
  const runOut = sim.bad.shortfallMonths[0];
  return (
    <div data-path={letter} className="rounded-xl bg-muted/60 p-4">
      <p className="text-sm font-medium text-muted-foreground">Savings at month {month}</p>
      <div className="relative mt-3 h-3" aria-hidden="true">
        <div
          className="absolute inset-0 rounded-full transition-[background] duration-[600ms]"
          style={{
            background:
              "linear-gradient(90deg, color-mix(in oklab, var(--path) 12%, var(--card)), color-mix(in oklab, var(--path) 70%, var(--card)))",
          }}
        />
        {bad < 0 && good > 0 && (
          <div className="absolute -top-1 h-5 w-px bg-muted-foreground/60" style={{ left: pos(0) }} />
        )}
        <div
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-path shadow transition-[left] duration-[600ms] ease-[var(--ease-out)]"
          style={{ left: pos(likely) }}
        />
      </div>
      <p className="mt-3 text-[0.95rem] leading-relaxed tabular-nums">
        <span className="text-muted-foreground">Bad</span> {formatMoney(bad)}
        <span className="text-muted-foreground"> · </span>
        <span className="font-semibold">
          <span className="font-normal text-muted-foreground">Likely</span> {formatMoney(likely)}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-muted-foreground">Good</span> {formatMoney(good)}
      </p>
      {runOut && <p className="mt-1 text-sm text-foreground">In the bad case, savings run out in month {runOut}.</p>}
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    if (!open) return;
    prev.current = document.activeElement;
    const t = setTimeout(() => panel.current?.querySelector<HTMLElement>("[data-autofocus],button")?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      (prev.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);
  return (
    <div className={cn("fixed inset-0 z-50 no-print", !open && "pointer-events-none")} inert={!open}>
      <div
        className={cn("drawer drawer-backdrop absolute inset-0", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panel}
        data-open={open}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "drawer absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-card shadow-2xl",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label={`Close ${title}`}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative z-10 px-4 py-6 text-center text-sm text-muted-foreground no-print">
      Not financial advice · One possible future, not a prediction
    </footer>
  );
}

export function ScreenTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      {eyebrow && <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>}
      <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{title}</h1>
      {children && <div className="mt-3 text-muted-foreground">{children}</div>}
    </header>
  );
}

export const inputCls =
  "w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-[border,box-shadow] duration-150 focus-visible:border-ring";
