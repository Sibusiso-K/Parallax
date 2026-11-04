import { z } from 'zod';
import { extraction } from './schema.js';

// The contract for POST /api/intake: what a 200 or 400 answer looks like. Every answer the route can give must pass this
// schema, so a change to the route's shape fails a test before it reaches a screen.
const fieldKeys = Object.keys(extraction.shape) as [string, ...string[]];

const issue = z.object({
  kind: z.enum([
    'vague-decision',
    'under-age',
    'impossible-age',
    'outlier',
    'contradiction',
    'out-of-scope',
    'not-supported',
    'advice',
  ]),
  message: z.string().min(1),
  field: z.enum(fieldKeys).optional(),
  suggestion: z.number().nonnegative().optional(),
  blocking: z.boolean(),
});

export const intakeResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    mode: z.enum(['model', 'fixture']),
    fields: extraction,
    missing: z.array(z.enum(fieldKeys)),
    dropped: z.array(z.enum(fieldKeys)),
    issues: z.array(issue),
    notice: z.string().min(1).optional(),
  }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

export type IntakeResponseContract = z.infer<typeof intakeResponseSchema>;
