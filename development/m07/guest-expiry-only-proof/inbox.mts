/** Existing owner/SYSTEM private custody pattern; no producer auth or key loader. */
import {randomUUID}from 'node:crypto';
import type {BigIntStats}from 'node:fs';
import {lstat,mkdir,open,readFile,realpath}from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL}from 'node:url';
import {windowsInboxSecurity,type InboxSecurity}from '../../../tools/client-upload-inbox.mts';
import {readPrivateInput}from '../../../tools/client-upload-transfer.mts';
import {closed,need,sha,uuid}from '../guest-summary-delta/probe.mts';
import {beforeExpiry,afterExpiry,parseInput,parseState,LIVE_HTTP_ENABLED,SERIES,VERSION,type Ports}from './client.mts';

const CODE_ROOT=path.resolve(import.meta.dirname,'../../..'),PURPOSE='guest-expiry-only-proof';
const SOURCES=['development/m07/guest-expiry-only-proof/client.mts','development/m07/guest-expiry-only-proof/inbox.mts','development/m07/guest-summary-delta/probe.mts','tools/client-upload-inbox.mts','tools/client-upload-transfer.mts','packages/domain/src/guest.ts','packages/domain/src/feedback-summary.ts','apps/web/components/guest-pdf-transfer.ts','apps/web/lib/guest-http.ts','packages/central/src/guest-reviews.ts','packages/central/src/guest-storage.ts'];
const fingerprint=(s:BigIntStats)=>[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs,s.nlink].map(String).join(':');
interface Options{workspaceRoot?:string;security?:InboxSecurity;fetch?:typeof fetch;now?:()=>number;sleep?:Ports['sleep']}
async function regular(target:string,kind:'file'|'directory'){
 need(path.isAbsolute(target)&&!target.startsWith('\\'));need(await realpath(target)===path.resolve(target));let at=path.parse(target).root;
 for(const part of path.relative(at,target).split(path.sep)){at=path.join(at,part);need(!(await lstat(at)).isSymbolicLink());}
 const stat=await lstat(target,{bigint:true});need(kind==='directory'?stat.isDirectory():stat.isFile()&&stat.nlink===1n);return stat;
}
async function seals(){const out:Record<string,string>={};for(const file of SOURCES){await regular(path.join(CODE_ROOT,file),'file');out[file]=sha(await readFile(path.join(CODE_ROOT,file)));}return out;}
export function makeExpiryInbox(options:Options={}){
 const workspace=path.resolve(options.workspaceRoot??CODE_ROOT),base=path.join(workspace,'.local',PURPOSE),security=options.security??windowsInboxSecurity(),now=options.now??Date.now;
 async function readPrivate(file:string){
  const before=await regular(file,'file');need(before.size>0n&&before.size<=65536n);await security.verify(file,'file');const handle=await open(file,'r'),bytes=Buffer.alloc(65537);let size=0;
  try{need(fingerprint(await handle.stat({bigint:true}))===fingerprint(before));for(;;){const part=await handle.read(bytes,size,bytes.length-size,null);if(!part.bytesRead)break;size+=part.bytesRead;need(size<=65536);}
   need(fingerprint(await regular(file,'file'))===fingerprint(before)&&fingerprint(await handle.stat({bigint:true}))===fingerprint(before));
   return{value:await readPrivateInput((async function*(){yield bytes.subarray(0,size);})()),sha256:sha(bytes.subarray(0,size))};
  }finally{bytes.fill(0);await handle.close();}
 }
 async function write(dir:string,name:string,value:unknown,raw=false){
  need(/^[a-z0-9][a-z0-9.-]{0,79}$/u.test(name));await regular(dir,'directory');await security.verify(dir,'directory');
  const bytes=raw?value as Uint8Array:Buffer.from(JSON.stringify(value));need(bytes instanceof Uint8Array&&bytes.length<=(raw?64*1024*1024:65536));
  const file=path.join(dir,name),handle=await open(file,'wx',0o600);try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}await regular(file,'file');await security.verify(file,'file');return sha(bytes);
 }
 async function publish(run:string,phase:string,value:unknown){
  let dir=workspace;for(const part of['tracking','evidence','m07',PURPOSE]){dir=path.join(dir,part);try{await mkdir(dir);}catch(e){need((e as NodeJS.ErrnoException).code==='EEXIST');}await regular(dir,'directory');}
  const file=path.join(dir,new Date(now()).toISOString().replaceAll(':','-')+'-'+uuid(run)+'-'+phase+'.json'),handle=await open(file,'wx');
  try{await handle.writeFile(JSON.stringify(value,null,2)+'\n');await handle.sync();}finally{await handle.close();}return path.relative(workspace,file).replaceAll('\\','/');
 }
 async function prepare(){
  await regular(workspace,'directory');for(const dir of[path.join(workspace,'.local'),base]){try{await mkdir(dir,{mode:0o700});}catch(e){need((e as NodeJS.ErrnoException).code==='EEXIST');}await regular(dir,'directory');}
  const run_id=randomUUID(),dir=path.join(base,run_id);await mkdir(dir,{mode:0o700});await security.protect(dir);await security.verify(dir,'directory');
  const manifest={schema_version:'1.0',purpose:PURPOSE,run_id,series_id:SERIES,version_id:VERSION,created_at:new Date(now()).toISOString(),sources:await seals()};
  const manifest_sha256=await write(dir,'manifest.json',manifest);
  return{result:'prepared',run_id,manifest_sha256,input_file:path.join(dir,'input.json'),live_HTTP_enabled:LIVE_HTTP_ENABLED};
 }
 async function phase(value:unknown,phase:'before'|'after'){
  need(LIVE_HTTP_ENABLED||Boolean(options.fetch));const request=closed(value,['run_id','manifest_sha256']),run=uuid(request.run_id);need(typeof request.manifest_sha256==='string'&&/^[a-f0-9]{64}$/u.test(request.manifest_sha256));
  const dir=path.join(base,run);await regular(dir,'directory');await security.verify(dir,'directory');const manifestRead=await readPrivate(path.join(dir,'manifest.json'));need(manifestRead.sha256===request.manifest_sha256);
  const manifest=closed(manifestRead.value,['schema_version','purpose','run_id','series_id','version_id','created_at','sources']);need(manifest.schema_version==='1.0'&&manifest.purpose===PURPOSE&&manifest.run_id===run&&manifest.series_id===SERIES&&manifest.version_id===VERSION);
  need(JSON.stringify(manifest.sources)===JSON.stringify(await seals())&&typeof manifest.created_at==='string'&&now()>=Date.parse(manifest.created_at)-5000&&now()-Date.parse(manifest.created_at)<7200000);
  const inputRead=await readPrivate(path.join(dir,'input.json')),input=parseInput(inputRead.value);need(input.run_id===run);
  let state:ReturnType<typeof parseState>|undefined;
  if(phase==='after'){
   state=parseState((await readPrivate(path.join(dir,'before-state.json'))).value);const normal=closed((await readPrivate(path.join(dir,'before-normal.json'))).value,['run_id','state_sha256','receipt_file']);
   need(normal.run_id===run&&normal.state_sha256===(await readPrivate(path.join(dir,'before-state.json'))).sha256&&JSON.stringify(state.input)===JSON.stringify(input));
   need(now()>=Date.parse(input.expires_at)+2000);
  }else need(now()<Date.parse(input.expires_at));
  await write(dir,phase+'-dispatched.json',{run_id:run,input_sha256:inputRead.sha256,manifest_sha256:request.manifest_sha256,automatic_retry:false});
  const phaseDir=path.join(dir,phase);await mkdir(phaseDir,{mode:0o700});await security.protect(phaseDir);await security.verify(phaseDir,'directory');
  // before-state must survive reload at the parent; every other response/byte
  // remains under this phase's protected, once-only custody directory.
  const ports:Ports={fetch:options.fetch,now,sleep:options.sleep,save:(name,data)=>write(name==='before-state.json'?dir:phaseDir,name,data).then(()=>{}),saveBytes:(name,data)=>write(phaseDir,name,data,true).then(()=>{})};
  try{
   const result=phase==='before'?await beforeExpiry(input,ports):await afterExpiry(state,ports);
   const evidence='evidence'in result?result.evidence:result;
   const receipt_file=await publish(run,phase,{...evidence,source_seals:manifest.sources,manifest_sha256:request.manifest_sha256});
   if(phase==='before')await write(dir,'before-normal.json',{run_id:run,state_sha256:(await readPrivate(path.join(dir,'before-state.json'))).sha256,receipt_file});
   else await write(dir,'after-normal.json',{run_id:run,receipt_file,automatic_retry:false});
   return{result:'passed',run_id:run,phase,receipt_file,link_cleanup_remains_Root_owned:true};
  }catch{
   const receipt_file=await publish(run,phase+'-unconfirmed',{result:'unconfirmed',code:'GUEST_EXPIRY_PROOF_UNCONFIRMED',run_id:run,phase,automatic_retry:false,claims_and_private_state_preserved:true});
   return{result:'unconfirmed',code:'GUEST_EXPIRY_PROOF_UNCONFIRMED',run_id:run,phase,receipt_file,automatic_retry:false};
  }
 }
 return{prepare,before:(v:unknown)=>phase(v,'before'),after:(v:unknown)=>phase(v,'after')};
}
export async function runCli(argv:string[]){
 try{const[action,...args]=argv;if(action==='prepare'){need(args.length===0);return await makeExpiryInbox().prepare();}
  need(action==='before'||action==='after');need(args.length===4&&args[0]==='--run-id'&&args[2]==='--manifest-sha');return await makeExpiryInbox()[action]({run_id:args[1],manifest_sha256:args[3]});
 }catch{return{result:'unconfirmed',code:'GUEST_EXPIRY_PROOF_UNCONFIRMED',automatic_retry:false};}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)void runCli(process.argv.slice(2)).then(value=>{process.stdout.write(JSON.stringify(value)+'\n');if(value.result==='unconfirmed')process.exitCode=1;});
