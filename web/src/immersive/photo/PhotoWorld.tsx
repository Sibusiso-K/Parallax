import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { ObjectId, PlaceId } from '../courtyard/manifest';
import type { RoomReadout } from '../courtyard/readout';
import { LivingPerson, rectStyle } from './LivingPerson';
import { assetSource, adaptManifest, contains, loadPhotoManifest, nightMood, PHOTO_BASE, type PhotoManifest } from './manifest';

import type { PhotoManifest as SharedManifest } from '../../../../shared/world/manifest';

type Mask = { alpha: Uint8Array; width: number; height: number };
const PLACES: Record<PlaceId,[number,number,number]> = { spawn:[.5,.5,1],offer:[.28,.78,1.38],intake:[.29,.52,1.3],bridge:[.51,.55,1.1],memo:[.88,.34,1.32] };
export interface PhotoWorldProps {
  readout: RoomReadout; place: PlaceId; selected: ObjectId|null; onSelect:(id:ObjectId)=>void;
  reduced:boolean; transcript:string|null; resetKey:string; disabled?:boolean; manifest?:SharedManifest; base?:string; autoPlay?:number; demo?:boolean;
}
/** No renderer context: a photo, transparent SAM cutouts, bounded Canvas atmosphere and DOM evidence. */
export default function PhotoWorld({readout,place,selected,onSelect,reduced,transcript,resetKey,disabled=false,manifest:provided,base=PHOTO_BASE,autoPlay=0,demo=false}:PhotoWorldProps) {
  const [manifest,setManifest]=useState<PhotoManifest|null>(provided?adaptManifest(provided):null);
  const [error,setError]=useState('');
  const [hover,setHover]=useState<ObjectId|null>(null);
  const [speaking,setSpeaking]=useState(false);
  const [dialogueHost,setDialogueHost]=useState<HTMLDivElement|null>(null);
  const frame=useRef<HTMLDivElement>(null);
  const scene=useRef<HTMLDivElement>(null);
  const atmosphere=useRef<HTMLCanvasElement>(null);
  const pointer=useRef({x:0,y:0});
  const masks=useRef(new Map<ObjectId,Mask>());
  const speak=useCallback((active:boolean)=>setSpeaking(active),[]);
  useEffect(()=> {
    if(provided){setManifest(adaptManifest(provided));setError('');return;}
    const controller=new AbortController();
    loadPhotoManifest(controller.signal).then(setManifest).catch((e:unknown)=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Photo world unavailable.');});
    return ()=>controller.abort();
  },[provided]);
  useEffect(()=> {
    let alive=true; masks.current.clear();
    for(const object of manifest?.objects??[]) {
      if(!object.mask)continue;
      const image=new Image(); image.onload=()=> {
        if(!alive)return;
        const canvas=document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d',{willReadFrequently:true}); if(!ctx)return;
        ctx.drawImage(image,0,0);
        try {const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data; const alpha=new Uint8Array(canvas.width*canvas.height); for(let i=0;i<alpha.length;i++)alpha[i]=rgba[i*4+3]!; masks.current.set(object.id,{alpha,width:canvas.width,height:canvas.height});}catch{/* Explicit object buttons remain available when a remote canvas is tainted. */}
        canvas.width=canvas.height=0;
      }; image.src=assetSource(object.mask,base);
    }
    return()=>{alive=false;masks.current.clear();};
  },[manifest,base]);
  useEffect(()=> {
    if(reduced||!manifest)return;
    let id=0,last=0,x=0,y=0;
    const ctx=atmosphere.current?.getContext('2d');
    const tick=(time:number)=> {
      id=requestAnimationFrame(tick);
      if(document.hidden || time-last<32)return; last=time;
      x+=(pointer.current.x-x)*.06; y+=(pointer.current.y-y)*.06;
      if(scene.current){scene.current.style.setProperty('--photo-x',`${x*7}px`);scene.current.style.setProperty('--photo-y',`${y*4}px`);}
      if(!ctx)return;
      ctx.clearRect(0,0,640,320);
      for(let i=0;i<12;i++){
        const phase=(time*.000055+i/12)%1;
        const px=318+Math.sin(time*.0004+i)*13+i%3*12,py=228-phase*125;
        const glow=ctx.createRadialGradient(px,py,0,px,py,12+phase*15);glow.addColorStop(0,`rgba(255,250,225,${.055*Math.sin(phase*Math.PI)})`);glow.addColorStop(1,'rgba(255,250,225,0)');
        ctx.fillStyle=glow;ctx.fillRect(px-30,py-30,60,60);
      }
      // Sparse film texture, bounded to this small canvas rather than a full-resolution noise buffer.
      ctx.fillStyle='rgba(58,42,25,.045)';
      for(let i=0;i<90;i++){const seed=(i*7919+Math.floor(time/100)*1543)%204800;ctx.fillRect(seed%640,Math.floor(seed/640),1,1);}
    }; id=requestAnimationFrame(tick);return()=>cancelAnimationFrame(id);
  },[reduced,manifest]);
  const hit=(clientX:number,clientY:number)=> {
    const bounds=frame.current?.getBoundingClientRect(); if(!bounds||!manifest)return null;
    const x=(clientX-bounds.left)/bounds.width,y=(clientY-bounds.top)/bounds.height;
    return manifest.objects.find(object=> {
      const mask=masks.current.get(object.id);
      if(mask){const px=Math.floor(x*mask.width),py=Math.floor(y*mask.height);return px>=0&&px<mask.width&&py>=0&&py<mask.height&&(mask.alpha[py*mask.width+px]??0)>100;}
      return contains(object.rect,x,y);
    })?.id??null;
  };
  if(!manifest)return <div className="photo-unavailable" role="status"><p>{error||'Opening the baked photo world…'}</p><p>Your engine figures and advisor remain available in the panel.</p></div>;
  const active=manifest.objects.find(o=>o.id===(hover??selected));
  const target=selected?manifest.objects.find(o=>o.id===selected):null;
  const camera=speaking?[.5,.35,1.45]:target?[target.rect[0]+target.rect[2]/2,target.rect[1]+target.rect[3]/2,1.32]:PLACES[place];
  const person=manifest.people[readout.pathLetter as 'A'|'B'|'C']??manifest.people.B;
  const isNight=nightMood(readout.below,readout.stressed);
  const contractPaper=manifest.objects.find(o=>o.id==='contract')?.paper;
  const memoPaper=manifest.objects.find(o=>o.id==='memo')?.paper;
  return <div className={`photo-world ${isNight?'is-night':''} ${reduced?'is-reduced':''}`}>
    <div className="photo-scene" ref={scene} style={{'--photo-origin':`${camera[0]!*100}% ${camera[1]!*100}%`,'--photo-zoom':camera[2]} as CSSProperties}>
      <div className="photo-frame" ref={frame} style={{aspectRatio:`${manifest.width}/${manifest.height}`}}
        onPointerMove={event=>{const b=event.currentTarget.getBoundingClientRect();pointer.current={x:(event.clientX-b.left)/b.width-.5,y:(event.clientY-b.top)/b.height-.5};setHover(hit(event.clientX,event.clientY));}}
        onPointerLeave={()=>{pointer.current={x:0,y:0};setHover(null);}}
        onClick={event=>{const id=hit(event.clientX,event.clientY);if(id&&!disabled)onSelect(id);}}>
        <img className="photo-layer photo-plate" src={assetSource(manifest.golden,base)} alt="Illustrative photographic kitchen, generated for the fictional demo founder" draggable={false} onError={()=>setError('The photo could not load. Use the object buttons and engine panel.')}/>
        <img className="photo-layer photo-night" src={assetSource(manifest.night,base)} alt="" draggable={false}/>
        <LivingPerson person={person} base={base} path={readout.pathLetter as 'A'|'B'|'C'} transcript={transcript} resetKey={resetKey} reduced={reduced} disabled={disabled} onSpeaking={speak} dialogueHost={dialogueHost} autoPlay={autoPlay} demo={demo}/>
        {manifest.foreground&&<img className="photo-layer photo-foreground" src={assetSource(manifest.foreground,base)} alt="" draggable={false}/>}
        <canvas className="photo-layer photo-atmosphere" ref={atmosphere} width={640} height={320} aria-hidden="true"/>
        {active?.mask&&<div className="photo-highlight" style={{maskImage:`url("${assetSource(active.mask,base)}")`,WebkitMaskImage:`url("${assetSource(active.mask,base)}")`}}/>}
        <div className="photo-paper photo-paper--contract" style={contractPaper?rectStyle(contractPaper):undefined}><small>Cash · month {readout.month}</small><strong>{readout.cash}</strong>{readout.stressed&&<b className="photo-stamp">PAYING LATE</b>}</div>
        <div className="photo-paper photo-paper--memo" style={memoPaper?rectStyle(memoPaper):undefined}><small>Lowest cash</small><strong>{readout.lowest}</strong><small>Month {readout.lowestMonth}</small></div>
        {active&&<span className="photo-object-label" style={{...rectStyle(active.rect),width:'auto',height:'auto'}}>{active.label}</span>}
      </div>
    </div>
    <div className="photo-vignette" aria-hidden="true"/>
    <div className="photo-dialogue-host" ref={setDialogueHost}/>
    <div className="photo-object-nav" role="group" aria-label="Objects in the photograph">{manifest.objects.map(object=><button key={object.id} disabled={disabled} aria-pressed={selected===object.id} onClick={()=>onSelect(object.id)}>{object.label}</button>)}</div>
    <span className="photo-disclosure">{manifest.mode==='baked'?'Baked demo imagery':'Generated illustrative imagery'} · Muse Image + SAM · figures from the engine</span>
    {error&&<p className="photo-error" role="alert">{error}</p>}
  </div>;
}
