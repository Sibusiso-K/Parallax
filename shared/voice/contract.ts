import { z } from 'zod';

// The contract for POST /api/transcribe. The request is a WAV file as the body (mono, 16-bit, 16 kHz, at most 60 s).
// An empty transcript with a notice means nothing was heard; the founder can try again or type.
export const transcribeResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    mode: z.enum(['model', 'fixture']),
    transcript: z.string().max(4000),
    notice: z.string().min(1).optional(),
  }),
  z.object({ ok: z.literal(false), error: z.string().min(1) }),
]);

export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;
