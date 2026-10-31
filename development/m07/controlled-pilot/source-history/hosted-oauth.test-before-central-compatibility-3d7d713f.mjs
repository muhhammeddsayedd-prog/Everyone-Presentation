import assert from 'node:assert/strict';
import test from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import { URL } from 'node:url';
import { HOST, RESOURCE, ISSUER, PRM, DISCOVERY, publicOAuthPlan, publicMcpEnvironment, validateProviderProjection } from './hosted-oauth-plan.mjs';
import { probeHostedOAuth } from './hosted-oauth-readiness.mjs';
import { readMcpAuthConfig } from '../../../apps/web/lib/mcp-auth-config.ts';
const { Response } = globalThis;

// Every UUID/key/response here is synthetic; no request reaches a provider.
const CLIENT = 'ab100000-0000-4000-8000-000000000001';
const REQUEST = 'ab100000-0000-4000-8000-000000000002';
const publicJwk = { ...generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).publicKey.export({ format: 'jwk' }), alg: 'ES256', kid: 'synthetic' };
const privateHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const metadata = () => ({ issuer: ISSUER, authorization_endpoint: ISSUER + '/oauth/authorize', token_endpoint: ISSUER + '/oauth/token',
  jwks_uri: ISSUER + '/.well-known/jwks.json', response_types_supported: ['code'], code_challenge_methods_supported: ['S256'],
  grant_types_supported: ['authorization_code', 'refresh_token'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['openid'] });
const appError = (status, code) => Response.json({ request_id: REQUEST, error: { code, message: 'Safe error', details: {}, retryable: false } }, { status, headers: privateHeaders });
function synthetic(url, options, mode = 'ready') {
  const target = new URL(url);
  if (url === DISCOVERY) return Response.json(metadata());
  if (url === ISSUER + '/.well-known/jwks.json') return Response.json({ keys: [publicJwk] });
  if (url === PRM) return mode === 'disabled' ? Response.json({ error: 'not_found' }, { status: 404, headers: privateHeaders })
    : Response.json({ resource: RESOURCE, authorization_servers: [ISSUER], scopes_supported: ['openid'], resource_name: 'Everyone Presentation Studio' }, { headers: privateHeaders });
  if (target.pathname === '/.well-known/oauth-authorization-server') return mode === 'disabled' ? Response.json({ error: 'not_found' }, { status: 404, headers: privateHeaders }) : Response.json(metadata(), { headers: privateHeaders });
  if (target.pathname === '/mcp') {
    if (mode === 'disabled') return appError(503, 'MCP_AUTH_CONFIGURATION_REQUIRED');
    if (options.headers.Origin !== undefined && options.headers.Origin !== HOST) return Response.json({ error: 'access_denied', error_description: 'Safe' }, { status: 403, headers: privateHeaders });
    return Response.json({ error: options.headers.Authorization ? 'invalid_token' : 'invalid_request', error_description: 'Safe' }, {
      status: 401, headers: { ...privateHeaders, 'WWW-Authenticate': `Bearer resource_metadata="${PRM}"${options.headers.Authorization ? ', error="invalid_token"' : ''}` } });
  }
  if (target.pathname === '/api/oauth/authorization') return appError(options.headers.Origin === HOST ? 400 : 403, options.headers.Origin === HOST ? 'VALIDATION_FAILED' : 'ACCESS_DENIED');
  if (target.pathname === '/oauth/consent') return new Response('<!doctype html><title>Presentation Studio</title>', { headers: { ...privateHeaders, 'Content-Type': 'text/html' } });
  throw new Error('unexpected synthetic request');
}

test('public plan fixes hosted resource, provider fields, public client callback and contains no invented client ID', () => {
  const plan = publicOAuthPlan();
  assert.equal(plan.resource, HOST + '/mcp'); assert.equal(plan.consent_url, HOST + '/oauth/consent');
  assert.deepEqual(plan.provider_patch, { site_url: HOST, oauth_server_enabled: true, oauth_server_authorization_path: '/oauth/consent',
    oauth_server_allow_dynamic_registration: false, hook_custom_access_token_enabled: true, hook_custom_access_token_uri: 'pg-functions://postgres/eps/mcp_custom_access_token_hook' });
  assert.equal(plan.client_registration.client_type, 'public'); assert.equal(plan.client_registration.token_endpoint_auth_method, 'none');
  assert.deepEqual(plan.client_registration.redirect_uris, ['http://localhost:3118/callback']);
  assert.equal(plan.client_registration.client_name, 'Everyone Presentation Studio Hosted Pilot — Claude Code');
  assert.equal(plan.client_id, undefined); assert.equal(plan.configuration_applied, false);
});

test('MCP public environment requires a real supplied UUID shape and rejects substituted resource or credentials', () => {
  assert.deepEqual(publicMcpEnvironment(CLIENT), { MCP_AUTH_MODE: 'oauth', MCP_RESOURCE_URL: RESOURCE, MCP_AUTH_ISSUER: ISSUER, MCP_AUTH_CLIENT_IDS: CLIENT });
  for (const value of [undefined, '', 'private-sentinel', '00000000-0000-0000-0000-000000000000', CLIENT + ',' + CLIENT, { client_id: CLIENT }]) {
    assert.throws(() => publicMcpEnvironment(value), error => error.message === 'HOSTED_OAUTH_PUBLIC_PLAN_UNCONFIRMED');
  }
  assert.throws(() => publicMcpEnvironment(CLIENT, 'https://foreign.invalid/mcp'));
});

test('public environment interoperates with the actual hosted app MCP config parser', () => {
  const value = readMcpAuthConfig({ ...publicMcpEnvironment(CLIENT), NODE_ENV: 'production' },
    { adapterMode: 'supabase', environment: 'staging', baseUrl: HOST }, new URL(ISSUER).origin);
  assert.equal(value.mode, 'oauth'); assert.equal(value.resourceUrl, RESOURCE); assert.equal(value.issuer, ISSUER);
  assert.deepEqual(value.approvedClientIds, [CLIENT]);
});

test('provider projection accepts only the six explicit public fields and refuses unexpected secrets or another hook', () => {
  const expected = publicOAuthPlan().provider_patch;
  assert.equal(validateProviderProjection(expected), true);
  for (const changed of [{ ...expected, site_url: 'http://127.0.0.1:3000' }, { ...expected, oauth_server_enabled: 'true' },
    { ...expected, oauth_server_allow_dynamic_registration: true }, { ...expected, hook_custom_access_token_uri: 'https://foreign.invalid/hook' },
    { ...expected, hook_custom_access_token_secrets: 'private-sentinel' }]) {
    assert.throws(() => validateProviderProjection(changed), error => !error.message.includes('private-sentinel'));
  }
});

test('ready probe uses only fixed public endpoints, no valid authorization IDs, no token/authorize/decision requests', async () => {
  const seen = [];
  const report = await probeHostedOAuth('ready', async (url, options) => { seen.push({ url, options }); return synthetic(url, options); });
  assert.equal(report.result, 'passed'); assert.equal(seen.length, 11);
  for (const { url, options } of seen) {
    assert([HOST, ISSUER].includes(new URL(url).origin === new URL(ISSUER).origin ? ISSUER : new URL(url).origin));
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'manual');
    assert(!Object.keys(options.headers).some(key => key.toLowerCase() === 'cookie'));
    assert(!/\/oauth\/(?:authorize|token|register)|\/admin\//u.test(url));
    assert(!options.body?.includes(CLIENT));
    assert(!options.headers.Authorization || options.headers.Authorization === 'Bearer synthetic.invalid');
  }
  assert.equal(report.full_oauth_acceptance, false); assert.equal(report.provider_or_configuration_mutations, false);
});

test('disabled probe checks disabled application behavior without claiming the provider is disabled', async () => {
  const seen = [];
  const report = await probeHostedOAuth('disabled', async (url, options) => { seen.push(url); return synthetic(url, options, 'disabled'); });
  assert.equal(report.result, 'passed'); assert.equal(seen.length, 3); assert(seen.every(url => url.startsWith(HOST)));
  assert.equal(report.provider_configuration_observed, false);
});

test('wrong resource, foreign endpoint, DCR/offline access or private signing key cannot count as ready', async () => {
  const variants = [
    [PRM, () => Response.json({ resource: 'https://foreign.invalid/mcp', authorization_servers: [ISSUER], scopes_supported: ['openid'] }, { headers: privateHeaders })],
    [DISCOVERY, () => Response.json({ ...metadata(), token_endpoint: 'https://foreign.invalid/token' })],
    [HOST + '/.well-known/oauth-authorization-server', () => Response.json({ ...metadata(), registration_endpoint: ISSUER + '/oauth/register' }, { headers: privateHeaders })],
    [DISCOVERY, () => Response.json({ ...metadata(), scopes_supported: ['openid', 'offline_access'] })],
    [ISSUER + '/.well-known/jwks.json', () => Response.json({ keys: [{ kty: 'EC', alg: 'ES256', crv: 'P-256', kid: 'x', x: 'x', y: 'y', d: 'private-sentinel' }] })],
  ];
  for (const [selected, changed] of variants) {
    const report = await probeHostedOAuth('ready', async (url, options) => url === selected ? changed() : synthetic(url, options));
    assert.equal(report.result, 'failed'); assert.doesNotMatch(JSON.stringify(report), /private-sentinel|foreign/u);
  }
});

test('oversized, redirected, credential-setting and private diagnostic responses fail without reflecting payloads', async () => {
  const variants = [
    () => new Response('private-sentinel'.repeat(20_000), { headers: { 'Content-Type': 'application/json' } }),
    () => new Response(null, { status: 302, headers: { Location: 'https://foreign.invalid/private-sentinel' } }),
    () => Response.json({ ...metadata() }, { headers: { ...privateHeaders, 'Set-Cookie': 'private-sentinel' } }),
    () => { throw new Error('private-sentinel'); },
  ];
  for (const changed of variants) {
    const report = await probeHostedOAuth('ready', async (url, options) => url === HOST + '/.well-known/oauth-authorization-server' ? changed() : synthetic(url, options));
    assert.equal(report.result, 'failed'); assert.doesNotMatch(JSON.stringify(report), /private-sentinel|foreign/u);
  }
  const privateError = await probeHostedOAuth('ready', async (url, options) => new URL(url).pathname === '/api/oauth/authorization'
    ? Response.json({ request_id: REQUEST, error: { code: 'VALIDATION_FAILED', message: 'Safe', details: { token: 'private-sentinel' }, retryable: false } }, { status: 400, headers: privateHeaders }) : synthetic(url, options));
  assert.equal(privateError.result, 'failed'); assert.doesNotMatch(JSON.stringify(privateError), /private-sentinel/u);
});

test('invalid mode is refused before any request', async () => {
  let calls = 0;
  await assert.rejects(probeHostedOAuth('unknown', async () => { calls++; throw new Error(); }));
  assert.equal(calls, 0);
});

test('JWKS readiness requires importable signing material and rejects malformed EC or undersized RSA', async () => {
  const weakRsa = { ...generateKeyPairSync('rsa', { modulusLength: 1024 }).publicKey.export({ format: 'jwk' }), alg: 'RS256', kid: 'weak' };
  for (const key of [{ kty: 'EC', alg: 'ES256', crv: 'P-256', kid: 'bad', x: 'x', y: 'y' },
    { kty: 'RSA', alg: 'RS256', kid: 'bad', n: 'broken', e: 'broken' }, weakRsa]) {
    const report = await probeHostedOAuth('ready', async (url, options) => url === ISSUER + '/.well-known/jwks.json'
      ? Response.json({ keys: [key] }) : synthetic(url, options));
    assert.equal(report.result, 'failed');
  }
});
