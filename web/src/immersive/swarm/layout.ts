import type { Actor } from '../../../../shared/swarm/contracts.js';
export const NODE_POSITIONS: Record<Actor, { x: number; y: number }> = {
  orchestrator: { x: 260, y: 154 }, cash: { x: 102, y: 60 }, market: { x: 414, y: 60 },
  devil: { x: 72, y: 207 }, world: { x: 448, y: 207 }, director: { x: 260, y: 298 },
  synthesiser: { x: 150, y: 402 }, verifier: { x: 375, y: 402 },
};
export const LINKS: [Actor, Actor][] = [['orchestrator', 'cash'], ['orchestrator', 'market'], ['orchestrator', 'devil'], ['orchestrator', 'world'], ['orchestrator', 'director'], ['cash', 'synthesiser'], ['devil', 'synthesiser'], ['director', 'synthesiser'], ['synthesiser', 'verifier']];
