import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

/** Serialize ONLY this function into the read-only browser evaluation. Its
 * bounded private result must stay in a CUA Node variable and never be printed.
 * No requests, storage, URLs, tokens, hashing or DOM writes occur in the page. */
export function captureVisibleEnglishRegion() {
  const regions=[...document.querySelectorAll('div.source-transcript[role="region"][aria-label="English transcript"]')];
  const visible=regions.filter(element=>element.getClientRects().length>0&&getComputedStyle(element).visibility==='visible');
  if(visible.length!==1)return {captured:false,code:'ONE_VISIBLE_ENGLISH_REGION_REQUIRED',region_count:regions.length,visible_region_count:visible.length};
  const element=visible[0],text=element.textContent??'';
  if(element.getAttribute('lang')!=='en'||!text.trim()||text.length>400000)return {captured:false,code:'ENGLISH_REGION_INVALID'};
  return {captured:true,privateText:text,region_count:regions.length,visible_region_count:1,lang:'en',visible:true};
}

/** Run in CUA Node, never in browser evaluate. Publishes a closed metadata
 * object and removes privateText from the supplied capture on every path. */
export function visibleEnglishRegionProof(capture,expectedSha256) {
  const failure=code=>({confirmed:false,code,text_or_url_returned:false,route_asset_binding_or_semantic_accuracy_proven:false});
  let privateText,result,cleared=true;
  try {
    if(typeof expectedSha256!=='string'||!/^[a-f0-9]{64}$/u.test(expectedSha256))result=failure('EXPECTED_DIGEST_INVALID');
    else if(!capture||typeof capture!=='object'||Array.isArray(capture))result=failure('CAPTURE_INVALID');
    else if(capture.captured===false)result=failure(['ONE_VISIBLE_ENGLISH_REGION_REQUIRED','ENGLISH_REGION_INVALID'].includes(capture.code)?capture.code:'CAPTURE_INVALID');
    else if(Object.keys(capture).sort().join(',')!=='captured,lang,privateText,region_count,visible,visible_region_count'
      ||capture.captured!==true||capture.visible!==true||capture.lang!=='en'||capture.visible_region_count!==1
      ||!Number.isSafeInteger(capture.region_count)||capture.region_count<1||capture.region_count>100000
      ||typeof capture.privateText!=='string'||!capture.privateText.trim()||capture.privateText.length>400000)result=failure('CAPTURE_INVALID');
    else {
      privateText=capture.privateText;
      const bytes=Buffer.byteLength(privateText,'utf8');
      if(bytes>800000)result=failure('CAPTURE_INVALID');
      else {
        const hash=createHash('sha256').update(privateText,'utf8').digest('hex');
        result={confirmed:hash===expectedSha256,region_count:capture.region_count,visible_region_count:1,lang:'en',visible:true,sha256:hash,utf8_bytes:bytes,
          text_or_url_returned:false,route_asset_binding_or_semantic_accuracy_proven:false};
      }
    }
  } catch { result=failure('CAPTURE_INVALID'); }
  finally {
    privateText=undefined;
    if(capture&&typeof capture==='object'&&Object.hasOwn(capture,'privateText')) {
      try { cleared=Reflect.deleteProperty(capture,'privateText'); }
      catch { cleared=false; }
    }
  }
  if(!cleared)result=failure('PRIVATE_CAPTURE_CLEAR_FAILED');
  return {...result,private_text_cleared:cleared};
}
