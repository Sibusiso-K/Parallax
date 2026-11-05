import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useParallax, type Letter } from "@/lib/parallax-store";
import type { Source } from "@/lib/types";

/** Class names joined, skipping the empty ones. */
export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export const PATH_COLOR: Record<Letter, string> = { A: "#3f6fd8", B: "#d9825f", C: "#7a5cc7" };
const PATH_TINT: Record<Letter, string> = { A: "#e4ebfb", B: "#f8e8e0", C: "#ece6f7" };

export function ParallaxMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" focusable="false">
      <rect x="3" y="9" width="17" height="17" rx="3" fill={PATH_COLOR.A} />
      <rect x="9" y="5" width="17" height="17" rx="3" fill={PATH_COLOR.B} fillOpacity=".85" />
      <rect x="14" y="11" width="17" height="17" rx="3" fill={PATH_COLOR.C} fillOpacity=".85" />
    </svg>
  );
}

/** The path's letter in its colour, as a small round badge. */
export function Badge({ letter }: { letter: Letter }) {
  return <span className={`badge p-${letter}`}>{letter}</span>;
}

/** The founder on a path: the Muse Image portrait when there is one, else a plain silhouette in the path's colour. */
export function Avatar({ letter, src, size = 72, className }: { letter: Letter; src?: string; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (src) {
    return <img className={cx("avatar", className)} src={src} alt="" width={size} height={size} style={style} decoding="async" />;
  }
  return (
    <svg className={cx("avatar", className)} viewBox="0 0 96 96" aria-hidden="true" style={style}>
      <rect width="96" height="96" fill={PATH_TINT[letter]} />
      <circle cx="48" cy="41" r="14" fill={PATH_COLOR[letter]} />
      <path d="M22 96 C24 72 34 63 48 63 S72 72 74 96 Z" fill={PATH_COLOR[letter]} opacity=".85" />
    </svg>
  );
}

export type Kind = "you" | "followup" | "range" | "placeholder" | "example" | "assumed" | "default" | "ai";
const KIND_LABEL: Record<Kind, string> = {
  you: "you",
  followup: "from a follow-up",
  range: "range",
  placeholder: "estimate",
  example: "example",
  assumed: "assumed",
  default: "default",
  ai: "AI-suggested",
};
const KIND_CLASS: Record<Kind, string> = {
  you: "you",
  followup: "followup",
  range: "range",
  placeholder: "placeholder",
  example: "example",
  assumed: "placeholder",
  default: "placeholder",
  ai: "range",
};
export const SOURCE_KIND: Record<Source, Kind> = { you: "you", default: "default", template: "placeholder", ai: "ai" };

/** A small pill that says where a figure came from. */
export function Src({ kind, children }: { kind: Kind; children?: ReactNode }) {
  return <span className={`src ${KIND_CLASS[kind]}`}>{children ?? KIND_LABEL[kind]}</span>;
}

type Variant = "outline" | "primary" | "ghost" | "link" | "path";
/** A button in the Control Room style. "path" takes its colour from the parent's p-A, p-B or p-C class. */
export function Button({
  variant = "outline",
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "lg" }) {
  return <button type="button" className={cx("btn", variant !== "outline" && `btn-${variant}`, size && `btn-${size}`, className)} {...props} />;
}

export function Footer() {
  return <footer className="footer no-print">Not financial advice · One possible future, not a prediction</footer>;
}

/** Shown on a path screen until the three paths exist. */
export function NoPaths() {
  const { go } = useParallax();
  return (
    <section className="screen">
      <div className="pagehead">
        <h1>Your futures aren't ready yet</h1>
        <div className="sub">Check your figures first; the futures are built from them.</div>
      </div>
      <div className="actions-row">
        <Button variant="primary" onClick={() => go("heard")}>Check my figures</Button>
      </div>
    </section>
  );
}

/** A panel that slides over the screen from the right. It is hidden while closed. */
export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <div className="drawer-root no-print" hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h2 className="drawer-title">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}
