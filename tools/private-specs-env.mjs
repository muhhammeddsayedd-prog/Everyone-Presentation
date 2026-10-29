import { Buffer } from 'node:buffer';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const keyId = 'eps-specs-dev-20261029-v1';
const fields = ['SPECS_VERIFICATION_KEY_ID', 'SPECS_VERIFICATION_KEY_BASE64URL'];
const phaseFields = ['version', 'target', 'key_id', 'phase', 'claim_id', 'secret_file', 'created_at', 'completed_at', 'contains_secret'];
export class PrivateSpecsConfigError extends Error {
  constructor() { super('Private document verifier configuration is unavailable.'); this.code = 'PRIVATE_SPECS_CONFIGURATION_INVALID'; }
}
function unavailable() { throw new PrivateSpecsConfigError(); }
function validKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return false;
  const bytes = Buffer.from(value, 'base64url'); return bytes.length === 32 && bytes.toString('base64url') === value;
}
function shape(value, names) { return value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name)); }
function json(bytes, maximum, indentation) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > maximum) unavailable();
  try {
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); const value = JSON.parse(text);
    if (JSON.stringify(value, null, indentation) + '\n' !== text) unavailable(); return value;
  } catch { return unavailable(); }
}
/** Pure canonical parser. It returns only the private pair, never a feature flag. */
export function parsePrivateSpecsFiles(phaseBytes, secretBytes) {
  const phase = json(phaseBytes, 8192, 2); const secret = json(secretBytes, 512, undefined);
  if (!shape(phase, phaseFields) || phase.version !== 1 || phase.target !== 'pyibofyctwnqpvktepse' || phase.key_id !== keyId
    || phase.phase !== 'completed' || phase.contains_secret !== false || phase.secret_file !== '.local/specs-assets-verifier/verifier.json'
    || typeof phase.claim_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(phase.claim_id)
    || typeof phase.created_at !== 'string' || typeof phase.completed_at !== 'string' || !Number.isFinite(Date.parse(phase.created_at))
    || !Number.isFinite(Date.parse(phase.completed_at)) || Date.parse(phase.completed_at) < Date.parse(phase.created_at)
    || !shape(secret, fields) || secret.SPECS_VERIFICATION_KEY_ID !== keyId || !validKey(secret.SPECS_VERIFICATION_KEY_BASE64URL)) unavailable();
  return { SPECS_VERIFICATION_KEY_ID: keyId, SPECS_VERIFICATION_KEY_BASE64URL: secret.SPECS_VERIFICATION_KEY_BASE64URL };
}
/** A nonempty process value keeps normal precedence over its local-file value. */
export function explicitSpecsEnvironment(runtimeEnv, fileEnv) {
  const pair = Object.fromEntries(fields.map(name => [name, runtimeEnv[name] || fileEnv[name] || '']));
  if (fields.every(name => pair[name] === '')) return null;
  if (!fields.every(name => typeof pair[name] === 'string' && pair[name])
    || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u.test(pair.SPECS_VERIFICATION_KEY_ID) || !validKey(pair.SPECS_VERIFICATION_KEY_BASE64URL)) unavailable();
  // Fill only absent/empty process fields. An explicit nonempty process value
  // is never replaced by the local file or the protected fallback.
  return Object.fromEntries(fields.filter(name => !runtimeEnv[name]).map(name => [name, pair[name]]));
}
function samePath(left, right) { return process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right; }
async function boundedFile(relative, maximum, optional = false, privateFile = false) {
  // Callers below use only these fixed project paths; no path is accepted from
  // an environment value, HTTP request, journal or command-line argument.
  const file = path.join(root, relative); let handle;
  try {
    const before = await lstat(file);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > maximum || !samePath(await realpath(file), file)) unavailable();
    // Windows confidentiality is established by the reviewed protected writer;
    // Node stat does not claim to inspect a Windows DACL.
    if (privateFile && process.platform !== 'win32' && (before.uid !== process.geteuid() || (before.mode & 0o077) !== 0)) unavailable();
    handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat(); if (opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size) unavailable();
    const bytes = Buffer.alloc(maximum + 1); let size = 0;
    while (size < bytes.length) { const next = await handle.read(bytes, size, bytes.length - size, null); if (!next.bytesRead) break; size += next.bytesRead; }
    const after = await handle.stat();
    if (size > maximum || size !== opened.size || after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) unavailable();
    return bytes.subarray(0, size);
  } catch (error) { if (optional && error?.code === 'ENOENT') return null; return unavailable(); }
  finally { try { await handle?.close(); } catch { unavailable(); } }
}
/** Explicitly invoked only by the local launcher; importing this module reads
 * no files. Missing protected files are optional, partial state is unavailable. */
export async function loadPrivateSpecsEnvironment(runtimeEnv = process.env) {
  const envBytes = await boundedFile('apps/web/.env.local', 1_048_576, true);
  let fileEnv;
  try { fileEnv = envBytes ? parseEnv(new TextDecoder('utf-8', { fatal: true }).decode(envBytes)) : {}; } catch { return unavailable(); }
  const explicit = explicitSpecsEnvironment(runtimeEnv, fileEnv); if (explicit) return explicit;
  if ((runtimeEnv.SUPABASE_URL || fileEnv.SUPABASE_URL) !== 'https://pyibofyctwnqpvktepse.supabase.co') unavailable();
  const phase = await boundedFile('.local/specs-assets-verifier/phase.json', 8192, true, true);
  const secret = await boundedFile('.local/specs-assets-verifier/verifier.json', 512, true, true);
  if (!phase && !secret) return {}; if (!phase || !secret) unavailable();
  return parsePrivateSpecsFiles(phase, secret);
}
export async function optionalPrivateSpecsEnvironment(loader = loadPrivateSpecsEnvironment) {
  try { return { environment: await loader(), unavailable: false }; }
  catch (error) { if (!(error instanceof PrivateSpecsConfigError)) throw error; return { environment: {}, unavailable: true }; }
}
