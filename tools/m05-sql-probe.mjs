// Owned local23 read/rollback-only development probe. Never invokes a cloud CLI.
import {readFile} from 'node:fs/promises';
import {runOwnedLocalSql,verifyLocalTarget} from './local-postgres.mjs';
await verifyLocalTarget();
const mode=process.argv[2];
if(mode==='hashes'){
 const sql=`begin read only;set local search_path='';select p.oid::regprocedure::text||'|'||encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex')from pg_proc p where p.oid in('eps.review_snapshot_data(uuid,uuid,text)'::regprocedure,'public.eps_create_presentation_series(jsonb,text)'::regprocedure,'eps.review_target_context(uuid,text,uuid,text)'::regprocedure,'public.eps_get_workspace_review(uuid,uuid,text)'::regprocedure,'public.eps_request_workspace_review_fit(uuid,uuid,jsonb,text)'::regprocedure);rollback;`;
 process.stdout.write((await runOwnedLocalSql(sql)).stdout);
}else if(mode==='sources'){
 const sql=`begin read only;set local search_path='';select jsonb_build_object('signature',p.oid::regprocedure::text,'sha256',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'body',p.prosrc)from pg_proc p where p.oid in('eps.claim_job_stage(jsonb)'::regprocedure,'eps.get_specs_stage_input(uuid,uuid,text)'::regprocedure,'eps.record_job_event(jsonb)'::regprocedure,'eps.recover_job_stages(integer)'::regprocedure,'eps.claim_job_stage_replay(jsonb,text,text,text)'::regprocedure,'eps.get_job_asset_access(jsonb)'::regprocedure,'eps.reserve_job_output(jsonb)'::regprocedure,'eps.complete_job_output(jsonb)'::regprocedure,'public.eps_retry_job(uuid,jsonb,text)'::regprocedure,'public.eps_cancel_job(uuid,jsonb,text)'::regprocedure,'eps.jobs_dto(uuid)'::regprocedure);rollback;`;
 const r=await runOwnedLocalSql(sql);const {mkdir,writeFile}=await import('node:fs/promises');await mkdir('.local/m05-contract-fixtures',{recursive:true});await writeFile('.local/m05-contract-fixtures/preceding-sources.json',JSON.stringify(r.stdout.split(/\r?\n/).filter(v=>v.startsWith('{')).map(v=>JSON.parse(v)),null,2));process.stdout.write('Owned local routine metadata retained privately.\n');
}else if(mode==='compile'){
 const files=['versions.sql','template-forward.sql','presentation-processing.sql','presentation-assets.sql','finalize.sql'];
 const parts=[];for(const f of files){try{parts.push(await readFile(`development/m05/${f}`,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
 process.stdout.write((await runOwnedLocalSql(`begin;set local role postgres;${parts.join('\n')}rollback;`)).stdout);
}else throw new Error('Fixed probe mode required');
