import { checkIntake, type Issue } from './checks.js';
import { detectDecision } from './decision.js';
import { extraction, intakeRequest, type Extraction, type FieldKey } from './schema.js';
import { fixtureExtract } from './fixture.js';
import { keepQuoted, missingFields } from './verify.js';

export type Extractor = (text: string) => Promise<unknown>;

export type IntakeResponse =
  | {
      ok: true;
      mode: 'model' | 'fixture';
      fields: Extraction;
      missing: FieldKey[];
      dropped: FieldKey[];
      /** F4 checks: questions to put to the founder. A blocking one stops the simulation. */
      issues: Issue[];
      notice?: string;
    }
  | { ok: false; error: string };

// The /api/intake logic, kept pure so it can be tested without a server.
// `extract` is the model call (the intake agent, agent.ts). Without it, or when it fails, the demo fixture answers for
// the demo story and an empty form answers for anything else. The founder's text is never lost (ARCHITECTURE §12).
export async function handleIntake(body: unknown, extract?: Extractor): Promise<IntakeResponse> {
  const req = intakeRequest.safeParse(body);
  if (!req.success) return { ok: false, error: req.error.issues[0]?.message ?? 'Invalid request' };
  const text = req.data.text;

  let mode: 'model' | 'fixture' = 'fixture';
  let notice: string | undefined;
  let raw: unknown = fixtureExtract(text);

  if (extract) {
    try {
      const fromModel = extraction.safeParse(await extract(text));
      if (fromModel.success) {
        raw = fromModel.data;
        mode = 'model';
      } else {
        notice = "We couldn't read everything. Please fill in the form.";
      }
    } catch {
      notice = "We couldn't reach the model. Your text is kept; please fill in the form.";
    }
  }

  const { kept, dropped } = keepQuoted(text, extraction.parse(raw));
  // The kind of decision comes from the founder's own words when the model did not give one: first the sentence that
  // states the decision, then the whole text. Undetected, it is asked as a follow-up like any missing field.
  if (!kept.decisionType) {
    const found = detectDecision(kept.decision?.quote ?? '') ?? detectDecision(text);
    if (found) kept.decisionType = found;
  }
  const issues = checkIntake(text, kept);
  return { ok: true, mode, fields: kept, missing: missingFields(kept), dropped, issues, ...(notice ? { notice } : {}) };
}
