import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LABELS, type Actor, type Breakpoint, type Proposal, type SwarmRequest, type SwarmResult, type Trace, type WorldOp } from '../../../../shared/swarm/contracts.js';
import type { Repainted, RepaintStep } from './repaint.js';
import type { AdvisorSegment } from '../../../../shared/scene/advisor-model.js';
import { inputKey } from '../../../../shared/swarm/engine-tools.js';
import { formatRand } from '../../../../shared/guard/figures.js';
import { LINKS, NODE_POSITIONS } from './layout.js';
import { fixtureBeat, reviewStream } from './stream.js';
import './mission-control.css';

export interface MissionControlProps {
  request: SwarmRequest;
  onApply: (proposal: Proposal) => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>;
  onSpeech?: (segments: AdvisorSegment[]) => void;
  onWorldOp?: (operation: WorldOp) => void;
  /** Parent increments only for deliberate founder actions; absent means review-button only. */
  trigger?: string | number;
  /** Called when a review starts, so the room knows the founder has convened the board. */
  onStarted?: () => void;
  /** The room moves aside while the board is open, so the person stays in view. */
  onOpenChange?: (open: boolean) => void;
  /** Repaints the photograph the founder is looking at. Visual only. */
  onRepaint?: (op: Extract<WorldOp, { type: 'scene' }>, mood: 'golden' | 'night' | 'calm' | null, onStep: (step: RepaintStep) => void, signal: AbortSignal) => Promise<Repainted | null>;
}
const months = (n: number) => `${n} month${n === 1 ? '' : 's'}`;
/** Written by code from the engine's search for the longest delay this path survives. */
function breakLine(b: Breakpoint): string | null {
  if (!b.applicable) return null;
  if (b.baselineAlreadyShort) return 'This plan goes below zero even if the client pays on time.';
  if (b.longestDelayMonths === null) return null;
  if (b.capped) return `This plan survives a client paying up to ${months(b.longestDelayMonths)} late.`;
  if (b.longestDelayMonths === 0) return 'This plan cannot take any delay. One month late and cash goes below zero.';
  return `This plan survives a client paying ${months(b.longestDelayMonths)} late. One month more and cash goes below zero.`;
}
function runSize(result: SwarmResult) {
  const steps = result.traces.filter(t => t.status === 'done').length;
  const tokens = result.traces.reduce((sum, t) => sum + (t.inputTokens ?? 0) + (t.outputTokens ?? 0), 0);
  return result.mode === 'fixture' ? `${steps} steps · no model calls` : `${steps} steps · ${tokens.toLocaleString('en-ZA')} tokens`;
}
const SOURCE_NOTE: Record<string, string> = { 'quote-found-on-page': 'found on the live page by code', 'url-and-snippet-in-search-results': 'found in the search result by code', 'url-in-search-results': 'found by search, not confirmed on the page' };
const actors = Object.keys(NODE_POSITIONS) as Actor[];
function Segments({ value }: { value: AdvisorSegment[] }) {
  return <>{value.map((s, i) => s.kind === 'figure' ? <strong key={i} title={`${s.scenario}: ${s.metric.replaceAll('_', ' ')}`}>{s.text}</strong> : <span key={i}>{s.text}</span>)}</>;
}

/** Unmounted until Worker A integrates it. No globals, scene edits or automatic assumption writes. */
export function MissionControl({ request, onApply, onSpeech, onWorldOp, trigger, onStarted, onOpenChange, onRepaint }: MissionControlProps) {
  const [open, setOpenState] = useState(false), [busy, setBusy] = useState(false);
  const setOpen = (value: boolean) => { setOpenState(value); onOpenChange?.(value); };
  const panel = useRef<HTMLElement | null>(null), brief = useRef<HTMLElement | null>(null);
  const [traces, setTraces] = useState<Partial<Record<Actor, Trace>>>({});
  const [selected, setSelected] = useState<Actor>('orchestrator');
  const [result, setResult] = useState<SwarmResult | null>(null);
  const [mode, setMode] = useState('Ready to review'), [error, setError] = useState('');
  const [applying, setApplying] = useState<string | null>(null), [applied, setApplied] = useState<string[]>([]);
  const [question, setQuestion] = useState('');
  const abort = useRef<AbortController | null>(null), generation = useRef(0);
  const applyLock = useRef(false);
  const latest = useRef(request); latest.current = request;
  const key = inputKey(request), liveKey = useRef(key); liveKey.current = key;
  const selectedTrace = traces[selected];
  const current = result?.inputKey === key;
  const paint = async (op: Extract<WorldOp, { type: 'scene' }>, mood: 'golden' | 'night' | 'calm' | null, signal: AbortSignal, ticket: number) => {
    if (!onRepaint) return;
    const live = () => !signal.aborted && ticket === generation.current;
    const step = (agent: 'painter' | 'art', status: Trace['status'], text: string, context: unknown, latencyMs = 0): Trace => ({ agent, model: agent === 'painter' ? 'muse-image-1.0' : 'muse-spark-1.3', status, step: text, context, tools: [], sources: [], inputTokens: null, outputTokens: null, costUsd: null, latencyMs });
    const look = { question: 'Any text, numerals or logos in this image?', rule: 'Code rejects the image if any are seen.' };
    try {
      const done = await onRepaint(op, mood, s => {
        if (!live()) return;
        if (s.stage === 'painting') setTraces(old => ({ ...old, painter: step('painter', 'running', s.attempt > 1 ? 'Painting the room again' : 'Repainting the room', { instruction: op.prompt }), art: undefined }));
        if (s.stage === 'reviewing') setTraces(old => ({ ...old, painter: step('painter', 'done', 'Room repainted', { instruction: op.prompt }, s.ms), art: step('art', 'running', 'Looking for text and numbers', look) }));
        if (s.stage === 'rejected') setTraces(old => ({ ...old, art: step('art', 'failed', `Rejected: ${s.note ?? 'failed the check'}`, look) }));
        if (s.stage === 'done') setTraces(old => ({ ...old, art: step('art', 'done', `Passed: ${s.note ?? 'no text, numerals or logos'}`, look) }));
        if (s.stage === 'unavailable') setTraces(old => ({ ...old, painter: step('painter', 'failed', 'No key here, so the room stays as it is', { instruction: op.prompt }) }));
      }, signal);
      if (!done && live()) setTraces(old => old.painter?.status === 'running' ? { ...old, painter: step('painter', 'failed', 'The room stays as it is', { instruction: op.prompt }) } : old);
    } catch { if (live()) setTraces(old => ({ ...old, painter: step('painter', 'failed', 'Repaint unavailable. The room stays as it is', { instruction: op.prompt }), ...(old.art?.status === 'running' ? { art: step('art', 'failed', 'Could not check it, so it was not shown', look) } : {}) })); }
  };
  const run = async () => {
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    const ticket = ++generation.current;
    onStarted?.();
    setBusy(true); setOpen(true); setResult(null); setTraces({}); setError(''); setApplied([]); setSelected('orchestrator');
    let fixtureReplay = false;
    try {
      await reviewStream({ ...latest.current, event: question.trim() || latest.current.event }, async event => {
        if (event.type === 'start') fixtureReplay = event.mode === 'fixture';
        if (fixtureReplay && event.type === 'trace') await fixtureBeat(controller.signal);
        if (controller.signal.aborted || ticket !== generation.current) return;
        if (event.type === 'start') setMode(event.mode === 'fixture' ? 'Offline fixture replay · no model calls' : 'Live Meta review');
        if (event.type === 'trace') setTraces(old => ({ ...old, [event.trace.agent]: event.trace }));
        if (event.type === 'sources') setResult(old => old ? { ...old, sources: event.sources } : old);
        if (event.type === 'result') {
          // The room answers as soon as the board does: the light changes, she speaks, and the walls change behind her.
          const mood = event.result.worldOps.find((op): op is Extract<WorldOp, { type: 'mood' }> => op.type === 'mood');
          const scene = event.result.worldOps.find((op): op is Extract<WorldOp, { type: 'scene' }> => op.type === 'scene');
          if (mood) onWorldOp?.(mood);
          if (event.result.speech.length) onSpeech?.(event.result.speech);
          if (scene && event.result.mode !== 'fixture') void paint(scene, mood?.value ?? null, controller.signal, ticket);
          setResult(event.result); setMode(event.result.mode === 'fixture' ? 'Offline fixture · no model calls' : event.result.mode === 'partial' ? 'Partial review · some steps unavailable' : 'Live review complete');
        }
      }, controller.signal);
    } catch (e) { if (!controller.signal.aborted && ticket === generation.current) setError(e instanceof Error ? e.message : 'Review unavailable.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  useEffect(() => {
    generation.current++; abort.current?.abort(); setBusy(false); setResult(null); setTraces({}); setMode('Decision changed · ready to review'); setApplied([]);
    return () => { generation.current++; abort.current?.abort(); };
  }, [key]);
  const runRef = useRef(run); runRef.current = run;
  // The brief is what the founder came for: bring it into view as soon as it exists.
  useEffect(() => { if (result && brief.current && panel.current) panel.current.scrollTo({ top: brief.current.offsetTop - 12, behavior: 'smooth' }); }, [result]);
  useEffect(() => { if (trigger !== undefined) void runRef.current(); }, [trigger]);
  const apply = async (p: Proposal) => {
    if (p.inputKey !== liveKey.current || applyLock.current) return;
    applyLock.current = true;
    setApplying(p.id); setError('');
    try {
      const response = await onApply(p);
      if (response.ok) setApplied(old => [...old, p.id]); else setError(response.error ?? 'That change could not be applied. Review the current assumptions.');
    } catch { setError('That change could not be applied.'); }
    finally { applyLock.current = false; setApplying(null); }
  };
  if (!open) return <button className="mc-launch" onClick={() => setOpen(true)}><span aria-hidden="true">✳</span> Convene the board <small>A swarm of agents challenges this plan. Watch each step.</small></button>;
  return <aside className="mc" aria-label="Decision review board" ref={panel}>
    <header className="mc-head"><div><p className="mc-mode" role="status">{mode}</p><h2>A second look at your future.</h2></div><button className="mc-close" aria-label="Close decision review" onClick={() => setOpen(false)}>×</button></header>
    <form className="mc-question" onSubmit={e => { e.preventDefault(); void run(); }}><label className="mc-sr" htmlFor="mc-question">Question for the board</label><input id="mc-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={600} placeholder={request.event} /><button type="submit" disabled={busy}>{busy ? 'Reviewing…' : result ? 'Review again' : 'Start review'}</button>{busy && <button type="button" onClick={() => { generation.current++; abort.current?.abort(); setBusy(false); setMode('Review stopped'); }}>Stop</button>}</form>
    <div className="mc-workspace">
      <div className="mc-map"><svg viewBox="0 0 520 490" role="group" aria-label="Agent review graph">
        <title>Conductor, specialist agents, future self and code verifier</title>
        {LINKS.map(([from, to]) => { const a = NODE_POSITIONS[from], b = NODE_POSITIONS[to]; return <path key={`${from}-${to}`} className={`mc-link ${traces[to]?.status === 'running' ? 'is-running' : ''} ${traces[to]?.status === 'done' ? 'is-done' : ''}`} d={`M${a.x},${a.y} Q${a.x},${b.y} ${b.x},${b.y}`} />; })}
        {actors.map(actor => { const p = NODE_POSITIONS[actor], trace = traces[actor]; return <g key={actor} className={`mc-node ${trace ? 'is-started' : ''} ${selected === actor ? 'is-selected' : ''} ${trace?.status === 'running' ? 'is-running' : ''}`} transform={`translate(${p.x},${p.y})`} role="button" tabIndex={0} aria-label={`${LABELS[actor]}: ${trace?.step ?? 'Waiting'}`} aria-pressed={selected === actor} onClick={() => setSelected(actor)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(actor); } }}>
          <g className={trace ? 'mc-arrived' : ''} style={{ '--mc-from-x': `${260 - p.x}px`, '--mc-from-y': `${154 - p.y}px` } as CSSProperties}><circle className="mc-orbit" r={actor === 'orchestrator' ? 33 : 25} /><circle className="mc-core" r={actor === 'orchestrator' ? 24 : 18} />
          <text textAnchor="middle" y="5" className="mc-symbol">{trace?.status === 'done' ? '✓' : trace?.status === 'failed' ? '!' : actor === 'orchestrator' ? '✳' : '·'}</text>
          <text textAnchor="middle" y={actor === 'orchestrator' ? 51 : 44} className="mc-node-name">{LABELS[actor]}</text><text textAnchor="middle" y={actor === 'orchestrator' ? 67 : 59} className="mc-node-state">{trace?.status === 'running' ? trace.step.replace('Checking ', '').slice(0, 24) : trace?.status === 'done' ? 'Complete' : trace?.status === 'failed' ? 'Unavailable' : 'Waiting'}</text></g>
        </g>; })}
      </svg><p className="mc-map-note">Select an agent to inspect its work.</p></div>
      <section className="mc-inspector" aria-label={`${LABELS[selected]} details`}><p className="mc-role">{LABELS[selected]}</p><h3>{selectedTrace?.step ?? 'Ready for a closer look.'}</h3>
        {selectedTrace ? <><p className="mc-model">{selectedTrace.model}</p><dl className="mc-metrics">{selectedTrace.inputTokens !== null && <div><dt>Tokens in / out</dt><dd>{selectedTrace.inputTokens} / {selectedTrace.outputTokens}</dd></div>}<div><dt>Elapsed</dt><dd>{selectedTrace.latencyMs} ms</dd></div></dl>
          {selectedTrace.graphContext && <p className="mc-context-note">{selectedTrace.graphContext.nodes.length} graph nodes in context. About {selectedTrace.graphContext.estimatedTokensSaved.toLocaleString()} graph tokens omitted versus the full graph. Character-based estimate.</p>}
          {selectedTrace.tools.length > 0 && <div className="mc-tools">{selectedTrace.tools.map((tool, i) => <details key={i}><summary><span className="mc-tool-dot" />{tool.name.replaceAll('_', ' ')}</summary><pre>{JSON.stringify({ arguments: tool.arguments, result: tool.result }, null, 2)}</pre></details>)}</div>}
          {selectedTrace.sources.map(s => <blockquote key={s.url + s.quote}><p>“{s.quote}”</p><a href={s.url} target="_blank" rel="noopener noreferrer">External source · {new URL(s.url).hostname}</a></blockquote>)}
          <details className="mc-context"><summary>Exact supplied context</summary><pre>{JSON.stringify(selectedTrace.context, null, 2)}</pre></details>
        </> : <p className="mc-empty">Start a review to see the context, checks and sources this agent actually uses.</p>}
      </section>
    </div>
    {error && <p className="mc-error" role="alert">{error}</p>}
    {result && <section className="mc-brief" aria-label="Board brief" ref={brief}><div className="mc-brief-heading"><h3>The board’s brief</h3><span>{runSize(result)}</span></div>
      {breakLine(result.breakpoint) && <p className="mc-break">{breakLine(result.breakpoint)}</p>}
      <p className="mc-caveat">Conditional engine projections. Claims matched to the simulation do not verify your assumptions.</p>
      {result.findings.filter(f => f.agent !== 'synthesiser').map((finding, i) => <p className="mc-finding" key={i}><span>{LABELS[finding.agent]}</span><Segments value={finding.segments} /></p>)}
      {result.speech.length > 0 && <div className="mc-speech"><p><Segments value={result.speech} /></p>{onSpeech && <button onClick={() => onSpeech(result.speech)} disabled={!current}>Hear my future self</button>}<small>Fictional person. Synthetic image and voice.</small></div>}
      {result.sources.length > 0 && <div className="mc-sources"><h4>From the web, just now</h4>{result.sources.map(s => <blockquote key={s.url + s.quote}><p>{s.fact ?? s.title ?? new URL(s.url).hostname}</p><a href={s.url} target="_blank" rel="noopener noreferrer">{new URL(s.url).hostname} · {s.checked === 'url-in-search-results' ? SOURCE_NOTE[s.checked] : `“${s.quote.slice(0, 80)}” ${SOURCE_NOTE[s.checked]}`}</a></blockquote>)}<small>External facts. They never enter the cash engine.</small></div>}
      {result.proposals.map(p => <div className="mc-proposal" key={p.id}><div><h4>Explore a different assumption: {p.label}</h4><p>Set the base to {formatRand(p.values.base)} within your existing range. Lowest cash: {formatRand(p.beforeLowest)} → {formatRand(p.afterLowest)} ({p.delta >= 0 ? '+' : ''}{formatRand(p.delta)}).</p><small>This assumes the change is achievable. Nothing changes until you apply it.</small></div><button disabled={!current || applying !== null || applied.includes(p.id)} onClick={() => void apply(p)}>{applied.includes(p.id) ? 'Applied' : applying === p.id ? 'Applying…' : 'Apply assumption'}</button></div>)}
      {result.shots.length > 0 && <p className="mc-shot-list"><b>Director’s sequence</b> {result.shots.join(' → ')}</p>}
      <details className="mc-verification"><summary>Claim verification · {result.verification.filter(v => v.pass).length} passed / {result.verification.length} checks</summary>{result.verification.map((v, i) => <p key={i}>{v.pass ? 'Matched' : 'Withheld or repaired'} · {LABELS[v.agent]} · {v.reason}</p>)}</details>
    </section>}
  </aside>;
}
export default MissionControl;
