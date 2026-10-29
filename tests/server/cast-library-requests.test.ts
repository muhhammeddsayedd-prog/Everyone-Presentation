import assert from 'node:assert/strict';
import test from 'node:test';
import { createCastLibraryRequests } from '../../apps/web/lib/cast-library-requests.ts';

function deferred<T>() {
  let resolve!: (value: T) => void; let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('late old search results and cursors cannot overwrite the newer filter response even if transport ignores abort', async () => {
  const requests = createCastLibraryRequests(); let shown = ''; let cursor = '';
  async function read(result: ReturnType<typeof deferred<{ value: string; cursor: string }>>) {
    const request = requests.start(); const response = await result.promise;
    if (request.isCurrent()) { shown = response.value; cursor = response.cursor; }
    return request;
  }
  const first = deferred<{ value: string; cursor: string }>(); const second = deferred<{ value: string; cursor: string }>();
  const older = read(first); const newer = read(second);
  second.resolve({ value: 'new filter', cursor: 'new cursor' }); await newer;
  first.resolve({ value: 'old filter', cursor: 'old cursor' }); const old = await older;
  assert.equal(old.signal.aborted, true); assert.equal(shown, 'new filter'); assert.equal(cursor, 'new cursor');
});

test('obsolete failure/finally cannot clear a newer loading state or replace its error', async () => {
  const requests = createCastLibraryRequests(); let loading = false; let error = '';
  async function read(result: ReturnType<typeof deferred<void>>) {
    const request = requests.start(); loading = true;
    try { await result.promise; }
    catch { if (request.isCurrent()) error = 'current request failed'; }
    finally { if (request.isCurrent()) loading = false; }
  }
  const first = deferred<void>(); const second = deferred<void>(); const older = read(first); const newer = read(second);
  first.reject(new Error('old filter failed')); await older;
  assert.equal(loading, true); assert.equal(error, '');
  second.resolve(); await newer; assert.equal(loading, false);
});

test('filter debounce cleanup and unmount abort invalidate in-flight work; a later mount can start fresh', async () => {
  const requests = createCastLibraryRequests(); const first = requests.start(); let updated = false;
  const response = deferred<void>(); const completion = response.promise.then(() => { if (first.isCurrent()) updated = true; });
  requests.cancel(); response.resolve(); await completion;
  assert.equal(first.signal.aborted, true); assert.equal(updated, false);
  const fresh = requests.start(); assert.equal(fresh.isCurrent(), true); requests.cancel(); assert.equal(fresh.isCurrent(), false);
});
