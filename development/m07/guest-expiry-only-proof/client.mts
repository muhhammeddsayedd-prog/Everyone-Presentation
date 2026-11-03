/** Two explicit anonymous expiry phases. Importing performs no IO or HTTP. */
import {setTimeout as delay}from 'node:timers/promises';
import {externalVersionDto,guestAccessDto,guestFeedbackDto,presentationExportDto,exportPreparationDto}from '../../../packages/domain/src/guest.ts';
import {feedbackSummaryDto}from '../../../packages/domain/src/feedback-summary.ts';
import {readGuestPdfResponse}from '../../../apps/web/components/guest-pdf-transfer.ts';
import {readPrivateInput}from '../../../tools/client-upload-transfer.mts';
import {closed,need,ORIGIN,sha,timestamp,token,uuid}from '../guest-summary-delta/probe.mts';

export const LIVE_HTTP_ENABLED=false;
export const SERIES='0b26d206-645a-4c9c-bbee-7307265ac68c',VERSION='1b20ec2d-f133-4912-8efe-df2e21a3865e';
export interface Input{schema_version:'1.0';run_id:string;review_link_id:string;review_url:string;expires_at:string;no_revoke_before_expiry_probes:true}
export interface State{input:Input;session_token:string;session_id:string;session_expires_at:string;export_id:string;job_id:string;video_asset_id:string;pdf_url:string;media_url:string;before_completed_at:string}
export interface Ports{fetch?:typeof fetch;now?:()=>number;sleep?:(ms:number)=>Promise<unknown>;save:(name:string,value:unknown)=>Promise<void>;saveBytes:(name:string,value:Uint8Array)=>Promise<void>}
export class ExpiryError extends Error{constructor(){super('GUEST_EXPIRY_PROOF_UNCONFIRMED');this.name='ExpiryError';}}
export const exportKey=(run:string)=>'guest-expiry-export:'+uuid(run);
const deniedCodes=new Set(['REVIEW_ACCESS_DENIED','REVIEW_LINK_EXPIRED','REVIEW_UNAVAILABLE','RESOURCE_NOT_FOUND','ACCESS_DENIED']);
const current='/api/v1/review/presentation',versionPath='/api/v1/review/versions/'+VERSION,feedbackPath=versionPath+'/feedback?limit=100',summaryPath=versionPath+'/feedback/summary';
const now=(p:Ports)=>(p.now??Date.now)();
function allowed(p:Ports){need(LIVE_HTTP_ENABLED||typeof p.fetch==='function');}
export function parseInput(value:unknown):Input{
 const r=closed(value,['schema_version','run_id','review_link_id','review_url','expires_at','no_revoke_before_expiry_probes']);
 need(r.schema_version==='1.0'&&r.no_revoke_before_expiry_probes===true);uuid(r.run_id);uuid(r.review_link_id);timestamp(r.expires_at);
 need(typeof r.review_url==='string');const u=new URL(r.review_url);need(u.origin===ORIGIN&&!u.username&&!u.password&&!u.search&&!u.hash&&/^\/r\/[A-Za-z0-9_-]{43}$/u.test(u.pathname));token(u.pathname.slice(3));
 return structuredClone(r)as unknown as Input;
}
function contentPath(kind:'pdf'|'media',id:string){return kind==='pdf'?'/api/v1/review/pdf-exports/'+uuid(id)+'/content':versionPath+'/media/'+uuid(id)+'/content';}
function savedUrl(kind:'pdf'|'media',id:string,session:string){return ORIGIN+contentPath(kind,id)+'?review_context='+uuid(session);}
export function parseState(value:unknown):State{
 const r=closed(value,['input','session_token','session_id','session_expires_at','export_id','job_id','video_asset_id','pdf_url','media_url','before_completed_at']);
 const input=parseInput(r.input);token(r.session_token);uuid(r.session_id);uuid(r.export_id);uuid(r.job_id);uuid(r.video_asset_id);timestamp(r.session_expires_at);timestamp(r.before_completed_at);
 need(r.pdf_url===savedUrl('pdf',r.export_id as string,r.session_id as string)&&r.media_url===savedUrl('media',r.video_asset_id as string,r.session_id as string));
 need(Date.parse(r.session_expires_at as string)===Date.parse(input.expires_at)&&Date.parse(r.before_completed_at as string)<Date.parse(input.expires_at));
 return structuredClone(r)as unknown as State;
}
function transport(p:Ports){
 const fetcher=p.fetch??fetch;let count=0;
 async function send(path:string,method:'GET'|'POST',credential?:{kind:'token'|'session';value:string},binary=false,key?:string){
  need(path.startsWith('/api/v1/review/')||/^\/r\/[A-Za-z0-9_-]{43}$/u.test(path));
  const response=await fetcher(ORIGIN+path,{method,credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(binary?120000:15000),
   headers:{Accept:binary?'*/*':'application/json',Origin:ORIGIN,...(credential?{[credential.kind==='token'?'X-Review-Token':'X-Review-Session']:token(credential.value)}:{}),...(key?{'Idempotency-Key':key}:{}),...(binary&&path.includes('/media/')?{Range:'bytes=0-1023'}:{})}});
  count++;need(!response.redirected&&!(response.status>=300&&response.status<400)&&!response.headers.has('set-cookie'));
  return response;
 }
 async function json(path:string,method:'GET'|'POST'='GET',credential?:{kind:'token'|'session';value:string},key?:string){
  const response=await send(path,method,credential,false,key);
  need(/application\/json/iu.test(response.headers.get('content-type')??'')&&/\bno-store\b/iu.test(response.headers.get('cache-control')??'')&&response.headers.get('referrer-policy')==='no-referrer'&&response.headers.get('x-content-type-options')==='nosniff');
  need(response.body);const reader=response.body.getReader(),parts:Uint8Array[]=[];let bytes=0;
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;need(bytes<=65536);parts.push(part.value);}}
  finally{await reader.cancel().catch(()=>{});}
  let envelope:Record<string,unknown>;
  try{const raw=new Uint8Array(bytes);let at=0;for(const part of parts){raw.set(part,at);at+=part.length;}
   try{await p.saveBytes('response-'+String(count).padStart(3,'0')+'.bin',raw);}finally{raw.fill(0);}
   envelope=closed(await readPrivateInput((async function*(){yield*parts;})()),response.ok?['request_id','data']:['request_id','error']);}
  finally{for(const part of parts)part.fill(0);}
  await p.save('response-'+String(count).padStart(3,'0')+'.json',{http_status:response.status,envelope});
  return{status:response.status,request_id:uuid(envelope.request_id),data:envelope.data,error:envelope.error};
 }
 async function shell(input:Input){
  const response=await send(new URL(input.review_url).pathname,'GET');need(response.status===200&&response.body&&/text\/html/iu.test(response.headers.get('content-type')??''));
  const reader=response.body.getReader();let bytes=0;const parts:Uint8Array[]=[];
  try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;need(bytes<=1024*1024);parts.push(part.value);}}
  finally{await reader.cancel().catch(()=>{});for(const part of parts)part.fill(0);}
  return{status:response.status,bytes,public_shell_only:true,guest_authorization_proven:false};
 }
 return{send,json,shell,count:()=>count};
}
type Http=ReturnType<typeof transport>;
function denial(r:Awaited<ReturnType<Http['json']>>){need([401,403,404].includes(r.status));const e=closed(r.error,['code','message','details','retryable']);need(typeof e.code==='string'&&deniedCodes.has(e.code));return{status:r.status,code:e.code,request_id:r.request_id};}
async function binary(h:Http,p:Ports,path:string,session:string,kind:'pdf'|'media'){
 const response=await h.send(path,'GET',{kind:'session',value:session},true);
 need(/\bno-store\b/iu.test(response.headers.get('cache-control')??'')&&response.headers.get('referrer-policy')==='no-referrer');
 if(kind==='pdf'){
  const blob=await readGuestPdfResponse(response),bytes=new Uint8Array(await blob.arrayBuffer());
  try{await p.saveBytes('guest.pdf',bytes);return{status:200,bytes:bytes.length,sha256:sha(bytes),full_pdf_bytes_verified:true};}finally{bytes.fill(0);}
 }
 need(response.status===206&&response.body&&/^video\/(?:mp4|quicktime|webm|x-matroska)$/u.test(response.headers.get('content-type')?.split(';')[0]??''));
 const m=/^bytes 0-(\d+)\/(\d+)$/u.exec(response.headers.get('content-range')??'');need(m);const end=Number(m[1]),total=Number(m[2]);need(Number.isSafeInteger(total)&&total>0&&end===Math.min(1023,total-1)&&response.headers.get('content-length')===String(end+1));
 const reader=response.body.getReader(),bytes=new Uint8Array(end+1);let length=0;
 try{for(;;){const part=await reader.read();if(part.done)break;need(length+part.value.byteLength<=bytes.length);bytes.set(part.value,length);length+=part.value.byteLength;}}
 finally{await reader.cancel().catch(()=>{});}
 need(length===end+1);
 try{await p.saveBytes('original-video-prefix.bin',bytes);return{status:206,bytes:bytes.length,total_bytes:total,sha256:sha(bytes),range:'bytes=0-1023',full_original_file_hash_verified:false};}finally{bytes.fill(0);}
}
export async function beforeExpiry(value:unknown,p:Ports){
 try{
  allowed(p);const input=parseInput(value),deadline=Date.parse(input.expires_at);need(now(p)<deadline&&deadline-now(p)<=3600000);
  const h=transport(p),page=await h.shell(input),opened=await h.json('/api/v1/review/open','POST',{kind:'token',value:new URL(input.review_url).pathname.slice(3)});need(opened.status===200);
  const accessRow=closed(opened.data,['access_token','expires_at','series_id','version_id','download_enabled','display_name','guest_session_id']);const{access_token,...accessValue}=accessRow;
  const access=guestAccessDto(accessValue,token(access_token));need(access.series_id===SERIES&&access.version_id===VERSION&&access.download_enabled&&Date.parse(access.expires_at)===deadline);
  const auth={kind:'session' as const,value:access.access_token};
  await p.save('opened-state.json',{input,session_token:access.access_token,session_id:access.guest_session_id,session_expires_at:access.expires_at,export_idempotency_key:exportKey(input.run_id)});
  const session=await h.json('/api/v1/review/session','GET',auth);need(session.status===200);
  const live=guestAccessDto(session.data,access.access_token);need(live.guest_session_id===access.guest_session_id&&live.version_id===VERSION&&live.series_id===SERIES&&live.expires_at===access.expires_at);
  const manifest=await h.json(current,'GET',auth),fixed=await h.json(versionPath,'GET',auth);need(manifest.status===200&&fixed.status===200);
  const v=externalVersionDto(manifest.data),v2=externalVersionDto(fixed.data);need(v.id===VERSION&&v.series_id===SERIES&&v.version_no===2&&JSON.stringify(v)===JSON.stringify(v2));
  const video=uuid(v.slides.find(s=>s.video_asset_id)?.video_asset_id),summaryResponse=await h.json(summaryPath,'GET',auth);need(summaryResponse.status===200);
  const summary=feedbackSummaryDto(summaryResponse.data);need(summary.version_id===VERSION);
  const feedback=await h.json(feedbackPath,'GET',auth);need(feedback.status===200);const first=guestFeedbackDto(feedback.data,true);need(first.version_id===VERSION);
  // One explicit normal mutation; an unknown result is never repeated here.
  need(now(p)<deadline);await p.save('export-dispatched.json',{run_id:input.run_id,key:exportKey(input.run_id),automatic_retry:false});
  const preparedResponse=await h.json(versionPath+'/pdf-exports','POST',auth,exportKey(input.run_id));need([200,202].includes(preparedResponse.status));
  const prepared=exportPreparationDto(preparedResponse.data);let exported=prepared.export;need(exported.version_id===VERSION&&exported.review_link_id===input.review_link_id);
  const identity={id:exported.id,job_id:exported.job_id},pollDeadline=Math.min(deadline,now(p)+180000);let polls=0;
  for(;exported.status!=='ready'&&polls<60;polls++){
   need(exported.status!=='failed'&&now(p)<pollDeadline);await(p.sleep??delay)(2000);
   const r=await h.json('/api/v1/review/pdf-exports/'+identity.id,'GET',auth);need(r.status===200&&now(p)<pollDeadline);exported=presentationExportDto(r.data);
   need(exported.id===identity.id&&exported.job_id===identity.job_id&&exported.version_id===VERSION&&exported.review_link_id===input.review_link_id);
  }
  need(exported.status==='ready'&&now(p)<deadline);
  const pdf_url=savedUrl('pdf',identity.id,access.guest_session_id),media_url=savedUrl('media',video,access.guest_session_id);
  const pdf=await binary(h,p,new URL(pdf_url).pathname+new URL(pdf_url).search,access.access_token,'pdf');
  const media=await binary(h,p,new URL(media_url).pathname+new URL(media_url).search,access.access_token,'media');need(now(p)<deadline);
  const state=parseState({input,session_token:access.access_token,session_id:access.guest_session_id,session_expires_at:access.expires_at,export_id:identity.id,job_id:identity.job_id,video_asset_id:video,pdf_url,media_url,before_completed_at:new Date(now(p)).toISOString()});
  await p.save('before-state.json',state);
  return{state,evidence:{result:'passed',phase:'before_expiry',run_id:input.run_id,review_link_id:input.review_link_id,series_id:SERIES,version_id:VERSION,guest_session_id:access.guest_session_id,export_id:identity.id,job_id:identity.job_id,observed_at:state.before_completed_at,expires_at:input.expires_at,page,manifest_sha256:sha(JSON.stringify(v)),manifest_slides:v.slides.length,feedback_summary:summary.totals,feedback_first_page_comments:first.comments.length,feedback_first_page_preferences:first.preferences.length,feedback_all_pages_claimed:first.page.next_cursor===null,export_prepare_posts:1,cached_export:prepared.cached,new_export_job_requested:!prepared.cached,polls,pdf,original_media:media,request_ids:{open:opened.request_id,session:session.request_id,manifest:manifest.request_id,fixed_version:fixed.request_id,summary:summaryResponse.request_id,feedback:feedback.request_id,prepare:preparedResponse.request_id},requests:h.count(),cookies_or_Authorization_sent:false,feedback_or_preferences_mutated:false,generate_version_called:false,automatic_retry:false,injected_fetch_used:typeof p.fetch==='function'}};
 }catch{throw new ExpiryError();}
}
export async function afterExpiry(value:unknown,p:Ports){
 try{
  allowed(p);const state=parseState(value),deadline=Date.parse(state.input.expires_at);need(now(p)>=deadline+2000&&now(p)-deadline<=3600000);
  const h=transport(p),auth={kind:'session' as const,value:state.session_token},page=await h.shell(state.input),results:Record<string,unknown>={};
  for(const[name,path]of Object.entries({session:'/api/v1/review/session',current_manifest:current,fixed_manifest:versionPath,feedback:feedbackPath,summary:summaryPath,export_status:'/api/v1/review/pdf-exports/'+state.export_id,old_pdf_url:new URL(state.pdf_url).pathname+new URL(state.pdf_url).search,old_media_url:new URL(state.media_url).pathname+new URL(state.media_url).search,fresh_pdf_path:contentPath('pdf',state.export_id),fresh_media_path:contentPath('media',state.video_asset_id)}))results[name]=denial(await h.json(path,'GET',auth));
  results.fresh_link_open=denial(await h.json('/api/v1/review/open','POST',{kind:'token',value:new URL(state.input.review_url).pathname.slice(3)}));
  return{result:'passed',phase:'after_expiry',run_id:state.input.run_id,review_link_id:state.input.review_link_id,series_id:SERIES,version_id:VERSION,observed_at:new Date(now(p)).toISOString(),known_deadline:state.input.expires_at,deadline_elapsed:true,Root_no_revoke_before_expiry_precondition:state.input.no_revoke_before_expiry_probes,revocation_independently_checked:false,page,denials:results,requests:h.count(),fresh_paths_are_reconstructed_not_newly_issued_capabilities:true,browser_visible_unavailable_UI_verified:false,cookies_or_Authorization_sent:false,feedback_mutated:false,export_or_generation_posted:false,automatic_retry:false};
 }catch{throw new ExpiryError();}
}
