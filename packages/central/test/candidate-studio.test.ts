import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralStudio, type CentralStudioOptions } from '../src/studio.ts';

const principal = '10000000-0000-4000-8000-000000000001'; const actor = { principal_id: principal };
const video = '20000000-0000-4000-8000-000000000001'; const frame = '30000000-0000-4000-8000-000000000001';
const job = '40000000-0000-4000-8000-000000000001'; const attempt = '50000000-0000-4000-8000-000000000001';
const upload = '60000000-0000-4000-8000-000000000001'; const workspace = '70000000-0000-4000-8000-000000000001';
const origin = 'https://synthetic-readonly.example.invalid'; const token = 'synthetic-acting-user';
const originalKey = `assets/${video}/original.mp4`; const frameKey = `jobs/${job}/attempts/${attempt}/${frame}.jpg`;
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 9]); const now = new Date().toISOString();
const original = { id: video, purpose: 'candidate_video', filename: 'intro.mp4', mime_type: 'video/mp4', size_bytes: 60 * 1024 * 1024,
  sha256: 'a'.repeat(64), status: 'ready', duration_ms: 23000, width: 800, height: 480, source_asset_id: null, source_timestamp_ms: null, created_at: now };
const frameAsset = { id: frame, purpose: 'candidate_frame', filename: 'frame-0.jpg', mime_type: 'image/jpeg', size_bytes: jpeg.length,
  sha256: createHash('sha256').update(jpeg).digest('hex'), status: 'ready', duration_ms: null, width: 160, height: 90, source_asset_id: video, source_timestamp_ms: 500, created_at: now };
const reservation = { upload_id: upload, asset: { ...original, status: 'uploading', sha256: null, duration_ms: null, width: null, height: null },
  principal_id: principal, workspace_id: workspace, bucket: 'eps-candidate-assets', object_key: originalKey,
  expected_size_bytes: original.size_bytes, expected_mime_type: original.mime_type, expected_sha256: original.sha256,
  expires_at: new Date(Date.now() + 3600_000).toISOString(), status: 'open' };
const isDisabled = (error: unknown) => error instanceof DomainError && error.code === 'CANDIDATE_STORAGE_CONFIGURATION_REQUIRED';
const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

function capabilityService() {
  const capabilities = ['cast.read', 'cast.upload', 'workspaces.write'];
  const purposes = ['client_logo', 'specs']; const mime = ['image/png', 'application/pdf'];
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic_key', accessToken: token }, { fetch: async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : String(input)).pathname;
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
    if (path === '/auth/v1/user') return Response.json({ id: principal, aud: 'authenticated', role: 'authenticated', is_anonymous: false });
    assert.equal(path, '/rest/v1/rpc/eps_get_capabilities');
    return Response.json({ principal_id: principal, capabilities, timezone: 'Africa/Cairo', enabled_modules: ['casting'],
      upload_policy: { allowed_mime_types: mime, maximum_file_bytes: 20 * 1024 * 1024, recommended_batch_size: 200, available_purposes: purposes } });
  } });
  const legacy: CentralStudioOptions = {
    logo: { storageOrigin: origin, brandBucket: 'eps-brand-assets', async decodeLogo() { throw new Error('Capabilities must not decode bytes'); }, signReceipt() { throw new Error('Capabilities must not sign a receipt'); } },
    specs: { storageOrigin: origin, async verifyDocument() { throw new Error('Capabilities must not verify a document'); }, signReceipt() { throw new Error('Capabilities must not sign a receipt'); } },
  };
  return { client, capabilities, purposes, mime, legacy };
}

test('support media uses fresh global authority, strict purpose checks and only typed404 fallback',async()=>{
  const paths:string[]=[];let mode='ready';let capabilities=['cast.read'];
  const supportKey=`assets/${video}/original.jpg`;
  const asset={...frameAsset,id:video,purpose:'candidate_support',filename:'reference.jpg',source_asset_id:null,source_timestamp_ms:null};
  const envelope={asset,bucket:'eps-candidate-support',object_key:supportKey};
  const denied=()=>Response.json({code:'P0001',message:'CAPABILITY_REQUIRED',details:'{"status":403}'},{status:400});
  const client=createBearerUserClient({url:origin,publishableKey:'sb_publishable_synthetic_key',accessToken:token},{fetch:async(input,init)=>{
    const path=new URL(input instanceof Request?input.url:String(input)).pathname;paths.push(path);
    assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
    if(path==='/auth/v1/user')return Response.json({id:principal,aud:'authenticated',role:'authenticated',is_anonymous:false});
    if(path.endsWith('/eps_get_capabilities'))return Response.json({principal_id:principal,capabilities,timezone:'Africa/Cairo',enabled_modules:['casting'],upload_policy:{allowed_mime_types:[],maximum_file_bytes:268435456,recommended_batch_size:200,available_purposes:[]}});
    if(path.endsWith('/eps_get_candidate_support_asset')){
      if(mode==='denied')return denied();
      if(mode==='missing')return Response.json({code:'P0001',message:'RESOURCE_NOT_FOUND',details:'{"status":404}'},{status:400});
      return Response.json(mode==='invalid'?{...envelope,asset:{...asset,purpose:'candidate_frame'}}:envelope);
    }
    if(path.endsWith('/eps_get_candidate_asset'))return Response.json({asset:frameAsset,bucket:'eps-candidate-outputs',object_key:frameKey});
    if(path.endsWith('/eps_get_logo_media'))return Response.json(envelope);
    if(path===`/storage/v1/object/info/eps-candidate-support/${supportKey}`)return Response.json({id:video,name:supportKey,bucket_id:'eps-candidate-support',size:jpeg.length,content_type:'image/jpeg'});
    if(path===`/storage/v1/object/eps-candidate-support/${supportKey}`)return new Response(jpeg);
    if(path===`/storage/v1/object/info/eps-candidate-outputs/${frameKey}`)return Response.json({id:frame,name:frameKey,bucket_id:'eps-candidate-outputs',size:jpeg.length,content_type:'image/jpeg'});
    if(path===`/storage/v1/object/eps-candidate-outputs/${frameKey}`)return new Response(jpeg);
    throw new Error('Unexpected supporting-file destination');
  }});
  const studio=await createCentralStudio(client,{supportRead:{storageOrigin:origin},candidateRead:{storageOrigin:origin},logoRead:{storageOrigin:origin,brandBucket:'eps-brand-assets'}});
  const names=()=>paths.filter(path=>path.includes('/rest/v1/rpc/')).map(path=>path.split('/').at(-1));paths.length=0;
  assert.deepEqual(await studio.getMediaContent(actor,video),{bytes:jpeg,mimeType:'image/jpeg'});
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_support_asset','eps_get_candidate_support_asset']);
  for(const [changed,code] of [['denied','CAPABILITY_REQUIRED'],['invalid','CENTRAL_RESPONSE_INVALID']]){
    mode=changed;paths.length=0;await assert.rejects(studio.getMediaContent(actor,video),error=>error instanceof DomainError&&error.code===code);
    assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_support_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
  }
  mode='missing';paths.length=0;assert.deepEqual(await studio.getMediaContent(actor,frame),{bytes:jpeg,mimeType:'image/jpeg'});
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_support_asset','eps_get_candidate_asset','eps_get_candidate_asset']);
  capabilities=[];mode='denied';paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,video),error=>error instanceof DomainError&&error.code==='CAPABILITY_REQUIRED');
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_logo_media','eps_get_candidate_support_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
});

test('enabled authorized candidate uploads extend legacy M02 purposes/MIME policy and compose independent purpose limits', async () => {
  const service = capabilityService(); const maximumBytes = 50 * 1024 * 1024;
  const studio = await createCentralStudio(service.client, { ...service.legacy, candidate: { storageOrigin: origin, maximumBytes } });
  const result = await studio.getCapabilities(actor);
  assert.deepEqual(result.upload_policy.available_purposes, ['client_logo', 'specs', 'candidate_video']);
  assert.deepEqual(result.upload_policy.allowed_mime_types, ['image/png', 'application/pdf', ...videoTypes]);
  assert.equal(result.upload_policy.maximum_file_bytes, maximumBytes);
  assert.deepEqual(result.capabilities, service.capabilities);
  assert.deepEqual(service.purposes, ['client_logo', 'specs']);
  const smaller = await createCentralStudio(service.client, { ...service.legacy, candidate: { storageOrigin: origin, maximumBytes: 10 * 1024 * 1024 } });
  assert.equal((await smaller.getCapabilities(actor)).upload_policy.maximum_file_bytes, 20 * 1024 * 1024);
  const onlyVideo = await createCentralStudio(service.client, { candidate: { storageOrigin: origin, maximumBytes: 10 * 1024 * 1024 } });
  assert.equal((await onlyVideo.getCapabilities(actor)).upload_policy.maximum_file_bytes, 10 * 1024 * 1024);
});

test('read-only or currently revoked candidate authority never advertises video uploads, even if the RPC lists them', async () => {
  const service = capabilityService(); service.purposes.push('candidate_video'); service.mime.push('video/mp4');
  const readonly = await createCentralStudio(service.client, { ...service.legacy, candidateRead: { storageOrigin: origin } });
  const disabled = (await readonly.getCapabilities(actor)).upload_policy;
  assert.deepEqual(disabled.available_purposes, ['client_logo', 'specs']); assert.equal(disabled.maximum_file_bytes, 20 * 1024 * 1024);
  assert.equal(disabled.allowed_mime_types.some(mime => videoTypes.includes(mime)), false);
  const enabled = await createCentralStudio(service.client, { ...service.legacy, candidate: { storageOrigin: origin, maximumBytes: 50 * 1024 * 1024 } });
  for (const capability of ['cast.read','cast.upload', 'workspaces.write']) {
    service.capabilities.splice(service.capabilities.indexOf(capability), 1);
    const revoked = (await enabled.getCapabilities(actor)).upload_policy;
    assert.equal(revoked.available_purposes.includes('candidate_video'), false);
    assert.equal(revoked.allowed_mime_types.some(mime => videoTypes.includes(mime)), false);
    assert.equal(revoked.maximum_file_bytes, 20 * 1024 * 1024);
    service.capabilities.push(capability);
  }
});

test('CentralStudio candidateRead serves existing private media with no upload configuration or mutation authority', async () => {
  let allowed = true; const paths: string[] = [];
  const client = createBearerUserClient({ url: origin, publishableKey: 'sb_publishable_synthetic_key', accessToken: token }, { fetch: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input)); paths.push(url.pathname);
    assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : {};
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, aud: 'authenticated', role: 'authenticated', is_anonymous: false });
    if (url.pathname.endsWith('/eps_get_capabilities')) return Response.json({ principal_id: principal, capabilities: ['cast.read', 'cast.upload', 'workspaces.write'],
      timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: ['video/mp4'], maximum_file_bytes: 256 * 1024 * 1024, recommended_batch_size: 200, available_purposes: ['candidate_video'] } });
    if (/\/eps_get_logo_(?:media|upload)$/u.test(url.pathname)) return Response.json({ code: 'P0001', message: 'RESOURCE_NOT_FOUND', details: '{"status":404}' }, { status: 400 });
    if (url.pathname.endsWith('/eps_get_candidate_asset')) {
      if (!allowed) return Response.json({ code: 'P0001', message: 'RESOURCE_NOT_FOUND', details: '{"status":404}' }, { status: 400 });
      return Response.json(body.p_asset_id === frame ? { asset: frameAsset, bucket: 'eps-candidate-outputs', object_key: frameKey } : { asset: original, bucket: 'eps-candidate-assets', object_key: originalKey });
    }
    if (url.pathname.endsWith('/eps_get_candidate_upload')) return Response.json(reservation);
    if (url.pathname === `/storage/v1/object/sign/eps-candidate-assets/${originalKey}`) return Response.json({ signedURL: `/object/sign/eps-candidate-assets/${originalKey}?token=synthetic-playback` });
    if (url.pathname === `/storage/v1/object/info/eps-candidate-outputs/${frameKey}`) return Response.json({ id: frame, name: frameKey, bucket_id: 'eps-candidate-outputs', size: jpeg.length, content_type: 'image/jpeg' });
    if (url.pathname === `/storage/v1/object/eps-candidate-outputs/${frameKey}`) return new Response(jpeg);
    throw new Error('Unexpected request from read-only candidate studio');
  } });
  const studio = await createCentralStudio(client, { candidateRead: { storageOrigin: origin } });
  const policy = (await studio.getCapabilities(actor)).upload_policy;
  assert.deepEqual(policy.available_purposes, []); assert.equal(policy.maximum_file_bytes, 256 * 1024 * 1024);
  assert.equal((await studio.getMedia(actor, video)).size_bytes, 60 * 1024 * 1024);
  assert.equal((await studio.playMedia(actor, video)).asset_id, video);
  assert.deepEqual(await studio.getMediaContent(actor, frame), { bytes: jpeg, mimeType: 'image/jpeg' });
  assert.equal((await studio.getUploadSession(actor, upload)).upload_url, null);
  const context = { idempotencyKey: 'synthetic-readonly-intent' };
  await assert.rejects(studio.createUploadSession(actor, { purpose: 'candidate_video', workspace_id: workspace, filename: 'intro.mp4', mime_type: 'video/mp4', size_bytes: original.size_bytes }, context), isDisabled);
  await assert.rejects(studio.completeUpload(actor, upload, { actual_size_bytes: original.size_bytes, start_processing: true }, context), isDisabled);
  await assert.rejects(studio.cancelUpload(actor, upload, context), isDisabled);
  assert.equal(paths.some(path => /upload\/sign|eps_reserve_candidate_upload|eps_complete_candidate_upload|eps_cancel_candidate_upload/u.test(path)), false);
  allowed = false;
  await assert.rejects(studio.playMedia(actor, video), error => error instanceof DomainError && error.code === 'RESOURCE_NOT_FOUND');
});

test('legacy logo media scope projection routes candidate frames to their own strict adapter and fresh authority check',async()=>{
  const paths:string[]=[];let probe:unknown={asset:{...frameAsset,source_asset_id:null,source_timestamp_ms:null},bucket:'eps-candidate-outputs',object_key:frameKey};
  let own:unknown={asset:frameAsset,bucket:'eps-candidate-outputs',object_key:frameKey};let probeDenied=false;let ownDenied=false;
  const deny=()=>Response.json({code:'P0001',message:'CAPABILITY_REQUIRED',details:'{"status":403}'},{status:400});
  const client=createBearerUserClient({url:origin,publishableKey:'sb_publishable_synthetic_key',accessToken:token},{fetch:async(input,init)=>{
    const path=new URL(input instanceof Request?input.url:String(input)).pathname;paths.push(path);
    assert.equal(new Headers(init?.headers).get('Authorization'),`Bearer ${token}`);
    if(path==='/auth/v1/user')return Response.json({id:principal,aud:'authenticated',role:'authenticated',is_anonymous:false});
    if(path.endsWith('/eps_get_capabilities'))return Response.json({principal_id:principal,capabilities:['cast.read'],timezone:'Africa/Cairo',enabled_modules:['casting'],upload_policy:{allowed_mime_types:[],maximum_file_bytes:268435456,recommended_batch_size:200,available_purposes:[]}});
    if(path.endsWith('/eps_get_logo_media'))return probeDenied?deny():Response.json(probe);
    if(path.endsWith('/eps_get_candidate_asset')){
      // A typed not-found may be followed by a legacy generic media scope
      // projection. That projection is never sufficient to read bytes itself.
      if(paths.filter(entry=>entry.endsWith('/eps_get_candidate_asset')).length===1)return Response.json({code:'P0001',message:'RESOURCE_NOT_FOUND',details:'{"status":404}'},{status:400});
      return ownDenied?deny():Response.json(own);
    }
    if(path===`/storage/v1/object/info/eps-candidate-outputs/${frameKey}`)return Response.json({id:frame,name:frameKey,bucket_id:'eps-candidate-outputs',size:jpeg.length,content_type:'image/jpeg'});
    if(path===`/storage/v1/object/eps-candidate-outputs/${frameKey}`)return new Response(jpeg);
    throw new Error('Unexpected media adapter or destination');
  }});
  const studio=await createCentralStudio(client,{logoRead:{storageOrigin:origin,brandBucket:'eps-brand-assets'},specsRead:{storageOrigin:origin},candidateRead:{storageOrigin:origin}});
  const rpcNames=()=>paths.filter(path=>path.includes('/rest/v1/rpc/')&&!path.endsWith('/eps_get_capabilities')).map(path=>path.split('/').at(-1));
  assert.deepEqual(await studio.getMediaContent(actor,frame),{bytes:jpeg,mimeType:'image/jpeg'});
  assert.deepEqual(rpcNames(),['eps_get_candidate_asset','eps_get_logo_media','eps_get_candidate_asset']);
  assert.equal(paths.filter(path=>path.startsWith('/storage/')).length,2);
  const invalid=(error:unknown)=>error instanceof DomainError&&error.code==='CENTRAL_RESPONSE_INVALID';
  for(const changed of [
    {asset:{...frameAsset,source_asset_id:null,source_timestamp_ms:null,private_payload:'never-forward'},bucket:'eps-candidate-outputs',object_key:frameKey},
    {asset:{...frameAsset,purpose:'unsupported_private_media'},bucket:'eps-candidate-outputs',object_key:frameKey},
    {asset:frameAsset,bucket:'eps-candidate-outputs',object_key:frameKey,private_payload:'never-forward'},
  ]){probe=changed;paths.length=0;await assert.rejects(studio.getMediaContent(actor,frame),invalid);assert.deepEqual(rpcNames(),['eps_get_candidate_asset','eps_get_logo_media']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);}
  probe={asset:{...frameAsset,source_asset_id:null,source_timestamp_ms:null},bucket:'eps-candidate-outputs',object_key:frameKey};
  own={asset:{...frameAsset,private_payload:'never-forward'},bucket:'eps-candidate-outputs',object_key:frameKey};paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,frame),invalid);assert.deepEqual(rpcNames(),['eps_get_candidate_asset','eps_get_logo_media','eps_get_candidate_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
  own={asset:frameAsset,bucket:'eps-candidate-outputs',object_key:frameKey};ownDenied=true;paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,frame),error=>error instanceof DomainError&&error.code==='CAPABILITY_REQUIRED'&&error.status===403);
  assert.deepEqual(rpcNames(),['eps_get_candidate_asset','eps_get_logo_media','eps_get_candidate_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
  ownDenied=false;probeDenied=true;paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,frame),error=>error instanceof DomainError&&error.code==='CAPABILITY_REQUIRED'&&error.status===403);
  assert.deepEqual(rpcNames(),['eps_get_candidate_asset','eps_get_logo_media']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
});

test('fresh global cast.read routes library media before project probes while other actors retain legacy media access',async()=>{
  const paths:string[]=[];let capabilities=['cast.read'];let candidateDenied=false;let candidateInvalid=false;let candidateWrongPurpose=false;let capabilityPrincipal=principal;
  const logoAsset={...frameAsset,id:video,purpose:'client_logo',filename:'logo.jpg',source_asset_id:null,source_timestamp_ms:null};
  const client=createBearerUserClient({url:origin,publishableKey:'sb_publishable_synthetic_key',accessToken:token},{fetch:async(input,init)=>{
    const path=new URL(input instanceof Request?input.url:String(input)).pathname;paths.push(path);
    const body=typeof init?.body==='string'?JSON.parse(init.body) as Record<string,unknown>:{};
    if(path==='/auth/v1/user')return Response.json({id:principal,aud:'authenticated',role:'authenticated',is_anonymous:false});
    if(path.endsWith('/eps_get_capabilities'))return Response.json({principal_id:capabilityPrincipal,capabilities,timezone:'Africa/Cairo',enabled_modules:['casting'],upload_policy:{allowed_mime_types:[],maximum_file_bytes:268435456,recommended_batch_size:200,available_purposes:[]}});
    if(path.endsWith('/eps_get_candidate_asset'))return candidateDenied?Response.json({code:'P0001',message:'CAPABILITY_REQUIRED',details:'{"status":403}'},{status:400}):Response.json({asset:candidateInvalid?{...frameAsset,private_payload:'never-forward'}:candidateWrongPurpose?{...frameAsset,purpose:'client_logo'}:frameAsset,bucket:'eps-candidate-outputs',object_key:frameKey});
    if(path.endsWith('/eps_get_logo_media'))return body.p_asset_id===video?Response.json({asset:logoAsset,bucket:'eps-brand-assets',object_key:`assets/${video}/original.jpg`}):Response.json({code:'P0001',message:'CAPABILITY_REQUIRED',details:'{"status":403}'},{status:400});
    if(path===`/storage/v1/object/info/eps-candidate-outputs/${frameKey}`)return Response.json({id:frame,name:frameKey,bucket_id:'eps-candidate-outputs',size:jpeg.length,content_type:'image/jpeg'});
    if(path===`/storage/v1/object/eps-candidate-outputs/${frameKey}`)return new Response(jpeg);
    throw new Error('Unexpected global library media request');
  }});
  const studio=await createCentralStudio(client,{logoRead:{storageOrigin:origin,brandBucket:'eps-brand-assets'},candidateRead:{storageOrigin:origin}});
  const names=()=>paths.filter(path=>path.includes('/rest/v1/rpc/')).map(path=>path.split('/').at(-1));paths.length=0;
  assert.deepEqual(await studio.getMediaContent(actor,frame),{bytes:jpeg,mimeType:'image/jpeg'});
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_asset','eps_get_candidate_asset']);
  candidateDenied=true;paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,frame),error=>error instanceof DomainError&&error.code==='CAPABILITY_REQUIRED'&&error.status===403);
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
  candidateDenied=false;candidateInvalid=true;paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,frame),error=>error instanceof DomainError&&error.code==='CENTRAL_RESPONSE_INVALID');
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
  candidateInvalid=false;candidateWrongPurpose=true;paths.length=0;
  await assert.rejects(studio.getMediaContent(actor,frame),error=>error instanceof DomainError&&error.code==='CENTRAL_RESPONSE_INVALID');
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_candidate_asset']);assert.equal(paths.some(path=>path.startsWith('/storage/')),false);
  capabilities=[];candidateWrongPurpose=false;paths.length=0;
  assert.equal((await studio.getMedia(actor,video)).purpose,'client_logo');
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_logo_media','eps_get_logo_media']);
  paths.length=0;await assert.rejects(studio.getMedia(actor,frame),error=>error instanceof DomainError&&error.code==='CAPABILITY_REQUIRED');
  assert.deepEqual(names(),['eps_get_capabilities','eps_get_logo_media']);
  capabilities=['cast.read'];capabilityPrincipal=workspace;paths.length=0;
  await assert.rejects(studio.getMedia(actor,frame),error=>error instanceof DomainError&&error.code==='CENTRAL_RESPONSE_INVALID');
  assert.deepEqual(names(),['eps_get_capabilities']);
});
