import assert from 'node:assert/strict';
import test from 'node:test';
import { readCandidateMedia, readDuplicateMatches } from '../../apps/web/components/candidate-pages.ts';

test('candidate UI reads every page, preserves the selected source beyond the first page and passes cancellation', async () => {
  const original = globalThis.fetch; const paths: string[] = []; const controller = new AbortController();
  globalThis.fetch = async (input, init) => {
    assert.equal(init?.signal, controller.signal); const url = new URL(String(input), 'http://127.0.0.1'); paths.push(url.pathname + url.search);
    assert.equal(url.searchParams.get('limit'), '100');
    return Response.json({ request_id: 'synthetic', data: [{ id: url.searchParams.has('cursor') ? 'selected-source' : 'first-source' }],
      page: { next_cursor: url.searchParams.has('cursor') ? null : 'opaque+cursor' } });
  };
  try {
    const result = await readCandidateMedia('candidate/opaque', { signal: controller.signal });
    assert.deepEqual(result.data.map(row => row.id), ['first-source', 'selected-source']);
    assert.equal(paths.length, 2); assert.match(paths[0], /candidate%2Fopaque\/media/u); assert.match(paths[1], /cursor=opaque%2Bcursor/u);
  } finally { globalThis.fetch = original; }
});

test('duplicate UI consumes identity-keyed pages and rejects missing page metadata, repeated cursors and rows', async () => {
  const original = globalThis.fetch;
  try {
    let calls = 0;
    globalThis.fetch = async () => Response.json({ request_id: 'synthetic', data: [{ candidate_id: `duplicate-${++calls}` }], page: { next_cursor: calls === 1 ? 'next' : null } });
    assert.deepEqual((await readDuplicateMatches('candidate')).data.map(row => row.candidate_id), ['duplicate-1', 'duplicate-2']);
    for (const pages of [
      [{ data: [], request_id: 'missing' }],
      [{ data: [{ id: 'a' }], page: { next_cursor: 'same' } }, { data: [{ id: 'b' }], page: { next_cursor: 'same' } }],
      [{ data: [{ id: 'a' }], page: { next_cursor: 'next' } }, { data: [{ id: 'a' }], page: { next_cursor: null } }],
      [{ data: [], page: { next_cursor: 'next' } }],
    ]) {
      let index = 0; globalThis.fetch = async () => Response.json(pages[index++]);
      await assert.rejects(readCandidateMedia('candidate'), /could not be read completely/u);
    }
  } finally { globalThis.fetch = original; }
});

test('candidate UI abort and later-page error never return a silently truncated successful list', async () => {
  const original = globalThis.fetch; const controller = new AbortController(); let calls = 0;
  try {
    globalThis.fetch = async () => { calls++; controller.abort(); return Response.json({ request_id: 'first', data: [{ id: 'a' }], page: { next_cursor: 'next' } }); };
    await assert.rejects(readCandidateMedia('candidate', { signal: controller.signal }), error => error instanceof Error && error.name === 'AbortError');
    assert.equal(calls, 1);
    calls = 0; globalThis.fetch = async () => ++calls === 1 ? Response.json({ request_id: 'first', data: [{ id: 'a' }], page: { next_cursor: 'next' } })
      : Response.json({ request_id: 'denied', error: { code: 'CAPABILITY_REQUIRED', message: 'Access changed.' } }, { status: 403 });
    await assert.rejects(readCandidateMedia('candidate'), /Access changed/u);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});
