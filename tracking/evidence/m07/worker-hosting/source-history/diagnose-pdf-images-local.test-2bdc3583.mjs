import assert from 'node:assert/strict';
import {test} from 'node:test';
import {imageIdentity,containerArguments,projectNativeResult,diagnosticFrameCounts,browserDiagnosticFlags,NATIVE_PROGRAM,IMAGE_TAG,INDEX_DIGEST,NATIVE_DIGEST} from '../../tools/diagnose-pdf-images-local.mjs';
const id='sha256:'+'a'.repeat(64),run='11111111-1111-4111-8111-111111111111';
test('only the current immutable native index/manifest identity is admitted',()=>{
 const base={Id:id,Os:'linux',Architecture:'amd64',Config:{User:'0:0'},RepoTags:[IMAGE_TAG],RepoDigests:[],Descriptor:{digest:INDEX_DIGEST}};
 assert.equal(imageIdentity([base]).image_id,id);
 assert.equal(imageIdentity([{...base,Descriptor:{digest:NATIVE_DIGEST}}]).image_id,id);
 for(const change of [{Descriptor:{}},{Architecture:'arm64'},{Config:{User:'1000'}},{RepoTags:['other:latest']},{Id:'not-an-image'}])assert.throws(()=>imageIdentity([{...base,...change}]));
});
test('Docker receives fixed isolation limits, no host binds/secrets and a fixed UID',()=>{
 const args=containerArguments(id,run);for(const flag of ['--read-only','--network=none','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65432:65432','--pids-limit=256','--memory=2g','--pull=never'])assert(args.includes(flag));
 assert(!args.slice(0,args.indexOf(id)).some(value=>value==='-v'||value==='--volume'||value==='--mount'||value.includes('OPENAI')||value.includes('PGPASSWORD')));
 assert(args.some(value=>value.includes('size=384m')));assert.throws(()=>containerArguments('latest',run));
});
test('native projection keeps fixed PDF checkpoint metadata and drops raw diagnostics',()=>{
 const value={schema_version:'1.0',stage:'validate',result:'failed',code:'PDF_VALIDATION_FAILED',checkpoint:'image_dimensions',uid:65432,gid:65432,caps_cleared:true,no_new_privileges:true,pages:2,frames:2,rendered_bytes:12000,rendered_fields:10,rendered_frame_draws:2,validated_image_draws:null,inspector_child_seen:true,inspector_exit_code:0,inspector_error_flags:{access_denied:false,addon_load:false,module_missing:false},browser_error_flags:browserDiagnosticFlags(''),browser_stderr_observed:false,browser_stderr_truncated:false};
 assert.deepEqual(projectNativeResult(value),value);
 for(const bad of [{...value,private:'SYNTHETIC_PRIVATE'},{...value,checkpoint:'SYNTHETIC_PRIVATE'},{...value,uid:1000},{...value,code:'RAW_PRIVATE_ERROR'}])assert.throws(()=>projectNativeResult(bad));
});
test('zero-frame control retains a candidate page while invalid modes are refused',()=>{
 assert.deepEqual(diagnosticFrameCounts('zero-frames'),[0]);assert.deepEqual(diagnosticFrameCounts('two-frames'),[2]);assert.deepEqual(diagnosticFrameCounts('six-pages'),[0,0,0,0,2]);
 for(const invalid of ['',null,'constructor','zero-frames --privileged'])assert.throws(()=>diagnosticFrameCounts(invalid));
});
test('Chromium diagnostics expose only closed error booleans and keep debug in the library parent',()=>{
 const raw='SYNTHETIC_PRIVATE payload EACCES ENOENT pthread_create thread Resource temporarily unavailable zygote TargetClosed SIGKILL out of memory crashpad No usable sandbox';
 const flags=browserDiagnosticFlags(raw);assert(Object.values(flags).every(value=>value===true));assert(!JSON.stringify(flags).includes('SYNTHETIC_PRIVATE'));
 assert(Object.values(browserDiagnosticFlags('ordinary synthetic text')).every(value=>value===false));assert.throws(()=>browserDiagnosticFlags({message:raw}));
 assert.equal(browserDiagnosticFlags('launch --no-sandbox --disable-setuid-sandbox process exited SIGKILL').sandbox,false);assert.equal(browserDiagnosticFlags('process exited SIGKILL').oom,false);
 const args=containerArguments(id,run);assert(args.includes('DEBUG=pw:browser'));assert(NATIVE_PROGRAM.includes('process.stderr.write='));assert(NATIVE_PROGRAM.includes('65536'));assert(!NATIVE_PROGRAM.includes('env: process.env'));
});
