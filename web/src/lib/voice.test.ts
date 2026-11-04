import { describe, expect, it } from "vitest";
import { readTranscribeReply } from "./voice";

// Every shape /api/transcribe, a proxy or a broken deploy can answer must leave the founder with a plain message and
// never throw: the typed text stays in the box and the voice hook has something to show.

describe("readTranscribeReply", () => {
  it("passes a transcript through with its own instruction", () => {
    expect(readTranscribeReply({ ok: true, mode: "model", transcript: "Should I take the contract?" })).toEqual({
      transcript: "Should I take the contract?",
      message: "Check the words below, fix anything wrong, then continue.",
    });
  });

  it("keeps a notice the server sends, and does not overwrite the transcript", () => {
    expect(readTranscribeReply({ ok: true, transcript: "Take the contract", notice: "That was long, so the end was cut off." })).toEqual({
      transcript: "Take the contract",
      message: "That was long, so the end was cut off.",
    });
  });

  it("says nothing was heard when the transcript is empty, and shows the notice", () => {
    expect(readTranscribeReply({ ok: true, transcript: "", notice: "We didn't hear anything. Try again, or type instead." })).toEqual({
      message: "We didn't hear anything. Try again, or type instead.",
    });
    expect(readTranscribeReply({ ok: true, transcript: "" })).toEqual({ message: "" });
  });

  it("shows the server's error for every refusal shape", () => {
    for (const error of ["That recording is too long. Keep it under 60 seconds.", "We couldn't turn that into text. Please try again, or type instead."]) {
      expect(readTranscribeReply({ ok: false, error })).toEqual({ message: error });
    }
  });

  it("falls back to a plain message when the error is missing or not text", () => {
    const fallback = "We couldn't turn that into text. Please type instead.";
    expect(readTranscribeReply({ ok: false })).toEqual({ message: fallback });
    expect(readTranscribeReply({ ok: false, error: 42 })).toEqual({ message: fallback });
    expect(readTranscribeReply({ ok: false, error: "   " })).toEqual({ message: fallback });
  });

  it("never throws on a reply that is not the expected object", () => {
    const fallback = "We couldn't turn that into text. Please type instead.";
    for (const data of [null, undefined, [], ["ok"], "hello", 42, true, { ok: "true", transcript: "x" }, { transcript: 42 }]) {
      expect(() => readTranscribeReply(data), String(data)).not.toThrow();
      expect(readTranscribeReply(data).message.length).toBeGreaterThan(0);
    }
    expect(readTranscribeReply(null)).toEqual({ message: fallback });
    expect(readTranscribeReply({ transcript: 42 })).toEqual({ message: fallback });
  });

  it("ignores a non-text transcript and a non-text notice", () => {
    expect(readTranscribeReply({ ok: true, transcript: 42, notice: 7 })).toEqual({ message: "" });
  });
});
