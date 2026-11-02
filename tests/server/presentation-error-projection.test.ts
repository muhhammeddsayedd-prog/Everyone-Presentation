import assert from 'node:assert/strict';
import test from 'node:test';
import { createBearerUserClient } from '../../packages/central/src/client.ts';
import { createCentralPresentations } from '../../packages/central/src/presentation.ts';
import { DomainError } from '../../packages/domain/src/types.ts';
import { presentationId } from '../fixtures/presentation.ts';

const actor = { principal_id: presentationId(51) };
const input = { expected_workspace_row_version: 3, expected_draft_revision: 2, expected_input_fingerprint: 'a'.repeat(64) };
const metadata = { requestId: 'presentation-error-projection', clientType: 'api' as const, idempotencyKey: 'synthetic-stable-generation-key' };
const privateValue = 'PRIVATE_SQL_QUERY_HINT_AND_PERSONAL_PAYLOAD';

async function failure(error: Record<string, unknown>): Promise<DomainError> {
  const client = createBearerUserClient({ url: 'https://synthetic-central.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, { fetch: async request => {
    const pathname = new URL(request instanceof Request ? request.url : String(request)).pathname;
    if (pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
    assert.equal(pathname, '/rest/v1/rpc/eps_generate_version');
    return Response.json({ ...error, hint: privateValue, details: privateValue }, { status: 400 });
  } });
  const service = await createCentralPresentations(client, { storageOrigin: 'https://synthetic-central.invalid' });
  try { await service.generateVersion(actor, presentationId(1), input, metadata); } catch (caught) {
    assert(caught instanceof DomainError);
    assert(!JSON.stringify({ message: caught.message, details: caught.details }).includes(privateValue));
    return caught;
  }
  throw new Error('The synthetic central failure must not become accepted generation.');
}

test('presentation SQL semantic errors retain their static status and safe actionable message', async () => {
  for (const [code, status] of [['SNAPSHOT_INVALID', 503], ['ASSET_UNAVAILABLE', 503], ['LAYOUT_NOT_READY', 409], ['PRESENTATION_PROCESSING_UNAVAILABLE', 503], ['PDF_BUDGET_EXCEEDED', 503]] as const) {
    const result = await failure({ code: 'P0001', message: code });
    assert.equal(result.code, code); assert.equal(result.status, status);
    assert.notEqual(result.message, code); assert.deepEqual(result.details, {});
  }
});

test('unknown validated SQLSTATE and PostgREST codes survive while private provider values do not', async () => {
  for (const code of ['42702', 'PGRST999']) {
    const result = await failure({ code, message: privateValue });
    assert.equal(result.code, 'DEPENDENCY_UNAVAILABLE'); assert.equal(result.status, 503); assert.equal(result.retryable, true);
    assert.match(result.message, new RegExp(code, 'u')); assert.deepEqual(result.details, { database_code: code });
  }
});

test('malformed provider codes and unknown SQL messages remain private', async () => {
  for (const code of [privateValue, '42702\nPRIVATE', 'PGRST999-extra', null]) {
    const result = await failure({ code, message: privateValue });
    assert.equal(result.code, 'DEPENDENCY_UNAVAILABLE'); assert.deepEqual(result.details, {});
    assert(!result.message.includes('42702')); assert(!result.message.includes('PGRST999'));
  }
  const unknownRaised = await failure({ code: 'P0001', message: privateValue });
  assert.deepEqual(unknownRaised.details, { database_code: 'P0001' });
});

test('existing permission, session and conflict mappings remain unchanged', async () => {
  for (const [code, message, expected, status] of [
    ['42501', privateValue, 'CAPABILITY_REQUIRED', 403],
    ['P0001', 'ACCESS_DENIED', 'ACCESS_DENIED', 403],
    ['P0001', 'RESOURCE_NOT_FOUND', 'RESOURCE_NOT_FOUND', 404],
    ['PGRST301', privateValue, 'AUTH_REQUIRED', 401],
    ['23505', privateValue, 'RESOURCE_CONFLICT', 409],
  ] as const) {
    const result = await failure({ code, message }); assert.equal(result.code, expected); assert.equal(result.status, status); assert.deepEqual(result.details, {});
  }
});
