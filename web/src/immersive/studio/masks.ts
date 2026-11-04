import { decodeMaskToRaster } from '../../../../shared/world/vendor/package/dist/index.js';
import type { SamMask } from '../../../../shared/providers/sam';
import type { WorldRect } from '../../../../shared/world/manifest';

export function maskRect(mask: SamMask, width: number, height: number): WorldRect {
  const b = mask.bounds;
  return { x: b.left / width, y: b.top / height, width: (b.right - b.left) / width, height: (b.bottom - b.top) / height };
}
/** Full-plate mask, not a stretched bounding-box crop. Keeps the provider's exact raster. */
export function maskDataUrl(mask: SamMask, width: number, height: number): string {
  if (mask.mask.width * mask.mask.height > 4096 * 4096) throw new Error('Mask too large.');
  const raster = decodeMaskToRaster(mask.mask);
  const patch = document.createElement('canvas');
  patch.width = mask.mask.width; patch.height = mask.mask.height;
  const pc = patch.getContext('2d')!;
  const data = pc.createImageData(patch.width, patch.height);
  for (let i = 0; i < raster.length; i++) { data.data[i * 4] = 255; data.data[i * 4 + 1] = 255; data.data[i * 4 + 2] = 255; data.data[i * 4 + 3] = raster[i] ? 255 : 0; }
  pc.putImageData(data, 0, 0);
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  canvas.getContext('2d')!.drawImage(patch, mask.bounds.left, mask.bounds.top, mask.bounds.right - mask.bounds.left, mask.bounds.bottom - mask.bounds.top);
  return canvas.toDataURL('image/png');
}

export function loadImage(src: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = window.setTimeout(() => { cleanup(); reject(new Error('Image did not load.')); }, 15_000);
    const abort = () => { cleanup(); image.src = ''; reject(new DOMException('Cancelled', 'AbortError')); };
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); image.onload = null; image.onerror = null; };
    image.onload = () => { cleanup(); resolve(image); };
    image.onerror = () => { cleanup(); reject(new Error('Image did not load.')); };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    image.src = src;
  });
}

export async function compactImage(src: string, signal?: AbortSignal): Promise<{ dataUrl: string; width: number; height: number }> {
  const image = await loadImage(src, signal);
  const scale = Math.min(1, 1600 / image.naturalWidth, 1200 / image.naturalHeight);
  const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * scale); canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/jpeg', .85), width: canvas.width, height: canvas.height };
}
