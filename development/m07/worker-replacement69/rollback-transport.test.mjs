import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {loadPublicCliSources,compileRollbackTransport,compileRollbackPreload,createPinnedSourceLoadHook,sha,TARGET,NODE_PIN,SOURCE_PINS,CORE_RELATIVE,ROLLBACK_NEEDLE} from './rollback-transport.mjs';
const sources=await loadPublicCliSources();
const compiled=()=>compileRollbackTransport(sources,TARGET);
test('actual installed source pins and only one exact rollback expression bind the transform',()=>{
 assert.equal(sources.size,Object.keys(SOURCE_PINS).length);const c=compiled();assert.equal(c.original_sha256,SOURCE_PINS[CORE_RELATIVE]);assert.equal(c.replacement_count,1);assert.equal(c.retry_retries,0);assert.equal(c.installed_files_written,false);
 assert.equal(c.transformed_source.replace(c.replacement,ROLLBACK_NEEDLE),sources.get(CORE_RELATIVE).toString('utf8'));
 for(const file of Object.keys(SOURCE_PINS)){const altered=new Map(sources);altered.set(file,Buffer.from('changed'));assert.throws(()=>compileRollbackTransport(altered,TARGET));}
 for(const target of [{...TARGET,project_id:'prj_foreign'},{...TARGET,team_id:'team_foreign'},{...TARGET,deployment_id:'dpl_foreign'}])assert.throws(()=>compileRollbackTransport(sources,target));
});
test('resolved target/path callback guards precede one fetch with retry0 and fixedteam; unknown errors are not retried',async()=>{
 const c=compiled(),f=new Function('client','project','deployment',`return ${c.dispatch_expression};`);let calls=0;
 const client={async fetch(url,options){calls++;assert.equal(url,`/v9/projects/${TARGET.project_id}/rollback/${TARGET.deployment_id}`);assert.deepEqual(options,{body:{},method:'POST',accountId:TARGET.team_id,retry:{retries:0}});return{accepted:true};}};
 assert.deepEqual(await f(client,{id:TARGET.project_id},{id:TARGET.deployment_id}),{accepted:true});assert.equal(calls,1);
 await assert.rejects(f(client,{id:'prj_foreign'},{id:TARGET.deployment_id}));await assert.rejects(f(client,{id:TARGET.project_id},{id:'dpl_foreign'}));assert.equal(calls,1);
 let failedCalls=0;await assert.rejects(f({async fetch(){failedCalls++;throw Error('synthetic unknown outcome');}},{id:TARGET.project_id},{id:TARGET.deployment_id}));assert.equal(failedCalls,1);
});
test('exact load callback preserves original module format, handles nullCJSsource and never transforms another URL',()=>{
 for(const format of ['module','commonjs']){const original='SYNTHETIC ORIGINAL',changed='SYNTHETIC CHANGED',url='file:///synthetic/rollback-core.'+(format==='module'?'mjs':'cjs');let read=0;
  const h=createPinnedSourceLoadHook({url,original_sha256:sha(original),transformed_source:changed,transformed_sha256:sha(changed),readOriginal(){read++;return Buffer.from(original);}});
  const other={format,source:'OTHER'};assert.equal(h.load('file:///synthetic/other.js',{},()=>other),other);assert.equal(read,0);
  const result=h.load(url,{},()=>({format,source:format==='commonjs'?null:Buffer.from(original)}));assert.equal(result.format,format);assert.equal(result.source,changed);assert.equal(read,1);assert.equal(h.state().applied_count,1);
 }
});
test('load callback rejects changed originals, returnedsource, transformedhash, unsupportedformat and duplicate targetload',()=>{
 const url='file:///synthetic/core.cjs',input={url,original_sha256:sha('OLD'),transformed_source:'NEW',transformed_sha256:sha('NEW'),readOriginal:()=>Buffer.from('OLD')};
 for(const change of [{readOriginal:()=>Buffer.from('CHANGED')},{transformed_sha256:sha('OTHER')}])assert.throws(()=>createPinnedSourceLoadHook({...input,...change}).load(url,{},()=>({format:'commonjs',source:null})));
 assert.throws(()=>createPinnedSourceLoadHook(input).load(url,{},()=>({format:'module',source:'CHANGED'})));
 assert.throws(()=>createPinnedSourceLoadHook(input).load(url,{},()=>({format:'json',source:'OLD'})));
 const h=createPinnedSourceLoadHook(input);h.load(url,{},()=>({format:'commonjs',source:null}));assert.throws(()=>h.load(url,{},()=>({format:'commonjs',source:null})));
});
test('real Node24 synchronous hooks transform synthetic ESM and CJS without executing installed CLI',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'eps-rollback-hook-'));try{
  const moduleUrl=pathToFileURL(path.join(process.cwd(),'development/m07/worker-replacement69/rollback-transport.mjs')).href;
  for(const mode of ['module','commonjs']){const file=path.join(root,mode==='module'?'synthetic.mjs':'synthetic.cjs'),other=path.join(root,mode==='module'?'other.mjs':'other.cjs');const original=mode==='module'?'export default 1;':'module.exports=1;',changed=mode==='module'?'export default 2;':'module.exports=2;';await writeFile(file,original);await writeFile(other,mode==='module'?'export default 7;':'module.exports=7;');
   const program=`import {registerHooks,createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import {readFileSync} from 'node:fs';import {createPinnedSourceLoadHook} from ${JSON.stringify(moduleUrl)};const url=${JSON.stringify(pathToFileURL(file).href)};const hook=createPinnedSourceLoadHook({url,original_sha256:${JSON.stringify(sha(original))},transformed_source:${JSON.stringify(changed)},transformed_sha256:${JSON.stringify(sha(changed))},readOriginal:()=>readFileSync(fileURLToPath(url))});const installed=registerHooks({load:hook.load});const require=createRequire(import.meta.url);const one=${mode==='module'?'(await import(url)).default':'require(fileURLToPath(url))'};const two=${mode==='module'?'(await import('+JSON.stringify(pathToFileURL(other).href)+')).default':'require('+JSON.stringify(other)+')'};installed.deregister();process.stdout.write(JSON.stringify({one,two,state:hook.state()}));`;
   const env={NODE_ENV:'test'};for(const k of ['SystemRoot','WINDIR','PATH','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];const out=spawnSync(process.execPath,['--input-type=module','-e',program],{encoding:'utf8',windowsHide:true,timeout:15000,env});assert.equal(out.status,0,out.stderr);const result=JSON.parse(out.stdout);assert.equal(result.one,2);assert.equal(result.two,7);assert.equal(result.state.applied_count,1);
  }
 }finally{assert.equal(await realpath(root),root);assert.equal(path.dirname(root),tmpdir());assert(path.basename(root).startsWith('eps-rollback-hook-'));await rm(root,{recursive:true,force:true});}
});
test('generatedpreload is syntax-only, exactargv/version/pins and callback target; no token/store/client construction',()=>{
 const c=compiled(),p=compileRollbackPreload(c);assert.equal(p.live_runner_included,false);assert(p.source.includes('registerHooks'));assert(p.source.includes(NODE_PIN.version));assert(p.source.includes('ROLLBACK69_ARGV_REQUIRED'));assert(p.source.includes('ROLLBACK69_CORE_LOAD_REQUIRED'));assert(p.source.includes('rollback_transport_loaded'));assert(!p.source.includes('auth.json')&&!p.source.includes('VERCEL_TOKEN')&&!p.source.includes('new Client(')&&!p.source.includes('await import('));
 const out=spawnSync(process.execPath,['--check','--input-type=module'],{input:p.source,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(out.status,0,out.stderr);
});
test('only source-preserving changes are produced; public original package is ESM with createRequireinternals',()=>{
 const c=compiled(),pkg=JSON.parse(sources.get('package.json'));assert.equal(pkg.type,'module');assert(c.transformed_source.startsWith("import { createRequire"));assert(c.transformed_source.includes('export{'));assert.equal(c.wire_request_count_guaranteed,false);assert.equal(c.dpop_auth_challenge_preserved,true);assert.equal(c.auth_or_config_reads,false);assert.match(NODE_PIN.sha256,/^[a-f0-9]{64}$/u);
});

test('exact core query/hash aliases refuse rather than silently load original unpatched code',()=>{const url='file:///synthetic/core.js',h=createPinnedSourceLoadHook({url,original_sha256:sha('OLD'),transformed_source:'NEW',transformed_sha256:sha('NEW'),readOriginal:()=>Buffer.from('OLD')});for(const suffix of ['?copy=1','#copy'])assert.throws(()=>h.load(url+suffix,{},()=>assert.fail('Do not load core alias')));});
test('generatedpreload wrongargv fails before any CLI/auth module could load',()=>{const p=compileRollbackPreload(compiled());const env={NODE_ENV:'test'};for(const k of ['SystemRoot','WINDIR','PATH','TEMP','TMP'])if(process.env[k])env[k]=process.env[k];const out=spawnSync(process.execPath,['--input-type=module','-e',p.source],{encoding:'utf8',windowsHide:true,timeout:10000,env});assert.equal(out.status,1);assert.match(out.stderr,/ROLLBACK69_ARGV_REQUIRED/u);assert.equal(out.stdout,'');});
