import type { SttAdapter, TtsAdapter } from './voice.js';
import { wavInspector } from './wav-inspector.js';

// Adapter transport is injected by a future reviewed server host. This module
// opens no connections, reads no environment variables, and performs no retry.
export interface VoiceTransport {
  transcribe(input: Uint8Array, signal: AbortSignal): Promise<unknown>;
  synthesize(text: string, signal: AbortSignal): Promise<unknown>;
}
function safeText(text: unknown): text is string {
  // oxlint-disable-next-line no-control-regex -- a sanitiser: it removes control characters from provider text on purpose
  return typeof text === 'string' && text.trim().length > 0 && text.length <= 4000 && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(text);
}
export function createVoiceBoundary(transport: VoiceTransport): { stt: SttAdapter; tts: TtsAdapter } {
  return {
    stt: {
      async transcribe(bytes, mime, signal) {
        try {
          await wavInspector.inspect(bytes, mime, signal);
          if (signal.aborted) throw new Error();
          const result = await transport.transcribe(bytes, signal);
          if (signal.aborted || !safeText(result)) throw new Error();
          return result.trim();
        } catch { throw new Error('transcription unavailable'); }
      },
    },
    tts: {
      async synthesize(text, signal) {
        try {
          if (signal.aborted || !safeText(text)) throw new Error();
          const result = await transport.synthesize(text, signal);
          if (!(result instanceof Uint8Array) || signal.aborted) throw new Error();
          await wavInspector.inspect(result, 'audio/wav', signal);
          if (signal.aborted) throw new Error();
          return result;
        } catch { throw new Error('speech unavailable'); }
      },
    },
  };
}
