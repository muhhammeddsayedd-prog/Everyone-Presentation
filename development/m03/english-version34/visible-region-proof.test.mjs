import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { captureVisibleEnglishRegion, visibleEnglishRegionProof } from './visible-region-proof.mjs';

const text='Synthetic English transcript.\nSecond line: café and 🙂.',digest=createHash('sha256').update(text,'utf8').digest('hex');
function region({value=text,visible=true,lang='en'}={}) { return {textContent:value,getClientRects:()=>visible?[{}]:[],getAttribute:key=>key==='lang'?lang:null}; }
function capture(regions) {
  const document={querySelectorAll:selector=>{assert.equal(selector,'div.source-transcript[role="region"][aria-label="English transcript"]');return regions;}};
  // Supported CUA DOM evaluation lacks crypto, TextEncoder, Buffer, require and
  // Node imports. Byte encoding and hashing belong in the surrounding Node.
  return vm.runInNewContext('('+captureVisibleEnglishRegion.toString()+')()',{document,getComputedStyle:()=>({visibility:'visible'})});
}

test('crypto-and-TextEncoder-absent DOM capture stays private and Node hashes exact UTF8',()=>{
  const privateCapture=capture([region()]);assert.equal(privateCapture.privateText,text);
  assert.equal(Object.hasOwn(privateCapture,'utf8_bytes'),false);
  const result=visibleEnglishRegionProof(privateCapture,digest);
  assert.equal(result.confirmed,true);assert.equal(result.sha256,digest);assert.equal(result.utf8_bytes,Buffer.byteLength(text,'utf8'));
  assert.equal(result.lang,'en');assert.equal(result.visible,true);assert.equal(result.text_or_url_returned,false);
  assert.equal(result.route_asset_binding_or_semantic_accuracy_proven,false);assert.equal(result.private_text_cleared,true);
  assert.equal(Object.hasOwn(privateCapture,'privateText'),false);assert.ok(!JSON.stringify(result).includes(text));
  assert.deepEqual(Object.keys(result).sort(),['confirmed','lang','private_text_cleared','region_count','route_asset_binding_or_semantic_accuracy_proven','sha256','text_or_url_returned','utf8_bytes','visible','visible_region_count'].sort());
});

test('collapsed, ambiguous, wrong-language or oversized regions never carry private text',()=>{
  for(const regions of [[region({visible:false})],[region(),region()],[region({lang:'ar'})],[region({value:'x'.repeat(400001)})]]) {
    const privateCapture=capture(regions);assert.equal(Object.hasOwn(privateCapture,'privateText'),false);
    const result=visibleEnglishRegionProof(privateCapture,digest);assert.equal(result.confirmed,false);assert.ok(!JSON.stringify(result).includes(text));
  }
});

test('a mismatch or invalid expected hash still clears the private capture',()=>{
  const privateCapture=capture([region({value:'Synthetic different source'})]);
  const result=visibleEnglishRegionProof(privateCapture,digest);assert.equal(result.confirmed,false);assert.equal(result.private_text_cleared,true);
  assert.ok(!JSON.stringify(result).includes('Synthetic different source'));assert.equal(Object.hasOwn(privateCapture,'privateText'),false);
  const invalid=capture([region()]);assert.equal(visibleEnglishRegionProof(invalid,'not a digest').code,'EXPECTED_DIGEST_INVALID');assert.equal(Object.hasOwn(invalid,'privateText'),false);
});

test('Node alone enforces the UTF8 byte bound after the DOM character bound',()=>{
  const privateCapture=capture([region({value:'€'.repeat(300000)})]);
  assert.equal(privateCapture.captured,true);assert.equal(privateCapture.privateText.length,300000);
  const result=visibleEnglishRegionProof(privateCapture,digest);
  assert.equal(result.confirmed,false);assert.equal(result.code,'CAPTURE_INVALID');assert.equal(result.private_text_cleared,true);
  assert.equal(Object.hasOwn(privateCapture,'privateText'),false);assert.ok(!JSON.stringify(result).includes('€'));
});

test('untrusted capture fields cannot become public text, URL, code or length',()=>{
  const privateCapture=capture([region()]);privateCapture.url='https://synthetic.invalid/private';
  const result=visibleEnglishRegionProof(privateCapture,digest);assert.equal(result.confirmed,false);assert.equal(result.code,'CAPTURE_INVALID');
  assert.equal(Object.hasOwn(privateCapture,'privateText'),false);assert.ok(!JSON.stringify(result).includes('synthetic.invalid'));
  assert.equal(visibleEnglishRegionProof({captured:false,code:text},digest).code,'CAPTURE_INVALID');
});

test('a read-only capture that cannot clear its private field cannot claim success',()=>{
  const privateCapture=Object.freeze(capture([region()]));const result=visibleEnglishRegionProof(privateCapture,digest);
  assert.equal(result.confirmed,false);assert.equal(result.code,'PRIVATE_CAPTURE_CLEAR_FAILED');assert.equal(result.private_text_cleared,false);assert.ok(!JSON.stringify(result).includes(text));
});
