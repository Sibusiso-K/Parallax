import { useEffect, useRef, useState } from 'react';
import type { RoomSnapshot } from '../../../../shared/scene/room-model';
import type { PhotoManifest } from '../../../../shared/world/manifest';
import { FILM_CAPTIONS } from '../../../../shared/world/film-plan';
import { demoFilm, drawFilmFrame, generateFilm, loadFilm, recordFilm, FILM_WIDTH, FILM_HEIGHT, SHOT_SECONDS, type Film, type LoadedShot } from './film';
import type { WorldProgress } from './live-world';
import './studio.css';

export interface FilmStudioProps { snapshot: RoomSnapshot; story: string; world?: PhotoManifest | null; onProgress?: (event: WorldProgress) => void }
export function FilmStudio({ snapshot, story, world, onProgress }: FilmStudioProps) {
  const [film, setFilm] = useState<Film>(demoFilm); const [selected, setSelected] = useState(0); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''); const [progress, setProgress] = useState(0); const [download, setDownload] = useState<{ url: string; extension: string; key: string } | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null); const loaded = useRef<LoadedShot[]>([]); const controller = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => { return () => { if (download) URL.revokeObjectURL(download.url); }; }, [download]);
  useEffect(() => {
    const current = new AbortController(); setReady(false);
    void loadFilm(film, current.signal).then(assets => { if (!current.signal.aborted) { loaded.current = assets; setReady(true); } }).catch(() => { if (!current.signal.aborted) setMessage('The film images could not be loaded.'); });
    return () => current.abort();
  }, [film]);
  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (context && ready) drawFilmFrame(context, film, loaded.current, snapshot, selected * SHOT_SECONDS + .8, true);
  }, [film, ready, selected, snapshot]);
  useEffect(() => {
    if (!playing || !ready) return;
    let frame = 0; const start = performance.now(); const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = () => {
      const seconds = (performance.now() - start) / 1000;
      if (document.hidden || seconds >= film.shots.length * SHOT_SECONDS) { setPlaying(false); return; }
      const context = canvas.current?.getContext('2d');
      if (context) drawFilmFrame(context, film, loaded.current, snapshot, seconds, reduced);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [playing, ready, film, snapshot]);
  const generate = async () => {
    if (!world) return;
    const current = new AbortController(); controller.current = current; setBusy(true); setPlaying(false); setDownload(null); setProgress(0);
    try {
      const result = await generateFilm(story, world, snapshot.ref.pathId, { signal: current.signal, onProgress: event => { setMessage(event.step); onProgress?.(event); } });
      if (!current.signal.aborted) { setFilm(result); setSelected(0); setMessage('Your photographic shots are ready. Preview them, then record.'); }
    } catch { if (!current.signal.aborted) setMessage('Generation was unavailable. Your existing shots are still available and remain labelled.'); }
    finally { if (controller.current === current) setBusy(false); }
  };
  const record = async () => {
    const current = new AbortController(); controller.current = current; setBusy(true); setPlaying(false); setDownload(null); setProgress(0);
    // Snapshot is frozen for this recording even if the parent switches path while it runs.
    const captured = snapshot; setMessage('Recording your film with its score. Keep this tab visible.');
    try {
      const result = await recordFilm(film, captured, { signal: current.signal, onProgress: setProgress });
      if (!current.signal.aborted) { setDownload({ url: URL.createObjectURL(result.blob), extension: result.extension, key: captured.key }); setMessage(`Film ready. Encoded length checked: ${result.seconds.toFixed(1)} seconds. ${result.extension === 'webm' ? 'This browser records WebM rather than MP4.' : 'MP4 with a recorded score.'}`); }
    } catch (error) { if (!current.signal.aborted) setMessage(error instanceof Error ? error.message : 'Recording failed.'); }
    finally { if (controller.current === current) setBusy(false); }
  };
  return <section className="px-studio" aria-label="Your future, the film">
    <h2>Your future, the film.</h2>
    <p>The space. The offer. The person living with the choice. A photographic film with figures from the path you are exploring.</p>
    <canvas ref={canvas} width={FILM_WIDTH} height={FILM_HEIGHT} className="px-film-preview" role="img" aria-label={`${FILM_CAPTIONS[film.shots[selected]!.focus]} Engine figures for path ${snapshot.ref.pathId}.`} />
    <div className="px-filmstrip" aria-label="Film shots">{film.shots.map((shot, index) => <button key={index} aria-pressed={selected === index} disabled={busy} onClick={() => { setPlaying(false); setSelected(index); }}><img src={shot.src} alt="" /><span>{FILM_CAPTIONS[shot.focus]}</span></button>)}</div>
    <p className="px-disclosure">{film.disclosure}</p>
    <div className="px-actions"><button disabled={busy || !ready} onClick={() => void record()}>Record with score</button>
      <button className="secondary" disabled={busy || !ready} onClick={() => setPlaying(value => !value)}>{playing ? 'Pause preview' : 'Play preview'}</button>
      {world && <button className="secondary" disabled={busy} onClick={() => void generate()}>Generate my shots</button>}
      {busy && <button className="secondary" onClick={() => { controller.current?.abort(); setBusy(false); setMessage('Cancelled.'); }}>Cancel</button>}
      {download && <a className="px-download" href={download.url} download={`parallax-future.${download.extension}`}>Download {download.extension.toUpperCase()}</a>}</div>
    {busy && <progress aria-label="Recording progress" value={progress || undefined} max={1} />}
    <p role="status" aria-live="polite">{message}</p>
    {download && download.key !== snapshot.key && <p className="px-disclosure">This download uses the earlier snapshot you recorded. Record again to include your latest changes.</p>}
    <p className="px-disclosure">The score shifts to a minor chord when the engine’s cash is below zero. No speech is included. Generated shots send your story and illustrative reference images to Meta. Recording stays on this device. One possible future, not a prediction.</p>
  </section>;
}
