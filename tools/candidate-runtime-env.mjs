import { lstat,readFile,realpath } from 'node:fs/promises';
import { parseEnv,TextDecoder } from 'node:util';
import path from 'node:path';
import process from 'node:process';
const FILE=path.resolve(import.meta.dirname,'..','.env.candidate-runtime.local');
const FIELDS=['EPS_CANDIDATE_MEDIA_ENABLED','EPS_MEDIA_IMAGE_ID','OPENAI_TRANSCRIPTION_MODEL','N8N_CANDIDATE_DISPATCH_URL','N8N_CANDIDATE_DISPATCH_SECRET'];
function invalid(){throw new Error('CANDIDATE_RUNTIME_CONFIGURATION_INVALID');}
export function parseCandidateRuntimeEnvironment(text){
 try{const values=parseEnv(text);if(Object.keys(values).length!==FIELDS.length||FIELDS.some(key=>typeof values[key]!=='string'||!values[key]||/[\r\n\0]/u.test(values[key])))invalid();
  if(!['true','false'].includes(values.EPS_CANDIDATE_MEDIA_ENABLED)||!/^sha256:[a-f0-9]{64}$/u.test(values.EPS_MEDIA_IMAGE_ID)||!/^[A-Za-z0-9._-]{1,200}$/u.test(values.OPENAI_TRANSCRIPTION_MODEL)||!/^[a-f0-9]{64}$/u.test(values.N8N_CANDIDATE_DISPATCH_SECRET))invalid();
  const url=new URL(values.N8N_CANDIDATE_DISPATCH_URL);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/webhook/eps-wf02-candidate-stage-v1')invalid();
  return Object.fromEntries(FIELDS.map(key=>[key,values[key]]));
 }catch{return invalid();}
}
export async function loadCandidateRuntimeEnvironment(){
 try{const info=await lstat(FILE);if(!info.isFile()||info.isSymbolicLink()||info.size>4096||path.resolve(await realpath(FILE)).toLowerCase()!==FILE.toLowerCase())invalid();
  if(process.platform!=='win32'&&typeof process.getuid==='function'&&(info.uid!==process.getuid()||(info.mode&0o077)!==0))invalid();
  return parseCandidateRuntimeEnvironment(new TextDecoder('utf-8',{fatal:true}).decode(await readFile(FILE)));
 }catch(error){if(error?.code==='ENOENT')return {};return invalid();}
}
