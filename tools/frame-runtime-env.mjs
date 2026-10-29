import {lstat,readFile,realpath} from 'node:fs/promises';
import {parseEnv,TextDecoder} from 'node:util';
import path from 'node:path';
import process from 'node:process';
const FILE=path.resolve(import.meta.dirname,'..','.env.frames-runtime.local');
const FIELDS=['EPS_FRAME_EXTRACTION_ENABLED','EPS_FRAME_IMAGE_ID'];
function invalid(){throw new Error('FRAME_RUNTIME_CONFIGURATION_INVALID');}
export function parseFrameRuntimeEnvironment(text){
  try{
    const values=parseEnv(text);
    if(Object.keys(values).length!==2||FIELDS.some(field=>!Object.hasOwn(values,field))
      ||!['true','false'].includes(values.EPS_FRAME_EXTRACTION_ENABLED)||!/^sha256:[a-f0-9]{64}$/u.test(values.EPS_FRAME_IMAGE_ID))invalid();
    return Object.fromEntries(FIELDS.map(field=>[field,values[field]]));
  }catch{return invalid();}
}
export async function loadFrameRuntimeEnvironment(){
  try{
    const info=await lstat(FILE);
    if(!info.isFile()||info.isSymbolicLink()||info.size>1024||(await realpath(FILE)).toLowerCase()!==FILE.toLowerCase())invalid();
    if(process.platform!=='win32'&&typeof process.getuid==='function'&&(info.uid!==process.getuid()||(info.mode&0o077)!==0))invalid();
    return parseFrameRuntimeEnvironment(new TextDecoder('utf8',{fatal:true}).decode(await readFile(FILE)));
  }catch(error){if(error?.code==='ENOENT')return {};return invalid();}
}
