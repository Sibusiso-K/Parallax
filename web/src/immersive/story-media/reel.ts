import { formatRand } from '../../../../shared/guard/figures';
import type { RoomSnapshot } from '../../../../shared/scene/room-model';
import type { ReelPlan } from './reel-plan';

// A real reel: a vertical video drawn frame by frame in the browser and recorded with MediaRecorder. Nothing leaves the
// device. Every figure on it is an engine row from the frozen snapshot, and drawing depends only on the time, so the
// same snapshot gives the same frames. There is no sound: narration from the browser's speech voices cannot be recorded.

export const REEL_WIDTH = 720;
export const REEL_HEIGHT = 1280;
export const REEL_FPS = 30;
const OUTRO_SECONDS = 2.5;

export interface TimelineEntry {
  kind: 'context' | 'cash' | 'qualification' | 'outro';
  start: number;
  end: number;
  text: string;
}

/** When each part of the reel plays, from the plan. The closing card always carries the caveat. */
export function reelTimeline(plan: ReelPlan): TimelineEntry[] {
  let at = 0;
  const entries: TimelineEntry[] = plan.scenes.map((scene) => {
    const entry = { kind: scene.kind, start: at, end: at + scene.durationSeconds, text: scene.text };
    at = entry.end;
    return entry;
  });
  entries.push({ kind: 'outro', start: at, end: at + OUTRO_SECONDS, text: 'One possible future, not a prediction.' });
  return entries;
}

export const reelDuration = (plan: ReelPlan): number => reelTimeline(plan).at(-1)!.end;

export interface ReelScene {
  plan: ReelPlan;
  snapshot: RoomSnapshot;
  month: number;
  objectLabel: string;
  /** A render of the place in the courtyard. */
  still: CanvasImageSource | null;
}

/** While the line draws, the month it has reached; then it settles on the selected month. */
export function cashMonthAt(progress: number, selected: number, months: number): number {
  const drawing = Math.min(1, progress / 0.55);
  return progress < 0.55 ? Math.max(1, Math.ceil(drawing * months)) : selected;
}

const SERIF = "'Instrument Serif', Georgia, serif";
const SANS = "'Geist Variable', 'Geist', system-ui, sans-serif";
const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace";
const INK = '#1d1b22';
const MUTE = '#5f5b66';
const LAV = '#5943bd';
const IVORY = '#fbf9f4';

const ease = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function paragraph(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  let at = y;
  for (const line of wrap(ctx, text, maxWidth)) {
    ctx.fillText(line, x, at);
    at += lineHeight;
  }
  return at;
}

function drawContext(ctx: CanvasRenderingContext2D, scene: ReelScene, entry: TimelineEntry, t: number) {
  const p = (t - entry.start) / (entry.end - entry.start);
  ctx.fillStyle = '#2a2530';
  ctx.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT);
  if (scene.still) {
    const image = scene.still as HTMLImageElement;
    const iw = image.naturalWidth || image.width || REEL_WIDTH;
    const ih = image.naturalHeight || image.height || REEL_HEIGHT;
    const zoom = 1.04 + p * 0.1;
    const fit = Math.max(REEL_WIDTH / iw, REEL_HEIGHT / ih) * zoom;
    ctx.drawImage(scene.still, (REEL_WIDTH - iw * fit) / 2, (REEL_HEIGHT - ih * fit) / 2, iw * fit, ih * fit);
  }
  const shade = ctx.createLinearGradient(0, REEL_HEIGHT * 0.42, 0, REEL_HEIGHT);
  shade.addColorStop(0, 'rgba(20,16,30,0)');
  shade.addColorStop(1, 'rgba(20,16,30,0.86)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT);
  const rise = (1 - ease(p * 3)) * 40;
  ctx.globalAlpha = ease(p * 3);
  ctx.fillStyle = '#fff';
  ctx.font = `600 26px ${SANS}`;
  ctx.fillText('PARALLAX', 56, 1000 + rise);
  ctx.font = `72px ${SERIF}`;
  const bottom = paragraph(ctx, scene.objectLabel, 56, 1078 + rise, REEL_WIDTH - 112, 76);
  ctx.font = `28px ${SANS}`;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fillText(`${scene.snapshot.pathName} · month ${scene.month}`, 56, bottom + rise);
  ctx.globalAlpha = 1;
}

function drawChart(ctx: CanvasRenderingContext2D, snapshot: RoomSnapshot, upTo: number, selected: number | null, area: { x: number; y: number; w: number; h: number }) {
  const baseline = snapshot.baseline.rows;
  const active = snapshot.active.rows;
  const stressed = snapshot.ref.setback !== null;
  const values = [...baseline, ...active].map((r) => r.cash);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const px = (i: number) => area.x + (i / (active.length - 1)) * area.w;
  const py = (v: number) => area.y + area.h - ((v - min) / span) * area.h;
  // Zero, the line that matters.
  ctx.strokeStyle = 'rgba(29,27,34,0.28)';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(area.x, py(0));
  ctx.lineTo(area.x + area.w, py(0));
  ctx.stroke();
  const line = (rows: typeof active, color: string, width: number, dash: number[]) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    rows.slice(0, upTo).forEach((row, i) => (i === 0 ? ctx.moveTo(px(i), py(row.cash)) : ctx.lineTo(px(i), py(row.cash))));
    ctx.stroke();
    ctx.setLineDash([]);
  };
  if (stressed) line(baseline, '#8d8798', 3, [10, 9]);
  line(active, LAV, 6, []);
  ctx.fillStyle = MUTE;
  ctx.font = `22px ${SANS}`;
  ctx.fillText('Month 1', area.x, area.y + area.h + 40);
  const end = `Month ${active.length}`;
  ctx.fillText(end, area.x + area.w - ctx.measureText(end).width, area.y + area.h + 40);
  if (selected !== null) {
    const row = active[selected - 1]!;
    ctx.fillStyle = LAV;
    ctx.beginPath();
    ctx.arc(px(selected - 1), py(row.cash), 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4;
    ctx.stroke();
  }
}

function drawCash(ctx: CanvasRenderingContext2D, scene: ReelScene, entry: TimelineEntry, t: number) {
  const { snapshot, month } = scene;
  const p = (t - entry.start) / (entry.end - entry.start);
  const rows = snapshot.active.rows;
  const shown = cashMonthAt(p, month, rows.length);
  const settled = p >= 0.55;
  const stressed = snapshot.ref.setback !== null;
  ctx.fillStyle = IVORY;
  ctx.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT);
  ctx.fillStyle = MUTE;
  ctx.font = `26px ${SANS}`;
  ctx.fillText(`${snapshot.pathName}${stressed ? ' · with the late payment' : ''}`, 56, 150);
  ctx.fillStyle = INK;
  ctx.font = `60px ${SERIF}`;
  ctx.fillText(`Cash at month ${shown}`, 56, 228);
  const row = rows[shown - 1]!;
  ctx.fillStyle = row.cash < 0 ? '#a3302a' : INK;
  ctx.font = `600 104px ${MONO}`;
  ctx.fillText(formatRand(row.cash), 56, 348);
  drawChart(ctx, snapshot, settled ? rows.length : shown, settled ? month : null, { x: 56, y: 430, w: REEL_WIDTH - 112, h: 400 });
  if (settled) {
    ctx.globalAlpha = ease((p - 0.55) * 4);
    ctx.fillStyle = INK;
    ctx.font = `32px ${SANS}`;
    paragraph(ctx, entry.text, 56, 950, REEL_WIDTH - 112, 44);
    ctx.globalAlpha = 1;
  }
}

function drawCard(ctx: CanvasRenderingContext2D, lines: { font: string; color: string; text: string; lineHeight: number }[], background: string, alpha: number) {
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, REEL_WIDTH, REEL_HEIGHT);
  ctx.globalAlpha = alpha;
  let y = 480;
  for (const l of lines) {
    ctx.font = l.font;
    ctx.fillStyle = l.color;
    y = paragraph(ctx, l.text, 56, y, REEL_WIDTH - 112, l.lineHeight) + 28;
  }
  ctx.globalAlpha = 1;
}

/** Draws the frame at a moment. Same scene and time, same picture. */
export function drawReelFrame(ctx: CanvasRenderingContext2D, scene: ReelScene, t: number): void {
  const timeline = reelTimeline(scene.plan);
  const entry = timeline.find((e) => t < e.end) ?? timeline.at(-1)!;
  ctx.textBaseline = 'alphabetic';
  if (entry.kind === 'context') drawContext(ctx, scene, entry, t);
  else if (entry.kind === 'cash') drawCash(ctx, scene, entry, t);
  else {
    const alpha = ease((t - entry.start) * 2);
    if (entry.kind === 'qualification') {
      drawCard(ctx, [
        { font: `56px ${SERIF}`, color: '#fff', text: 'Before you read that as the end', lineHeight: 62 },
        { font: `34px ${SANS}`, color: 'rgba(255,255,255,0.9)', text: entry.text, lineHeight: 46 },
      ], '#33296f', alpha);
    } else {
      const stressed = scene.snapshot.ref.setback !== null;
      drawCard(ctx, [
        { font: `68px ${SERIF}`, color: INK, text: entry.text, lineHeight: 74 },
        { font: `28px ${SANS}`, color: MUTE, text: `${scene.snapshot.pathName}, ${stressed ? 'with the late payment' : 'as planned'}, revision ${scene.snapshot.ref.profileRevision}. Figures calculated by Parallax. Not financial advice. The setting is an illustrative 3D model.`, lineHeight: 40 },
      ], IVORY, alpha);
    }
  }
}

/** The best format this browser can record. MP4 plays everywhere; WebM is the fallback. */
export function reelFormat(isSupported: (mime: string) => boolean): { mime: string; extension: 'mp4' | 'webm' } | null {
  for (const mime of ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) {
    if (isSupported(mime)) return { mime, extension: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }
  return null;
}

export class ReelError extends Error {}

/** Records the reel in real time. Rejects with a plain message if it cannot, and nothing about the decision changes. */
export function recordReel(scene: ReelScene, options: { onProgress: (fraction: number) => void; signal: AbortSignal }): Promise<{ blob: Blob; extension: 'mp4' | 'webm'; seconds: number }> {
  return new Promise((resolve, reject) => {
    const format = typeof MediaRecorder === 'undefined' ? null : reelFormat((m) => MediaRecorder.isTypeSupported(m));
    const canvas = document.createElement('canvas');
    canvas.width = REEL_WIDTH;
    canvas.height = REEL_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!format || !ctx || typeof canvas.captureStream !== 'function') return reject(new ReelError('This browser cannot record video. The infographic still works.'));
    const seconds = reelDuration(scene.plan);
    drawReelFrame(ctx, scene, 0);
    const stream = canvas.captureStream(REEL_FPS);
    const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];
    let failure: ReelError | null = null;
    let timer = 0;
    const stop = (why: ReelError | null) => {
      if (recorder.state === 'inactive') return;
      failure = why;
      window.clearInterval(timer);
      recorder.stop();
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => stop(new ReelError('The recording stopped unexpectedly. Please try again.'));
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (failure) return reject(failure);
      const blob = new Blob(chunks, { type: format.mime.split(';')[0] });
      if (blob.size === 0) return reject(new ReelError('The recording came out empty. Please try again.'));
      resolve({ blob, extension: format.extension, seconds });
    };
    options.signal.addEventListener('abort', () => stop(new ReelError('Cancelled.')), { once: true });
    recorder.start();
    const started = performance.now();
    timer = window.setInterval(() => {
      // A hidden tab slows its timers to about one a second, which would ruin the video, so stop and say why.
      if (document.hidden) return stop(new ReelError('Keep this tab open while the reel records.'));
      const t = (performance.now() - started) / 1000;
      if (t >= seconds) return stop(null);
      drawReelFrame(ctx, scene, t);
      options.onProgress(t / seconds);
    }, 1000 / REEL_FPS);
  });
}
