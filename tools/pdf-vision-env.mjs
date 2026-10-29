import { lstat,readFile,realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv,TextDecoder } from 'node:util';
const FILE=path.resolve(import.meta.dirname,'..','.env.pdf-vision.local');
function invalid(){throw new Error('PDF_VISION_CONFIGURATION_INVALID');}
export function parsePdfVisionEnvironment(text){
 try{const values=parseEnv(text);if(Object.keys(values).sort().join(',')!=='EPS_PDF_RASTER_IMAGE_ID,EPS_PDF_VISION_ENABLED'||!['true','false'].includes(values.EPS_PDF_VISION_ENABLED)||!/^sha256:[a-f0-9]{64}$/u.test(values.EPS_PDF_RASTER_IMAGE_ID))invalid();return values;}catch{return invalid();}
}
export async function loadPdfVisionEnvironment(){
 try{const info=await lstat(FILE);if(!info.isFile()||info.isSymbolicLink()||info.size>1024||path.resolve(await realpath(FILE)).toLowerCase()!==FILE.toLowerCase())invalid();
 if(process.platform!=='win32'&&typeof process.getuid==='function'&&(info.uid!==process.getuid()||(info.mode&0o077)!==0))invalid();
 return parsePdfVisionEnvironment(new TextDecoder('utf-8',{fatal:true}).decode(await readFile(FILE)));}catch(error){if(error?.code==='ENOENT')return {};return invalid();}
}
