import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/client/validators/ajv';
import { createStudioMcpServer, type McpServices } from '../../apps/web/lib/mcp.ts';
import { handleGuestReviewRequest } from '../../apps/web/lib/guest-http.ts';
import { handlePresentationRequest } from '../../apps/web/lib/presentation-http.ts';
import { validateContract } from '../../apps/web/lib/validation.ts';
import type { GuestReviewOperations } from '../../packages/domain/src/guest-types.ts';
import type { PresentationOperations, VersionMediaPlayback } from '../../packages/domain/src/presentation-types.ts';
import { presentationId } from '../fixtures/presentation.ts';

const version = presentationId(1), asset = presentationId(10), actor = { principal_id: presentationId(51) };
const origin = 'http://127.0.0.1:3000', context = { requestId: 'transcript-http' }, credential = Buffer.alloc(32, 8).toString('base64url');
const text = 'نص مصدر\nEnglish <script>literal</script>';
const transcript = { version_id: version, asset_id: asset, status: 'available' as const, original_text: text, languages: ['Arabic', 'English'],
  source_kind: 'source_transcript' as const, source_sha256: createHash('sha256').update(text).digest('hex') };
const playback: VersionMediaPlayback = { asset_id: asset, source_version_id: version, url: `${origin}/synthetic/video`,
  expires_at: '2026-11-01T00:00:00Z', mime_type: 'video/mp4', transcript };
const internal = { async playVersionMedia(given: unknown, v: string, a: string) { assert.deepEqual(given, actor); assert.equal(v, version); assert.equal(a, asset); return playback; } } as unknown as PresentationOperations;
const guest = { async playMedia(raw: string, v: string, a: string) { assert.equal(raw, credential); assert.equal(v, version); assert.equal(a, asset); return playback; },
  async playGrantMedia(raw: string, v: string, a: string) { assert.equal(raw, credential); assert.equal(v, version); assert.equal(a, asset); return playback; } } as unknown as GuestReviewOperations;

test('existing internal, guest and PDF-grant HTTP playback preserve one closed companion without new routes', async () => {
  const segments = ['versions', version, 'media', asset, 'playback'];
  const request = (path: string[], header = {}) => new Request(`${origin}/api/v1/${path.join('/')}`, { method: 'POST', headers: { host: '127.0.0.1:3000', ...header } });
  const responses = [await handlePresentationRequest(request(segments), segments, actor, internal, context)];
  for (const [path, header] of [[['review', 'versions', version, 'media', asset], { 'X-Review-Session': credential }],
    [['review-media', 'versions', version, 'media', asset, 'playback'], { 'X-Media-Grant': credential }]] as const)
    responses.push(await handleGuestReviewRequest(request([...path], header), [...path], guest, context, { origin, rateLimit: () => {} }));
  for (const response of responses) {
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control')!, /no-store/u);
    const body = await response.json(); assert.deepEqual(body.data, playback); validateContract('VersionMediaPlayback', body.data);
    assert.ok(!JSON.stringify(body).includes(credential));
  }
});

test('official MCP playback output schema includes exactly the same optional source companion', async () => {
  const server = createStudioMcpServer(actor, { presentation: internal } as unknown as McpServices);
  const client = new Client({ name: 'eps-transcript-contract', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair(); await server.connect(a); await client.connect(b);
  try {
    const tool = (await client.listTools()).tools.find(tool => tool.name === 'play_version_media')!;
    const output = await client.callTool({ name: 'play_version_media', arguments: { version_id: version, asset_id: asset } });
    assert.equal(output.isError, undefined); assert.deepEqual((output.structuredContent as { data: unknown }).data, playback);
    const check = new AjvJsonSchemaValidator().getValidator(tool.outputSchema!);
    assert.equal(check(output.structuredContent).valid, true);
    assert.equal(check({ ...(output.structuredContent as object), data: { ...playback, transcript: { ...transcript, internal_note: 'private' } } }).valid, false);
  } finally { await client.close(); await server.close(); }
});

test('generated closed schemas distinguish available source, legacy absence and incompatible private fields', () => {
  validateContract('VersionTranscriptCompanion', transcript);
  const legacy = { ...transcript, status: 'not_captured', original_text: null, source_sha256: null, languages: [] };
  validateContract('VersionMediaPlayback', { ...playback, transcript: legacy });
  validateContract('VersionMediaPlayback', { ...playback, transcript: undefined });
  for (const change of [{ original_text: 'leaked live text' }, { languages: ['inferred'] }, { source_sha256: 'a'.repeat(64) }])
    assert.throws(() => validateContract('VersionMediaPlayback', { ...playback, transcript: { ...legacy, ...change } }));
  assert.throws(() => validateContract('VersionMediaPlayback', { ...playback, transcript: { ...transcript, review_status: 'reviewed' } }));
});
