/** Filesystem-only new39 bundle; no historical bundle claims are created/reused. */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { mkdir, readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { sha } from './guards.mjs';
const ROOT=path.resolve(import.meta.dirname,'../../..');
const UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const safe=value=>typeof value==='string'&&value.length<=512&&value.split('/').every(part=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(part)&&!['.','..'].includes(part));
export function validateManifest(value,run){
 assert(value?.schema_version==='1.0'&&value.purpose==='independent39'&&value.run_id===run&&UUID.test(run));assert.deepEqual(Object.keys(value).sort(),['schema_version','purpose','run_id','files'].sort());assert(Array.isArray(value.files)&&value.files.length>170&&value.files.length<=220);
 const names=new Set(),sources=new Set();let total=0,current=0,delta=0,objects=0;
 for(const file of value.files){assert.deepEqual(Object.keys(file).sort(),(file.source_path?['file','bytes','sha256','source_path','group']:['file','bytes','sha256']).sort());assert(safe(file.file)&&!names.has(file.file));names.add(file.file);assert(Number.isSafeInteger(file.bytes)&&file.bytes>0&&file.bytes<=96*1024*1024&&/^[a-f0-9]{64}$/u.test(file.sha256));total+=file.bytes;assert(total<=128*1024*1024);
  if(file.source_path){assert(safe(file.source_path)&&!sources.has(file.source_path));sources.add(file.source_path);if(file.group==='worker165'){assert(/^current-sources\/\d+$/u.test(file.file));current++;}else{assert(file.group==='public_delta'&&/^public-sources\/\d+$/u.test(file.file));delta++;}}
  if(file.file.startsWith('objects/')){assert(UUID.test(file.file.slice(8)));objects++;}
 }
 assert.equal(current,165);assert(delta>=1);assert.equal(objects,4);
 for(const file of['metadata.sql','roles.json','row-hashes.json','catalogue.json','project.json','native-manifest.json','source-seal.json','migration39.sql'])assert(names.has(file));return value;
}
async function regular(file){const stat=await lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&await realpath(file)===file);return stat;}
async function owned(root,run){assert(UUID.test(run));assert.equal(root,path.join(ROOT,'.local/m07-independent-recovery39',run));assert.equal(await realpath(root),root);const marker=JSON.parse(await readFile(path.join(root,'owner.json'),'utf8'));assert.deepEqual(marker,{run_id:run,workspace:ROOT,purpose:'m07-independent-recovery39'});}
export async function create39Bundle(root,run,values){
 await owned(root,run);const folder=path.join(root,'backup39');await mkdir(folder);const files=[];
 async function add(file,raw){assert(safe(file));const bytes=Buffer.isBuffer(raw)?raw:Buffer.from(typeof raw==='string'?raw:JSON.stringify(raw));assert(bytes.length>0&&bytes.length<=96*1024*1024);const target=path.join(folder,...file.split('/'));assert(target.startsWith(folder+path.sep));await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx',mode:0o600});files.push({file,bytes:bytes.length,sha256:sha(bytes)});}
 for(const[file,key]of Object.entries({'metadata.sql':'metadata','roles.json':'roles','row-hashes.json':'rows','catalogue.json':'catalogue','project.json':'project','native-manifest.json':'native','source-seal.json':'sourceSeal','migration39.sql':'migration'}))await add(file,values[key]);
 assert(values.currentSources.length===165&&values.publicSources.length>=1);
 for(const[index,source]of values.currentSources.entries()){assert(safe(source.path));await add('current-sources/'+index,source.bytes);files.at(-1).source_path=source.path;files.at(-1).group='worker165';}
 for(const[index,source]of values.publicSources.entries()){assert(safe(source.path));await add('public-sources/'+index,source.bytes);files.at(-1).source_path=source.path;files.at(-1).group='public_delta';}
 assert(values.objects.length===4);for(const object of values.objects){assert(UUID.test(object.asset_id));const bytes=values.objectBytes.get(object.asset_id);assert(bytes&&bytes.length===object.size_bytes&&sha(bytes)===object.sha256);await add('objects/'+object.asset_id,bytes);}
 const manifest=validateManifest({schema_version:'1.0',purpose:'independent39',run_id:run,files},run);await writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest),{flag:'wx',mode:0o600});return manifest;
}
export async function read39Bundle(root,run,expectedManifest,{restoreSources=true}={}){
 await owned(root,run);const folder=path.join(root,'backup39'),manifest=validateManifest(JSON.parse(await readFile(path.join(folder,'manifest.json'),'utf8')),run);assert.deepEqual(manifest,expectedManifest);const bytes=new Map();
 for(const file of manifest.files){const target=path.join(folder,...file.file.split('/'));assert(target.startsWith(folder+path.sep));assert.equal((await regular(target)).size,file.bytes);const raw=await readFile(target);assert.equal(sha(raw),file.sha256,'RECOVERY39_BACKUP_CHECKSUM_MISMATCH');bytes.set(file.file,raw);}
 const restored=path.join(root,'restored-current-source');if(restoreSources)await mkdir(restored);let current=0,delta=0;
 for(const file of manifest.files.filter(row=>row.source_path)){assert(safe(file.source_path));const target=path.join(restored,...file.source_path.split('/'));assert(target.startsWith(restored+path.sep));if(restoreSources){await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes.get(file.file),{flag:'wx',mode:0o600});}assert.equal(sha(await readFile(target)),file.sha256);if(file.group==='worker165')current++;else if(file.group==='public_delta')delta++;else assert.fail('RECOVERY39_SOURCE_GROUP_INVALID');}
 let artifacts=0;for(const[file,relative]of Object.entries({'native-manifest.json':'apps/worker/native-sandbox-manifest.json','source-seal.json':'apps/worker/native-source.json'})){const target=path.join(restored,...relative.split('/'));assert(target.startsWith(restored+path.sep));if(restoreSources){await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes.get(file),{flag:'wx',mode:0o600});}await regular(target);assert.equal(sha(await readFile(target)),sha(bytes.get(file)),'RECOVERY39_RESTORED_NATIVE_ARTIFACT_CHANGED');artifacts++;}
 assert.equal(current,165);return{manifest,bytes,current,delta,artifacts};
}
