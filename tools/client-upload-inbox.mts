/** Client-local private UploadSession handoff. Import has no filesystem/network IO. */
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {openSync,writeSync,fsyncSync,closeSync,lstatSync,realpathSync,type BigIntStats} from 'node:fs';
import {lstat,realpath,mkdir,open,readFile,readdir,unlink,type FileHandle} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import type {TransferInput,ResumeCheckpoint} from './client-upload-transfer.mts';
const CODE_ROOT=path.resolve(import.meta.dirname,'..'),UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u,SHA=/^[a-f0-9]{64}$/u;
const HELPER_SHA='4ed5efd3cdf4f00393e2833a3b90bb481ba84edeaff8c1ce36949e876d6ef4ba',TUS_SHA='fe92d7ab21133cff645e00f04cdd96859bdead31b6e29e15d245b1ed6716f87e';
const TTL=15*60*1000;
const CODES=new Set(['CLIENT_INBOX_INPUT_INVALID','CLIENT_INBOX_BINDING_INVALID','CLIENT_INBOX_FILE_UNAVAILABLE','CLIENT_INBOX_SOURCE_CHANGED','CLIENT_INBOX_EXPIRED','CLIENT_INBOX_SECURITY_UNCONFIRMED','CLIENT_INBOX_ALREADY_USED','CLIENT_INBOX_RESUME_INVALID','CLIENT_INBOX_CHECKPOINT_UNAVAILABLE','CLIENT_INBOX_TRANSFER_FAILED','CLIENT_INBOX_UNCONFIRMED']);
type Code='CLIENT_INBOX_INPUT_INVALID'|'CLIENT_INBOX_BINDING_INVALID'|'CLIENT_INBOX_FILE_UNAVAILABLE'|'CLIENT_INBOX_SOURCE_CHANGED'|'CLIENT_INBOX_EXPIRED'|'CLIENT_INBOX_SECURITY_UNCONFIRMED'|'CLIENT_INBOX_ALREADY_USED'|'CLIENT_INBOX_RESUME_INVALID'|'CLIENT_INBOX_CHECKPOINT_UNAVAILABLE'|'CLIENT_INBOX_TRANSFER_FAILED'|'CLIENT_INBOX_UNCONFIRMED';
export class ClientInboxError extends Error{constructor(readonly code:Code,readonly transferCode?:string){super(code);this.name='ClientInboxError';}}
const fail=(code:Code='CLIENT_INBOX_INPUT_INVALID'):never=>{throw new ClientInboxError(code);};
function need(value:unknown,code:Code='CLIENT_INBOX_INPUT_INVALID'):asserts value{if(!value)fail(code);}
type Row=Record<string,unknown>;
function closed(value:unknown,wanted:string[]):Row{need(value!==null&&typeof value==='object'&&!Array.isArray(value));const proto=Object.getPrototypeOf(value);need(proto===null||proto===Object.prototype);const descriptors=Object.getOwnPropertyDescriptors(value);need(Reflect.ownKeys(value).length===Object.keys(descriptors).length);for(const v of Object.values(descriptors))need('value'in v&&v.enumerable);need(Object.keys(value).sort().join(',')===[...wanted].sort().join(','));return value as Row;}
const text=(v:unknown,max=4096):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&!/[\p{C}]/u.test(v);
const hash=(v:Uint8Array|string)=>createHash('sha256').update(v).digest('hex');
export interface Preparation{schema_version:'1.0';allowed_root:string;local_file_path:string;purpose:TransferInput['purpose'];mime_type:string;expected_size_bytes:number;expected_sha256:string;start_processing:boolean;resume_from:string|null;expected_upload_id:string|null;expected_asset_id:string|null}
export interface InboxSecurity{protect(directory:string):Promise<void>;verify(target:string,kind:'file'|'directory'):Promise<void>}
interface Options{workspaceRoot?:string;security?:InboxSecurity;fetch?:typeof fetch;now?:()=>number}
interface Manifest{schema_version:'1.0';handoff_id:string;nonce:string;created_at:string;expires_at:string;helper_sha256:string;tus_sha256:string;preparation:Preparation;source_identity:Identity;resume:ResumeCheckpoint|null}
interface Identity{dev:string;ino:string;size:string;mtime_ns:string;ctime_ns:string}
interface TransferRequest{handoff_id:string;manifest_sha256:string;expected_upload_id:string;expected_asset_id:string}
const fingerprints=(s:BigIntStats):Identity=>({dev:String(s.dev),ino:String(s.ino),size:String(s.size),mtime_ns:String(s.mtimeNs),ctime_ns:String(s.ctimeNs)});
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function prepareInput(value:unknown):Preparation{
 const p=closed(value,['schema_version','allowed_root','local_file_path','purpose','mime_type','expected_size_bytes','expected_sha256','start_processing','resume_from','expected_upload_id','expected_asset_id']);
 need(p.schema_version==='1.0'&&text(p.allowed_root)&&text(p.local_file_path)&&path.isAbsolute(p.allowed_root)&&path.isAbsolute(p.local_file_path));
 const allowed:Record<string,string[]>={client_logo:['image/png','image/jpeg','image/webp'],specs:['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'],candidate_video:['video/mp4','video/quicktime','video/webm','video/x-matroska'],candidate_support:['image/png','image/jpeg','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain']};
 need(typeof p.purpose==='string'&&Object.hasOwn(allowed,p.purpose)&&typeof p.mime_type==='string'&&allowed[p.purpose].includes(p.mime_type));
 const ext:Record<string,string[]>={'image/png':['png'],'image/jpeg':['jpg','jpeg'],'image/webp':['webp'],'application/pdf':['pdf'],'application/vnd.openxmlformats-officedocument.wordprocessingml.document':['docx'],'text/plain':['txt'],'video/mp4':['mp4'],'video/quicktime':['mov'],'video/webm':['webm'],'video/x-matroska':['mkv']};
 need(ext[p.mime_type].includes(path.extname(p.local_file_path).slice(1).toLowerCase()));
 const ceiling=p.purpose==='client_logo'||p.purpose==='candidate_support'&&p.mime_type.startsWith('image/')?5242880:p.purpose==='candidate_video'?268435456:20971520;
 need(Number.isSafeInteger(p.expected_size_bytes)&&Number(p.expected_size_bytes)>0&&Number(p.expected_size_bytes)<=ceiling&&typeof p.expected_sha256==='string'&&SHA.test(p.expected_sha256));
 need(typeof p.start_processing==='boolean'&&p.start_processing===(p.purpose==='candidate_video'));
 if(p.resume_from===null)need(p.expected_upload_id===null&&p.expected_asset_id===null);
 else need(typeof p.resume_from==='string'&&UUID.test(p.resume_from)&&(p.purpose==='candidate_video'||p.purpose==='candidate_support')&&typeof p.expected_upload_id==='string'&&UUID.test(p.expected_upload_id)&&typeof p.expected_asset_id==='string'&&UUID.test(p.expected_asset_id),'CLIENT_INBOX_RESUME_INVALID');
 return structuredClone(p)as unknown as Preparation;
}
async function noLinks(target:string,kind:'file'|'directory'){
 need(path.isAbsolute(target)&&!target.startsWith('\\\\'),'CLIENT_INBOX_FILE_UNAVAILABLE');if(process.platform==='win32')need(!target.slice(2).includes(':'),'CLIENT_INBOX_FILE_UNAVAILABLE');
 const resolved=path.resolve(target);need(await realpath(resolved)===resolved,'CLIENT_INBOX_FILE_UNAVAILABLE');let at=path.parse(resolved).root;
 for(const segment of path.relative(at,resolved).split(path.sep)){at=path.join(at,segment);need(!(await lstat(at)).isSymbolicLink(),'CLIENT_INBOX_FILE_UNAVAILABLE');}
 const s=await lstat(resolved,{bigint:true});need(kind==='directory'?s.isDirectory():s.isFile()&&s.nlink===1n,'CLIENT_INBOX_FILE_UNAVAILABLE');return s;
}
async function sourceIdentity(p:Preparation){
 // Source filesystem failures must not expose private paths or hide the next action.
 try{
 await noLinks(p.allowed_root,'directory');const relative=path.relative(p.allowed_root,p.local_file_path);need(relative!==''&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative),'CLIENT_INBOX_SOURCE_CHANGED');
 const before=await noLinks(p.local_file_path,'file');need(before.size===BigInt(p.expected_size_bytes),'CLIENT_INBOX_SOURCE_CHANGED');let handle:FileHandle|undefined;
 try{handle=await open(p.local_file_path,'r');need(same(fingerprints(await handle.stat({bigint:true})),fingerprints(before)),'CLIENT_INBOX_SOURCE_CHANGED');const digest=createHash('sha256');let count=0;for await(const bytes of handle.createReadStream({start:0,end:p.expected_size_bytes-1,autoClose:false,highWaterMark:1024*1024})){count+=bytes.length;need(count<=p.expected_size_bytes,'CLIENT_INBOX_SOURCE_CHANGED');digest.update(bytes);}need(count===p.expected_size_bytes&&digest.digest('hex')===p.expected_sha256,'CLIENT_INBOX_SOURCE_CHANGED');const after=await noLinks(p.local_file_path,'file');need(same(fingerprints(after),fingerprints(before))&&same(fingerprints(await handle.stat({bigint:true})),fingerprints(before)),'CLIENT_INBOX_SOURCE_CHANGED');return fingerprints(before);}finally{await handle?.close();}
 }catch(error){if(error instanceof ClientInboxError)throw error;return fail('CLIENT_INBOX_FILE_UNAVAILABLE');}
}
/** Trusted ACL adapter; the CLI always uses this reviewed Windows implementation. */
export function windowsInboxSecurity():InboxSecurity{
 async function acl(target:string,kind:'file'|'directory',protect:boolean){
  need(process.platform==='win32','CLIENT_INBOX_SECURITY_UNCONFIRMED');
  const script="$ErrorActionPreference='Stop';$p=$env:EPS_CLIENT_INBOX_TARGET;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;if($env:EPS_CLIENT_INBOX_PROTECT -eq '1'){$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetOwner($sid);$a.SetAccessRuleProtection($true,$false);foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a};$a=Get-Acl -LiteralPath $p;if($a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'ACL_INVALID'};if($env:EPS_CLIENT_INBOX_KIND -eq 'directory' -and -not $a.AreAccessRulesProtected){throw 'ACL_INVALID'};$seen=@();foreach($r in $a.Access){$id=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value;if($r.AccessControlType -ne 'Allow' -or $id -notin @($sid.Value,'S-1-5-18')){throw 'ACL_INVALID'};$seen+=$id};if($sid.Value -notin $seen -or 'S-1-5-18' -notin $seen){throw 'ACL_INVALID'};Write-Output 'VERIFIED'";
  const env:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV??'production',EPS_CLIENT_INBOX_TARGET:target,EPS_CLIENT_INBOX_KIND:kind,EPS_CLIENT_INBOX_PROTECT:protect?'1':'0'};for(const k of ['SystemRoot','WINDIR','PATH'])if(process.env[k])env[k]=process.env[k];
  await new Promise<void>((resolve,reject)=>{const executable=path.join(process.env.SystemRoot??'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe');const child=spawn(executable,['-NoProfile','-NonInteractive','-Command',script],{shell:false,windowsHide:true,env,stdio:['ignore','pipe','pipe']});let out='',size=0;const timer=setTimeout(()=>{child.kill();reject(new ClientInboxError('CLIENT_INBOX_SECURITY_UNCONFIRMED'));},15000);child.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>1024)child.kill();else out+=b.toString('utf8');});child.stderr.resume();child.once('error',()=>{clearTimeout(timer);reject(new ClientInboxError('CLIENT_INBOX_SECURITY_UNCONFIRMED'));});child.once('close',code=>{clearTimeout(timer);if(code===0&&out.trim()==='VERIFIED'&&size<=1024)resolve();else reject(new ClientInboxError('CLIENT_INBOX_SECURITY_UNCONFIRMED'));});});
 }
 return{protect:dir=>acl(dir,'directory',true),verify:(target,kind)=>acl(target,kind,false)};
}
async function helper(){
 for(const[file,expected]of[['tools/client-upload-transfer.mts',HELPER_SHA],['apps/web/lib/resumable-transfer.ts',TUS_SHA]]){const target=path.join(CODE_ROOT,file);await noLinks(target,'file');need(hash(await readFile(target))===expected,'CLIENT_INBOX_BINDING_INVALID');}
 return import('./client-upload-transfer.mts');
}
function checkpoint(value:unknown,p:Preparation,uploadId:string,assetId:string):ResumeCheckpoint{
 const c=closed(value,['schema_version','upload_id','asset_id','size_bytes','sha256','resource_id','offset']);need(c.schema_version==='1.0'&&c.upload_id===uploadId&&c.asset_id===assetId&&c.size_bytes===p.expected_size_bytes&&c.sha256===p.expected_sha256&&Number.isSafeInteger(c.offset)&&Number(c.offset)>=0&&Number(c.offset)<=p.expected_size_bytes,'CLIENT_INBOX_RESUME_INVALID');
 need(typeof c.resource_id==='string'&&/^[A-Za-z0-9_-]{1,2048}$/u.test(c.resource_id),'CLIENT_INBOX_RESUME_INVALID');const decoded=Buffer.from(c.resource_id,'base64url').toString('utf8');need(Buffer.from(decoded).toString('base64url')===c.resource_id&&!/[?&#\s]/u.test(decoded),'CLIENT_INBOX_RESUME_INVALID');
 const extensions:Record<string,string>={'video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','video/x-matroska':'mkv','image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document':'docx','text/plain':'txt'};need(p.purpose==='candidate_video'||p.purpose==='candidate_support','CLIENT_INBOX_RESUME_INVALID');const prefix=`${p.purpose==='candidate_video'?'eps-candidate-assets':'eps-candidate-support'}/assets/${assetId}/original.${extensions[p.mime_type]}`;const version=decoded.startsWith(prefix+'/')?decoded.slice(prefix.length+1):decoded.startsWith(prefix+'-$v-')?decoded.slice(prefix.length+4):'';need(UUID.test(version),'CLIENT_INBOX_RESUME_INVALID');return structuredClone(c)as unknown as ResumeCheckpoint;
}
export function makeUploadInbox(options:Options={}){
 const workspace=path.resolve(options.workspaceRoot??CODE_ROOT),base=path.join(workspace,'.local/client-upload-inbox'),security=options.security??windowsInboxSecurity(),now=options.now??Date.now;
 const dir=(id:string)=>{need(UUID.test(id));return path.join(base,id);};
 const verifyDir=async(id:string)=>{const target=dir(id);await noLinks(target,'directory');await security.verify(target,'directory');return target;};
 async function readPrivate(file:string,max:number){
  const s=await noLinks(file,'file');need(s.size>0n&&s.size<=BigInt(max),'CLIENT_INBOX_FILE_UNAVAILABLE');await security.verify(file,'file');const h=await open(file,'r');let bytes:Buffer|undefined;
  try{need(same(fingerprints(await h.stat({bigint:true})),fingerprints(s)),'CLIENT_INBOX_FILE_UNAVAILABLE');bytes=await h.readFile();need(bytes.length<=max&&same(fingerprints(await noLinks(file,'file')),fingerprints(s))&&same(fingerprints(await h.stat({bigint:true})),fingerprints(s)),'CLIENT_INBOX_FILE_UNAVAILABLE');const lib=await helper();const value=await lib.readPrivateInput((async function*(){yield bytes!;})());return{value,identity:fingerprints(s),sha256:hash(bytes)};}finally{bytes?.fill(0);await h.close();}
 }
 async function writeJson(file:string,value:unknown){const h=await open(file,'wx',0o600);try{await h.writeFile(JSON.stringify(value));await h.sync();}finally{await h.close();}await security.verify(file,'file');}
 async function manifest(id:string,expectedSha?:string){
  const directory=await verifyDir(id),read=await readPrivate(path.join(directory,'manifest.json'),32768);if(expectedSha)need(read.sha256===expectedSha,'CLIENT_INBOX_BINDING_INVALID');
  const m=closed(read.value,['schema_version','handoff_id','nonce','created_at','expires_at','helper_sha256','tus_sha256','preparation','source_identity','resume']);need(m.schema_version==='1.0'&&m.handoff_id===id&&typeof m.nonce==='string'&&/^[A-Za-z0-9_-]{43}$/u.test(m.nonce)&&m.helper_sha256===HELPER_SHA&&m.tus_sha256===TUS_SHA,'CLIENT_INBOX_BINDING_INVALID');
  const preparation=prepareInput(m.preparation);const identity=closed(m.source_identity,['dev','ino','size','mtime_ns','ctime_ns']);for(const v of Object.values(identity))need(typeof v==='string'&&/^[0-9]+$/u.test(v),'CLIENT_INBOX_BINDING_INVALID');
  need(typeof m.created_at==='string'&&typeof m.expires_at==='string'&&Number.isFinite(Date.parse(m.created_at))&&Date.parse(m.expires_at)-Date.parse(m.created_at)===TTL,'CLIENT_INBOX_BINDING_INVALID');
  need((m.resume===null)===(preparation.resume_from===null),'CLIENT_INBOX_RESUME_INVALID');
  if(m.resume!==null){need(preparation.resume_from!==null&&preparation.expected_upload_id!==null&&preparation.expected_asset_id!==null,'CLIENT_INBOX_RESUME_INVALID');checkpoint(m.resume,preparation,preparation.expected_upload_id,preparation.expected_asset_id);}
  return{value:m as unknown as Manifest,directory,sha256:read.sha256};
 }
 async function resume(p:Preparation,identity:Identity){
  if(p.resume_from===null)return null;const old=await manifest(p.resume_from),before=old.value.preparation;
  for(const k of ['allowed_root','local_file_path','purpose','mime_type','expected_size_bytes','expected_sha256','start_processing']as const)need(before[k]===p[k],'CLIENT_INBOX_RESUME_INVALID');need(same(old.value.source_identity,identity),'CLIENT_INBOX_RESUME_INVALID');
  const claim=closed((await readPrivate(path.join(old.directory,'transfer-claim.json'),8192)).value,['schema_version','handoff_id','manifest_sha256','upload_id','asset_id','dispatch_may_have_occurred','automatic_retry']);need(claim.schema_version==='1.0'&&claim.handoff_id===p.resume_from&&claim.manifest_sha256===old.sha256&&claim.upload_id===p.expected_upload_id&&claim.asset_id===p.expected_asset_id&&claim.dispatch_may_have_occurred===true&&claim.automatic_retry===false,'CLIENT_INBOX_RESUME_INVALID');
  const names=await readdir(old.directory);need(names.length<=512,'CLIENT_INBOX_RESUME_INVALID');if(names.includes('result.json')){const result=(await readPrivate(path.join(old.directory,'result.json'),8192)).value as Row;need(result.result==='failed','CLIENT_INBOX_RESUME_INVALID');closed(result,['schema_version','result','code',...(Object.hasOwn(result,'transfer_code')?['transfer_code']:[])]);need(result.schema_version==='1.0'&&typeof result.code==='string'&&CODES.has(result.code),'CLIENT_INBOX_RESUME_INVALID');}
  const files=names.filter(n=>/^checkpoint-[0-9]{6}\.json$/u.test(n)).sort();need(files.length>0&&files.length<=256,'CLIENT_INBOX_RESUME_INVALID');let cp:ResumeCheckpoint|undefined;
  for(let i=0;i<files.length;i++){need(files[i]===`checkpoint-${String(i+1).padStart(6,'0')}.json`,'CLIENT_INBOX_RESUME_INVALID');const next=checkpoint((await readPrivate(path.join(old.directory,files[i]),8192)).value,p,p.expected_upload_id!,p.expected_asset_id!);need(!cp||next.offset>=cp.offset,'CLIENT_INBOX_RESUME_INVALID');cp=next;}
  return cp!;
 }
 async function prepare(supplied:unknown){
  need(process.versions.node.split('.')[0]==='24');await helper();const p=prepareInput(supplied),identity=await sourceIdentity(p),prior=await resume(p,identity);await noLinks(workspace,'directory');
  for(const target of [path.join(workspace,'.local'),base]){try{await mkdir(target,{mode:0o700});}catch(e){need((e as NodeJS.ErrnoException).code==='EEXIST','CLIENT_INBOX_FILE_UNAVAILABLE');}await noLinks(target,'directory');}
  const id=randomUUID(),directory=dir(id);await mkdir(directory,{mode:0o700});await security.protect(directory);await security.verify(directory,'directory');
  const created=now();need(Number.isSafeInteger(created));const value:Manifest={schema_version:'1.0',handoff_id:id,nonce:randomBytes(32).toString('base64url'),created_at:new Date(created).toISOString(),expires_at:new Date(created+TTL).toISOString(),helper_sha256:HELPER_SHA,tus_sha256:TUS_SHA,preparation:p,source_identity:identity,resume:prior};const raw=JSON.stringify(value);await writeJson(path.join(directory,'manifest.json'),value);
  return{schema_version:'1.0' as const,result:'prepared' as const,handoff_id:id,nonce:value.nonce,manifest_sha256:hash(raw),manifest_file:path.join(directory,'manifest.json'),handoff_file:path.join(directory,'handoff.json'),expires_at:value.expires_at,reservation:{purpose:p.purpose,filename:path.basename(p.local_file_path),mime_type:p.mime_type,size_bytes:p.expected_size_bytes,sha256:p.expected_sha256}};
 }
 async function transfer(supplied:unknown){
  const r=closed(supplied,['handoff_id','manifest_sha256','expected_upload_id','expected_asset_id']);for(const k of ['handoff_id','expected_upload_id','expected_asset_id'])need(typeof r[k]==='string'&&UUID.test(r[k]as string));need(typeof r.manifest_sha256==='string'&&SHA.test(r.manifest_sha256));const req=r as unknown as TransferRequest;
  const lib=await helper(),m=await manifest(req.handoff_id,req.manifest_sha256),p=m.value.preparation;need(now()>=Date.parse(m.value.created_at)-5000&&now()<Date.parse(m.value.expires_at),'CLIENT_INBOX_EXPIRED');
  if(p.resume_from!==null)need(p.expected_upload_id===req.expected_upload_id&&p.expected_asset_id===req.expected_asset_id,'CLIENT_INBOX_RESUME_INVALID');
  need(same(await sourceIdentity(p),m.value.source_identity),'CLIENT_INBOX_SOURCE_CHANGED');
  const file=path.join(m.directory,'handoff.json'),read=await readPrivate(file,65536);const envelope=closed(read.value,['schema_version','handoff_id','nonce','manifest_sha256','expected_upload_id','expected_asset_id','session']);need(envelope.schema_version==='1.0'&&envelope.handoff_id===req.handoff_id&&envelope.nonce===m.value.nonce&&envelope.manifest_sha256===req.manifest_sha256&&envelope.expected_upload_id===req.expected_upload_id&&envelope.expected_asset_id===req.expected_asset_id,'CLIENT_INBOX_BINDING_INVALID');
  const input=lib.parseTransferInput({schema_version:'1.0',local_file_path:p.local_file_path,purpose:p.purpose,mime_type:p.mime_type,expected_upload_id:req.expected_upload_id,expected_asset_id:req.expected_asset_id,expected_size_bytes:p.expected_size_bytes,expected_sha256:p.expected_sha256,start_processing:p.start_processing,session:envelope.session,resume:m.value.resume});
  try{await writeJson(path.join(m.directory,'transfer-claim.json'),{schema_version:'1.0',handoff_id:req.handoff_id,manifest_sha256:req.manifest_sha256,upload_id:req.expected_upload_id,asset_id:req.expected_asset_id,dispatch_may_have_occurred:true,automatic_retry:false});}catch{fail('CLIENT_INBOX_ALREADY_USED');}
  need(same(fingerprints(await noLinks(file,'file')),read.identity),'CLIENT_INBOX_BINDING_INVALID');await unlink(file);let sequence=0;
  try{
   const result=await lib.transferLocalUpload(input,{allowedRoot:p.allowed_root,fetch:options.fetch,onCheckpoint:value=>{
    try{const cp=checkpoint(value,p,req.expected_upload_id,req.expected_asset_id);need(++sequence<=256,'CLIENT_INBOX_CHECKPOINT_UNAVAILABLE');need(realpathSync(m.directory)===m.directory&&!lstatSync(m.directory).isSymbolicLink(),'CLIENT_INBOX_CHECKPOINT_UNAVAILABLE');const target=path.join(m.directory,`checkpoint-${String(sequence).padStart(6,'0')}.json`),fd=openSync(target,'wx',0o600);try{const raw=Buffer.from(JSON.stringify(cp));let offset=0;while(offset<raw.length){const count=writeSync(fd,raw,offset,raw.length-offset);need(count>0,'CLIENT_INBOX_CHECKPOINT_UNAVAILABLE');offset+=count;}fsyncSync(fd);}finally{closeSync(fd);}
    }catch{fail('CLIENT_INBOX_CHECKPOINT_UNAVAILABLE');}
   }});await writeJson(path.join(m.directory,'result.json'),result);return{...result,handoff_id:req.handoff_id};
  }catch(error){const safe=error instanceof lib.ClientUploadError?new ClientInboxError('CLIENT_INBOX_TRANSFER_FAILED',error.code):error;await writeJson(path.join(m.directory,'result.json'),safeInboxError(safe));throw safe instanceof ClientInboxError?safe:new ClientInboxError('CLIENT_INBOX_UNCONFIRMED');}
 }
 const guarded=<T,>(operation:(value:unknown)=>Promise<T>)=>async(value:unknown):Promise<T>=>{try{return await operation(value);}catch(error){if(error instanceof ClientInboxError)throw error;throw new ClientInboxError('CLIENT_INBOX_UNCONFIRMED');}};
 return{prepare:guarded(prepare),transfer:guarded(transfer)};
}
export function safeInboxError(error:unknown){
 const allowed=new Set(['CLIENT_UPLOAD_INPUT_INVALID','CLIENT_UPLOAD_SCOPE_INVALID','CLIENT_UPLOAD_FILE_UNAVAILABLE','CLIENT_UPLOAD_FILE_CHANGED','CLIENT_UPLOAD_HASH_MISMATCH','CLIENT_UPLOAD_PROTOCOL_INVALID','CLIENT_UPLOAD_INTERRUPTED','CLIENT_UPLOAD_EXPIRED','CLIENT_UPLOAD_ACCESS_DENIED','CLIENT_UPLOAD_CONFLICT','CLIENT_UPLOAD_PAUSED','CLIENT_UPLOAD_CHECKPOINT_UNAVAILABLE']);
 if(error instanceof ClientInboxError&&CODES.has(error.code))return{schema_version:'1.0' as const,result:'failed' as const,code:error.code,...(error.transferCode&&allowed.has(error.transferCode)?{transfer_code:error.transferCode}:{})};
 return{schema_version:'1.0' as const,result:'failed' as const,code:'CLIENT_INBOX_UNCONFIRMED' as const};
}
export async function runInboxCli(argv:string[]){
 try{const[action,...args]=argv;need(args.length%2===0);const pairs:Record<string,string>={};for(let i=0;i<args.length;i+=2){need(args[i].startsWith('--')&&!Object.hasOwn(pairs,args[i]));pairs[args[i]]=args[i+1];}const tool=makeUploadInbox();
  if(action==='transfer'){closed(pairs,['--handoff-id','--manifest-sha','--upload-id','--asset-id']);return await tool.transfer({handoff_id:pairs['--handoff-id'],manifest_sha256:pairs['--manifest-sha'],expected_upload_id:pairs['--upload-id'],expected_asset_id:pairs['--asset-id']});}
  need(action==='prepare');const extras=Object.hasOwn(pairs,'--resume-from');closed(pairs,['--allowed-root','--file','--purpose','--mime','--size','--sha256',...(extras?['--resume-from','--upload-id','--asset-id']:[])]);need(String(Number(pairs['--size']))===pairs['--size']);return await tool.prepare({schema_version:'1.0',allowed_root:pairs['--allowed-root'],local_file_path:pairs['--file'],purpose:pairs['--purpose'],mime_type:pairs['--mime'],expected_size_bytes:Number(pairs['--size']),expected_sha256:pairs['--sha256'],start_processing:pairs['--purpose']==='candidate_video',resume_from:extras?pairs['--resume-from']:null,expected_upload_id:extras?pairs['--upload-id']:null,expected_asset_id:extras?pairs['--asset-id']:null});
 }catch(error){return safeInboxError(error);}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){void runInboxCli(process.argv.slice(2)).then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(result.result==='failed')process.exitCode=1;});}
