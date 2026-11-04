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

/** Align against unchanged face pixels around the patch, matching the demo bake search. */
export async function registeredPatch(restSrc: string, frameSrc: string, masks: SamMask[], width: number, height: number, blink: boolean, signal?: AbortSignal): Promise<{src:string;rect:WorldRect}> {
  const scale = width / 2048;
  const pad = Math.round((blink ? 7 : 14) * scale);
  const x = Math.max(0, Math.floor(Math.min(...masks.map(m => m.bounds.left)) - pad));
  const y = Math.max(0, Math.floor(Math.min(...masks.map(m => m.bounds.top)) - pad));
  const r = Math.min(width, Math.ceil(Math.max(...masks.map(m => m.bounds.right)) + pad));
  const b = Math.min(height, Math.ceil(Math.max(...masks.map(m => m.bounds.bottom)) + pad));
  if (r <= x || b <= y || (r-x)*(b-y) > width*height*.15) throw new Error('Face patch was not located reliably.');
  const rest = await loadImage(restSrc, signal), frame = await loadImage(frameSrc, signal);
  const canvas = document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx = canvas.getContext('2d', {willReadFrequently:true})!;
  try {
    ctx.drawImage(rest,0,0,width,height); const target = ctx.getImageData(0,0,width,height).data;
    ctx.clearRect(0,0,width,height); ctx.drawImage(frame,0,0,width,height); const candidate = ctx.getImageData(0,0,width,height).data;
    const left=Math.max(12,x-Math.round(40*scale)), top=Math.max(12,y-Math.round(55*scale));
    const right=Math.min(width-12,r+Math.round(40*scale)), bottom=Math.min(height-12,b+Math.round(30*scale));
    let best=Infinity, bestX=0, bestY=0;
    for(let dy=-12;dy<=12;dy+=2) for(let dx=-12;dx<=12;dx+=2) {
      if(x+dx<0 || y+dy<0 || r+dx>width || b+dy>height) continue;
      let error=0, count=0;
      for(let py=top;py<bottom;py++) for(let px=left;px<right;px++) {
        if(px>=x && px<r && py>=y && py<b) continue;
        const a=(py*width+px)*4, c=((py+dy)*width+px+dx)*4;
        for(let channel=0;channel<3;channel++) error+=Math.abs(target[a+channel]!-candidate[c+channel]!);
        count+=3;
      }
      if(count && error/count<best) {best=error/count;bestX=dx;bestY=dy;}
    }
    if(!Number.isFinite(best)) throw new Error('No unchanged pixels for registration.');
    const patch=document.createElement('canvas'); patch.width=r-x; patch.height=b-y;
    const pc=patch.getContext('2d')!;
    pc.drawImage(canvas,x+bestX,y+bestY,r-x,b-y,0,0,r-x,b-y);
    const pixels=pc.getImageData(0,0,patch.width,patch.height), feather=Math.max(2,Math.round(6*scale));
    for(let py=0;py<patch.height;py++) for(let px=0;px<patch.width;px++) {
      const edge=Math.min(px,py,patch.width-1-px,patch.height-1-py);
      const t=Math.min(1,edge/feather); pixels.data[(py*patch.width+px)*4+3]=Math.round(255*t*t*(3-2*t));
    }
    pc.putImageData(pixels,0,0);
    let src=patch.toDataURL('image/webp',.85);
    // Bound the stored patch, including base64 overhead. Geometry stays in plate coordinates.
    while(src.length>30_000 && patch.width>24 && patch.height>12) {
      const small=document.createElement('canvas'); small.width=Math.max(1,Math.floor(patch.width*.75)); small.height=Math.max(1,Math.floor(patch.height*.75));
      small.getContext('2d')!.drawImage(patch,0,0,small.width,small.height);
      patch.width=small.width;patch.height=small.height;pc.drawImage(small,0,0);
      small.width=small.height=0; src=patch.toDataURL('image/webp',.8);
    }
    patch.width=patch.height=0;
    if(src.length>30_000) throw new Error('Face patch exceeded its size budget.');
    return {src,rect:{x:x/width,y:y/height,width:(r-x)/width,height:(b-y)/height}};
  } finally {canvas.width=canvas.height=0;}
}
