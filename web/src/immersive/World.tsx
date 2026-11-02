import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import './immersive.css';
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveClaim, type ClaimRef, type ResolvedClaim } from '../../../shared/scene/claims';
import { RequestGate, type PathLetter, type RoomSnapshot } from '../../../shared/scene/room-model';
import { FIXTURE_LABEL, MATCHED_LABEL, answerQuestion, type AdvisorAnswer } from './advisor-fixture';
import { EMPTY_MEMO, MEMO_FOOTER, choiceLabel, evidenceAppendix, type Choice, type Memo } from './memo';
import { buildReplay, isOutdated, resolveShot, shotAt, shotStart, shotUnavailable, type CameraStation, type Replay } from './replay';
import { createSession, SYNTHETIC_WAGES_NOTE } from './session';

const Scene = lazy(() => import('./Scene'));

const SUGGESTIONS = ['Why did cash run out here?', 'What is the lowest point?', 'What does the late payment do?'];
const PATH_ORDER: PathLetter[] = ['B', 'C', 'A'];

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

const noop = () => {};
const mq = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>The 3D room hit an error.</h1>
        <p>Reload the page to try again. Nothing was sent anywhere and no model call was made.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

export default function WorldRoot() {
  return (
    <Boundary>
      <World />
    </Boundary>
  );
}

function World() {
  const [session, setSession] = useState(() => createSession('demo'));
  const gate = useMemo(() => new RequestGate(), []);
  const reduced = useMemo(() => mq('(prefers-reduced-motion: reduce)'), []);
  const lowTier = useMemo(() => mq('(max-width: 768px)') || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4, []);
  const [webgl, setWebgl] = useState(() => hasWebGL());
  const [pathId, setPathId] = useState<PathLetter>('B');
  const [stressed, setStressed] = useState<Record<PathLetter, boolean>>({ A: false, B: false, C: false });
  const [month, setMonth] = useState(2);
  const [hover, setHover] = useState<number | null>(null);
  const [answers, setAnswers] = useState<AdvisorAnswer[]>([]);
  const [working, setWorking] = useState(false);
  const [question, setQuestion] = useState('');
  const [evidence, setEvidence] = useState<ResolvedClaim | null>(null);
  const [sheet, setSheet] = useState<null | 'contract' | 'fridge' | 'pan' | 'memo'>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [replayT, setReplayT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [memo, setMemo] = useState<Memo>(EMPTY_MEMO);
  const [announce, setAnnounce] = useState('');
  const [mood, setMood] = useState<'idle' | 'speak' | 'point'>('idle');
  const moodTimer = useRef(0);
  const flash = useCallback((m: 'speak' | 'point', ms: number) => {
    setMood(m);
    window.clearTimeout(moodTimer.current);
    moodTimer.current = window.setTimeout(() => setMood('idle'), ms);
  }, []);
  const [free, setFree] = useState(false);
  const [stationPick, setStationPick] = useState<CameraStation | null>(null);
  const [editNote, setEditNote] = useState('');
  const [dockOpen, setDockOpen] = useState(() => !mq('(max-width: 1500px)'));

  // What is on screen: the founder's own exploration, or the replay's frozen shot.
  const shot = replay ? shotAt(replay, replayT).shot : null;
  const inReplay = replay !== null;
  const snapshot: RoomSnapshot =
    inReplay && shot ? (session.registry.get(shot.snapshotKey) ?? session.snapshotFor(shot.pathId, shot.stressed)) : session.snapshotFor(pathId, stressed[pathId]);
  const shownMonth = inReplay && shot ? shot.month : month;
  const [viewed, setViewed] = useState<string[]>([]);
  useEffect(() => {
    setViewed((v) => (v[v.length - 1] === snapshot.key ? v : [...v, snapshot.key].slice(-24)));
  }, [snapshot.key]);
  const currentKey = useRef(snapshot.key);
  currentKey.current = snapshot.key;

  const say = useCallback((msg: string) => setAnnounce(msg), []);

  const select = useCallback((m: number) => {
    setMonth(Math.min(36, Math.max(1, m)));
    flash('point', 3200);
  }, [flash]);

  const toggleLever = useCallback(() => {
    const next = !stressed[pathId];
    const snap = session.snapshotFor(pathId, next);
    setStressed((s) => ({ ...s, [pathId]: next }));
    gate.invalidate();
    if (next) {
      const m = snap.active.firstShortfall ?? snap.active.lowest.month;
      setMonth(m);
      say(
        snap.active.firstShortfall
          ? `Late payment applied to path ${pathId}. Cash first runs out in month ${snap.active.firstShortfall}. Showing that month.`
          : `Late payment applied to path ${pathId}. Cash does not run out within 36 months. Lowest cash is in month ${snap.active.lowest.month}. Showing that month.`,
      );
    } else say(`Late payment removed. Showing the baseline for path ${pathId}.`);
  }, [gate, pathId, say, session, stressed]);

  const runAnswer = useCallback(
    async (target: PathLetter, stress: boolean, m: number, q: string) => {
      const snap = session.snapshotFor(target, stress);
      currentKey.current = snap.key;
      const ticket = gate.begin(snap.key);
      setWorking(true);
      await Promise.resolve();
      const a = answerQuestion(session, { pathId: target, snapshotKey: snap.key, month: m }, q);
      // Publish only if nothing relevant changed while this was pending (B -> C -> B, a double tap, a lever pull).
      if (gate.isCurrent(ticket, currentKey.current)) {
        setAnswers((prev) => [...prev, a]);
        setWorking(false);
        if (a.status === 'answered') flash('speak', 4200);
        say(a.status === 'answered' ? `Advisor answered on path ${target}.` : a.status === 'declined' ? 'The fixture advisor declined that question.' : 'The answer was withheld because it did not match the simulation.');
      }
    },
    [flash, gate, say, session],
  );

  const ask = useCallback(
    (q: string) => {
      const t = q.trim();
      if (!t) return;
      setQuestion('');
      void runAnswer(pathId, stressed[pathId], month, t);
    },
    [month, pathId, runAnswer, stressed],
  );

  const carry = useCallback(
    (a: AdvisorAnswer, target: PathLetter) => {
      const stress = session.registry.get(a.snapshotKey)?.ref.setback != null;
      setPathId(target);
      setStressed((s) => ({ ...s, [target]: stress }));
      setMonth(a.month);
      say(`Carried the question and the ${stress ? 'late-payment stress' : 'baseline'} to path ${target}.`);
      void runAnswer(target, stress, a.month, a.question);
    },
    [runAnswer, say, session],
  );

  // Objects change the numbers: an edit goes through the engine's own validation and makes a NEW revision.
  const applyEdit = useCallback(
    (pathLetter: PathLetter, role: 'equipment' | 'contract' | 'direct', newBase: number) => {
      const a = session.paths[pathLetter].path.assumptions.find((x) => x.role === role && x.kind === (role === 'contract' ? 'income' : 'cost'));
      if (!a) return setEditNote('This path has no such line to edit.');
      if (!Number.isFinite(newBase) || newBase < 0 || newBase > 5_000_000) return setEditNote('Enter a whole-rand amount from 0 to 5,000,000.');
      const k = newBase / a.base;
      const edit = a.base === 0 ? { low: 0, base: Math.round(newBase), high: Math.round(newBase) } : { low: Math.round(a.low * k), base: Math.round(newBase), high: Math.round(a.high * k) };
      const r = session.revise(pathLetter, a.id, edit);
      if (!r.ok) return setEditNote(`The engine refused that edit: ${r.error}`);
      gate.invalidate();
      setWorking(false);
      setSession(r.session);
      setReplay(null);
      setPlaying(false);
      setEditNote(`Applied to path ${pathLetter}: ${a.label} is now R${Math.round(newBase).toLocaleString('en-ZA').replace(/\u00a0/g, ',')}. New revision ${r.session.profileRevision}. Earlier answers and any replay are now historical.`);
      say(`Edit applied to path ${pathLetter}. Revision ${r.session.profileRevision}. Figures recomputed by the engine.`);
    },
    [gate, say, session],
  );

  const switchPath = (p: PathLetter) => {
    gate.invalidate();
    setWorking(false);
    setPathId(p);
    say(`Path ${p}: ${session.paths[p].name}.`);
  };

  // Replay clock: real time, one frame at a time. Seeking and stepping use the same track.
  useEffect(() => {
    if (!playing || !replay) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setReplayT((t) => {
        const nt = t + dt;
        if (nt >= replay.totalMs) {
          setPlaying(false);
          return replay.totalMs - 1;
        }
        return nt;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, replay]);

  const startReplay = () => {
    gate.invalidate();
    setFree(false);
    setReplay(buildReplay(session));
    setReplayT(0);
    setPlaying(!reduced);
    say(reduced ? 'Replay opened. Use next and previous to step through it.' : 'Replay started.');
  };
  const closeReplay = () => {
    setReplay(null);
    setPlaying(false);
    say('Replay closed. Back to exploring.');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') {
        setEvidence(null);
        setSheet(null);
        return;
      }
      if (replay) return;
      if (e.key === 'ArrowRight') select(month + 1);
      else if (e.key === 'ArrowLeft') select(month - 1);
      else if (e.key.toLowerCase() === 'l') toggleLever();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [month, replay, select, toggleLever]);

  const claim = (ref: ClaimRef): ResolvedClaim | null => {
    const r = resolveClaim(session.registry, ref);
    return r.ok ? r.claim : null;
  };
  const k = snapshot.key;
  const isStress = snapshot.ref.setback !== null;
  const cells = {
    cashB: claim({ snapshotKey: k, scenario: 'baseline', metric: 'cash_at_month', month: shownMonth }),
    cashA: claim({ snapshotKey: k, scenario: 'active', metric: 'cash_at_month', month: shownMonth }),
    lowB: claim({ snapshotKey: k, scenario: 'baseline', metric: 'lowest_cash' }),
    lowA: claim({ snapshotKey: k, scenario: 'active', metric: 'lowest_cash' }),
    first: claim({ snapshotKey: k, scenario: 'active', metric: 'first_shortfall' }),
    endB: claim({ snapshotKey: k, scenario: 'baseline', metric: 'cash_at_end' }),
    endA: claim({ snapshotKey: k, scenario: 'active', metric: 'cash_at_end' }),
  };
  const leverLabel = `Client pays ${snapshot.terms.addedDelayMonths || 2} months late`;
  const assumptionOf = (re: RegExp) => snapshot.assumptions.find((a) => re.test(a.label));
  const fridge = assumptionOf(/equipment/i);
  const stage: CameraStation = shot?.station ?? stationPick ?? 'bridge';
  const replayOutdated = replay ? isOutdated(replay, session) : false;
  const shotClaims = replay && shot ? resolveShot(session, shot) : [];
  const shotBroken = replay && shot ? shotUnavailable(session, shot) : false;

  return (
    <div className="world" data-lite={lowTier ? '' : undefined}>
      <div className="world__canvas">
        {webgl ? (
          <Suspense fallback={<div className="world__loading">Loading the 3D room. The controls on this page work without it.</div>}>
            <Scene
              snapshot={snapshot}
              selectedMonth={shownMonth}
              station={stage}
              pulled={isStress}
              reduced={reduced}
              lowTier={lowTier}
              speaking={working}
              contractText={`Corporate lunch contract · 12 months · paid ${(snapshot.terms.paymentLagMonths ?? 0) * 30 || 60} days after each invoice`}
              fridgeText={fridge ? `${fridge.label}: R${fridge.base.toLocaleString('en-ZA').replace(/ /g, ',')} (${fridge.source})` : 'Equipment (path A has none)'}
              leverLabel={leverLabel}
              onSelectMonth={inReplay ? noop : select}
              onHoverMonth={inReplay ? noop : setHover}
              onLever={inReplay ? noop : toggleLever}
              onOpenContract={() => setSheet('contract')}
              onOpenFridge={() => setSheet('fridge')}
              onOpenPan={() => setSheet('pan')}
              mood={mood}
              working={working}
              panText="Ingredients and packaging: tap to edit"
              free={free}
              onContextLost={() => setWebgl(false)}
            />
          </Suspense>
        ) : (
          <div className="world__nogl" role="note">
            The 3D room isn't available on this device or was interrupted. Everything below still works: the same figures, advisor, replay and memo.
          </div>
        )}
      </div>

      <header className="bar">
        <div className="bar__brand">
          <span className="brand">Parallax</span>
          <span className="tag">Decision rehearsal · Demo founder: fictional</span>
        </div>
        <div role="tablist" aria-label="Path" className="tabs">
          {PATH_ORDER.map((p) => (
            <button key={p} role="tab" aria-selected={snapshot.ref.pathId === p} className={`tab tab--${p}`} onClick={() => switchPath(p)} disabled={inReplay}>
              <b>{p}</b> {session.paths[p].name}
            </button>
          ))}
        </div>
      </header>

      <div className="honest" role="note">
        Stylised characters authored in Blender (not photographs, not a real person). The advisor is a fixture: no model is connected. Numbers come from the existing engine; template values are placeholders.
      </div>

      {session.profileRevision > 1 && (
        <div className="honest honest--rev" role="note">Revision {session.profileRevision}: assumptions were edited. Answers and replays made before the edit are historical.</div>
      )}
      {hover !== null && !inReplay && (
        <div className="hovercard glass" role="status">
          <b>Month {hover}</b> · cash {cellText(snapshot.active.rows[hover - 1]!.cash)}{isStress ? ` (baseline ${cellText(snapshot.baseline.rows[hover - 1]!.cash)})` : ''} · net {cellText(snapshot.active.rows[hover - 1]!.net)}
          {snapshot.active.rows[hover - 1]!.cash < 0 ? ' · below zero' : ''} <span className="muted small">tap to select</span>
        </div>
      )}
      <section className="left" aria-label="Controls">
        <h1 className="h1">Should Ayanda take the 12-month corporate lunch contract?</h1>
        <p className="sub">Path {snapshot.ref.pathId}: {session.paths[snapshot.ref.pathId].summary}</p>

        <div className="month" role="group" aria-label="Month">
          <button className="btn btn--round" onClick={() => select(shownMonth - 1)} disabled={inReplay || shownMonth <= 1} aria-label="Previous month">‹</button>
          <label className="month__label">
            <span>Month <b>{shownMonth}</b> of 36{hover && hover !== shownMonth ? ` · hovering ${hover}` : ''}</span>
            <input type="range" min={1} max={36} value={shownMonth} disabled={inReplay} onChange={(e) => select(Number(e.target.value))} aria-valuetext={`Month ${shownMonth}`} />
          </label>
          <button className="btn btn--round" onClick={() => select(shownMonth + 1)} disabled={inReplay || shownMonth >= 36} aria-label="Next month">›</button>
        </div>

        <button className={`btn btn--lever ${isStress ? 'is-on' : ''}`} aria-pressed={isStress} onClick={toggleLever} disabled={inReplay}>
          <span className="lever-ico" aria-hidden="true">{isStress ? '▾' : '▴'}</span>
          {isStress ? 'Late payment applied. Reset' : 'Pull the lever: client pays 2 months late'}
        </button>
        <p className="rule">
          {isStress ? snapshot.terms.stressRule : 'Baseline. The lever applies the engine’s late-payment rule: receipts due in two months are held back, then paid two months later.'}
          {snapshot.terms.firstReceiptMonth ? ` First contract payment lands in month ${snapshot.terms.firstReceiptMonth}.` : ' This path has no contract.'}
        </p>
        <div className="objects" role="group" aria-label="Move the camera">
          {(['overview', 'contract', 'bridge', 'marker'] as CameraStation[]).map((st) => (
            <button key={st} className={`btn btn--ghost btn--sm ${stationPick === st && !free ? 'is-on' : ''}`} onClick={() => { setFree(false); setStationPick(st); }} disabled={inReplay} aria-pressed={stationPick === st && !free}>
              {st === 'overview' ? 'Overview' : st === 'contract' ? 'The offer' : st === 'bridge' ? 'On the bridge' : 'The marker'}
            </button>
          ))}
          <button className={`btn btn--ghost btn--sm ${free ? 'is-on' : ''}`} onClick={() => setFree((f) => !f)} aria-pressed={free} disabled={inReplay}>Free camera{free ? ': drag to orbit' : ''}</button>
        </div>
        <div className="objects" role="group" aria-label="Objects in the room">
          <button className="btn btn--ghost btn--sm" onClick={() => setSheet('contract')}>Contract terms</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setSheet('fridge')}>Fridge</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setSheet('pan')}>Ingredients</button>
        </div>
        <p className="keys">Keys: ← → month · L lever · Esc close</p>
      </section>

      <section className="readings glass" aria-label="Readings, from the engine" aria-live="off">
        <div className="readings__head">
          <span>Readings · {isStress ? 'baseline vs late payment' : 'baseline'} · path {snapshot.ref.pathId}</span>
          <span className="chip">{MATCHED_LABEL}</span>
        </div>
        <div className="rgrid">
          <Cell title={`Cash, end of month ${shownMonth}`} a={cells.cashB} b={isStress ? cells.cashA : null} onOpen={setEvidence} />
          <Cell title="Lowest cash" a={cells.lowB} b={isStress ? cells.lowA : null} onOpen={setEvidence} />
          <Cell title="Cash first runs out" a={isStress ? null : cells.first} b={isStress ? cells.first : null} onOpen={setEvidence} />
          <Cell title="Cash, month 36" a={cells.endB} b={isStress ? cells.endA : null} onOpen={setEvidence} />
        </div>
        {isStress && snapshot.active.firstShortfall !== null && <p className="qual">After the first shortfall the bridge continues as a projection. The engine does not model whether the business keeps trading or finds funding.</p>}
        <details className="table">
          <summary>All 36 months as a table</summary>
          <table>
            <thead><tr><th>Month</th><th>Baseline cash</th>{isStress && <th>Late-payment cash</th>}</tr></thead>
            <tbody>
              {snapshot.baseline.rows.map((r, i) => (
                <tr key={r.month} className={r.month === shownMonth ? 'is-sel' : ''}>
                  <td><button className="linkish" onClick={() => select(r.month)} disabled={inReplay}>{r.month}</button></td>
                  <td>{cellText(r.cash)}</td>
                  {isStress && <td className={snapshot.active.rows[i]!.cash < 0 ? 'neg' : ''}>{cellText(snapshot.active.rows[i]!.cash)}{snapshot.active.rows[i]!.cash < 0 ? ' (below zero)' : ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <aside className={`dock glass ${dockOpen ? '' : 'is-closed'}`} aria-label="Ask the advisor">
        <button className="dock__toggle" onClick={() => setDockOpen((o) => !o)} aria-expanded={dockOpen}>
          {dockOpen ? 'Hide advisor' : 'Ask the advisor'}
        </button>
        {dockOpen && (
          <>
            <p className="fixture">{FIXTURE_LABEL}</p>
            <div className="chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip chip--btn" onClick={() => ask(s)} disabled={inReplay}>{s}</button>
              ))}
            </div>
            <form
              className="ask"
              onSubmit={(e) => {
                e.preventDefault();
                ask(question);
              }}
            >
              <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask about this month, the lowest point or the delay" aria-label="Your question" disabled={inReplay} />
              <button className="btn" type="submit" disabled={inReplay || !question.trim()}>Ask</button>
            </form>
            <div className="answers" aria-live="polite">
              {working && <p className="working">Running the local tools…</p>}
              {answers.slice(-4).map((a, i) => (
                <AnswerCard key={i} a={a} onEvidence={setEvidence} onCarry={(t) => carry(a, t)} canCarry={a.status === 'answered' && session.registry.get(a.snapshotKey)?.ref.profileRevision === session.profileRevision} historical={session.registry.get(a.snapshotKey)?.ref.profileRevision !== session.profileRevision} fromPath={a.pathId} />
              ))}
              {answers.length === 0 && !working && <p className="muted">Try “Why did cash run out here?” after pulling the lever.</p>}
            </div>
          </>
        )}
      </aside>

      <footer className="foot">
        <div className="foot__actions">
          {!inReplay ? (
            <button className="btn btn--ghost" onClick={startReplay}>▶ Play 15 s replay</button>
          ) : (
            <button className="btn btn--ghost" onClick={closeReplay}>Close replay</button>
          )}
          <button className="btn" onClick={() => setSheet('memo')}>Write my decision memo</button>
        </div>
        <span>Demo founder: fictional · Not financial advice · One possible future, not a prediction</span>
      </footer>

      {replay && shot && (
        <div className="replay glass" role="region" aria-label="Replay">
          <div className="replay__row">
            <button className="btn btn--round" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
            <button className="btn btn--round" onClick={() => { setPlaying(false); setReplayT(shotStart(replay, Math.max(0, shotAt(replay, replayT).index - 1))); }} aria-label="Previous shot">‹</button>
            <button className="btn btn--round" onClick={() => { setPlaying(false); setReplayT(shotStart(replay, Math.min(replay.shots.length - 1, shotAt(replay, replayT).index + 1))); }} aria-label="Next shot">›</button>
            <input type="range" min={0} max={replay.totalMs - 1} value={Math.round(replayT)} onChange={(e) => { setPlaying(false); setReplayT(Number(e.target.value)); }} aria-label="Replay position" aria-valuetext={`${shot.title}, ${(replayT / 1000).toFixed(1)} of ${(replay.totalMs / 1000).toFixed(0)} seconds`} />
            <span className="mono">{(replayT / 1000).toFixed(1)} / {(replay.totalMs / 1000).toFixed(0)} s</span>
          </div>
          <p className="replay__cap"><b>{shot.title}.</b> {shotBroken ? 'This frozen snapshot is no longer available, so this shot is not shown as evidence. Close the replay and play it again.' : shot.line} {!shotBroken && shotClaims.map((c, i) => <button key={i} className="figure" onClick={() => setEvidence(c)}>{c.text}</button>)}</p>
          <p className="muted small">In-browser playback of frozen snapshots, not an exported video.{replayOutdated ? ' This replay is historical: the inputs changed after it was made.' : ''}</p>
        </div>
      )}

      {evidence && <EvidenceDrawer claim={evidence} session={session} onClose={() => setEvidence(null)} />}
      {sheet === 'contract' && (
        <InfoSheet title="The contract" onClose={() => setSheet(null)}>
          <p>12 months{snapshot.assumptions.find((x) => x.role === 'contract') ? '' : ''}. {snapshot.terms.firstReceiptMonth ? `The first payment lands in month ${snapshot.terms.firstReceiptMonth} (${snapshot.terms.paymentLagMonths} months after work starts).` : 'This path declines it.'}</p>
          <EditField session={session} pathId={snapshot.ref.pathId} role="contract" label="Monthly contract value (rand)" onApply={applyEdit} note={editNote} />
          <p className="muted small">Payment terms change only through a reviewed edit of the story, not here. Edits apply to the path shown.</p>
        </InfoSheet>
      )}
      {sheet === 'fridge' && (
        <InfoSheet title="The second fridge" onClose={() => setSheet(null)}>
          <p>{fridge ? `${fridge.label}. Base R${fridge.base.toLocaleString('en-ZA').replace(/\u00a0/g, ',')} (${fridge.source}).` : 'Path A does not buy equipment.'}</p>
          <EditField session={session} pathId={snapshot.ref.pathId} role="equipment" label="Equipment cost (rand)" onApply={applyEdit} note={editNote} />
          <p className="muted small">Rent versus buy is the difference between paths B and C: switch path to compare. An edit changes only the path shown.</p>
        </InfoSheet>
      )}
      {sheet === 'pan' && (
        <InfoSheet title="Ingredients and packaging" onClose={() => setSheet(null)}>
          <p>The direct cost of the contract work on this path (a template share of the contract's value, marked as template).</p>
          <EditField session={session} pathId={snapshot.ref.pathId} role="direct" label="Direct costs per month (rand)" onApply={applyEdit} note={editNote} />
        </InfoSheet>
      )}
      {sheet === 'memo' && <MemoSheet session={session} viewed={viewed} memo={memo} setMemo={setMemo} onClose={() => setSheet(null)} />}

      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
}

/** Moves focus into a dialog on open and restores it on close; the full-screen memo also makes the rest of the page inert. */
function useModal(trap: boolean, focusFirst: boolean, target?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const others = trap ? [...document.querySelectorAll<HTMLElement>('.world > *:not(.memo-wrap)')] : [];
    others.forEach((el) => el.setAttribute('inert', ''));
    const t = window.setTimeout(() => {
      const node = target?.current ?? document.querySelector<HTMLElement>(focusFirst ? '.memo-wrap select, .memo-wrap input' : '.sheet button');
      node?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      others.forEach((el) => el.removeAttribute('inert'));
      before?.focus?.();
    };
  }, [trap, focusFirst, target]);
}

function EditField({ session, pathId, role, label, onApply, note }: { session: ReturnType<typeof createSession>; pathId: PathLetter; role: 'equipment' | 'contract' | 'direct'; label: string; onApply: (p: PathLetter, role: 'equipment' | 'contract' | 'direct', v: number) => void; note: string }) {
  const line = session.paths[pathId].path.assumptions.find((x) => x.role === role && x.kind === (role === 'contract' ? 'income' : 'cost'));
  const [v, setV] = useState(line ? String(line.base) : '');
  useEffect(() => setV(line ? String(line.base) : ''), [line?.id, line?.base]);
  if (!line) return <p className="muted">This path has no such line.</p>;
  return (
    <form className="field" onSubmit={(e) => { e.preventDefault(); const t = v.trim(); onApply(pathId, role, /^\d{1,7}$/.test(t) ? Number(t) : Number.NaN); }}>
      <span>{label}</span>
      <div className="ask">
        <input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} aria-label={label} />
        <button className="btn" type="submit">Apply</button>
      </div>
      <span className="muted small">{line.label}: range R{line.low.toLocaleString('en-ZA').replace(/\u00a0/g, ',')} to R{line.high.toLocaleString('en-ZA').replace(/\u00a0/g, ',')}, source: {line.source}. The range scales with your edit; the engine recomputes everything.</span>
      {note && <span role="status" className="qual">{note}</span>}
    </form>
  );
}

function cellText(n: number) {
  return `${n < 0 ? '-' : ''}R${Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function Cell({ title, a, b, onOpen }: { title: string; a: ResolvedClaim | null; b: ResolvedClaim | null; onOpen: (c: ResolvedClaim) => void }) {
  return (
    <div className="cell">
      <div className="cell__t">{title}</div>
      {a && (
        <button className={`figure ${a.unit === 'none' ? 'figure--text' : ''}`} onClick={() => onOpen(a)} aria-label={`${title}, ${a.scenarioLabel}: ${a.text}. Open evidence`}>
          <small>{a.scenarioLabel}</small>
          <span>{a.text}</span>
        </button>
      )}
      {b && (
        <button className={`figure figure--stress ${b.unit === 'none' ? 'figure--text' : ''}`} onClick={() => onOpen(b)} aria-label={`${title}, ${b.scenarioLabel}: ${b.text}. Open evidence`}>
          <small>{b.scenarioLabel}</small>
          <span>{b.text}</span>
        </button>
      )}
    </div>
  );
}

function AnswerCard({ a, onEvidence, onCarry, canCarry, historical, fromPath }: { a: AdvisorAnswer; onEvidence: (c: ResolvedClaim) => void; onCarry: (p: PathLetter) => void; canCarry: boolean; historical: boolean; fromPath: PathLetter }) {
  const targets = (['B', 'C', 'A'] as PathLetter[]).filter((p) => p !== fromPath);
  return (
    <article className={`answer answer--${a.status}`}>
      <p className="q">“{a.question}” · path {a.pathId}, month {a.month}</p>
      <p>
        {a.segments.map((s, i) =>
          s.kind === 'claim' ? (
            <button key={i} className="figure figure--inline" onClick={() => onEvidence(a.claims[s.index]!)}>{a.claims[s.index]!.text}</button>
          ) : (
            <span key={i} className={s.kind === 'code' ? 'code-text' : undefined}>{s.text}</span>
          ),
        )}
      </p>
      {a.status === 'answered' && <p className="chip">{historical ? 'Historical: inputs changed after this answer' : MATCHED_LABEL}</p>}
      {a.trace.length > 0 && (
        <details className="trace">
          <summary>What actually ran ({a.trace.length})</summary>
          <ul>{a.trace.map((t, i) => <li key={i} className={t.ok ? '' : 'neg'}>{t.ok ? '✓' : '✗'} <code>{t.tool}</code> {t.detail}{t.ms ? ` · ${t.ms} ms` : ''}</li>)}</ul>
          <p className="muted small">Local execution only: the engine and the claim checks. No model was called.</p>
        </details>
      )}
      {canCarry && (
        <div className="carry">
          {targets.map((t) => (
            <button key={t} className="btn btn--ghost btn--sm" onClick={() => onCarry(t)}>Ask this on path {t} →</button>
          ))}
        </div>
      )}
    </article>
  );
}

function EvidenceDrawer({ claim, session, onClose }: { claim: ResolvedClaim; session: ReturnType<typeof createSession>; onClose: () => void }) {
  const snap = session.registry.get(claim.ref.snapshotKey);
  const outcome = snap ? (claim.ref.scenario === 'baseline' ? snap.baseline : snap.active) : null;
  const row = outcome && claim.month ? outcome.rows[claim.month - 1] : null;
  const ref = useRef<HTMLDivElement>(null);
  useModal(false, false, ref);
  return (
    <div className="drawer glass" role="dialog" aria-modal="false" aria-label="Evidence" tabIndex={-1} ref={ref}>
      <div className="drawer__head"><b>Evidence</b><button className="btn btn--round" onClick={onClose} aria-label="Close evidence">×</button></div>
      <p className="big">{claim.label}: <span className="mono">{claim.text}</span></p>
      <p className="chip">{MATCHED_LABEL}</p>
      <dl>
        <dt>Scenario</dt><dd>{claim.scenarioLabel}, path {claim.pathId}, likely case</dd>
        <dt>Snapshot</dt><dd className="mono">{snap?.inputHash} · revision {snap?.ref.profileRevision} · version {snap?.ref.simulationVersion}</dd>
        {snap?.terms.stressRule && claim.ref.scenario === 'active' && (<><dt>Stress rule</dt><dd>{snap.terms.stressRule}</dd></>)}
        {row && (<><dt>Row used</dt><dd className="mono">month {row.month}: in {cellText(row.income)}, out {cellText(row.costs)}, net {cellText(row.net)}, cash {cellText(row.cash)}</dd></>)}
      </dl>
      {claim.qualification && <p className="qual">{claim.qualification}</p>}
      <p className="muted small">“Matched” means consistent with this simulation, not that the assumptions are true or the reasoning is financial advice. Template values are placeholders. {SYNTHETIC_WAGES_NOTE}</p>
      {snap && (
        <details>
          <summary>Assumptions this run used ({(claim.ref.scenario === 'baseline' ? snap.baselineAssumptions : snap.assumptions).length})</summary>
          <table className="assump">
            <tbody>
              {(claim.ref.scenario === 'baseline' ? snap.baselineAssumptions : snap.assumptions).map((a) => (
                <tr key={a.id} className={a.role === 'setback' ? 'is-stress' : ''}>
                  <td className="mono">{a.id}</td><td>{a.label}</td><td className="mono">{cellText(a.low)}–{cellText(a.high)}</td><td>{a.source ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

function InfoSheet({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useModal(false, false);
  return (
    <div className="sheet glass" role="dialog" aria-label={title}>
      <div className="drawer__head"><b>{title}</b><button className="btn btn--round" onClick={onClose} aria-label="Close">×</button></div>
      {children}
    </div>
  );
}

function MemoSheet({ session, viewed, memo, setMemo, onClose }: { session: ReturnType<typeof createSession>; viewed: string[]; memo: Memo; setMemo: (m: Memo) => void; onClose: () => void }) {
  const lines = useMemo(() => evidenceAppendix(session, viewed), [session, viewed]);
  useModal(true, true);
  const set = (p: Partial<Memo>) => setMemo({ ...memo, ...p });
  return (
    <div className="memo-wrap">
      <div className="memo glass" id="memo-print" role="dialog" aria-label="Decision memo">
        <div className="drawer__head no-print"><b>Your decision memo</b><button className="btn btn--round" onClick={onClose} aria-label="Close memo">×</button></div>
        <h2 className="memo__h">My decision, in my words</h2>
        <label className="field">
          <span>What I would choose</span>
          <select value={memo.choice} onChange={(e) => set({ choice: e.target.value as Choice })}>
            <option value="">Choose, or leave empty (Parallax does not choose for you)</option>
            {(['A', 'B', 'C', 'not_ready'] as Exclude<Choice, ''>[]).map((c) => <option key={c} value={c}>{choiceLabel(session, c)}</option>)}
          </select>
        </label>
        {[0, 1, 2].map((i) => (
          <label className="field" key={i}>
            <span>Reason {i + 1}</span>
            <input value={memo.reasons[i]} onChange={(e) => { const r = [...memo.reasons] as Memo['reasons']; r[i] = e.target.value; set({ reasons: r }); }} placeholder="In your own words" />
          </label>
        ))}
        <label className="field"><span>Conditions I would insist on</span><textarea rows={2} value={memo.conditions} onChange={(e) => set({ conditions: e.target.value })} /></label>
        <label className="field"><span>The setback to watch</span><textarea rows={2} value={memo.watch} onChange={(e) => set({ watch: e.target.value })} /></label>
        <h3 className="memo__sub">Evidence appendix: the {viewed.length === 0 ? 'snapshots you looked at (none yet)' : `${new Set(viewed).size} snapshot(s) you looked at`}, code-generated</h3>
        <table className="assump">
          <thead><tr><th>Path</th><th>Figure</th><th>Scenario</th><th>Value</th><th>Snapshot</th><th>Revision</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (<tr key={i}><td>{l.path}</td><td>{l.label}</td><td>{l.scenario}</td><td className="mono">{l.value}</td><td className="mono">{l.snapshot}</td><td>{l.revision}{l.revision === session.profileRevision ? '' : ' (historical)'}</td></tr>))}
          </tbody>
        </table>
        <p className="qual">After a first shortfall the projection continues; the engine does not model whether the business keeps trading or finds funding.</p>
        <p className="muted small">{MEMO_FOOTER} Generated {new Date().toLocaleDateString('en-ZA')}.</p>
        <div className="no-print memo__actions">
          <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
          <span className="muted small">Your words stay in this browser tab until you print or close it. Nothing is saved to a server.</span>
        </div>
      </div>
    </div>
  );
}
