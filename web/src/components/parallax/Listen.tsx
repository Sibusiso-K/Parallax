import { spokenText, useSpeech } from "@/lib/speech";
import { cx } from "./shared";

/** A "Listen" button: reads the text aloud in the browser's voice, and offers "Stop" while it is being read. */
export function Listen({ id, text, label = "Listen" }: { id: string; text: string; label?: string }) {
  const speech = useSpeech();
  if (!speech.supported || !spokenText(text)) return null;
  const on = speech.speakingId === id;
  return (
    <button
      type="button"
      className={cx("listen", on && "on")}
      aria-pressed={on}
      aria-label={on ? "Stop reading aloud" : `${label} aloud`}
      onClick={() => (on ? speech.stop() : speech.speak(id, text))}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 8h3l4-3.5v11L6 12H3z" />
        <path d="M13 7.5a3.5 3.5 0 0 1 0 5" />
        <path d="M15.5 5a6.8 6.8 0 0 1 0 10" />
      </svg>
      {on ? "Stop" : label}
    </button>
  );
}
