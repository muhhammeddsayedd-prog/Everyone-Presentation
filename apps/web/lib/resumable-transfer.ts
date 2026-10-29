import type {UploadSession} from '@eps/domain';
const CHUNK=6291456;
const UUID='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export type TusFailure='TRANSFER_INTERRUPTED'|'TRANSFER_PAUSED'|'TRANSFER_SCOPE_INVALID'|'TRANSFER_PROTOCOL_INVALID'|'TRANSFER_EXPIRED'|'TRANSFER_ACCESS_DENIED'|'TRANSFER_CONFLICT';
export class TusTransferError extends Error {
 constructor(readonly code:TusFailure){super({TRANSFER_INTERRUPTED:'Transfer interrupted. Resume to check the stored byte offset.',TRANSFER_PAUSED:'Transfer paused.',TRANSFER_SCOPE_INVALID:'The upload location did not match this reserved file.',TRANSFER_PROTOCOL_INVALID:'Storage returned invalid transfer progress.',TRANSFER_EXPIRED:'The transfer resource expired. Check the upload before starting again.',TRANSFER_ACCESS_DENIED:'Refresh upload authorization before resuming.',TRANSFER_CONFLICT:'Another transfer is writing this file. Pause it before resuming.'}[code]);this.name='TusTransferError';}
}
interface TransferOptions {session:UploadSession;file:Blob;expectedStorageOrigin:string;resource?:string;fetch?:typeof fetch;signal?:AbortSignal;onCheckpoint?:(value:{resource:string;offset:number})=>void}
function reject(code:TusFailure):never{throw new TusTransferError(code);}
function asciiBase64(value:string){return btoa(String.fromCharCode(...new TextEncoder().encode(value)));}
function setup(options:TransferOptions){
 const session=options.session;let endpoint:URL,configured:URL;try{endpoint=new URL(session.upload_url??'');configured=new URL(options.expectedStorageOrigin);}catch{return reject('TRANSFER_SCOPE_INVALID');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(configured.hostname);
 if(configured.username||configured.password||configured.pathname!=='/'||configured.search||configured.hash||configured.protocol!=='https:'&&!(loopback&&configured.protocol==='http:'))reject('TRANSFER_SCOPE_INVALID');
 const direct=configured.hostname.endsWith('.supabase.co')&&!configured.hostname.endsWith('.storage.supabase.co')?`${configured.protocol}//${configured.hostname.slice(0,-'.supabase.co'.length)}.storage.supabase.co`:configured.origin;
 if(endpoint.origin!==direct)reject('TRANSFER_SCOPE_INVALID');
 const md=session.upload_metadata,headers=session.upload_headers;
 if(session.protocol!=='tus'||session.status!=='open'||!Number.isFinite(Date.parse(session.expires_at))||Date.parse(session.expires_at)<=Date.now()||session.chunk_size!==CHUNK||!md||Object.keys(md).sort().join(',')!=='bucketName,cacheControl,contentType,objectName'
  ||!['eps-candidate-assets','eps-candidate-support'].includes(md.bucketName)||!new RegExp(`^assets/${UUID}/original\\.(mp4|mov|webm|mkv|png|jpg|webp|pdf|docx|txt)$`,'u').test(md.objectName)
  ||!md.objectName.includes(`/assets/${session.asset_id}/`)&& !md.objectName.startsWith(`assets/${session.asset_id}/`)
  ||endpoint.username||endpoint.password||endpoint.search||endpoint.hash||endpoint.pathname!=='/storage/v1/upload/resumable/sign'
  ||endpoint.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)
  ||Object.keys(headers).sort().join(',')!=='x-signature,x-upsert'||headers['x-upsert']!=='false'||typeof headers['x-signature']!=='string'||!headers['x-signature']||headers['x-signature'].length>8192||/[\s\p{C}]/u.test(headers['x-signature'])
  ||!Number.isSafeInteger(session.maximum_bytes)||session.maximum_bytes<1||session.maximum_bytes>268435456||!Number.isSafeInteger(options.file.size)||options.file.size<1||options.file.size>session.maximum_bytes)reject('TRANSFER_SCOPE_INVALID');
 function resource(value:string):URL{
  let url:URL;try{url=new URL(value,endpoint);}catch{return reject('TRANSFER_SCOPE_INVALID');}
  if(url.origin!==endpoint.origin||url.username||url.password||url.search||url.hash||!url.pathname.startsWith(`${endpoint.pathname}/`))reject('TRANSFER_SCOPE_INVALID');
  const encoded=url.pathname.slice(endpoint.pathname.length+1);if(!/^[A-Za-z0-9_-]{1,2048}$/u.test(encoded))reject('TRANSFER_SCOPE_INVALID');
  let decoded:string;try{decoded=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(encoded.replace(/-/gu,'+').replace(/_/gu,'/')),v=>v.charCodeAt(0)));}catch{return reject('TRANSFER_SCOPE_INVALID');}
  const prefix=`${md!.bucketName}/${md!.objectName}`;const version=decoded.startsWith(`${prefix}/`)?decoded.slice(prefix.length+1):decoded.startsWith(`${prefix}-$v-`)?decoded.slice(prefix.length+4):'';
  if(!new RegExp(`^${UUID}$`,'u').test(version))reject('TRANSFER_SCOPE_INVALID');return url;
 }
 async function request(url:URL,method:string,extra:Record<string,string>={},body?:Blob){
  if(options.signal?.aborted)reject('TRANSFER_PAUSED');
  let response:Response;try{response=await(options.fetch??fetch)(url.href,{method,headers:{...headers,'Tus-Resumable':'1.0.0',...extra},body,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000),credentials:'omit',redirect:'error',cache:'no-store',referrerPolicy:'no-referrer'});}catch{reject(options.signal?.aborted?'TRANSFER_PAUSED':'TRANSFER_INTERRUPTED');}
  if(response.status===401||response.status===403)reject('TRANSFER_ACCESS_DENIED');if(response.status===404||response.status===410)reject('TRANSFER_EXPIRED');if(response.status===409)reject('TRANSFER_CONFLICT');if(response.status===429||response.status>=500)reject('TRANSFER_INTERRUPTED');return response;
 }
 function offset(response:Response){const text=response.headers.get('Upload-Offset');if(!text||!/^\d+$/u.test(text))reject('TRANSFER_PROTOCOL_INVALID');const result=Number(text);if(!Number.isSafeInteger(result)||result<0||result>options.file.size)reject('TRANSFER_PROTOCOL_INVALID');return result;}
 async function head(url:URL){const response=await request(url,'HEAD');if(response.status!==200&&response.status!==204||response.headers.get('Upload-Length')!==String(options.file.size))reject('TRANSFER_PROTOCOL_INVALID');return offset(response);}
 return{endpoint,md,resource,request,offset,head};
}
/** Confirmed offsets only. A lost PATCH response is reconciled by HEAD on the next
 * explicit resume; neither provider work nor API completion is replayed here. */
export async function transferTus(options:TransferOptions):Promise<{resource:string;offset:number}>{
 const port=setup(options);let url:URL,offset:number;
 if(options.resource){url=port.resource(options.resource);offset=await port.head(url);}else{
  const response=await port.request(port.endpoint,'POST',{'Upload-Length':String(options.file.size),'Upload-Metadata':Object.entries(port.md!).map(([k,v])=>`${k} ${asciiBase64(v)}`).join(',')});
  const location=response.headers.get('Location');if(response.status!==201||!location)reject('TRANSFER_PROTOCOL_INVALID');url=port.resource(location);offset=0;
 }
 options.onCheckpoint?.({resource:url.pathname,offset});
 while(offset<options.file.size){const end=Math.min(offset+CHUNK,options.file.size);const response=await port.request(url,'PATCH',{'Upload-Offset':String(offset),'Content-Type':'application/offset+octet-stream'},options.file.slice(offset,end));if(response.status!==204||port.offset(response)!==end)reject('TRANSFER_PROTOCOL_INVALID');offset=end;options.onCheckpoint?.({resource:url.pathname,offset});}
 return{resource:url.pathname,offset};
}
/** Best effort termination of unfinished transfer bytes. The app cancellation RPC
 * separately invalidates the reservation; Ready/shared objects are never deleted. */
export async function terminateTus(options:TransferOptions):Promise<void>{if(!options.resource)return;const port=setup(options),url=port.resource(options.resource);if(await port.head(url)===options.file.size)return;const response=await port.request(url,'DELETE');if(response.status!==204)reject('TRANSFER_PROTOCOL_INVALID');}
