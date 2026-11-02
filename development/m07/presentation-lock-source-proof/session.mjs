/** New-purpose copy of the reviewed inert owned-session transport. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { setTimeout,clearTimeout } from 'node:timers';
const literal=v=>String.fromCharCode(39)+v.replaceAll(String.fromCharCode(39),String.fromCharCode(39).repeat(2))+String.fromCharCode(39);
const only=v=>{assert.equal(v.length,1);return v[0];};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function decodedRow(line){return line.startsWith('{')||line.startsWith('[')?JSON.parse(line):null;}
export function session(ctx,tag){
 assert(/^[a-z_]{1,15}$/u.test(tag));const application='locksource41_'+ctx.runId.slice(0,8)+'_'+tag;
 const child=spawn('docker',['--host','npipe:////./pipe/dockerDesktopLinuxEngine',...ctx.psqlArgs()],{cwd:ctx.root,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='',buffered='',count=0,pending,ended=false,identity;
 const failure=()=>Object.assign(Error('LOCKSOURCE41_SESSION_FAILED'),{diagnostic:{stdout,stderr}});
 const done=new Promise(resolve=>child.once('close',code=>{ended=true;if(pending){clearTimeout(pending.timer);pending.reject(failure());pending=undefined;}resolve(code);}));
 child.once('error',()=>{if(pending)pending.reject(failure());});child.stdin.on('error',()=>{});
 child.stderr.on('data',raw=>{stderr+=raw;if(stderr.length>128*1024)child.kill();});
 child.stdout.on('data',raw=>{count+=raw.length;if(count>2*1024**2){child.kill();return;}stdout+=raw;buffered+=raw;
  for(;;){const end=buffered.indexOf('\n');if(end<0)break;const line=buffered.slice(0,end).trim();buffered=buffered.slice(end+1);if(!pending)continue;
   let value;try{value=decodedRow(line);}catch{child.kill();return;}if(value===null)continue;if(value.__locksource41_marker===pending.marker){const selected=pending;pending=undefined;clearTimeout(selected.timer);selected.resolve(selected.rows);}else pending.rows.push(value);
  }});
 const request=(text,timeout=45000)=>{assert(!pending&&!ended&&Buffer.byteLength(text)<=2*1024**2);count=0;return new Promise((resolve,reject)=>{const marker=randomUUID(),timer=setTimeout(()=>{if(pending?.marker===marker){pending=undefined;child.kill();reject(Error('LOCKSOURCE41_SESSION_TIMEOUT'));}},timeout);pending={marker,timer,rows:[],resolve,reject};child.stdin.write(text+'\nselect jsonb_build_object(\'__locksource41_marker\','+literal(marker)+');\n');});};
 const value={request,application,done,get pid(){return identity?.pid;},rollback(){if(!ended)child.stdin.end('rollback;\n\\quit\n');},async finish(){value.rollback();await Promise.race([done,delay(5000).then(()=>{child.kill();throw Error('LOCKSOURCE41_SESSION_CLEANUP_UNCONFIRMED');})]);},async start(){
  await ctx.inspect();identity=only(await request(`set eps.locksource41.run=${literal(ctx.runId)};set log_statement='none';set log_min_duration_statement=-1;set lock_timeout='8s';set statement_timeout='45s';set timezone='UTC';set application_name=${literal(application)};set session authorization postgres;
do $owned$begin if current_database()<>'project39'or(pg_control_system()).system_identifier::text<>${literal(ctx.system)}or(select count(*)from supabase_migrations.schema_migrations)not in(40,41)then raise exception'LOCKSOURCE41_OWNED_CLUSTER_REQUIRED';end if;end$owned$;
select jsonb_build_object('pid',pg_backend_pid(),'database',current_database(),'system',(pg_control_system()).system_identifier::text);`));assert.equal(identity.database,'project39');assert.equal(identity.system,ctx.system);assert(Number.isSafeInteger(identity.pid)&&identity.pid>0);return value;
 }};ctx.sessions.push(value);return value;
}

