import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {verifyCandidateSupportOriginal} from '../../apps/web/lib/candidate-support-original.ts';
test('support verifier decodes actual single images and explicit document purpose without provider work',async()=>{
 const png=await sharp({create:{width:3,height:2,channels:3,background:'white'}}).png().toBuffer();
 assert.deepEqual(await verifyCandidateSupportOriginal(png,'image/png',{sourceAssetId:'synthetic',purpose:'candidate_support'}),{mimeType:'image/png',format:'png',width:3,height:2});
 assert.deepEqual(await verifyCandidateSupportOriginal(new TextEncoder().encode('Synthetic supporting note'),'text/plain',{sourceAssetId:'synthetic',purpose:'candidate_support'}),{mimeType:'text/plain',format:'utf8_text',width:null,height:null});
 await assert.rejects(verifyCandidateSupportOriginal(png,'image/jpeg',{sourceAssetId:'synthetic',purpose:'candidate_support'}));
 await assert.rejects(verifyCandidateSupportOriginal(new Uint8Array([0,1,2]),'text/plain',{sourceAssetId:'synthetic',purpose:'candidate_support'}));
 await assert.rejects(verifyCandidateSupportOriginal(png,'image/png',{sourceAssetId:'synthetic',purpose:'specs'} as never));
});
