export interface CandidateTransferIntent {id:string;name:string;size:number;lastModified:number;mime:string;reserveKey:string;completeKey:string;cancelKey:string;sha256?:string;sessionId?:string;assetId?:string;resource?:string;offset:number;jobId?:string;status:'paused'|'complete'|'cancelled'}
const id=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(v);
const allowed=['id','name','size','lastModified','mime','reserveKey','completeKey','cancelKey','sha256','sessionId','assetId','resource','offset','jobId','status'];
/** Closed serialization boundary: credentials, signed URLs and file bytes are
 * intentionally absent. Browser tab storage is untrusted on restoration. */
export function restoreCandidateTransferIntents(serialized:string|null):CandidateTransferIntent[]{
 if(!serialized||serialized.length>512000)return[];let value:unknown;try{value=JSON.parse(serialized);}catch{return[];}if(!Array.isArray(value)||value.length>200)return[];
 const result:CandidateTransferIntent[]=[];
 for(const raw of value){if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!allowed.includes(k))||!id(raw.id)||!id(raw.reserveKey)||!id(raw.completeKey)||!id(raw.cancelKey)||typeof raw.name!=='string'||!raw.name||raw.name.length>255||/[\p{C}]/u.test(raw.name)||typeof raw.mime!=='string'||raw.mime.length>150||!Number.isSafeInteger(raw.size)||raw.size<1||raw.size>268435456||!Number.isSafeInteger(raw.lastModified)||raw.lastModified<0||!Number.isSafeInteger(raw.offset)||raw.offset<0||raw.offset>raw.size||!['paused','complete','cancelled'].includes(raw.status)||raw.sha256!==undefined&&(typeof raw.sha256!=='string'||!/^[a-f0-9]{64}$/u.test(raw.sha256))||['sessionId','assetId','jobId'].some(k=>raw[k]!==undefined&&!id(raw[k]))||raw.resource!==undefined&&(typeof raw.resource!=='string'||!/^\/storage\/v1\/upload\/resumable\/sign\/[A-Za-z0-9_-]{1,2048}$/u.test(raw.resource)))continue;
  result.push(Object.fromEntries(allowed.filter(k=>Object.hasOwn(raw,k)).map(k=>[k,raw[k]])) as unknown as CandidateTransferIntent);
 }
 return new Set(result.map(v=>v.id)).size===result.length?result:[];
}
export function saveCandidateTransferIntents(items:CandidateTransferIntent[]):string{return JSON.stringify(restoreCandidateTransferIntents(JSON.stringify(items.map(v=>Object.fromEntries(allowed.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k as keyof CandidateTransferIntent]]))))));}
export function matchesCandidateTransferFile(item:CandidateTransferIntent,file:File){return item.name===file.name&&item.size===file.size&&item.lastModified===file.lastModified;}
