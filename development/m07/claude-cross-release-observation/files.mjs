/** Default-off, read-only local evidence adapter. No log/provider/auth/child process path. */
import { lstat, open, realpath } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { APPROVED, SEALS, V2 } from './approved-pair.mjs';
import { admitReleasePair, compareAcrossRelease, need, sha } from './compare.mjs';

export const FILE_COMPARISON_ENABLED=false;
const INPUT=/^tracking\/evidence\/m07\/claude-cross-release-observation\/[A-Za-z0-9.-]+\.json$/u;
const OBS=/^tracking\/evidence\/m07\/completion-oauth\/[A-Za-z0-9.-]+-request-observation\.json$/u;
const EXEC=/^tracking\/evidence\/m07\/completion-oauth\/[A-Za-z0-9.-]+-collector-v2-execution\.json$/u;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
export async function readRegular(root,relative,maximum){
 need(typeof relative==='string'&&!relative.includes('\\')&&!relative.split('/').some(p=>p==='..'||p==='.'||p===''));
 const base=path.resolve(root),file=path.resolve(base,relative);need(file.startsWith(base+path.sep));
 const before=await lstat(file);need(before.isFile()&&!before.isSymbolicLink()&&before.nlink===1&&before.size<=maximum&&path.resolve(await realpath(file)).toLowerCase()===file.toLowerCase());
 const handle=await open(file,'r');let raw;
 try{
  const opened=await handle.stat();need(opened.isFile()&&opened.nlink===1&&opened.dev===before.dev&&opened.ino===before.ino&&opened.size===before.size);
  const buffer=Buffer.alloc(maximum+1);let size=0;
  while(size<buffer.length){const {bytesRead}=await handle.read(buffer,size,buffer.length-size,null);if(bytesRead===0)break;size+=bytesRead;}
  need(size<=maximum&&size===before.size);raw=buffer.subarray(0,size);
 }finally{await handle.close();}
 const after=await lstat(file);need(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs&&before.ctimeMs===after.ctimeMs&&path.resolve(await realpath(file)).toLowerCase()===file.toLowerCase());return raw;
}
function ref(value,pattern){need(exact(value,['path','sha256'])&&pattern.test(value.path)&&/^[a-f0-9]{64}$/u.test(value.sha256));}
export async function compareFiles(root,inputPath,read=readRegular){
 need(INPUT.test(inputPath));const inputRaw=await read(root,inputPath,65536),input=JSON.parse(inputRaw.toString('utf8'));
 need(exact(input,['schema_version','before','after','attestation'])&&input.schema_version==='1.0');
 for(const packet of [input.before,input.after]){need(exact(packet,['observation','execution']));ref(packet.observation,OBS);ref(packet.execution,EXEC);}ref(input.attestation,INPUT);
 const load=async release=>({readbackRaw:await read(root,release.readback.path,1024*1024),sourceRaw:await read(root,release.source.path,1024*1024),archiveRaw:await read(root,release.archive.path,8*1024*1024)});
 const bridge=admitReleasePair({before:await load(APPROVED.before),after:await load(APPROVED.after),sourceFiles:new Map(await Promise.all(Object.keys({...SEALS,[V2.path]:V2.sha256}).map(async file=>[file,await read(root,file,65536)])))});
 const readRef=async value=>{const raw=await read(root,value.path,65536);need(sha(raw)===value.sha256);return raw;};
 const packet=async value=>({path:value.observation.path,raw:await readRef(value.observation),executionPath:value.execution.path,executionRaw:await readRef(value.execution)});
 const report=compareAcrossRelease({bridge,before:await packet(input.before),after:await packet(input.after),attestationRaw:await readRef(input.attestation)});
 return{...report,inputs:{path:inputPath,sha256:sha(inputRaw)},owner_attestation:input.attestation,provider_reads:0,local_files_written:0};
}
async function main(){
 need(FILE_COMPARISON_ENABLED);const [root,inputPath,...extra]=process.argv.slice(2);need(root&&inputPath&&!extra.length&&!process.env.NODE_OPTIONS);
 process.stdout.write(JSON.stringify(await compareFiles(root,inputPath),null,2)+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('CLAUDE_CROSS_RELEASE_OBSERVATION_UNCONFIRMED; raw diagnostics suppressed.\n');process.exitCode=1;});
