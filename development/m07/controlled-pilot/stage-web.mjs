/** Sparse app deployment snapshot; does not deploy or copy runtime credentials. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createHash, randomUUID } from 'node:crypto';
import { privatePatterns, containsPrivateValue } from '../../../tools/scan-private-values.mjs';

const ROOT = path.resolve(import.meta.dirname, '../../..');
assert.equal(process.argv.length, 2);
const sha = b => createHash('sha256').update(b).digest('hex');
const base = execFileSync('git', ['rev-parse', 'HEAD'], {cwd:ROOT,encoding:'utf8'}).trim();
const project = JSON.parse(await readFile(path.join(ROOT, 'tracking/evidence/m07/controlled-pilot/2026-10-30T20-31-58-027Z-15649709-web-configure.json'), 'utf8'));
assert(project.project.id === 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0' && project.team === 'team_gboXPxTevpCOZuaA8eY9PmR1'
  && project.project.root_directory === 'apps/web' && project.project.node_version === '24.x'
  && project.domains.some(d => d.name === 'everyone-presentation-pilot.vercel.app' && d.verified));
const files = execFileSync('git', ['ls-files','-z','--','apps/web','packages','contracts/json-schema',
  'contracts/mcp-tool-catalog.json','package.json','package-lock.json','tsconfig.json','CONTRACT_BASELINE.md',
  'tools/start-web.mjs'], {cwd:ROOT}).toString('utf8').split('\0').filter(Boolean)
  .filter(p => !/(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/u.test(p));
files.push('apps/web/lib/hosting-pilot.ts', 'tools/start-pilot-web.mjs', 'apps/worker/package.json');
const selected = [...new Set(files)].sort();
assert(selected.length > 100 && selected.length < 1000);
assert(selected.every(p => !/(?:^|\/)(?:\.env[^/]*|\.local|\.git|Screenshots|redesign-output|node_modules|\.next[^/]*)(?:\/|$)/u.test(p)));
const privateFiles = { worker:'.env.worker.local',runtime:'.env.worker-runtime.local',logo:'.local/cloud-logo-provision/verifier.json',
  specs:'.local/specs-assets-verifier/verifier.json',jobService:'.env.job-service.local',candidate:'.env.candidate-runtime.local',
  support:'.env.support-runtime.local',review:'.env.review-runtime.local',presentation:'.env.presentation-runtime.local',guest:'.env.guest-runtime.local' };
const privateMaterial = {}, privateHashes = {};
for (const [key, relative] of Object.entries(privateFiles)) {
  const p = path.join(ROOT, relative), s = await lstat(p);
  assert(s.isFile() && !s.isSymbolicLink() && s.size < 65536 && (await realpath(p)).toLowerCase() === p.toLowerCase());
  privateMaterial[key] = await readFile(p); privateHashes[key] = sha(privateMaterial[key]);
}
const patterns = privatePatterns(privateMaterial);
const run = `${new Date().toISOString().replaceAll(':','-').replace('.','-')}-${randomUUID().slice(0,8)}`;
const destination = path.join(ROOT,'.local/m07-pilot',`web-source-${run}`);
await mkdir(destination,{recursive:false});
const manifest = [];
for (const relative of selected) {
  const source = path.join(ROOT,relative), s = await lstat(source);
  assert(s.isFile() && !s.isSymbolicLink() && s.size < 8 * 1024 * 1024 && (await realpath(source)).toLowerCase() === source.toLowerCase());
  const bytes = await readFile(source);
  assert(!containsPrivateValue(bytes,patterns) && !containsPrivateValue(Buffer.from(relative),patterns));
  const target = path.join(destination,relative); await mkdir(path.dirname(target),{recursive:true});
  await writeFile(target,bytes,{flag:'wx'}); manifest.push({path:relative,bytes:bytes.length,sha256:sha(bytes)});
}
for (const item of manifest) {
  assert.equal(sha(await readFile(path.join(ROOT,item.path))),item.sha256);
  assert.equal(sha(await readFile(path.join(destination,item.path))),item.sha256);
}
for (const [key,relative] of Object.entries(privateFiles)) assert.equal(sha(await readFile(path.join(ROOT,relative))),privateHashes[key]);
await mkdir(path.join(destination,'.vercel'));
await writeFile(path.join(destination,'.vercel/project.json'),JSON.stringify({projectId:project.project.id,orgId:project.team,projectName:project.project.name},null,2)+'\n',{flag:'wx'});
const report = {observed_at:new Date().toISOString(),result:'passed',scope:'Exact sparse app payload/source stability and fixed private-value families only; no PII or full-repository/archive scan claim',
  base_commit:base,source_type:'Current disk bytes including recorded owned uncommitted app changes',source_root:path.relative(ROOT,destination).replaceAll('\\','/'),
  project_id:project.project.id,team_id:project.team,origin:'https://everyone-presentation-pilot.vercel.app',files:manifest,
  entries:manifest.length,bytes:manifest.reduce((n,x)=>n+x.bytes,0),private_inputs:10,private_value_families:14,private_hits:0,
  private_input_stable:true,source_stable:true,secrets_or_private_digests_recorded:false,deployed:false,harness_sha256:sha(await readFile(import.meta.filename))};
const directory=path.join(ROOT,'tracking/evidence/m07/controlled-pilot');await mkdir(directory,{recursive:true});
const output=path.join(directory,`${run}-web-source.json`);await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,output),source_root:report.source_root,entries:report.entries,bytes:report.bytes,private_hits:0,deployed:false})+'\n');
