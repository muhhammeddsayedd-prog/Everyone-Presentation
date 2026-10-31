/** Explicit owner instruction: keep this pilot running until manually stopped. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, open, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { environmentMetadata, createdEnvironmentMetadata } from './env-projection.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const CLI='C:/Users/iway/AppData/Roaming/npm/node_modules/vercel/dist/vc.js';
const PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0',TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';
assert.equal(process.argv.length,2);
function api(endpoint,method='GET',body){
 const args=[CLI,'api',endpoint,'--scope','muhammed-abdelrahman','--raw','--method',method];
 if(body)args.push('--input','-');
 return JSON.parse(execFileSync(process.execPath,args,{cwd:ROOT,input:body?JSON.stringify(body):undefined,
  stdio:['pipe','pipe','pipe'],windowsHide:true,timeout:60000,maxBuffer:2*1024*1024}).toString('utf8'));
}
try{
 const p=api(`/v9/projects/${PROJECT}?teamId=${TEAM}`);assert(p.id===PROJECT&&p.accountId===TEAM&&p.name==='everyone-presentation-pilot');
 const prior=JSON.parse(await readFile(path.join(ROOT,'tracking/evidence/m07/controlled-pilot/2026-10-30T20-45-47-491Z-766f3bd6-web-env-resume-initial.json'),'utf8'));
 assert(prior.result==='passed'&&prior.project_id===PROJECT);
 const before=api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`).envs;
 assert.deepEqual(environmentMetadata(before),prior.observed_metadata);
 const expiry=before.find(v=>v.key==='EPS_PILOT_EXPIRES_AT');assert(expiry&&expiry.type==='plain'&&typeof expiry.id==='string');
 const dir=path.join(ROOT,'.local/m07-pilot');const claim=await open(path.join(dir,'web-owner-control-dispatch.json'),'wx');
 await claim.writeFile(JSON.stringify({project:PROJECT,instruction:'Keep running until I stop it',public_changes:['blank EPS_PILOT_EXPIRES_AT','EPS_PILOT_OWNER_CONTROLLED=true'],claimed_at:new Date().toISOString()})+'\n');await claim.close();
 api(`/v9/projects/${PROJECT}/env/${encodeURIComponent(expiry.id)}?teamId=${TEAM}`,'PATCH',{value:''});
 const created=createdEnvironmentMetadata(api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}`,'POST',
  {key:'EPS_PILOT_OWNER_CONTROLLED',value:'true',type:'plain',target:['preview','production'],comment:'Owner explicitly requested operation until manually stopped'}));
 const expectedNew={key:'EPS_PILOT_OWNER_CONTROLLED',type:'plain',target:['preview','production']};assert.deepEqual(created,[expectedNew]);
 const after=api(`/v10/projects/${PROJECT}/env?teamId=${TEAM}&decrypt=false`).envs;
 const meta=environmentMetadata(after),oldMeta=environmentMetadata(after.filter(v=>v.key!=='EPS_PILOT_OWNER_CONTROLLED'));
 assert.deepEqual(oldMeta,prior.observed_metadata);
 assert.equal(after.find(v=>v.key==='EPS_PILOT_OWNER_CONTROLLED').value,'true');
 assert.equal(after.find(v=>v.key==='EPS_PILOT_EXPIRES_AT').value,'');
 for(const v of before.filter(v=>v.key!=='EPS_PILOT_EXPIRES_AT')){
  const a=after.find(x=>x.key===v.key);assert(a&&a.id===v.id&&a.updatedAt===v.updatedAt);
 }
 const settingsFile=path.join(dir,'pilot-settings.json');const settings=JSON.parse(await readFile(settingsFile,'utf8'));
 settings.expires_at='';settings.owner_controlled=true;await writeFile(settingsFile,JSON.stringify(settings,null,2)+'\n');
 const report={observed_at:new Date().toISOString(),project:PROJECT,team:TEAM,result:'passed',
  instruction:'Keep running until I stop it',owner_controlled:true,expiry_blank:true,other_variable_metadata_preserved:true,
  observed_metadata:meta,private_values_or_digests_recorded:false,runtime_verified:false};
 const out=path.join(ROOT,'tracking/evidence/m07/controlled-pilot',`${new Date().toISOString().replaceAll(':','-').replace('.','-')}-web-owner-control.json`);
 await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({receipt:path.relative(ROOT,out),...report})+'\n');
}catch{process.stderr.write('Owner-controlled app configuration unconfirmed. Inspect the two public settings before any repeat; private diagnostics suppressed.\n');process.exitCode=1;}
