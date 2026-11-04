import { DEMO_TEXT } from '../shared/intake/fixture.js';
import { ModelError } from '../shared/providers/meta.js';
import { transcribeWav, voiceConfigOrNull } from '../shared/providers/asr.js';
import { MAX_UPLOAD_BYTES, checkWav } from '../shared/voice/wav.js';

// Vercel Function: POST /api/transcribe, the body is a WAV file. Voice is on only when META_VOICE_ENABLED is "true" and a
// key is set (see shared/providers/asr.ts). Otherwise the demo story is returned and labelled as such. The audio and the
// transcript are never stored or logged; only the kind of a failure is.
const MAX_TRANSCRIPT_CHARS = 4_000; // the intake text limit

const json = (body: unknown, status: number) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const tooLarge = () => json({ ok: false, error: 'That recording is too long. Keep it under 60 seconds.' }, 413);

export async function POST(request: Request): Promise<Response> {
  // The byte cap covers the largest WAV checkWav accepts (60 s at 24 kHz), so a valid 24 kHz file reaches the check
  // instead of being refused for its size. Anything longer is caught below and still answers 413.
  if (Number(request.headers.get('content-length') ?? 0) > MAX_UPLOAD_BYTES) return tooLarge();
  const wav = new Uint8Array(await request.arrayBuffer());
  if (wav.byteLength > MAX_UPLOAD_BYTES) return tooLarge();
  const checked = checkWav(wav);
  if (!checked.ok) return json({ ok: false, error: checked.error }, checked.tooLong ? 413 : 400);

  const cfg = voiceConfigOrNull(process.env);
  if (!cfg) {
    return json({ ok: true, mode: 'fixture', transcript: DEMO_TEXT, notice: 'Demo mode: speech to text is not connected yet, so the demo story is filled in.' }, 200);
  }
  try {
    const { transcript } = await transcribeWav(cfg, wav);
    if (!transcript) return json({ ok: true, mode: 'model', transcript: '', notice: "We didn't hear anything. Try again, or type instead." }, 200);
    const cut = transcript.length > MAX_TRANSCRIPT_CHARS;
    return json({ ok: true, mode: 'model', transcript: transcript.slice(0, MAX_TRANSCRIPT_CHARS), ...(cut ? { notice: 'That was long, so the end was cut off. Please check it.' } : {}) }, 200);
  } catch (err) {
    console.warn(JSON.stringify({ event: 'transcribe.failed', kind: err instanceof ModelError ? err.kind : 'unknown' }));
    return json({ ok: false, error: "We couldn't turn that into text. Please try again, or type instead." }, 502);
  }
}
