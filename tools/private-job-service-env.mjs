/** Optional local service config. No provider/management keys enter the web process. */
import { Buffer } from 'node:buffer';
import { lstat,readFile,realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { loadWorkerRuntimeEnvironment } from './worker-runtime-env.mjs';
const ROOT=path.resolve(import.meta.dirname,'..');
const FILE=path.join(ROOT,'.env.job-service.local');
const FIELDS=['EPS_JOB_SERVICE_BEARER','EPS_JOB_CLAIM_KEY_ID','EPS_JOB_CLAIM_KEY_HEX'];
function unavailable(){throw new Error('PRIVATE_JOB_SERVICE_CONFIGURATION_INVALID');}
export function parseJobServiceEnvironment(text){
 if(typeof text!=='string'||Buffer.byteLength(text,'utf8')>4096)return unavailable();
 const lines=text.split(/\r?\n/u);if(lines.at(-1)==='')lines.pop();if(lines.length!==3)return unavailable();
 const result={};for(const line of lines){const match=/^(EPS_JOB_SERVICE_BEARER|EPS_JOB_CLAIM_KEY_ID|EPS_JOB_CLAIM_KEY_HEX)=([A-Za-z0-9._-]+)$/u.exec(line);if(!match||Object.hasOwn(result,match[1]))return unavailable();result[match[1]]=match[2];}
 if(!FIELDS.every(key=>Object.hasOwn(result,key))||!/^[A-Za-z0-9_-]{43}$/u.test(result.EPS_JOB_SERVICE_BEARER)
  ||!/^[A-Za-z0-9._-]{1,64}$/u.test(result.EPS_JOB_CLAIM_KEY_ID)||!/^[a-f0-9]{64}$/u.test(result.EPS_JOB_CLAIM_KEY_HEX))return unavailable();return result;
}
/** Dedicated service configuration only; no Auth token, provider key or database
 * credential is loaded by a local HTTP acceptance probe. */
export async function loadPrivateJobServiceEnvironment(){
 const info=await lstat(FILE);if(!info.isFile()||info.isSymbolicLink()||info.size<1||info.size>4096||path.resolve(await realpath(FILE)).toLowerCase()!==FILE.toLowerCase())return unavailable();
 if(process.platform!=='win32'&&typeof process.getuid==='function'&&(info.uid!==process.getuid()||(info.mode&0o077)!==0))return unavailable();
 return parseJobServiceEnvironment(new TextDecoder('utf8',{fatal:true}).decode(await readFile(FILE)));
}
export async function optionalPrivateJobServiceEnvironment(){
 try{
  const service=await loadPrivateJobServiceEnvironment();
  const runtime=await loadWorkerRuntimeEnvironment();if(service.EPS_JOB_SERVICE_BEARER===runtime.N8N_DISPATCH_SECRET)return unavailable();
  return { environment:{...service,...Object.fromEntries(['EPS_SPECS_PG_HOST','EPS_SPECS_PG_PASSWORD','EPS_SPECS_PG_CA_BASE64'].map(key=>[key,runtime[key]]))},unavailable:false };
 }catch(error){if(error?.code==='ENOENT')return {environment:{},unavailable:false};return {environment:{},unavailable:true};}
}
