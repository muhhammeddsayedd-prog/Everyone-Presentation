/** Actual composed17 DDL/catalog in one owned-local rollback; no fixtures. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {runOwnedLocalSql} from './local-postgres.mjs';
import {verifyNativeSpecsLocalTarget} from './lib/native-specs-local-transport.mjs';
import {compareCandidatePipeline} from './lib/candidate-pipeline-comparison.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');const MIGRATION='supabase/migrations/20261029100500_m03_candidate_pipeline.sql';
const SEAL='4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836';
const READBACK='tools/sql/candidate-pipeline-readback.sql';const READBACK_SEAL='4bfaa7da1b96a4bb5c4dcea198ce56bb4b05aaaf64815b2dae1243c4ee2abbc9';
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');const hash=v=>createHash('sha256').update(v).digest('hex');
const report={run_id:randomUUID(),started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,migration:MIGRATION,migration_sha256:SEAL,readback:READBACK,readback_sha256:READBACK_SEAL};let owns=false;let before;
function parse(output){const rows=output.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];}
try{
 assert.equal(process.argv.length,2);const migration=await readFile(path.join(ROOT,MIGRATION),'utf8');assert.equal(hash(migration),SEAL);
 const readback=await readFile(path.join(ROOT,READBACK),'utf8');assert.equal(hash(readback),READBACK_SEAL);
 const body=readback.replace('begin isolation level repeatable read read only;','').replace(/rollback;\s*$/u,'');assert(!body.includes('begin isolation'));
 const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:report.run_id,pid:process.pid}));owns=true;}finally{await lock.close();}
 const target=await verifyNativeSpecsLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 before=parse((await runOwnedLocalSql(readback)).stdout);assert.equal(before.versions.length,16);report.before=before;
 const after=parse((await runOwnedLocalSql(`begin;\n${migration}\n${body}\nrollback;`)).stdout);report.candidate=after;
 report.comparison=compareCandidatePipeline(before,after,before,after,{history:false});
 const restored=parse((await runOwnedLocalSql(readback)).stdout);assert.deepEqual(restored,before);report.rollback_verified=true;
 assert.equal(hash(await readFile(path.join(ROOT,MIGRATION))),SEAL);assert.equal(hash(await readFile(path.join(ROOT,READBACK))),READBACK_SEAL);report.sources_stable=true;
 assert.equal((await verifyNativeSpecsLocalTarget()).container.Id,target.container.Id);report.result='passed';
}catch(error){report.diagnostic=String(error.message).slice(0,2000);if(owns&&before){try{report.rollback_verified=hash(JSON.stringify(parse((await runOwnedLocalSql(await readFile(path.join(ROOT,READBACK),'utf8'))).stdout)))===hash(JSON.stringify(before));}catch{report.rollback_verified=false;}}process.exitCode=1;}
finally{
 if(owns&&report.rollback_verified){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,report.run_id);await unlink(LOCK);}
 report.lock_retained=owns&&!report.rollback_verified;report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m03/kernel-catalog');await mkdir(directory,{recursive:true});const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${report.run_id.slice(0,8)}.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),rollback_verified:report.rollback_verified,diagnostic:report.diagnostic})+'\n');
}
