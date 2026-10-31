/** Negative-only discovery: anonymous execution must stop before any claim. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, relative } from 'node:path';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const target = 'pyibofyctwnqpvktepse';
const need = value => { if (!value) throw new Error('ANONYMOUS_RPC_PROBE_UNCONFIRMED'); };

async function main() {
  need(process.argv.length === 2);
  for (const key of Object.keys(process.env)) if (key.toUpperCase().includes('DEBUG')) delete process.env[key];
  need((await readFile(resolve(root, 'supabase/.temp/project-ref'), 'utf8')).trim() === target);
  const environment = parseEnv(await readFile(resolve(root, 'apps/web/.env.local'), 'utf8'));
  const { readCentralConfig } = await import('../../../packages/central/src/config.ts');
  const config = readCentralConfig(environment);
  need(config.url === `https://${target}.supabase.co`);
  const require = createRequire(resolve(root, 'packages/central/package.json'));
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) }) },
  });
  // This fixed synthetic selector is unrelated to native authorizations. Anonymous
  // has no EXECUTE grant: a successful response is an unexpected security failure.
  const result = await client.rpc('eps_oauth_consent_claim', {
    p_authorization_id: 'a'.repeat(32),
    p_resource: 'https://everyone-presentation-pilot.vercel.app/mcp',
    p_action: 'details', p_request_id: randomUUID(),
  });
  const codes = new Set(['42501', '28000', 'PGRST202', 'PGRST205', 'PGRST301', 'PGRST302']);
  const code = result.error && codes.has(result.error.code) ? result.error.code : result.error ? 'other' : null;
  const message = result.error?.message;
  const reason = code === '42501' && message === 'permission denied for function eps_oauth_consent_claim' ? 'function_execute_denied'
    : code === 'PGRST202' ? 'rpc_not_in_schema_cache' : result.error ? 'other' : 'unexpected_success';
  const receipt = { schema_version: '1.0', evidence_kind: 'actual_anonymous_negative_rpc_probe', target,
    observed_at: new Date().toISOString(), operation: 'eps_oauth_consent_claim', synthetic_selector: true,
    no_actor_emulation: true, no_provider_call: true, status: result.status, error_code: code, reason,
    raw_provider_response_persisted: false, expected_denial: result.status === 401 && code === '42501' && reason === 'function_execute_denied' };
  const directory = resolve(root, 'tracking/evidence/m07/oauth-attempt-trace'); await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${new Date().toISOString().replace(/[:.]/gu, '-')}-anonymous-rpc.json`);
  await writeFile(path, `${JSON.stringify(receipt, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, receipt: relative(root, path).replaceAll('\\', '/') }));
  need(receipt.expected_denial);
}

main().catch(() => { console.log('ANONYMOUS_RPC_PROBE_UNCONFIRMED'); process.exitCode = 1; });
