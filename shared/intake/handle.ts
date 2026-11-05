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
  if (!req.success) {
    // Only the two limits carry a message written for the founder. A missing or wrong-typed body would otherwise show
    // zod's own wording ("Invalid input: expected string, received number") as the notice on the next screen.
    const issue = req.error.issues[0];
    const friendly = issue?.code === 'too_small' || issue?.code === 'too_big';
    return { ok: false, error: friendly ? issue!.message : 'Tell us about your decision in a few sentences.' };
  }
  const text = req.data.text;

  let mode: 'model' | 'fixture' = 'fixture';
  let notice: string | undefined;
  let raw: unknown = fixtureExtract(text);

  if (extract) {
    try {
      const fromModel = extraction.safeParse(await extract(text));
      // A reply can match the schema and still say nothing (every field optional). That is not a reading: say so, and
      // do not label the answer as the model's.
      const filled = fromModel.success ? Object.values(fromModel.data).filter((v) => v !== undefined && v !== null).length : 0;
      if (fromModel.success && filled > 0) {
        raw = fromModel.data;
        mode = 'model';
      } else if (fromModel.success) {
        notice = "The model found nothing to read in your text. Please fill in the form.";
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
