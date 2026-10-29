import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createRequire } from 'node:module';
import snapshotSchema from '../../contracts/json-schema/presentation-render-snapshot.schema.json';
import manifestSchema from '../../contracts/json-schema/presentation-manifest.schema.json';
import generated from '../../apps/web/lib/generated-contracts.json';
import { validateContract } from '../../apps/web/lib/validation.ts';
import { manifestFromSnapshot } from '../../packages/domain/src/presentation.ts';
import { presentationFixture, presentationVersionFixture } from '../fixtures/presentation.ts';
const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { Ajv2020 } = require('ajv/dist/2020.js'); const addFormats = require('ajv-formats');

test('private immutable snapshot and closed public manifest agree without exposing captured storage destinations', () => {
  const ajv = new Ajv2020({ strict: false }); addFormats(ajv);
  const snapshot = presentationFixture({ logo: true }); const manifest = manifestFromSnapshot(snapshot);
  const privateCheck = ajv.compile(snapshotSchema); const publicCheck = ajv.compile(manifestSchema);
  assert.equal(privateCheck(snapshot), true, JSON.stringify(privateCheck.errors)); assert.equal(publicCheck(manifest), true, JSON.stringify(publicCheck.errors));
  assert.equal(publicCheck(snapshot), false); assert.equal(publicCheck({ ...manifest, asset_inventory: snapshot.asset_inventory }), false);
  const missingCategory = structuredClone(manifest); delete (missingCategory.slides[2] as Partial<typeof missingCategory.slides[number]>).role_category;
  assert.equal(publicCheck(missingCategory), false);
  assert.doesNotThrow(() => validateContract('PresentationVersion', presentationVersionFixture(snapshot)));
});
test('all self-contained version MCP response schemas match authoritative safe viewer definitions', async () => {
  const catalog = JSON.parse(await readFile('contracts/mcp-tool-catalog.json', 'utf8')) as { tools: { outputSchema?: { $defs?: Record<string, unknown> } }[] };
  const definitions = catalog.tools.flatMap(tool => tool.outputSchema?.$defs?.PresentationVersion ? [tool.outputSchema.$defs] : []);
  assert.ok(definitions.length >= 2);
  for (const defs of definitions) {
    assert.deepEqual(defs!.PresentationVersion, generated.$defs.PresentationVersion);
    assert.deepEqual(defs!.VersionSlide, generated.$defs.VersionSlide);
    assert.deepEqual(defs!.PresentationRenderContext, generated.$defs.PresentationRenderContext);
  }
});
