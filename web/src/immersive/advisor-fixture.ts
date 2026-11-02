import { resolveClaim, verifyClaims, type ClaimRef, type ResolvedClaim } from '../../../shared/scene/claims';
import type { PathLetter } from '../../../shared/scene/room-model';
import { runTool, type TraceLine } from '../../../shared/scene/tools';
import type { Session } from './session';

// The advisor, running as a labelled FIXTURE: no model is connected. A small allowlist of question patterns selects real
// local tools (the existing engine), and reviewed templates turn the verified results into prose. Every figure is a
// claim reference resolved and formatted by code; if any reference fails, the whole answer is withheld. The trace shows
// only what actually ran locally. Nothing here claims a model reasoned, and "matched" means matched to this simulation.

export const FIXTURE_LABEL = 'Fixture advisor: no model is connected. Answers are authored templates over real engine results.';
export const MATCHED_LABEL = 'Matched to this simulation';

export type Intent = 'why_month' | 'lowest' | 'delay_meaning' | 'unsupported';

export function classify(question: string): Intent {
  const q = question.toLowerCase();
  if (/\b(lowest|low point|worst|minimum)\b/.test(q)) return 'lowest';
  if (/\b(why|explain|how come|what happened|run out|runs out|short|negative|cash)\b/.test(q)) return 'why_month';
  if (/\b(late|delay|lever|payment|paid|stress)\b/.test(q)) return 'delay_meaning';
  return 'unsupported';
}

export type Segment = { kind: 'text'; text: string } | { kind: 'code'; text: string } | { kind: 'claim'; index: number };

export interface AdvisorAnswer {
  status: 'answered' | 'declined' | 'withheld';
  intent: Intent;
  question: string;
  pathId: PathLetter;
  snapshotKey: string;
  month: number;
  segments: Segment[];
  claims: ResolvedClaim[];
  trace: TraceLine[];
}

export interface AdvisorScope {
  pathId: PathLetter;
  snapshotKey: string;
  month: number;
}

const text = (t: string): Segment => ({ kind: 'text', text: t });
const claim = (index: number): Segment => ({ kind: 'claim', index });

export function answerQuestion(session: Session, scope: AdvisorScope, question: string): AdvisorAnswer {
  const ctx = session.toolContext();
  const snap = session.registry.get(scope.snapshotKey);
  const base = { question, pathId: scope.pathId, snapshotKey: scope.snapshotKey, month: scope.month };
  const trace: TraceLine[] = [];
  const withheld = (intent: Intent): AdvisorAnswer => ({
    ...base,
    intent,
    status: 'withheld',
    segments: [text("I can't back that up with this simulation, so I'm not showing it.")],
    claims: [],
    trace,
  });
  const intent = classify(question);
  if (!snap || intent === 'unsupported') {
    return {
      ...base,
      intent,
      status: 'declined',
      segments: [text('In this fixture I can answer three kinds of question: why cash looks the way it does in a month, where the lowest point is, and what the late payment does. I do not give advice or choose for you.')],
      claims: [],
      trace,
    };
  }
  const scopeArgs = { pathId: scope.pathId, case: 'likely' as const, snapshotKey: scope.snapshotKey };
  const stressed = snap.ref.setback !== null;
  let refs: ClaimRef[] = [];
  let segments: Segment[] = [];

  if (intent === 'why_month') {
    const t = runTool(ctx, scopeArgs, { name: 'inspect_month', args: { month: scope.month } });
    trace.push(t.trace);
    if (!t.ok) return withheld(intent);
    const m = scope.month;
    const k = snap.key;
    refs = [
      { snapshotKey: k, scenario: 'baseline', metric: 'cash_at_month', month: m },
      { snapshotKey: k, scenario: 'active', metric: 'cash_at_month', month: m },
      { snapshotKey: k, scenario: 'active', metric: 'net_at_month', month: m },
      { snapshotKey: k, scenario: 'active', metric: 'first_shortfall' },
    ];
    segments = stressed
      ? [
          text(`On path ${snap.ref.pathId}, at the end of month ${m}, the baseline cash is `), claim(0),
          text(' and with the late payment it is '), claim(1),
          text(`. Net cash flow in month ${m} is `), claim(2),
          text('. '), { kind: 'code', text: snap.terms.stressRule ?? '' },
          text(' Cash first runs out in '), claim(3), text('.'),
        ]
      : [
          text(`On path ${snap.ref.pathId}, at the end of month ${m}, cash is `), claim(0),
          text(`. Net cash flow in month ${m} is `), claim(2),
          text('. Pull the late-payment lever to see how a delayed receipt changes this month.'),
        ];
    if (!stressed) refs = [refs[0]!, refs[1]!, refs[2]!, refs[3]!];
  } else if (intent === 'lowest') {
    const k = snap.key;
    refs = [
      { snapshotKey: k, scenario: 'baseline', metric: 'lowest_cash' },
      { snapshotKey: k, scenario: 'active', metric: 'lowest_cash' },
    ];
    segments = stressed
      ? [text(`On path ${snap.ref.pathId} the baseline low point is `), claim(0), text(' and with the late payment it is '), claim(1), text('.')]
      : [text(`On path ${snap.ref.pathId} the lowest cash is `), claim(0), text('. Pull the lever to compare it with a late payment.')];
  } else {
    const t = runTool(ctx, scopeArgs, { name: 'inspect_month', args: { month: scope.month } });
    trace.push(t.trace);
    refs = [{ snapshotKey: snap.key, scenario: 'active', metric: 'first_shortfall' }];
    const rule = stressed ? snap.terms.stressRule : 'No stress is applied. The lever delays receipts using the engine’s late-payment rule.';
    segments = [{ kind: 'code', text: rule ?? '' }, text(' Cash first runs out in '), claim(0), text('.')];
  }

  const verified = verifyClaims(session.registry, refs, new Set([scope.snapshotKey]));
  trace.push({
    tool: 'verify_claims',
    ok: verified.ok,
    ms: 0,
    detail: verified.ok ? `${verified.claims.length} claims matched to snapshot ${snap.inputHash}` : `${verified.failures.length} claim(s) did not match; answer withheld`,
    snapshotKey: snap.key,
  });
  if (!verified.ok) return withheld(intent);
  // Segments refer to claim slots; the stressed template uses all four, the unstressed one skips index 1.
  const claims = refs.map((r) => {
    const x = resolveClaim(session.registry, r);
    return x.ok ? x.claim : null;
  });
  if (claims.some((c) => c === null)) return withheld(intent);
  const resolved = claims as ResolvedClaim[];
  return { ...base, intent, status: 'answered', segments: fixShortfallPhrase(segments, resolved), claims: resolved, trace };
}

const RUNS_OUT_LEAD = 'Cash first runs out in ';

/** "Cash first runs out in no shortfall within 36 months" is not a sentence: say it plainly when there is no shortfall. */
export function fixShortfallPhrase(segments: Segment[], claims: ResolvedClaim[]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const next = segments[i + 1];
    if (seg.kind === 'text' && seg.text.endsWith(RUNS_OUT_LEAD) && next?.kind === 'claim') {
      const c = claims[next.index];
      if (c && c.ref.metric === 'first_shortfall' && c.value === null) {
        out.push({ kind: 'text', text: `${seg.text.slice(0, -RUNS_OUT_LEAD.length)}Cash does not run out within the 36 months` });
        i += 1;
        continue;
      }
    }
    out.push(seg);
  }
  return out;
}
