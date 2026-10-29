import {constants} from 'node:fs';
import {lstat,open,realpath} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {TextDecoder} from 'node:util';
const FILE=path.resolve(import.meta.dirname,'..','.env.support-runtime.local');
export class PrivateSupportConfigError extends Error {
  constructor(){super('Private supporting-file verification is unavailable.');this.code='PRIVATE_SUPPORT_CONFIGURATION_INVALID';}
}
function invalid(){throw new PrivateSupportConfigError();}
export function parsePrivateSupportEnvironment(text){
  const match=/^CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=(true|false)\nEPS_SUPPORT_VERIFIER_KEY_ID=([A-Za-z0-9._-]{1,64})\nEPS_SUPPORT_VERIFIER_KEY_HEX=([a-f0-9]{64})\n$/u.exec(text);
  if(!match)invalid();
  return {CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED:match[1],EPS_SUPPORT_VERIFIER_KEY_ID:match[2],EPS_SUPPORT_VERIFIER_KEY_HEX:match[3]};
}
export async function loadPrivateSupportEnvironment(){
  let handle;
  try{
    const before=await lstat(FILE);
    if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>1024||(await realpath(FILE)).toLowerCase()!==FILE.toLowerCase())invalid();
    // The reviewed Windows writer establishes the protected owner/SYSTEM DACL.
    if(process.platform!=='win32'&&typeof process.getuid==='function'&&(before.uid!==process.getuid()||(before.mode&0o077)!==0))invalid();
    handle=await open(FILE,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
    const opened=await handle.stat();if(opened.ino!==before.ino||opened.dev!==before.dev||opened.size!==before.size)invalid();
    const bytes=Buffer.alloc(1025);let size=0;
    for(;;){const result=await handle.read(bytes,size,bytes.length-size,null);if(!result.bytesRead)break;size+=result.bytesRead;if(size>1024)invalid();}
    const after=await handle.stat();if(after.size!==opened.size||after.mtimeMs!==opened.mtimeMs||after.ctimeMs!==opened.ctimeMs)invalid();
    return parsePrivateSupportEnvironment(new TextDecoder('utf8',{fatal:true}).decode(bytes.subarray(0,size)));
  }catch(error){if(error?.code==='ENOENT')return {};return invalid();}
  finally{await handle?.close();}
}
export async function optionalPrivateSupportEnvironment(loader=loadPrivateSupportEnvironment){
  try{return {environment:await loader(),unavailable:false};}
  catch(error){if(!(error instanceof PrivateSupportConfigError))throw error;return {environment:{},unavailable:true};}
}
