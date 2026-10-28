import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { readJson } from '../../apps/web/lib/http.ts';

test('JSON input rejects malformed UTF8 instead of silently changing supplied source text', async () => {
  const prefix = new TextEncoder().encode('{"source_text":"');
  const suffix = new TextEncoder().encode('"}');
  const bytes = new Uint8Array([...prefix, 0xc3, 0x28, ...suffix]);
  const request = new Request('https://studio.example/api/v1/workspaces/synthetic/specs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bytes,
  });
  await assert.rejects(readJson(request), (error: unknown) => error instanceof DomainError && error.status === 400 && error.code === 'VALIDATION_ERROR');
});
test('valid mixed-language JSON keeps supplied text unchanged', async () => {
  const source_text = 'نحتاج ثلاثة أشخاص\r\nRole: Waiter';
  const request = new Request('https://studio.example/api/v1/workspaces/synthetic/specs', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source_text }),
  });
  assert.deepEqual(await readJson(request), { source_text });
});
