import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { cookies } from 'next/headers';
import { DomainError } from '@eps/domain';
import { readRuntimeConfig } from './config';
import { getStudio } from './studio';
import { getCentralClient } from './central-client';
import { verifyCentralUser } from '@eps/central';

export const SESSION_COOKIE = 'eps_dev_session';
const MAX_AGE = 8 * 60 * 60;

async function signingKey() {
  const config = readRuntimeConfig();
  if (config.adapterMode !== 'local_fixture') throw new DomainError('ACCESS_DENIED', 'Development sign-in is disabled in central mode.', 403);
  const { dataDir } = config;
  await mkdir(dataDir, { recursive: true });
  const file = path.join(dataDir, 'session-key');
  try { const existing = await readFile(file); if (existing.length !== 32) throw new Error('Invalid development session key.'); return existing; }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  const temporary = path.join(dataDir, `session-key.${randomBytes(16).toString('hex')}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(randomBytes(32)); await handle.sync(); } finally { await handle.close(); }
  try { await link(temporary, file); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  finally { await unlink(temporary); }
  const key = await readFile(file);
  if (key.length !== 32) throw new Error('Invalid development session key.');
  return key;
}

export function signSession(actorId: string, key: Uint8Array, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: actorId, exp: now + MAX_AGE * 1000, nonce: randomBytes(12).toString('hex') })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}

export function verifySession(token: string, key: Uint8Array, now = Date.now()): string | null {
  if (token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  if (!/^[A-Za-z0-9_-]+$/.test(payload) || !/^[A-Za-z0-9_-]+$/.test(signature)) return null;
  const expected = createHmac('sha256', key).update(payload).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof data.sub === 'string' && typeof data.exp === 'number' && data.exp > now ? data.sub : null;
  } catch { return null; }
}

export async function currentActor(required = true) {
  if (readRuntimeConfig().adapterMode === 'supabase') {
    try {
      const verified = await verifyCentralUser(await getCentralClient());
      return { principal_id: verified.principal_id };
    } catch (error) {
      if (!required && error instanceof DomainError && error.code === 'AUTH_REQUIRED') return null;
      throw error;
    }
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const actorId = token ? verifySession(token, await signingKey()) : null;
  if (!actorId) {
    if (required) throw new DomainError('AUTH_REQUIRED', 'Sign in to the development workspace.', 401);
    return null;
  }
  return (await getStudio()).resolveFixtureActor(actorId);
}

export async function setSession(actorId: string) {
  if (readRuntimeConfig().adapterMode !== 'local_fixture') throw new DomainError('ACCESS_DENIED', 'Development sign-in is disabled in central mode.', 403);
  const actor = (await getStudio()).resolveFixtureActor(actorId);
  (await cookies()).set(SESSION_COOKIE, signSession(actor.principal_id, await signingKey()), {
    httpOnly: true, sameSite: 'strict', secure: readRuntimeConfig().baseUrl.startsWith('https:'), path: '/', maxAge: MAX_AGE
  });
  return actor;
}

export async function clearSession() {
  if (readRuntimeConfig().adapterMode === 'supabase') {
    const { error } = await (await getCentralClient(false)).auth.signOut({ scope: 'local' });
    if (error) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Could not sign out of this browser. Try again.', 503);
  } else (await cookies()).delete(SESSION_COOKIE);
}
