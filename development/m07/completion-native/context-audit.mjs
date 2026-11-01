/** New local read-only context/privacy audit. No auth CLI or provider operation. */
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
export const MAIN = 'D:/Everyone/Presentation/Everyone-Presentation-Studio';
export const ROOT = path.resolve(import.meta.dirname, '../../..');
export const RUN = '8b559ebe-1b6c-4741-b371-9498c5855976';
export const SOURCE = '0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730';
export const SCANNER = 'tools/scan-private-values.mjs';
export const SCANNER_SHA = 'def5be5cb94690b387dcaced95cc06f3a1e3bfcd1489b47ed40e963226921546';
const CONTEXT = path.join(MAIN, '.local/worker-hosting', RUN, 'context');
const PRIVATE = { worker:'.env.worker.local', runtime:'.env.worker-runtime.local', logo:'.local/cloud-logo-provision/verifier.json',
  specs:'.local/specs-assets-verifier/verifier.json', jobService:'.env.job-service.local', candidate:'.env.candidate-runtime.local',
  support:'.env.support-runtime.local', review:'.env.review-runtime.local', presentation:'.env.presentation-runtime.local', guest:'.env.guest-runtime.local' };
export const sha = value => createHash('sha256').update(value).digest('hex');
const need = value => { if (!value) throw Error('COMPLETION_CONTEXT_AUDIT_UNCONFIRMED'); };
const samePath = (a,b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
const same = (a,b) => a.dev===b.dev && a.ino===b.ino && a.size===b.size && a.mtimeNs===b.mtimeNs && a.ctimeNs===b.ctimeNs;
export async function regular(file, maximum=16*1024**2) {
  let handle;
  try {
    const first=await lstat(file,{bigint:true});
    need(first.isFile() && !first.isSymbolicLink() && first.nlink===1n && first.size>0n && first.size<=BigInt(maximum) && samePath(await realpath(file),file));
    handle=await open(file,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before=await handle.stat({bigint:true}); need(same(first,before));
    const bytes=Buffer.alloc(Number(before.size)+1); let used=0;
    while(used<bytes.length){const {bytesRead}=await handle.read(bytes,used,bytes.length-used,null);if(!bytesRead)break;used+=bytesRead;}
    need(used===Number(before.size) && same(before,await handle.stat({bigint:true})) && same(before,await lstat(file,{bigint:true})) && samePath(await realpath(file),file));
    return {bytes:bytes.subarray(0,used),identity:before};
  } finally { await handle?.close(); }
}
export function validateSource(source) {
  need(source && Object.keys(source).sort().join(',')==='files,source_sha256' && source.source_sha256===SOURCE
    && Array.isArray(source.files) && source.files.length===165 && sha(JSON.stringify(source.files))===SOURCE);
  let previous='';
  for(const row of source.files){
    need(row && Object.keys(row).sort().join(',')==='bytes,path,sha256' && typeof row.path==='string' && row.path>previous
      && /^(?:package(?:-lock)?\.json|(?:apps|packages|contracts)\/[A-Za-z0-9_./-]+)$/u.test(row.path)
      && !row.path.split('/').some(p=>!p||p==='.'||p==='..') && Number.isSafeInteger(row.bytes) && row.bytes>0 && row.bytes<=16*1024**2
      && /^[a-f0-9]{64}$/u.test(row.sha256)); previous=row.path;
  }
  return source.files;
}
async function inventory(directory,prefix='') {
  need(samePath(await realpath(directory),directory)); const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const relative=prefix+entry.name, file=path.join(directory,entry.name); const info=await lstat(file);
    need(!info.isSymbolicLink() && samePath(await realpath(file),file));
    if(info.isDirectory()) result.push(...await inventory(file,relative+'/'));
    else {need(info.isFile());result.push(relative);}
  } return result.sort();
}
export async function auditContext() {
  need(process.platform==='win32' && /^v24\./u.test(process.version));
  const scanner=await regular(path.join(MAIN,SCANNER)); need(sha(scanner.bytes)===SCANNER_SHA);
  const {privatePatterns,containsPrivateValue}=await import(pathToFileURL(path.join(MAIN,SCANNER)).href);
  const material={},privateBefore={};
  for(const [name,relative]of Object.entries(PRIVATE)){const value=await regular(path.join(MAIN,relative),65536); material[name]=value.bytes; privateBefore[name]=value;}
  const patterns=privatePatterns(material);
  const owner=JSON.parse((await regular(path.join(MAIN,'.local/worker-hosting',RUN,'owner.json'),4096)).bytes);
  need(JSON.stringify(owner)===JSON.stringify({owner:'eps-worker-hosting-build',run:RUN,source_sha256:SOURCE}));
  const seal=(await regular(path.join(CONTEXT,'apps/worker/native-source.json'))).bytes; const source=JSON.parse(seal); const files=validateSource(source);
  const expected=new Map(); let hits=0;
  for(const row of files){
    const current=(await regular(path.join(MAIN,row.path))).bytes,staged=(await regular(path.join(CONTEXT,row.path))).bytes;
    need(current.length===row.bytes && staged.length===row.bytes && sha(current)===row.sha256 && sha(staged)===row.sha256);
    hits+=Number(containsPrivateValue(staged,patterns)||containsPrivateValue(Buffer.from(row.path),patterns));expected.set(row.path,row.sha256);
  }
  for(const name of ['daemon','native-sandbox']){const nameInContext='Dockerfile.'+name; const bytes=(await regular(path.join(CONTEXT,nameInContext))).bytes;need(sha(bytes)===expected.get('apps/worker/'+nameInContext));expected.set(nameInContext,sha(bytes));}
  const ignore=(await regular(path.join(CONTEXT,'.dockerignore'),4096)).bytes;need(ignore.equals(Buffer.from('.git\n.env*\n.local\nnode_modules\n**/node_modules\n')));expected.set('.dockerignore',sha(ignore));expected.set('apps/worker/native-source.json',sha(seal));
  const manifest=(await regular(path.join(CONTEXT,'apps/worker/native-sandbox-manifest.json'),4096)).bytes;
  need(sha(manifest)==='a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943');expected.set('apps/worker/native-sandbox-manifest.json',sha(manifest));
  need(JSON.stringify(await inventory(CONTEXT))===JSON.stringify([...expected.keys()].sort()));
  for(const [relative,digest]of expected){const bytes=(await regular(path.join(CONTEXT,relative))).bytes;need(sha(bytes)===digest);hits+=Number(containsPrivateValue(bytes,patterns)||containsPrivateValue(Buffer.from(relative),patterns));}
  for(const row of files)need(sha((await regular(path.join(MAIN,row.path))).bytes)===row.sha256);
  for(const [name,relative]of Object.entries(PRIVATE)){const after=await regular(path.join(MAIN,relative),65536);need(same(privateBefore[name].identity,after.identity)&&sha(privateBefore[name].bytes)===sha(after.bytes));}
  need(sha((await regular(path.join(MAIN,SCANNER))).bytes)===SCANNER_SHA && hits===0);
  return {schema_version:'1.0',observed_at:new Date().toISOString(),result:'passed_context_source_and_private_value_checks',purpose:'completion-native46de-context-audit',
    run:RUN,source_sha256:SOURCE,file_count:165,context_file_count:170,source_seal_sha256:sha(seal),manifest_sha256:sha(manifest),files,
    private_inputs:10,private_value_families:14,private_hits:0,private_input_stable:true,source_and_context_exact:true,generated_dockerfiles_exact:true,
    scanner_sha256:SCANNER_SHA,audit_source_sha256:sha(await readFile(import.meta.filename)),private_values_or_digests_recorded:false,
    Docker_or_build_called:false,registry_or_provider_called:false,worker_deployed:false,
    scope:'Current staged worker context and exact source, fixed current private values only; not PII/full repository/archive/hosted-image scan'};
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try{need(process.argv.length===2);const report=await auditContext();const relative='tracking/evidence/m07/completion-worker/'+report.observed_at.replaceAll(':','-').replace('.','-')+'-native-context-audit.json';await writeFile(path.join(ROOT,relative),JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:relative,file_count:165,private_hits:0,provider_called:false})+'\n');}
  catch{process.stdout.write('COMPLETION_CONTEXT_AUDIT_UNCONFIRMED\n');process.exitCode=1;}
}
