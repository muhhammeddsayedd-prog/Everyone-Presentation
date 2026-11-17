// Shared helpers for the staging journeys: real GoTrue password sign-in through the gateway, API calls with the
// user's access token, SQL readbacks (supabase_admin over the container socket, read-only use), worker runs.
import { randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '../../..');
export const S = path.join(ROOT, '.local/cycle7/stg');
export const OUT = path.join(S, 'evidence'); mkdirSync(OUT, { recursive: true });
const secrets = JSON.parse(readFileSync(path.join(S, 'secrets.json'), 'utf8'));
export const seed = JSON.parse(readFileSync(path.join(S, 'seed.json'), 'utf8'));
export const GATEWAY = 'http://127.0.0.1:55511', PUBLISHABLE = 'sb_publishable_c7staginglocal01';
export const WS = seed.ids.workspace;
let APP = process.env.EPS_STG_APP ?? 'http://127.0.0.1:3160';
export function useApp(url) { APP = url; }
export function app() { return APP; }

const sessions = {};
export async function signIn(user) {
  if (sessions[user]) return sessions[user];
  const res = await fetch(`${GATEWAY}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' },
    body: JSON.stringify({ email: seed.users[user].email, password: secrets.user_password }) });
  const body = await res.json(); if (!res.ok) throw new Error(`sign-in ${user}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
  sessions[user] = body; return body;
}
export async function call(method, p, body, { user = 'a', key, raw = false, headers: extra = {}, anonymous = false } = {}) {
  const headers = { Accept: 'application/json', ...extra };
  if (!anonymous) headers.Authorization = `Bearer ${(await signIn(user)).access_token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET' && !anonymous) headers['Idempotency-Key'] = key ?? `stg-${randomUUID()}`;
  const res = await fetch(`${APP}/api/v1${p}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (raw) return res;
  const text = await res.text(); let json; try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  return { status: res.status, body: json, headers: res.headers };
}
export async function ok(method, p, body, options) {
  const r = await call(method, p, body, options);
  if (r.status >= 300) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(r.body).slice(0, 500)}`);
  return r.body;
}
export function sql(text) {
  return execFileSync('docker', ['exec', '-i', 'eps-c7stg-db', 'psql', '-U', 'supabase_admin', '-h', 'localhost', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'], { input: text, encoding: 'utf8' }).trim();
}
/** Run a worker checkout through worker.mts until the queue is idle; returns the notices. */
export function runWorker(checkout, { exports = true } = {}) {
  const args = ['tsx', path.join(ROOT, 'development/cycle7/staging-full/worker.mts'), '--once', ...(exports ? ['--exports'] : [])];
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^PG/.test(k)));
  const run = spawnSync('npx', args, { cwd: checkout, env, encoding: 'utf8', shell: true, timeout: 600000, maxBuffer: 32 * 1024 * 1024 });
  const lines = (run.stdout ?? '').split('\n').filter(l => l.startsWith('{')).map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } });
  if (run.status !== 0) lines.push({ event: 'worker_exit', status: run.status, stderr: (run.stderr ?? '').slice(-1500) });
  return lines;
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const results = []; let current;
export function check(name, condition, detail) { current.checks.push({ name, ok: Boolean(condition), ...(condition ? {} : { detail: JSON.stringify(detail ?? null).slice(0, 600) }) }); }
export function note(key, value) { current.notes[key] = value; }
export async function journey(name, fn) {
  current = { name, app: APP, checks: [], notes: {} }; results.push(current);
  try { await fn(); } catch (error) { current.checks.push({ name: 'completed', ok: false, detail: String(error.stack ?? error).slice(0, 1200) }); }
  current.result = current.checks.every(c => c.ok) ? 'passed' : 'failed';
  console.log(JSON.stringify({ journey: name, result: current.result, failed: current.checks.filter(c => !c.ok) }));
}
export function save(file) {
  let previous = []; try { previous = JSON.parse(readFileSync(path.join(OUT, file), 'utf8')).journeys; } catch { /* first run */ }
  const merged = [...previous.filter(p => !results.some(r => r.name === p.name)), ...results];
  writeFileSync(path.join(OUT, file), JSON.stringify({ generated_at: new Date().toISOString(), journeys: merged }, null, 1));
}
