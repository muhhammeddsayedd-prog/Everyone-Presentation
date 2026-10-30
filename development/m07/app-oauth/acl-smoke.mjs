/** Actual Windows ACL round trip with synthetic bytes only, never real env data. */
import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import { lstat,mkdir,open,readFile,realpath,rename,rmdir,unlink,writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { privateAcl } from './configure-local.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..'),id=randomUUID();
const base=path.join(ROOT,'.local/m07-app-oauth'),dir=path.join(base,`acl-test-${id}`),temp=path.join(dir,'empty.tmp'),final=path.join(dir,'synthetic.env');
const report={observed_at:new Date().toISOString(),result:'unverified',scope:'Actual current-user/SYSTEM private Windows file ACL before synthetic write and after rename; no real configuration/credentials',real_config_read_or_written:false,cleanup_verified:false};
try{
 assert.equal(process.platform,'win32');await mkdir(base,{recursive:true});await mkdir(dir);assert.equal((await realpath(dir)).toLowerCase(),dir.toLowerCase());
 const handle=await open(temp,'wx',0o600);try{assert.equal((await handle.stat()).size,0);privateAcl(temp,'protect');privateAcl(temp,'verify');await handle.writeFile('SYNTHETIC_ONLY=true\n');await handle.sync();}finally{await handle.close();}
 await rename(temp,final);privateAcl(final,'verify');assert.equal(await readFile(final,'utf8'),'SYNTHETIC_ONLY=true\n');report.before_write_and_after_rename_acl_verified=true;report.result='passed';
}catch{report.diagnostic='WINDOWS_PRIVATE_ACL_PROOF_UNCONFIRMED';process.exitCode=1;}
finally{
 try{for(const file of[temp,final]){try{const state=await lstat(file);assert(state.isFile()&&!state.isSymbolicLink());assert.equal(path.dirname(await realpath(file)).toLowerCase(),dir.toLowerCase());await unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}}await rmdir(dir);report.cleanup_verified=true;}catch{report.result='unverified';report.cleanup_verified=false;process.exitCode=1;}
 report.harness_sha256=createHash('sha256').update(await readFile(import.meta.filename)).digest('hex');report.writer_sha256=createHash('sha256').update(await readFile(path.join(import.meta.dirname,'configure-local.mjs'))).digest('hex');
 const out=path.join(ROOT,'tracking/evidence/m07/app-oauth',`${new Date().toISOString().replace(/[:.]/gu,'-')}-${id.slice(0,8)}-windows-acl.json`);await mkdir(path.dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,cleanup_verified:report.cleanup_verified,evidence:path.relative(ROOT,out).replaceAll('\\','/')})+'\n');
}
