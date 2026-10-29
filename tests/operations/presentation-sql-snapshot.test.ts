import assert from 'node:assert/strict';
import test from 'node:test';
import { checkSyntheticPresentationCapture, readSyntheticPresentationCapture, SYNTHETIC_PRESENTATION_FIXTURES, type SyntheticPresentationCapture } from '../../tools/check-presentation-sql-snapshot.mts';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { manifestFromSnapshot, presentationCanonicalHash } from '../../packages/domain/src/presentation.ts';
import { presentationFixture, presentationVersionFixture } from '../fixtures/presentation.ts';

async function fixture(): Promise<SyntheticPresentationCapture> {
  const snapshot = presentationFixture(); const manifest = manifestFromSnapshot(snapshot); const manifestSha = await presentationCanonicalHash(manifest);
  return { schema_version: '1.0', kind: 'synthetic_presentation_capture', synthetic: true, snapshot, snapshot_sha256: await presentationCanonicalHash(snapshot),
    manifest, manifest_sha256: manifestSha, inventory_sha256: await presentationCanonicalHash(snapshot.asset_inventory),
    version: { ...presentationVersionFixture(snapshot), manifest_hash: manifestSha } };
}
test('offline SQL capture decoder binds private snapshot, closed manifest and safe version metadata', async () => {
  const value = await fixture(); const result = await checkSyntheticPresentationCapture(value);
  assert.equal(result.result, 'validated_synthetic_capture'); assert.equal(result.version_id, value.snapshot.version_id);
  assert.equal(result.page_count, 3); assert.equal(result.candidate_slide_count, 1); assert.equal(result.pending_slide_count, 1);
  assert.equal(result.snapshot_sha256, value.snapshot_sha256); assert.equal(result.cloud_called, false);
  assert.equal(JSON.stringify(result).includes('Synthetic Candidate'), false); assert.equal(JSON.stringify(result).includes('object_key'), false);
});
test('SQL/TS hash, identity, context or privacy mismatches produce one fixed failure without private details', async () => {
  const value = await fixture();
  const edits: ((row: SyntheticPresentationCapture) => void)[] = [row => { row.synthetic = false as true; },
    row => { row.manifest_sha256 = 'e'.repeat(64); }, row => { row.version.render_context.cover.title = 'Uncaptured title'; },
    row => { row.manifest.slides[1].fields!.city = 'Uncaptured fact'; }, row => { Object.assign(row.version, { bucket: 'private' }); }];
  for (const edit of edits) { const changed = structuredClone(value); edit(changed);
    await assert.rejects(checkSyntheticPresentationCapture(changed), error => error instanceof Error && error.message === 'SYNTHETIC_PRESENTATION_CAPTURE_UNCONFIRMED');
  }
});
test('file reader admits only task-local explicitly synthetic JSON and emits hashes rather than source text', async () => {
  await assert.rejects(readSyntheticPresentationCapture('../../.env.worker.local'), /SYNTHETIC_PRESENTATION_CAPTURE_UNCONFIRMED/u);
  await mkdir(SYNTHETIC_PRESENTATION_FIXTURES, { recursive: true }); const file = join(SYNTHETIC_PRESENTATION_FIXTURES, `unit-${randomUUID()}.json`); let created = false;
  try {
    await writeFile(file, JSON.stringify(await fixture()), { flag: 'wx' }); created = true; const result = await readSyntheticPresentationCapture(file);
    assert.equal(result.result, 'validated_synthetic_capture'); assert.match(result.fixture_bytes_sha256 as string, /^[a-f0-9]{64}$/u);
    assert.equal(JSON.stringify(result).includes('Synthetic Candidate'), false);
    const output = execFileSync(process.execPath, ['--import', 'tsx', 'tools/check-presentation-sql-snapshot.mts', file], { encoding: 'utf8', timeout: 15000 });
    assert.deepEqual(JSON.parse(output), result);
  } finally { if (created) await unlink(file); }
});
