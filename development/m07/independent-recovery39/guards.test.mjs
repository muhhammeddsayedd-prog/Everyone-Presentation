import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { mkdir, writeFile, readFile, lstat, realpath, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { ENTRY_ENABLED, run } from './run.mjs';
import { resourceName, assertOwnedResource, functional39, MIGRATION, CREATOR, INPUT, projectReceipt, namedRoles, filteredHistoricalRowsSql, rlsDenialSql, sha } from './guards.mjs';
import { create39Bundle, read39Bundle, validateManifest } from './backup.mjs';

const ROOT=path.resolve(import.meta.dirname,'../../..'),runId='12345678-1234-4234-8234-123456789abc';
const receipt=()=>({id:'a7390000-0000-4000-8000-000000000010',...INPUT,client_id:null,client_name:null,client_logo_asset_id:null,row_version:1,client_row_version:null,casting_workspace_id:null,can_edit:true});
test('disabled actual runner refuses before any path, credential, Docker or DB preparation',async()=>{assert.equal(ENTRY_ENABLED,false);await assert.rejects(run('untrusted path that must never be read'),/RECOVERY39_ENTRY_DISABLED/u);});
test('new resource purpose/name and immutable identities cannot adopt38 or unrelated resources',()=>{
 const name=resourceName(runId,'source');assert(name.startsWith('eps-r39-'));const labels={'eps.recovery.run':runId,'eps.recovery.workspace':ROOT,'eps.recovery.purpose':'independent39'},value={Id:'owned',Name:'/'+name,Config:{Labels:labels}};
 assertOwnedResource(value,{id:'owned',name,run:runId,workspace:ROOT});
 assert.throws(()=>assertOwnedResource({...value,CreatedAt:'changed'},{id:'owned',name,run:runId,workspace:ROOT,created_at:'original'}));
 for(const changed of[{Id:'other'},{Name:'eps-r38-old'},{Config:{Labels:{...labels,'eps.recovery.purpose':'independent38'}}},{Config:{Labels:{...labels,'eps.recovery.workspace':'other'}}}])assert.throws(()=>assertOwnedResource({...value,...changed},{id:'owned',name,run:runId,workspace:ROOT}));
 for(const kind of['../db','unrelated','db;drop'])assert.throws(()=>resourceName(runId,kind));
});
test('exact current39 migration functional bytes are required; canonical guard is not silently executed',async()=>{
 const bytes=await readFile(path.join(ROOT,MIGRATION)),sql=functional39(bytes);assert(sql.includes('create table eps.project_creation_intents'));assert(sql.includes('create role eps_project_creator'));assert(sql.includes('create function public.eps_create_project'));assert(!sql.includes('current_database()'));
 assert.throws(()=>functional39(Buffer.concat([bytes,Buffer.from('changed')])));
});
test('project receipt and named role comparison retain real authority rather than invented DTOs or role OIDs',()=>{
 assert.deepEqual(projectReceipt(receipt()),receipt());for(const patch of[{presentation_type:'unknown'},{can_edit:false},{casting_workspace_id:receipt().id},{row_version:2},{private:'unexpected'}])assert.throws(()=>projectReceipt({...receipt(),...patch}));
 const role={name:'eps_project_creator',login:false,superuser:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null};
 const a={roles:[{...role,oid:1},{...role,name:'postgres',oid:2}],memberships:[{role_oid:1,member_oid:2,grantor_oid:2,admin:false,inherit:true,set:true}]},b={roles:[{...role,oid:10},{...role,name:'postgres',oid:20}],memberships:[{role_oid:10,member_oid:20,grantor_oid:20,admin:false,inherit:true,set:true}]};assert.deepEqual(namedRoles(a),namedRoles(b));b.memberships[0].set=false;assert.notDeepEqual(namedRoles(a),namedRoles(b));
});
test('historical row exclusions and constrained-role RLS checks remain exact and injection bounded',()=>{
 const sql=filteredHistoricalRowsSql(receipt().id,'recovery39-create-'+runId);assert(sql.includes('project_creation_intents'));assert(sql.includes(CREATOR));assert(sql.includes('20261101223342'));assert(!sql.includes('delete from'));
 const denied=rlsDenialSql(receipt().id);assert(denied.includes('SET SESSION AUTHORIZATION authenticated'));assert(denied.includes('SET SESSION AUTHORIZATION eps_project_creator'));assert(denied.includes("SQLSTATE '42501'"));assert(denied.trim().endsWith('ROLLBACK;'));
 assert.throws(()=>filteredHistoricalRowsSql("x';drop",'recovery39-create-'+runId));assert.throws(()=>filteredHistoricalRowsSql(receipt().id,'foreign-key'));assert.throws(()=>rlsDenialSql('invalid'));
});

async function fixture(t){
 const run=randomUUID(),root=path.join(ROOT,'.local/m07-independent-recovery39',run);await mkdir(root,{recursive:true});const owner={run_id:run,workspace:ROOT,purpose:'m07-independent-recovery39'};await writeFile(path.join(root,'owner.json'),JSON.stringify(owner),{flag:'wx'});
 t.after(async()=>{assert.equal(path.dirname(root),path.join(ROOT,'.local/m07-independent-recovery39'));assert.equal(path.basename(root),run);assert.equal(await realpath(root),root);assert(!(await lstat(root)).isSymbolicLink());assert.deepEqual(JSON.parse(await readFile(path.join(root,'owner.json'),'utf8')),owner);await rm(root,{recursive:true});});
 const objects=Array.from({length:4},(_,i)=>{const asset_id=`a7390000-0000-4000-8000-${String(i+20).padStart(12,'0')}`,bytes=Buffer.from('synthetic object '+i);return{asset_id,bytes,size_bytes:bytes.length,sha256:sha(bytes)};});
 const values={metadata:'-- synthetic metadata only\n',roles:{synthetic:true},rows:{synthetic:true},catalogue:{synthetic:true},project:{synthetic:true},native:'synthetic-native',sourceSeal:'synthetic-seal',migration:'synthetic-ddl',currentSources:Array.from({length:165},(_,i)=>({path:`synthetic/source${i}.ts`,bytes:Buffer.from('export const value='+i)})),publicSources:[{path:'synthetic/current39.sql',bytes:Buffer.from('-- synthetic')}],objects,objectBytes:new Map(objects.map(row=>[row.asset_id,row.bytes]))};return{root,run,values,objects};
}
test('new bundle backs up and byte-restores exactly165 sources, explicit delta and four objects',async t=>{
 const f=await fixture(t),manifest=await create39Bundle(f.root,f.run,f.values),restored=await read39Bundle(f.root,f.run,manifest);assert.equal(restored.current,165);assert.equal(restored.delta,1);assert.equal(manifest.files.filter(row=>row.file.startsWith('objects/')).length,4);assert.equal(restored.bytes.get('metadata.sql').toString(),f.values.metadata);
 await read39Bundle(f.root,f.run,manifest,{restoreSources:false});
 for(const change of[value=>{value.files[0].file='../outside';},value=>{value.files[0].bytes=97*1024*1024;},value=>{value.files[0].private='not allowed';},value=>{value.files.pop();},value=>{value.files.find(row=>row.group==='worker165').source_path='../escape';}]){const bad=JSON.parse(JSON.stringify(manifest));change(bad);assert.throws(()=>validateManifest(bad,f.run));}
});
test('corrupt or missing39 object backup and restored source fail before acceptance',async t=>{
 for(const kind of['corrupt','missing','restored-source']){const f=await fixture(t),manifest=await create39Bundle(f.root,f.run,f.values);await read39Bundle(f.root,f.run,manifest);const objectFile=path.join(f.root,'backup39/objects',f.objects[0].asset_id);
  if(kind==='corrupt')await writeFile(objectFile,'corrupt');else if(kind==='missing')await unlink(objectFile);else await writeFile(path.join(f.root,'restored-current-source/synthetic/source0.ts'),'changed');
  await assert.rejects(read39Bundle(f.root,f.run,manifest,{restoreSources:false}));
 }
});
test('native46 manifest and source seal are physically restored and checked again without rewriting',async t=>{
 for(const kind of['corrupt-native','missing-source-seal']){const f=await fixture(t),manifest=await create39Bundle(f.root,f.run,f.values),restored=await read39Bundle(f.root,f.run,manifest);assert.equal(restored.artifacts,2);
  const native=path.join(f.root,'restored-current-source/apps/worker/native-sandbox-manifest.json'),source=path.join(f.root,'restored-current-source/apps/worker/native-source.json');assert.equal(await readFile(native,'utf8'),f.values.native);assert.equal(await readFile(source,'utf8'),f.values.sourceSeal);
  if(kind==='corrupt-native')await writeFile(native,'corrupt artifact');else await unlink(source);await assert.rejects(read39Bundle(f.root,f.run,manifest,{restoreSources:false}));
 }
});
