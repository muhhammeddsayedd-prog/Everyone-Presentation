/** Fixed reviewed16->17 on the owned local instance. No cloud/provider IO. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,open,readFile,unlink,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {runOwnedLocalSql,runReviewedSqlFile} from './local-postgres.mjs';
import {verifyNativeSpecsLocalTarget} from './lib/native-specs-local-transport.mjs';
import {compareCandidatePipeline} from './lib/candidate-pipeline-comparison.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');const MIGRATION='supabase/migrations/20261029100500_m03_candidate_pipeline.sql';const SEAL='4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836';
const PROOF='tracking/evidence/m03/kernel-local/2026-10-29T10-17-45-307Z-cfce26d3.json';
const PREVIEW='tracking/evidence/m03/kernel-catalog/2026-10-29T10-20-30-781Z-5b008cdd.json';
const READBACK='tools/sql/candidate-pipeline-readback.sql';const READBACK_SEAL='4bfaa7da1b96a4bb5c4dcea198ce56bb4b05aaaf64815b2dae1243c4ee2abbc9';
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');const hash=v=>createHash('sha256').update(v).digest('hex');
const report={run_id:randomUUID(),started_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,migration:MIGRATION,migration_sha256:SEAL};let owns=false;let dispatched=false;
async function snapshot(){const value=await runOwnedLocalSql(await readFile(path.join(ROOT,READBACK),'utf8'));const rows=value.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];}
try{
 assert.equal(process.argv.length,2);assert.equal(hash(await readFile(path.join(ROOT,MIGRATION))),SEAL);assert.equal(hash(await readFile(path.join(ROOT,READBACK))),READBACK_SEAL);
 const proof=JSON.parse(await readFile(path.join(ROOT,PROOF),'utf8'));const preview=JSON.parse(await readFile(path.join(ROOT,PREVIEW),'utf8'));
 assert(proof.result==='passed'&&proof.rollback_verified&&proof.sources_stable&&proof.assertions_passed);assert(preview.result==='passed'&&preview.rollback_verified&&preview.sources_stable&&preview.migration_sha256===SEAL&&preview.readback_sha256===READBACK_SEAL);
 for(const[file,seal]of Object.entries(proof.source_seals))assert.equal(hash(await readFile(path.join(ROOT,file))),seal);
 report.proof_sha256=hash(await readFile(path.join(ROOT,PROOF)));report.preview_sha256=hash(await readFile(path.join(ROOT,PREVIEW)));
 const manifest=JSON.parse(await readFile(path.join(ROOT,'development/local-db/reviewed.json'),'utf8'));assert.equal(manifest.migrations.length,17);assert.equal(manifest.migrations.at(-1).path,MIGRATION);assert.equal(manifest.migrations.at(-1).sha256,SEAL);
 const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:report.run_id,pid:process.pid}));owns=true;}finally{await lock.close();}
 const target=await verifyNativeSpecsLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');const before=await snapshot();assert.equal(before.versions.length,16);assert.deepEqual(before,preview.before);report.before=before;
 dispatched=true;report.promotion=await runReviewedSqlFile(MIGRATION);const after=await snapshot();report.after=after;
 report.comparison=compareCandidatePipeline(before,after,preview.before,preview.candidate);assert.equal((await verifyNativeSpecsLocalTarget()).container.Id,target.container.Id);report.business_and_old_catalog_preserved=true;report.result='passed';
}catch(error){report.dispatch_attempted=dispatched;report.diagnostic=String(error.message).slice(0,1500);if(owns){try{report.unverified_readback=await snapshot();}catch{/* Unknown outcome remains explicit. */}}process.exitCode=1;}
finally{
 if(owns&&(!dispatched||report.result==='passed')){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,report.run_id);assert.equal(owner.pid,process.pid);await unlink(LOCK);}
 report.lock_retained=owns&&dispatched&&report.result!=='passed';report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m03/kernel-promotion');await mkdir(directory,{recursive:true});const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${report.run_id.slice(0,8)}.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),cloud_called:false,lock_retained:report.lock_retained,diagnostic:report.diagnostic})+'\n');
}
