import type { RoomSnapshot } from '../../../../shared/scene/room-model';
import type { PhotoManifest } from '../../../../shared/world/manifest';
import { FILM_CAPTIONS, filmPlanSchema, type FilmPlan } from '../../../../shared/world/film-plan';
import type { SamMask } from '../../../../shared/providers/sam';
import { formatRand } from '../../../../shared/guard/figures';
import { recordedInFull } from '../story-media/reel';
import { callWorld, type WorldCall, type WorldProgress } from './live-world';
import { compactImage, loadImage, maskDataUrl } from './masks';
import workplace from './demo/shot-workplace.jpg';
import founder from './demo/shot-founder.jpg';
import offer from './demo/shot-offer.jpg';
import work from './demo/shot-work.jpg';
import pressure from './demo/shot-pressure.jpg';
import choice from './demo/shot-choice.jpg';
import workplaceMask from './demo/mask-workplace.png';
import founderMask from './demo/mask-founder.png';
import offerMask from './demo/mask-offer.png';
import workMask from './demo/mask-work.png';
import pressureMask from './demo/mask-pressure.png';
import choiceMask from './demo/mask-choice.png';
import workplaceBackground from './demo/background-workplace.jpg';
import founderBackground from './demo/background-founder.jpg';
import offerBackground from './demo/background-offer.jpg';
import workBackground from './demo/background-work.jpg';
import pressureBackground from './demo/background-pressure.jpg';
import choiceBackground from './demo/background-choice.jpg';

export interface FilmShot { focus: FilmPlan['shots'][number]['focus']; camera: FilmPlan['shots'][number]['camera']; src: string; background?: string; mask?: string; focal: [number, number]; zoom: number }
export interface Film { mode: 'baked' | 'generated'; shots: FilmShot[]; disclosure: string }
export const SHOT_SECONDS = 3;
export const FILM_WIDTH = 1280;
export const FILM_HEIGHT = 720;
export const demoFilm: Film = {
  mode: 'baked', disclosure: 'Baked demonstration shots. Illustrative imagery; fictional person. Figures use the selected engine snapshot.',
  shots: [
    { focus: 'workplace', camera: 'push', src: workplace, background: workplaceBackground, mask: workplaceMask, focal: [.5, .5], zoom: 1.05 },
    { focus: 'founder', camera: 'push', src: founder, background: founderBackground, mask: founderMask, focal: [.5, .4], zoom: 1.05 },
    { focus: 'offer', camera: 'drift-left', src: offer, background: offerBackground, mask: offerMask, focal: [.5, .5], zoom: 1.05 },
    { focus: 'work', camera: 'drift-right', src: work, background: workBackground, mask: workMask, focal: [.5, .5], zoom: 1.05 },
    { focus: 'pressure', camera: 'push', src: pressure, background: pressureBackground, mask: pressureMask, focal: [.5, .5], zoom: 1.05 },
    { focus: 'choice', camera: 'drift-left', src: choice, background: choiceBackground, mask: choiceMask, focal: [.5, .4], zoom: 1.05 },
  ],
};
export function filmMoment(seconds: number, shots: number, months: number) {
  if (!Number.isFinite(seconds) || shots < 1 || months < 1) throw new Error('Invalid film timeline.');
  const index = Math.min(shots - 1, Math.max(0, Math.floor(seconds / SHOT_SECONDS)));
  const progress = Math.max(0, Math.min(1, (seconds - index * SHOT_SECONDS) / SHOT_SECONDS));
  return { index, progress, month: Math.min(months, Math.max(1, Math.round(1 + index / Math.max(1, shots - 1) * (months - 1)))) };
}
export async function generateFilm(story: string, world: PhotoManifest, path: 'A' | 'B' | 'C', options: { signal: AbortSignal; onProgress: (event: WorldProgress) => void; call?: WorldCall }): Promise<Film> {
  const call = options.call ?? callWorld;
  const run = async (step: string, body: unknown, model: string) => {
    options.signal.throwIfAborted(); options.onProgress({ agent: 'World Builder', step, state: 'running', model });
    const result = await call(body, options.signal); options.signal.throwIfAborted();
    if (result.mode !== 'model') throw new Error('Film generation is not connected.');
    options.onProgress({ agent: 'World Builder', step, state: 'complete', model }); return result;
  };
  const plan = filmPlanSchema.parse((await run('Directing your film', { action: 'direct', story }, 'muse-spark-1.3')).plan);
  const plate = await compactImage(world.plate, options.signal); const person = await compactImage(world.people[path].src, options.signal);
  const shots: FilmShot[] = [];
  for (const shot of plan.shots) {
    const drawn = await run(`Photographing ${shot.focus}`, { action: 'edit', references: [plate.dataUrl, person.dataUrl], prompt: shot.prompt }, 'muse-image-1.0');
    if (typeof drawn.dataUrl !== 'string') throw new Error('Shot image was missing.');
    const image = await compactImage(drawn.dataUrl, options.signal);
    const result = await run(`Separating ${shot.focus}`, { action: 'segment', image: image.dataUrl, width: image.width, height: image.height, concept: 'person' }, 'sam-3.1');
    const mask = (result.masks as SamMask[])?.[0];
    let background: string | undefined;
    if (mask) {
      const clean = await run(`Preparing depth for ${shot.focus}`, { action: 'edit', references: [image.dataUrl], prompt: 'Remove the person completely. Reconstruct the empty workplace behind them. Keep the camera, room, objects, lighting and composition exactly fixed.' }, 'muse-image-1.0');
      if (typeof clean.dataUrl !== 'string') throw new Error('Background image was missing.');
      background = (await compactImage(clean.dataUrl, options.signal)).dataUrl;
    }
    shots.push({ focus: shot.focus, camera: shot.camera, src: image.dataUrl, background, mask: mask ? maskDataUrl(mask, image.width, image.height) : undefined, focal: [.5, .5], zoom: 1.05 });
  }
  return { mode: 'generated', shots, disclosure: 'Generated illustrative film. Fictional person. Figures calculated from your selected engine snapshot.' };
}

export interface LoadedShot { image: HTMLImageElement; subject: HTMLCanvasElement | null }
export async function loadFilm(film: Film, signal: AbortSignal): Promise<LoadedShot[]> {
  const loaded: LoadedShot[] = [];
  const images = new Map<string, HTMLImageElement>();
  for (const shot of film.shots) {
    const image = images.get(shot.src) ?? await loadImage(shot.src, signal); images.set(shot.src, image);
    let subject: HTMLCanvasElement | null = null;
    if (shot.mask) {
      const mask = await loadImage(shot.mask, signal);
      subject = document.createElement('canvas'); subject.width = image.naturalWidth; subject.height = image.naturalHeight;
      const ctx = subject.getContext('2d')!; ctx.drawImage(image, 0, 0); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(mask, 0, 0, subject.width, subject.height); ctx.globalCompositeOperation = 'source-over';
    }
    loaded.push({ image: shot.background ? await loadImage(shot.background, signal) : image, subject });
  }
  return loaded;
}

/** Same immutable snapshot and time give the same visuals. Models never supply the overlaid figures. */
export function drawFilmFrame(ctx: CanvasRenderingContext2D, film: Film, loaded: LoadedShot[], snapshot: RoomSnapshot, seconds: number, reducedMotion = false): void {
  const moment = filmMoment(seconds, film.shots.length, snapshot.active.rows.length);
  const shot = film.shots[moment.index]!; const asset = loaded[moment.index]!; const row = snapshot.active.rows[moment.month - 1]!;
  const p = reducedMotion ? .5 : moment.progress;
  const scale = Math.max(FILM_WIDTH / asset.image.naturalWidth, FILM_HEIGHT / asset.image.naturalHeight) * (shot.zoom + p * .055);
  const w = asset.image.naturalWidth * scale; const h = asset.image.naturalHeight * scale;
  const drift = shot.camera === 'push' ? 0 : (p - .5) * (shot.camera === 'drift-left' ? -28 : 28);
  const x = Math.min(0, Math.max(FILM_WIDTH - w, FILM_WIDTH / 2 - w * shot.focal[0] + drift));
  const y = Math.min(0, Math.max(FILM_HEIGHT - h, FILM_HEIGHT / 2 - h * shot.focal[1]));
  ctx.clearRect(0, 0, FILM_WIDTH, FILM_HEIGHT); ctx.drawImage(asset.image, x, y, w, h);
  if (asset.subject) { ctx.save(); ctx.translate(FILM_WIDTH / 2, FILM_HEIGHT / 2); const depth = 1 + (reducedMotion ? 0 : .006 * p); ctx.scale(depth, depth); ctx.translate(-FILM_WIDTH / 2 + drift * .08, -FILM_HEIGHT / 2); ctx.drawImage(asset.subject, x, y, w, h); ctx.restore(); }
  const shade = ctx.createLinearGradient(0, FILM_HEIGHT * .35, 0, FILM_HEIGHT); shade.addColorStop(0, '#20182300'); shade.addColorStop(1, '#201823e8'); ctx.fillStyle = shade; ctx.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT);
  ctx.fillStyle = '#fffaf3'; ctx.font = "48px 'Instrument Serif', Georgia, serif"; ctx.fillText(FILM_CAPTIONS[shot.focus], 48, 540, 1120);
  ctx.font = "20px 'Geist Variable', sans-serif"; ctx.fillText(`Path ${snapshot.ref.pathId} · month ${row.month} · ${snapshot.ref.setback ? 'with setback' : 'as planned'}`, 50, 585);
  ctx.font = "32px 'Geist Variable', sans-serif"; ctx.fillText(`Cash ${formatRand(row.cash)}`, 50, 632);
  ctx.font = "16px 'Geist Variable', sans-serif"; ctx.fillText('One possible future, not a prediction. Illustrative imagery. Fictional person.', 50, 680);
  if (snapshot.active.firstShortfall !== null) { ctx.textAlign = 'right'; ctx.fillStyle = '#ffe6c8'; ctx.fillText(`Cash first below zero: month ${snapshot.active.firstShortfall}`, 1230, 632); ctx.textAlign = 'left'; }
  // A brief photographic fade masks hard cuts while preserving the end caveat.
  if (!reducedMotion && moment.index > 0 && p < .08) { ctx.fillStyle = `rgba(250,248,242,${(1 - p / .08) * .4})`; ctx.fillRect(0, 0, FILM_WIDTH, FILM_HEIGHT); }
}

export const chordForCash = (cash: number): readonly number[] => cash < 0 ? [220, 261.63, 329.63] : [220, 277.18, 329.63];
export function filmFormat(supported: (mime: string) => boolean): { mime: string; extension: 'mp4' | 'webm' } | null {
  for (const mime of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (supported(mime)) return { mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}

/** Check the encoded container, not wall time. Infinity-duration WebM gets a metadata seek. */
export function measuredDuration(blob: Blob, signal: AbortSignal): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video'); const url = URL.createObjectURL(blob);
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); video.onerror = null; video.onloadedmetadata = null; video.ondurationchange = null; video.ontimeupdate = null; video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };
    const fail = () => { cleanup(); reject(new Error('Could not verify the film length. Recording was not offered for download.')); };
    const abort = () => { cleanup(); reject(new DOMException('Cancelled', 'AbortError')); };
    const finish = () => { if (Number.isFinite(video.duration) && video.duration > 0) { const duration = video.duration; cleanup(); resolve(duration); } };
    const timer = window.setTimeout(fail, 12_000);
    video.preload = 'metadata'; video.muted = true; video.onerror = fail;
    video.onloadedmetadata = () => { if (!Number.isFinite(video.duration)) video.currentTime = 1e10; else finish(); };
    video.ondurationchange = finish; video.ontimeupdate = finish;
    if (signal.aborted) return abort(); signal.addEventListener('abort', abort, { once: true }); video.src = url;
  });
}

/** Real-time canvas video with a WebAudio score captured into the same stream. */
export async function recordFilm(film: Film, snapshot: RoomSnapshot, options: { signal: AbortSignal; onProgress: (fraction: number) => void }): Promise<{ blob: Blob; extension: 'mp4' | 'webm'; seconds: number }> {
  const { signal } = options; signal.throwIfAborted();
  const format = typeof MediaRecorder !== 'undefined' ? filmFormat(m => MediaRecorder.isTypeSupported(m)) : null;
  if (!format || typeof AudioContext === 'undefined') throw new Error('This browser cannot record a scored film.');
  // Created and resumed synchronously from the click before awaiting image loads.
  const audio = new AudioContext(); const resumed = audio.resume();
  let stream: MediaStream | null = null; const oscillators: OscillatorNode[] = [];
  try {
    await resumed; if (audio.state !== 'running') throw new Error('Audio could not start. Try recording again.');
    const loaded = await loadFilm(film, signal); await document.fonts.ready; signal.throwIfAborted();
    const canvas = document.createElement('canvas'); canvas.width = FILM_WIDTH; canvas.height = FILM_HEIGHT;
    const ctx = canvas.getContext('2d'); if (!ctx || !canvas.captureStream) throw new Error('Canvas recording is unavailable.');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    drawFilmFrame(ctx, film, loaded, snapshot, 0, reduced);
    stream = canvas.captureStream(30); const destination = audio.createMediaStreamDestination();
    const gain = audio.createGain(); gain.gain.value = .025; gain.connect(destination); gain.connect(audio.destination);
    for (const frequency of chordForCash(snapshot.active.rows[0]!.cash)) { const oscillator = audio.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.connect(gain); oscillator.start(); oscillators.push(oscillator); }
    destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
    const total = film.shots.length * SHOT_SECONDS;
    const recordingStream = stream;
    const blob = await new Promise<Blob>((resolve, reject) => {
      const recorder = new MediaRecorder(recordingStream, { mimeType: format.mime, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 96_000 });
      const chunks: Blob[] = []; let failure: Error | null = null; let interval = 0;
      const cleanup = () => { window.clearInterval(interval); signal.removeEventListener('abort', abort); };
      const stop = (error?: Error) => { if (recorder.state === 'inactive') return; failure = error ?? null; cleanup(); recorder.stop(); };
      const abort = () => stop(new DOMException('Cancelled', 'AbortError'));
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => stop(new Error('Recording stopped unexpectedly.'));
      recorder.onstop = () => { cleanup(); if (failure) reject(failure); else resolve(new Blob(chunks, { type: format.mime.split(';')[0] })); };
      signal.addEventListener('abort', abort, { once: true });
      try { recorder.start(1000); } catch { cleanup(); reject(new Error('This browser could not start recording with audio.')); return; }
      const start = performance.now();
      interval = window.setInterval(() => {
        if (document.hidden) return stop(new Error('Keep this tab visible while recording.'));
        const t = (performance.now() - start) / 1000;
        try {
          if (t >= total) { drawFilmFrame(ctx, film, loaded, snapshot, total - .01, reduced); stop(); return; }
          drawFilmFrame(ctx, film, loaded, snapshot, t, reduced);
          const moment = filmMoment(t, film.shots.length, snapshot.active.rows.length); const chord = chordForCash(snapshot.active.rows[moment.month - 1]!.cash);
          oscillators.forEach((oscillator, i) => oscillator.frequency.setTargetAtTime(chord[i]!, audio.currentTime, .25));
          gain.gain.setTargetAtTime(t > total - 1 ? .001 : .025, audio.currentTime, .2);
          options.onProgress(t / total);
        } catch { stop(new Error('A film frame could not be rendered.')); }
      }, 1000 / 30);
    });
    if (!blob.size) throw new Error('The recording was empty.');
    // Stop camera/audio tracks before inspecting the encoded file.
    stream.getTracks().forEach(track => track.stop()); oscillators.forEach(oscillator => oscillator.stop()); oscillators.length = 0; await audio.close();
    const seconds = await measuredDuration(blob, signal);
    if (!recordedInFull(seconds, total)) throw new Error('The recording lost part of the film. Please try again.');
    options.onProgress(1); return { blob, extension: format.extension, seconds };
  } finally { stream?.getTracks().forEach(track => track.stop()); oscillators.forEach(oscillator => oscillator.stop()); if (audio.state !== 'closed') await audio.close(); }
}
