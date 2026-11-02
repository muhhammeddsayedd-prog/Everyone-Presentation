/** Fixed native entry; no old evaluation entrypoint is imported or invoked. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat,mkdir,readFile,realpath,writeFile } from 'node:fs/promises';
import { findPackageJSON } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { openAISpecsConfigFromEnv } from '../../../packages/integrations/src/openai-specs.ts';
import { evaluateOnce,PRODUCTION_PINS,REFERENCE_PATH,REFERENCE_SHA256,EXPECTED_PREVIOUS_REQUEST_SHA256,type Ports } from './evaluate.mts';
import { sendBudgetRequest,REUSED_TRANSPORT_PATH,REUSED_TRANSPORT_SHA256 } from './transport.mts';
export const EVALUATION_ENABLED=true;
const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio',ROOT=path.resolve(import.meta.dirname,'../../..');
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const SDK_PINS = {
  'package-lock.json': '6859471ff399d9c5fc6364a8bbc0b8e66d4b274e3849b444e85b54ad34f9f4d1',
  'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
  'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
  'tools/release_logo.py': 'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4',
  'development/m07/oauth-attempt-trace/inspect-attempt.py': '1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',
  'node_modules/openai/package.json': 'fd91cc6cd6191ffcffdecd6e8b9db5598451ef4b383b7c871e6a913c1af8f470',
  'node_modules/openai/index.mjs': '17cdb2c28d43e69bad6688cbefcf206674d15efaff37481923eef2991a239e11',
  'node_modules/openai/client.mjs': '65b8e9b0a52f5b855d239f3edb75710019d1cceaeac8da1e5cba122762e86ba2',
  'node_modules/openai/core/error.mjs': 'f9af78fa51cabb0128ebdd820259ba93a38d405434e698381b9dbc5b7ca55174',
  'node_modules/openai/core/streaming.mjs': '33099bd088b5d4839dcd243c6fdc13fddc043cdb94155e02942e24fff041084f',
  'node_modules/openai/internal/parse.mjs': '4966757ae0aae0d4ca1a8dc1b50f84772ef692983602cd9143a9448e100ae6d1',
  'node_modules/openai/internal/decoders/line.mjs': 'cc64f56402b80488c3478a9586d6239e3c42d289b496ea97ee79ff3f4abffa7f',
  'node_modules/openai/core/api-promise.mjs': 'edb8be5b07bc29b303f6ca13f35c97a21a014f8ff16be02ce38466d38a65c559',
  'node_modules/openai/resources/responses/responses.mjs': '4fc59d6476d8c6320bda0bf056779c79b765acd8535628c00612f99b5431058a',
  'tools/worker-private-env.mjs': 'ef935580876c9150b8150947c3796dd4760d1ad2910bc3bf322dd5015eea4d79',
};
async function bridge(run: string, operation: string, value?: unknown): Promise<unknown> {
  assert(EVALUATION_ENABLED && ROOT.toLowerCase() === path.resolve(MAIN).toLowerCase());
  const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'PATH', 'LANG']
    .filter(name => process.env[name] !== undefined).map(name => [name, process.env[name]!]));
  const input = JSON.stringify({ run, operation, value }); assert(Buffer.byteLength(input) <= 6 * 1024 * 1024);
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(MAIN, '.venv-skills/Scripts/python.exe'), ['-X', 'utf8', '-B', path.join(import.meta.dirname, 'private_bridge.py')],
      { cwd: MAIN, env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let bytes = 0, errorBytes = 0; const chunks: Buffer[] = [];
    const timer = setTimeout(() => { child.kill(); reject(Error('BUDGET32K_PRIVATE_BRIDGE_UNCONFIRMED')); }, 65_000);
    child.on('error', () => { clearTimeout(timer); reject(Error('BUDGET32K_PRIVATE_BRIDGE_UNCONFIRMED')); });
    child.stdout.on('data', (chunk: Buffer) => { bytes += chunk.length; if (bytes > 512 * 1024) child.kill(); else chunks.push(chunk); });
    child.stderr.on('data', (chunk: Buffer) => { errorBytes += chunk.length; if (errorBytes > 65536) child.kill(); });
    child.once('close', code => {
      clearTimeout(timer);
      try { assert.equal(code, 0); assert(bytes <= 512 * 1024 && errorBytes <= 65536);
        const result = JSON.parse(Buffer.concat(chunks).toString('utf8')); assert.equal(result.ok, true); resolve(result.value);
      } catch { reject(Error('BUDGET32K_PRIVATE_BRIDGE_UNCONFIRMED')); }
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
  });
}

export async function sourceSeals():Promise<Record<string,string>>{
 const pkg=path.join(ROOT,'node_modules/openai/package.json');
 assert.equal(findPackageJSON('openai',pathToFileURL(path.join(ROOT,'packages/integrations/src/openai-specs.ts'))),pkg);
 assert.equal(import.meta.resolve('openai'),pathToFileURL(path.join(ROOT,'node_modules/openai/index.mjs')).href);
 assert.equal(await realpath(pkg),pkg);assert.equal(JSON.parse(await readFile(pkg,'utf8')).version,'7.45.1');
 const fixed={...PRODUCTION_PINS,...SDK_PINS,[REFERENCE_PATH]:REFERENCE_SHA256,
  [REUSED_TRANSPORT_PATH]:REUSED_TRANSPORT_SHA256,
  'development/m07/pdf47-extended-deadline-evaluation/transport.mts':'1d66e829c11b55320b2c2e1e331ae123b8ed6aad6b83c52172fe298c8db03a18',
  'development/m07/pdf47-streaming-evaluation/private_bridge.py':'ac8a6d1c219d82781aa78fbfa84dbbf1c80a4098215162bd3a7784b28ee34b22'};
 const paths=[...Object.keys(fixed),...['native.mts','evaluate.mts','transport.mts','private_bridge.py'].map(name=>'development/m07/pdf47-budget32k-evaluation/'+name)];
 const seals:Record<string,string>={};
 for(const name of paths){const file=path.join(ROOT,name),stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1);assert.equal(await realpath(file),file);seals[name]=createHash('sha256').update(await readFile(file)).digest('hex');}
 for(const[name,digest]of Object.entries(fixed))assert.equal(seals[name],digest);return seals;
}
export async function loadVerifiedConfiguration(verify:()=>Promise<unknown>,load:()=>Promise<unknown>){
 await verify();const loaded=await load();assert(loaded&&typeof loaded==='object'&&!Array.isArray(loaded));const values=loaded as Record<string,unknown>;
 assert(typeof values.OPENAI_API_KEY==='string'&&typeof values.OPENAI_EXTRACTION_MODEL==='string');
 return openAISpecsConfigFromEnv({OPENAI_API_KEY:values.OPENAI_API_KEY,OPENAI_EXTRACTION_MODEL:values.OPENAI_EXTRACTION_MODEL});
}
export async function main(){
 assert(EVALUATION_ENABLED,'PDF47_BUDGET32K_EVALUATION_DISABLED');const[operation,run,...extra]=process.argv.slice(2);
 assert(!extra.length&&UUID.test(run)&&['prepare','evaluate'].includes(operation));assert.equal(ROOT.toLowerCase(),path.resolve(MAIN).toLowerCase());
 if(operation==='prepare'){await sourceSeals();await bridge(run,'prepare');await mkdir(path.join(MAIN,'tracking/evidence/m07/pdf47-budget32k-evaluation'),{recursive:true});process.stdout.write('{"result":"prepared_privately","provider_requests":0}\n');return;}
 const folder=path.join(MAIN,'tracking/evidence/m07/pdf47-budget32k-evaluation'),stat=await lstat(folder);assert(stat.isDirectory()&&!stat.isSymbolicLink());assert.equal(await realpath(folder),folder);
 const config=await loadVerifiedConfiguration(sourceSeals,async()=>{
  const loader=path.join(ROOT,'tools/worker-private-env.mjs');const{loadWorkerPrivateEnvironment}=await import(pathToFileURL(loader).href);return loadWorkerPrivateEnvironment({environment:{}});
 });
 const ports:Ports={read:async()=>await bridge(run,'read')as Awaited<ReturnType<Ports['read']>>,config:()=>config,seals:sourceSeals,
  admitCapture:async built=>{assert.equal(built.previous.sha256,EXPECTED_PREVIOUS_REQUEST_SHA256);},
  claim:async value=>{await bridge(run,'claim',value);},
  receipt:async(phase,value)=>{assert(['dispatch-started','result'].includes(phase));await writeFile(path.join(folder,run+'-'+phase+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});},
  send:(built,configured)=>sendBudgetRequest(built,configured,globalThis.fetch),persistResponse:async value=>{await bridge(run,'persist_response',value);},persist:async value=>{await bridge(run,'persist',value);}};
 const result=await evaluateOnce(run,ports);process.stdout.write(JSON.stringify({run_id:run,result:result.result,provider_requests_initiated:result.provider_requests_initiated,writeback:false})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('PDF47_BUDGET32K_EVALUATION_REFUSED; private data withheld.\n');process.exitCode=1;});
