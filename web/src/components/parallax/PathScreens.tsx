import { useEffect, useRef, useState } from "react";
import { LETTERS, useParallax, type Letter } from "@/lib/parallax-store";
import { describeAssumption, formatMoney, parseAmount } from "@/lib/format";
import type { Assumption } from "@/lib/types";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Avatar, Button, Drawer, LetterBadge, SavingsBand, ScreenTitle, SourceChip, inputCls } from "./shared";

export function PathsScreen() {
  const { paths, active, set, go, sims, panel } = useParallax();
  const mobile = useIsMobile();
  const idx = LETTERS.indexOf(active);
  const startX = useRef<number | null>(null);
  const move = (d: number) => set({ active: LETTERS[(idx + d + 3) % 3] });

  return (
    <section className="mx-auto max-w-xl screen-in">
      <ScreenTitle eyebrow="Three possible futures" title="Which future do you want to hear from first?">
        {mobile ? "Swipe to see each path." : "Use the arrow keys or the buttons to bring a path forward."}
      </ScreenTitle>
      <div className="mb-4 flex items-center gap-2 no-print">
        {LETTERS.map((l) => (
          <Button key={l} variant={l === active ? "path" : "outline"} size="sm" data-path={l} aria-pressed={l === active} onClick={() => set({ active: l })}>
            {l}
          </Button>
        ))}
        <span className="ml-auto" />
        <Button variant="ghost" size="sm" aria-label="Previous path" onClick={() => move(-1)}>←</Button>
        <Button variant="ghost" size="sm" aria-label="Next path" onClick={() => move(1)}>→</Button>
      </div>
      <div
        className={cn("depth-stack snap-mobile", !mobile && "pt-10")}
        tabIndex={0}
        aria-label="Path cards"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          if (e.key === "ArrowLeft") move(-1);
        }}
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (mobile || startX.current === null) return;
          const dx = e.clientX - startX.current;
          if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
          startX.current = null;
        }}
        onScroll={(e) => {
          if (!mobile) return;
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / (el.scrollWidth / 3));
          if (LETTERS[i] && LETTERS[i] !== active) set({ active: LETTERS[i] });
        }}
      >
        {paths.map((p) => {
          const depth = (LETTERS.indexOf(p.letter) - idx + 3) % 3;
          const front = depth === 0;
          return (
            <article
              key={p.id}
              data-path={p.letter}
              data-depth={depth}
              inert={!mobile && !front}
              aria-hidden={!mobile && !front}
              className="depth-layer surface border-t-4 border-t-path p-5"
            >
              <div className="flex items-center gap-4">
                <Avatar letter={p.letter} src={p.avatarUrl} vtName={front ? "pm-avatar" : undefined} />
                <div>
                  <div className="flex items-center gap-2">
                    <LetterBadge letter={p.letter} />
                    <h2 className="text-xl font-semibold">{p.name}</h2>
                  </div>
                  <p className="mt-1 text-muted-foreground">{p.summary}</p>
                </div>
              </div>
              <div className="mt-4">{sims[p.letter] && <SavingsBand sim={sims[p.letter]} letter={p.letter} />}</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="outline" aria-expanded={panel?.letter === p.letter} onClick={() => set({ panel: { letter: p.letter } })}>
                  Show assumptions
                </Button>
                <Button
                  variant="path"
                  className="sm:ml-auto"
                  onClick={() => {
                    set({ active: p.letter });
                    go("chat");
                  }}
                >
                  Talk to your future self
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      <div className="mt-6">
        <Button variant="ghost" onClick={() => go("profile")}>Back to you, today</Button>
      </div>
    </section>
  );
}

function Row({ a, letter, highlight }: { a: Assumption; letter: Letter; highlight: boolean }) {
  const { set } = useParallax();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ low: "", base: "", high: "" });
  const [err, setErr] = useState("");
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (highlight) ref.current?.scrollIntoView({ block: "center" });
  }, [highlight]);
  const save = () => {
    const n = [v.low, v.base, v.high].map((x) => parseAmount(x)?.base);
    if (n.some((x) => x === undefined)) return setErr("Each box needs an amount, like 8000 or 8k.");
    const [low, base, high] = n as [number, number, number];
    if (!(low <= base && base <= high)) return setErr("Low must be at most usual, and usual at most high.");
    set((s) => ({
      paths: s.paths.map((p) =>
        p.letter !== letter ? p : { ...p, assumptions: p.assumptions.map((x) => (x.id === a.id ? { ...x, low, base, high, source: "you" } : x)) },
      ),
    }));
    setEdit(false);
  };
  return (
    <li ref={ref} className={cn("rounded-xl p-3 transition-colors duration-300", highlight && "bg-highlight ring-2 ring-path")}>
      <div className="flex items-start gap-2">
        <span className="chip font-mono">{a.id}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">{a.label} <SourceChip source={a.source} /></p>
          <p className="text-sm text-muted-foreground tabular-nums">{describeAssumption(a)}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={edit}
          onClick={() => {
            setV({ low: String(a.low), base: String(a.base), high: String(a.high) });
            setErr("");
            setEdit(!edit);
          }}
        >
          {edit ? "Cancel" : "Edit"}
        </Button>
      </div>
      {edit && (
        <form className="mt-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <div className="grid grid-cols-3 gap-2">
            {(["low", "base", "high"] as const).map((k) => (
              <label key={k} className="text-sm text-muted-foreground">
                {k === "base" ? "usually" : k}
                <input className={`${inputCls} mt-1 px-3`} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} inputMode="numeric" />
              </label>
            ))}
          </div>
          {err && <p className="mt-2 text-sm text-destructive" role="alert">{err}</p>}
          <Button type="submit" className="mt-3">Save and re-run</Button>
        </form>
      )}
    </li>
  );
}

export function AssumptionsPanel() {
  const { panel, set, pathOf, sims } = useParallax();
  const p = panel ? pathOf(panel.letter) : undefined;
  return (
    <Drawer open={!!panel} onClose={() => set({ panel: null })} title={p ? `Assumptions · ${p.letter}: ${p.name}` : "Assumptions"}>
      {p && (
        <div data-path={p.letter}>
          <SavingsBand sim={sims[p.letter]} letter={p.letter} />
          <p className="mt-3 text-sm text-muted-foreground">Starting savings: {formatMoney(p.startingSavings)}. Bad case uses low income and high costs; good case the reverse.</p>
          <ul className="mt-4 space-y-1">
            {p.assumptions.map((a) => (
              <Row key={a.id} a={a} letter={p.letter} highlight={panel?.rowId === a.id} />
            ))}
          </ul>
        </div>
      )}
    </Drawer>
  );
}
