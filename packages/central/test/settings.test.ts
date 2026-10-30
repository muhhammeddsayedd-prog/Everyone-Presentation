import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DomainError } from '../../domain/src/types.ts';
import { parseSettingsPatch, settingsDto } from '../../domain/src/settings.ts';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralSettings } from '../src/settings.ts';

const principal = '7fb00000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const result = { template_version: '1.1.0', default_timezone: 'Africa/Cairo', default_review_expiry_days: 30, models: { specs: 'synthetic-configured-model' }, row_version: 2 };
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
function fixture(output: unknown = result, denied = false) {
  const calls: { name: string; args: unknown; requestId: string | null; clientType: string | null }[] = [];
  const fetcher: typeof fetch = async (supplied, init) => {
    const url = new URL(typeof supplied === 'string' ? supplied : supplied instanceof URL ? supplied.href : supplied.url);
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', is_anonymous: false });
    const headers = new Headers(init?.headers);
    calls.push({ name: url.pathname.split('/').at(-1)!, args: JSON.parse(String(init?.body)), requestId: headers.get('X-EPS-Request-ID'), clientType: headers.get('X-EPS-Client-Type') });
    return denied ? Response.json({ code: 'P0001', message: 'CAPABILITY_REQUIRED' }, { status: 403 }) : Response.json(output);
  };
  const client = createBearerUserClient({ url: 'https://synthetic-settings.example.invalid', publishableKey: 'sb_publishable_synthetic-settings', accessToken: token }, { fetch: fetcher });
  return { client, calls };
}

test('settings patch rejects hidden writes, invalid timezone/version, and unsafe row versions', () => {
  assert.deepEqual(parseSettingsPatch({ row_version: 1, default_timezone: 'Africa/Cairo', template_version: '1.1.0' }), { row_version: 1, default_timezone: 'Africa/Cairo', template_version: '1.1.0' });
  for (const input of [null, [], { row_version: 0 }, { row_version: Number.MAX_SAFE_INTEGER + 1 }, { row_version: 1, default_timezone: 'GMT+4' }, { row_version: 1, default_timezone: 'Etc/Invented' }, { row_version: 1, template_version: '' }, { row_version: 1, models: {} }, { row_version: 1, default_review_expiry_days: 99 }]) assert.throws(() => parseSettingsPatch(input), code('INVALID_REQUEST'));
});

test('settings central facade enforces acting identity and forwards stable idempotency and audit metadata', async () => {
  const fixtureValue = fixture(); const service = await createCentralSettings(fixtureValue.client);
  assert.deepEqual(await service.getSettings(actor), result);
  const patch = { row_version: 1, default_timezone: 'Africa/Cairo' };
  assert.deepEqual(await service.updateSettings(actor, patch, { idempotencyKey: 'synthetic-settings-stable-key', requestId: 'synthetic-request-1', clientType: 'mcp' }), result);
  assert.deepEqual(fixtureValue.calls, [
    { name: 'eps_get_settings', args: {}, requestId: null, clientType: null },
    { name: 'eps_update_settings', args: { p_input: patch, p_idempotency_key: 'synthetic-settings-stable-key' }, requestId: 'synthetic-request-1', clientType: 'mcp' },
  ]);
  await assert.rejects(service.getSettings({ principal_id: 'other' }), code('ACCESS_DENIED'));
  await assert.rejects(service.updateSettings(actor, patch), code('IDEMPOTENCY_KEY_REQUIRED'));
  assert.equal(fixtureValue.calls.length, 2);
});

test('settings response is closed, copied, bounded and never falls back on denied central access', async () => {
  const output = settingsDto(result); output.models.specs = 'local mutation'; assert.equal(result.models.specs, 'synthetic-configured-model');
  for (const invalid of [{ ...result, raw_config: 'private' }, { ...result, default_review_expiry_days: 7 }, { ...result, models: { specs: { secret: 'synthetic' } } }, { ...result, row_version: 0 }, { ...result, default_timezone: 'Nowhere/Invented' }]) {
    const service = await createCentralSettings(fixture(invalid).client); await assert.rejects(service.getSettings(actor), code('CENTRAL_RESPONSE_INVALID'));
  }
  const service = await createCentralSettings(fixture(result, true).client); await assert.rejects(service.getSettings(actor), code('CAPABILITY_REQUIRED'));
});

test('settings mutation rejects a response that does not acknowledge its expected revision and exact patch', async () => {
  for (const output of [{ ...result, row_version: 1 }, { ...result, default_timezone: 'Europe/London' }, { ...result, template_version: '1.0.0' }]) {
    const service = await createCentralSettings(fixture(output).client);
    await assert.rejects(service.updateSettings(actor, { row_version: 1, default_timezone: 'Africa/Cairo', template_version: '1.1.0' }, { idempotencyKey: 'synthetic-settings-intent-key' }), code('CENTRAL_RESPONSE_INVALID'));
  }
});
