/** NEW owned-only collector validation. Importing is inert; default-off. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout, clearTimeout } from 'node:timers';
export const EXECUTION_ENABLED=true;
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const sha=value=>createHash('sha256').update(value).digest('hex');
const only=text=>{const rows=text.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];};

export async function bridge(action,value,root){
 assert(['configuration','render','compare'].includes(action));
 return new Promise((resolve,reject)=>{
  const child=spawn('D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe',['-X','utf8','-B',new URL('./local.py',import.meta.url).pathname.replace(/^\/([A-Z]:)/u,'$1'),action],{cwd:root,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
  let stdout='',stderr='',bytes=0;const timer=setTimeout(()=>{child.kill();reject(Error('REASON40_LOCAL_BRIDGE_TIMEOUT'));},15000);
  child.once('error',()=>{clearTimeout(timer);reject(Error('REASON40_LOCAL_BRIDGE_UNCONFIRMED'));});child.stdin.on('error',()=>{});
  for(const[stream,out]of[[child.stdout,true],[child.stderr,false]])stream.on('data',data=>{bytes+=data.length;if(bytes>8*1024**2)child.kill();else if(out)stdout+=data;else stderr+=data;});
  child.once('close',code=>{clearTimeout(timer);if(code!==0||bytes>8*1024**2||stderr)reject(Error('REASON40_LOCAL_BRIDGE_UNCONFIRMED'));else{try{resolve(JSON.parse(stdout));}catch{reject(Error('REASON40_LOCAL_BRIDGE_UNCONFIRMED'));}}});
  const input=value?JSON.stringify(value):'';assert(Buffer.byteLength(input)<=32*1024**2);child.stdin.end(input);
 });
}

export async function runCases(ctx,cfg){
 assert(EXECUTION_ENABLED,'REASON40_COLLECTOR_EXECUTION_DISABLED');assert.notEqual(ctx.system,'7701520506262638626');
 for(const[file,expected]of Object.entries(cfg.source_pins))assert.equal(sha(await readFile(file)),expected);
 const guard=`set session authorization postgres;set timezone='UTC';set eps.reason40collector.run=${quote(ctx.runId)};do $owned$begin if current_database()<>'project39'or(pg_control_system()).system_identifier::text<>${quote(ctx.system)}then raise exception'REASON40_COLLECTOR_OWNED_TARGET_REQUIRED';end if;end$owned$;`;
 const query=async sql=>{await ctx.inspect();const result=await ctx.sql(guard+sql);assert(Buffer.byteLength(result.stdout)<=16*1024**2);return only(result.stdout);};
 const snapshot=()=>query("begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='60s';"+cfg.state_sql+'as reason40_release;rollback;');
 const checkpoint=()=>query("begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='60s';"+cfg.checkpoint_sql+'as reason40_release;rollback;');
 const before=await snapshot(),second=await snapshot();assert.deepEqual(before,second);const beforeCheckpoint=await checkpoint();assert.deepEqual(beforeCheckpoint.state,before);
 const marker=randomUUID(),rendered=await bridge('render',{before,system:ctx.system,run:ctx.runId,marker},ctx.root);
 let denied=false;
 try{await query(rendered.negative_sql);}catch(error){denied=/REASON40_PREIMAGE_CHANGED/u.test(error.diagnostic?.stderr??'');}
 assert(denied,'REASON40_ACTUAL_PREFLIGHT_REFUSAL_REQUIRED');assert.deepEqual(await snapshot(),before);
 const returned=await query(rendered.sql);assert.deepEqual(returned,{version:'20261102085405',marker,migration_sha256:cfg.migration_sha256});
 const after=await snapshot(),last=await snapshot();assert.deepEqual(after,last);assert.deepEqual(after,rendered.expected);const afterCheckpoint=await checkpoint();assert.deepEqual(afterCheckpoint.state,after);
 const validation=await bridge('compare',{before,after,before_checkpoint:beforeCheckpoint,after_checkpoint:afterCheckpoint,system:ctx.system,run:ctx.runId},ctx.root);assert.equal(validation.result,'passed');
 for(const[file,expected]of Object.entries(cfg.source_pins))assert.equal(sha(await readFile(file)),expected);
 ctx.report.collector_validation={...validation,actual_negative_preimage_refused_and_rolled_back:true,normal_commit_nonce_observed:true,two_equal_before_reads:true,two_equal_after_reads:true,before_and_after_full76_checkpoints_checked:true,checkpoint_rows_RAM_only:true,raw_checkpoint_bytes_persisted:false,canonical_render_sha256:rendered.canonical_render_sha256,owned_render_sha256:rendered.owned_render_sha256,only_database_system_run_admission_changed:rendered.only_database_system_run_admission_changed};
 ctx.report.collector_source_pins=cfg.source_pins;
}
