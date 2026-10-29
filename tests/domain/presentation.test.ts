import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGenerateVersion, parseRenderSnapshot, presentationCanonicalHash, presentationCanonicalJson, manifestFromSnapshot, renderContextFromSnapshot,
  parsePresentationVersion, parsePresentationManifest, reviewFromRenderSnapshot, summarizePresentationChanges } from '../../packages/domain/src/presentation.ts';
import { DomainError } from '../../packages/domain/src/types.ts';
import { presentationFixture, presentationVersionFixture } from '../fixtures/presentation.ts';

const input = () => ({ expected_workspace_row_version: 3, expected_draft_revision: 0, expected_input_fingerprint: 'a'.repeat(64) });
const invalid = (error: unknown) => error instanceof DomainError && error.code === 'VALIDATION_FAILED';
test('generation requires all three independent review guards and rejects caller-selected render policy', () => {
  assert.deepEqual(parseGenerateVersion(input()), input());
  for (const key of Object.keys(input())) {
    const value: Record<string, unknown> = input(); delete value[key];
    assert.throws(() => parseGenerateVersion(value), invalid);
  }
  for (const value of [{ ...input(), expected_workspace_row_version: 0 }, { ...input(), expected_draft_revision: 0.5 },
    { ...input(), expected_input_fingerprint: 'foreign' }, { ...input(), template_version: 'caller' },
    { ...input(), application_origin: 'https://arbitrary.invalid' }, { ...input(), generation_note: '\u0000' }]) {
    assert.throws(() => parseGenerateVersion(value), invalid);
  }
});

test('draft comparison identifies known frozen differences and leaves unknown shared-source causes unspecified', () => {
  const snapshot = presentationFixture(); const current = reviewFromRenderSnapshot(snapshot); const last = presentationVersionFixture(snapshot);
  assert.equal(summarizePresentationChanges(current, last).has_changes, false);
  current.input_fingerprint = 'e'.repeat(64); current.slides[0].fields.city = 'Changed synthetic city'; current.slides[0].position = 'backup';
  const summary = summarizePresentationChanges(current, last);
  assert.equal(summary.has_changes, true); assert.equal(summary.changed_fields, 1); assert.equal(summary.changed_casting, 1);
  const unknown = reviewFromRenderSnapshot(snapshot); unknown.input_fingerprint = 'f'.repeat(64);
  const unknownSummary = summarizePresentationChanges(unknown, last);
  assert.equal(unknownSummary.shared_source_changed, true); assert.equal(unknownSummary.changed_fields, 0);
  assert.throws(() => summarizePresentationChanges({ ...unknown, series_id: 'foreign' }, last), invalid);
});
test('a supplied role-category change is a known requirements change rather than an unspecified shared-source cause', () => {
  const snapshot = presentationFixture(); const current = reviewFromRenderSnapshot(snapshot); const last = presentationVersionFixture(snapshot);
  current.input_fingerprint = 'e'.repeat(64); current.slides[1].role_category = 'Changed synthetic category';
  const summary = summarizePresentationChanges(current, last);
  assert.equal(summary.has_changes, true); assert.equal(summary.changed_requirements, 1); assert.equal(summary.changed_fields, 0);
  assert.equal(summary.shared_source_changed, false); assert.equal(last.slides[2].role_category, 'Synthetic category');
});

test('version and manifest responses cannot leak storage paths or claim ready with partial artifacts', () => {
  const snapshot = presentationFixture(); const version = presentationVersionFixture(snapshot); const manifest = manifestFromSnapshot(snapshot);
  assert.deepEqual(parsePresentationVersion(version), version); assert.deepEqual(parsePresentationManifest(manifest), manifest);
  for (const bad of [{ ...version, status: 'ready' }, { ...version, bucket: 'private' },
    { ...version, render_context: { ...version.render_context, storage: snapshot.asset_inventory } },
    { ...version, slides: [version.slides[0], { ...version.slides[1], version_id: snapshot.project_id }] },
    { ...version, render_context: { ...version.render_context, slide_contexts: [] } }]) assert.throws(() => parsePresentationVersion(bad), invalid);
  for (const bad of [{ ...manifest, storage: snapshot.asset_inventory }, { ...manifest, slides: manifest.slides.slice(1) },
    { ...manifest, asset_inventory: [...manifest.asset_inventory, manifest.asset_inventory[0]] }]) assert.throws(() => parsePresentationManifest(bad), invalid);
});

test('published manifest and safe viewer context derive frozen values without exposing private storage or aliases', () => {
  const snapshot = presentationFixture({ logo: true }); snapshot.slides[1].fields!.availability = '0';
  const manifest = manifestFromSnapshot(snapshot); const context = renderContextFromSnapshot(snapshot);
  assert.equal(manifest.project_name, 'Synthetic Project'); assert.equal(context.cover.title, 'Synthetic Selection');
  assert.equal(manifest.slides.length, 3); assert.equal(manifest.slides[1].fields!.availability, '0');
  assert.equal(manifest.slides[2].role_category, 'Synthetic category');
  assert.equal(Object.keys(manifest.slides[1].fields!).length, 10); assert.equal(manifest.slides[2].kind, 'pending');
  assert.deepEqual(context.slide_contexts[1].frames, snapshot.slides[1].frames);
  assert.equal(JSON.stringify(manifest).includes('object_key'), false); assert.equal(JSON.stringify(context).includes('bucket'), false);
  assert.equal(JSON.stringify(manifest).includes('source_fields'), false);
  manifest.slides[1].fields!.city = 'Edited output copy'; context.cover.title = 'Edited context copy';
  assert.equal(snapshot.slides[1].fields!.city, 'Not provided'); assert.equal(snapshot.cover.title, 'Synthetic Selection');
});

test('immutable snapshot boundary rejects extra private data, changed asset identity and incoherent slide scope', () => {
  const good = presentationFixture({ logo: true });
  assert.deepEqual(parseRenderSnapshot(good), good);
  const mutations: ((value: ReturnType<typeof presentationFixture>) => void)[] = [
    value => Object.assign(value, { internal_notes: 'Unrelated private input' }),
    value => { value.slides[1].frames[0].sha256 = 'd'.repeat(64); },
    value => { value.slides[1].version_id = value.project_id; },
    value => { value.slides[1].order = 5; },
    value => { value.slides[2].fields = value.slides[1].fields; },
    value => { value.asset_inventory.push(structuredClone(value.asset_inventory[0])); },
    value => { value.asset_inventory[0].object_key = '../outside.mp4'; },
    value => { value.render_configuration.application_origin = 'https://arbitrary.invalid/path'; },
    value => { value.template.font_hashes = {}; },
  ];
  for (const mutate of mutations) { const value = structuredClone(good); mutate(value); assert.throws(() => parseRenderSnapshot(value), invalid); }
});

test('canonical capture hash preserves exact Unicode/date values and ignores object insertion order', async () => {
  assert.equal(presentationCanonicalJson({ z: 'بيانات', a: [0, false, null, '0'] }), '{"a":[0,false,null,"0"],"z":"بيانات"}');
  assert.equal(await presentationCanonicalHash({ z: 3, a: 1 }), await presentationCanonicalHash({ a: 1, z: 3 }));
  const fixture = presentationFixture(); assert.equal(parseRenderSnapshot(fixture).created_at, fixture.created_at);
  for (const value of [NaN, 1.5, -0, { field: undefined }, new Date(), '\ud800']) assert.throws(() => presentationCanonicalJson(value), invalid);
});
test('canonical metadata budget is measured in UTF-8 bytes and sparse/cyclic values are rejected', () => {
  assert.throws(() => presentationCanonicalJson('ع'.repeat(4 * 1024 * 1024 + 1)), invalid);
  assert.throws(() => presentationCanonicalJson(Array(2)), invalid);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle; assert.throws(() => presentationCanonicalJson(cycle), invalid);
});
