/** Compile the fixed metadata query on owned26, read-only; not app acceptance. */
import assert from'node:assert/strict';
import{createHash,randomUUID}from'node:crypto';
import{mkdir,open,readFile,unlink,writeFile}from'node:fs/promises';
import{isDeepStrictEqual}from'node:util';
import{runOwnedLocalSql,verifyLocalTarget}from'./local-postgres.mjs';
const SQL='tools/sql/m06-app-capture.sql',READBACK='tools/sql/m06-forward26-readback.sql',HARNESS='tools/test-m06-app-observer-local.mjs';
const FILES=[SQL,READBACK,HARNESS,'tools/capture-m06-app.py','tests/operations/test_m06_app_capture.py','tools/local-postgres.mjs','development/local-db/instance.json','development/local-db/reviewed.json'];
const digest=v=>createHash('sha256').update(v).digest('hex'),rows=v=>v.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
const id=randomUUID(),lockPath='.local/local-postgres/test-db.lock';let locked=false,before;
const report={schema_version:'1.0',run_id:id,observed_at:new Date().toISOString(),result:'failed',cloud_called:false,provider_called:false,
  scope:'Owned local26 fixed-workspace metadata query compiles under repeatable-read/read-only; empty local business rows do not establish canonical app or browser acceptance.'};
try{
  const source=Object.fromEntries(await Promise.all(FILES.map(async name=>[name,await readFile(name)])));
  report.source_seals=Object.fromEntries(FILES.map(name=>[name,digest(source[name])])) ;
  const manifest=JSON.parse(source['development/local-db/reviewed.json']);assert.equal(manifest.migrations.length,26);
  const target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
  const lock=await open(lockPath,'wx',0o600);await lock.writeFile(JSON.stringify({run_id:id,pid:process.pid}));await lock.close();locked=true;
  before=rows((await runOwnedLocalSql(source[READBACK].toString())).stdout)[0];
  const output=await runOwnedLocalSql(source[SQL].toString());const state=rows(output.stdout)[0];
  assert.equal(state.schema_version,'1.0');assert.equal(state.workspace_id,'098d5b48-42a3-475b-b562-735c9eafce80');
  assert.equal(state.query_role,'postgres');assert.equal(state.unrestricted_visibility,true);assert.equal(state.migration_versions.length,26);
  for(const section of['series','versions','links','sessions','comments','preferences','exports','media_grants','asset_grants','jobs'])assert(Array.isArray(state[section]));
  report.fixed_readonly_query_compiled=true;report.secret_config_not_selected=!/review_gateway_config|backend_key|response_encrypted|session_token_digest|lease_token_digest/u.test(source[SQL].toString());assert(report.secret_config_not_selected);
  report.sources_stable=(await Promise.all(FILES.map(async name=>digest(await readFile(name))===report.source_seals[name]))).every(Boolean);assert(report.sources_stable);
}catch(error){report.code='M06_LOCAL_OBSERVER_QUERY_UNCONFIRMED';await mkdir(`.local/m06-app-observer/${id}`,{recursive:true});await writeFile(`.local/m06-app-observer/${id}/diagnostic.txt`,String(error.stack??error));report.private_diagnostic=`.local/m06-app-observer/${id}/diagnostic.txt`;}
finally{
  if(locked){report.after=rows((await runOwnedLocalSql(await readFile(READBACK,'utf8'))).stdout)[0];report.readonly_state_preserved=isDeepStrictEqual(before,report.after);if(report.readonly_state_preserved){const owner=JSON.parse(await readFile(lockPath,'utf8'));assert.equal(owner.run_id,id);await unlink(lockPath);report.lock_released=true;}delete report.after;}
  if(report.fixed_readonly_query_compiled&&report.secret_config_not_selected&&report.sources_stable&&report.readonly_state_preserved&&report.lock_released)report.result='passed';
  report.finished_at=new Date().toISOString();await mkdir('tracking/evidence/m06/app-observer-local',{recursive:true});const file=`tracking/evidence/m06/app-observer-local/${report.finished_at.replace(/[:.]/gu,'-')}-${id.slice(0,8)}.json`;
  await writeFile(file,JSON.stringify(report,null,2)+'\n');process.stdout.write(JSON.stringify({result:report.result,receipt:file,read_only:true})+'\n');if(report.result!=='passed')process.exitCode=1;
}
