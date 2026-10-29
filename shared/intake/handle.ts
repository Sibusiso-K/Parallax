import { extraction, intakeRequest, type Extraction, type FieldKey } from './schema';
import { fixtureExtract } from './fixture';
import { keepQuoted, missingFields } from './verify';

export type Extractor = (text: string) => Promise<unknown>;

export type IntakeResponse =
  | {
      ok: true;
      mode: 'model' | 'fixture';
      fields: Extraction;
      missing: FieldKey[];
      dropped: FieldKey[];
      notice?: string;
    }
  | { ok: false; error: string };

// The /api/intake logic, kept pure so it can be tested without a server.
// `extract` is the model call (Lethabo's intake agent); without it we run in fixture mode.
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
        raw = {};
      }
    } catch {
      notice = "We couldn't reach the model. Your text is kept; please fill in the form.";
      raw = {};
    }
  }

  const { kept, dropped } = keepQuoted(text, extraction.parse(raw));
  return { ok: true, mode, fields: kept, missing: missingFields(kept), dropped, ...(notice ? { notice } : {}) };
}
