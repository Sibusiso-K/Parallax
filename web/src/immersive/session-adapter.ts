import { editAssumption, type Edit } from '../../../shared/engine/simulate';
import { SnapshotRegistry, type PathLetter } from '../../../shared/scene/room-model';
import type { PathCard } from '../lib/types';
import { DEMO_SESSION_ID, createSession, sessionFromPaths, type PathEntry, type Session } from './session';

// The bridge between the app's store and the 3D room. The store owns every financial input (its path cards); the
// room only reads them. A confirmed session is built from those exact cards, never re-derived from the profile, so
// the room and the regular screens simulate identical inputs. The demo founder is a separate, explicit input: a
// confirmed decision that fails validation is refused, never silently swapped for the demo.

const LETTERS: readonly PathLetter[] = ['A', 'B', 'C'];

export type ExploreInput =
  | { kind: 'demo' }
  | {
      kind: 'confirmed';
      /** The store's own id for this decision; "demo" is reserved for the fictional founder. */
      sessionId: string;
      /** The store's revision: it rises by one whenever any path card changes. */
      revision: number;
      /** The decision in the founder's words. */
      title: string;
      paths: readonly PathCard[];
      selectedPath: PathLetter;
    };

export type AdapterResult = { ok: true; session: Session } | { ok: false; reason: string };

const fail = (reason: string): AdapterResult => ({ ok: false, reason });

export function exploreSession(input: ExploreInput, registry: SnapshotRegistry = new SnapshotRegistry()): AdapterResult {
  if (input.kind === 'demo') return { ok: true, session: createSession(DEMO_SESSION_ID) };
  if (!input.sessionId || input.sessionId === DEMO_SESSION_ID) return fail('A confirmed decision needs its own session id; "demo" is reserved for the fictional founder.');
  if (!Number.isInteger(input.revision) || input.revision < 1) return fail('A confirmed decision needs a profile revision of 1 or more.');
  if (input.paths.length !== LETTERS.length) return fail('Explore needs exactly the three paths A, B and C.');
  const byLetter = new Map(input.paths.map((p) => [p.letter, p]));
  for (const letter of LETTERS) {
    const card = byLetter.get(letter);
    if (!card) return fail(`Path ${letter} is missing.`);
    if (!Number.isFinite(card.startingCash) || !Array.isArray(card.assumptions)) return fail(`Path ${letter} has no usable inputs.`);
  }
  if (!byLetter.has(input.selectedPath)) return fail(`Path ${input.selectedPath} is not part of this decision.`);
  // The cards themselves are the engine input, exactly as the regular screens pass them to simulate().
  const entry = (letter: PathLetter): PathEntry => {
    const card = byLetter.get(letter)!;
    return { path: card, name: card.name, summary: card.summary };
  };
  const paths: Record<PathLetter, PathEntry> = { A: entry('A'), B: entry('B'), C: entry('C') };
  return {
    ok: true,
    session: sessionFromPaths({
      sessionId: input.sessionId,
      mode: 'confirmed',
      title: input.title.trim() || 'Your decision',
      profile: null,
      paths,
      registry,
      profileRevision: input.revision,
    }),
  };
}

/**
 * One assumption edit, applied to the store's cards with the engine's own validation (the same rule the
 * assumptions panel follows: the edited line becomes the founder's own). Returns new cards; the caller stores them,
 * which starts a new revision. Nothing is changed when the engine refuses.
 */
export function reviseCards(
  cards: readonly PathCard[],
  letter: PathLetter,
  assumptionId: string,
  edit: Edit,
): { ok: true; paths: PathCard[] } | { ok: false; error: string } {
  const card = cards.find((c) => c.letter === letter);
  if (!card) return { ok: false, error: `Path ${letter} is not part of this decision.` };
  const r = editAssumption(card, assumptionId, edit);
  if (!r.ok) return r;
  return { ok: true, paths: cards.map((c) => (c.letter === letter ? r.path : c)) };
}
