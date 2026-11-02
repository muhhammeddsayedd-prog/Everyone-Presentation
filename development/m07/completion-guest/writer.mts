/** One named anonymous guest comment, with explicit same-key confirmation. */
import { feedbackCommentDto, externalVersionDto, guestAccessDto, guestFeedbackDto } from '../../../packages/domain/src/guest.ts';
import type { Feedback, GuestAccess } from '../../../packages/domain/src/guest-types.ts';
import { feedbackSummaryDto, type FeedbackSummary } from '../../../packages/domain/src/feedback-summary.ts';
import { readPrivateInput } from '../../../tools/client-upload-transfer.mts';
import { closed, GuestDeltaError, need, ORIGIN, timestamp, token, uuid } from '../guest-summary-delta/probe.mts';

export const LIVE_WRITES_ENABLED=false;
export const LABEL='Release acceptance guest';
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export interface Input{run_id:string;review_link_id:string;series_id:string;version_id:string;version_slide_id:string;internal_comment_id:string;link_expires_at:string;review_token:string;expected_guest_before:FeedbackSummary;producer_before:FeedbackSummary}
export interface State{input:Input;session_token:string;session_id:string;session_expires_at:string;opened_at:string;feedback_before:Feedback}
export interface Ports{fetch?:typeof fetch;now?:()=>number}
export function commentBody(runId:string){return `Presentation release guest acceptance ${uuid(runId)}.`;}
export const identityKey=(runId:string)=>`guest-release-identity:${uuid(runId)}`;
export const commentKey=(runId:string)=>`guest-release-comment:${uuid(runId)}`;

export function parseInput(value:unknown):Input{
 const row=closed(value,['run_id','review_link_id','series_id','version_id','version_slide_id','internal_comment_id','link_expires_at','review_token','expected_guest_before','producer_before']);
 const version_id=uuid(row.version_id),version_slide_id=uuid(row.version_slide_id),expected_guest_before=feedbackSummaryDto(row.expected_guest_before),producer_before=feedbackSummaryDto(row.producer_before);
 need(expected_guest_before.version_id===version_id&&producer_before.version_id===version_id&&expected_guest_before.per_slide.some(s=>s.version_slide_id===version_slide_id));
 need(producer_before.per_slide.length===expected_guest_before.per_slide.length&&producer_before.totals.comment_count>expected_guest_before.totals.comment_count);
 for(let i=0;i<expected_guest_before.per_slide.length;i++){const guest=expected_guest_before.per_slide[i],producer=producer_before.per_slide[i];need(guest.version_slide_id===producer.version_slide_id&&guest.comment_count<=producer.comment_count&&guest.unresolved_count<=producer.unresolved_count&&guest.preferred===producer.preferred&&guest.maybe===producer.maybe&&guest.not_preferred===producer.not_preferred);}
 return{run_id:uuid(row.run_id),review_link_id:uuid(row.review_link_id),series_id:uuid(row.series_id),version_id,version_slide_id,internal_comment_id:uuid(row.internal_comment_id),link_expires_at:timestamp(row.link_expires_at),review_token:token(row.review_token),expected_guest_before,producer_before};
}
function access(value:unknown,rawToken?:string):GuestAccess{
 const row=closed(value,rawToken?['expires_at','series_id','version_id','download_enabled','display_name','guest_session_id']:['access_token','expires_at','series_id','version_id','download_enabled','display_name','guest_session_id']);
 const {access_token,...rest}=row;return guestAccessDto(rest,rawToken??token(access_token));
}
export function parseState(value:unknown):State{
 const row=closed(value,['input','session_token','session_id','session_expires_at','opened_at','feedback_before']);
 const input=parseInput(row.input),feedback_before=guestFeedbackDto(row.feedback_before,true);need(feedback_before.version_id===input.version_id&&feedback_before.page.next_cursor===null&&!feedback_before.comments.some(c=>c.id===input.internal_comment_id));
 return{input,session_token:token(row.session_token),session_id:uuid(row.session_id),session_expires_at:timestamp(row.session_expires_at),opened_at:timestamp(row.opened_at),feedback_before};
}
function request(ports:Ports){const fetcher=ports.fetch??fetch;return async(path:string,method:'GET'|'POST'|'PUT'='GET',credential?:{header:'x-review-token'|'x-review-session';value:string},body?:unknown,key?:string)=>{
 need(path.startsWith('/api/v1/review/'));const response=await fetcher(ORIGIN+path,{method,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',Origin:ORIGIN,...(body?{'Content-Type':'application/json'}:{}),...(credential?{[credential.header]:token(credential.value)}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 need(!response.redirected&&!(response.status>=300&&response.status<400)&&!response.headers.has('set-cookie')&&/\bno-store\b/iu.test(response.headers.get('cache-control')??'')&&response.headers.get('x-content-type-options')==='nosniff'&&response.headers.get('referrer-policy')==='no-referrer'&&/application\/json/iu.test(response.headers.get('content-type')??''));
 need(response.body);const reader=response.body.getReader(),parts:Uint8Array[]=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;need(size<=65536);parts.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
 let envelope:Record<string,unknown>;try{envelope=closed(await readPrivateInput((async function*(){for(const bytes of parts)yield bytes;})()),response.ok?['request_id','data']:['request_id','error']);}finally{for(const part of parts)part.fill(0);}
 return{status:response.status,request_id:uuid(envelope.request_id),data:envelope.data,error:envelope.error};
 };}
type Requester=ReturnType<typeof request>;
async function allFeedback(input:Input,auth:{header:'x-review-session';value:string},http:Requester):Promise<Feedback>{
 const comments:Feedback['comments']=[],preferences:Feedback['preferences']=[];let cursor:string|null=null;const seen=new Set<string>();
 for(let page=0;page<10;page++){const response=await http(`/api/v1/review/versions/${input.version_id}/feedback?limit=100${cursor?`&cursor=${encodeURIComponent(cursor)}`:''}`,'GET',auth);need(response.status===200);const result=guestFeedbackDto(response.data,true);need(result.version_id===input.version_id&&!result.comments.some(c=>c.id===input.internal_comment_id));comments.push(...result.comments);preferences.push(...result.preferences);need(comments.length+preferences.length<=1000);cursor=result.page.next_cursor;if(cursor===null){need(new Set(comments.map(c=>c.id)).size===comments.length&&new Set(preferences.map(p=>p.id)).size===preferences.length);return{version_id:input.version_id,comments,preferences,page:{next_cursor:null}};}need(!seen.has(cursor));seen.add(cursor);}
 throw new GuestDeltaError();
}
function fresh(state:State,now:number){need(now>=Date.parse(state.opened_at)-5000&&now-Date.parse(state.opened_at)<1800000&&now<Math.min(Date.parse(state.input.link_expires_at),Date.parse(state.session_expires_at)));}
export async function openGuest(value:unknown,ports:Ports={}):Promise<State>{try{
 need(LIVE_WRITES_ENABLED||Boolean(ports.fetch));const input=parseInput(value),now=(ports.now??Date.now)();need(now<Date.parse(input.link_expires_at));const http=request(ports),summaryPath=`/api/v1/review/versions/${input.version_id}/feedback/summary`;
 const missing=await http(summaryPath);need(missing.status===401);const denied=closed(missing.error,['code','message','details','retryable']);need(denied.code==='REVIEW_ACCESS_DENIED');
 const opened=await http('/api/v1/review/open','POST',{header:'x-review-token',value:input.review_token});need(opened.status===200);const session=access(opened.data);need(session.series_id===input.series_id&&session.version_id===input.version_id&&session.display_name===null&&!session.download_enabled);
 const auth={header:'x-review-session' as const,value:session.access_token};const version=await http(`/api/v1/review/versions/${input.version_id}`,'GET',auth);need(version.status===200);const saved=externalVersionDto(version.data);need(saved.id===input.version_id&&saved.series_id===input.series_id&&saved.slides.some(s=>s.id===input.version_slide_id));
 const summary=await http(summaryPath,'GET',auth);need(summary.status===200&&same(feedbackSummaryDto(summary.data),input.expected_guest_before));const feedback_before=await allFeedback(input,auth,http);
 need(feedback_before.comments.length===input.expected_guest_before.totals.comment_count);
 return parseState({input,session_token:session.access_token,session_id:session.guest_session_id,session_expires_at:session.expires_at,opened_at:new Date(now).toISOString(),feedback_before});
 }catch(error){if(error instanceof GuestDeltaError)throw error;throw new GuestDeltaError();}}
export async function confirmGuest(value:unknown,ports:Ports={}){try{
 need(LIVE_WRITES_ENABLED||Boolean(ports.fetch));const state=parseState(value),input=state.input,now=(ports.now??Date.now)();fresh(state,now);const http=request(ports),auth={header:'x-review-session' as const,value:state.session_token};
 const identified=await http('/api/v1/review/identity','PUT',auth,{display_name:LABEL},identityKey(input.run_id));need(identified.status===200);const named=access(identified.data);need(named.guest_session_id===state.session_id&&named.access_token===state.session_token&&named.display_name===LABEL&&named.series_id===input.series_id&&named.version_id===input.version_id);
 const body={version_slide_id:input.version_slide_id,body:commentBody(input.run_id)},commentPath=`/api/v1/review/versions/${input.version_id}/comments`;
 const first=await http(commentPath,'POST',auth,body,commentKey(input.run_id));need(first.status===201);const comment=feedbackCommentDto(first.data,true);
 need(comment.version_id===input.version_id&&comment.version_slide_id===input.version_slide_id&&comment.series_id===input.series_id&&comment.guest_session_id===state.session_id&&comment.author_display_name===LABEL&&comment.body===body.body&&!comment.resolved&&comment.parent_comment_id===null&&!state.feedback_before.comments.some(c=>c.id===comment.id));
 const replay=await http(commentPath,'POST',auth,body,commentKey(input.run_id));need(replay.status===201&&same(feedbackCommentDto(replay.data,true),comment));
 const expected=structuredClone(input.expected_guest_before),slide=expected.per_slide.find(s=>s.version_slide_id===input.version_slide_id);need(slide);slide.comment_count++;slide.unresolved_count++;expected.totals.comment_count++;expected.totals.unresolved_count++;
 const summaryPath=`/api/v1/review/versions/${input.version_id}/feedback/summary`,after=await http(summaryPath,'GET',auth),reload=await http(summaryPath,'GET',auth);need(after.status===200&&reload.status===200&&same(feedbackSummaryDto(after.data),expected)&&same(feedbackSummaryDto(reload.data),expected));
 const feedback=await allFeedback(input,auth,http),sort=<T extends{id:string}>(values:T[])=>[...values].sort((a,b)=>a.id.localeCompare(b.id));
 need(feedback.comments.length===state.feedback_before.comments.length+1&&same(sort(feedback.comments.filter(c=>c.id!==comment.id)),sort(state.feedback_before.comments))&&same(sort(feedback.preferences),sort(state.feedback_before.preferences))&&same(feedback.comments.find(c=>c.id===comment.id),comment));
 return{schema_version:'1.0',result:'passed',scope:'actual_named_anonymous_guest_HTTP_when_real_fetch_is_used',run_id:input.run_id,review_link_id:input.review_link_id,series_id:input.series_id,version_id:input.version_id,version_slide_id:input.version_slide_id,guest_session_id:state.session_id,comment_id:comment.id,observed_at:new Date(now).toISOString(),named_guest_verified:true,external_comment_created:true,one_comment_after_same_key_replay:true,summary_before:input.expected_guest_before,summary_after:expected,summary_reload_verified:true,existing_feedback_preserved:true,internal_comment_absent:true,internal_counts_excluded:true,producer_snapshot_source:'owner_supplied_MCP_before',cookies_or_authorization_sent:false,automatic_retry:false,request_ids:{identify:identified.request_id,create:first.request_id,replay:replay.request_id,summary:after.request_id,reload:reload.request_id},owner_revoke_link_after_acceptance:true};
 }catch(error){if(error instanceof GuestDeltaError)throw error;throw new GuestDeltaError();}}
