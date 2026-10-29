import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesVideo, restoreVideoIntents, saveVideoIntents, videoMime, type VideoUploadIntent } from '../../apps/web/lib/candidate-upload-recovery';

const intent: VideoUploadIntent = {
  id:'11111111-1111-4111-8111-111111111111',name:'intro.webm',size:42,lastModified:100,mime:'video/webm',
  reserveKey:'22222222-2222-4222-8222-222222222222',completeKey:'33333333-3333-4333-8333-333333333333',
  hash:'a'.repeat(64),sessionId:'44444444-4444-4444-8444-444444444444',status:'uploading',
};
test('tab reload retains the same reservation/completion identity without retaining transport credentials or bytes',()=>{
  const source={...intent,file:{name:'private'},session:{upload_url:'https://private.invalid?token=secret'},upload_url:'secret',headers:{Authorization:'secret'}};
  const saved=saveVideoIntents([source]);
  assert.deepEqual(restoreVideoIntents(saved),[intent]);
  assert.doesNotMatch(saved,/secret|upload_url|Authorization|private|file/u);
  assert.deepEqual(restoreVideoIntents(JSON.stringify([source])),[intent]);
});
test('reselection requires the exact file metadata before the content SHA is checked by the transfer',()=>{
  assert.equal(matchesVideo(intent,{name:'intro.webm',size:42,lastModified:100}),true);
  assert.equal(matchesVideo(intent,{name:'intro.webm',size:43,lastModified:100}),false);
  assert.equal(matchesVideo(intent,{name:'other.webm',size:42,lastModified:100}),false);
});
test('untyped WebM and MKV are inferred accurately; unsupported or explicit nonvideo types are rejected',()=>{
  assert.equal(videoMime({name:'INTRO.WEBM',type:''}),'video/webm');
  assert.equal(videoMime({name:'intro.mkv',type:''}),'video/x-matroska');
  assert.equal(videoMime({name:'intro.mov',type:''}),'video/quicktime');
  assert.throws(()=>videoMime({name:'intro.exe',type:''}));
  assert.throws(()=>videoMime({name:'intro.mp4',type:'application/pdf'}));
});
test('malformed, oversized and forged recovery entries cannot be restored',()=>{
  assert.deepEqual(restoreVideoIntents('{'),[]);
  assert.deepEqual(restoreVideoIntents(JSON.stringify(Array(201).fill(intent))),[]);
  assert.deepEqual(restoreVideoIntents(JSON.stringify([{...intent,size:9999999999},{...intent,sessionId:'../../foreign'},{...intent,mime:'text/html'}])),[]);
  assert.deepEqual(restoreVideoIntents(JSON.stringify([{...intent,status:'queued'}])),[]);
});
