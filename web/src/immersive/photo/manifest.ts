import { photoManifestSchema as sharedSchema, type PhotoManifest as SharedManifest, type WorldRect } from '../../../../shared/world/manifest';

export type PhotoRect = [number,number,number,number];
const tuple = (r: WorldRect): PhotoRect => [r.x,r.y,r.width,r.height];
export const photoManifestSchema = sharedSchema;
export function adaptManifest(value: SharedManifest) {
  const person = (p: SharedManifest['people']['A']) => ({
    image:p.src, mask:p.mask, rect:tuple(p.rect??{x:0,y:0,width:1,height:1}),
    patches:Object.fromEntries(Object.entries(p.frames??{}).filter(([key])=>key!=='rest').map(([key,patch])=>[key,{image:patch.src,rect:tuple(patch.rect)}])) as Partial<Record<'ah'|'ee'|'oo'|'fv'|'mm'|'blink',{image:string;rect:PhotoRect}>>,
    label:'Fictional person. Synthetic image and voice.',
  });
  return { ...value, golden:value.plate, people:{A:person(value.people.A),B:person(value.people.B),C:person(value.people.C)}, objects:value.objects.map(o=>({...o,rect:tuple(o.rect),paper:o.paper?tuple(o.paper):undefined})) };
}
export type PhotoManifest = ReturnType<typeof adaptManifest>;
export type PhotoPerson = PhotoManifest['people']['A'];
export const PHOTO_BASE = '/worlds/photo-demo/';
export function assetSource(src:string,base=PHOTO_BASE) { return src.startsWith('/')||src.startsWith('data:')?src:base+src; }
export async function loadPhotoManifest(signal?:AbortSignal):Promise<PhotoManifest> {
  const response=await fetch(`${PHOTO_BASE}manifest.json`,{signal});
  if(!response.ok)throw new Error('The baked photo world is unavailable. Your figures still work.');
  return adaptManifest(sharedSchema.parse(await response.json()));
}
export function contains([x,y,w,h]:PhotoRect,px:number,py:number) {return px>=x&&px<=x+w&&py>=y&&py<=y+h;}
export function nightMood(below:boolean,stressed:boolean) {return below||stressed;}
