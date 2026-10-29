import sharp from 'sharp';
import {DomainError} from '@eps/domain';
import type {SupportMime,SupportVerifiedDocument} from '../../../packages/central/src/candidate-support-storage.ts';
import {verifySpecsOriginal} from './specs-original.ts';
/** Original admission only: support never enters the AI/native job pipeline. */
export async function verifyCandidateSupportOriginal(bytes:Uint8Array,mimeType:SupportMime,context:{sourceAssetId:string;purpose:'candidate_support'}):Promise<SupportVerifiedDocument>{
 const fail=():never=>{throw new DomainError('SOURCE_UNREADABLE','Use a valid PNG, JPEG, WebP, PDF, DOCX or UTF-8 text supporting file.',422);};
 if(context?.purpose!=='candidate_support'||!context.sourceAssetId||!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>20*1024*1024)fail();
 try{
  if(mimeType==='image/png'||mimeType==='image/jpeg'||mimeType==='image/webp'){
   if(bytes.length>5*1024*1024)fail();
   const image=sharp(bytes,{limitInputPixels:40000000,animated:false,failOn:'warning'}),metadata=await image.metadata();
   const format=mimeType==='image/jpeg'?'jpeg':mimeType.slice(6) as 'png'|'webp';
   if(metadata.format!==format||!metadata.width||!metadata.height||metadata.width*metadata.height>40000000||(metadata.pages??1)!==1)fail();
   await image.raw().toBuffer();return{mimeType,format,width:metadata.width!,height:metadata.height!};
  }
  if(mimeType!=='application/pdf'&&mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document'&&mimeType!=='text/plain')fail();
  const result=await verifySpecsOriginal(bytes,mimeType,{sourceAssetId:context.sourceAssetId});return{...result,width:null,height:null};
 }catch{return fail();}
}
