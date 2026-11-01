/** Client-local byte transfer only. Importing reads no files, input or credentials. */
import {createHash} from 'node:crypto';
import {openAsBlob,fstatSync,writeSync,type BigIntStats} from 'node:fs';
import {lstat,open,realpath,type FileHandle} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import type {UploadSession} from '../packages/domain/src/types.ts';
import {transferTus,TusTransferError} from '../apps/web/lib/resumable-transfer.ts';

export const API_ORIGIN='https://pyibofyctwnqpvktepse.supabase.co';
export const STORAGE_ORIGIN='https://pyibofyctwnqpvktepse.storage.supabase.co';
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
const PREFIX='/storage/v1/upload/resumable/sign/';
type Purpose='client_logo'|'specs'|'candidate_video'|'candidate_support';
type Code='CLIENT_UPLOAD_INPUT_INVALID'|'CLIENT_UPLOAD_SCOPE_INVALID'|'CLIENT_UPLOAD_FILE_UNAVAILABLE'|'CLIENT_UPLOAD_FILE_CHANGED'|'CLIENT_UPLOAD_HASH_MISMATCH'|'CLIENT_UPLOAD_PROTOCOL_INVALID'|'CLIENT_UPLOAD_INTERRUPTED'|'CLIENT_UPLOAD_EXPIRED'|'CLIENT_UPLOAD_ACCESS_DENIED'|'CLIENT_UPLOAD_CONFLICT'|'CLIENT_UPLOAD_PAUSED'|'CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE';
export class ClientUploadError extends Error{constructor(readonly code:Code){super(code);this.name='ClientUploadError';}}
function fail(code:Code='CLIENT_UPLOAD_INPUT_INVALID'):never{throw new ClientUploadError(code);}
function need(value:unknown,code:Code='CLIENT_UPLOAD_INPUT_INVALID'):asserts value{if(!value)fail(code);}
type RecordValue=Record<string,unknown>;
function object(value:unknown):RecordValue{
 need(typeof value==='object'&&value!==null&&!Array.isArray(value));
 const proto=Object.getPrototypeOf(value);need(proto===Object.prototype||proto===null);
 const descriptors=Object.getOwnPropertyDescriptors(value);need(Reflect.ownKeys(value).length===Object.keys(descriptors).length);
 for(const item of Object.values(descriptors))need('value'in item&&item.enumerable);
 return value as RecordValue;
}
function keys(value:unknown,wanted:string[]):RecordValue{const row=object(value);need(Object.keys(row).sort().join(',')===[...wanted].sort().join(','));return row;}
function text(value:unknown,max=8192):value is string{return typeof value==='string'&&value.length>0&&value.length<=max&&!/[\p{C}]/u.test(value);}
const MIME:Record<Purpose,Record<string,{extension:string;local:string[]}>>={
 client_logo:{'image/png':{extension:'png',local:['png']},'image/jpeg':{extension:'jpg',local:['jpg','jpeg']},'image/webp':{extension:'webp',local:['webp']}},
 specs:{'application/pdf':{extension:'pdf',local:['pdf']},'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{extension:'docx',local:['docx']},'text/plain':{extension:'txt',local:['txt']}},
 candidate_video:{'video/mp4':{extension:'mp4',local:['mp4']},'video/quicktime':{extension:'mov',local:['mov']},'video/webm':{extension:'webm',local:['webm']},'video/x-matroska':{extension:'mkv',local:['mkv']}},
 candidate_support:{'image/png':{extension:'png',local:['png']},'image/jpeg':{extension:'jpg',local:['jpg','jpeg']},'image/webp':{extension:'webp',local:['webp']},'application/pdf':{extension:'pdf',local:['pdf']},'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{extension:'docx',local:['docx']},'text/plain':{extension:'txt',local:['txt']}}
};
const BUCKET:Record<Purpose,string>={client_logo:'eps-brand-assets',specs:'eps-specs-assets',candidate_video:'eps-candidate-assets',candidate_support:'eps-candidate-support'};
export interface ResumeCheckpoint{schema_version:'1.0';upload_id:string;asset_id:string;size_bytes:number;sha256:string;resource_id:string;offset:number}
export interface TransferInput{schema_version:'1.0';local_file_path:string;purpose:Purpose;mime_type:string;expected_upload_id:string;expected_asset_id:string;expected_size_bytes:number;expected_sha256:string;start_processing:boolean;session:UploadSession;resume:ResumeCheckpoint|null}
function resourceId(value:unknown,input:TransferInput):string{
 need(typeof value==='string'&&/^[A-Za-z0-9_-]{1,2048}$/u.test(value),'CLIENT_UPLOAD_SCOPE_INVALID');
 let decoded:string;try{decoded=new TextDecoder('utf8',{fatal:true}).decode(Buffer.from(value,'base64url'));}catch{return fail('CLIENT_UPLOAD_SCOPE_INVALID');}
 need(Buffer.from(decoded).toString('base64url')===value,'CLIENT_UPLOAD_SCOPE_INVALID');
 const prefix=`${BUCKET[input.purpose]}/assets/${input.expected_asset_id}/original.${MIME[input.purpose][input.mime_type].extension}`;
 const version=decoded.startsWith(prefix+'/')?decoded.slice(prefix.length+1):decoded.startsWith(prefix+'-$v-')?decoded.slice(prefix.length+4):'';
 need(UUID.test(version),'CLIENT_UPLOAD_SCOPE_INVALID');return value;
}
export function parseTransferInput(value:unknown):TransferInput{
 const row=keys(value,['schema_version','local_file_path','purpose','mime_type','expected_upload_id','expected_asset_id','expected_size_bytes','expected_sha256','start_processing','session','resume']);
 need(row.schema_version==='1.0'&&text(row.local_file_path,4096)&&path.isAbsolute(row.local_file_path)&&typeof row.purpose==='string'&&Object.hasOwn(MIME,row.purpose));
 const purpose=row.purpose as Purpose;need(typeof row.mime_type==='string'&&Object.hasOwn(MIME[purpose],row.mime_type));
 need(MIME[purpose][row.mime_type].local.includes(path.extname(row.local_file_path).slice(1).toLowerCase()));
 need(typeof row.expected_upload_id==='string'&&UUID.test(row.expected_upload_id)&&typeof row.expected_asset_id==='string'&&UUID.test(row.expected_asset_id)
  &&typeof row.expected_sha256==='string'&&SHA.test(row.expected_sha256)&&Number.isSafeInteger(row.expected_size_bytes)&&Number(row.expected_size_bytes)>0
  &&typeof row.start_processing==='boolean'&&row.start_processing===(purpose==='candidate_video'));
 const tus=purpose==='candidate_video'||purpose==='candidate_support';
 const session=keys(row.session,['id','asset_id','protocol','upload_url','upload_headers','expires_at','status','maximum_bytes',...(tus?['upload_metadata','chunk_size']:[])]);
 const ceiling=purpose==='client_logo'||purpose==='candidate_support'&&row.mime_type.startsWith('image/')?5242880:purpose==='candidate_video'?268435456:20971520;
 need(session.id===row.expected_upload_id&&session.asset_id===row.expected_asset_id&&session.protocol===(tus?'tus':'signed_put')&&session.status==='open'
  &&typeof session.maximum_bytes==='number'&&Number.isSafeInteger(session.maximum_bytes)&&session.maximum_bytes>0&&session.maximum_bytes<=ceiling&&Number(row.expected_size_bytes)<=session.maximum_bytes);
 need(text(session.expires_at,64)&&Number.isFinite(Date.parse(session.expires_at))&&Date.parse(session.expires_at)>Date.now(),'CLIENT_UPLOAD_EXPIRED');
 need(text(session.upload_url,16384));let target:URL;try{target=new URL(session.upload_url);}catch{return fail('CLIENT_UPLOAD_SCOPE_INVALID');}
 need(!target.username&&!target.password&&!target.hash&&target.protocol==='https:','CLIENT_UPLOAD_SCOPE_INVALID');
 const objectName=`assets/${row.expected_asset_id}/original.${MIME[purpose][row.mime_type].extension}`;
 if(tus){
  need(target.origin===STORAGE_ORIGIN&&target.pathname===PREFIX.slice(0,-1)&&!target.search,'CLIENT_UPLOAD_SCOPE_INVALID');
  const headers=keys(session.upload_headers,['x-signature','x-upsert']);need(text(headers['x-signature'])&&!/\s/u.test(headers['x-signature'])&&headers['x-upsert']==='false');
  const md=keys(session.upload_metadata,['bucketName','objectName','contentType','cacheControl']);
  need(md.bucketName===BUCKET[purpose]&&md.objectName===objectName&&md.contentType===row.mime_type&&md.cacheControl==='3600'&&session.chunk_size===6291456,'CLIENT_UPLOAD_SCOPE_INVALID');
 }else{
  need(target.origin===API_ORIGIN&&target.pathname===`/storage/v1/object/upload/sign/${BUCKET[purpose]}/${objectName}`&&target.searchParams.getAll('token').length===1
   &&[...target.searchParams.keys()].every(k=>k==='token')&&text(target.searchParams.get('token'))&&!/\s/u.test(target.searchParams.get('token')!),'CLIENT_UPLOAD_SCOPE_INVALID');
  const headers=keys(session.upload_headers,['Content-Type','x-upsert']);need(headers['Content-Type']===row.mime_type&&headers['x-upsert']==='false');
 }
 const parsed=row as unknown as TransferInput;
 if(row.resume!==null){
  need(tus);const cp=keys(row.resume,['schema_version','upload_id','asset_id','size_bytes','sha256','resource_id','offset']);
  need(cp.schema_version==='1.0'&&cp.upload_id===row.expected_upload_id&&cp.asset_id===row.expected_asset_id&&cp.size_bytes===row.expected_size_bytes&&cp.sha256===row.expected_sha256
   &&typeof cp.offset==='number'&&Number.isSafeInteger(cp.offset)&&cp.offset>=0&&cp.offset<=Number(row.expected_size_bytes));resourceId(cp.resource_id,parsed);
 }
 // Do not retain caller-owned references across file/network awaits.
 return structuredClone(parsed);
}
function normalized(value:string){return process.platform==='win32'?path.normalize(value).toLowerCase():path.normalize(value);}
function sameStats(a:BigIntStats,b:BigIntStats){return ['dev','ino','mode','size','mtimeNs','ctimeNs','nlink'].every(k=>a[k as keyof BigIntStats]===b[k as keyof BigIntStats]);}
async function fileScope(file:string,allowedRoot:string){
 need(path.isAbsolute(allowedRoot)&&!file.startsWith('\\\\')&&!allowedRoot.startsWith('\\\\'),'CLIENT_UPLOAD_FILE_UNAVAILABLE');
 if(process.platform==='win32')need(!file.slice(2).includes(':')&&!allowedRoot.slice(2).includes(':'),'CLIENT_UPLOAD_FILE_UNAVAILABLE');
 const root=path.resolve(allowedRoot),resolved=path.resolve(file),relative=path.relative(root,resolved);
 need(relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'CLIENT_UPLOAD_FILE_UNAVAILABLE');
 need(normalized(await realpath(root))===normalized(root)&&normalized(await realpath(resolved))===normalized(resolved),'CLIENT_UPLOAD_FILE_UNAVAILABLE');
 need((await lstat(root)).isDirectory()&&!(await lstat(root)).isSymbolicLink(),'CLIENT_UPLOAD_FILE_UNAVAILABLE');
 let current=root;for(const part of relative.split(path.sep)){current=path.join(current,part);need(!(await lstat(current)).isSymbolicLink(),'CLIENT_UPLOAD_FILE_UNAVAILABLE');}
 const stat=await lstat(resolved,{bigint:true});need(stat.isFile()&&stat.nlink===1n,'CLIENT_UPLOAD_FILE_UNAVAILABLE');return stat;
}
async function stable(handle:FileHandle,file:string,root:string,initial:BigIntStats){
 try{need(sameStats(initial,await fileScope(file,root))&&sameStats(initial,await handle.stat({bigint:true})),'CLIENT_UPLOAD_FILE_CHANGED');}
 catch{return fail('CLIENT_UPLOAD_FILE_CHANGED');}
}
async function hashFile(handle:FileHandle,size:number){
 const digest=createHash('sha256');let count=0;
 for await(const chunk of handle.createReadStream({start:0,end:size-1,autoClose:false,highWaterMark:1024*1024})){count+=chunk.length;need(count<=size,'CLIENT_UPLOAD_FILE_CHANGED');digest.update(chunk);}
 need(count===size,'CLIENT_UPLOAD_FILE_CHANGED');return digest.digest('hex');
}
interface Options{allowedRoot:string;fetch?:typeof fetch;signal?:AbortSignal;onCheckpoint?:(value:ResumeCheckpoint)=>void}
function safeError(error:unknown):ClientUploadError{
 if(error instanceof ClientUploadError)return error;
 if(error instanceof TusTransferError){const codes:Record<string,Code>={TRANSFER_INTERRUPTED:'CLIENT_UPLOAD_INTERRUPTED',TRANSFER_PAUSED:'CLIENT_UPLOAD_PAUSED',TRANSFER_SCOPE_INVALID:'CLIENT_UPLOAD_SCOPE_INVALID',TRANSFER_PROTOCOL_INVALID:'CLIENT_UPLOAD_PROTOCOL_INVALID',TRANSFER_EXPIRED:'CLIENT_UPLOAD_EXPIRED',TRANSFER_ACCESS_DENIED:'CLIENT_UPLOAD_ACCESS_DENIED',TRANSFER_CONFLICT:'CLIENT_UPLOAD_CONFLICT'};return new ClientUploadError(codes[error.code]??'CLIENT_UPLOAD_PROTOCOL_INVALID');}
 return new ClientUploadError('CLIENT_UPLOAD_FILE_UNAVAILABLE');
}
export async function transferLocalUpload(supplied:unknown,options:Options){
 let handle:FileHandle|undefined;
 try{
  need(process.versions.node.split('.')[0]==='24');const input=parseTransferInput(supplied);
  const initial=await fileScope(input.local_file_path,options.allowedRoot);need(initial.size===BigInt(input.expected_size_bytes),'CLIENT_UPLOAD_FILE_CHANGED');
  handle=await open(input.local_file_path,'r');await stable(handle,input.local_file_path,options.allowedRoot,initial);
  need(await hashFile(handle,input.expected_size_bytes)===input.expected_sha256,'CLIENT_UPLOAD_HASH_MISMATCH');await stable(handle,input.local_file_path,options.allowedRoot,initial);
  const file=await openAsBlob(input.local_file_path,{type:input.mime_type});await stable(handle,input.local_file_path,options.allowedRoot,initial);
  const active=handle;let fileFault:ClientUploadError|undefined;
  const fetcher:typeof fetch=async(url,init)=>{
   try{await stable(active,input.local_file_path,options.allowedRoot,initial);}catch(error){fileFault=safeError(error);throw fileFault;}
   const response=await(options.fetch??fetch)(url,init);
   try{await stable(active,input.local_file_path,options.allowedRoot,initial);}catch(error){fileFault=safeError(error);throw fileFault;}
   return response;
  };
  try{
   if(input.session.protocol==='tus'){
    need(typeof options.onCheckpoint==='function','CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE');
    await transferTus({session:input.session,file,expectedStorageOrigin:API_ORIGIN,fetch:fetcher,signal:options.signal,
     resource:input.resume?PREFIX+resourceId(input.resume.resource_id,input):undefined,onCheckpoint:value=>{
      need(value.resource.startsWith(PREFIX),'CLIENT_UPLOAD_SCOPE_INVALID');const id=resourceId(value.resource.slice(PREFIX.length),input);
      const checkpoint:ResumeCheckpoint={schema_version:'1.0',upload_id:input.expected_upload_id,asset_id:input.expected_asset_id,size_bytes:input.expected_size_bytes,sha256:input.expected_sha256,resource_id:id,offset:value.offset};
      try{options.onCheckpoint!(checkpoint);}catch{return fail('CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE');}
     }});
   }else{
    if(options.signal?.aborted)fail('CLIENT_UPLOAD_PAUSED');
    let response:Response;try{response=await fetcher(input.session.upload_url!,{method:'PUT',headers:input.session.upload_headers,body:file,
     credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer',signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000)});}
    catch{if(fileFault)throw fileFault;return fail(options.signal?.aborted?'CLIENT_UPLOAD_PAUSED':'CLIENT_UPLOAD_INTERRUPTED');}
    if(response.status===401||response.status===403)fail('CLIENT_UPLOAD_ACCESS_DENIED');if(response.status===404||response.status===410)fail('CLIENT_UPLOAD_EXPIRED');
    if(response.status===409)fail('CLIENT_UPLOAD_CONFLICT');if(response.status===429||response.status>=500)fail('CLIENT_UPLOAD_INTERRUPTED');
    need(response.status===200||response.status===201,'CLIENT_UPLOAD_PROTOCOL_INVALID');
   }
  }catch(error){if(fileFault)throw fileFault;throw error;}
  await stable(handle,input.local_file_path,options.allowedRoot,initial);need(await hashFile(handle,input.expected_size_bytes)===input.expected_sha256,'CLIENT_UPLOAD_FILE_CHANGED');await stable(handle,input.local_file_path,options.allowedRoot,initial);
  return {schema_version:'1.0',result:'transferred',upload_id:input.expected_upload_id,asset_id:input.expected_asset_id,size_bytes:input.expected_size_bytes,sha256:input.expected_sha256,confirmed_bytes:input.expected_size_bytes,
   completion_body:{actual_size_bytes:input.expected_size_bytes,sha256:input.expected_sha256,start_processing:input.start_processing}};
 }catch(error){throw safeError(error);}finally{await handle?.close().catch(()=>{});}
}
/** Bounded private stdin only: no filename/credential file/environment discovery. */
export async function readPrivateInput(chunks:AsyncIterable<Uint8Array>):Promise<unknown>{
 const parts:Buffer[]=[];let size=0;
 try{
  for await(const part of chunks){size+=part.byteLength;need(size<=65536);parts.push(Buffer.from(part));}
  const raw=Buffer.concat(parts);let text:string;try{text=new TextDecoder('utf8',{fatal:true}).decode(raw);}finally{raw.fill(0);}
  const parsed:unknown=JSON.parse(text);const stack:{keys:Set<string>;key:boolean;kind:'object'|'array'}[]=[];
  for(const token of text.match(/"(?:[^"\\]|\\.)*"|[{}[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/gu)??[]){
   if(token==='{')stack.push({keys:new Set(),key:true,kind:'object'});else if(token==='[')stack.push({keys:new Set(),key:false,kind:'array'});
   else if(token==='}'||token===']')stack.pop();else if(token===','){if(stack.at(-1)?.kind==='object')stack.at(-1)!.key=true;}
   else if(token.startsWith('"')&&stack.at(-1)?.kind==='object'&&stack.at(-1)?.key){const frame=stack.at(-1)!;const key=JSON.parse(token)as string;need(!frame.keys.has(key));frame.keys.add(key);frame.key=false;}
   need(stack.length<=12);
  }
  return parsed;
 }catch{return fail();}finally{for(const part of parts)part.fill(0);}
}
export async function runCli(argv:string[],stdin:AsyncIterable<Uint8Array>){
 try{
  need((stdin as AsyncIterable<Uint8Array>&{isTTY?:boolean}).isTTY!==true);
  need((argv.length===2||argv.length===4)&&argv[0]==='--allowed-root'&&path.isAbsolute(argv[1]));
  const checkpoint=argv.length===4;need(!checkpoint||(argv[2]==='--checkpoint-fd'&&argv[3]==='3'));
  if(checkpoint){try{const stat=fstatSync(3);need(!stat.isDirectory(),'CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE');}catch{return fail('CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE');}}
  const input=await readPrivateInput(stdin);
  const result=await transferLocalUpload(input,{allowedRoot:argv[1],onCheckpoint:checkpoint?value=>{
   const data=Buffer.from(JSON.stringify(value)+'\n');let offset=0;while(offset<data.length){const written=writeSync(3,data,offset,data.length-offset);need(written>0,'CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE');offset+=written;}
  }:undefined});return result;
 }catch(error){return {schema_version:'1.0',result:'failed',code:safeError(error).code};}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 void runCli(process.argv.slice(2),process.stdin).then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(result.result==='failed')process.exitCode=1;});
}
