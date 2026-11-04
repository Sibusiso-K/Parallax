import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '../../../../shared/scene/room-model';
import { createCashInfographic, svgToPng } from './infographic';
import { ReelError, recordReel, reelDuration, type ReelScene } from './reel';
import { buildReelPlan, type StoryObject } from './reel-plan';

// Create: what a founder can take away from one month of one path. Made only when they press a button, in this browser,
// from the frozen snapshot on screen. Later edits do not rewrite what was made; it is marked as from an earlier revision.

export interface MediaOutput {
  id: string;
  kind: 'Reel' | 'Infographic';
  name: string;
  url: string;
  bytes: number;
  revision: number;
  pathName: string;
  month: number;
  stressed: boolean;
  objectLabel: string;
  seconds?: number;
}

const loadStill = (src: string): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });

const sizeText = (bytes: number) => (bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`);

export function MediaStudio({ snapshot, month, objectId, objectLabel, stillUrl, outputs, onOutput, revision, disabled }: {
  snapshot: RoomSnapshot;
  month: number;
  objectId: StoryObject;
  objectLabel: string;
  stillUrl: string;
  outputs: MediaOutput[];
  onOutput: (output: MediaOutput) => void;
  revision: number;
  disabled: boolean;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [problem, setProblem] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const plan = buildReelPlan(snapshot, month, objectId, objectLabel);
  const stem = `parallax-path-${snapshot.ref.pathId}-month-${month}`;
  const stressed = snapshot.ref.setback !== null;
  const provenance = { revision: snapshot.ref.profileRevision, pathName: snapshot.pathName, month, stressed, objectLabel };

  const makeReel = async () => {
    setProblem('');
    setProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await document.fonts?.ready;
      const still = await loadStill(stillUrl);
      const scene: ReelScene = { plan, snapshot, month, objectLabel, still };
      const { blob, extension, seconds } = await recordReel(scene, { onProgress: setProgress, signal: controller.signal });
      onOutput({ id: crypto.randomUUID(), kind: 'Reel', name: `${stem}-reel.${extension}`, url: URL.createObjectURL(blob), bytes: blob.size, seconds, ...provenance });
    } catch (err) {
      if (!controller.signal.aborted) setProblem(err instanceof ReelError ? err.message : 'The reel could not be made. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  const makeInfographic = async (format: 'svg' | 'png') => {
    setProblem('');
    try {
      const svg = createCashInfographic(snapshot, month);
      const blob = format === 'svg' ? new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }) : await svgToPng(svg);
      onOutput({ id: crypto.randomUUID(), kind: 'Infographic', name: `${stem}.${format}`, url: URL.createObjectURL(blob), bytes: blob.size, ...provenance });
    } catch {
      setProblem('The image could not be made. Please try again.');
    }
  };

  const busy = progress !== null;
  return (
    <div className="studio">
      <div className="studio__make">
        <button className="btn" type="button" disabled={disabled || busy} onClick={() => void makeReel()}>Make a {Math.round(reelDuration(plan))}-second reel</button>
        <button className="btn btn--ghost" type="button" disabled={disabled || busy} onClick={() => void makeInfographic('png')}>Image (PNG)</button>
        <button className="btn btn--ghost" type="button" disabled={disabled || busy} onClick={() => void makeInfographic('svg')}>Image (SVG)</button>
      </div>
      <p className="muted small">
        Path {snapshot.ref.pathId}, month {month}, {stressed ? 'with the late payment' : 'as planned'}. Made in this browser from the figures on screen; nothing is uploaded. The reel is silent, with its words on screen.
      </p>
      {busy && (
        <div className="studio__progress" role="status">
          <progress value={progress ?? 0} max={1} aria-label="Reel progress" />
          <span>Recording in real time. Keep this tab open.</span>
          <button className="btn btn--ghost btn--sm" type="button" onClick={() => abort.current?.abort()}>Cancel</button>
        </div>
      )}
      {problem && <p className="caution" role="alert">{problem}</p>}
      {outputs.length > 0 && (
        <ul className="studio__library" aria-label="What you have made">
          {[...outputs].reverse().map((o) => (
            <li key={o.id}>
              {o.kind === 'Reel' ? <video src={o.url} controls playsInline muted preload="metadata" /> : <img src={o.url} alt={`Cash snapshot for ${o.pathName}, month ${o.month}`} />}
              <div>
                <b>{o.kind}</b> · {o.objectLabel}
                <div className="muted small">
                  {o.pathName}, month {o.month}, {o.stressed ? 'late payment' : 'as planned'} · {sizeText(o.bytes)}{o.seconds ? ` · ${Math.round(o.seconds)} s` : ''}
                </div>
                {o.revision !== revision && <div className="chip">From an earlier revision: the inputs have changed since</div>}
                <a className="btn btn--ghost btn--sm" href={o.url} download={o.name}>Download</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
