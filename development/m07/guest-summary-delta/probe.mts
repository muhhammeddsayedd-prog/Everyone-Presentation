/** Anonymous-only pilot probe. Imports are inert; injected fetch is a trusted test seam. */
import { createHash } from 'node:crypto';
import { feedbackSummaryDto, type FeedbackSummary } from '../../../packages/domain/src/feedback-summary.ts';
import { guestAccessDto, guestTimestamp } from '../../../packages/domain/src/guest.ts';
import { readPrivateInput } from '../../../tools/client-upload-transfer.mts';

export const ORIGIN='https://everyone-presentation-pilot.vercel.app';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const SHA=/^[a-f0-9]{64}$/u;
const DENIALS=new Set(['REVIEW_ACCESS_DENIED','REVIEW_LINK_EXPIRED','REVIEW_LINK_REVOKED','REVIEW_UNAVAILABLE','RESOURCE_NOT_FOUND','ACCESS_DENIED']);
export class GuestDeltaError extends Error{constructor(readonly code='GUEST_DELTA_UNCONFIRMED'){super(code);this.name='GuestDeltaError';}}
export function need(value:unknown,code?:string):asserts value{if(!value)throw new GuestDeltaError(code);}
export function closed(value:unknown,keys:string[]):Record<string,unknown>{need(value&&typeof value==='object'&&!Array.isArray(value));need([Object.prototype,null].includes(Object.getPrototypeOf(value)));const descriptors=Object.getOwnPropertyDescriptors(value);need(Reflect.ownKeys(value).length===keys.length&&keys.every(key=>descriptors[key]?.enumerable&&Object.hasOwn(descriptors[key],'value')));return value as Record<string,unknown>;}
export function uuid(value:unknown):string{need(typeof value==='string'&&UUID.test(value));return value;}
export function token(value:unknown):string{need(typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/u.test(value)&&Buffer.from(value,'base64url').toString('base64url')===value);return value;}
export function timestamp(value:unknown):string{return guestTimestamp(value);}
export const sha=(value:string|Uint8Array)=>createHash('sha256').update(value).digest('hex');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export interface ProbeInput{schema_version:'1.0';review_link_id:string;series_id:string;version_id:string;denied_version_id:string;denied_version_kind:'foreign_series'|'internal_audience';link_expires_at:string;review_token:string;expected_guest_summary:FeedbackSummary;producer_summary:FeedbackSummary}
export interface PrivateSession{schema_version:'1.0';review_link_id:string;series_id:string;version_id:string;review_token:string;session_token:string;session_expires_at:string;link_expires_at:string;opened_at:string;summary_sha256:string}
interface Ports{fetch?:typeof fetch;now?:()=>number}
function parse(value:unknown):ProbeInput{
 const row=closed(value,['schema_version','review_link_id','series_id','version_id','denied_version_id','denied_version_kind','link_expires_at','review_token','expected_guest_summary','producer_summary']);need(row.schema_version==='1.0');
 const version_id=uuid(row.version_id),denied_version_id=uuid(row.denied_version_id);need(version_id!==denied_version_id&&['foreign_series','internal_audience'].includes(row.denied_version_kind as string));
 const expected_guest_summary=feedbackSummaryDto(row.expected_guest_summary),producer_summary=feedbackSummaryDto(row.producer_summary);need(expected_guest_summary.version_id===version_id&&producer_summary.version_id===version_id&&producer_summary.per_slide.length===expected_guest_summary.per_slide.length);
 for(let index=0;index<expected_guest_summary.per_slide.length;index++){const guest=expected_guest_summary.per_slide[index],producer=producer_summary.per_slide[index];need(guest.version_slide_id===producer.version_slide_id&&guest.comment_count<=producer.comment_count&&guest.unresolved_count<=producer.unresolved_count&&guest.preferred===producer.preferred&&guest.maybe===producer.maybe&&guest.not_preferred===producer.not_preferred);}
 return{schema_version:'1.0',review_link_id:uuid(row.review_link_id),series_id:uuid(row.series_id),version_id,denied_version_id,denied_version_kind:row.denied_version_kind as ProbeInput['denied_version_kind'],link_expires_at:timestamp(row.link_expires_at),review_token:token(row.review_token),expected_guest_summary,producer_summary};
}
export function parseProbeInput(value:unknown):ProbeInput{try{return parse(value);}catch{throw new GuestDeltaError('GUEST_DELTA_INPUT_INVALID');}}
export function parsePrivateSession(value:unknown):PrivateSession{try{const row=closed(value,['schema_version','review_link_id','series_id','version_id','review_token','session_token','session_expires_at','link_expires_at','opened_at','summary_sha256']);need(row.schema_version==='1.0'&&typeof row.summary_sha256==='string'&&SHA.test(row.summary_sha256));return{schema_version:'1.0',review_link_id:uuid(row.review_link_id),series_id:uuid(row.series_id),version_id:uuid(row.version_id),review_token:token(row.review_token),session_token:token(row.session_token),session_expires_at:timestamp(row.session_expires_at),link_expires_at:timestamp(row.link_expires_at),opened_at:timestamp(row.opened_at),summary_sha256:row.summary_sha256};}catch{throw new GuestDeltaError('GUEST_DELTA_SESSION_INVALID');}}
export function validateGuestDenial(value:unknown,reason:'expired'|'revoked',now:number){
 const session=parsePrivateSession(value);need(reason==='expired'||reason==='revoked');need(now>=Date.parse(session.opened_at)&&now-Date.parse(session.opened_at)<=3600000,'GUEST_DELTA_SESSION_TOO_OLD');
 if(reason==='expired')need(now>=Date.parse(session.link_expires_at),'GUEST_DELTA_EXPIRY_NOT_REACHED');else need(now<Math.min(Date.parse(session.link_expires_at),Date.parse(session.session_expires_at)),'GUEST_DELTA_LIFECYCLE_AMBIGUOUS');return session;
}
function http(ports:Ports){
 const fetcher=ports.fetch??fetch;
 return async(pathname:string,method:'GET'|'POST'='GET',credential?:{header:'x-review-token'|'x-review-session';value:string})=>{
  need(pathname.startsWith('/api/v1/review/'));const response=await fetcher(ORIGIN+pathname,{method,credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',Origin:ORIGIN,...(credential?{[credential.header]:token(credential.value)}:{})}});
  need(response.status<300||response.status>=400);need(!response.redirected&&!response.headers.has('set-cookie')&&/\bno-store\b/iu.test(response.headers.get('cache-control')??'')&&response.headers.get('x-content-type-options')==='nosniff'&&response.headers.get('referrer-policy')==='no-referrer');
  need(/application\/json/iu.test(response.headers.get('content-type')??''));const body=response.body;need(body);const reader=body.getReader();let size=0;const parts:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;need(size<=65536);parts.push(part.value);}}finally{await reader.cancel().catch(()=>{});}
  let envelope:Record<string,unknown>;try{envelope=closed(await readPrivateInput((async function*(){for(const bytes of parts)yield bytes;})()),response.ok?['request_id','data']:['request_id','error']);}finally{for(const part of parts)part.fill(0);}
  uuid(envelope.request_id);return{status:response.status,envelope,request_id:envelope.request_id as string};
 };
}
type HttpResult=Awaited<ReturnType<ReturnType<typeof http>>>;
function requireDenial(value:HttpResult,statuses=[401,403,404],codes=DENIALS){need(statuses.includes(value.status));const error=closed(value.envelope.error,['code','message','details','retryable']);need(typeof error.code==='string'&&codes.has(error.code));return{status:value.status,code:error.code,request_id:value.request_id};}
export async function probeGuestSummary(value:unknown,ports:Ports={}){
 try{
  const input=parseProbeInput(value),now=(ports.now??Date.now)();need(now<Date.parse(input.link_expires_at),'GUEST_DELTA_LINK_ALREADY_EXPIRED');const request=http(ports),pathname=`/api/v1/review/versions/${input.version_id}/feedback/summary`;
  const missing=requireDenial(await request(pathname),[401]);
  const opened=await request('/api/v1/review/open','POST',{header:'x-review-token',value:input.review_token});need(opened.status===200);const openedRow=closed(opened.envelope.data,['access_token','expires_at','series_id','version_id','download_enabled','display_name','guest_session_id']);const access=guestAccessDto(Object.fromEntries(Object.entries(openedRow).filter(([key])=>key!=='access_token')),token(openedRow.access_token));
  need(access.version_id===input.version_id&&access.series_id===input.series_id&&Date.parse(access.expires_at)>now);const auth={header:'x-review-session' as const,value:access.access_token};
  const first=await request(pathname,'GET',auth);need(first.status===200);const summary=feedbackSummaryDto(first.envelope.data);need(same(summary,input.expected_guest_summary),'GUEST_DELTA_SUMMARY_MISMATCH');
  const reload=await request(pathname,'GET',auth);need(reload.status===200&&same(feedbackSummaryDto(reload.envelope.data),summary),'GUEST_DELTA_RELOAD_MISMATCH');
  const foreign=requireDenial(await request(`/api/v1/review/versions/${input.denied_version_id}/feedback/summary`,'GET',auth));
  const unsupported=requireDenial(await request(pathname+'?limit=1','GET',auth),[400],new Set(['INVALID_REQUEST']));
  const summary_sha256=sha(JSON.stringify(summary));
  return{evidence:{schema_version:'1.0',result:'passed',scope:'actual_anonymous_guest_HTTP_when_real_fetch_is_used',origin:ORIGIN,review_link_id:input.review_link_id,link_identity_source:'owner_supplied_create_review_link_result',version_id:input.version_id,series_id:input.series_id,observed_at:new Date(now).toISOString(),summary,summary_sha256,exact_saved_version_verified:true,reload_verified:true,missing_session:missing,other_scope_denial:{...foreign,version_id:input.denied_version_id,kind:input.denied_version_kind,scope_identity_source:'owner_selected_existing_version'},unsupported_query:unsupported,nonzero_external_counts:Object.values(summary.totals).some(count=>count>0),internal_count_filtering_verified:input.producer_summary.totals.comment_count>summary.totals.comment_count,producer_snapshot_source:'owner_supplied_MCP_or_API_snapshot',producer_summary_sha256:sha(JSON.stringify(input.producer_summary)),anonymous_cookies_or_authorization_sent:false,feedback_mutated:false,review_links_mutated:false,automatic_retry:false,requests:6},privateSession:{schema_version:'1.0',review_link_id:input.review_link_id,series_id:input.series_id,version_id:input.version_id,review_token:input.review_token,session_token:access.access_token,session_expires_at:access.expires_at,link_expires_at:input.link_expires_at,opened_at:new Date(now).toISOString(),summary_sha256} satisfies PrivateSession};
 }catch(error){if(error instanceof GuestDeltaError)throw error;throw new GuestDeltaError();}
}
export async function verifyGuestDenial(value:unknown,reason:'expired'|'revoked',ports:Ports={}){
 try{
  const now=(ports.now??Date.now)(),session=validateGuestDenial(value,reason,now);
  const request=http(ports),summary=requireDenial(await request(`/api/v1/review/versions/${session.version_id}/feedback/summary`,'GET',{header:'x-review-session',value:session.session_token}));
  const reopen=requireDenial(await request('/api/v1/review/open','POST',{header:'x-review-token',value:session.review_token}));
  return{schema_version:'1.0',result:'passed',scope:'actual_anonymous_guest_HTTP_denial_when_real_fetch_is_used',origin:ORIGIN,review_link_id:session.review_link_id,version_id:session.version_id,observed_at:new Date(now).toISOString(),expected_owner_action:reason,known_link_deadline_elapsed:now>=Date.parse(session.link_expires_at),producer_lifecycle_change_independently_verified:false,old_session_denied:summary,original_link_open_denied:reopen,summary_sha256:session.summary_sha256,automatic_retry:false,requests:2};
 }catch(error){if(error instanceof GuestDeltaError)throw error;throw new GuestDeltaError();}
}
