import { guardPaidRoute } from '../shared/http/guard.js';
import { modelConfigOrNull } from '../shared/providers/meta.js';
import { documentRequest, readDocument } from '../shared/world/document.js';
import { readBody, worldJson } from '../shared/world/provider.js';

export const maxDuration = 60;
export async function POST(request: Request): Promise<Response> {
  let input;
  try { input = documentRequest.parse(await readBody(request)); }
  catch { return worldJson({ ok: false, error: 'Choose an image or PDF under the upload limit and agree to send it for reading.' }, 400); }
  const cfg = modelConfigOrNull(process.env);
  if (!cfg) return worldJson({ ok: true, mode: 'fixture', reading: null, message: 'Document reading is not connected. Nothing was extracted or changed.' });
  const refused = guardPaidRoute(request, 'intake');
  if (refused) return refused;
  try { return worldJson({ ok: true, mode: 'model', reading: await readDocument(cfg, input.document) }); }
  catch { return worldJson({ ok: false, error: 'The document could not be read. Your assumptions have not changed.' }, 502); }
}
