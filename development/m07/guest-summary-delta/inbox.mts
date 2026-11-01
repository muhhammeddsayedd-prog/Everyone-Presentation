/** Owner-controlled private capability inbox. No producer credentials or account discovery. */
import { randomBytes, randomUUID } from 'node:crypto';
import type { BigIntStats } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { windowsInboxSecurity, type InboxSecurity } from '../../../tools/client-upload-inbox.mts';
import { readPrivateInput } from '../../../tools/client-upload-transfer.mts';
import { closed, GuestDeltaError, need, parsePrivateSession, parseProbeInput, probeGuestSummary, sha, timestamp, token, uuid, validateGuestDenial, verifyGuestDenial } from './probe.mts';

const CODE_ROOT=path.resolve(import.meta.dirname,'../../..'),TTL=1800000;
const SOURCES=['development/m07/guest-summary-delta/probe.mts','development/m07/guest-summary-delta/inbox.mts','tools/client-upload-inbox.mts','tools/client-upload-transfer.mts','packages/domain/src/feedback-summary.ts','packages/domain/src/guest.ts'];
const identity=(value:BigIntStats)=>[value.dev,value.ino,value.size,value.mtimeNs,value.ctimeNs].map(String).join(':');
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
interface Options{workspaceRoot?:string;security?:InboxSecurity;fetch?:typeof fetch;now?:()=>number}
interface Manifest{schema_version:'1.0';run_id:string;nonce:string;version_id:string;denied_version_id:string;created_at:string;expires_at:string;sources:Record<string,string>}
function claimInput(value:unknown){const row=closed(value,['run_id','manifest_sha256']);need(typeof row.manifest_sha256==='string'&&/^[a-f0-9]{64}$/u.test(row.manifest_sha256));return{run_id:uuid(row.run_id),manifest_sha256:row.manifest_sha256};}
async function regular(target:string,kind:'directory'|'file'){
 need(path.isAbsolute(target)&&!target.startsWith('\\'),'GUEST_DELTA_PATH_INVALID');const resolved=path.resolve(target);need(await realpath(resolved)===resolved,'GUEST_DELTA_PATH_INVALID');let at=path.parse(resolved).root;
 for(const component of path.relative(at,resolved).split(path.sep)){at=path.join(at,component);need(!(await lstat(at)).isSymbolicLink(),'GUEST_DELTA_PATH_INVALID');}
 const stat=await lstat(resolved,{bigint:true});need(kind==='directory'?stat.isDirectory():stat.isFile()&&stat.nlink===1n,'GUEST_DELTA_PATH_INVALID');return stat;
}
async function sourceSeals(){const rows:Record<string,string>={};for(const file of SOURCES){await regular(path.join(CODE_ROOT,file),'file');rows[file]=sha(await readFile(path.join(CODE_ROOT,file)));}return rows;}
export function makeGuestDeltaInbox(options:Options={}){
 const workspace=path.resolve(options.workspaceRoot??CODE_ROOT),base=path.join(workspace,'.local/guest-summary-delta'),security=options.security??windowsInboxSecurity(),now=options.now??Date.now;
 const directory=(id:string)=>path.join(base,uuid(id));
 async function readPrivate(file:string){
  const before=await regular(file,'file');need(before.size>0n&&before.size<=65536n,'GUEST_DELTA_PRIVATE_FILE_INVALID');await security.verify(file,'file');const handle=await open(file,'r');const buffer=Buffer.alloc(65537);let size=0;
  try{need(identity(await handle.stat({bigint:true}))===identity(before));for(;;){const part=await handle.read(buffer,size,buffer.length-size,null);if(!part.bytesRead)break;size+=part.bytesRead;need(size<=65536,'GUEST_DELTA_PRIVATE_FILE_INVALID');}
   need(identity(await regular(file,'file'))===identity(before)&&identity(await handle.stat({bigint:true}))===identity(before));return{value:await readPrivateInput((async function*(){yield buffer.subarray(0,size);})()),identity:identity(before),sha256:sha(buffer.subarray(0,size))};
  }finally{buffer.fill(0);await handle.close();}
 }
 async function writePrivate(file:string,value:unknown){await regular(path.dirname(file),'directory');await security.verify(path.dirname(file),'directory');const handle=await open(file,'wx',0o600);try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}await security.verify(file,'file');}
 async function load(id:string,expectedSha:string,requireFresh:boolean){
  const dir=directory(id);await regular(dir,'directory');await security.verify(dir,'directory');const read=await readPrivate(path.join(dir,'manifest.json'));need(read.sha256===expectedSha,'GUEST_DELTA_BINDING_INVALID');
  const row=closed(read.value,['schema_version','run_id','nonce','version_id','denied_version_id','created_at','expires_at','sources']);need(row.schema_version==='1.0'&&row.run_id===id);uuid(row.version_id);uuid(row.denied_version_id);token(row.nonce);timestamp(row.created_at);timestamp(row.expires_at);need(Date.parse(row.expires_at as string)-Date.parse(row.created_at as string)===TTL&&same(row.sources,await sourceSeals()),'GUEST_DELTA_SOURCE_OR_BINDING_CHANGED');
  const created=Date.parse(row.created_at as string);need(now()>=created-5000&&now()<created+(requireFresh?TTL:3600000),'GUEST_DELTA_EXPIRED');return{dir,value:row as unknown as Manifest};
 }
 async function publicReceipt(id:string,phase:string,value:unknown){
  let target=workspace;for(const part of['tracking','evidence','m07','guest-summary-delta']){target=path.join(target,part);try{await mkdir(target);}catch(error){need((error as NodeJS.ErrnoException).code==='EEXIST');}await regular(target,'directory');}
  const file=path.join(target,`${new Date(now()).toISOString().replaceAll(':','-')}-${id}-${phase}.json`);const handle=await open(file,'wx');try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}return file;
 }
 async function prepare(value:unknown){
  const row=closed(value,['version_id','denied_version_id']);const version_id=uuid(row.version_id),denied_version_id=uuid(row.denied_version_id);need(version_id!==denied_version_id);await regular(workspace,'directory');
  for(const dir of[path.join(workspace,'.local'),base]){try{await mkdir(dir,{mode:0o700});}catch(error){need((error as NodeJS.ErrnoException).code==='EEXIST');}await regular(dir,'directory');}
  const id=randomUUID(),dir=directory(id);await mkdir(dir,{mode:0o700});await security.protect(dir);await security.verify(dir,'directory');const created=now();need(Number.isSafeInteger(created));
  const manifest:Manifest={schema_version:'1.0',run_id:id,nonce:randomBytes(32).toString('base64url'),version_id,denied_version_id,created_at:new Date(created).toISOString(),expires_at:new Date(created+TTL).toISOString(),sources:await sourceSeals()};await writePrivate(path.join(dir,'manifest.json'),manifest);
  return{schema_version:'1.0',result:'prepared',run_id:id,nonce:manifest.nonce,manifest_sha256:sha(JSON.stringify(manifest)),handoff_file:path.join(dir,'handoff.json'),expires_at:manifest.expires_at};
 }
 async function probe(value:unknown){
  const request=claimInput(value),loaded=await load(request.run_id,request.manifest_sha256,true),file=path.join(loaded.dir,'handoff.json');const read=await readPrivate(file);const input=closed(read.value,['schema_version','run_id','nonce','manifest_sha256','probe']);need(input.schema_version==='1.0'&&input.run_id===request.run_id&&input.nonce===loaded.value.nonce&&input.manifest_sha256===request.manifest_sha256,'GUEST_DELTA_BINDING_INVALID');
  const probeInput=parseProbeInput(input.probe);need(probeInput.version_id===loaded.value.version_id&&probeInput.denied_version_id===loaded.value.denied_version_id,'GUEST_DELTA_BINDING_INVALID');need(now()<Date.parse(probeInput.link_expires_at),'GUEST_DELTA_LINK_ALREADY_EXPIRED');
  await writePrivate(path.join(loaded.dir,'probe-claim.json'),{schema_version:'1.0',run_id:request.run_id,review_link_id:probeInput.review_link_id,dispatch_may_have_occurred:true,automatic_retry:false});need(identity(await regular(file,'file'))===read.identity,'GUEST_DELTA_BINDING_INVALID');await unlink(file);
  try{const result=await probeGuestSummary(probeInput,{fetch:options.fetch,now});await writePrivate(path.join(loaded.dir,'session.json'),result.privateSession);const receipt_file=await publicReceipt(request.run_id,'probe',{...result.evidence,run_id:request.run_id,manifest_sha256:request.manifest_sha256,source_seals:loaded.value.sources,probe_input_capability_file_removed:true,capabilities_retained_only_in_private_session:true});return{schema_version:'1.0',result:'passed',run_id:request.run_id,review_link_id:probeInput.review_link_id,receipt_file,next:'Owner performs the declared link revocation or waits for its known expiry; run deny once.'};}
  catch(error){await publicReceipt(request.run_id,'probe-failed',{...safeResult(error),run_id:request.run_id,review_link_id:probeInput.review_link_id,dispatch_may_have_occurred:true,automatic_retry:false,owner_revoke_required:true});throw error;}
 }
 async function deny(value:unknown){
  const row=closed(value,['run_id','manifest_sha256','reason']);need(row.reason==='expired'||row.reason==='revoked');const request=claimInput({run_id:row.run_id,manifest_sha256:row.manifest_sha256});const loaded=await load(request.run_id,request.manifest_sha256,false);const claim=closed((await readPrivate(path.join(loaded.dir,'probe-claim.json'))).value,['schema_version','run_id','review_link_id','dispatch_may_have_occurred','automatic_retry']);need(claim.schema_version==='1.0'&&claim.run_id===request.run_id&&claim.dispatch_may_have_occurred===true&&claim.automatic_retry===false);
  const sessionFile=path.join(loaded.dir,'session.json'),read=await readPrivate(sessionFile),session=parsePrivateSession(read.value);need(session.version_id===loaded.value.version_id&&session.review_link_id===claim.review_link_id,'GUEST_DELTA_BINDING_INVALID');
  validateGuestDenial(session,row.reason,now());await writePrivate(path.join(loaded.dir,`deny-${row.reason}-claim.json`),{schema_version:'1.0',run_id:request.run_id,reason:row.reason,dispatch_may_have_occurred:true,automatic_retry:false});
  try{const result=await verifyGuestDenial(session,row.reason,{fetch:options.fetch,now});need(identity(await regular(sessionFile,'file'))===read.identity);await unlink(sessionFile);const receipt_file=await publicReceipt(request.run_id,`deny-${row.reason}`,{...result,run_id:request.run_id,manifest_sha256:request.manifest_sha256,source_seals:loaded.value.sources,private_session_file_removed:true});return{schema_version:'1.0',result:'passed',run_id:request.run_id,review_link_id:session.review_link_id,receipt_file,private_session_file_removed:true};}
  catch(error){await publicReceipt(request.run_id,`deny-${row.reason}-failed`,{...safeResult(error),run_id:request.run_id,review_link_id:session.review_link_id,dispatch_may_have_occurred:true,automatic_retry:false,owner_revoke_required:true});throw error;}
 }
 const guarded=<T,>(fn:(input:unknown)=>Promise<T>)=>async(value:unknown)=>{try{return await fn(value);}catch(error){if(error instanceof GuestDeltaError)throw error;throw new GuestDeltaError();}};
 return{prepare:guarded(prepare),probe:guarded(probe),deny:guarded(deny)};
}
const SAFE_CODES=new Set(['GUEST_DELTA_UNCONFIRMED','GUEST_DELTA_PATH_INVALID','GUEST_DELTA_PRIVATE_FILE_INVALID','GUEST_DELTA_BINDING_INVALID','GUEST_DELTA_SOURCE_OR_BINDING_CHANGED','GUEST_DELTA_EXPIRED','GUEST_DELTA_INPUT_INVALID','GUEST_DELTA_SESSION_INVALID','GUEST_DELTA_LINK_ALREADY_EXPIRED','GUEST_DELTA_SUMMARY_MISMATCH','GUEST_DELTA_RELOAD_MISMATCH','GUEST_DELTA_SESSION_TOO_OLD','GUEST_DELTA_EXPIRY_NOT_REACHED','GUEST_DELTA_LIFECYCLE_AMBIGUOUS']);
export function safeResult(error:unknown){return{schema_version:'1.0',result:'failed',code:error instanceof GuestDeltaError&&SAFE_CODES.has(error.code)?error.code:'GUEST_DELTA_UNCONFIRMED'};}
export async function runCli(argv:string[]){try{const[action,...args]=argv;need(args.length%2===0);const pairs:Record<string,string>={};for(let i=0;i<args.length;i+=2){need(args[i].startsWith('--')&&!Object.hasOwn(pairs,args[i]));pairs[args[i]]=args[i+1];}const tool=makeGuestDeltaInbox();if(action==='prepare'){closed(pairs,['--version-id','--denied-version-id']);return await tool.prepare({version_id:pairs['--version-id'],denied_version_id:pairs['--denied-version-id']});}if(action==='probe'){closed(pairs,['--run-id','--manifest-sha']);return await tool.probe({run_id:pairs['--run-id'],manifest_sha256:pairs['--manifest-sha']});}need(action==='deny');closed(pairs,['--run-id','--manifest-sha','--reason']);return await tool.deny({run_id:pairs['--run-id'],manifest_sha256:pairs['--manifest-sha'],reason:pairs['--reason']});}catch(error){return safeResult(error);}}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)void runCli(process.argv.slice(2)).then(result=>{process.stdout.write(JSON.stringify(result)+'\n');if(result.result==='failed')process.exitCode=1;});
