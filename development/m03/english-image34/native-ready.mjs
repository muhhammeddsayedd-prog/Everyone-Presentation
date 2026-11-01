/** Fixed GET-only private native-repository metadata; no auth refresh or image operation. */
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const CLI=path.join(ROOT,'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js');
const GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli';
const PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6',TEAM='team_gboXPxTevpCOZuaA8eY9PmR1',REPO='repo_OpIvBNiZ8vPVROs68HxcMb39W6yz';
const PATHS=Object.freeze({repository:`/v1/vcr/repository/${REPO}?projectId=${PROJECT}&teamId=${TEAM}`,images:`/v1/vcr/repository/${REPO}/images?projectId=${PROJECT}&teamId=${TEAM}&limit=50`});
const need=value=>{if(!value)throw new Error('ENGLISH34_NATIVE_READY_UNCONFIRMED');};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,160}$/u.test(v);
const time=v=>typeof v==='string'&&v.length<=40&&/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/u.test(v)&&Number.isFinite(Date.parse(v));
const digest=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/u.test(v);
const sha=v=>createHash('sha256').update(v).digest('hex');
export function readyEnvironment(ambient){const value={NODE_ENV:'production',PATH:'',CI:'1',VERCEL_TELEMETRY_DISABLED:'1',VERCEL_CLI_USE_NATIVE_BINARY:'0'};for(const key of ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG'])if(ambient[key])value[key]=ambient[key];return value;}
export function projectNativeRepository(value){const row=object(value)?value.repository:null;need(object(row)&&row.id===REPO&&row.projectId===PROJECT&&row.name==='native'&&row.public===false&&time(row.createdAt)&&time(row.updatedAt));return{id:REPO,project_id:PROJECT,name:'native',public:false,expected_private:true,privacy_matches_expected:true,created_at:row.createdAt,updated_at:row.updatedAt};}
export function projectNativeImages(value){
 need(object(value)&&Array.isArray(value.images)&&value.images.length<=50&&(value.nextCursor===undefined||typeof value.nextCursor==='string'&&value.nextCursor.length<=2048));
 const seen=new Set();const images=value.images.map(row=>{
  need(object(row)&&id(row.id)&&!seen.has(row.id)&&row.repositoryId===REPO&&digest(row.manifestDigest)&&['attestation','index','manifest'].includes(row.kind)&&[null,'errored','preparing','ready','unoptimized'].includes(row.status)&&Number.isSafeInteger(row.sizeInBytes)&&row.sizeInBytes>=0&&row.sizeInBytes<=200*1024**3&&time(row.createdAt)&&Array.isArray(row.tags)&&row.tags.length<=50&&row.tags.every(tag=>typeof tag==='string'&&/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/u.test(tag))&&['arch','platform'].every(key=>row[key]===undefined||typeof row[key]==='string'&&/^[a-z0-9_-]{1,20}$/u.test(row[key])));seen.add(row.id);
  return{id:row.id,repository_id:REPO,manifest_digest:row.manifestDigest,kind:row.kind,status:row.status,architecture:row.arch??null,platform:row.platform??null,size_bytes:row.sizeInBytes,tags:[...row.tags],created_at:row.createdAt};
 });return{images,has_more:Boolean(value.nextCursor),limit:50,pagination_followed:false};
}
function get(operation){need(Object.hasOwn(PATHS,operation));return new Promise((resolve,reject)=>{
 const child=spawn(process.execPath,[CLI,'api',PATHS[operation],'--method','GET','--scope','muhammed-abdelrahman','--raw','--global-config',GLOBAL],{cwd:ROOT,env:readyEnvironment(process.env),windowsHide:true,shell:false,stdio:['ignore','pipe','pipe']});
 const chunks=[];let bytes=0,stderr=0,failed=false;const stop=()=>{failed=true;child.kill();};const timer=setTimeout(stop,30000);child.once('error',stop);
 child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>4*1024**2)stop();else chunks.push(chunk);});child.stderr.on('data',chunk=>{stderr+=chunk.length;if(stderr>32768)stop();});
 child.once('close',code=>{clearTimeout(timer);if(failed||code!==0){reject(new Error('ENGLISH34_NATIVE_READY_UNCONFIRMED'));return;}try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new Error('ENGLISH34_NATIVE_READY_UNCONFIRMED'));}});
 });}
async function main(){
 need(process.argv.length===2&&process.platform==='win32'&&/^v24\./u.test(process.version));
 const stat=await lstat(CLI);need(stat.isFile()&&!stat.isSymbolicLink()&&path.resolve(await realpath(CLI)).toLowerCase()===CLI.toLowerCase()&&sha(await readFile(CLI))==='5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493');
 let result='unconfirmed',phase='repository';const report={schema_version:'1.0',observed_at:new Date().toISOString(),read_only:true,team_id:TEAM,project_id:PROJECT,provider_reads_attempted:0,provider_mutations:false,private_configuration_requested:false,raw_payload_persisted:false,credentials_in_report:false,cli_internal_auth_maintenance_possible:true,helper_sha256:sha(await readFile(import.meta.filename)),scope:'Fixed private native repository metadata only; no web observation, native task, worker job or English acceptance'};
 try{report.provider_reads_attempted++;report.repository=projectNativeRepository(await get('repository'));phase='images';report.provider_reads_attempted++;report.images=projectNativeImages(await get('images'));result='observed';}catch{report.failed_phase=phase;report.code='ENGLISH34_NATIVE_READY_UNCONFIRMED';process.exitCode=1;}
 report.result=result;report.finished_at=new Date().toISOString();const directory=path.join(ROOT,'tracking/evidence/m03/english-image34');await mkdir(directory,{recursive:true});const file=path.join(directory,`${report.observed_at.replaceAll(':','-')}-${randomUUID().slice(0,8)}-native-ready.json`);await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),provider_reads_attempted:report.provider_reads_attempted})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('ENGLISH34_NATIVE_READY_UNCONFIRMED\n');process.exitCode=1;});
