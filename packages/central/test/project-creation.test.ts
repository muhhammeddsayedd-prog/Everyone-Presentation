import test from 'node:test';
import assert from 'node:assert/strict';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralStudio } from '../src/studio.ts';
import { projectDto } from '../src/dto.ts';

const actor = { principal_id: '10000000-0000-4000-8000-000000000001' };
const project = { id: '20000000-0000-4000-8000-000000000001', name: 'A real project', client_id: null,
  client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };

test('project DTO accepts legacy and explicit intent, rejects malformed or unannounced fields', () => {
  assert.deepEqual(projectDto(project), project);
  assert.equal(projectDto({ ...project, presentation_type: 'wardrobe' }).presentation_type, 'wardrobe');
  for (const value of [{ ...project, presentation_type: null }, { ...project, presentation_type: 'unpublished' }, { ...project, principal_id: actor.principal_id }]) {
    assert.throws(() => projectDto(value), { code: 'CENTRAL_RESPONSE_INVALID' });
  }
});

test('canonical create sends normalized input, verified user and stable key; rejects wrong result scope', async () => {
  const calls: { name: string; input: unknown }[] = [];
  let reply = { ...project, presentation_type: 'casting' };
  const client = createBearerUserClient({ url: 'https://synthetic-project.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-user-token' }, {
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === '/auth/v1/user') return Response.json({ id: actor.principal_id, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-user-token');
      calls.push({ name: url.pathname.split('/').at(-1)!, input: JSON.parse(String(init?.body)) });
      return Response.json(reply);
    },
  });
  const studio = await createCentralStudio(client);
  const input = { name: '  A real project  ', presentation_type: 'casting' as const }, context = { idempotencyKey: 'synthetic-create-project-key' };
  assert.equal((await studio.createProject(actor, input, context)).id, project.id);
  assert.deepEqual(calls[0], { name: 'eps_create_project', input: { p_input: { ...input, name: 'A real project' }, p_idempotency_key: context.idempotencyKey } });
  reply = { ...reply, presentation_type: 'wardrobe' };
  await assert.rejects(studio.createProject(actor, input, context), { code: 'CENTRAL_RESPONSE_INVALID' });
  await assert.rejects(studio.createProject(actor, { ...input, principal_id: actor.principal_id } as typeof input, context), { code: 'VALIDATION_FAILED' });
  assert.equal(calls.length, 2);
});
