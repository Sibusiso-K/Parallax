import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { pickVoice } from '../../lib/speech';
import { assetSource, type PhotoPerson, type PhotoRect } from './manifest';
import { boundaryOffset, buildVisemeTimeline, cueAt, futureSelfIntro, type Viseme } from './visemes';

export const rectStyle = ([x,y,w,h]: PhotoRect): CSSProperties => ({ left: `${x*100}%`, top: `${y*100}%`, width: `${w*100}%`, height: `${h*100}%` });

export function LivingPerson({ person, base, path, transcript, resetKey, reduced, disabled, onSpeaking, dialogueHost, autoPlay=0, demo=false }: {
  person: PhotoPerson; base: string; path: 'A'|'B'|'C'; transcript: string|null; resetKey: string;
  reduced: boolean; disabled: boolean; onSpeaking: (active: boolean) => void;
  dialogueHost: HTMLElement|null;
  autoPlay?: number;
  demo?: boolean;
}) {
  const [speaking,setSpeaking] = useState(false);
  const [shape,setShape] = useState<Viseme>('rest');
  const [blink,setBlink] = useState(false);
  const [status,setStatus] = useState('');
  const [starting,setStarting] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance|null>(null);
  const animation = useRef(0);
  const startTimer = useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const offset = useRef(0);
  const started = useRef(0);
  const text = transcript ?? (demo ? futureSelfIntro[path] : 'This is one possible future for my business. I want to see what changes if I take this path.');
  const timeline = useMemo(()=>buildVisemeTimeline(text,.94),[text]);
  const spokenTo = useRef(autoPlay);
  const stop = () => {
    if (utterance.current) { utterance.current.onend=null; utterance.current.onerror=null; utterance.current.onstart=null; utterance.current.onboundary=null; window.speechSynthesis?.cancel(); }
    utterance.current=null; cancelAnimationFrame(animation.current); clearTimeout(startTimer.current);
    setSpeaking(false); setStarting(false); setShape('rest'); onSpeaking(false);
  };
  useEffect(()=> { stop(); setStatus(''); return stop; },[resetKey,disabled,text]); // Snapshot changes invalidate speech and captions together.
  useEffect(()=> {
    const hide=()=>{if(document.hidden)stop();};
    document.addEventListener('visibilitychange',hide);return()=>document.removeEventListener('visibilitychange',hide);
  },[]);
  useEffect(()=> {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    let alive=true;
    const next=()=> { timer=setTimeout(()=> { if (!alive) return; setBlink(true); timer=setTimeout(()=> {setBlink(false); next();},130); },2800+Math.random()*3300); };
    next(); return ()=> {alive=false; clearTimeout(timer);};
  },[reduced,person]);
  const play=()=> {
    stop();
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance==='undefined') { setStatus('Voice unavailable. Read the caption below.'); return; }
    const speech = new SpeechSynthesisUtterance(text);
    setStarting(true);setStatus('Starting device voice…');
    speech.voice=pickVoice(window.speechSynthesis.getVoices()) ?? null;
    speech.lang=speech.voice?.lang ?? 'en-ZA'; speech.rate=.94; utterance.current=speech;
    const finish=()=> { stop(); setStatus(''); };
    speech.onstart=()=> {
      clearTimeout(startTimer.current); started.current=performance.now(); offset.current=0;
      setStarting(false); setSpeaking(true); onSpeaking(true); setStatus('Estimated mouth animation · device voice');
      const tick=()=> { const elapsed=performance.now()-started.current; setShape(reduced?'rest':cueAt(timeline,elapsed-offset.current)); animation.current=requestAnimationFrame(tick); };
      animation.current=requestAnimationFrame(tick);
    };
    speech.onboundary=(event)=> { offset.current=boundaryOffset(timeline,event.charIndex,performance.now()-started.current); };
    speech.onend=finish;
    speech.onerror=()=> {stop();setStatus('Voice unavailable. The caption stays visible.');};
    startTimer.current=setTimeout(()=> { stop();setStatus('Voice did not start. Try again or read the caption.'); },6000);
    window.speechSynthesis.speak(speech);
  };
  useEffect(()=> {
    if(autoPlay===spokenTo.current||!transcript||disabled)return;
    spokenTo.current=autoPlay;play();
    // Only a new spoken question starts playback; ordinary answer updates do not autoplay.
  },[autoPlay,transcript,disabled]);
  return <>
    <div className={`photo-person ${speaking?'is-speaking':''}`} aria-hidden="true">
      <img className="photo-layer" src={assetSource(person.image,base)} style={person.mask?{maskImage:`url("${assetSource(person.mask,base)}")`,maskSize:'100% 100%'}:undefined} alt="" draggable={false}/>
      {Object.entries(person.patches).map(([key,patch])=>patch && <img key={key} className="photo-patch" src={assetSource(patch.image,base)} style={{...rectStyle(patch.rect),opacity:key==='blink'?(blink?1:0):(shape===key?1:0)}} alt="" draggable={false}/>)}
    </div>
    {dialogueHost && createPortal(<div className="photo-dialogue glass" onClick={event=>event.stopPropagation()} onPointerMove={event=>event.stopPropagation()}>
      <div className="photo-dialogue__head"><span>My possible future · {path}</span><button className="btn btn--sm" disabled={disabled} onClick={speaking||starting?stop:play}>{speaking?'Stop voice':starting?'Cancel voice':transcript?'Hear my answer':'Meet my future self'}</button></div>
      <p className="photo-caption">{text}</p>
      <small>{person.label}</small>
      {status && <small role="status">{status}</small>}
    </div>,dialogueHost)}
  </>;
}
