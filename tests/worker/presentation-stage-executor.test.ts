import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import type { JobEvent, JsonObject, StageLease } from '../../packages/jobs/src/types.ts';
import { presentationCanonicalHash, presentationCanonicalJson, manifestFromSnapshot } from '../../packages/domain/src/presentation.ts';
import { executePresentationStage, PresentationExecutionError } from '../../apps/worker/src/presentation-stage-executor.ts';
import { PresentationPdfError } from '../../apps/worker/src/presentation-pdf.ts';
import { renderPresentationPdf } from '../../apps/worker/src/presentation-pdf.ts';
import type { PresentationArtifact, PresentationStageAssets } from '../../apps/worker/src/presentation-assets.ts';
import { nativePresentation } from './presentation-native-fixture.ts';
const id = (n: number) => `a5050000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stages = ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'];
async function fixture() {
  const { snapshot, images } = nativePresentation([0], false);
  const small = { schema_version: '1.0', workspace_id: snapshot.workspace_id, series_id: snapshot.series_id, version_id: snapshot.version_id,
    snapshot_sha256: await presentationCanonicalHash(snapshot), manifest_sha256: await presentationCanonicalHash(manifestFromSnapshot(snapshot)), inventory_sha256: await presentationCanonicalHash(snapshot.asset_inventory), configuration: snapshot.render_configuration };
  const input = { ...small, input_hash: await presentationCanonicalHash(small) }; const outputs: Record<string, JsonObject | null> = { prepared: null, rendered: null, validated: null }; const events: JobEvent[] = []; const files = new Map<string, Uint8Array>(); let writes = 0;
  const assets: PresentationStageAssets = {
    async read(_scope, asset) { const bytes = 'asset_kind' in asset ? images.get(asset.asset_id) : files.get(asset.asset_id); assert.ok(bytes); return bytes; },
    async write(_scope, value): Promise<PresentationArtifact> { const asset_id = id(950 + writes++); files.set(asset_id, new Uint8Array(value.bytes)); assert.equal(createHash('sha256').update(value.bytes).digest('hex'), value.sha256); return { asset_id, sha256: value.sha256, size_bytes: value.bytes.length, mime_type: value.purpose === 'presentation_pdf' ? 'application/pdf' : 'application/json' }; },
  };
  const lease = (index: number): StageLease => ({ job_id: id(900), attempt_id: id(910 + index), stage: stages[index], lease_token: 'b'.repeat(64), lease_expires_at: new Date(Date.now() + 90000).toISOString(), already_completed: false, input: structuredClone(input) as JsonObject });
  const gateway = (current: StageLease) => ({
    async getInput() { return { ...structuredClone(input), job_id: current.job_id, attempt_id: current.attempt_id, stage: current.stage, snapshot: structuredClone(snapshot), ...structuredClone(outputs) }; },
    async recordEvent(event: JobEvent) { events.push(event); return { event_id: event.event_id, applied: true, duplicate: false, stale: false, job_status: event.stage === 'publish_presentation' ? 'succeeded' as const : 'running' as const }; },
  });
  return { snapshot, input, outputs, events, files, assets, lease, gateway, writes: () => writes };
}
test('four native stages produce real PDF and exact canonical manifest before a closed publication result', { timeout: 120000 }, async () => {
  const f = await fixture();
  for (let n = 0; n < 4; n++) { const lease = f.lease(n); const response = await executePresentationStage(lease, f.gateway(lease), { assets: f.assets }); assert.equal(response.receipt?.applied, true); const event = f.events.at(-1)!; assert.equal(event.event_type, 'succeeded'); if (n < 3) f.outputs[['prepared', 'rendered', 'validated'][n]] = structuredClone(event.result!); }
  assert.equal(f.writes(), 2); const result = f.events.at(-1)!.result!; assert.equal(Object.keys(result).length, 9); assert.equal(result.validation_passed, true); assert.equal(result.page_count, 2); assert.equal(result.overflow_count, 0);
  assert.equal(Buffer.from(f.files.get(result.pdf_asset_id as string)!).subarray(0, 5).toString(), '%PDF-'); assert.equal(Buffer.from(f.files.get(result.manifest_asset_id as string)!).toString(), presentationCanonicalJson(manifestFromSnapshot(f.snapshot)));
});
test('changed frozen bindings and extra live inputs are rejected before native work or output writes', async () => {
  for (const change of ['snapshot', 'origin', 'private_field'] as const) {
    const f = await fixture(); const lease = f.lease(0); const gateway = f.gateway(lease); const original = gateway.getInput;
    gateway.getInput = async () => { const value = await original(); if (change === 'snapshot') value.snapshot.cover.project_name = 'Changed'; if (change === 'origin') value.snapshot.render_configuration.application_origin = 'https://untrusted.invalid'; if (change === 'private_field') Object.assign(value, { source_facts: 'untrusted' }); return value; };
    await assert.rejects(executePresentationStage(lease, gateway, { assets: f.assets }), PresentationExecutionError); assert.equal(f.writes(), 0); assert.equal(f.events.length, 0);
  }
});
test('a failed preparation emits failure once and never publishes a ready version', async () => {
  for (const code of ['PDF_ASSET_INVALID', 'PDF_BUDGET_EXCEEDED'] as const) {
    const f = await fixture(); const lease = f.lease(0);
    await executePresentationStage(lease, f.gateway(lease), { assets: f.assets, prepare: async () => { throw new PresentationPdfError(code); } });
    assert.equal(f.events.length, 1); assert.equal(f.events[0].event_type, 'failed'); assert.equal(f.events[0].error?.retryable, false); assert.equal(f.writes(), 0); assert.equal(f.events[0].error?.code, code === 'PDF_BUDGET_EXCEEDED' ? code : 'PDF_SOURCE_UNAVAILABLE');
  }
});
test('completed/stale/cancelled work does not read, upload or repeat computation', async () => {
  const f = await fixture(); const done = f.lease(0); done.already_completed = true; assert.equal((await executePresentationStage(done, f.gateway(done), { assets: f.assets })).already_completed, true);
  const stale = f.lease(0); stale.lease_expires_at = new Date(0).toISOString(); await assert.rejects(executePresentationStage(stale, f.gateway(stale), { assets: f.assets }), PresentationExecutionError);
  const controller = new AbortController(); controller.abort(); const lease = f.lease(0); await assert.rejects(executePresentationStage(lease, f.gateway(lease), { assets: f.assets, signal: controller.signal }), PresentationExecutionError); assert.equal(f.writes(), 0); assert.equal(f.events.length, 0);
});
test('lost callback acknowledgement replays the same event without rendering or uploading again', { timeout: 120000 }, async () => {
  const f = await fixture(); const initial = f.lease(0); await executePresentationStage(initial, f.gateway(initial), { assets: f.assets }); f.outputs.prepared = f.events.at(-1)!.result!;
  const lease = f.lease(1); const gateway = f.gateway(lease); const sent: JobEvent[] = []; let renders = 0;
  gateway.recordEvent = async event => { sent.push(structuredClone(event)); if (sent.length === 1) throw { code: 'RUNTIME_UNAVAILABLE', outcome: 'unknown', gateway_phase: 'commit', transport_code: 'ECONNRESET' }; return { event_id: event.event_id, applied: false, duplicate: true, stale: false, job_status: 'running' }; };
  const result = await executePresentationStage(lease, gateway, { assets: f.assets, render: async (...args) => { renders++; return renderPresentationPdf(...args); } });
  assert.equal(result.receipt?.duplicate, true); assert.equal(renders, 1); assert.equal(f.writes(), 2); assert.equal(sent.length, 2); assert.deepEqual(sent[1], sent[0]);
});
