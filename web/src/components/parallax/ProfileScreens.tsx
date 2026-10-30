import { useEffect, useState } from "react";
import { FIELD_LABELS, mockApi } from "@/lib/parallax-api";
import { LETTERS, useParallax } from "@/lib/parallax-store";
import { formatField } from "@/lib/format";
import type { FieldKey } from "@/lib/types";
import { Button, ScreenTitle } from "./shared";
import { cn } from "@/lib/utils";

const FACTS: FieldKey[] = [
  "ageBand",
  "province",
  "takeHome",
  "sideIncome",
  "essentialExpenses",
  "familySupportMonthly",
  "debtRepayments",
  "savings",
  "riskComfort",
];

export function YouTodayCard({ compact }: { compact?: boolean }) {
  const { fields, assumed, go } = useParallax();
  const goals = String(fields.goals ?? "")
    .split(/,|\band\b/)
    .map((g) => g.trim())
    .filter(Boolean);
  return (
    <article className="surface relative p-5 sm:p-6" style={{ viewTransitionName: "you-today" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">You, today</p>
          <h2 className="mt-1 text-2xl font-semibold">{String(fields.decision ?? "Your decision")}</h2>
        </div>
        {!compact && (
          <Button variant="ghost" size="sm" onClick={() => go("heard")}>
            Edit
          </Button>
        )}
      </div>
      <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {FACTS.filter((k) => fields[k] !== undefined).map((k) => (
          <div key={k}>
            <dt className="text-sm text-muted-foreground">{FIELD_LABELS[k]}</dt>
            <dd className="flex flex-wrap items-center gap-2 tabular-nums">
              {formatField(fields[k])}
              {assumed.includes(k) && <span className="chip border border-dashed border-input bg-card">assumed</span>}
            </dd>
          </div>
        ))}
      </dl>
      {goals.length > 0 && (
        <div className="mt-5">
          <p className="text-sm text-muted-foreground">Priorities</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {goals.map((g) => (
              <span key={g} className="chip text-[0.9375rem]">
                {g}
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const STEPS = ["Reading your situation", "Computing ranges in code", "Drawing your future self"];

export function GeneratingScreen() {
  const { profile, set, go } = useParallax();
  const [ready, setReady] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      await new Promise((r) => setTimeout(r, 1100));
      if (!alive) return;
      setReady(1);
      const cards = await mockApi.paths(profile);
      cards.forEach((c) => mockApi.simulate(c));
      await new Promise((r) => setTimeout(r, 900));
      if (!alive) return;
      set({ paths: cards, active: "A" });
      setReady(2);
      await Promise.all(
        cards.map(
          (c) =>
            new Promise((r) => {
              if (!c.avatarUrl) return r(null);
              const i = new Image();
              i.onload = i.onerror = () => r(null);
              i.src = c.avatarUrl;
            }),
        ),
      );
      await new Promise((r) => setTimeout(r, 900));
      if (!alive) return;
      setReady(3);
      await new Promise((r) => setTimeout(r, 700));
      if (alive) go("profile");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="mx-auto max-w-2xl screen-in">
      <ScreenTitle eyebrow="Step 3 of 3" title="Drawing three possible futures" />
      <div className="relative mt-12 sm:mt-16">
        {LETTERS.map((l, i) => {
          const done = ready > i;
          const off = (3 - i) * 14;
          return (
            <svg
              key={l}
              data-path={l}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              style={{ transform: `translate(${off}px, ${-off}px)` }}
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <rect
                x="0.5"
                y="0.5"
                width="99"
                height="99"
                rx="4"
                pathLength={1}
                vectorEffect="non-scaling-stroke"
                strokeWidth="2"
                className="draw-path draw-fill"
                data-state={done ? "ready" : ready === i ? "drawing" : "waiting"}
                stroke={done ? "var(--path)" : "var(--muted-foreground)"}
                fill="var(--path)"
                fillOpacity={done ? 0.1 : 0}
              />
            </svg>
          );
        })}
        <div className="relative">
          <YouTodayCard compact />
        </div>
      </div>
      <ol className="mt-10 space-y-2" aria-live="polite">
        {STEPS.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex items-center gap-3 transition-colors duration-300",
              ready >= i ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <span
              aria-hidden="true"
              data-path={LETTERS[i]}
              className={cn(
                "h-3 w-3 rounded-full border-2 border-path transition-colors duration-[600ms]",
                ready > i ? "bg-path" : "bg-transparent",
              )}
            />
            {s}
            <span className="sr-only">{ready > i ? "done" : ready === i ? "in progress" : "waiting"}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProfileScreen() {
  const { go } = useParallax();
  return (
    <section className="mx-auto max-w-2xl screen-in">
      <ScreenTitle eyebrow="Your starting point" title="This is you, today">
        Every future starts here. Anything marked “assumed” is a default you can change.
      </ScreenTitle>
      <YouTodayCard />
      <div className="mt-6 flex justify-end">
        <Button size="lg" onClick={() => go("paths")}>
          Meet your three futures
        </Button>
      </div>
    </section>
  );
}
