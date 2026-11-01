import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { APPLY_ENABLED, RUN, ROOT, ROLES, sha, pureHelpers, processAbsent, run, buildSql, validateRoles, withoutOwned, withoutCatalogue, validateSnapshot, verifyArchivedSources, executeWithPorts } from './cleanup.mjs';

const read = async file => readFile(path.join(ROOT,file));
const json = async file => JSON.parse(await read(file));
async function fixture() {
 const prefix = `.local/m07-worker38-concurrency-tests/${RUN}/`;
 const helpers = await pureHelpers();
 const before = await json('tracking/evidence/m07/worker38-concurrency/2026-11-01T18-36-34-245Z-93bb8f21.json');
 const observation = await json('tracking/evidence/m07/worker38-concurrency/2026-11-01T18-38-37.532Z-93bb-role-observation.json');
 const original = await json(prefix+'original29-full-auth-storage-catalogue.json'), source33 = await json(prefix+'source33-before-fixture-catalogue.json');
 const data = {helpers,before,observation,original,source33,controller:await read(`.local/m07-worker38-concurrency-prepared/${RUN}/controller.mjs`),catalogue:helpers.compiler.fullCatalogue33Sql(new Map([['development/m07/db/catalog29.sql',await read('development/m07/db/catalog29.sql')]])).sql};
 const old = ROLES.slice(0,2).map((name,i) => ({name,oid:String(316200+i*40),marker:`eps-m07-recovery33:${RUN}:${i===0?'issuer':'consent'}`,login:false,super:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null,clients:0,dependencies:[],memberships:['supabase_admin','postgres'].map(grantor=>({role:name,member:'postgres',grantor,...Object.fromEntries(['admin','inherit','set'].map(field=>[field,source33[`memberships|${name}>postgres/${grantor}|${field}`]]))}))}));
 const roles = {old,trace:structuredClone(observation.role)};
 const snapshot = {roles,baseline:{table_rows:{synthetic:'fixed'},functions:'fixed',grants:'fixed'},context:{current_user:'postgres',session_user:'supabase_admin',search_path:'"$user", public, extensions',timezone:'UTC',date_style:'ISO, MDY',interval_style:'postgres',extra_float_digits:'1',bytea_output:'hex'}};
 return {data,snapshot};
}
test('default false refuses before any private artifact or SQL/provider port',async()=>{
 assert.equal(APPLY_ENABLED,false); let touched=false;
 await assert.rejects(run(new Proxy({}, {get(){touched=true;throw Error('PORT_TOUCHED');}})),/CLEANUP93BB_DISABLED/u);
 assert.equal(touched,false);
});
test('owner PID absence refuses live or unknown process state',()=>{
 assert.equal(processAbsent(()=>{}),false);
 assert.equal(processAbsent(()=>{throw Object.assign(Error(),{code:'EPERM'});}),false);
 assert.equal(processAbsent(()=>{throw Object.assign(Error(),{code:'ESRCH'});}),true);
});
test('all312 historical source seals are recoverable from the exact failed Git checkpoint',async()=>{
 const plan=await json(`.local/m07-worker38-concurrency-prepared/${RUN}/plan.json`);
 await verifyArchivedSources(plan);
 const changed=structuredClone(plan);changed.source_pins['development/m07/worker38-concurrency/proof.mjs']='0'.repeat(64);
 await assert.rejects(verifyArchivedSources(changed));
});
test('full raw native OID and exact old creation-marker/member graphs are preserved',async()=>{
 const {data,snapshot}=await fixture(); const saved=JSON.stringify(snapshot.roles); validateRoles(data,snapshot.roles);
 assert.equal(JSON.stringify(snapshot.roles),saved); assert.equal(snapshot.roles.trace.oid,'316935');
 for(const mutate of [r=>r.trace.oid='0316935',r=>r.trace.oid=316935,r=>r.trace.marker+='-other',r=>r.trace.memberships[0].admin=false,r=>r.old[0].memberships[1].inherit=true,r=>r.old[1].clients=1,r=>r.old[1].dependencies.push({dbid:1}),r=>r.old[0].super=true]){
  const roles=structuredClone(snapshot.roles);mutate(roles);assert.throws(()=>validateRoles(data,roles));
 }
});
test('one guarded three-drop transaction and read-only postchecks parse completely',async()=>{
 const {data,snapshot}=await fixture(), marker='93bb0000-0000-4000-8000-000000000001', instance='93bb0000-0000-4000-8000-000000000002';
 const sql=buildSql(data,snapshot,instance,marker),post=buildSql(data,snapshot,instance,marker,true);
 assert.equal((sql.match(/^begin;/gmu)??[]).length,1);assert.equal((sql.match(/\bcommit;/gu)??[]).length,1);
 assert.equal((sql.match(/\bdrop role /gu)??[]).length,3);assert.equal((post.match(/\bdrop role /gu)??[]).length,0);
 assert(sql.includes("'oid': '316935'")===false);assert(sql.includes('"oid":"316935"'));
 const expectedKey=sha(ROOT.toLowerCase()).slice(0,24);assert(sql.includes(`workspace_key='${expectedKey}'`));
 assert(sql.includes("session_user<>'supabase_admin'"));assert(sql.includes('set local role postgres;'));
 assert(sql.indexOf('pg_catalog.pg_authid')<sql.indexOf('CLEANUP93BB_EXACT_ROLES_CHANGED'));
 assert(sql.indexOf('CLEANUP93BB_CATALOGUE_BEFORE')<sql.indexOf('drop role eps_job_trace_owner'));
 assert(sql.lastIndexOf('CLEANUP93BB_CATALOGUE_AFTER')>sql.indexOf('drop role eps_mcp_issuer_owner'));
 assert(!/\b(?:drop owned|reassign owned|drop database|revoke)\b/iu.test(sql));
 const result=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-X','utf8','-B','-c',"import sys,json;from pglast import parse_sql,parse_plpgsql\nfor value in json.load(sys.stdin):\n parse_sql(value);parse_plpgsql(value)\nprint('PARSED')"],{input:JSON.stringify([sql,post]),encoding:'utf8',windowsHide:true,shell:false,timeout:20000,maxBuffer:1024*1024,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='DEBUG'))});
 assert.equal(result.status,0,result.stderr);assert.equal(result.stdout.trim(),'PARSED');
});
test('projection excludes only exact three owned role/member deltas',async()=>{
 const {data,snapshot}=await fixture();const global=structuredClone(data.before.existing_global_roles_before);
 for(const row of [...snapshot.roles.old,snapshot.roles.trace])global.roles.push({name:row.name,oid:row.oid});
 global.memberships.push({role_oid:'316935',member_oid:'16440',grantor_oid:'10'});
 assert.deepEqual(withoutOwned(global,snapshot.roles,data.helpers.identity.normalizeDatabaseOid),data.before.existing_global_roles_before);
 const current={...data.original,'roles|eps_job_trace_owner|super':false,'memberships|eps_job_trace_owner>postgres/postgres|set':true};
 assert.deepEqual(withoutCatalogue(current),data.original);
 const changed={...current,'functions|public.unrelated()|source_sha256':'changed'};
 assert.notDeepEqual(withoutCatalogue(changed),data.original);
 const invalid={...snapshot,global,catalogue:current};assert.throws(()=>validateSnapshot(data,invalid)); // synthetic baseline never receives real-state credit
});
function fakePorts(mode='normal'){
 const stored=new Map(),events=[],lock=Buffer.from('synthetic-retained-lock');
 const target={observed:{system_identifier:'7701520506262638626'},container:{Id:'synthetic-owned-container'},owned:{instance_id:'93bb0000-0000-4000-8000-000000000002'}};
 let calls=0;
 const ports={
  retainedLock:async()=>lock,verify:async()=>target,verifySources:async()=>{},
  write:async(file,value)=>{assert.equal(stored.has(file),false,'PERMANENT_CLAIM_EXISTS');stored.set(file,value);events.push(file.endsWith('.returned.json')?'returned':'claim');},
  database:async sql=>{
   calls++;const phase=sql.startsWith('begin read only;')?'readback':'cleanup';
   assert([...stored.keys()].some(file=>file.endsWith('.claim.json')));events.push(phase);
   if(mode==='unknown'&&phase==='cleanup')throw Error('SAFE_SYNTHETIC_UNKNOWN');
   const marker=/,'marker','([a-f0-9-]{36})','preserved'/u.exec(sql)?.[1];assert(marker);
   return[{run_id:RUN,marker,preserved:!(mode==='bad_readback'&&calls===3),roles_absent:true,phase}];
  },
  remove:async()=>{assert.equal(calls,3);events.push('release-exact-lock');},
 };
 return{ports,stored,events,lock,target,calls:()=>calls};
}
test('claimed protocol requires normal return and two equal postchecks before exact lock release',async()=>{
 const {data,snapshot}=await fixture(),fake=fakePorts();
 const result=await executeWithPorts(fake.ports,data,fake.lock,fake.target,snapshot);
 assert.equal(result.result,'passed_cleanup_reconciliation');assert.equal(result.lock_released,true);
 assert.deepEqual(fake.events,['claim','cleanup','returned','readback','readback','release-exact-lock']);
 const calls=fake.calls();await assert.rejects(executeWithPorts(fake.ports,data,fake.lock,fake.target,snapshot),/PERMANENT_CLAIM_EXISTS/u);
 assert.equal(fake.calls(),calls);
});
test('unknown mutation retains permanent claim and lock without retry or invented normal return',async()=>{
 const {data,snapshot}=await fixture(),fake=fakePorts('unknown');
 const result=await executeWithPorts(fake.ports,data,fake.lock,fake.target,snapshot);
 assert.equal(result.result,'unconfirmed');assert.equal(result.normal_return_observed,false);assert.equal(result.lock_released,false);
 assert.deepEqual(fake.events,['claim','cleanup']);assert.equal(fake.stored.size,1);
 await assert.rejects(executeWithPorts(fake.ports,data,fake.lock,fake.target,snapshot),/PERMANENT_CLAIM_EXISTS/u);assert.equal(fake.calls(),1);
});
test('normal mutation with a failed second postcheck retains its return marker, claim and lock',async()=>{
 const {data,snapshot}=await fixture(),fake=fakePorts('bad_readback');
 const result=await executeWithPorts(fake.ports,data,fake.lock,fake.target,snapshot);
 assert.equal(result.result,'unconfirmed');assert.equal(result.normal_return_observed,true);assert.equal(result.two_independent_postchecks,false);assert.equal(result.lock_released,false);
 assert.deepEqual(fake.events,['claim','cleanup','returned','readback','readback']);assert.equal(fake.stored.size,2);
});
