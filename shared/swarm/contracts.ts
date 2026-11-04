import { z } from 'zod';
import { advisorRequest, type AdvisorSegment } from '../scene/advisor-model.js';
import type { ClaimRef } from '../scene/claims.js';
import type { Agent, GraphContext } from '../graph/decision-graph.js';
import type { Edit } from '../engine/simulate.js';

export const swarmRequest = advisorRequest.pick({ path: true, month: true, stressed: true, context: true }).extend({
  path: advisorRequest.shape.path.extend({ months: z.number().int().min(1).max(36).optional() }),
  event: z.string().trim().min(1).max(600),
  focus: z.string().max(100).optional(),
}).refine(value => value.month <= (value.path.months ?? 36), { message: 'Month exceeds this path horizon', path: ['month'] });
export type SwarmRequest = z.infer<typeof swarmRequest>;
export type Actor = Agent | 'orchestrator' | 'synthesiser' | 'verifier';
export const LABELS: Record<Actor, string> = { orchestrator: 'Conductor', cash: 'Cash Forensics', market: 'Market Scout', devil: "Devil’s Advocate", world: 'World Builder', director: 'Director', synthesiser: 'Future self', verifier: 'Verifier' };
export interface Source { url: string; quote: string; label: 'External source'; checked: 'url-and-snippet-in-search-results'; }
export interface Proposal { id: string; assumptionId: string; label: string; values: Edit; beforeLowest: number; afterLowest: number; delta: number; inputKey: string; }
export type WorldOp = { type: 'mood'; value: 'golden' | 'night' | 'calm'; prompt: string };
export interface Finding { agent: Actor; segments: AdvisorSegment[]; claims: ClaimRef[]; }
export interface Trace {
  agent: Actor; model: string; status: 'running' | 'done' | 'failed'; step: string;
  context: unknown; graphContext?: GraphContext; tools: { name: string; arguments: unknown; result: unknown }[];
  sources: Source[]; inputTokens: number | null; outputTokens: number | null; costUsd: number | null; latencyMs: number;
}
export interface Verification { agent: Actor; pass: boolean; reason: string; claims: ClaimRef[]; }
export interface SwarmResult {
  mode: 'fixture' | 'live' | 'partial'; inputKey: string; findings: Finding[]; proposals: Proposal[];
  worldOps: WorldOp[]; shots: string[]; speech: AdvisorSegment[]; sources: Source[];
  traces: Trace[]; verification: Verification[]; costUsd: number | null;
}
export type SwarmEvent = { type: 'start'; mode: 'fixture' | 'live'; inputKey: string }
  | { type: 'trace'; trace: Trace }
  | { type: 'result'; result: SwarmResult }
  | { type: 'error'; message: string };

export const agentReply = z.object({
  reply: z.string().max(1800).default(''),
  // A model may select a bounded engine-computed candidate; it cannot author a number.
  proposalIds: z.array(z.string().max(80)).max(3).default([]),
  mood: z.enum(['golden', 'night', 'calm']).optional(),
  shots: z.array(z.enum(['Wide room', 'Contract close-up', 'Hands at work', 'Future self', 'Cash evidence', 'Return to founder'])).max(6).default([]),
});
