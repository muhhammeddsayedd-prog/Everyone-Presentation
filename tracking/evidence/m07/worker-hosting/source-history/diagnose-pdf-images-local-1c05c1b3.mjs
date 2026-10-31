/** Root-executed public synthetic local Docker diagnosis. Importing performs no IO. */
import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {spawn} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {lstat,mkdir,open,readFile,realpath,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
import {boundedCommand} from '../development/m07/specs-ack31/local-command.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const SOURCE='3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3';
export const IMAGE_TAG='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/native:pilot-77e14c2e';
export const INDEX_DIGEST='sha256:13cb1bd24185aae8b9d3f0bbf91dd3214c517163e2eb10e9e3e3cb2f3cbfd2c0';
export const NATIVE_DIGEST='sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06';
const REPO=IMAGE_TAG.split(':pilot-')[0],HOST=process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock';
const LOCK=path.join(ROOT,'.local/m07-pilot/pdf-images-local.lock.json');
const sha=b=>createHash('sha256').update(b).digest('hex'),imageId=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/u.test(v);
const fields=['name_or_id','age_or_range','height_measurements','languages_accents','skills_experience','city','previous_projects_roles','classification','availability','presentation_notes'];
const checkpoints=new Set(['input','document_security','page_geometry','text_regions','video_links','pdf_operators','font_embedding','font_glyphs','image_operators','unsupported_image_operator','image_dimensions',...fields.map(v=>'region_'+v),'region_position']);
const checkpoint=v=>v===null||checkpoints.has(v)||typeof v==='string'&&/^region_label_[0-9]{1,3}$/u.test(v);
const codes=new Set(['PDF_TEMPLATE_MISMATCH','PDF_ASSET_INVALID','PDF_OVERFLOW','PDF_RENDER_FAILED','PDF_VALIDATION_FAILED','PDF_ABORTED','PDF_BUDGET_EXCEEDED','LOCAL_DIAGNOSTIC_FAILED']);
export function imageIdentity(value){
 assert(Array.isArray(value)&&value.length===1);const v=value[0];assert(imageId(v.Id)&&v.Os==='linux'&&v.Architecture==='amd64'&&v.Config?.User==='0:0');
 assert(v.RepoTags?.includes(IMAGE_TAG));const digest=v.Descriptor?.digest;
 assert([INDEX_DIGEST,NATIVE_DIGEST].includes(digest)||v.RepoDigests?.some(item=>[REPO+'@'+INDEX_DIGEST,REPO+'@'+NATIVE_DIGEST].includes(item)),'PDF_DIAG_IMMUTABLE_IMAGE_IDENTITY_REQUIRED');
 return{image_id:v.Id,index_digest:INDEX_DIGEST,native_manifest_digest:NATIVE_DIGEST,architecture:'amd64',os:'linux'};
}
export const NATIVE_PROGRAM=String.raw`
import {readFileSync,lstatSync} from 'node:fs';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
const output={schema_version:'1.0',stage:'source',result:'failed',code:'LOCAL_DIAGNOSTIC_FAILED',checkpoint:null,uid:process.getuid(),gid:process.getgid(),caps_cleared:false,no_new_privileges:false,pages:0,frames:0,rendered_bytes:0,rendered_fields:0,rendered_frame_draws:0,validated_image_draws:null,inspector_child_seen:false,inspector_exit_code:null,inspector_error_flags:{access_denied:false,module_missing:false,addon_load:false}};
let stderr='';const original=childProcess.spawn;
childProcess.spawn=function(exe,args,options){const child=original(exe,args,options);if(Array.isArray(args)&&args.some(v=>typeof v==='string'&&v.endsWith('/presentation-pdf-inspect-process.mjs'))){output.inspector_child_seen=true;child.stderr.on('data',chunk=>{if(stderr.length<65536)stderr+=chunk.toString('utf8').slice(0,65536-stderr.length);});child.on('close',code=>{output.inspector_exit_code=Number.isInteger(code)&&code>=0&&code<=255?code:null;});}return child;};syncBuiltinESMExports();
try{
 const status=readFileSync('/proc/self/status','utf8');output.caps_cleared=/^CapEff:\s+0+$/mu.test(status)&&/^CapBnd:\s+0+$/mu.test(status);output.no_new_privileges=/^NoNewPrivs:\s+1$/mu.test(status);
 if(output.uid!==65432||output.gid!==65432||!output.caps_cleared||!output.no_new_privileges||Object.entries(process.env).some(([key,value])=>value&&/OPENAI|SUPABASE|N8N|OIDC|VERCEL|EPS_SPECS_PG/u.test(key)))throw Error('identity');
 const {verifyNativeSourceSeal}=await import('/opt/eps/apps/worker/src/native-source-seal.ts');const source=JSON.parse(readFileSync('/opt/eps/apps/worker/native-source.json','utf8'));
 verifyNativeSourceSeal(source,'3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3',relative=>{const file='/opt/eps/'+relative,stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('source');return readFileSync(file);});
 output.stage='input';const parts=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>2*1024*1024)throw Error('input');parts.push(chunk);}
 const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(Object.keys(value).sort().join(',')!=='images,snapshot'||!Array.isArray(value.images)||value.images.length!==2||![2,6].includes(value.snapshot?.slides?.length))throw Error('input');
 const images=new Map(value.images.map(([id,bytes])=>[id,new Uint8Array(Buffer.from(bytes,'base64'))]));output.pages=value.snapshot.slides.length;output.frames=images.size;
 const pdf=await import('/opt/eps/apps/worker/src/presentation-pdf.ts');output.stage='render';const rendered=await pdf.renderPresentationPdf(value.snapshot,images,{timeoutMs:90000});output.rendered_bytes=rendered.bytes.length;output.rendered_fields=rendered.proof.candidate_field_count;output.rendered_frame_draws=rendered.proof.frame_draw_count;
 output.stage='validate';const proof=await pdf.validatePresentationPdf(value.snapshot,images,rendered.bytes,{timeoutMs:90000});output.validated_image_draws=proof.image_draws_checked;output.result='passed';output.code=null;output.stage='complete';
}catch(error){if(typeof error?.code==='string'&&/^PDF_[A-Z_]{1,80}$/u.test(error.code))output.code=error.code;if(typeof error?.checkpoint==='string'&&/^[a-z_0-9]{1,40}$/u.test(error.checkpoint))output.checkpoint=error.checkpoint;}
output.inspector_error_flags={access_denied:/ERR_ACCESS_DENIED|Access to this API has been restricted/u.test(stderr),module_missing:/ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/u.test(stderr),addon_load:/ERR_DLOPEN_FAILED|Cannot load native binding/u.test(stderr)};
process.stdout.write(JSON.stringify(output));
`;
export function containerArguments(id,run){
 assert(imageId(id)&&/^[a-f0-9-]{36}$/u.test(run));return['create','--name','eps-pdf-images-'+run,'--pull=never','--platform=linux/amd64','--read-only','--network=none','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65432:65432','--pids-limit=256','--memory=2g','--cpus=1','--shm-size=16m','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=384m,mode=1777',
 '--label','com.everyone.presentation.owner=pdf-images-local','--label','com.everyone.presentation.run='+run,'--label','com.everyone.presentation.source='+SOURCE,
 '--env','NODE_ENV=production','--env','HOME=/tmp','--env','TMPDIR=/tmp','--env','LANG=C','--env','LC_ALL=C','--env','PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright','-i','--entrypoint','/usr/bin/prlimit',id,
 '--cpu=190','--nproc=256','--nofile=256','--fsize=4194304','--core=0','--','/usr/local/bin/node','--import','tsx','--max-old-space-size=512','--input-type=module','--eval',NATIVE_PROGRAM];
}
export function projectNativeResult(value){
 const keys=['schema_version','stage','result','code','checkpoint','uid','gid','caps_cleared','no_new_privileges','pages','frames','rendered_bytes','rendered_fields','rendered_frame_draws','validated_image_draws','inspector_child_seen','inspector_exit_code','inspector_error_flags'];
 assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),keys.sort());assert(value.schema_version==='1.0'&&['source','input','render','validate','complete'].includes(value.stage)&&['failed','passed'].includes(value.result));
 assert(value.code===null&&value.result==='passed'||codes.has(value.code)&&value.result==='failed');assert(checkpoint(value.checkpoint));assert(value.uid===65432&&value.gid===65432&&value.caps_cleared===true&&value.no_new_privileges===true);
 for(const key of['pages','frames','rendered_bytes','rendered_fields','rendered_frame_draws'])assert(Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=64*1024*1024);
 assert(value.validated_image_draws===null||Number.isSafeInteger(value.validated_image_draws)&&value.validated_image_draws>=0&&value.validated_image_draws<=100);
 assert(typeof value.inspector_child_seen==='boolean'&&(value.inspector_exit_code===null||Number.isInteger(value.inspector_exit_code)&&value.inspector_exit_code>=0&&value.inspector_exit_code<=255));
 assert.deepEqual(Object.keys(value.inspector_error_flags).sort(),['access_denied','addon_load','module_missing']);assert(Object.values(value.inspector_error_flags).every(v=>typeof v==='boolean'));return JSON.parse(JSON.stringify(value));
}
async function main(){
 assert(process.argv.length===3&&['two-frames','six-pages'].includes(process.argv[2]));const forbidden=new Set(['NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE']);assert(!Object.entries(process.env).some(([key,value])=>forbidden.has(key.toUpperCase())&&value));const mode=process.argv[2],run=randomUUID(),name='eps-pdf-images-'+run;let image,cid,attempted=false,locked=false,unknown=false;
 const report={schema_version:'1.0',observed_at:new Date().toISOString(),run_id:run,container_name:name,mode,result:'unconfirmed',environment:'isolated-local-docker',source_sha256:SOURCE,native_manifest_digest:NATIVE_DIGEST,native_program_sha256:sha(NATIVE_PROGRAM),cloud_called:false,database_called:false,private_inputs_used:false,worker_or_proof_source_changed:false,command_processes_unconfirmed:[]};
 const environment=Object.fromEntries(['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG','LC_ALL'].filter(key=>process.env[key]!==undefined).map(key=>[key,process.env[key]]));
 const command=(args,options={})=>boundedCommand(spawn,'docker',['--host',HOST,...args],{cwd:ROOT,environment,maximumBytes:2*1024*1024,...options,onUnconfirmed:value=>{unknown=true;report.command_processes_unconfirmed.push(value);}});
 async function inspectOwned(){const result=await command(['container','inspect',name],{allowFailure:true});if(result.code!==0){assert(result.stderr.includes('No such container: '+name)||result.stderr.includes('No such object: '+name));return null;}
  const values=JSON.parse(result.stdout);assert(Array.isArray(values)&&values.length===1);const v=values[0],labels=v.Config?.Labels;assert(v.Name==='/'+name&&v.Image===image.image_id&&v.Config?.Image===image.image_id&&labels?.['com.everyone.presentation.owner']==='pdf-images-local'&&labels?.['com.everyone.presentation.run']===run&&labels?.['com.everyone.presentation.source']===SOURCE);if(cid)assert.equal(v.Id,cid);assert(/^[a-f0-9]{64}$/u.test(v.Id));
  assert(v.Config.User==='65432:65432'&&v.HostConfig.ReadonlyRootfs===true&&v.HostConfig.Privileged===false&&v.HostConfig.NetworkMode==='none'&&v.HostConfig.Memory===2147483648&&v.HostConfig.PidsLimit===256&&v.HostConfig.CapDrop?.includes('ALL')&&v.HostConfig.SecurityOpt?.some(option=>['no-new-privileges','no-new-privileges=true'].includes(option)));assert((v.Mounts??[]).every(m=>m.Type==='tmpfs'&&m.Destination==='/tmp'));return v;}
 try{
  assert.equal(sha(await readFile(path.join(ROOT,'development/m07/specs-ack31/local-command.mjs'))),'72ce47d9595d7aafc3e530938cbdd8c20a8d3e1aea3d4308a0baaece151de969');
  const manifestFile=path.join(ROOT,'.local/worker-hosting/77e14c2e-5ae9-4aa6-aec0-636f789c4625/context/apps/worker/native-sandbox-manifest.json');assert.equal(await realpath(manifestFile),manifestFile);assert((await lstat(manifestFile)).isFile());assert.equal(sha(await readFile(manifestFile)),'ea963472650fa839076ab0c68c951f839f4820e4e04f55ae5c9c476e3c457ac0');
  const manifest=JSON.parse(await readFile(manifestFile));assert.equal(manifest.source_sha256,SOURCE);assert.equal(manifest.image,'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+NATIVE_DIGEST);
  const stateBytes=await readFile(path.join(ROOT,'tracking/evidence/m07/controlled-pilot/2026-10-31T00-44-08.947Z-7e02ff9b-runtime-state.json'));assert.equal(sha(stateBytes),'786887680739a25bef353a5f11aa64e876bc9d1b8ee315c0a180186cc9b4d73d');
  const listing=JSON.parse(stateBytes).images.images;assert(listing.some(v=>v.manifest_digest===NATIVE_DIGEST&&v.status==='ready'&&v.architecture==='amd64')&&listing.some(v=>v.manifest_digest===INDEX_DIGEST&&v.tags.includes('pilot-77e14c2e')));
  image=imageIdentity(JSON.parse((await command(['image','inspect',IMAGE_TAG])).stdout));report.image=image;
  const {nativePresentation}=await import('../tests/worker/presentation-native-fixture.ts');const{snapshot,images}=nativePresentation(mode==='two-frames'?[2]:[0,0,0,0,2],false);assert.equal(images.size,2);
  const payload=JSON.stringify({snapshot,images:[...images].map(([id,bytes])=>[id,Buffer.from(bytes).toString('base64')])});assert(Buffer.byteLength(payload)<2*1024*1024);report.fixture={synthetic:true,pages:snapshot.slides.length,frames:images.size,logo:false};
  await mkdir(path.dirname(LOCK),{recursive:true});const lock=await open(LOCK,'wx',0o600);locked=true;await lock.writeFile(JSON.stringify({run_id:run,name,image_id:image.image_id,source_sha256:SOURCE}));await lock.sync();await lock.close();
  assert.equal(await inspectOwned(),null);attempted=true;const created=await command(containerArguments(image.image_id,run));cid=created.stdout.trim();assert(/^[a-f0-9]{64}$/u.test(cid));report.container_id=cid;
  await inspectOwned();const result=await command(['start','-a','-i',cid],{input:payload,timeoutMs:240000});report.native=projectNativeResult(JSON.parse(result.stdout));report.stderr_bytes=Buffer.byteLength(result.stderr);report.result='diagnosed';
 }catch{report.result='unconfirmed';report.failure_code='PDF_IMAGE_LOCAL_DIAGNOSTIC_UNCONFIRMED';}
 finally{
  try{assert.equal(unknown,false);if(attempted){const v=await inspectOwned();if(v){assert.equal(v.State.Running,false,'PDF_DIAG_RUNNING_CONTAINER_RETAINED');await command(['container','rm',v.Id]);}assert.equal(await inspectOwned(),null);}report.owned_container_absent=true;
   if(locked){const value=JSON.parse(await readFile(LOCK,'utf8'));assert(value.run_id===run&&value.name===name&&value.image_id===image.image_id&&value.source_sha256===SOURCE);await unlink(LOCK);report.lock_released=true;}
  }catch{report.cleanup_unconfirmed=true;report.result='unconfirmed';}
  report.finished_at=new Date().toISOString();await mkdir(path.join(ROOT,'tracking/evidence/m07/worker-hosting'),{recursive:true});const file=path.join(ROOT,'tracking/evidence/m07/worker-hosting',report.observed_at.replaceAll(':','-')+'-'+run.slice(0,8)+'-pdf-images-local.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),native:report.native,cleanup:report.owned_container_absent,lock_released:report.lock_released})+'\n');if(report.result!=='diagnosed')process.exitCode=1;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('PDF_IMAGE_LOCAL_DIAGNOSTIC_UNCONFIRMED\n');process.exitCode=1;});
