// The roadmap of a decision, as a tree. The decision is the root. The questions the app asked branch off it. Then the
// three futures break out, and each one branches into what can happen to it (its milestones and setbacks) and into the
// conversations held with it. Every number comes from the stress figures the path screens already show.
import type { Letter } from "./parallax-store";
import { formatMoney } from "./format";
import type { Figures, Setback } from "./stress";
import type { PathCard } from "./types";

export type RoadmapKind = "decision" | "question" | "path" | "milestone" | "setback" | "conversation" | "hint";

export interface RoadmapTarget {
  step: "heard" | "paths" | "chat";
  letter?: Letter;
}

export interface RoadmapNode {
  id: string;
  kind: RoadmapKind;
  title: string;
  detail?: string;
  /** Cash goes below zero in the likely case: the possibility the founder most needs to see. */
  warn?: boolean;
  letter?: Letter;
  /** Where opening this node takes the founder. A node without a target only describes. */
  target?: RoadmapTarget;
  children: RoadmapNode[];
}

export interface RoadmapChat {
  id: string;
  role: "user" | "self";
  text: string;
  streaming?: boolean;
}

export interface RoadmapQuestion {
  key: string;
  question: string;
  /** True when the founder answered it; false when they said "I don't know" and a marked default was used. */
  answered: boolean;
}

export interface RoadmapInput {
  decision: string;
  business: string;
  paths: PathCard[];
  figures: Partial<Record<Letter, Figures>>;
  chats: Partial<Record<Letter, RoadmapChat[]>>;
  questions: RoadmapQuestion[];
}

export interface Roadmap {
  root: RoadmapNode;
  /** One branch per future, in A, B, C order. */
  branches: RoadmapNode[];
}

const ORDER: Letter[] = ["A", "B", "C"];
const MAX_CONVERSATIONS = 6;

const clip = (text: string, max: number): string => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);
const cap = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text);

/** The first month after the start in which the series is below zero, or null if it never is. */
export function firstBelowZero(series: readonly number[]): number | null {
  for (let m = 1; m < series.length; m++) if (series[m]! < 0) return m;
  return null;
}

function setbackNode(letter: Letter, s: Setback): RoadmapNode {
  const outcome = s.runsOut ? `cash runs out in month ${s.runsOut}` : "cash stays above zero";
  return {
    id: `${letter}-setback-${s.id}`,
    kind: "setback",
    title: s.name,
    detail: `${cap(s.detail)}. Lowest ${formatMoney(s.lowest.cash)} in month ${s.lowest.month}; ${outcome}.`,
    warn: s.runsOut !== null,
    letter,
    target: { step: "chat", letter },
    children: [],
  };
}

/** Each question the founder asked this future, with the reply that answered it. A reply still being written is left out. */
function conversationNodes(letter: Letter, chat: readonly RoadmapChat[]): RoadmapNode[] {
  const out: RoadmapNode[] = [];
  chat.forEach((m, i) => {
    if (m.role !== "user" || !m.text.trim()) return;
    let reply: RoadmapChat | undefined;
    for (let j = i + 1; j < chat.length && chat[j]!.role !== "user"; j++) {
      const r = chat[j]!;
      if (r.role === "self" && !r.streaming && r.text.trim()) {
        reply = r;
        break;
      }
    }
    out.push({
      id: `${letter}-ask-${m.id}`,
      kind: "conversation",
      title: `You asked: ${clip(m.text.trim(), 110)}`,
      detail: reply ? `Future you: ${clip(reply.text.trim(), 170)}` : "Waiting for an answer",
      letter,
      target: { step: "chat", letter },
      children: [],
    });
  });
  return out.slice(-MAX_CONVERSATIONS);
}

function branchFor(path: PathCard, figures: Figures | undefined, chat: readonly RoadmapChat[]): RoadmapNode {
  const letter = path.letter;
  const target: RoadmapTarget = { step: "chat", letter };
  const children: RoadmapNode[] = [];
  if (figures) {
    const runsOut = firstBelowZero(figures.likely);
    const end = figures.likely[figures.likely.length - 1] ?? 0;
    children.push({
      id: `${letter}-cash`,
      kind: "milestone",
      title: runsOut === null ? "Cash stays above zero for 36 months" : `Cash runs out in month ${runsOut}`,
      detail: `Likely case: ${formatMoney(end)} left at month 36.`,
      warn: runsOut !== null,
      letter,
      target,
      children: [],
    });
    if (figures.bufferMonth !== null) {
      children.push({
        id: `${letter}-buffer`,
        kind: "milestone",
        title: `Three months of costs in reserve from month ${figures.bufferMonth}`,
        letter,
        target,
        children: [],
      });
    }
    for (const s of figures.setbacks) children.push(setbackNode(letter, s));
  }
  const talk = conversationNodes(letter, chat);
  if (talk.length > 0) {
    children.push(...talk);
  } else {
    children.push({
      id: `${letter}-hint`,
      kind: "hint",
      title: "No questions asked yet",
      detail: "Open the chat and ask this future anything.",
      letter,
      target,
      children: [],
    });
  }
  return {
    id: `path-${letter}`,
    kind: "path",
    title: `${letter} · ${path.name}`,
    detail: figures
      ? `Lowest cash ${formatMoney(figures.lowestLikely.cash)} in month ${figures.lowestLikely.month} (likely case)`
      : path.summary,
    letter,
    target: { step: "paths", letter },
    children,
  };
}

/** The roadmap: a tree from the decision to every future, and from each future to what can happen to it. */
export function buildRoadmap(input: RoadmapInput): Roadmap {
  const root: RoadmapNode = {
    id: "root",
    kind: "decision",
    title: clip(input.decision.trim() || "Your decision", 120),
    detail: input.business.trim() ? cap(input.business.trim()) : undefined,
    children: input.questions.map(
      (q): RoadmapNode => ({
        id: `q-${q.key}`,
        kind: "question",
        title: clip(q.question, 110),
        detail: q.answered ? "You answered this." : 'You chose "I don\'t know", so a marked default was used.',
        target: { step: "heard" },
        children: [],
      }),
    ),
  };
  const branches = [...input.paths]
    .sort((a, b) => ORDER.indexOf(a.letter) - ORDER.indexOf(b.letter))
    .map((p) => branchFor(p, input.figures[p.letter], input.chats[p.letter] ?? []));
  return { root, branches };
}
