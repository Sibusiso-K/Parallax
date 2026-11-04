import { afterEach, describe, expect, it, vi } from "vitest";
import { currentlySpeaking, pickVoice, setReadAloud, speak, speechChunks, spokenText, stopSpeaking } from "./speech";

// Read aloud turns the app's words into speech on the founder's device. These tests use a stub speech engine and
// check what it is asked to say, in which voice, and when the state clears.

describe("spokenText", () => {
  it("reads amounts as rand, with thousands and millions spelled out", () => {
    expect(spokenText("We sell about R95 000 a month.")).toBe("We sell about 95 000 rand a month.");
    expect(spokenText("A R200k reserve and R3.5m in loans.")).toBe("A 200 thousand rand reserve and 3.5 million rand in loans.");
  });

  it("reads a negative amount as minus, and drops citation tags and placeholders", () => {
    expect(spokenText("We dipped to −R5 000 in March [A3].")).toBe("We dipped to minus 5 000 rand in March.");
    expect(spokenText("**Cash** is tight (see chart) {{fig:A.x}}.")).toBe("Cash is tight.");
  });

  it("reads percentages and long dashes naturally", () => {
    expect(spokenText("Costs rise 30% — or more.")).toBe("Costs rise 30 percent, or more.");
  });
});

describe("speechChunks", () => {
  it("splits on sentence ends, and keeps every piece short", () => {
    expect(speechChunks("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
    const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i} is a fairly long line of plain words, and it goes on`).join(" ");
    const pieces = speechChunks(long);
    expect(pieces.length).toBeGreaterThan(1);
    for (const p of pieces) expect(p.length).toBeLessThanOrEqual(200);
    expect(pieces.join(" ").replace(/\s+/g, " ")).toBe(long.replace(/\s+/g, " "));
  });
});

describe("pickVoice", () => {
  const v = (lang: string) => ({ lang, name: lang });

  it("prefers South African English, then British, then American, then any English", () => {
    expect(pickVoice([v("en-US"), v("en-ZA"), v("en-GB")])?.lang).toBe("en-ZA");
    expect(pickVoice([v("en-US"), v("en_GB")])?.lang).toBe("en_GB");
    expect(pickVoice([v("fr-FR"), v("en-IN")])?.lang).toBe("en-IN");
    expect(pickVoice([v("fr-FR")])).toBeUndefined();
  });
});

class FakeUtterance {
  text: string;
  lang = "";
  voice: unknown = null;
  rate = 1;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

function fakeSynth(voices: { lang: string; name: string }[] = []) {
  const queue: FakeUtterance[] = [];
  let cancelled = 0;
  return {
    queue,
    get cancelled() {
      return cancelled;
    },
    speak: (u: FakeUtterance) => {
      queue.push(u);
    },
    cancel: () => {
      cancelled += 1;
    },
    getVoices: () => voices,
  };
}

describe("speak", () => {
  afterEach(() => {
    stopSpeaking();
    vi.unstubAllGlobals();
  });

  it("does nothing, and says so, where the browser has no speech", () => {
    vi.stubGlobal("speechSynthesis", undefined);
    expect(speak("m1", "Hello there.")).toBe(false);
    expect(currentlySpeaking()).toBeNull();
  });

  it("reads each piece in turn, in the best voice, and clears when the last piece ends", () => {
    const synth = fakeSynth([
      { lang: "en-GB", name: "Daniel" },
      { lang: "en-ZA", name: "Leah" },
    ]);
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    expect(speak("m1", "We sell R95 000 a month. Cash is tight.")).toBe(true);
    expect(synth.queue.map((u) => u.text)).toEqual(["We sell 95 000 rand a month.", "Cash is tight."]);
    expect(synth.queue[0]!.lang).toBe("en-ZA");
    expect((synth.queue[0]!.voice as { name: string }).name).toBe("Leah");
    expect(currentlySpeaking()).toBe("m1");
    synth.queue[1]!.onend?.();
    expect(currentlySpeaking()).toBeNull();
  });

  it("a new reply replaces the one being read, and a late end from the old one does not clear it", () => {
    const synth = fakeSynth();
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    speak("m1", "First reply.");
    speak("m2", "Second reply.");
    expect(synth.cancelled).toBe(2);
    expect(currentlySpeaking()).toBe("m2");
    synth.queue[0]!.onend?.();
    expect(currentlySpeaking()).toBe("m2");
  });

  it("stops at once when asked", () => {
    const synth = fakeSynth();
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    speak("m1", "Keep talking.");
    stopSpeaking();
    expect(currentlySpeaking()).toBeNull();
    expect(synth.cancelled).toBeGreaterThan(0);
  });
});

describe("speak, when the engine never reports the end", () => {
  afterEach(() => {
    stopSpeaking();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("clears the state once the engine has spoken and then gone quiet", () => {
    vi.useFakeTimers();
    const synth = fakeSynth();
    let speaking = false;
    Object.defineProperty(synth, "speaking", { get: () => speaking });
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    speak("m1", "Hello there.");
    speaking = true;
    vi.advanceTimersByTime(1000);
    expect(currentlySpeaking()).toBe("m1");
    speaking = false;
    vi.advanceTimersByTime(1500);
    expect(currentlySpeaking()).toBeNull();
  });

  it("gives up on an engine that never starts, after about ten seconds", () => {
    vi.useFakeTimers();
    vi.stubGlobal("speechSynthesis", fakeSynth());
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    speak("m1", "Hello there.");
    vi.advanceTimersByTime(9000);
    expect(currentlySpeaking()).toBe("m1");
    vi.advanceTimersByTime(2000);
    expect(currentlySpeaking()).toBeNull();
  });
});

describe("read replies aloud", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("is off until the founder turns it on, and the choice is kept on this device", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    vi.resetModules();
    const first = await import("./speech");
    expect(first.readAloudOn()).toBe(false);
    first.setReadAloud(true);
    expect(store.get("parallax.readAloud")).toBe("1");
    vi.resetModules();
    const later = await import("./speech");
    expect(later.readAloudOn()).toBe(true);
    setReadAloud(false);
  });
});
