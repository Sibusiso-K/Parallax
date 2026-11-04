import { chatJson, type MetaConfig } from '../providers/meta.js';
import { extraction } from './schema.js';

// The intake agent (FEATURES F2): one structured call that reads what the founder wrote and fills the intake fields
// with the exact words they used. Code keeps a field only if its quote is in the text (verify.ts), so the model cannot
// fill a field the founder did not write. This is a first draft of the prompt, for Lethabo to tune against SCOPE section 5.
const SYSTEM = [
  "You read a founder's description of a business decision and reply with JSON only.",
  'Fill a field only when the founder states it, and give as "quote" the exact words they wrote for it.',
  'Never invent a number or a fact. A rough amount ("about 60k", "70 to 100k") becomes a low and a high figure.',
  'Give base only when they say what is usual. Amounts are per month, except cash in the business and the one-off upfront cost.',
  'decisionType is contract (a big contract, order or new client), hire (taking someone on) or pricing (raising prices).',
  'Risk comfort is low, medium or high. Goals are up to three of: cash safety, growth, profit, control, time.',
  'Leave out anything they did not say.',
].join(' ');

/** An Extractor for handle.ts that asks the Meta model. It throws on any failure, and handleIntake turns that into fixture mode. */
export function intakeExtractor(cfg: MetaConfig): (text: string) => Promise<unknown> {
  return async (text) => (await chatJson(cfg, { name: 'intake', system: SYSTEM, user: text, schema: extraction })).value;
}
