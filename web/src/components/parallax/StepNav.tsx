// Every screen's Back and one primary Next, from lib/flow.ts. A screen can relabel or guard Next, never remove it.
import type { ReactNode } from "react";
import { backOf, nextOf, type FlowContext } from "@/lib/flow";
import { useParallax, type Step } from "@/lib/parallax-store";
import { Button, cx } from "./shared";

export function useFlowContext(): FlowContext {
  const { paths, intake, fields } = useParallax();
  return { hasPaths: paths.length > 0, hasRoom: fields.decisionType === "contract", hasIntake: intake !== null };
}

export function StepNav({
  nextLabel,
  onNext,
  nextDisabled,
  hint,
  children,
  className,
}: {
  nextLabel?: string;
  /** Runs instead of going to the next screen, for a screen whose Next does work first. */
  onNext?: () => void;
  nextDisabled?: boolean;
  /** Says why Next is disabled. */
  hint?: string;
  /** Extra, quieter actions between Back and Next. */
  children?: ReactNode;
  className?: string;
}) {
  const { step, go } = useParallax();
  const ctx = useFlowContext();
  const next = nextOf(step, ctx);
  const back = backOf(step, ctx);
  const showBack = back && !(next && back.to === next.to);
  return (
    <>
      <div className={cx("actions-row stepnav", className)}>
        {showBack && (
          <Button variant="ghost" onClick={() => go(back.to as Step)}>
            ← {back.label}
          </Button>
        )}
        {children}
        {next && (
          <Button variant="primary" size="lg" className="ml-auto" disabled={nextDisabled} onClick={onNext ?? (() => go(next.to))}>
            {nextLabel ?? next.label} →
          </Button>
        )}
      </div>
      {nextDisabled && hint && <p className="hint stepnav-hint">{hint}</p>}
    </>
  );
}
