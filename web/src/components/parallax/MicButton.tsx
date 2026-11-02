import { useVoiceInput, voiceSupported } from "@/lib/voice";
import { Button } from "./shared";

/** Speak instead of typing: tap to start, tap to stop (at most 60 seconds). The words land in the text box to be corrected. */
export function MicButton({ onText }: { onText: (text: string) => void }) {
  const { state, message, start, stop } = useVoiceInput(onText);
  if (!voiceSupported()) return null;
  const recording = state === "recording";
  return (
    <>
      <Button variant="outline" aria-pressed={recording} disabled={state === "working"} onClick={recording ? stop : start}>
        {state === "working" ? "Turning it into text…" : recording ? "Stop recording" : "Speak instead"}
      </Button>
      <p className="hint" role="status" aria-live="polite" style={{ flexBasis: "100%" }}>
        {recording ? "Listening. Speak as you would to a cofounder." : message}
      </p>
    </>
  );
}
