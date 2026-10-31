import path from 'node:path';
import { existsSync } from 'node:fs';
import { readCentralConfig } from '@eps/central';
import { assertHostedPilotConfig } from './hosting-pilot.ts';

function workspaceRoot() {
  let current = process.cwd();
  while (!existsSync(path.join(current, 'CONTRACT_BASELINE.md'))) {
    const parent = path.dirname(current);
    if (parent === current) throw new Error('Run the app from the Everyone Presentation Studio workspace.');
    current = parent;
  }
  return current;
}

export function readRuntimeConfig(env: Record<string, string | undefined> = process.env) {
  const environment = env.APP_ENV ?? 'development';
  const adapterMode = env.CENTRAL_ADAPTER_MODE ?? 'local_fixture';
  const baseUrl = env.APP_BASE_URL ?? 'http://127.0.0.1:3000';
  const fixtureAllowed = ['development', 'test'].includes(environment) && env.NODE_ENV !== 'production';
  if (!['development', 'test', 'staging', 'production'].includes(environment)) throw new Error('Unsupported APP_ENV.');
  if (env.VERCEL === '1' || env.EPS_RELEASE_MODE !== undefined || env.NODE_ENV === 'production'
    || ['staging', 'production'].includes(environment)) assertHostedPilotConfig(env);
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Use an HTTP loopback URL without credentials.');
  if (adapterMode === 'supabase') {
    readCentralConfig(env);
    if ((env.NODE_ENV === 'production' || ['production', 'staging'].includes(environment)) && url.protocol !== 'https:') throw new Error('Production and staging authentication require HTTPS.');
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.protocol !== 'https:') throw new Error('Central app origins require HTTPS.');
    return { environment, adapterMode: 'supabase' as const, baseUrl: url.origin };
  }
  if (adapterMode !== 'local_fixture') throw new Error('Unsupported CENTRAL_ADAPTER_MODE.');
  if (!fixtureAllowed) throw new Error('Development fixture adapter and sign-in are prohibited outside development/test.');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Development fixture mode requires a loopback APP_BASE_URL.');
  const root = workspaceRoot();
  return { environment: environment as 'development' | 'test', adapterMode: 'local_fixture' as const, baseUrl: url.origin,
    dataDir: path.resolve(/* turbopackIgnore: true */ env.EPS_DATA_DIR ?? path.join(root, '.local/studio')) };
}
