import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import './immersive.css';
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Edit } from '../../../shared/engine/simulate';
import { resolveClaim, type ClaimRef, type ResolvedClaim } from '../../../shared/scene/claims';
import { RequestGate, type PathLetter, type RoomSnapshot } from '../../../shared/scene/room-model';
import { DEMO_TEXT } from '../../../shared/intake/fixture';
import type { AdvisorAction } from '../../../shared/scene/advisor-model';
import { useVoiceInput } from '../lib/voice';
import { FIXTURE_LABEL, LIVE_LABEL, MATCHED_LABEL, answerQuestion, type AdvisorAnswer } from './advisor-fixture';
import { DemoVoice, answerTranscript } from './DemoVoice';
import { actionLabel, askLive, serverAbilities, type AdvisorContext, type ServerAbilities } from './live-advisor';
import { CashStory } from './story-media/CashStory';
import { MediaStudio, type MediaOutput } from './story-media/MediaStudio';
import { buildReelPlan, listenScript } from './story-media/reel-plan';
import { EMPTY_MEMO, choiceLabel, evidenceAppendix, memoFooter, type Choice, type Memo } from './memo';
import { buildReplay, isOutdated, resolveShot, shotAt, shotStart, shotUnavailable, type CameraStation, type Replay } from './replay';
import { SYNTHETIC_WAGES_NOTE, type Session } from './session';
import { exploreSession } from './session-adapter';
import { OBJECT_IDS, WORLD_BASE, loadManifest, type CourtyardManifest, type ObjectId, type PlaceId } from './courtyard/manifest';
import { buildReadout } from './courtyard/readout';
import type { WalkHandle } from './courtyard/WalkCamera';
import { applyDressing, type SceneDressing } from '../../../shared/scene/dressing';
import PhotoWorld from './photo/PhotoWorld';
import { askFutureSelf } from './photo/advisor';

const Courtyard = lazy(() => import('./courtyard/Courtyard'));

/** Where the replay's camera stations stand in the courtyard. */
const PLACE_FOR_STATION: Record<CameraStation, PlaceId> = { overview: 'spawn', contract: 'offer', bridge: 'bridge', marker: 'bridge', memo: 'memo' };
const PLACE_ORDER: PlaceId[] = ['spawn', 'offer', 'intake', 'bridge', 'memo'];
const MONTH_TICKS = [1, 6, 12, 18, 24, 30, 36];

const SUGGESTIONS = ['Why did cash run out here?', 'What is the lowest point?', 'What does the late payment do?'];
/** What is worth asking at each object. The advisor is told which object the founder stands at. */
const OBJECT_QUESTIONS: Record<ObjectId, string[]> = {
  contract: ['What happens if they pay late?', 'Why does the first payment matter so much?'],
  pan: ['How much of the contract do these costs eat?', 'Why does cash go out before it comes in?'],
  fridge: ['Do I need to buy this now?', 'What does this do to my cash early on?'],
  intake_desk: ['Which of these figures are only assumptions?', 'Which figure matters most?'],
  memo: ['What should I watch before deciding?', 'What would make me say no?'],
};
const OBJECT_TABS = [
  { id: 'explore', label: 'Explore' },
  { id: 'visualise', label: 'Visualise' },
  { id: 'listen', label: 'Listen' },
  { id: 'create', label: 'Create' },
] as const;
type ObjectTab = (typeof OBJECT_TABS)[number]['id'];
const DEMO_CONTEXT: AdvisorContext = { business: 'Meal-prep and catering', location: 'Johannesburg', story: DEMO_TEXT };
const PATH_ORDER: PathLetter[] = ['B', 'C', 'A'];

const mq = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q).matches : false);

class Boundary extends Component<{ children: ReactNode; embedded: boolean }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    // Inside the app a reload would clear this tab's decision, so the embedded room sends the founder elsewhere instead.
    return this.props.embedded ? (
      <div role="alert" style={{ padding: 24 }}>
        <h1>The 3D room hit an error.</h1>
        <p>Your decision is unchanged. Use the navigation to go back to your paths; reloading would clear this tab. No model call was made.</p>
      </div>
    ) : (
      <div role="alert" style={{ padding: 24, fontFamily: 'sans-serif' }}>
        <h1>The 3D room hit an error.</h1>
        <p>Reload the page to try again. Nothing was sent anywhere and no model call was made.</p>
        <button onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}

/** Keep an unavailable or failed renderer inside the stage so the decision stays usable. */
class SceneBoundary extends Component<{ children: ReactNode; onFailure: (error: Error) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onFailure(error); }
  render() { return this.state.failed ? null : this.props.children; }
}

type LiveExtrasShape = Parameters<typeof askLive>[4];

/** Where the founder is in Explore: a path, the late-payment lever per path, and a month. */
export interface ExploreSelection {
  pathId: PathLetter;
  stressed: Record<PathLetter, boolean>;
  month: number;
}

/** Ties the room to a confirmed decision held by the app. Without it, the room shows the fictional demo founder. */
export interface ExploreBinding {
  session: Session;
  initial: ExploreSelection;
  onSelection: (view: ExploreSelection) => void;
  /** Applies an edit to the app's path cards. The new revision arrives as a new session. */
  onRevise: (pathId: PathLetter, assumptionId: string, edit: Edit) => { ok: true; revision: number } | { ok: false; error: string };
  /** Whose figures these are, shown beside the scene. */
  founderLabel: string;
  /** This founder's names for the places and objects, from Muse Spark (shared/scene/dressing.ts). Absent: the courtyard as built. */
  dressing?: SceneDressing | null;
  /** The founder's own business and words, so the advisor can talk about this decision and not a generic one. */
  context?: AdvisorContext;
}

export default function WorldRoot({ binding }: { binding?: ExploreBinding }) {
  return (
    <Boundary embedded={!!binding}>
      <World binding={binding} />
    </Boundary>
  );
}

function demoSession(): Session {
  const r = exploreSession({ kind: 'demo' });
  if (!r.ok) throw new Error(r.reason);
  return r.session;
}

function World({ binding }: { binding?: ExploreBinding }) {
  const [ownSession, setOwnSession] = useState<Session | null>(() => (binding ? null : demoSession()));
  const session = binding?.session ?? ownSession!;
  const gate = useMemo(() => new RequestGate(), []);
  const reduced = useMemo(() => mq('(prefers-reduced-motion: reduce)'), []);
  const lowTier = useMemo(() => mq('(max-width: 768px)') || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4, []);
  const [webgl, setWebgl] = useState(true);
  const [pathId, setPathId] = useState<PathLetter>(binding?.initial.pathId ?? 'B');
  const [stressed, setStressed] = useState<Record<PathLetter, boolean>>(binding?.initial.stressed ?? { A: false, B: false, C: false });
  const [month, setMonth] = useState(binding?.initial.month ?? 2);
  // The app keeps the selection, so leaving Explore and coming back returns to the same place.
  const onSelection = binding?.onSelection;
  useEffect(() => {
    onSelection?.({ pathId, stressed, month });
  }, [onSelection, pathId, stressed, month]);
  const [answers, setAnswers] = useState<AdvisorAnswer[]>([]);
  const [working, setWorking] = useState(false);
  // What this deployment has connected: the model behind the advisor, and speech to text.
  const [abilities, setAbilities] = useState<ServerAbilities>({ model: false, voice: false });
  useEffect(() => {
    let live = true;
    void serverAbilities().then((found) => {
      if (live) setAbilities(found);
    });
    return () => {
      live = false;
    };
  }, []);
  // Rises each time the founder asks out loud, so the reply is read back without a second press.
  const [spokenAsk, setSpokenAsk] = useState(0);
  const pendingAsk = useRef<AbortController | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const advisorRef = useRef<HTMLElement>(null);
  const objectRef = useRef<HTMLElement>(null);
  const [objectTab, setObjectTab] = useState<ObjectTab>('explore');
  // What the founder has made. Kept while they stay in the room, and freed when they leave.
  const [outputs, setOutputs] = useState<MediaOutput[]>([]);
  const [recording, setRecording] = useState(false);
  const outputUrls = useRef<string[]>([]);
  const addOutput = useCallback((output: MediaOutput) => {
    outputUrls.current.push(output.url);
    setOutputs((list) => [...list, output]);
  }, []);
  useEffect(() => () => outputUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);
  const [question, setQuestion] = useState('');
  const [evidence, setEvidence] = useState<ResolvedClaim | null>(null);
  const [sheet, setSheet] = useState<null | 'memo'>(null);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [replayT, setReplayT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [memo, setMemo] = useState<Memo>(EMPTY_MEMO);
  const [announce, setAnnounce] = useState('');
  const [editNote, setEditNote] = useState('');
  // The courtyard: where the camera stands (places are not months) and the object in focus.
  const [manifest, setManifest] = useState<CourtyardManifest | null>(null);
  const [worldError, setWorldError] = useState('');
  const [sceneReady, setSceneReady] = useState(false);
  const [place, setPlace] = useState<PlaceId>('spawn');
  const [walk, setWalk] = useState(false);
  const [photo, setPhoto] = useState(true);
  const [walkError, setWalkError] = useState('');
  const walkHandle = useRef<WalkHandle | null>(null);
  // The draft characters stay out of the room unless asked for: they are not accepted as realistic yet.
  const people = useMemo(() => new URLSearchParams(location.search).has('people'), []);
  // The founder's own names for the room, applied over the built manifest; positions never change.
  const dressing = binding?.dressing ?? null;
  const dressingRef = useRef(dressing);
  dressingRef.current = dressing;
  const rawManifest = useRef<CourtyardManifest | null>(null);
  useEffect(() => {
    if (rawManifest.current) setManifest(applyDressing(rawManifest.current, dressing));
  }, [dressing]);
  const [focus, setFocus] = useState<ObjectId | null>(null);
  const [hoverObject, setHoverObject] = useState<ObjectId | null>(null);
  useEffect(() => {
    let live = true;
    loadManifest().then(
      (m) => {
        if (!live) return;
        rawManifest.current = m;
        setManifest(applyDressing(m, dressingRef.current));
      },
      (e: Error) => live && setWorldError(e.message),
    );
    return () => {
      live = false;
    };
  }, []);
  const markReady = useCallback(() => setSceneReady(true), []);

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

  // A new revision can come from an object here or from the assumptions panel elsewhere in the app. Either way no
  // pending answer may land on the new figures, and a replay of the old ones is closed rather than relabelled.
  const seenRevision = useRef(session.profileRevision);
  useEffect(() => {
    if (seenRevision.current === session.profileRevision) return;
    seenRevision.current = session.profileRevision;
    gate.invalidate();
    setWorking(false);
    setReplay(null);
    setPlaying(false);
    say(`Revision ${session.profileRevision}: the inputs changed and the engine recomputed every figure. Earlier answers are historical.`);
  }, [gate, say, session.profileRevision]);

  const select = useCallback((m: number) => {
    setMonth(Math.min(36, Math.max(1, m)));
  }, []);

  // Clicking an object in the courtyard focuses it and walks the guided camera to the place it belongs to.
  const inspect = useCallback(
    (id: ObjectId) => {
      setFocus(id);
      if (manifest) {
        // A walker selects what they already stand beside; only the guided camera needs sending there.
        if (!walk) setPlace(manifest.objects[id].place);
        say(`${manifest.objects[id].label} selected. Its details are in the panel.`);
      }
    },
    [manifest, say, walk],
  );

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

  // What the advisor is told about this moment. Read when the question is sent, so it is never a stale copy.
  const latest = useRef({ abilities, extras: (_target: PathLetter): LiveExtrasShape => ({ object: null, context: {}, history: [] }) });
  latest.current = {
    abilities,
    extras: (target) => ({
      object: focus && manifest ? { id: focus, label: manifest.objects[focus].label, ...(dressing?.objects[focus]?.caption ? { caption: dressing.objects[focus].caption } : {}) } : null,
      context: { ...(binding?.context ?? DEMO_CONTEXT), decision: binding?.context?.decision ?? session.title },
      history: answers
        .filter((a) => a.pathId === target && a.status === 'answered')
        .slice(-3)
        .flatMap((a) => [{ role: 'user' as const, text: a.question }, { role: 'advisor' as const, text: answerTranscript(a) ?? '' }]),
    }),
  };

  const runAnswer = useCallback(
    async (target: PathLetter, stress: boolean, m: number, q: string) => {
      const snap = session.snapshotFor(target, stress);
      currentKey.current = snap.key;
      const ticket = gate.begin(snap.key);
      setWorking(true);
      pendingAsk.current?.abort();
      const abort = new AbortController();
      pendingAsk.current = abort;
      const scope = { pathId: target, snapshotKey: snap.key, month: m };
      let a: AdvisorAnswer;
      try {
        const live = latest.current.abilities.model ? await (photo ? askFutureSelf : askLive)(session, scope, stress, q, latest.current.extras(target), abort.signal) : ({ kind: 'fixture' } as const);
        if (live.kind === 'answer') a = live.answer;
        else if (live.kind === 'failed') a = { status: 'declined', intent: 'live', question: q, pathId: target, snapshotKey: snap.key, month: m, segments: [{ kind: 'text', text: live.message }], claims: [], trace: [] };
        else {
          await Promise.resolve();
          a = answerQuestion(session, scope, q);
          if (photo && a.status === 'answered') a = { ...a, segments: [{ kind: 'text', text: 'In this possible future, this is what I would be watching. ' }, ...a.segments] };
        }
      } catch {
        return; // A newer question replaced this one.
      }
      // Publish only if nothing relevant changed while this was pending (B -> C -> B, a double tap, a lever pull).
      if (gate.isCurrent(ticket, currentKey.current)) {
        setAnswers((prev) => [...prev, a]);
        setWorking(false);
        say(a.status === 'answered' ? `Advisor answered on path ${target}.` : a.status === 'declined' ? 'The advisor could not answer that.' : 'The answer was withheld because it did not match the simulation.');
      }
    },
    [gate, say, session, photo],
  );

  const ask = useCallback(
    (q: string, spoken = false) => {
      const t = q.trim();
      if (!t) return;
      setQuestion('');
      if (spoken) setSpokenAsk((n) => n + 1);
      void runAnswer(pathId, stressed[pathId], month, t);
    },
    [month, pathId, runAnswer, stressed],
  );
  const voice = useVoiceInput(useCallback((heard: string) => ask(heard, true), [ask]));

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
      // A confirmed decision's cards live in the app, so the edit goes there; the demo keeps its own session.
      const r = binding
        ? binding.onRevise(pathLetter, a.id, edit)
        : (() => {
            const next = session.revise(pathLetter, a.id, edit);
            if (!next.ok) return next;
            setOwnSession(next.session);
            return { ok: true as const, revision: next.session.profileRevision };
          })();
      if (!r.ok) return setEditNote(`The engine refused that edit: ${r.error}`);
      gate.invalidate();
      setEditNote(`Applied to path ${pathLetter}: ${a.label} is now R${Math.round(newBase).toLocaleString('en-ZA').replace(/\u00a0/g, ',')}. New revision ${r.revision}. Earlier answers and any replay are now historical.`);
    },
    [binding, gate, session],
  );

  const switchPath = (p: PathLetter) => {
    gate.invalidate();
    setWorking(false);
    setPathId(p);
    say(`Path ${p}: ${session.paths[p].name}.`);
  };

  // The advisor's suggestions move the view and nothing else: an assumption can only change through an object's own Apply.
  const runAction = (action: AdvisorAction) => {
    if (action.type === 'show_month') {
      select(action.month);
      say(`Showing month ${action.month}.`);
    } else if (action.type === 'late_payment') {
      if (stressed[pathId] !== action.on) toggleLever();
    } else if (action.type === 'switch_path') switchPath(action.path);
    else if (walk && walkHandle.current) walkHandle.current.inspect(action.object);
    else inspect(action.object);
  };

  // Keep the result of what was just done in view: the panel scrolls inside itself, and a phone scrolls the page.
  const reveal = useCallback(
    (el: HTMLElement | null) => {
      const panel = panelRef.current;
      if (!el || !panel) return;
      if (panel.scrollHeight <= panel.clientHeight) return el.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      panel.scrollTo({ top: el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 8, behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced],
  );
  useEffect(() => {
    if (!focus) return;
    setObjectTab('explore');
    reveal(objectRef.current);
  }, [focus, reveal]);
  useEffect(() => {
    if (working || answers.length > 0) reveal(advisorRef.current);
  }, [answers.length, reveal, working]);

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
    setWalk(false);
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
        setFocus(null);
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
  const delayMonths = snapshot.terms.addedDelayMonths || 2;
  const assumptionOf = (re: RegExp) => snapshot.assumptions.find((a) => re.test(a.label));
  const fridge = assumptionOf(/equipment/i);
  // Contract wording comes from the path's own contract line and the engine's terms, never from the demo story.
  const contractLine = snapshot.baselineAssumptions.find((a) => a.role === 'contract');
  const firstPay = snapshot.terms.firstReceiptMonth;
  const isDemo = session.mode === 'demo';
  const shownPlace: PlaceId = shot ? PLACE_FOR_STATION[shot.station] : place;
  const replayOutdated = replay ? isOutdated(replay, session) : false;
  const shotClaims = replay && shot ? resolveShot(session, shot) : [];
  const shotBroken = replay && shot ? shotUnavailable(session, shot) : false;
  const focusInfo = focus && manifest ? manifest.objects[focus] : null;
  const tickAt = (m: number) => `${((m - 1) / 35) * 100}%`;
  const readout = useMemo(() => buildReadout(snapshot, shownMonth), [shownMonth, snapshot]);
  const lastAnswer = answers.at(-1);
  const heardAnswer = lastAnswer && lastAnswer.snapshotKey === snapshot.key && lastAnswer.month === shownMonth ? answerTranscript(lastAnswer) : null;
  const objectLabel = (id: string) => manifest?.objects[id as ObjectId]?.label ?? id;
  // A suggestion to go where the founder already is would be a button that does nothing.
  const wouldChange = (action: AdvisorAction) =>
    !((action.type === 'show_month' && action.month === shownMonth) || (action.type === 'late_payment' && action.on === isStress) || (action.type === 'switch_path' && action.path === snapshot.ref.pathId));

  return (
    <div className={binding ? 'world world--embedded' : 'world'} data-lite={lowTier ? '' : undefined}>
      <section className="stage" aria-label={photo ? 'Photographic possible future' : 'The courtyard'}>
        <div className="stage__view">
          {photo && <PhotoWorld readout={readout} place={shownPlace} selected={inReplay ? null : focus} onSelect={inspect} reduced={reduced} transcript={heardAnswer} resetKey={`${snapshot.key}|${shownMonth}|${answers.length}|${focus ?? ''}|${shownPlace}`} disabled={inReplay || working} autoPlay={spokenAsk} demo={isDemo} />}
          {!photo && <img className={`stage__poster ${sceneReady && webgl ? 'is-hidden' : ''}`} src={`${WORLD_BASE}stills/${shownPlace}.jpg`} alt="" />}
          {!photo && webgl && manifest && (
            <SceneBoundary onFailure={(error) => { console.error('Courtyard renderer failed:', error); setWalk(false); setWebgl(false); }}>
            <Suspense fallback={null}>
              <Courtyard
                manifest={manifest}
                place={shownPlace}
                walk={walk && !inReplay}
                walkHandle={walkHandle}
                onWalkError={(message) => { setWalk(false); setWalkError(message); }}
                onPlaceNear={setPlace}
                people={people}
                paused={recording}
                readout={readout}
                selected={focus}
                hovered={hoverObject}
                onHover={setHoverObject}
                onSelect={inspect}
                reduced={reduced}
                lowTier={lowTier}
                onReady={markReady}
                onContextLost={() => { setWalk(false); setWebgl(false); }}
              />
            </Suspense>
            </SceneBoundary>
          )}
          {!photo && walkError && <p className="stage__status stage__status--warn" role="alert">{walkError} Guided mode is available.</p>}
          {!photo && webgl && !sceneReady && !worldError && (
            <p className="stage__status" role="status">Loading the 3D courtyard. Until it is ready you see a still render of the same model.</p>
          )}
          {!photo && (!webgl || worldError) && (
            <p className="stage__status stage__status--warn" role="note">
              {worldError || 'The 3D courtyard could not be loaded or was interrupted, so this is a still render of the courtyard model.'} The figures, objects and advisor work without it.
              {!worldError && <><br /><button className="btn btn--ghost btn--sm" onClick={() => { setSceneReady(false); setWebgl(true); }}>Try 3D again</button></>}
            </p>
          )}
        </div>

        <div className="stage__top">
          <div className="placecard glass">
            <b>{dressing?.title ?? (photo ? 'A possible future' : isDemo ? 'Ayanda’s courtyard' : 'The courtyard')}</b>
            <span>{binding ? binding.founderLabel : 'Fictional founder'} · {photo ? 'Illustrative photo world' : '3D model, illustrative setting'}</span>
            <div role="tablist" aria-label="Path" className="paths">
              {PATH_ORDER.map((p) => (
                <button key={p} role="tab" aria-selected={snapshot.ref.pathId === p} className={`pathchip pathchip--${p}`} onClick={() => switchPath(p)} disabled={inReplay}>
                  <b>{p}</b> {session.paths[p].name}
                </button>
              ))}
            </div>
          </div>
          <div className="modes glass" role="group" aria-label="View mode">
            <button aria-pressed={photo} onClick={() => { setPhoto(true); setWalk(false); }}>Photo</button>
            <button aria-pressed={!photo} disabled={!webgl || inReplay} onClick={() => { setPhoto(false); setWalkError(''); setWalk(true); }}>Walk</button>
            <button disabled title="Not offered until it is tested on a real headset">VR</button>
          </div>
        </div>

        <div className="stage__bottom glass">
          <div className="places" role="group" aria-label="Places in the courtyard">
            <span className="rowlabel">Places</span>
            {PLACE_ORDER.map((id) => (
              <button
                key={id}
                aria-pressed={shownPlace === id}
                disabled={inReplay}
                onClick={() => {
                  setPlace(id);
                  if (photo) setFocus(null);
                  say(`${walk ? 'Walking to' : 'Moved to'} ${manifest?.places[id].label ?? id}.`);
                }}
              >
                {manifest?.places[id].label ?? id}
              </button>
            ))}
            <span className="hint">{photo ? 'Explore the photograph · choose an object' : !webgl ? 'Still image · select a place or object' : walk ? 'Press a place to walk there' : 'Drag to look · click an object'}</span>
          </div>
          <div className="months">
            <span className="rowlabel">
              Month <b>{shownMonth}</b> of 36
            </span>
            <div className="months__track">
              <input type="range" min={1} max={36} value={shownMonth} disabled={inReplay} onChange={(e) => select(Number(e.target.value))} aria-label="Month" aria-valuetext={`Month ${shownMonth} of 36`} />
              <div className="months__ticks" aria-hidden="true">
                {MONTH_TICKS.map((m) => (
                  <span key={m} style={{ left: tickAt(m) }}>
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="panel" ref={panelRef} aria-label="The payment gap, from the engine">
        <h2 className="panel__h">Explore the payment gap</h2>
        <p className="panel__sub">
          Path {snapshot.ref.pathId} · Month {shownMonth} · {isStress ? 'late payment applied' : 'baseline'}
        </p>
        <p className="note">
          {isDemo ? 'Fictional demo founder. ' : 'Your confirmed answers. '}Every figure comes from the engine
          {session.profileRevision > 1 ? `; revision ${session.profileRevision}, so earlier answers are historical` : ''}.
        </p>

        <button className={`switch ${isStress ? 'is-on' : ''}`} role="switch" aria-checked={isStress} onClick={toggleLever} disabled={inReplay}>
          <span>
            Late payment<small>Client pays {delayMonths} months late</small>
          </span>
          <i aria-hidden="true" />
        </button>

        <div className="evidence">
          <h3>Cash at month {shownMonth}</h3>
          <div className="pair">
            <Figure c={cells.cashB} title="Baseline" onOpen={setEvidence} />
            {isStress && <Figure c={cells.cashA} title="With the delay" stress onOpen={setEvidence} />}
          </div>
          {isStress && snapshot.active.firstShortfall !== null && (
            <p className="caution" role="note">
              <b>First shortfall: month {snapshot.active.firstShortfall}.</b> Later months are still projected; the engine does not model funding or closing.
            </p>
          )}
          <dl className="minor">
            <dt>Lowest cash</dt>
            <dd>
              {cells.lowB && <button className="linkish" onClick={() => setEvidence(cells.lowB)}>{cells.lowB.text}</button>}
              {isStress && cells.lowA && (
                <>
                  {' · '}
                  <button className="linkish" onClick={() => setEvidence(cells.lowA)}>{cells.lowA.text} with the delay</button>
                </>
              )}
            </dd>
            <dt>Month 36</dt>
            <dd>
              {cells.endB && <button className="linkish" onClick={() => setEvidence(cells.endB)}>{cells.endB.text}</button>}
              {isStress && cells.endA && (
                <>
                  {' · '}
                  <button className="linkish" onClick={() => setEvidence(cells.endA)}>{cells.endA.text} with the delay</button>
                </>
              )}
            </dd>
          </dl>
          <button className="calc" onClick={() => setEvidence((isStress ? cells.cashA : cells.cashB) ?? null)}>
            Show calculation <span aria-hidden="true">›</span>
          </button>
          <p className="rule">
            {isStress ? snapshot.terms.stressRule : 'The switch applies the engine’s late-payment rule to this path.'}
            {firstPay ? ` The first contract payment lands in month ${firstPay}.` : ' This path has no contract.'}
          </p>
          <details className="table"><summary>Show cash graph</summary><CashStory snapshot={snapshot} selectedMonth={shownMonth} onSelectMonth={select} disabled={inReplay} /></details>
          <details className="table">
            <summary>All 36 months as a table</summary>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Baseline cash</th>
                  {isStress && <th>With the delay</th>}
                </tr>
              </thead>
              <tbody>
                {snapshot.baseline.rows.map((r, i) => (
                  <tr key={r.month} className={r.month === shownMonth ? 'is-sel' : ''}>
                    <td>
                      <button className="linkish" onClick={() => select(r.month)} disabled={inReplay}>
                        {r.month}
                      </button>
                    </td>
                    <td>{cellText(r.cash)}</td>
                    {isStress && (
                      <td className={snapshot.active.rows[i]!.cash < 0 ? 'neg' : ''}>
                        {cellText(snapshot.active.rows[i]!.cash)}
                        {snapshot.active.rows[i]!.cash < 0 ? ' (below zero)' : ''}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        {manifest && <details className="object">
          <summary>Objects in the courtyard</summary>
          <div className="object-links" role="group" aria-label="Courtyard objects">
            {OBJECT_IDS.map((id) => <button key={id} className="btn btn--ghost btn--sm" onClick={() => { if (walk && walkHandle.current) walkHandle.current.inspect(id); else inspect(id); }}>{manifest.objects[id].label}</button>)}
          </div>
        </details>}

        {focus && focusInfo && (
          <section className="object" ref={objectRef} aria-label={focusInfo.label}>
            <div className="object__head">
              <span className="chip">Selected object</span>
              <b>{focusInfo.label}</b>
              <button className="x" onClick={() => setFocus(null)} aria-label="Close the object">
                ×
              </button>
            </div>
            <div className="object__tabs" role="tablist" aria-label={`What to do with ${focusInfo.label}`}>
              {OBJECT_TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={objectTab === t.id} onClick={() => setObjectTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </div>
            {objectTab === 'visualise' && (
              <div role="tabpanel" aria-label="Visualise">
                <CashStory snapshot={snapshot} selectedMonth={shownMonth} onSelectMonth={select} disabled={inReplay} />
              </div>
            )}
            {objectTab === 'listen' && (
              <div role="tabpanel" aria-label="Listen" className="object__listen">
                <p>{listenScript(buildReelPlan(snapshot, shownMonth, focus, focusInfo.label))}</p>
                <DemoVoice transcript={listenScript(buildReelPlan(snapshot, shownMonth, focus, focusInfo.label))} resetKey={`${snapshot.key}|${shownMonth}|${focus}`} disabled={inReplay} working={false} label="Hear this month" />
              </div>
            )}
            {objectTab === 'create' && (
              <div role="tabpanel" aria-label="Create">
                <MediaStudio
                  snapshot={snapshot}
                  month={shownMonth}
                  objectId={focus}
                  objectLabel={focusInfo.label}
                  stillUrl={`${WORLD_BASE}stills/${focusInfo.place}.jpg`}
                  outputs={outputs}
                  onOutput={addOutput}
                  onRecording={setRecording}
                  revision={session.profileRevision}
                  disabled={inReplay}
                />
              </div>
            )}
            {objectTab === 'explore' && <div role="tabpanel" aria-label="Explore" className="object__explore">
            {dressing?.objects[focus]?.caption && <p className="muted small">{dressing.objects[focus].caption}</p>}
            {focus === 'contract' && (
              <>
                <p>
                  {contractLine && firstPay
                    ? `Contract payments run from month ${firstPay} to month ${contractLine.toMonth ?? 36}. The first payment lands ${snapshot.terms.paymentLagMonths} months after work starts.`
                    : 'This path declines the contract.'}
                </p>
                <EditField session={session} pathId={snapshot.ref.pathId} role="contract" label="Monthly contract value (rand)" onApply={applyEdit} note={editNote} />
                <p className="muted small">Payment terms change only through a reviewed edit of the story, not here. An edit applies to the path shown.</p>
              </>
            )}
            {focus === 'pan' && (
              <>
                <p>The direct cost of the contract work on this path: a template share of the contract’s value, marked as template.</p>
                <EditField session={session} pathId={snapshot.ref.pathId} role="direct" label="Direct costs per month (rand)" onApply={applyEdit} note={editNote} />
              </>
            )}
            {focus === 'fridge' && (
              <>
                <p>{fridge ? `${fridge.label}. Base R${fridge.base.toLocaleString('en-ZA').replace(/ /g, ',')} (${fridge.source}).` : 'This path does not buy equipment.'}</p>
                <EditField session={session} pathId={snapshot.ref.pathId} role="equipment" label="Equipment cost (rand)" onApply={applyEdit} note={editNote} />
                <p className="muted small">Rent versus buy is the difference between paths B and C: switch path to compare.</p>
              </>
            )}
            {focus === 'intake_desk' && (
              <>
                <p>What path {snapshot.ref.pathId} assumes{isDemo ? ' for the demo founder' : ', from your confirmed answers'}:</p>
                <ul className="assumptions">
                  {snapshot.baselineAssumptions.map((a) => (
                    <li key={a.id}>
                      <span>{a.label}</span>
                      <span className="mono">
                        {a.low === a.high ? cellText(a.base) : `${cellText(a.low)}–${cellText(a.high)}`}
                      </span>
                      <span className="muted small">{a.source ?? ''}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {focus === 'memo' && (
              <>
                <p>Your decision in your own words, with an appendix of exactly the figures you looked at.</p>
                <button className="btn" onClick={() => setSheet('memo')}>
                  Write my decision memo
                </button>
              </>
            )}
            <div className="chips object__asks">
              {OBJECT_QUESTIONS[focus].map((q) => (
                <button key={q} className="chip chip--btn" onClick={() => ask(q)} disabled={inReplay}>
                  {q}
                </button>
              ))}
            </div>
            </div>}
          </section>
        )}

        <section className="advisor" ref={advisorRef} aria-label="Ask the advisor">
          <h3 className="panel__h3">Ask the advisor</h3>
          <p className="fixture">{abilities.model ? LIVE_LABEL : FIXTURE_LABEL}</p>
          <div className="answers" aria-live="polite">
            {answers.slice(-3).map((a, i) => (
              <AnswerCard
                key={i}
                a={a}
                onEvidence={setEvidence}
                onCarry={(t) => carry(a, t)}
                canCarry={a.status === 'answered' && session.registry.get(a.snapshotKey)?.ref.profileRevision === session.profileRevision}
                historical={session.registry.get(a.snapshotKey)?.ref.profileRevision !== session.profileRevision}
                fromPath={a.pathId}
                onAction={i === answers.slice(-3).length - 1 && !inReplay ? runAction : undefined}
                wouldChange={wouldChange}
                onAsk={i === answers.slice(-3).length - 1 && !inReplay ? ask : undefined}
                objectLabel={objectLabel}
              />
            ))}
            {working && <p className="working" role="status">{abilities.model ? 'The advisor is thinking. Muse Spark can take about 10 seconds.' : 'Running the local tools…'}</p>}
          </div>
          <div className="chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip chip--btn" onClick={() => ask(s)} disabled={inReplay}>
                {s}
              </button>
            ))}
          </div>
          <form
            className="ask"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Type a question about this month or the delay" aria-label="Your question" disabled={inReplay} />
            <button className="btn" type="submit" disabled={inReplay || !question.trim()}>
              Ask
            </button>
            {abilities.voice && (
              <button
                type="button"
                className={`btn btn--ghost ask__mic ${voice.state === 'recording' ? 'is-on' : ''}`}
                aria-pressed={voice.state === 'recording'}
                disabled={inReplay || voice.state === 'working'}
                onClick={() => (voice.state === 'recording' ? voice.stop() : void voice.start())}
              >
                {voice.state === 'recording' ? 'Stop' : voice.state === 'working' ? 'Hearing…' : 'Speak'}
              </button>
            )}
          </form>
          {voice.state === 'recording' && <p className="muted small" role="status">Listening. Press Stop when you have asked your question. Nothing is kept.</p>}
          {voice.message && !voice.message.startsWith('Check the words') && <p className="muted small" role="status">{voice.message}</p>}
          {!photo && <DemoVoice transcript={heardAnswer} resetKey={`${snapshot.key}|${shownMonth}|${answers.length}`} disabled={inReplay} working={working} autoPlay={spokenAsk} />}
        </section>

        <footer className="panel__foot">
          <div className="foot__actions">
            {!inReplay ? (
              <button className="btn btn--ghost" onClick={startReplay}>▶ Play 15 s replay</button>
            ) : (
              <button className="btn btn--ghost" onClick={closeReplay}>Close replay</button>
            )}
            <button className="btn" onClick={() => setSheet('memo')}>Write my decision memo</button>
          </div>
          <p className="muted small">
            {photo ? 'The photo world uses generated, illustrative imagery and fictional people.' : 'The courtyard is a 3D model built in Blender with real photo textures and a real Johannesburg sky'}{!photo && people ? <>; the fictional characters are work-in-progress previews. The advisor's navy overshirt, "F_Cardigan_Long_Open_Front" by Mindfront (Sweden), is <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a> from the <a href="https://www.makehumancommunity.org/assets/assetpacks/shirts02.html" target="_blank" rel="noopener noreferrer">MakeHuman shirts02 pack</a>, recoloured, shortened and fitted for Parallax</> : ''}. {isDemo ? 'Demo founder: fictional · ' : ''}Not financial advice · One possible future, not a prediction.
          </p>
        </footer>
      </aside>

      {replay && shot && (
        <div className="replay glass" role="region" aria-label="Replay">
          <div className="replay__row">
            <button className="btn btn--round" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚' : '▶'}</button>
            <button className="btn btn--round" onClick={() => { setPlaying(false); setReplayT(shotStart(replay, Math.max(0, shotAt(replay, replayT).index - 1))); }} aria-label="Previous shot">‹</button>
            <button className="btn btn--round" onClick={() => { setPlaying(false); setReplayT(shotStart(replay, Math.min(replay.shots.length - 1, shotAt(replay, replayT).index + 1))); }} aria-label="Next shot">›</button>
            <input type="range" min={0} max={replay.totalMs - 1} value={Math.round(replayT)} onChange={(e) => { setPlaying(false); setReplayT(Number(e.target.value)); }} aria-label="Replay position" aria-valuetext={`${shot.title}, ${(replayT / 1000).toFixed(1)} of ${(replay.totalMs / 1000).toFixed(0)} seconds`} />
            <span className="mono">{(replayT / 1000).toFixed(1)} / {(replay.totalMs / 1000).toFixed(0)} s</span>
          </div>
          <p className="replay__cap"><b>{shot.title}.</b> {shotBroken ? 'This frozen snapshot is no longer available, so this shot is not shown as evidence. Close the replay and play it again.' : shot.line} {!shotBroken && shotClaims.map((c, i) => <button key={i} className="figure figure--inline" onClick={() => setEvidence(c)}><span>{c.text}</span></button>)}</p>
          <p className="muted small">In-browser playback of frozen snapshots, not an exported video.{replayOutdated ? ' This replay is historical: the inputs changed after it was made.' : ''}</p>
        </div>
      )}

      {evidence && <EvidenceDrawer claim={evidence} session={session} onClose={() => setEvidence(null)} />}
      {sheet === 'memo' && <MemoSheet session={session} viewed={viewed} memo={memo} setMemo={setMemo} onClose={() => setSheet(null)} />}

      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </div>
  );
}

function Figure({ c, title, stress, onOpen }: { c: ResolvedClaim | null; title: string; stress?: boolean; onOpen: (c: ResolvedClaim) => void }) {
  if (!c) return null;
  return (
    <button className={`figure ${stress ? 'figure--stress' : ''}`} onClick={() => onOpen(c)} aria-label={`${title}: ${c.text}. Show the calculation`}>
      <small>{title}</small>
      <span>{c.text}</span>
    </button>
  );
}

/** Moves focus into a dialog on open and restores it on close; the full-screen memo also makes the rest of the page inert. */
function useModal(trap: boolean, focusFirst: boolean, target?: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    // Inside the app the navigation rail and top bar are made inert too, so focus cannot leave the open memo.
    const others = trap ? [...document.querySelectorAll<HTMLElement>('.world > *:not(.memo-wrap), .sidebar, .topbar')] : [];
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

function EditField({ session, pathId, role, label, onApply, note }: { session: Session; pathId: PathLetter; role: 'equipment' | 'contract' | 'direct'; label: string; onApply: (p: PathLetter, role: 'equipment' | 'contract' | 'direct', v: number) => void; note: string }) {
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

function AnswerCard({ a, onEvidence, onCarry, canCarry, historical, fromPath, onAction, wouldChange, onAsk, objectLabel }: { a: AdvisorAnswer; onEvidence: (c: ResolvedClaim) => void; onCarry: (p: PathLetter) => void; canCarry: boolean; historical: boolean; fromPath: PathLetter; onAction?: (action: AdvisorAction) => void; wouldChange: (action: AdvisorAction) => boolean; onAsk?: (q: string) => void; objectLabel: (id: string) => string }) {
  const actions = (a.actions ?? []).filter(wouldChange);
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
          <p className="muted small">{a.source === 'model' ? 'Muse Spark wrote the sentences. Code checked each one and filled in every figure from the engine.' : 'Local execution only: the engine and the claim checks. No model was called.'}</p>
        </details>
      )}
      {onAction && actions.length > 0 && (
        <div className="carry" role="group" aria-label="Suggested next">
          {actions.map((action) => (
            <button key={JSON.stringify(action)} className="btn btn--sm" onClick={() => onAction(action)}>{actionLabel(action, objectLabel)}</button>
          ))}
        </div>
      )}
      {onAsk && a.followups && a.followups.length > 0 && (
        <div className="chips answer__next">
          {a.followups.map((q) => (
            <button key={q} className="chip chip--btn" onClick={() => onAsk(q)}>{q}</button>
          ))}
        </div>
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

function EvidenceDrawer({ claim, session, onClose }: { claim: ResolvedClaim; session: Session; onClose: () => void }) {
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
      <p className="muted small">“Matched” means consistent with this simulation, not that the assumptions are true or the reasoning is financial advice. Template values are placeholders.{session.mode === 'demo' ? ` ${SYNTHETIC_WAGES_NOTE}` : ''}</p>
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

function MemoSheet({ session, viewed, memo, setMemo, onClose }: { session: Session; viewed: string[]; memo: Memo; setMemo: (m: Memo) => void; onClose: () => void }) {
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
        <p className="muted small">{memoFooter(session)} Generated {new Date().toLocaleDateString('en-ZA')}.</p>
        <div className="no-print memo__actions">
          <button className="btn" onClick={() => window.print()}>Print or save as PDF</button>
          <span className="muted small">Your words stay in this browser tab until you print or close it. Nothing is saved to a server.</span>
        </div>
      </div>
    </div>
  );
}
