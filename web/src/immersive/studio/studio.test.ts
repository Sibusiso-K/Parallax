import { describe, expect, it, vi } from 'vitest';
import { buildSnapshot } from '../../../../shared/scene/room-model';
import { filmPlanSchema } from '../../../../shared/world/film-plan';
import { chordForCash, demoFilm, drawFilmFrame, filmFormat, filmMoment, SHOT_SECONDS } from './film';
import { buildLiveWorld } from './live-world';
import { maskRect } from './masks';
import type { SamMask } from '../../../../shared/providers/sam';

describe('film timeline and figure source', () => {
  it('covers the final engine month and clamps the end to the last shot', () => {
    expect(filmMoment(0, 6, 36)).toEqual({ index: 0, progress: 0, month: 1 });
    expect(filmMoment(6 * SHOT_SECONDS, 6, 36)).toEqual({ index: 5, progress: 1, month: 36 });
    expect(() => filmMoment(1, 0, 36)).toThrow();
  });
  it('selects a minor third only below zero and records an audio-capable format', () => {
    expect(chordForCash(-1)[1]).toBeLessThan(chordForCash(0)[1]!);
    expect(filmFormat(m => m.includes('mp4a'))?.extension).toBe('mp4');
    expect(filmFormat(m => m.includes('opus'))?.extension).toBe('webm');
    expect(filmFormat(() => false)).toBeNull();
  });
  it('rejects numeric director prompts and duplicate story beats', () => {
    const shots = demoFilm.shots.map(s => ({ focus: s.focus, camera: s.camera, prompt: 'A fictional adult at work.' }));
    expect(filmPlanSchema.safeParse({ shots }).success).toBe(true);
    expect(filmPlanSchema.safeParse({ shots: shots.map(s => ({ ...s, focus: 'founder' })) }).success).toBe(false);
    expect(filmPlanSchema.safeParse({ shots: shots.map(s => ({ ...s, prompt: 'R5000 profit' })) }).success).toBe(false);
  });
  it('draws snapshot cash and the shortfall qualification, not figures supplied by a model', () => {
    const snapshot = buildSnapshot({ sessionId: 'film-test', profileRevision: 1, simulationVersion: 1, pathId: 'A', pathName: 'Stay', case: 'likely', path: { id: 'A', startingCash: 100, months: 6, assumptions: [{ id: 'cost', label: 'Cost', kind: 'cost', low: 50, base: 50, high: 50 }] } });
    const text: string[] = [];
    const ctx = { clearRect: vi.fn(), drawImage: vi.fn(), createLinearGradient: () => ({ addColorStop: vi.fn() }), fillRect: vi.fn(), fillText: (s: string) => text.push(s) } as unknown as CanvasRenderingContext2D;
    const loaded = demoFilm.shots.map(() => ({ image: { naturalWidth: 2240, naturalHeight: 1120 } as HTMLImageElement, subject: null }));
    drawFilmFrame(ctx, demoFilm, loaded, snapshot, 16, true);
    expect(text.some(t => t.includes('Cash') && t.includes('200'))).toBe(true);
    expect(text).toContain('Cash first below zero: month 3');
    expect(text.some(t => t.includes('not a prediction'))).toBe(true);
  });
  it('normalises SAM source bounds, not mask raster size', () => {
    expect(maskRect({ bounds: { left: 100, top: 50, right: 300, bottom: 150 } } as SamMask, 1000, 500)).toEqual({ x: .1, y: .1, width: .2, height: .2 });
  });
  it('cancelled world generation does not silently load the demo', async () => {
    const controller = new AbortController(); controller.abort(); const call = vi.fn();
    await expect(buildLiveWorld('A bakery', { signal: controller.signal, onProgress: vi.fn(), call })).rejects.toThrow();
    expect(call).not.toHaveBeenCalled();
  });
});

import * as imageTools from './masks';
import { documentConsequence } from './DocumentConsequence';
import type { PathInput } from '../../../../shared/engine/simulate';
import type { DocumentProposal } from '../../../../shared/world/document';
import { afterEach } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const slots = ['contract','pan','fridge','intake_desk','memo'] as const;
const livePlan = { title:'Salon',platePrompt:'A salon with blank papers.',personPrompt:'A fictional adult founder.',objects:slots.map(id=>({id,label:id.replace('_',' '),concept:'work surface'})),rooms:[{id:'spawn',label:'Room',rect:{x:0,y:0,width:1,height:1}}] };
const visible = slots.map((id,i)=>({id,label:id.replace('_',' '),concept:'work surface',box:[i*180,600,i*180+160,850]}));
const fakeImage='data:image/jpeg;base64,YWJj';
function mockImages() {
  vi.spyOn(imageTools,'compactImage').mockResolvedValue({dataUrl:fakeImage,width:1600,height:800});
  vi.spyOn(imageTools,'maskDataUrl').mockReturnValue(fakeImage);
  vi.spyOn(imageTools,'registeredPatch').mockResolvedValue({src:fakeImage,rect:{x:.45,y:.25,width:.08,height:.05}});
}
const faceMask={bounds:{left:700,top:200,right:800,bottom:240}} as SamMask;

describe('live world stages and degradation',()=>{
  it('runs person and night together, caps requests at six, and fills every viseme',async()=>{
    mockImages(); let active=0,maxActive=0; const starts:string[]=[],ends:string[]=[];
    const call=vi.fn(async(body:unknown)=>{
      const b=body as {action:string;prompt?:string;concept?:string};
      const name=b.action==='edit'?(b.prompt!.includes('Add this one')?'person':b.prompt!.includes('evening')?'night':'frame'):b.action;
      if(name==='draw') expect(ends).toContain('plan');
      if(name==='person'||name==='night') expect(ends).toContain('draw');
      if(name==='segment'||name==='objects'||name==='frame') {expect(ends).toContain('person');expect(ends).toContain('night');}
      starts.push(name);active++;maxActive=Math.max(maxActive,active);
      await new Promise(resolve=>setTimeout(resolve,2));
      if(name==='person') expect(starts).toContain('night');
      active--;ends.push(name);
      return {mode:'model',plan:livePlan,dataUrl:fakeImage,objects:visible,masks:[faceMask]};
    });
    const progress=vi.fn();const result=await buildLiveWorld('A salon',{signal:new AbortController().signal,onProgress:progress,call});
    expect(result.source).toBe('generated');expect(maxActive).toBe(6);expect(call).toHaveBeenCalledTimes(19);
    expect(Object.keys(result.manifest.people.B.frames!)).toEqual(['ah','ee','oo','fv','mm','blink']);
    expect(progress.mock.calls.filter(([e])=>e.state==='running')).toHaveLength(19);
    expect(result.manifest.objects).toHaveLength(5);
  });
  it('retains all visual boxes when SAM finds nothing and reports missing lips',async()=>{
    mockImages();
    const call=vi.fn(async()=>({mode:'model',plan:livePlan,dataUrl:fakeImage,objects:visible,masks:[]}));
    const result=await buildLiveWorld('A salon',{signal:new AbortController().signal,onProgress:vi.fn(),call});
    expect(result.source).toBe('generated');expect(result.manifest.objects).toHaveLength(5);
    expect(result.manifest.objects[0]).toMatchObject({rect:{x:0,y:.6,width:.16,height:.25}});
    expect(result.manifest.objects.every(o=>!o.mask)).toBe(true);
    expect(result.manifest.objects[0]!.paper).toBeDefined();
    expect(result.manifest.people.B.frames).toEqual({});expect(result.message).toContain('will not move their lips');
    expect(call).toHaveBeenCalledTimes(13);
  });
  it('keeps the person and blink when only the mouth is missing',async()=>{
    mockImages();
    const call=vi.fn(async(body:unknown)=>({mode:'model',plan:livePlan,dataUrl:fakeImage,objects:visible,masks:(body as {concept?:string}).concept==='mouth'?[]:[faceMask]}));
    const result=await buildLiveWorld('A salon',{signal:new AbortController().signal,onProgress:vi.fn(),call});
    expect(result.source).toBe('generated');expect(result.manifest.people.B.frames).toHaveProperty('blink');
    expect(result.manifest.people.B.frames).not.toHaveProperty('ah');expect(result.message).toContain('will not move their lips');
  });
  it('uses plan concepts when visual mapping fails, without inventing paper locations',async()=>{
    mockImages();
    const call=vi.fn(async(body:unknown)=>{if((body as {action:string}).action==='objects')throw Error('Unavailable');return {mode:'model',plan:livePlan,dataUrl:fakeImage,masks:[]};});
    const result=await buildLiveWorld('A salon',{signal:new AbortController().signal,onProgress:vi.fn(),call});
    expect(result.manifest.objects).toHaveLength(5);expect(result.manifest.objects.every(o=>!o.paper)).toBe(true);
    expect(result.message).toContain('approximate');
  });
  it('uses the labelled baked demo when generation is unavailable',async()=>{
    const demo={version:1,id:'demo',title:'Demo',mode:'baked',width:1600,height:800,plate:fakeImage,night:fakeImage,people:{A:{src:fakeImage},B:{src:fakeImage},C:{src:fakeImage}},objects:[],places:[],disclosure:'Illustrative imagery. Fictional people. Synthetic images.'};
    vi.stubGlobal('fetch',vi.fn(async()=>Response.json(demo)));
    const result=await buildLiveWorld('A salon',{signal:new AbortController().signal,onProgress:vi.fn(),call:async()=>({mode:'fixture'})});
    expect(result.source).toBe('demo');expect(result.message).toContain('not a generated version');
  });
});

describe('document consequence arithmetic',()=>{
  const path:PathInput={id:'B',startingCash:157000,months:6,assumptions:[{id:'cost',label:'Costs',kind:'cost',low:62000,base:62000,high:62000},{id:'contract',label:'Receipts',kind:'income',role:'contract',low:120000,base:120000,high:120000,fromMonth:3}]};
  const proposal:DocumentProposal={kind:'paymentDays',value:90,quote:'Payment is due within 90 calendar days.',page:1,source:'document-unverified'};
  it('compares the real baseline with only the extra delay and leaves the path intact',()=>{
    const original=JSON.stringify(path);const result=documentConsequence(proposal,path,2);
    expect(result).toMatchObject({later:true,extra:1,before:33000,after:-29000});expect(result.message).toContain('R33,000 to -R29,000');expect(JSON.stringify(path)).toBe(original);
  });
  it('rounds up and handles earlier, unknown and amount proposals without engine claims',()=>{
    expect(documentConsequence({...proposal,value:61},path,2)).toMatchObject({extra:1});
    expect(documentConsequence({...proposal,value:60},path,2)).toMatchObject({later:false});
    expect(documentConsequence(proposal,path,null).later).toBe(false);
    expect(documentConsequence({...proposal,kind:'amount',value:120000},path,2).message).toContain('not an engine figure');
  });
});
