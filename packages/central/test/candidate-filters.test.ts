import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralCandidateFilters } from '../src/candidate-filters.ts';

const principal = '7fa00000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const result = { role_id: 'role', include_unknown: true, suggested_filters: [
  { field: 'language', value: 'العربية', source_field: 'requirements.languages[0]' },
], explanations: ['Change or clear any filter.'] };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
function fixture(output: unknown = result, denied = false) {
  const calls: { name: string; args: unknown }[] = [];
  const fetcher: typeof fetch = async (supplied, init) => {
    const url = new URL(typeof supplied === 'string' ? supplied : supplied instanceof URL ? supplied.href : supplied.url);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', is_anonymous: false });
    calls.push({ name: url.pathname.split('/').at(-1)!, args: JSON.parse(String(init?.body)) });
    return denied ? Response.json({ code: 'P0001', message: 'CAPABILITY_REQUIRED' }, { status: 403 }) : Response.json(output);
  };
  const client = createBearerUserClient({ url: 'https://synthetic-filters.example.invalid', publishableKey: 'sb_publishable_synthetic-filters', accessToken: token }, { fetch: fetcher });
  return { client, calls };
}

test('suggestion service uses one authoritative same-user RPC and returns an isolated strict DTO', async () => {
  const value = fixture(); const service = await createCentralCandidateFilters(value.client);
  const data = await service.suggestCandidateFilters(actor, 'role');
  assert.deepEqual(data, result);
  assert.deepEqual(value.calls, [{ name: 'eps_suggest_candidate_filters', args: { p_role_id: 'role' } }]);
  data.suggested_filters[0].value = 'edited locally';
  assert.equal(result.suggested_filters[0].value, 'العربية');
  await assert.rejects(service.suggestCandidateFilters({ principal_id: 'other' }, 'role'), code('ACCESS_DENIED'));
  await assert.rejects(service.suggestCandidateFilters(actor, ''), code('INVALID_REQUEST'));
  assert.equal(value.calls.length, 1);
});

test('denied current access never falls back to cached or inferred filters', async () => {
  const value = fixture(result, true); const service = await createCentralCandidateFilters(value.client);
  await assert.rejects(service.suggestCandidateFilters(actor, 'role'), code('CAPABILITY_REQUIRED'));
  assert.equal(value.calls.length, 1);
});

test('central filters reject cross-role, hidden source, unsupported field and forged source-path responses', async () => {
  for (const invalid of [{ ...result, role_id: 'other' }, { ...result, raw_source: 'private payload' },
    { ...result, suggested_filters: [{ field: 'city', value: 'Cairo', source_field: 'requirements.location' }] },
    { ...result, suggested_filters: [{ field: 'classification', value: 'Featured', source_field: 'name' }] },
  ]) {
    const service = await createCentralCandidateFilters(fixture(invalid).client);
    await assert.rejects(service.suggestCandidateFilters(actor, 'role'), code('CENTRAL_RESPONSE_INVALID'));
  }
});
