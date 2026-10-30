/** Owned27 additive28 SQL only. Synthetic source, no cloud/provider/native claim. */
import assert from'node:assert/strict';
import{spawn}from'node:child_process';
import{createHash,randomUUID}from'node:crypto';
import{mkdir,open,readFile,unlink,writeFile}from'node:fs/promises';
import{isDeepStrictEqual}from'node:util';
import{runOwnedLocalSql,verifyLocalTarget}from'./local-postgres.mjs';
assert(process.argv.length<=3&&(!process.argv[2]||['--compile','--red27'].includes(process.argv[2])));
const mode=process.argv[2]==='--compile'?'compile':process.argv[2]==='--red27'?'red27':'candidate28';
const CANDIDATE='development/m06/transcript-companion-forward.sql',SNAPSHOT='tools/sql/m06-storage27-readback.sql';
const fixtures=['tests/db/m04-assignments-fixture.sql','tests/db/m05-versions-fixture.sql','tests/db/m05-versions.sql','tests/db/m05-processing.sql'];
const proofs=['tests/db/m06-transcript28-legacy.sql','tests/db/m06-transcript28.sql'];
const files=[CANDIDATE,SNAPSHOT,'tools/test-m06-transcript28-local.mjs','tools/local-postgres.mjs','development/local-db/instance.json','development/m06/baseline27-reviewed.json',...(mode==='compile'?[]:[...fixtures,...proofs])];
const sha=v=>createHash('sha256').update(v).digest('hex'),read=f=>readFile(f,'utf8'),rows=v=>v.split(/\r?\n/u).filter(s=>s.startsWith('{')).map(s=>JSON.parse(s));
const id=randomUUID(),application='eps-m06-transcript-'+id;let locked=false,original;
const report={schema_version:'1.0',run_id:id,started_at:new Date().toISOString(),result:'failed',mode,cloud_called:false,provider_called:false,application_worker_guest_configuration_loaded:false,
 scope:'Owned local27 synthetic source/versions and real existing acting/guest roles; candidateDDL and all fixture rows roll back. No actual source transcripts, native artifacts, workflow, worker or cloud calls.'};
async function execute(sql,target){return new Promise((resolve,reject)=>{
 const child=spawn('docker',['--host',process.platform==='win32'?'npipe:////./pipe/dockerDesktopLinuxEngine':'unix:///var/run/docker.sock','exec','--user','postgres','-i',target.container.Id,'psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','/var/run/postgresql','-U','supabase_admin','-d','postgres'],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='',size=0;const timer=setTimeout(()=>child.kill(),60000);
 child.stdout.on('data',v=>{stdout+=v;size+=v.length;if(size>16*1024*1024)child.kill();});child.stderr.on('data',v=>{stderr+=v;size+=v.length;if(size>16*1024*1024)child.kill();});
 child.once('error',()=>reject(Error('M06_LOCAL_TRANSCRIPT_UNCONFIRMED')));child.once('close',code=>{clearTimeout(timer);if(code)reject(Object.assign(Error('M06_LOCAL_TRANSCRIPT_UNCONFIRMED'),{privateDiagnostic:stderr}));else resolve({stdout,stderr});});child.stdin.end(sql);
});}
try{
 const source=Object.fromEntries(await Promise.all(files.map(async f=>[f,await read(f)])));report.source_seals=Object.fromEntries(files.map(f=>[f,sha(source[f])]));
 const target=await verifyLocalTarget();assert.equal(target.observed.system_identifier,'7701520506262638626');
 const lock=await open('.local/local-postgres/test-db.lock','wx',0o600);await lock.writeFile(JSON.stringify({run_id:id,pid:process.pid}));await lock.close();locked=true;
 original=rows((await runOwnedLocalSql(source[SNAPSHOT])).stdout)[0];assert.equal(original.old_data.versions.length,27);
 let sql="begin;set local role postgres;set local search_path='';set local application_name='"+application+"';";
 if(mode==='compile')sql+=source[CANDIDATE]+"select'M06_TRANSCRIPT_COMPILE_PASSED';";
 else{
  const text=fixtures.map(f=>source[f]);const old="'m05-synthetic-internal','Synthetic internal','internal'";assert.equal(text[1].split(old).length,2);
  text[1]=text[1].replace(old,"'m06-transcript-external','Synthetic external','external'");
  sql+='set local role supabase_auth_admin;alter table auth.users enable row level security;set local role postgres;'+text.join('\n')+'\n'+source[proofs[0]]+'\n'+(mode==='red27'?'':source[CANDIDATE])+'\n'+source[proofs[1]];
 }
 const result=await execute(sql+'rollback;',target);report.markers=result.stdout.split(/\r?\n/u).filter(s=>/^M06_TRANSCRIPT_.*_PASSED$/u.test(s));
 if(mode==='compile'){assert(report.markers.includes('M06_TRANSCRIPT_COMPILE_PASSED'));report.compile_passed=true;}
 else{assert(report.markers.length>=5);report.behavior_passed=true;}
 report.sources_stable=(await Promise.all(files.map(async f=>sha(await read(f))===report.source_seals[f]))).every(Boolean);assert(report.sources_stable);
}catch(error){
 const folder='.local/m06-transcript28/'+id;await mkdir(folder,{recursive:true});await writeFile(folder+'/diagnostic.txt',error.privateDiagnostic??String(error.stack??error));report.private_diagnostic=folder+'/diagnostic.txt';
 report.meaningful_transcript_red=String(error.privateDiagnostic??'').includes('M06_TRANSCRIPT_PLAYBACK_COMPANION_MISSING');
}finally{
 if(locked){report.backend_settled=rows((await runOwnedLocalSql("begin read only;select jsonb_build_object('count',count(*))from pg_stat_activity where application_name='"+application+"';rollback;")).stdout)[0].count===0;
  if(report.backend_settled&&original){const after=rows((await runOwnedLocalSql(await read(SNAPSHOT))).stdout)[0];report.rollback_verified=isDeepStrictEqual(original,after);
   if(report.rollback_verified){assert.equal(JSON.parse(await read('.local/local-postgres/test-db.lock')).run_id,id);await unlink('.local/local-postgres/test-db.lock');}
  }
 }
 if((report.compile_passed||report.behavior_passed)&&report.backend_settled&&report.rollback_verified&&report.sources_stable)report.result='passed';
 report.finished_at=new Date().toISOString();await mkdir('tracking/evidence/m06/transcript28-local',{recursive:true});const file='tracking/evidence/m06/transcript28-local/'+report.finished_at.replace(/[:.]/gu,'-')+'-'+id.slice(0,8)+'.json';
 await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:file,red:report.meaningful_transcript_red,rollback:report.rollback_verified,diagnostic:report.private_diagnostic})+'\n');if(report.result!=='passed')process.exitCode=1;
}
