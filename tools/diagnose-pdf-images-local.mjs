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
export function diagnosticFrameCounts(mode){
 assert(typeof mode==='string'&&['zero-frames','two-frames','six-pages','two-frames-fsize96'].includes(mode));return mode==='zero-frames'?[0]:mode==='six-pages'?[0,0,0,0,2]:[2];
}
export function diagnosticFileSize(mode){diagnosticFrameCounts(mode);return mode==='two-frames-fsize96'?100663296:4194304;}
export function browserDiagnosticFlags(value){
 assert.equal(typeof value,'string');return{access_denied:/EACCES|Permission denied|ERR_ACCESS_DENIED/iu.test(value),missing_executable:/ENOENT|No such file or directory/iu.test(value),pthread:/pthread/iu.test(value),threads:/thread/iu.test(value),resource_exhausted:/Resource temporarily unavailable|Cannot allocate memory|resource exhausted/iu.test(value),zygote:/zygote/iu.test(value),target_closed:/TargetClosed|Target page, context or browser has been closed|Target closed/iu.test(value),oom:/out of memory|\bOOM\b|oom-kill/iu.test(value),crashpad:/crashpad/iu.test(value),sandbox:/No usable sandbox|SUID sandbox|sandbox[^\n]*(?:failed|error)|namespace[^\n]*(?:failed|Operation not permitted)/iu.test(value)};
}
export function javascriptDiagnostic(error){
 const classes=['Error','ReferenceError','TypeError','SyntaxError','EncodingError','TimeoutError','TargetClosedError','DOMException'];
 const name=error&&typeof error.name==='string'?error.name:'',message=error&&typeof error.message==='string'?error.message.slice(0,65536):'';
 return{error_class:classes.includes(name)?name:'other',flags:{reference_error:name==='ReferenceError'||/\bReferenceError\b/u.test(message),name_helper_undefined:/__name[^\n]{0,80}(?:is not defined|not defined)/u.test(message),encoding_or_decode:name==='EncodingError'||/EncodingError|(?:image|source)[^\n]{0,80}(?:decode|decod)|decod[^\n]{0,80}(?:image|source)/iu.test(message),timeout:name==='TimeoutError'||/\bTimeout|timed out/iu.test(message),target_closed:name==='TargetClosedError'||/TargetClosed|Target page, context or browser has been closed|Target closed/iu.test(message),permission:/\bEPERM\b|\bEACCES\b|Permission denied/iu.test(message),font_resource:/font[^\n]{0,100}(?:fail|load|unavailable)/iu.test(message),image_resource:/image[^\n]{0,100}(?:fail|load|unavailable)/iu.test(message),thread_resource:/pthread|Resource temporarily unavailable|Cannot allocate memory/iu.test(message)}};
}
export function observePlaywright(chromium,record){
 const wrap=(object,key,method,after)=>{const original=object[key];assert.equal(typeof original,'function');object[key]=async function(...args){record(method,'started');try{const value=await original.apply(this,args);if(after)after(value);record(method,'succeeded');return value;}catch(error){record(method,'failed',error);throw error;}};};
 const page=value=>{value.on('pageerror',error=>record('page_error','failed',error));for(const[key,method]of[['setContent','page_set_content'],['evaluate','page_evaluate'],['pdf','page_pdf']])wrap(value,key,method);};
 wrap(chromium,'launch','browser_launch',browser=>wrap(browser,'newContext','browser_context',context=>wrap(context,'newPage','context_page',page)));
}
const jsMethods=['browser_launch','browser_context','context_page','page_set_content','page_evaluate','page_pdf'];
const jsClasses=['Error','ReferenceError','TypeError','SyntaxError','EncodingError','TimeoutError','TargetClosedError','DOMException','other'];
export function projectProgramObservation(value){
 assert(value&&typeof value==='object');assert(['identity','kernel_limits','source_seal','input','browser_import','render','validate','complete'].includes(value.diagnostic_phase));assert(value.error_class===null||['Error','AssertionError','TypeError','RangeError','SyntaxError','other'].includes(value.error_class));assert(typeof value.source_verified==='boolean'&&(value.file_size_limit_bytes===null||[4194304,100663296].includes(value.file_size_limit_bytes)));
 return{phase:value.diagnostic_phase,error_class:value.error_class,source_verified:value.source_verified,file_size_limit_bytes:value.file_size_limit_bytes};
}
export function imageIdentity(value){
 assert(Array.isArray(value)&&value.length===1);const v=value[0];assert(imageId(v.Id)&&v.Os==='linux'&&v.Architecture==='amd64'&&v.Config?.User==='0:0');
 assert(v.RepoTags?.includes(IMAGE_TAG));const digest=v.Descriptor?.digest;
 assert([INDEX_DIGEST,NATIVE_DIGEST].includes(digest)||v.RepoDigests?.some(item=>[REPO+'@'+INDEX_DIGEST,REPO+'@'+NATIVE_DIGEST].includes(item)),'PDF_DIAG_IMMUTABLE_IMAGE_IDENTITY_REQUIRED');
 return{image_id:v.Id,index_digest:INDEX_DIGEST,native_manifest_digest:NATIVE_DIGEST,architecture:'amd64',os:'linux'};
}
export const NATIVE_PROGRAM=String.raw`
import {readFileSync,lstatSync} from 'node:fs';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
const browserDiagnosticFlags=${browserDiagnosticFlags.toString()};
const javascriptDiagnostic=${javascriptDiagnostic.toString()},observePlaywright=${observePlaywright.toString()};
const output={schema_version:'1.0',stage:'source',result:'failed',code:'LOCAL_DIAGNOSTIC_FAILED',checkpoint:null,diagnostic_phase:'identity',error_class:null,uid:process.getuid(),gid:process.getgid(),caps_cleared:false,no_new_privileges:false,source_verified:false,file_size_limit_bytes:null,pages:0,frames:0,rendered_bytes:0,rendered_fields:0,rendered_frame_draws:0,validated_image_draws:null,inspector_child_seen:false,inspector_exit_code:null,inspector_error_flags:{access_denied:false,module_missing:false,addon_load:false},browser_error_flags:browserDiagnosticFlags(''),browser_stderr_observed:false,browser_stderr_truncated:false,browser_js:{last_method:null,last_method_succeeded:null,failed_method:null,error_class:null,flags:javascriptDiagnostic(null).flags,page_error_count:0,page_error_class:null,page_error_flags:javascriptDiagnostic(null).flags}};
const browserStderr=[];let browserBytes=0;
process.stderr.write=function(chunk,encoding,callback){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk,typeof encoding==='string'?encoding:'utf8');output.browser_stderr_observed=true;const available=65536-browserBytes;if(bytes.length>available)output.browser_stderr_truncated=true;if(available>0){const bounded=bytes.subarray(0,available);browserStderr.push(bounded);browserBytes+=bounded.length;}const done=typeof encoding==='function'?encoding:callback;if(typeof done==='function')done();return true;};
let stderr='';const original=childProcess.spawn;
childProcess.spawn=function(exe,args,options){const child=original(exe,args,options);if(Array.isArray(args)&&args.some(v=>typeof v==='string'&&v.endsWith('/presentation-pdf-inspect-process.mjs'))){output.inspector_child_seen=true;child.stderr.on('data',chunk=>{if(stderr.length<65536)stderr+=chunk.toString('utf8').slice(0,65536-stderr.length);});child.on('close',code=>{output.inspector_exit_code=Number.isInteger(code)&&code>=0&&code<=255?code:null;});}return child;};syncBuiltinESMExports();
try{
 const status=readFileSync('/proc/self/status','utf8');output.caps_cleared=/^CapEff:\s+0+$/mu.test(status)&&/^CapBnd:\s+0+$/mu.test(status);output.no_new_privileges=/^NoNewPrivs:\s+1$/mu.test(status);
 if(output.uid!==65432||output.gid!==65432||!output.caps_cleared||!output.no_new_privileges||Object.entries(process.env).some(([key,value])=>value&&/OPENAI|SUPABASE|N8N|OIDC|VERCEL|EPS_SPECS_PG/u.test(key)))throw Error('identity');
 output.diagnostic_phase='kernel_limits';
 const limit=/^Max file size\s+(\d+)\s+(\d+)\s+bytes[ \t]*$/mu.exec(readFileSync('/proc/self/limits','utf8'));if(!limit||limit[1]!==limit[2]||![4194304,100663296].includes(Number(limit[1])))throw Error('limits');output.file_size_limit_bytes=Number(limit[1]);
 output.diagnostic_phase='source_seal';
 const {verifyNativeSourceSeal}=await import('/opt/eps/apps/worker/src/native-source-seal.ts');const source=JSON.parse(readFileSync('/opt/eps/apps/worker/native-source.json','utf8'));
 verifyNativeSourceSeal(source,'3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3',relative=>{const file='/opt/eps/'+relative,stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('source');return readFileSync(file);});
 output.source_verified=true;
 output.stage='input';output.diagnostic_phase='input';const parts=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>2*1024*1024)throw Error('input');parts.push(chunk);}
 const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(Object.keys(value).sort().join(',')!=='images,snapshot'||!Array.isArray(value.images)||![0,2].includes(value.images.length)||![2,6].includes(value.snapshot?.slides?.length)||value.images.length===0&&value.snapshot.slides.length!==2)throw Error('input');
 const images=new Map(value.images.map(([id,bytes])=>[id,new Uint8Array(Buffer.from(bytes,'base64'))]));output.pages=value.snapshot.slides.length;output.frames=images.size;
 output.diagnostic_phase='browser_import';const {chromium}=await import('playwright');observePlaywright(chromium,(method,phase,error)=>{const js=output.browser_js;if(method==='page_error'){const item=javascriptDiagnostic(error);js.page_error_count=Math.min(js.page_error_count+1,1000);if(js.page_error_class===null)js.page_error_class=item.error_class;for(const key of Object.keys(item.flags))js.page_error_flags[key]||=item.flags[key];return;}js.last_method=method;js.last_method_succeeded=phase==='succeeded'?true:phase==='failed'?false:null;if(phase==='failed'&&js.failed_method===null){const item=javascriptDiagnostic(error);js.failed_method=method;js.error_class=item.error_class;js.flags=item.flags;}});
 const pdf=await import('/opt/eps/apps/worker/src/presentation-pdf.ts');output.stage='render';output.diagnostic_phase='render';const rendered=await pdf.renderPresentationPdf(value.snapshot,images,{timeoutMs:90000});output.rendered_bytes=rendered.bytes.length;output.rendered_fields=rendered.proof.candidate_field_count;output.rendered_frame_draws=rendered.proof.frame_draw_count;
 output.stage='validate';output.diagnostic_phase='validate';const proof=await pdf.validatePresentationPdf(value.snapshot,images,rendered.bytes,{timeoutMs:90000});output.validated_image_draws=proof.image_draws_checked;output.result='passed';output.code=null;output.stage='complete';output.diagnostic_phase='complete';
}catch(error){output.error_class=['Error','AssertionError','TypeError','RangeError','SyntaxError'].includes(error?.name)?error.name:'other';if(typeof error?.code==='string'&&/^PDF_[A-Z_]{1,80}$/u.test(error.code))output.code=error.code;if(typeof error?.checkpoint==='string'&&/^[a-z_0-9]{1,40}$/u.test(error.checkpoint))output.checkpoint=error.checkpoint;}
output.inspector_error_flags={access_denied:/ERR_ACCESS_DENIED|Access to this API has been restricted/u.test(stderr),module_missing:/ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/u.test(stderr),addon_load:/ERR_DLOPEN_FAILED|Cannot load native binding/u.test(stderr)};
output.browser_error_flags=browserDiagnosticFlags(Buffer.concat(browserStderr).toString('utf8'));
process.stdout.write(JSON.stringify(output));
`;
export function containerArguments(id,run,mode='two-frames'){
 const fileSize=diagnosticFileSize(mode);assert(imageId(id)&&/^[a-f0-9-]{36}$/u.test(run));return['create','--name','eps-pdf-images-'+run,'--pull=never','--platform=linux/amd64','--read-only','--network=none','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65432:65432','--pids-limit=256','--memory=2g','--cpus=1','--shm-size=16m','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=384m,mode=1777',
 '--label','com.everyone.presentation.owner=pdf-images-local','--label','com.everyone.presentation.run='+run,'--label','com.everyone.presentation.source='+SOURCE,
 '--env','NODE_ENV=production','--env','HOME=/tmp','--env','TMPDIR=/tmp','--env','LANG=C','--env','LC_ALL=C','--env','DEBUG=pw:browser','--env','PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright','-i','--entrypoint','/usr/bin/prlimit',id,
 '--cpu=190','--nproc=256','--nofile=256','--fsize='+fileSize,'--core=0','--','/usr/local/bin/node','--import','tsx','--max-old-space-size=512','--input-type=module','--eval',NATIVE_PROGRAM];
}
export function projectNativeResult(value){
 const keys=['schema_version','stage','result','code','checkpoint','diagnostic_phase','error_class','uid','gid','caps_cleared','no_new_privileges','source_verified','file_size_limit_bytes','pages','frames','rendered_bytes','rendered_fields','rendered_frame_draws','validated_image_draws','inspector_child_seen','inspector_exit_code','inspector_error_flags','browser_error_flags','browser_stderr_observed','browser_stderr_truncated','browser_js'];
 assert(value&&typeof value==='object'&&!Array.isArray(value));assert.deepEqual(Object.keys(value).sort(),keys.sort());assert(value.schema_version==='1.0'&&['source','input','render','validate','complete'].includes(value.stage)&&['failed','passed'].includes(value.result));
 assert(value.code===null&&value.result==='passed'||codes.has(value.code)&&value.result==='failed');assert(checkpoint(value.checkpoint));assert(value.uid===65432&&value.gid===65432&&value.caps_cleared===true&&value.no_new_privileges===true);
 projectProgramObservation(value);assert(value.source_verified===true&&[4194304,100663296].includes(value.file_size_limit_bytes));
 for(const key of['pages','frames','rendered_bytes','rendered_fields','rendered_frame_draws'])assert(Number.isSafeInteger(value[key])&&value[key]>=0&&value[key]<=64*1024*1024);
 assert(value.validated_image_draws===null||Number.isSafeInteger(value.validated_image_draws)&&value.validated_image_draws>=0&&value.validated_image_draws<=100);
 assert(typeof value.inspector_child_seen==='boolean'&&(value.inspector_exit_code===null||Number.isInteger(value.inspector_exit_code)&&value.inspector_exit_code>=0&&value.inspector_exit_code<=255));
 assert.deepEqual(Object.keys(value.inspector_error_flags).sort(),['access_denied','addon_load','module_missing']);assert(Object.values(value.inspector_error_flags).every(v=>typeof v==='boolean'));
 assert.deepEqual(Object.keys(value.browser_error_flags).sort(),Object.keys(browserDiagnosticFlags('')).sort());assert(Object.values(value.browser_error_flags).every(v=>typeof v==='boolean'));assert(typeof value.browser_stderr_observed==='boolean'&&typeof value.browser_stderr_truncated==='boolean');
 const js=value.browser_js;assert.deepEqual(Object.keys(js).sort(),['last_method','last_method_succeeded','failed_method','error_class','flags','page_error_count','page_error_class','page_error_flags'].sort());assert((js.last_method===null||jsMethods.includes(js.last_method))&&(js.failed_method===null||jsMethods.includes(js.failed_method))&&(js.last_method_succeeded===null||typeof js.last_method_succeeded==='boolean'));
 assert((js.error_class===null||jsClasses.includes(js.error_class))&&(js.page_error_class===null||jsClasses.includes(js.page_error_class))&&Number.isInteger(js.page_error_count)&&js.page_error_count>=0&&js.page_error_count<=1000);
 for(const flags of[js.flags,js.page_error_flags]){assert.deepEqual(Object.keys(flags).sort(),Object.keys(javascriptDiagnostic(null).flags).sort());assert(Object.values(flags).every(v=>typeof v==='boolean'));}return JSON.parse(JSON.stringify(value));
}
async function main(){
 assert(process.argv.length===3);const frameCounts=diagnosticFrameCounts(process.argv[2]);const forbidden=new Set(['NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE']);assert(!Object.entries(process.env).some(([key,value])=>forbidden.has(key.toUpperCase())&&value));const mode=process.argv[2],run=randomUUID(),name='eps-pdf-images-'+run;let image,cid,attempted=false,locked=false,unknown=false;
 const report={schema_version:'1.0',observed_at:new Date().toISOString(),run_id:run,container_name:name,mode,result:'unconfirmed',phase:'source_preflight',environment:'isolated-local-docker',source_sha256:SOURCE,native_manifest_digest:NATIVE_DIGEST,native_program_sha256:sha(NATIVE_PROGRAM),cloud_called:false,database_called:false,private_inputs_used:false,worker_or_proof_source_changed:false,command_processes_unconfirmed:[]};
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
  report.phase='image_identity';image=imageIdentity(JSON.parse((await command(['image','inspect',IMAGE_TAG])).stdout));report.image=image;
  report.phase='synthetic_fixture';
  const {nativePresentation}=await import('../tests/worker/presentation-native-fixture.ts');const{snapshot,images}=nativePresentation(frameCounts,false);assert.equal(images.size,mode==='zero-frames'?0:2);
  const payload=JSON.stringify({snapshot,images:[...images].map(([id,bytes])=>[id,Buffer.from(bytes).toString('base64')])});assert(Buffer.byteLength(payload)<2*1024*1024);report.fixture={synthetic:true,pages:snapshot.slides.length,frames:images.size,logo:false};
  report.phase='lock_acquisition';await mkdir(path.dirname(LOCK),{recursive:true});const lock=await open(LOCK,'wx',0o600);locked=true;await lock.writeFile(JSON.stringify({run_id:run,name,image_id:image.image_id,source_sha256:SOURCE}));await lock.sync();await lock.close();
  report.phase='container_create';assert.equal(await inspectOwned(),null);attempted=true;const created=await command(containerArguments(image.image_id,run,mode));cid=created.stdout.trim();assert(/^[a-f0-9]{64}$/u.test(cid));report.container_id=cid;
  report.phase='native_program';await inspectOwned();const result=await command(['start','-a','-i',cid],{input:payload,timeoutMs:240000});report.phase='native_result_projection';const value=JSON.parse(result.stdout);report.native_program_observation=projectProgramObservation(value);report.native=projectNativeResult(value);assert.equal(report.native.file_size_limit_bytes,diagnosticFileSize(mode));report.stderr_bytes=Buffer.byteLength(result.stderr);report.result='diagnosed';report.phase='complete';
 }catch(error){report.result='unconfirmed';report.failure_code='PDF_IMAGE_LOCAL_DIAGNOSTIC_UNCONFIRMED';report.failure_error_class=['Error','AssertionError','TypeError','RangeError','SyntaxError'].includes(error?.name)?error.name:'other';}
 finally{
  try{assert.equal(unknown,false);if(attempted){const v=await inspectOwned();if(v){assert.equal(v.State.Running,false,'PDF_DIAG_RUNNING_CONTAINER_RETAINED');await command(['container','rm',v.Id]);}assert.equal(await inspectOwned(),null);}report.owned_container_absent=true;
   if(locked){const value=JSON.parse(await readFile(LOCK,'utf8'));assert(value.run_id===run&&value.name===name&&value.image_id===image.image_id&&value.source_sha256===SOURCE);await unlink(LOCK);report.lock_released=true;}
  }catch{report.cleanup_unconfirmed=true;report.result='unconfirmed';}
  report.finished_at=new Date().toISOString();await mkdir(path.join(ROOT,'tracking/evidence/m07/worker-hosting'),{recursive:true});const file=path.join(ROOT,'tracking/evidence/m07/worker-hosting',report.observed_at.replaceAll(':','-')+'-'+run.slice(0,8)+'-pdf-images-local.json');await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),native:report.native,cleanup:report.owned_container_absent,lock_released:report.lock_released})+'\n');if(report.result!=='diagnosed')process.exitCode=1;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('PDF_IMAGE_LOCAL_DIAGNOSTIC_UNCONFIRMED\n');process.exitCode=1;});
