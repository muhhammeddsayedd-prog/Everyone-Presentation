import assert from 'node:assert/strict';
import test from 'node:test';
import { unzipSync, strFromU8 } from 'fflate';
import type { Actor } from '@eps/domain';
import type { PresentationOperations, PresentationVersion } from '../../packages/domain/src/presentation-types.ts';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { composeCastingDeck } from '../../packages/templates/versions/1.2.0/compose-casting.ts';
import { imageSize } from '../../packages/templates/versions/1.2.0/pptx.ts';
import { versionPptx, PPTX_MIME } from '../../apps/web/lib/presentation-pptx.ts';
import { presentationVersionFixture } from '../fixtures/presentation.ts';
import { editorialPresentation } from '../fixtures/editorial-snapshot.ts';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createStudioMcpServer, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';
import { presentationId } from '../fixtures/presentation.ts';

const actor = { id: 'synthetic-actor' } as unknown as Actor;
const mcpActor = { principal_id: presentationId(52) };
function service(version: PresentationVersion, images: Map<string, Uint8Array>, mimes: Map<string, string>, reads: string[] = []) {
  return {
    getVersion: async (_actor: Actor, id: string) => { assert.equal(id, version.id); return version; },
    getVersionMediaContent: async (_actor: Actor, id: string, asset: string) => { assert.equal(id, version.id); reads.push(asset); return { bytes: images.get(asset)!, mimeType: mimes.get(asset)! }; },
  } as unknown as PresentationOperations;
}
function ready() {
  const { snapshot, images } = editorialPresentation(); const version = { ...presentationVersionFixture(snapshot), status: 'ready' as const };
  return { snapshot, images, version, mimes: new Map(snapshot.asset_inventory.map(asset => [asset.asset_id, asset.mime_type])) };
}

test('editable PowerPoint: 13.333×7.5 in, one native slide per composed page, real text, separate images and video links', async () => {
  const { snapshot, images, version, mimes } = ready(); const reads: string[] = [];
  const { bytes, filename } = await versionPptx(actor, version.id, service(version, images, mimes, reads), 'https://studio.example.invalid');
  assert.match(filename, /\.pptx$/u); assert.equal(PPTX_MIME, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  const files = unzipSync(bytes); const deck = composeCastingDeck(reviewFromRenderSnapshot(snapshot));
  const slides = Object.keys(files).filter(name => /^ppt\/slides\/slide\d+\.xml$/u.test(name)).sort((a, b) => Number(a.match(/\d+/u)) - Number(b.match(/\d+/u)));
  assert.equal(slides.length, deck.pages.length);
  assert.match(strFromU8(files['ppt/presentation.xml']), /<p:sldSz cx="12192000" cy="6858000"/u);
  const xml = slides.map(name => strFromU8(files[name]));
  // Editable: every page has native text runs; no slide is a single full-bleed picture.
  for (const slide of xml) assert.match(slide, /<a:t>/u);
  assert.ok(xml.every(slide => !/<p:pic>[\s\S]*<a:off x="0" y="0"\/>\s*<a:ext cx="12192000" cy="6858000"\/>/u.test(slide)));
  assert.match(xml[2], /Cast Selection\./u); assert.match(xml.join(''), /THANK YOU!/u);
  assert.match(xml.join(''), /typeface="General Sans Semibold"/u); assert.match(xml.join(''), /typeface="General Sans Light"/u);
  const pictures = xml.reduce((sum, slide) => sum + (slide.match(/<p:pic>/gu) ?? []).length, 0);
  const expectedPictures = deck.pages.reduce((sum, page) => sum + page.elements.filter(element => element.kind === 'image').length, 0);
  assert.equal(pictures, expectedPictures);
  const rels = Object.keys(files).filter(name => /^ppt\/slides\/_rels\/slide\d+\.xml\.rels$/u.test(name)).map(name => strFromU8(files[name])).join('');
  assert.equal((rels.match(/presentations\/versions\/[^"]+\/media\//gu) ?? []).length, 4);
  // Highlighted notes are native text highlight, not a drawn banner.
  assert.match(xml.join(''), /<a:highlight><a:srgbClr val="FFFB00"\/><\/a:highlight>/u);
  assert.deepEqual([...new Set(reads)].sort(), [...new Set(deck.pages.flatMap(page => page.elements.flatMap(element => element.kind === 'image' && element.source.type === 'asset' ? [element.source.asset_id] : [])))].sort());
});

test('PowerPoint is refused for unfinished versions and for retained 1.0/1.1 templates', async () => {
  const { images, version, mimes } = ready();
  await assert.rejects(versionPptx(actor, version.id, service({ ...version, status: 'rendering' }, images, mimes), 'https://studio.example.invalid'), { code: 'PRESENTATION_NOT_READY' });
  const legacy = structuredClone(version); legacy.render_context.template.version = '1.1.0';
  await assert.rejects(versionPptx(actor, version.id, service(legacy, images, mimes), 'https://studio.example.invalid'), { code: 'PPTX_TEMPLATE_UNSUPPORTED' });
});

test('Claude/MCP download_version_pptx builds under the acting user and returns only the signed-in in-app link', async () => {
  const { images, version, mimes } = ready(); const reads: string[] = []; const acting: unknown[] = [];
  const base = service(version, images, mimes, reads) as unknown as Record<string, (...args: unknown[]) => unknown>;
  const presentation = { getVersion: (...args: unknown[]) => { acting.push(args[0]); return base.getVersion(...args); },
    getVersionMediaContent: (...args: unknown[]) => { acting.push(args[0]); return base.getVersionMediaContent(...args); } } as unknown as PresentationOperations;
  const services = { presentation, studio: syntheticMcpStudio(mcpActor.principal_id) } as unknown as McpServices;
  const server = createStudioMcpServer(mcpActor, services); const client = new Client({ name: 'eps-pptx-protocol', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tool = (await client.listTools()).tools.find(item => item.name === 'download_version_pptx'); assert.ok(tool, 'tool advertised');
    const result = await client.callTool({ name: 'download_version_pptx', arguments: { version_id: version.id } }); assert.equal(result.isError, undefined);
    type Schema = Parameters<AjvJsonSchemaValidator['getValidator']>[0];
    assert.equal(new AjvJsonSchemaValidator().getValidator(tool.outputSchema as Schema)(result.structuredContent).valid, true);
    const data = (result.structuredContent as { data: Record<string, unknown> }).data;
    const deck = composeCastingDeck(reviewFromRenderSnapshot(editorialPresentation().snapshot));
    assert.equal(data.download_url, `http://127.0.0.1:3000/api/v1/versions/${version.id}/pptx/content`); assert.equal(data.access, 'signed_in_session');
    assert.equal(data.slide_count, deck.pages.length); assert.equal(data.template_version, '1.2.0'); assert.ok((data.size_bytes as number) > 10_000);
    assert.ok(acting.length > 1 && acting.every(item => item === mcpActor), 'every read acts as the MCP user');
    // Retained templates and unfinished versions are refused with their domain codes.
    const legacy = structuredClone(version); legacy.render_context.template.version = '1.1.0';
    const refused = await invokeMcpTool('download_version_pptx', { version_id: version.id }, mcpActor, { ...services, presentation: service(legacy, images, mimes) });
    assert.equal((refused.structuredContent as { error: { code: string } }).error.code, 'PPTX_TEMPLATE_UNSUPPORTED');
    const pending = await invokeMcpTool('download_version_pptx', { version_id: version.id }, mcpActor, { ...services, presentation: service({ ...version, status: 'rendering' }, images, mimes) });
    assert.equal((pending.structuredContent as { error: { code: string } }).error.code, 'PRESENTATION_NOT_READY');
  } finally { await client.close(); await server.close(); }
});

test('image header sizes match the frozen inventory for PNG and JPEG', () => {
  const { snapshot, images } = ready();
  for (const asset of snapshot.asset_inventory.filter(item => images.has(item.asset_id))) assert.deepEqual(imageSize(images.get(asset.asset_id)!), [asset.width, asset.height]);
  assert.throws(() => imageSize(new Uint8Array([1, 2, 3, 4, 5, 6])), /PPTX_IMAGE_UNSUPPORTED/u);
});
