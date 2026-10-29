import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '@eps/domain';
import { handleMediaPlaybackRequest } from '../../apps/web/lib/media-http.ts';
const actor = { principal_id: 'verified-user' };
const segments = ['media','opaque-asset','playback'];
const request = (suffix = '', body?: string) => new Request(`http://127.0.0.1/api/v1/media/opaque-asset/playback${suffix}`, { method:'POST', ...(body === undefined ? {} : {body}) });
test('playback accepts only its resource ID, rejects ignored body/query authority and never signs on invalid input', async () => {
  const calls:unknown[][]=[];
  const service={playMedia:async(...args:unknown[])=>{calls.push(args);return {asset_id:'opaque-asset',url:'https://synthetic.invalid/scoped',expires_at:'2026-10-29T10:00:00Z',mime_type:'video/mp4',source_version_id:null};}};
  for(const query of ['?url=https://arbitrary.example','?principal_id=other','?download=true','?asset_id=another'])await assert.rejects(handleMediaPlaybackRequest(request(query),segments,actor,service,'request'),DomainError);
  for(const body of ['{}','{"url":"https://arbitrary.example"}','{"principal_id":"other"}',' '])await assert.rejects(handleMediaPlaybackRequest(request('',body),segments,actor,service,'request'),DomainError);
  assert.equal(calls.length,0);
  const response=await handleMediaPlaybackRequest(request(),segments,actor,service,'request');
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control')!,/private.*no-store/u);
  assert.deepEqual(calls,[[actor,'opaque-asset']]);assert.equal((await response.json()).request_id,'request');
});
test('playback keeps scoped access errors and rejects unsupported routes or malformed IDs',async()=>{
  const denied=new DomainError('CAPABILITY_REQUIRED','Casting library access required.',403);
  const service={playMedia:async()=>{throw denied;}};
  await assert.rejects(handleMediaPlaybackRequest(request(),segments,actor,service,'request'),error=>error===denied);
  await assert.rejects(handleMediaPlaybackRequest(new Request('http://127.0.0.1/api/v1/media/asset/playback'),segments,actor,service,'request'),DomainError);
  for(const id of ['','..','foreign/source','forged%2fpath'])await assert.rejects(handleMediaPlaybackRequest(request(),['media',id,'playback'],actor,service,'request'),DomainError);
});
