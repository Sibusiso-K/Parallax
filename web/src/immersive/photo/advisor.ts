import { answerFromReply, type LiveExtras, type LiveResult } from '../live-advisor';
import type { AdvisorScope } from '../advisor-fixture';
import type { Session } from '../session';

/** Photo-only transport; the existing server sentence guard and client ClaimRef verification are unchanged. */
export async function askFutureSelf(session:Session,scope:AdvisorScope,stressed:boolean,question:string,extras:LiveExtras,signal?:AbortSignal):Promise<LiveResult> {
  const entry=session.paths[scope.pathId];
  try {
    const response=await fetch('/api/advisor',{method:'POST',headers:{'content-type':'application/json'},signal,body:JSON.stringify({
      persona:'future-self',question:question.slice(0,600),month:scope.month,stressed,object:extras.object,
      path:{...entry.path,letter:scope.pathId,name:entry.name,summary:entry.summary},context:extras.context,
      history:extras.history.slice(-8).map(h=>({...h,text:h.text.slice(0,1200)})),
    })});
    const data=await response.json() as Parameters<typeof answerFromReply>[3]&{ok?:boolean;mode?:string;error?:string};
    if(data.ok&&data.mode==='model'&&Array.isArray(data.segments))return {kind:'answer',answer:answerFromReply(session,scope,question,data)};
    if(data.ok&&data.mode==='fixture')return {kind:'fixture'};
    return {kind:'failed',message:data.error||'The future self could not answer just now. Please try again.'};
  }catch(error){
    if((error as Error)?.name==='AbortError')throw error;
    return {kind:'fixture'};
  }
}
