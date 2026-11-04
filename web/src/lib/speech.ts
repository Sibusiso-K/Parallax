// Read aloud: the app's own words (the future self's replies, and the questions the app asks) spoken with the
// browser's built-in voices. The speech is made on the founder's device. Nothing is sent to a server, no model is
// called and nothing is stored. "Read replies aloud" is a per-browser switch, off until the founder turns it on, so
// nothing speaks unasked.
import { useSyncExternalStore } from "react";

const ON_KEY = "parallax.readAloud";
const MAX_CHUNK = 200;
const SUFFIX: Record<string, string> = { k: "thousand", m: "million", bn: "billion" };
const PREFERRED = ["en-ZA", "en-GB", "en-US"];

type Listener = () => void;
type Utter = new (text: string) => SpeechSynthesisUtterance;

const listeners = new Set<Listener>();
let speakingId: string | null = null;
let readAloudFlag: boolean | null = null;
let watchdog: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function synth(): SpeechSynthesis | null {
  return (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis ?? null;
}

function utterance(): Utter | null {
  return (globalThis as unknown as { SpeechSynthesisUtterance?: Utter }).SpeechSynthesisUtterance ?? null;
}

function stopWatch(): void {
  if (watchdog !== null) {
    clearInterval(watchdog);
    watchdog = null;
  }
}

/**
 * Some engines never report that a reply has ended, which would leave "Stop" showing for ever. So once the engine has
 * spoken and then gone quiet for about a second, the reading counts as over. An engine that never starts is given up on
 * after about ten seconds.
 */
function watch(id: string, s: SpeechSynthesis): void {
  stopWatch();
  let sawSpeech = false;
  let quiet = 0;
  watchdog = setInterval(() => {
    if (s.speaking || s.pending) {
      sawSpeech = true;
      quiet = 0;
      return;
    }
    quiet += 1;
    if ((sawSpeech && quiet >= 2) || quiet >= 20) {
      stopWatch();
      if (speakingId === id) {
        speakingId = null;
        emit();
      }
    }
  }, 500);
}

/** Whether this browser can speak at all. */
export function speechSupported(): boolean {
  return synth() !== null && utterance() !== null;
}

/** The id of the reply or question being read aloud now, or null. */
export function currentlySpeaking(): string | null {
  return speakingId;
}

/** The words to speak for a reply: markup, citation tags and placeholders dropped, and amounts read as rand. */
export function spokenText(text: string): string {
  return text
    .replace(/\*\*|__|`|\*/g, "")
    .replace(/\[\s*[A-Z]\d+\s*\]/g, "")
    .replace(/\(see chart\)|\{\{[^}]*\}\}/g, "")
    .replace(/(^|[\s(])[−–-](?=R\s?\d)/g, "$1minus ")
    .replace(/(?<![A-Za-z])R\s?(\d[\d ,]*\d|\d)(?:\.(\d+))?(?:\s?(k|m|bn)\b)?/g, (_m, whole: string, dec: string | undefined, unit: string | undefined) => {
      const number = `${whole.trim()}${dec ? `.${dec}` : ""}`;
      return `${number}${unit ? ` ${SUFFIX[unit]}` : ""} rand`;
    })
    .replace(/(\d)\s?%/g, "$1 percent")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function hardSplit(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && `${cur} ${word}`.length > MAX_CHUNK) {
      out.push(cur);
      cur = word;
    } else {
      cur = cur ? `${cur} ${word}` : word;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** A sentence too long for one piece: broken after commas where possible, and by word where not. */
function pieces(sentence: string): string[] {
  const out: string[] = [];
  let piece = "";
  for (const part of sentence.split(/(?<=,)\s+/)) {
    for (const bit of part.length > MAX_CHUNK ? hardSplit(part) : [part]) {
      if (piece && `${piece} ${bit}`.length > MAX_CHUNK) {
        out.push(piece);
        piece = bit;
      } else {
        piece = piece ? `${piece} ${bit}` : bit;
      }
    }
  }
  if (piece) out.push(piece);
  return out;
}

/** The text as pieces a speech engine handles well: whole sentences where possible, none longer than 200 characters. */
export function speechChunks(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((s) => (s.length <= MAX_CHUNK ? [s] : pieces(s)));
}

export interface VoiceLike {
  lang: string;
  name: string;
}

/** The voice to read with: South African English if the device has it, then British, then American, then any English. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[]): V | undefined {
  for (const tag of PREFERRED) {
    const match = voices.find((v) => v.lang.replace("_", "-").toLowerCase() === tag.toLowerCase());
    if (match) return match;
  }
  return voices.find((v) => v.lang.toLowerCase().startsWith("en"));
}

/** Reads the text aloud, replacing whatever is being read. Returns false where the browser cannot speak it. */
export function speak(id: string, text: string): boolean {
  const s = synth();
  const Utter = utterance();
  const chunks = speechChunks(spokenText(text));
  if (!s || !Utter || chunks.length === 0) return false;
  const voice = pickVoice(s.getVoices());
  s.cancel();
  chunks.forEach((chunk, i) => {
    const u = new Utter(chunk);
    u.lang = voice?.lang ?? "en-US";
    if (voice) u.voice = voice;
    u.rate = 1;
    if (i === chunks.length - 1) {
      // Only the last piece clears the state, and only if this reply is still the one being read.
      const finished = () => {
        if (speakingId === id) {
          stopWatch();
          speakingId = null;
          emit();
        }
      };
      u.onend = finished;
      u.onerror = finished;
    }
    s.speak(u);
  });
  speakingId = id;
  emit();
  watch(id, s);
  return true;
}

/** Stops any reading at once. */
export function stopSpeaking(): void {
  stopWatch();
  synth()?.cancel();
  if (speakingId !== null) {
    speakingId = null;
    emit();
  }
}

/** Whether replies are read aloud as they arrive. Off until the founder turns it on. */
export function readAloudOn(): boolean {
  if (readAloudFlag === null) {
    try {
      readAloudFlag = globalThis.localStorage?.getItem(ON_KEY) === "1";
    } catch {
      readAloudFlag = false;
    }
  }
  return readAloudFlag;
}

export function setReadAloud(on: boolean): void {
  readAloudFlag = on;
  try {
    globalThis.localStorage?.setItem(ON_KEY, on ? "1" : "0");
  } catch {
    /* not kept beyond this visit: the switch still works */
  }
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The speech state for a component: what is being read now, and whether replies are read aloud. */
export function useSpeech() {
  const speakingNow = useSyncExternalStore(subscribe, currentlySpeaking, () => null);
  const reading = useSyncExternalStore(subscribe, readAloudOn, () => false);
  return {
    supported: speechSupported(),
    speakingId: speakingNow,
    readAloud: reading,
    speak,
    stop: stopSpeaking,
    setReadAloud,
  };
}
