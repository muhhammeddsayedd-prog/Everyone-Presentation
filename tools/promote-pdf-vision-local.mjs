/** Exact reviewed M02 compatibility16 promotion on owned local15 only. */
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { mkdir,open,readFile,unlink,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { runOwnedLocalSql,runReviewedSqlFile } from './local-postgres.mjs';
import { verifyNativeSpecsLocalTarget } from './lib/native-specs-local-transport.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');const MIGRATION='supabase/migrations/20261029094600_m02_pdf_vision.sql';const SEAL='5b7ad204f6dddde82ae829577ea1130fd426a3998797460871baad20d789cb50';
const PROOF='tracking/evidence/m02/pdf-vision-local/2026-10-29T09-44-04-388Z-c6863e17.json';const LOCK=path.join(ROOT,'.local/local-postgres/test-db.lock');
const CHANGED=['eps.specs_validate_file_preparation','eps.store_specs_preparation'];const hash=value=>createHash('sha256').update(value).digest('hex');
const report={run_id:randomUUID(),started_at:new Date().toISOString(),result:'failed',cloud_called:false,migration:MIGRATION,migration_sha256:SEAL};let owns=false;let dispatched=false;
async function snapshot(){const value=await runOwnedLocalSql(await readFile(path.join(ROOT,'tools/sql/specs-read-operation-readback.sql'),'utf8'));const rows=value.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];}
try{
 assert.equal(process.argv.length,2);const bytes=await readFile(path.join(ROOT,MIGRATION));assert.equal(hash(bytes),SEAL);assert.deepEqual(bytes,await readFile(path.join(ROOT,'development/m02/pdf-vision-compatibility-candidate.sql')));
 const proof=JSON.parse(await readFile(path.join(ROOT,PROOF),'utf8'));assert(proof.result==='passed'&&proof.rollback_verified&&proof.sources_stable&&proof.red_rejected_before_patch&&proof.green_private_paged_preparation_and_callback);
 assert.equal(proof.source_seals['development/m02/pdf-vision-compatibility-candidate.sql'],SEAL);report.proof_sha256=hash(await readFile(path.join(ROOT,PROOF)));
 const lock=await open(LOCK,'wx',0o600);try{await lock.writeFile(JSON.stringify({run_id:report.run_id,pid:process.pid}));owns=true;}finally{await lock.close();}
 const target=await verifyNativeSpecsLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');const before=await snapshot();assert.equal(before.versions.length,15);report.before=before;
 dispatched=true;report.promotion=await runReviewedSqlFile(MIGRATION);const after=await snapshot();report.after=after;assert.deepEqual(after.versions,[...before.versions,'20261029094600']);
 for(const [key,value]of Object.entries(before))if(!['versions','catalog'].includes(key))assert.deepEqual(after[key],value);
 const adjusted=globalThis.structuredClone(after.catalog);const functions=[];
 for(const name of CHANGED){const previous=before.catalog.functions.find(row=>row.name===name);const current=adjusted.functions.find(row=>row.name===name);assert(previous&&current&&previous.source_sha256!==current.source_sha256);functions.push({name,before:previous.source_sha256,after:current.source_sha256});current.source_sha256=previous.source_sha256;}
 assert.deepEqual(adjusted,before.catalog);assert.equal((await verifyNativeSpecsLocalTarget()).container.Id,target.container.Id);report.changed_functions=functions;report.only_two_helper_bodies_changed=true;report.business_and_all_other_catalog_preserved=true;report.result='passed';
}catch{report.dispatch_attempted=dispatched;if(owns){try{report.unverified_readback=await snapshot();}catch{ /* Unknown outcome remains explicit. */ }}process.exitCode=1;}
finally{
 if(owns&&(!dispatched||report.result==='passed')){const owner=JSON.parse(await readFile(LOCK,'utf8'));assert.equal(owner.run_id,report.run_id);assert.equal(owner.pid,process.pid);await unlink(LOCK);}
 report.lock_retained=owns&&dispatched&&report.result!=='passed';report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m02/pdf-vision-promotion');await mkdir(directory,{recursive:true});const file=path.join(directory,`${report.finished_at.replace(/[:.]/gu,'-')}-${report.run_id.slice(0,8)}.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),cloud_called:false,lock_retained:report.lock_retained})+'\n');
}
