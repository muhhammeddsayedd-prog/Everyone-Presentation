import type { SupabaseClient } from '@supabase/supabase-js';
import {DomainError,type UploadSession} from '@eps/domain';
export const TUS_CHUNK_BYTES=6*1024*1024 as 6291456;
function invalid():never{throw new DomainError('CENTRAL_RESPONSE_INVALID','The scoped upload instructions could not be verified.',503);}
/** Supabase signed TUS is a separate /sign route. No acting JWT is returned. */
export async function candidateTusSession(input:{id:string;assetId:string;bucket:string;objectKey:string;mime:string;expiresAt:string;status:UploadSession['status'];maximum:number;enabled:boolean},options:{client:SupabaseClient;storageOrigin:string;now?:()=>number}):Promise<UploadSession>{
 const now=options.now??Date.now;const origin=new URL(options.storageOrigin);let direct=origin.origin;
 if(origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)invalid();
 if(origin.hostname.endsWith('.supabase.co')&&!origin.hostname.endsWith('.storage.supabase.co'))direct=`${origin.protocol}//${origin.hostname.slice(0,-'.supabase.co'.length)}.storage.supabase.co`;
 const status=input.status==='open'&&Date.parse(input.expiresAt)<=now()?'expired':input.status;
 let url:string|null=null;let expires=Date.parse(input.expiresAt);const headers:Record<string,string>={};
 if(status==='open'&&input.enabled){
  const started=now();const result=await options.client.storage.from(input.bucket).setHeader('x-upsert','false').createSignedUploadUrl(input.objectKey,{upsert:false});
  if(result.error||!result.data)throw new DomainError('DEPENDENCY_UNAVAILABLE','Private upload authorization is temporarily unavailable.',503,{},true);
  let signed:URL;try{signed=new URL(result.data.signedUrl);}catch{return invalid();}
  const wanted=`/storage/v1/object/upload/sign/${encodeURIComponent(input.bucket)}/${input.objectKey.split('/').map(encodeURIComponent).join('/')}`;
  const token=result.data.token;
  if(signed.origin!==origin.origin||signed.pathname!==wanted||signed.username||signed.password||signed.hash||[...signed.searchParams.keys()].some(k=>k!=='token')||signed.searchParams.getAll('token').length!==1||signed.searchParams.get('token')!==token||result.data.path!==input.objectKey
   ||typeof token!=='string'||token.length<1||token.length>8192||/[\s\p{C}]/u.test(token))invalid();
  url=`${direct}/storage/v1/upload/resumable/sign`;headers['x-signature']=token;headers['x-upsert']='false';expires=Math.min(expires,started+2*60*60*1000);
 }
 return{id:input.id,asset_id:input.assetId,protocol:'tus',upload_url:url,upload_headers:headers,expires_at:new Date(expires).toISOString(),status,maximum_bytes:input.maximum,
  upload_metadata:{bucketName:input.bucket,objectName:input.objectKey,contentType:input.mime,cacheControl:'3600'},chunk_size:TUS_CHUNK_BYTES};
}
