import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';
const root = path.resolve(import.meta.dirname, '..');
const keyId = 'eps-logo-dev-20261028-v1';
const keyFields = ['LOGO_VERIFICATION_KEY_ID', 'LOGO_VERIFICATION_KEY_BASE64URL'];
const phaseFields = ['version', 'target', 'key_id', 'phase', 'claim_id', 'secret_file', 'environment_sha256', 'tool_sha256', 'created_at', 'contains_secret', 'recovery', 'completed_at'];
export class PrivateLogoConfigError extends Error {
  constructor() {
    super('Private logo verifier configuration is unavailable.');
    this.code = 'PRIVATE_LOGO_CONFIGURATION_INVALID';
  }
}
function unavailable() { throw new PrivateLogoConfigError(); }
function encodedKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return false;
  const bytes = Buffer.from(value, 'base64url');
  return bytes.length === 32 && bytes.toString('base64url') === value;
}
function shape(value, fields) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
}
function json(bytes, maximum, indentation) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > maximum) unavailable();
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    // Writer uses this exact representation; duplicate fields and trailing input
    // cannot survive the comparison. Never include input values in an error.
    if (JSON.stringify(value, null, indentation) + '\n' !== text) unavailable();
    return value;
  } catch { return unavailable(); }
}
/** Pure parser for the fixed protected files; never logs or enables a feature. */
export function parsePrivateLogoFiles(phaseBytes, secretBytes) {
  const phase = json(phaseBytes, 8192, 2);
  const secret = json(secretBytes, 512, undefined);
  if (!shape(phase, phaseFields) || phase.version !== 1 || phase.target !== 'pyibofyctwnqpvktepse' || phase.key_id !== keyId
    || phase.phase !== 'completed' || phase.contains_secret !== false || phase.secret_file !== '.local/cloud-logo-provision/verifier.json'
    || typeof phase.claim_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(phase.claim_id)
    || !/^[a-f0-9]{64}$/u.test(phase.environment_sha256) || !/^[a-f0-9]{64}$/u.test(phase.tool_sha256)
    || !Number.isFinite(Date.parse(phase.created_at)) || !Number.isFinite(Date.parse(phase.completed_at))
    || Date.parse(phase.completed_at) < Date.parse(phase.created_at) || typeof phase.recovery !== 'string' || phase.recovery.length > 1000
    || !shape(secret, keyFields) || secret.LOGO_VERIFICATION_KEY_ID !== keyId || !encodedKey(secret.LOGO_VERIFICATION_KEY_BASE64URL)) unavailable();
  return { LOGO_VERIFICATION_KEY_ID: keyId, LOGO_VERIFICATION_KEY_BASE64URL: secret.LOGO_VERIFICATION_KEY_BASE64URL };
}
async function boundedFile(file, maximum, optional = false) {
  let handle;
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > maximum || !(await realpath(file)).startsWith(root + path.sep)) unavailable();
    handle = await open(file, 'r');
    const bytes = Buffer.alloc(maximum + 1); let length = 0;
    while (length < bytes.length) {
      const next = await handle.read(bytes, length, bytes.length - length, null);
      if (!next.bytesRead) break;
      length += next.bytesRead;
    }
    if (length > maximum) unavailable();
    return bytes.subarray(0, length);
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return null;
    return unavailable();
  } finally { await handle?.close(); }
}
export function explicitLogoEnvironment(runtimeEnv, fileEnv) {
  const current = Object.fromEntries(keyFields.map(name => [name, runtimeEnv[name] ?? fileEnv[name] ?? '']));
  if (!keyFields.some(name => current[name] !== '')) return null;
  if (!keyFields.every(name => typeof current[name] === 'string' && current[name] !== '')
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(current.LOGO_VERIFICATION_KEY_ID) || !encodedKey(current.LOGO_VERIFICATION_KEY_BASE64URL)) unavailable();
  return {}; // Existing process/file configuration keeps its normal precedence.
}
export async function loadPrivateLogoEnvironment(runtimeEnv = process.env) {
  const envBytes = await boundedFile(path.join(root, 'apps/web/.env.local'), 1_048_576, true);
  let publicConfig;
  try { publicConfig = envBytes ? parseEnv(new TextDecoder('utf-8', { fatal: true }).decode(envBytes)) : {}; } catch { return unavailable(); }
  const explicit = explicitLogoEnvironment(runtimeEnv, publicConfig);
  if (explicit) return explicit;
  if ((runtimeEnv.SUPABASE_URL ?? publicConfig.SUPABASE_URL) !== 'https://pyibofyctwnqpvktepse.supabase.co') unavailable();
  const phase = await boundedFile(path.join(root, '.local/cloud-logo-provision/phase.json'), 8192, true);
  const secret = await boundedFile(path.join(root, '.local/cloud-logo-provision/verifier.json'), 512, true);
  if (!phase && !secret) return {};
  if (!phase || !secret) unavailable();
  return parsePrivateLogoFiles(phase, secret);
}
/** An optional verifier outage must not stop central project/Ready-media reads. */
export async function optionalPrivateLogoEnvironment(loader = loadPrivateLogoEnvironment) {
  try { return { environment: await loader(), unavailable: false }; }
  catch (error) {
    if (!(error instanceof PrivateLogoConfigError)) throw error;
    return { environment: {}, unavailable: true };
  }
}
async function main() {
  const port = process.env.EPS_DEV_PORT ?? '3000';
  if (!/^\d{4,5}$/u.test(port) || Number(port) > 65535) throw new Error('EPS_DEV_PORT must be a valid local development port.');
  const logo = await optionalPrivateLogoEnvironment();
  if (logo.unavailable) process.stderr.write('Private logo verification is unavailable; central development will continue with uploads disabled.\n');
  const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port], {
    cwd: path.join(root, 'apps/web'), stdio: 'inherit',
    env: { ...process.env, ...logo.environment, CENTRAL_ADAPTER_MODE: 'supabase', APP_BASE_URL: `http://127.0.0.1:${port}`, APP_ENV: 'development' }
  });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('Central development startup failed. Review public configuration and the protected verifier phase; private values were suppressed.\n'); process.exitCode = 1; });
}
