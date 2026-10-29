/** Root-reviewed additive14 only; fixed owned local target, no cloud or seed. */
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,open,readFile,unlink,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOwnedLocalSql,runReviewedSqlFile } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const MIGRATION='supabase/migrations/20261029090500_m02_service_claim_replay.sql';
const PROOF='tracking/evidence/m02/service-claim-replay/2026-10-29T08-55-09-367Z-06d070d5-rollback.json';
const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={ run_id:randomUUID(),started_at:new Date().toISOString(),result:'failed',cloud_called:false,migration:MIGRATION };
let owns=false;let dispatched=false;
async function snapshot(){const result=await runOwnedLocalSql(await readFile(path.join(ROOT,'tools/sql/specs-read-operation-readback.sql'),'utf8'));
 const rows=result.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];}
try{
 assert.equal(process.argv.length,2);
 const source=await readFile(path.join(ROOT,MIGRATION));assert.deepEqual(source,await readFile(path.join(ROOT,'development/m02/service-claim-replay-candidate.sql')));
 const proof=JSON.parse(await readFile(path.join(ROOT,PROOF),'utf8'));assert(proof.result==='passed'&&proof.rollback_verified&&proof.cloud_called===false);
 assert.equal(hash(source),proof.source_seals.candidate);report.migration_sha256=hash(source);report.proof_sha256=hash(await readFile(path.join(ROOT,PROOF)));
 const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:report.run_id,pid:process.pid}));owns=true;}finally{await lock.close();}
 const target=await verifyNativeSpecsLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 const before=await snapshot();assert.equal(before.versions.length,13);report.before=before;
 dispatched=true;report.promotion=await runReviewedSqlFile(MIGRATION);
 const after=await snapshot();report.after=after;assert.deepEqual(after.versions,[...before.versions,'20261029090500']);
 for(const key of ['source_config','assets','runtime','buckets'])assert.deepEqual(after[key],before[key]);
 for(const key of ['counts','data_sha256']){const adjusted={...after[key]};delete adjusted['eps.job_stage_claim_replays'];assert.deepEqual(adjusted,before[key]);}
 assert.equal(after.counts['eps.job_stage_claim_replays'],0);
 const adjusted=globalThis.structuredClone(after.catalog);
 for(const [key,rows]of Object.entries(adjusted))adjusted[key]=rows.filter(row=>row.table!=='eps.job_stage_claim_replays'&&row.name!=='eps.job_stage_claim_replays'&&row.name!=='eps.claim_job_stage_replay');
 assert.deepEqual(adjusted,before.catalog);assert.equal((await verifyNativeSpecsLocalTarget()).container.Id,target.container.Id);
 report.business_and_old_catalog_preserved=true;report.result='passed';
}catch{report.dispatch_attempted=dispatched;if(owns){try{report.unverified_readback=await snapshot();}catch{ /* Preserve the unknown promotion outcome. */ }}process.exitCode=1;}
finally{
 if(owns&&(!dispatched||report.result==='passed')){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,report.run_id);assert.equal(owner.pid,process.pid);await unlink(LOCK);}
 report.lock_retained=owns&&dispatched&&report.result!=='passed';report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m02/service-claim-promotion');await mkdir(directory,{recursive:true});
 const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${report.run_id.slice(0,8)}.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),cloud_called:false,lock_retained:report.lock_retained})+'\n');
}
