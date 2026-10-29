import type { MediaAsset } from '@eps/domain';
import type { SpecsAssetCall,SpecsAssetScope,SpecsRuntimeAssetConfig } from './specs-runtime-assets.ts';
import { SpecsRuntimeGatewayError } from './specs-runtime-gateway.ts';
export interface CandidateOutputInput extends SpecsAssetScope {
 output_key:string;asset_kind:'audio'|'transcript'|'candidate_frame';filename:string;mime_type:string;expected_size_bytes:number;parent_asset_id:string;time_offset_ms:number|null;
}
export interface CandidateCompleteInput extends SpecsAssetScope { asset_id:string;sha256:string;actual_size_bytes:number;width:number|null;height:number|null;duration_ms:number|null }
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const HASH=/^[a-f0-9]{64}$/u;
const ORIGIN='https://pyibofyctwnqpvktepse.supabase.co';
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>object(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const id=(v:unknown):v is string=>typeof v==='string'&&UUID.test(v);
const size=(v:unknown,max=268435456):v is number=>Number.isSafeInteger(v)&&(v as number)>0&&(v as number)<=max;
function fail(code='INVALID_REQUEST'):never{throw new SpecsRuntimeGatewayError(code,code==='INVALID_REQUEST'?400:503,'known');}
function scope(v:SpecsAssetScope){if(!object(v)||!id(v.job_id)||!id(v.attempt_id)||typeof v.lease_token!=='string'||!HASH.test(v.lease_token))fail();}
function extension(mime:unknown){return new Map<unknown,string>([['video/mp4','mp4'],['video/quicktime','mov'],['video/webm','webm'],['video/x-matroska','mkv'],['audio/mpeg','mp3'],['application/json','json'],['image/jpeg','jpg']]).get(mime);}
function destination(bucket:unknown,key:unknown,assetId:string,input:SpecsAssetScope,mime:unknown){
 const ext=extension(mime);if(!ext||bucket==='eps-candidate-assets'&&!['mp4','mov','webm','mkv'].includes(ext)
  ||bucket==='eps-candidate-outputs'&&!['mp3','json','jpg'].includes(ext)
  ||bucket!=='eps-candidate-assets'&&bucket!=='eps-candidate-outputs'
  ||key!==(bucket==='eps-candidate-assets'?`assets/${assetId}/original.${ext}`:`jobs/${input.job_id}/attempts/${input.attempt_id}/${assetId}.${ext}`)){
  // Prior successful derivative reads have a different producing attempt. They
  // are still fixed to the same job, exact UUID filename and candidate prefix.
  if(bucket!=='eps-candidate-outputs'||!['mp3','json','jpg'].includes(ext??'')||typeof key!=='string'
   ||!new RegExp(`^jobs/${input.job_id}/attempts/[a-f0-9-]{36}/${assetId}\\.${ext}$`,'u').test(key))fail('RUNTIME_RESPONSE_INVALID');
 }
 return key as string;
}
function asset(v:unknown):MediaAsset{
 if(!exact(v,['id','purpose','filename','mime_type','size_bytes','sha256','status','duration_ms','width','height','source_asset_id','source_timestamp_ms','created_at'])
  ||!id(v.id)||!['audio','transcript','candidate_frame'].includes(String(v.purpose))||typeof v.filename!=='string'||!size(v.size_bytes,20971520)
  ||!['uploading','ready'].includes(String(v.status))||!id(v.source_asset_id)||typeof v.created_at!=='string'||!Number.isFinite(Date.parse(v.created_at))
  ||v.status==='ready'&&(typeof v.sha256!=='string'||!HASH.test(v.sha256))||v.status==='uploading'&&v.sha256!==null
  ||v.purpose==='audio'&&(v.mime_type!=='audio/mpeg'||v.width!==null||v.height!==null||v.source_timestamp_ms!==null)
  ||v.purpose==='transcript'&&(v.mime_type!=='application/json'||v.width!==null||v.height!==null||v.duration_ms!==null||v.source_timestamp_ms!==null||!size(v.size_bytes,2097152))
  ||v.purpose==='candidate_frame'&&(v.mime_type!=='image/jpeg'||v.duration_ms!==null||!Number.isSafeInteger(v.source_timestamp_ms)||(v.source_timestamp_ms as number)<0
    ||v.status==='ready'&&(!size(v.width,4096)||!size(v.height,4096))))fail('RUNTIME_RESPONSE_INVALID');
 return structuredClone(v) as unknown as MediaAsset;
}
export function createCandidateRuntimeAssets(config:SpecsRuntimeAssetConfig,call:SpecsAssetCall){
 if(!exact(config,['storageOrigin','publishableKey'])||config.storageOrigin!==ORIGIN||!/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(config.publishableKey))fail('RUNTIME_CONFIG_INVALID');
 async function getAssetAccess(input:SpecsAssetScope&{asset_id:string;access?:'read'|'write'},signal:AbortSignal){
  scope(input);if(!object(input)||Object.keys(input).some(k=>!['job_id','attempt_id','lease_token','asset_id','access'].includes(k))||!id(input.asset_id)||input.access!==undefined&&!['read','write'].includes(input.access))fail();
  const permission=input.access??'read';const v=await call('access',{...input},signal);
  if(!exact(v,['asset_id','bucket','object_key','permission','grant_token','expires_at','mime_type','size_bytes','sha256'])||v.asset_id!==input.asset_id||v.permission!==permission
   ||typeof v.grant_token!=='string'||!/^[A-Za-z0-9_-]{43}$/u.test(v.grant_token)||typeof v.expires_at!=='string'||!Number.isFinite(Date.parse(v.expires_at))||Date.parse(v.expires_at)<=Date.now()||Date.parse(v.expires_at)>Date.now()+90000
   ||!size(v.size_bytes)||!(v.sha256===null||typeof v.sha256==='string'&&HASH.test(v.sha256))
   ||v.bucket==='eps-candidate-outputs'&&!size(v.size_bytes,20971520)
   ||permission==='write'&&(v.bucket!=='eps-candidate-outputs'||v.sha256!==null))fail('RUNTIME_RESPONSE_INVALID');
  const key=destination(v.bucket,v.object_key,input.asset_id,input,v.mime_type);const method=permission==='read'?'GET' as const:'POST' as const;
  return {asset_id:input.asset_id,url:`${ORIGIN}/storage/v1/object/${method==='GET'?'authenticated/':''}${v.bucket}/${key}`,method,
   headers:{apikey:config.publishableKey,Authorization:`Bearer ${config.publishableKey}`,'x-eps-asset-grant':v.grant_token,
    ...(method==='POST'?{'Content-Type':v.mime_type as string,'x-upsert':'false'}:{})},expires_at:v.expires_at,mime_type:v.mime_type as string,size_bytes:v.size_bytes,sha256:v.sha256 as string|null};
 }
 return {getAssetAccess,
  async reserveOutput(input:CandidateOutputInput,signal:AbortSignal){
   scope(input);if(!exact(input,['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms'])
    ||!['audio','transcript','candidate_frame'].includes(input.asset_kind)||!id(input.parent_asset_id)||!size(input.expected_size_bytes,20971520))fail();
   const value=await call('reserve',{...input},signal);if(!exact(value,['asset','bucket','object_key']))fail('RUNTIME_RESPONSE_INVALID');const saved=asset(value.asset);
   if(saved.purpose!==input.asset_kind||saved.size_bytes!==input.expected_size_bytes||saved.source_asset_id!==input.parent_asset_id||saved.filename!==input.filename||saved.mime_type!==input.mime_type)fail('RUNTIME_RESPONSE_INVALID');
   destination(value.bucket,value.object_key,saved.id,input,input.mime_type);
   return {asset:saved,access:await getAssetAccess({...scopeFields(input),asset_id:saved.id,access:saved.status==='ready'?'read':'write'},signal)};
  },
  async completeOutput(input:CandidateCompleteInput,signal:AbortSignal){scope(input);
   if(!exact(input,['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms'])||!id(input.asset_id)||!HASH.test(input.sha256)||!size(input.actual_size_bytes,20971520))fail();
   const saved=asset(await call('complete',{...input},signal));if(saved.id!==input.asset_id||saved.status!=='ready'||saved.sha256!==input.sha256||saved.size_bytes!==input.actual_size_bytes||saved.width!==input.width||saved.height!==input.height||saved.duration_ms!==input.duration_ms)fail('RUNTIME_RESPONSE_INVALID');return saved;
  },
 };
}
function scopeFields(input:SpecsAssetScope):SpecsAssetScope{return {job_id:input.job_id,attempt_id:input.attempt_id,lease_token:input.lease_token};}
