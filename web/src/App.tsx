import { useState } from 'react';

// F1 start and consent. Intake stays locked until the person confirms they are 18 or older.
export function App() {
  const [adult, setAdult] = useState(false);
  const [started, setStarted] = useState(false);

  return (
    <div className="app">
      <main className="start">
        <ParallaxMark />
        <h1>Parallax</h1>
        <p className="lede">Talk to each possible future before you choose one.</p>

        {started ? (
          <p role="status">Intake comes next.</p>
        ) : (
          <>
            <ul className="notice">
              <li>A reflection aid, not financial advice. You decide.</li>
              <li>What you type stays in this browser. You can delete it at any time.</li>
              <li>Your words are sent to Meta's model API, outside South Africa, to write replies.</li>
              <li>Every figure is computed in code from assumptions you can see and change.</li>
            </ul>
            <label className="check">
              <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />
              I am 18 or older
            </label>
            <button className="begin" disabled={!adult} onClick={() => setStarted(true)}>
              Begin
            </button>
          </>
        )}
      </main>
      <footer className="disclaimer">Not financial advice · One possible future, not a prediction</footer>
    </div>
  );
}

// Three offset layers: one per possible future (DESIGN.md §1).
function ParallaxMark() {
  return (
    <svg className="mark" viewBox="0 0 64 48" width="64" height="48" aria-hidden="true">
      <rect x="16" y="0" width="40" height="28" rx="6" fill="var(--path-c)" opacity="0.5" />
      <rect x="8" y="10" width="40" height="28" rx="6" fill="var(--path-b)" opacity="0.75" />
      <rect x="0" y="20" width="40" height="28" rx="6" fill="var(--path-a)" />
    </svg>
  );
}
