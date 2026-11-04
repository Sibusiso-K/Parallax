import type { AdvisorAction, AdvisorSegment } from '../../../shared/scene/advisor-model';
import { verifyClaims, type ClaimRef } from '../../../shared/scene/claims';
import type { PathInput } from '../../../shared/engine/simulate';
import type { AdvisorAnswer, AdvisorScope, Segment } from './advisor-fixture';
import type { Session } from './session';

// The room's side of /api/advisor. The server checks the model's words; this checks its figures. Each one is resolved
// again against the snapshot on screen, and if any differs from what the server filled in, the whole answer is withheld.
// So a figure on screen always comes from this browser's own engine run, even with a model writing the sentences.

export interface AdvisorContext {
  business?: string;
  location?: string;
  decision?: string;
  story?: string;
}

export interface LiveExtras {
  object: { id: string; label: string; caption?: string } | null;
  context: AdvisorContext;
  history: { role: 'user' | 'advisor'; text: string }[];
}

export type LiveResult = { kind: 'answer'; answer: AdvisorAnswer } | { kind: 'fixture' } | { kind: 'failed'; message: string };

interface ModelReply {
  segments: AdvisorSegment[];
  actions?: AdvisorAction[];
  followups?: string[];
  dropped?: number;
  model?: string;
  latencyMs?: number;
}

const WITHHELD = "I can't back that up with this simulation, so I'm not showing it. Please ask again.";

/** Turns a checked reply into an answer card, or withholds it. Pure: the same reply and snapshot always give the same card. */
export function answerFromReply(session: Session, scope: AdvisorScope, question: string, reply: ModelReply): AdvisorAnswer {
  const snap = session.registry.get(scope.snapshotKey);
  const refs: ClaimRef[] = [];
  const segments: Segment[] = [];
  const shown: string[] = [];
  for (const s of reply.segments) {
    if (s.kind === 'text') segments.push({ kind: 'text', text: s.text });
    else {
      refs.push({ snapshotKey: scope.snapshotKey, scenario: s.scenario, metric: s.metric, ...(s.month !== undefined ? { month: s.month } : {}) });
      shown.push(s.text);
      segments.push({ kind: 'claim', index: refs.length - 1 });
    }
  }
  const base = { intent: 'live' as const, question, pathId: scope.pathId, snapshotKey: scope.snapshotKey, month: scope.month, source: 'model' as const, model: reply.model };
  const words = { tool: reply.model ?? 'muse-spark', ok: true, ms: reply.latencyMs ?? 0, detail: 'Wrote the words and suggested what to look at next.', snapshotKey: null };
  const guard = {
    tool: 'figure_guard',
    ok: !reply.dropped,
    ms: 0,
    detail: reply.dropped ? `Removed ${reply.dropped} sentence(s) that typed a figure or a promise.` : 'Every sentence passed: no typed amounts, no promises.',
    snapshotKey: scope.snapshotKey,
  };
  const withheld = (detail: string): AdvisorAnswer => ({
    ...base,
    status: 'withheld',
    segments: [{ kind: 'text', text: WITHHELD }],
    claims: [],
    trace: [words, guard, { tool: 'verify_claims', ok: false, ms: 0, detail, snapshotKey: scope.snapshotKey }],
  });
  if (!snap) return withheld('This snapshot is no longer available.');
  if (segments.length === 0) return withheld('No sentence survived the checks.');
  const verified = verifyClaims(session.registry, refs, new Set([scope.snapshotKey]));
  if (!verified.ok) return withheld(`${verified.failures.length} figure(s) did not match this snapshot.`);
  if (verified.claims.some((c, i) => c.text !== shown[i])) return withheld("A figure differed from this browser's own engine run.");
  return {
    ...base,
    status: 'answered',
    segments,
    claims: verified.claims,
    trace: [words, guard, { tool: 'verify_claims', ok: true, ms: 0, detail: `${verified.claims.length} figure(s) matched snapshot ${snap.inputHash}`, snapshotKey: scope.snapshotKey }],
    actions: reply.actions ?? [],
    followups: reply.followups ?? [],
  };
}

/** Asks the model. A connected model that fails says so; only a room with no model falls back to authored answers. */
export async function askLive(session: Session, scope: AdvisorScope, stressed: boolean, question: string, extras: LiveExtras, signal?: AbortSignal): Promise<LiveResult> {
  const entry = session.paths[scope.pathId];
  const path = entry.path as PathInput & { id: string };
  type Answered = ModelReply & { ok?: boolean; mode?: string; error?: string };
  let data: Answered | null = null;
  try {
    const res = await fetch('/api/advisor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal,
      body: JSON.stringify({
        question: question.slice(0, 600),
        month: scope.month,
        stressed,
        object: extras.object,
        path: { id: path.id, letter: scope.pathId, name: entry.name, summary: entry.summary, startingCash: path.startingCash, assumptions: path.assumptions },
        context: extras.context,
        history: extras.history.slice(-8).map((h) => ({ role: h.role, text: h.text.slice(0, 1200) })),
      }),
    });
    data = (await res.json()) as Answered | null;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    // The route answered with something other than JSON, or not at all: a static host, or the network is down.
    return { kind: 'fixture' };
  }
  if (data?.ok && data.mode === 'model' && Array.isArray(data.segments)) return { kind: 'answer', answer: answerFromReply(session, scope, question, data) };
  if (data?.ok && data.mode === 'fixture') return { kind: 'fixture' };
  return { kind: 'failed', message: typeof data?.error === 'string' && data.error ? data.error : "The advisor couldn't answer just now. Please ask again." };
}

export interface ServerAbilities {
  model: boolean;
  voice: boolean;
}

/** What this deployment has connected. A static host answers with no JSON at all, which reads as nothing connected. */
export async function serverAbilities(): Promise<ServerAbilities> {
  try {
    const res = await fetch('/api/health');
    const data = (await res.json()) as { modelReady?: unknown; voiceReady?: unknown };
    return { model: data.modelReady === true, voice: data.voiceReady === true };
  } catch {
    return { model: false, voice: false };
  }
}

/** The words on a suggested action's button. */
export function actionLabel(action: AdvisorAction, objectLabel: (id: string) => string): string {
  switch (action.type) {
    case 'show_month':
      return `Show month ${action.month}`;
    case 'late_payment':
      return action.on ? 'Turn on the late payment' : 'Turn off the late payment';
    case 'go_to':
      return `Go to ${objectLabel(action.object)}`;
    case 'switch_path':
      return `Switch to path ${action.path}`;
  }
}
