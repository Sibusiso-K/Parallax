import { describe, expect, it } from 'vitest';
import { adaptManifest, assetSource, contains, nightMood, photoManifestSchema } from './manifest';
import { boundaryOffset, buildVisemeTimeline, cueAt, visemeFor } from './visemes';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { advisorRequest, advisorFigures, buildAdvisorPrompt, checkAdvisorText } from '../../../../shared/scene/advisor-model';
import { exploreSession } from '../session-adapter';

const fixture = () => ({ version:1,id:'test',title:'A possible future',mode:'baked',width:2240,height:1120,plate:'/worlds/photo-demo/golden.webp',night:'/worlds/photo-demo/night.webp',objects:[{id:'contract',label:'Contract',rect:{x:.2,y:.7,width:.2,height:.2}}],people:{A:{src:'/a.webp'},B:{src:'/b.webp'},C:{src:'/c.webp'}},places:[],disclosure:'Illustrative imagery. Fictional people. Synthetic images.' });
describe('photo manifest and honest fallbacks',()=> {
  it('ships a schema-valid offline demo with every referenced asset present under budget',()=> {
    const m=photoManifestSchema.parse(JSON.parse(readFileSync(resolve('web/public/worlds/photo-demo/manifest.json'),'utf8')));
    const paths=new Set<string>([m.plate,m.night,...(m.foreground?[m.foreground]:[]),...m.objects.flatMap(o=>o.mask?[o.mask]:[]),...Object.values(m.people).flatMap(p=>[p.src,...Object.values(p.frames??{}).map(f=>f.src)])]);
    let bytes=0;for(const path of paths){expect(path.startsWith('/worlds/photo-demo/')).toBe(true);const file=resolve('web/public',path.slice(1));expect(existsSync(file)).toBe(true);bytes+=statSync(file).size;}
    expect(bytes).toBeLessThan(8*1024*1024);
    for(const person of Object.values(m.people))for(const shape of ['ah','ee','oo','fv','mm','blink'])expect(person.frames).toHaveProperty(shape);
  });
  it('accepts the shared live/baked contract and supplies rest-only people when speech patches are missing',()=> {
    const m=adaptManifest(photoManifestSchema.parse(fixture()));
    expect(m.people.B.patches).toEqual({});expect(m.people.B.rect).toEqual([0,0,1,1]);
    expect(m.objects[0]?.rect).toEqual([.2,.7,.2,.2]);
  });
  it('rejects external assets, executable URLs, out-of-bounds regions and missing people',()=> {
    for(const plate of ['javascript:alert(1)','https://example.com/a.jpg'])expect(photoManifestSchema.safeParse({...fixture(),plate}).success).toBe(false);
    expect(photoManifestSchema.safeParse({...fixture(),objects:[{id:'memo',label:'Board',rect:{x:.9,y:0,width:.3,height:1}}]}).success).toBe(false);
    expect(photoManifestSchema.safeParse({...fixture(),people:{}}).success).toBe(false);
  });
  it('does not prepend the demo path to generated inline images',()=> {
    expect(assetSource('data:image/webp;base64,AA==')).toBe('data:image/webp;base64,AA==');
    expect(assetSource('/worlds/custom/a.webp')).toBe('/worlds/custom/a.webp');
  });
  it('retains rectangle picking without a decoded mask',()=> {
    expect(contains([.2,.3,.1,.2],.25,.4)).toBe(true);expect(contains([.2,.3,.1,.2],.8,.4)).toBe(false);
  });
  it('uses only engine state or the explicit stress switch for night',()=> {
    expect(nightMood(false,false)).toBe(false);expect(nightMood(true,false)).toBe(true);expect(nightMood(false,true)).toBe(true);
  });
});
describe('future self guard',()=> {
  it('changes the voice of the prompt while retaining deterministic claims and rejecting invented money',()=> {
    const loaded=exploreSession({kind:'demo'});if(!loaded.ok)throw new Error(loaded.reason);
    const session=loaded.session,snap=session.snapshotFor('B',true),entry=session.paths.B;
    const req=advisorRequest.parse({persona:'future-self',question:'What happens here?',month:4,stressed:true,path:{...entry.path,letter:'B',name:entry.name,summary:entry.summary}});
    const months=[2,3,4,5,36],{table,figures}=advisorFigures('B',snap,months);
    const prompt=buildAdvisorPrompt(req,snap,months,table,figures);
    expect(prompt.system).toContain('fictional possible future self');expect(prompt.system).toContain('Never type an amount');
    const checked=checkAdvisorText('I would have R999,999. My cash could reach {{fig:B.room.active.cash.m4}}.',{letter:'B',months,table,figures,userNumbers:[]});
    expect(checked.dropped).toBe(1);expect(checked.segments.some(s=>s.kind==='figure')).toBe(true);expect(JSON.stringify(checked)).not.toContain('999');
  });
});
describe('estimated speech articulation',()=> {
  it('returns rest before, after and without speech',()=> {
    const cues=buildVisemeTimeline('hello.');expect(cueAt(cues,-1)).toBe('rest');expect(cueAt(cues,10000)).toBe('rest');expect(cueAt([],0)).toBe('rest');
  });
  it('has monotone, contiguous timing and longer punctuation pauses',()=> {
    const cues=buildVisemeTimeline('Ah, me.');for(let i=1;i<cues.length;i++)expect(cues[i]?.at).toBe(cues[i-1]?.end);
    expect(cues.at(-1)!.end-cues.at(-1)!.at).toBeGreaterThan(cues[0]!.end);
    expect(buildVisemeTimeline('hello',2).at(-1)!.end).toBeLessThan(buildVisemeTimeline('hello',1).at(-1)!.end);
  });
  it('maps visible mouth families and reanchors at real word boundaries',()=> {
    expect(['a','e','o','f','m',' '].map(visemeFor)).toEqual(['ah','ee','oo','fv','mm','rest']);
    const cues=buildVisemeTimeline('my future');const elapsed=500;
    expect(cueAt(cues,elapsed-boundaryOffset(cues,3,elapsed))).toBe('fv');
  });
  it('bounds unusual speech rates and long input',()=> {
    expect(buildVisemeTimeline('a',Number.NaN)[0]?.end).toBe(58);
    expect(buildVisemeTimeline('a'.repeat(6000))).toHaveLength(5000);
  });
});
