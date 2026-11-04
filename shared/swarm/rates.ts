import { z } from 'zod';
const ratesSchema = z.record(z.string(), z.object({ input: z.number().finite().min(0).max(1000), output: z.number().finite().min(0).max(1000) }));
/** Operator-verified USD per million token rates only. Never assume a provider price. */
export function readRates(text: string | undefined) {
  if (!text || text.length > 4000) return undefined;
  try { const result = ratesSchema.safeParse(JSON.parse(text)); return result.success ? result.data : undefined; }
  catch { return undefined; }
}
