import assert from 'node:assert/strict';
import test from 'node:test';
import { captureLogoUpload, finishLogoUpload, logoRecoveryKey, parseLogoUpload, LogoSelectionConflict, type LogoUploadIntent, type LogoUploadPorts } from '../../apps/web/components/logo-upload-recovery';
import type { Workspace } from '../../apps/web/components/api';

const actor = 'synthetic-producer', upload = '92300000-0000-4000-8000-000000000001', asset = '92300000-0000-4000-8000-000000000002';
const workspace: Workspace = { id: '92300000-0000-4000-8000-000000000003', project_id: '92300000-0000-4000-8000-000000000004',
  module: 'casting', title: 'Synthetic', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 4,
  draft_revision: 1, has_unpublished_changes: false, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' };
const file = () => new File([new Uint8Array([1, 2, 3])], 'synthetic.png', { type: 'image/png' });
async function harness() {
  const intent = await captureLogoUpload(actor, workspace, file()); let stored = '', active = true, completed = false, status = 'open';
  const calls: { path: string; init?: RequestInit }[] = [];
  const session = () => ({ id: upload, asset_id: asset, status: completed ? 'completed' : status, expires_at: '2099-10-28T00:00:00Z', upload_url: '/api/dev/uploads/'+upload+'/bytes', upload_headers: { 'Content-Type': 'image/png' } });
  const ports: LogoUploadPorts = {
    origin: 'http://localhost', active: () => active,
    checkpoint: v => { stored = JSON.stringify(v); assert.ok(parseLogoUpload(stored, actor, workspace.id)); },
    json: async (path, init) => {
      calls.push({ path, init }); let data: unknown;
      if (path === '/api/v1/uploads' || path === '/api/v1/uploads/'+upload) data = session();
      else if (path.endsWith('/complete')) { completed = true; data = { asset: { id: asset, purpose: 'client_logo', status: 'ready' }, status: 'ready', processing_job_id: null }; }
      else data = init?.method === 'PATCH' ? { ...workspace, row_version: 5, logo_asset_id: asset } : workspace;
      return { request_id: 'synthetic', data };
    },
    put: async () => new Response('', { status: 200 }),
  };
  return { intent, ports, calls, stored: () => stored, active: (v: boolean) => { active = v; }, status: (v: string) => { status = v; } };
}
test('tab recovery is exact user/workspace scoped and stores no capability or arbitrary body', async () => {
  const state = await harness(); await finishLogoUpload(state.intent, state.ports, file());
  const raw = state.stored(), parsed = parseLogoUpload(raw, actor, workspace.id)!;
  assert.equal(parsed.transferAttempted, true); assert.equal(parsed.readyAssetId, asset);
  assert.doesNotMatch(raw, /https?:|upload_url|upload_headers|Bearer|token|base64/u);
  assert.notEqual(logoRecoveryKey(actor, workspace.id), logoRecoveryKey('another-viewer', workspace.id));
  assert.throws(() => parseLogoUpload(raw, 'another-viewer', workspace.id));
  assert.throws(() => parseLogoUpload(raw, actor, 'another-workspace'));
  for (const mutate of [(v: LogoUploadIntent & { token?: string }) => { v.token = 'private-canary'; },
    (v: LogoUploadIntent) => { v.complete.body = JSON.stringify({ actual_size_bytes: 3, start_processing: true }); }]) {
    const value = JSON.parse(raw); mutate(value); assert.throws(() => parseLogoUpload(JSON.stringify(value), actor, workspace.id));
  }
});
test('successful PUT followed by unmount checkpoints before stopping; restored intent finishes without another PUT', async () => {
  const state = await harness(); let puts = 0;
  state.ports.put = async () => { puts++; state.active(false); return new Response('', { status: 200 }); };
  await assert.rejects(finishLogoUpload(state.intent, state.ports, file()), /stored logo is kept/u);
  assert.equal(puts, 1); assert.equal(state.calls.filter(row => row.path.endsWith('/complete')).length, 0);
  const restored = parseLogoUpload(state.stored(), actor, workspace.id)!; state.active(true);
  const saved = await finishLogoUpload(restored, state.ports);
  assert.equal(saved.logo_asset_id, asset); assert.equal(puts, 1);
  assert.equal(state.calls.filter(row => row.path.endsWith('/cancel')).length, 0);
});
test('unknown PUT is never replayed; explicit resume checks session then verifies existing bytes with stable completion key', async () => {
  const state = await harness(); let puts = 0;
  state.ports.put = async () => { puts++; throw new TypeError('Synthetic network loss'); };
  await assert.rejects(finishLogoUpload(state.intent, state.ports, file()), /Synthetic network loss/u);
  const restored = parseLogoUpload(state.stored(), actor, workspace.id)!;
  await finishLogoUpload(restored, state.ports);
  assert.equal(puts, 1); assert.equal(state.calls[1].path, '/api/v1/uploads/'+upload);
  const complete = state.calls.find(row => row.path.endsWith('/complete'))!;
  assert.deepEqual(complete.init?.headers, { 'Idempotency-Key': state.intent.complete.key }); assert.equal(complete.init?.body, state.intent.complete.body);
});
test('cancelled/expired server sessions cannot be completed, transferred or applied', async () => {
  for (const status of ['cancelled', 'expired']) {
    const state = await harness(); state.intent.session = { id: upload, assetId: asset }; state.intent.transferAttempted = true; state.status(status);
    let puts = 0; state.ports.put = async () => { puts++; throw new Error('Unexpected PUT'); };
    await assert.rejects(finishLogoUpload(state.intent, state.ports), /cancelled or expired/u);
    assert.equal(state.intent.stage, 'closed'); assert.equal(puts, 0); assert.equal(state.calls.length, 1); assert.equal(state.calls[0].init, undefined);
  }
});
test('storage custody failure before PUT prevents bytes and later completion from being sent', async () => {
  const state = await harness(); let puts = 0;
  state.ports.put = async () => { puts++; return new Response(''); };
  state.ports.checkpoint = intent => { if (intent.transferAttempted) throw new Error('Synthetic tab storage full'); };
  await assert.rejects(finishLogoUpload(state.intent, state.ports, file()), /tab storage full/u);
  assert.equal(puts, 0); assert.equal(state.calls.filter(row => row.path.endsWith('/complete')).length, 0);
});
test('no fresh revision silently overwrites concurrent branding, even after an earlier explicit choice', async () => {
  const state = await harness(); const json = state.ports.json;
  state.ports.json = async (path, init) => path.includes('/workspaces/') && !init ? { request_id: 'synthetic', data: { ...workspace, row_version: 6, logo_asset_id: 'another-logo' } } : json(path, init);
  await assert.rejects(finishLogoUpload(state.intent, state.ports, file()), LogoSelectionConflict);
  await assert.rejects(finishLogoUpload(state.intent, state.ports, undefined, { ...workspace, row_version: 5, logo_asset_id: 'another-logo' }), LogoSelectionConflict);
  assert.equal(state.calls.filter(row => row.init?.method === 'PATCH').length, 0);
});
