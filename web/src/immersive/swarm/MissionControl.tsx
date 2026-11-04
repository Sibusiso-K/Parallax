import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LABELS, type Actor, type Proposal, type SwarmRequest, type SwarmResult, type Trace, type WorldOp } from '../../../../shared/swarm/contracts.js';
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
}
const money = (n: number | null) => n === null ? 'Cost unavailable' : `US$${n.toFixed(4)}`;
const actors = Object.keys(NODE_POSITIONS) as Actor[];
function Segments({ value }: { value: AdvisorSegment[] }) {
  return <>{value.map((s, i) => s.kind === 'figure' ? <strong key={i} title={`${s.scenario}: ${s.metric.replaceAll('_', ' ')}`}>{s.text}</strong> : <span key={i}>{s.text}</span>)}</>;
}

/** Unmounted until Worker A integrates it. No globals, scene edits or automatic assumption writes. */
export function MissionControl({ request, onApply, onSpeech, onWorldOp, trigger, onStarted }: MissionControlProps) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
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
        if (event.type === 'result') { setResult(event.result); event.result.worldOps.slice(0, 1).forEach(op => onWorldOp?.(op)); setMode(event.result.mode === 'fixture' ? 'Offline fixture · no model calls' : event.result.mode === 'partial' ? 'Partial review · some steps unavailable' : 'Live review complete'); }
      }, controller.signal);
    } catch (e) { if (!controller.signal.aborted && ticket === generation.current) setError(e instanceof Error ? e.message : 'Review unavailable.'); }
    finally { if (ticket === generation.current) setBusy(false); }
  };
  useEffect(() => {
    generation.current++; abort.current?.abort(); setBusy(false); setResult(null); setTraces({}); setMode('Decision changed · ready to review'); setApplied([]);
    return () => { generation.current++; abort.current?.abort(); };
  }, [key]);
  const runRef = useRef(run); runRef.current = run;
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
  return <aside className="mc" aria-label="Decision review board">
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
        {selectedTrace ? <><p className="mc-model">{selectedTrace.model}</p><dl className="mc-metrics"><div><dt>Tokens in / out</dt><dd>{selectedTrace.inputTokens ?? 'Unknown'} / {selectedTrace.outputTokens ?? 'Unknown'}</dd></div><div><dt>Cost</dt><dd>{money(selectedTrace.costUsd)}</dd></div><div><dt>Elapsed</dt><dd>{selectedTrace.latencyMs} ms</dd></div></dl>
          {selectedTrace.graphContext && <p className="mc-context-note">{selectedTrace.graphContext.nodes.length} graph nodes in context. About {selectedTrace.graphContext.estimatedTokensSaved.toLocaleString()} graph tokens omitted versus the full graph. Character-based estimate.</p>}
          {selectedTrace.tools.length > 0 && <div className="mc-tools">{selectedTrace.tools.map((tool, i) => <details key={i}><summary><span className="mc-tool-dot" />{tool.name.replaceAll('_', ' ')}</summary><pre>{JSON.stringify({ arguments: tool.arguments, result: tool.result }, null, 2)}</pre></details>)}</div>}
          {selectedTrace.sources.map(s => <blockquote key={s.url + s.quote}><p>“{s.quote}”</p><a href={s.url} target="_blank" rel="noopener noreferrer">External source · {new URL(s.url).hostname}</a></blockquote>)}
          <details className="mc-context"><summary>Exact supplied context</summary><pre>{JSON.stringify(selectedTrace.context, null, 2)}</pre></details>
        </> : <p className="mc-empty">Start a review to see the context, checks and sources this agent actually uses.</p>}
      </section>
    </div>
    {error && <p className="mc-error" role="alert">{error}</p>}
    {result && <section className="mc-brief" aria-label="Board brief"><div className="mc-brief-heading"><h3>The board’s brief</h3><span>{money(result.costUsd)}</span></div>
      <p className="mc-caveat">Conditional engine projections. Claims matched to the simulation do not verify your assumptions.</p>
      {result.findings.filter(f => f.agent !== 'synthesiser').map((finding, i) => <p className="mc-finding" key={i}><span>{LABELS[finding.agent]}</span><Segments value={finding.segments} /></p>)}
      {result.speech.length > 0 && <div className="mc-speech"><p><Segments value={result.speech} /></p>{onSpeech && <button onClick={() => onSpeech(result.speech)} disabled={!current}>Hear my future self</button>}<small>Fictional person. Synthetic image and voice.</small></div>}
      {result.proposals.map(p => <div className="mc-proposal" key={p.id}><div><h4>Explore a different assumption: {p.label}</h4><p>Set the base to {formatRand(p.values.base)} within your existing range. Lowest cash: {formatRand(p.beforeLowest)} → {formatRand(p.afterLowest)} ({p.delta >= 0 ? '+' : ''}{formatRand(p.delta)}).</p><small>This assumes the change is achievable. Nothing changes until you apply it.</small></div><button disabled={!current || applying !== null || applied.includes(p.id)} onClick={() => void apply(p)}>{applied.includes(p.id) ? 'Applied' : applying === p.id ? 'Applying…' : 'Apply assumption'}</button></div>)}
      {onWorldOp && result.worldOps.map((op, i) => <button className="mc-secondary" key={i} disabled={!current} onClick={() => onWorldOp(op)}>Preview {op.value} light</button>)}
      {result.shots.length > 0 && <p className="mc-shot-list"><b>Director’s sequence</b> {result.shots.join(' → ')}</p>}
      <details className="mc-verification"><summary>Claim verification · {result.verification.filter(v => v.pass).length} passed / {result.verification.length} checks</summary>{result.verification.map((v, i) => <p key={i}>{v.pass ? 'Matched' : 'Withheld or repaired'} · {LABELS[v.agent]} · {v.reason}</p>)}</details>
    </section>}
  </aside>;
}
export default MissionControl;
