import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_SECONDS, SAMPLE_RATE, encodeWav, toMono16k } from "../../../shared/voice/wav";

// Push-to-talk voice input (docs/FEATURES.md F3). The browser records, converts to 16 kHz mono WAV, and posts it to
// /api/transcribe. The transcript is handed back for the founder to correct; nothing is submitted for them, and no audio
// is kept here or on the server.

export type VoiceState = "idle" | "recording" | "working";

export const voiceSupported = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

const MIN_SAMPLES = SAMPLE_RATE / 4; // under a quarter of a second is a mis-tap

export function useVoiceInput(onText: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [message, setMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );

  const transcribe = useCallback(
    async (blob: Blob) => {
      try {
        const ctx = new AudioContext();
        const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
        void ctx.close();
        const channels = Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i));
        const samples = toMono16k(channels, audio.sampleRate).subarray(0, SAMPLE_RATE * MAX_SECONDS);
        if (samples.length < MIN_SAMPLES) return setMessage("That was too short. Hold the button while you speak.");
        const res = await fetch("/api/transcribe", { method: "POST", headers: { "content-type": "audio/wav" }, body: new Blob([encodeWav(samples) as BlobPart], { type: "audio/wav" }) });
        const data = (await res.json()) as { ok: boolean; transcript?: string; notice?: string; error?: string };
        if (!data.ok) return setMessage(data.error ?? "We couldn't turn that into text. Please type instead.");
        if (data.transcript) onText(data.transcript);
        setMessage(data.notice ?? (data.transcript ? "Check the words below, fix anything wrong, then continue." : ""));
      } catch {
        setMessage("We couldn't turn that into text. Please type instead.");
      } finally {
        setState("idle");
      }
    },
    [onText],
  );

  const start = useCallback(async () => {
    setMessage("");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setMessage("The microphone is blocked. Allow it in your browser, or type instead.");
    }
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = () => {
      window.clearTimeout(timer.current);
      stream.getTracks().forEach((t) => t.stop());
      setState("working");
      void transcribe(new Blob(chunks, { type: rec.mimeType }));
    };
    recorder.current = rec;
    rec.start();
    setState("recording");
    timer.current = window.setTimeout(() => rec.state === "recording" && rec.stop(), MAX_SECONDS * 1000);
  }, [transcribe]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  return { state, message, start, stop };
}
