import { simulate, type PathInput } from '../engine/simulate.js';
import { canonicalJson, fingerprint } from '../scene/room-model.js';

export const AGENTS = ['cash', 'market', 'devil', 'world', 'director'] as const;
export type Agent = typeof AGENTS[number];
export interface GraphNode { id: string; kind: 'assumption' | 'figure' | 'month' | 'source' | 'agent' | 'claim'; label: string; value?: number; }
export interface GraphEdge { from: string; to: string; weight: number; }
export interface GraphContext { nodes: GraphNode[]; edges: GraphEdge[]; estimatedTokens: number; fullEstimatedTokens: number; estimatedTokensSaved: number; truncated: boolean; }
const order = (a: { id: string }, b: { id: string }) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export const estimateTokens = (value: unknown) => Math.ceil(canonicalJson(value).length / 4);

/** Derivatives are rand of month-end cash per rand of a recurring assumption, not model scores. */
export function buildDecisionGraph(input: PathInput) {
  const path = { ...input, assumptions: [...input.assumptions].sort(order) };
  if (new Set(path.assumptions.map(a => a.id)).size !== path.assumptions.length) throw new Error('Assumption IDs must be unique');
  const rows = simulate(path).likely.rows;
  const nodes: GraphNode[] = AGENTS.map(id => ({ id: `agent:${id}`, kind: 'agent', label: id }));
  const edges: GraphEdge[] = [];
  const edge = (from: string, to: string, weight = 1) => edges.push({ from, to, weight });
  for (const row of rows) {
    nodes.push({ id: `month:${row.month}`, kind: 'month', label: `Month ${row.month}` },
      { id: `figure:cash:${row.month}`, kind: 'figure', label: 'Month-end cash', value: row.cash },
      { id: `claim:cash:${row.month}`, kind: 'claim', label: 'Engine cash projection', value: row.cash });
    edge(`month:${row.month}`, `figure:cash:${row.month}`);
    edge(`figure:cash:${row.month}`, `claim:cash:${row.month}`);
  }
  for (const a of path.assumptions) {
    const source = `source:${a.source ?? 'unknown'}`;
    if (!nodes.some(n => n.id === source)) nodes.push({ id: source, kind: 'source', label: a.source ?? 'Unknown origin' });
    nodes.push({ id: `assumption:${a.id}`, kind: 'assumption', label: a.label, value: a.base });
    edge(source, `assumption:${a.id}`);
    for (const agent of AGENTS) edge(`agent:${agent}`, `assumption:${a.id}`);
    const step = Math.max(1, a.base * .01);
    const changed = simulate({ ...path, assumptions: path.assumptions.map(x => x.id === a.id ? { ...x, low: x.low + step, base: x.base + step, high: x.high + step } : x) }).likely.rows;
    rows.forEach((r, i) => {
      const weight = (changed[i]!.cash - r.cash) / step;
      if (weight !== 0) edge(`assumption:${a.id}`, `figure:cash:${r.month}`, weight);
    });
  }
  nodes.sort(order);
  edges.sort((a, b) => canonicalJson(a).localeCompare(canonicalJson(b), 'en'));
  const graph = { nodes, edges };
  return {
    ...graph, fingerprint: fingerprint(canonicalJson(graph)),
    /** Deterministic breadth-first k-hop slice. Budget includes serialized edges, not just node labels. */
    contextFor(agent: Agent, focus: string, budget = 1800, hops = 2): GraphContext {
      if (!Number.isFinite(budget) || budget < estimateTokens({ nodes: [], edges: [] })) throw new RangeError('Context budget must fit an empty graph');
      const cap = Math.max(0, Math.floor(budget));
      const selected = new Set<string>();
      let frontier = [`agent:${agent}`, focus].filter((v, i, xs) => xs.indexOf(v) === i && nodes.some(n => n.id === v));
      let truncated = false;
      for (let depth = 0; depth <= Math.min(4, Math.max(0, hops)); depth++) {
        const next = new Set<string>();
        for (const id of frontier.sort()) {
          if (selected.has(id)) continue;
          const candidate = new Set([...selected, id]);
          const slice = { nodes: nodes.filter(n => candidate.has(n.id)), edges: edges.filter(e => candidate.has(e.from) && candidate.has(e.to)) };
          if (estimateTokens(slice) > cap) { truncated = true; continue; }
          selected.add(id);
          for (const e of edges) {
            if (e.from === id && !selected.has(e.to)) next.add(e.to);
            if (e.to === id && !selected.has(e.from)) next.add(e.from);
          }
        }
        frontier = [...next];
      }
      const slice = { nodes: nodes.filter(n => selected.has(n.id)), edges: edges.filter(e => selected.has(e.from) && selected.has(e.to)) };
      const estimatedTokens = estimateTokens(slice);
      const fullEstimatedTokens = estimateTokens(graph);
      return { ...slice, estimatedTokens, fullEstimatedTokens, estimatedTokensSaved: Math.max(0, fullEstimatedTokens - estimatedTokens), truncated };
    },
  };
}
