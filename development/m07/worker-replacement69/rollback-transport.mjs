/** Source compiler only. Import registers no hooks, executes no CLI and reads no files. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,realpath,readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const ROOT=path.resolve(import.meta.dirname,'../../..');
export const CLI_ROOT=path.join(ROOT,'.local/m07-pilot/tooling/node_modules/vercel');
export const CORE_RELATIVE='dist/commands-core.js';
export const NODE_PIN=Object.freeze({version:'24.18.0',path:'C:/Program Files/nodejs/node.exe',sha256:'9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de'});
export const TARGET=Object.freeze({project_id:'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',team_id:'team_gboXPxTevpCOZuaA8eY9PmR1',deployment_id:'dpl_6pcN8Qb1XDkBTsiwKVmexKfWUvf7'});
const SLUG='muhammed-abdelrahman',GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
export const SOURCE_PINS=Object.freeze({
 'package.json':'d8a83d88610841d9569884bb93fb9551c2089011245e9afe1b84871079c427c3',
 'dist/vc.js':'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',
 'dist/index.js':'2c91b111d62f01dd440621cd6efc52e0f7a0b68f73d7b898438209a7e04f2d3a',
 [CORE_RELATIVE]:'90710866ef6867967a4d218e708eb7d3b73476571fac19293f020dd7312290c6',
 'dist/commands-routing.js':'1314ff6bb482b556ac540e12bf87d899b15e2e30ed1c907e54d5b664dea5ba90',
 'dist/chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a',
 'dist/chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b',
 'dist/chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
 'dist/chunks/chunk-HTFQFHPR.js':'e411a285550953d318f9a81cf83352c58d6167e81d18f01cfeccb80e782f7c54',
});
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const ROLLBACK_NEEDLE='return await client.fetch(`/v9/projects/${project.id}/rollback/${deployment.id}`,{body:{},method:"POST"})';
function expression(){return `(async()=>{if(project.id!==${JSON.stringify(TARGET.project_id)}||deployment.id!==${JSON.stringify(TARGET.deployment_id)})throw Error('ROLLBACK69_RESOLVED_TARGET_REQUIRED');return client.fetch(\`/v9/projects/\${project.id}/rollback/\${deployment.id}\`,{body:{},method:"POST",accountId:${JSON.stringify(TARGET.team_id)},retry:{retries:0}})})()`;}
export async function loadPublicCliSources(){
 const sources=new Map();for(const[file,digest]of Object.entries(SOURCE_PINS)){
  const target=path.join(CLI_ROOT,file),s=await lstat(target);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=8*1024*1024&&await realpath(target)===target,'ROLLBACK69_PUBLIC_SOURCE_REQUIRED');
  const bytes=await readFile(target);assert.equal(sha(bytes),digest,'ROLLBACK69_SOURCE_CHANGED');sources.set(file,bytes);
 }return sources;
}
export function compileRollbackTransport(sources,target){
 assert(sources instanceof Map);assert.deepEqual([...sources.keys()].sort(),Object.keys(SOURCE_PINS).sort());assert.deepEqual(target,TARGET,'ROLLBACK69_TARGET_REQUIRED');
 for(const[file,digest]of Object.entries(SOURCE_PINS)){const bytes=sources.get(file);assert(bytes instanceof Uint8Array);assert.equal(sha(bytes),digest,'ROLLBACK69_SOURCE_CHANGED');}
 const pkg=JSON.parse(Buffer.from(sources.get('package.json')));assert.equal(pkg.version,'65.8.0');assert.equal(pkg.type,'module');
 const original=Buffer.from(sources.get(CORE_RELATIVE)).toString('utf8');assert.equal(original.split(ROLLBACK_NEEDLE).length,2,'ROLLBACK69_EXACT_ONE_NEEDLE_REQUIRED');
 const dispatch=expression(),replacement='return await '+dispatch,transformed=original.replace(ROLLBACK_NEEDLE,()=>replacement);
 return{schema_version:'1.0',target:{...TARGET},node_pin:{...NODE_PIN},source_pins:{...SOURCE_PINS},original_source:original,original_sha256:sha(original),transformed_source:transformed,transformed_sha256:sha(transformed),dispatch_expression:dispatch,replacement,replacement_count:1,retry_retries:0,installed_files_written:false,auth_or_config_reads:false,dpop_auth_challenge_preserved:true,wire_request_count_guaranteed:false};
}
/** Trusted low-level callback seam. Compiler/preload fixes actual CLI URL/bytes;
 * synthetic tests supply other source bytes without loading the installed CLI. */
export function createPinnedSourceLoadHook(config){
 assert(config&&typeof config==='object');assert.deepEqual(Object.keys(config).sort(),['url','original_sha256','transformed_source','transformed_sha256','readOriginal'].sort());
 assert.equal(typeof config.url,'string');const target=new URL(config.url);assert.equal(target.protocol,'file:');assert(!target.search&&!target.hash);
 assert(/^[a-f0-9]{64}$/u.test(config.original_sha256));assert.equal(typeof config.transformed_source,'string');assert.equal(sha(config.transformed_source),config.transformed_sha256,'ROLLBACK69_TRANSFORM_CHANGED');assert.equal(typeof config.readOriginal,'function');let applied=0;
 function load(url,context,nextLoad){
  if(url!==config.url){if(url.split(/[?#]/u)[0]===config.url)throw Error('ROLLBACK69_EXACT_CORE_URL_REQUIRED');return nextLoad(url,context);}
  assert.equal(applied,0,'ROLLBACK69_DUPLICATE_CORE_LOAD');const original=config.readOriginal();assert(original instanceof Uint8Array||typeof original==='string');assert.equal(sha(original),config.original_sha256,'ROLLBACK69_ORIGINAL_CHANGED');
  const result=nextLoad(url,context);assert(result&&['module','commonjs'].includes(result.format),'ROLLBACK69_MODULE_FORMAT_REQUIRED');
  // CJS default loading may omit source; the independently read exact file is
  // still hash-checked. Preserve its original returned format, including CJS.
  if(result.source!==null&&result.source!==undefined)assert.equal(sha(result.source),config.original_sha256,'ROLLBACK69_LOADED_SOURCE_CHANGED');
  applied++;return{...result,source:config.transformed_source};
 }
 return{load,state:()=>({applied_count:applied,original_sha256:config.original_sha256,transformed_sha256:config.transformed_sha256})};
}
export function compileRollbackPreload(compiled){
 assert(compiled&&typeof compiled==='object');assert.deepEqual(compiled.target,TARGET);assert.deepEqual(compiled.node_pin,NODE_PIN);assert.deepEqual(compiled.source_pins,SOURCE_PINS);
 assert.equal(sha(compiled.original_source),SOURCE_PINS[CORE_RELATIVE]);assert.equal(compiled.original_source.split(ROLLBACK_NEEDLE).length,2);assert.equal(compiled.replacement,'return await '+expression());assert.equal(compiled.transformed_source,compiled.original_source.replace(ROLLBACK_NEEDLE,()=>compiled.replacement));assert.equal(sha(compiled.transformed_source),compiled.transformed_sha256);
 const core=pathToFileURL(path.join(CLI_ROOT,CORE_RELATIVE)).href,cli=path.join(CLI_ROOT,'dist/vc.js');
 const argv=[cli,'rollback',TARGET.deployment_id,'--scope',SLUG,'--global-config',GLOBAL,'--yes','--timeout','0'];
 const source=`/** Generated inert transport preload. The separate operator owns dispatch. */
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {readFileSync,lstatSync,realpathSync} from 'node:fs';import {registerHooks} from 'node:module';import {fileURLToPath} from 'node:url';import path from 'node:path';
const sha=value=>createHash('sha256').update(value).digest('hex');
assert.equal(process.versions.node,${JSON.stringify(NODE_PIN.version)},'ROLLBACK69_NODE_VERSION_REQUIRED');
assert.deepEqual(process.argv.slice(1),${JSON.stringify(argv)},'ROLLBACK69_ARGV_REQUIRED');
const cliRoot=${JSON.stringify(CLI_ROOT)},pins=${JSON.stringify(SOURCE_PINS)};
function readExact(file){const s=lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=8388608&&realpathSync(file)===file,'ROLLBACK69_FILE_REQUIRED');return readFileSync(file);}
for(const[file,digest]of Object.entries(pins))assert.equal(sha(readExact(path.join(cliRoot,file))),digest,'ROLLBACK69_CLI_PIN_CHANGED');
const coreUrl=${JSON.stringify(core)},needle=${JSON.stringify(ROLLBACK_NEEDLE)},replacement=${JSON.stringify(compiled.replacement)},original=readExact(fileURLToPath(coreUrl)).toString('utf8');assert.equal(original.split(needle).length,2,'ROLLBACK69_EXACT_ONE_NEEDLE_REQUIRED');
const patched=original.replace(needle,()=>replacement);assert.equal(sha(patched),${JSON.stringify(compiled.transformed_sha256)},'ROLLBACK69_TRANSFORM_CHANGED');
const createPinnedSourceLoadHook=${createPinnedSourceLoadHook.toString()};
const gate=createPinnedSourceLoadHook({url:coreUrl,original_sha256:${JSON.stringify(compiled.original_sha256)},transformed_source:patched,transformed_sha256:${JSON.stringify(compiled.transformed_sha256)},readOriginal:()=>readExact(fileURLToPath(coreUrl))});
registerHooks({load(url,context,nextLoad){const before=gate.state().applied_count;const result=gate.load(url,context,nextLoad);if(url===coreUrl){assert.equal(result.format,'module','ROLLBACK69_INSTALLED_ESM_FORMAT_REQUIRED');assert.equal(before,0);process.stdout.write(JSON.stringify({event:'rollback_transport_loaded',project_id:${JSON.stringify(TARGET.project_id)},deployment_id:${JSON.stringify(TARGET.deployment_id)},original_sha256:${JSON.stringify(compiled.original_sha256)},transformed_sha256:${JSON.stringify(compiled.transformed_sha256)},client_retry_retries:0,exactly_one_wire_request_claimed:false})+'\\n');}return result;}});
process.once('exit',()=>{if(gate.state().applied_count!==1){process.stderr.write('ROLLBACK69_CORE_LOAD_REQUIRED\\n');process.exitCode=1;}});
`;
 return{schema_version:'1.0',source,source_sha256:sha(source),core_transformed_sha256:compiled.transformed_sha256,node_pin:{...NODE_PIN},source_pins:{...SOURCE_PINS},expected_argv:argv,live_runner_included:false,cli_executed:false,installed_cli_modified:false,authentication_unchanged:true,wire_request_count_guaranteed:false};
}
