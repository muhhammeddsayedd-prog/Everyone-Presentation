/** Fixed public hosted probes. Importing performs no I/O. No OAuth authorization,
 * details, approval, token, login, valid selector or configuration request. */
import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL, URL } from 'node:url';
import { TextDecoder } from 'node:util';
import { HOST, RESOURCE, ISSUER, PRM, DISCOVERY } from './hosted-oauth-plan.mjs';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const exact = (value, keys) => object(value) && Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const require = value => { if (!value) throw new Error('HOSTED_OAUTH_READINESS_UNCONFIRMED'); };
const has = (value, item) => Array.isArray(value) && value.every(x => typeof x === 'string' && x.length <= 256) && value.includes(item);

async function boundedBody(response) {
  const reader = response.body?.getReader(); require(reader);
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (size > 256 * 1024) { await reader.cancel(); throw new Error('HOSTED_OAUTH_READINESS_UNCONFIRMED'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}
function parseJson(response, body) {
  require(response.headers.get('content-type')?.split(';')[0].toLowerCase() === 'application/json');
  return JSON.parse(body);
}
function metadata(value, mirror) {
  require(object(value) && value.issuer === ISSUER && value.authorization_endpoint === ISSUER + '/oauth/authorize'
    && value.token_endpoint === ISSUER + '/oauth/token' && value.jwks_uri === ISSUER + '/.well-known/jwks.json'
    && has(value.response_types_supported, 'code') && has(value.code_challenge_methods_supported, 'S256')
    && has(value.scopes_supported, 'openid')
    && has(value.grant_types_supported, 'authorization_code') && has(value.grant_types_supported, 'refresh_token')
    && has(value.token_endpoint_auth_methods_supported, 'none'));
  if (mirror) require(value.registration_endpoint === undefined && value.scopes_supported.length === 1);
}
function appError(value, code) {
  require(exact(value, ['request_id', 'error']) && typeof value.request_id === 'string' && UUID.test(value.request_id)
    && exact(value.error, ['code', 'message', 'details', 'retryable']) && value.error.code === code
    && typeof value.error.message === 'string' && value.error.message.length <= 2000 && exact(value.error.details, []) && value.error.retryable === false);
}
function publicKeys(value) {
  require(exact(value, ['keys']) && Array.isArray(value.keys) && value.keys.length > 0 && value.keys.length <= 10);
  const allowed = new Set(['kty', 'alg', 'crv', 'kid', 'x', 'y', 'n', 'e', 'use', 'key_ops', 'ext']);
  for (const key of value.keys) {
    require(object(key) && Object.keys(key).every(name => allowed.has(name)) && typeof key.kid === 'string'
      && /^[A-Za-z0-9_-]{1,200}$/u.test(key.kid));
    require(key.kty === 'EC' && key.alg === 'ES256' && key.crv === 'P-256' && typeof key.x === 'string' && typeof key.y === 'string'
      || key.kty === 'RSA' && key.alg === 'RS256' && typeof key.n === 'string' && typeof key.e === 'string');
    require((key.ext === undefined || typeof key.ext === 'boolean') && (key.use === undefined || key.use === 'sig') && (key.key_ops === undefined || Array.isArray(key.key_ops) && key.key_ops.length === 1 && key.key_ops[0] === 'verify'));
    const imported = createPublicKey({ key, format: 'jwk' });
    require(imported.type === 'public' && (key.kty === 'EC' && imported.asymmetricKeyType === 'ec' && imported.asymmetricKeyDetails?.namedCurve === 'prime256v1'
      || key.kty === 'RSA' && imported.asymmetricKeyType === 'rsa' && imported.asymmetricKeyDetails?.modulusLength >= 2048));
  }
}

export async function probeHostedOAuth(mode, fetcher = globalThis.fetch) {
  require(mode === 'disabled' || mode === 'ready');
  const checks = [];
  const overall = globalThis.AbortSignal.timeout(90_000);
  async function check(label, url, status, validate, { method = 'GET', headers = {}, body, privateResponse = true } = {}) {
    const entry = { label, status: null, expected_status: status, passed: false };
    checks.push(entry);
    try {
      const response = await fetcher(url, { method, headers: { Accept: 'application/json', ...headers }, body,
        credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: globalThis.AbortSignal.any([overall, globalThis.AbortSignal.timeout(8000)]) });
      entry.status = response.status;
      if (response.status !== status || response.redirected || response.url && response.url !== url || response.headers.has('set-cookie')) {
        await response.body?.cancel(); return;
      }
      if (privateResponse) require(/\bno-store\b/u.test(response.headers.get('cache-control') ?? ''));
      const text = await boundedBody(response);
      validate(response, text);
      entry.passed = true;
    } catch { /* Never reflect response text, headers, cookies or transport diagnostics. */ }
  }
  const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'Studio-public-hosted-readiness', version: '1' } } });
  const initOptions = { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Origin: HOST, 'MCP-Protocol-Version': '2026-07-28' }, body: init };
  const notFound = (r, text) => { const v = parseJson(r, text); require(exact(v, ['error']) && v.error === 'not_found'); };
  if (mode === 'disabled') {
    await check('protected-resource-disabled', PRM, 404, notFound);
    await check('mirror-disabled', HOST + '/.well-known/oauth-authorization-server', 404, notFound);
    await check('mcp-disabled', RESOURCE, 503, (r, text) => appError(parseJson(r, text), 'MCP_AUTH_CONFIGURATION_REQUIRED'), initOptions);
  } else {
    await check('central-discovery', DISCOVERY, 200, (r, text) => metadata(parseJson(r, text), false), { privateResponse: false });
    await check('protected-resource', PRM, 200, (r, text) => {
      const v = parseJson(r, text);
      require(object(v) && v.resource === RESOURCE && JSON.stringify(v.authorization_servers) === JSON.stringify([ISSUER]) && JSON.stringify(v.scopes_supported) === '["openid"]');
    });
    await check('mirror-discovery', HOST + '/.well-known/oauth-authorization-server', 200, (r, text) => metadata(parseJson(r, text), true));
    await check('central-public-jwks', ISSUER + '/.well-known/jwks.json', 200, (r, text) => publicKeys(parseJson(r, text)), { privateResponse: false });
    const challenge = (r, text) => { parseJson(r, text); const header = r.headers.get('www-authenticate') ?? ''; require(header.startsWith('Bearer ') && header.includes(`resource_metadata="${PRM}"`)); };
    await check('unauthenticated-mcp-post', RESOURCE, 401, challenge, initOptions);
    await check('unauthenticated-mcp-get', RESOURCE, 401, challenge);
    await check('synthetic-invalid-bearer', RESOURCE, 401, (r, text) => { challenge(r, text); require((r.headers.get('www-authenticate') ?? '').includes('error="invalid_token"')); },
      { ...initOptions, headers: { ...initOptions.headers, Authorization: 'Bearer synthetic.invalid' } });
    await check('cross-origin-mcp-denial', RESOURCE, 403, (r, text) => require(parseJson(r, text).error === 'access_denied'),
      { ...initOptions, headers: { ...initOptions.headers, Origin: 'http://localhost:3118' } });
    await check('invalid-consent-selector', HOST + '/api/oauth/authorization', 400, (r, text) => appError(parseJson(r, text), 'VALIDATION_FAILED'),
      { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: HOST }, body: JSON.stringify({ authorization_id: 'not-a-uuid', request_id: randomUUID(), action: 'details' }) });
    await check('cross-origin-consent-denial', HOST + '/api/oauth/authorization', 403, (r, text) => appError(parseJson(r, text), 'ACCESS_DENIED'),
      { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3118' }, body: '{}' });
    await check('consent-html', HOST + '/oauth/consent', 200, (r, text) => require(r.headers.get('content-type')?.startsWith('text/html') && /<title>[^<]*Presentation Studio[^<]*<\/title>/u.test(text)), { headers: { Accept: 'text/html' } });
  }
  return { schema_version: '1.0', host: HOST, resource: RESOURCE, mode, result: checks.every(x => x.passed) ? 'passed' : 'failed', checks,
    provider_configuration_observed: false, provider_or_configuration_mutations: false, full_oauth_acceptance: false,
    scope: 'Public fixed-origin discovery, denied MCP requests and malformed consent input only. No signed-in core, client registration/binding, login, refresh or revocation proof.',
    redirects_followed: false, cookies_or_valid_credentials_sent: false, valid_authorization_selector_sent: false,
    claude_configuration_login_or_model_call: false, raw_payload_headers_or_diagnostics_recorded: false };
}

async function main() {
  require(process.argv.length === 3);
  const started = new Date().toISOString();
  const report = { ...await probeHostedOAuth(process.argv[2]), started_at: started, finished_at: new Date().toISOString() };
  report.sources = {};
  for (const name of ['hosted-oauth-plan.mjs', 'hosted-oauth-readiness.mjs']) {
    report.sources[name] = createHash('sha256').update(await readFile(new URL(name, import.meta.url))).digest('hex');
  }
  const area = path.resolve(import.meta.dirname, '../../../tracking/evidence/m07/controlled-pilot'); await mkdir(area, { recursive: true });
  const name = started.replace(/[:.]/gu, '-') + '-' + randomUUID().slice(0, 8) + '-hosted-oauth-' + report.mode + '.json';
  await writeFile(path.join(area, name), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ result: report.result, mode: report.mode, receipt: 'tracking/evidence/m07/controlled-pilot/' + name, checks: report.checks.length }) + '\n');
  if (report.result !== 'passed') process.exitCode = 1;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(() => {
  process.stderr.write('HOSTED_OAUTH_READINESS_UNCONFIRMED\n'); process.exitCode = 1;
});
