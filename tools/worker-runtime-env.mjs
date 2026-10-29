/** Fixed local runtime secret file only. Importing performs no IO. No provider,
 * management API key, arbitrary filename, URL argument or secret diagnostic. */
import { constants } from 'node:fs';
import { Buffer } from 'node:buffer';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';
import { checkedWorkerFilesEnvironment } from './worker-files-env.mjs';

const FILE = path.resolve(import.meta.dirname, '..', '.env.worker-runtime.local');
const MAXIMUM = 64 * 1024;
const FIELDS = ['EPS_SPECS_PG_HOST', 'EPS_SPECS_PG_PASSWORD', 'EPS_SPECS_PG_CA_BASE64', 'N8N_DISPATCH_URL', 'N8N_DISPATCH_SECRET'];
const files = { lstat, open, realpath, uid: () => typeof process.getuid === 'function' ? process.getuid() : null };
function invalid() { throw new Error('WORKER_RUNTIME_CONFIGURATION_REQUIRED'); }
function checked(values) {
  if (!values || typeof values !== 'object' || Object.keys(values).length !== FIELDS.length || Object.keys(values).some(key => !FIELDS.includes(key))) invalid();
  for (const name of FIELDS) if (typeof values[name] !== 'string' || !values[name].trim() || /[\r\n\0]/u.test(values[name])) invalid();
  return Object.fromEntries(FIELDS.map(name => [name, values[name]]));
}
export function parseWorkerRuntimeEnvironment(text) {
  try {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAXIMUM || text.includes('\0')) invalid();
    return checked(parseEnv(text));
  } catch { return invalid(); }
}
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const samePath = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() === FILE.toLowerCase() : path.resolve(value) === FILE;
function fileCheck(info, uid) {
  if (!info.isFile() || info.isSymbolicLink?.() || info.size < 1 || info.size > MAXIMUM
    || uid !== null && (BigInt(info.uid) !== BigInt(uid) || (BigInt(info.mode) & 0o077n) !== 0n)) invalid();
}
/** POSIX owner/mode are checked. Windows SID/DACL protection is provisioned by
 * the owner separately; Node file metadata cannot attest those permissions. */
export async function loadWorkerRuntimeEnvironment({ io = files } = {}) {
  try {
    const uid = io.uid(); const initial = await io.lstat(FILE, { bigint: true }); fileCheck(initial, uid);
    if (!samePath(await io.realpath(FILE))) invalid();
    const handle = await io.open(FILE, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat({ bigint: true }); fileCheck(opened, uid); if (!same(initial, opened)) invalid();
      const bytes = Buffer.alloc(MAXIMUM + 1); let length = 0;
      while (length < bytes.length) { const part = await handle.read(bytes, length, bytes.length - length, null); if (!part.bytesRead) break; length += part.bytesRead; }
      if (length > MAXIMUM || BigInt(length) !== BigInt(opened.size)) invalid();
      const after = await handle.stat({ bigint: true }); const current = await io.lstat(FILE, { bigint: true }); fileCheck(current, uid);
      if (!same(opened, after) || !same(opened, current) || !samePath(await io.realpath(FILE))) invalid();
      return parseWorkerRuntimeEnvironment(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    } finally { await handle.close(); }
  } catch { return invalid(); }
}
export function createSpecsWorkerEnvironment(provider, runtime, environment = {}, fileEnvironment = {}) {
  if (!provider || typeof provider.OPENAI_API_KEY !== 'string' || !provider.OPENAI_API_KEY.trim()
    || typeof provider.OPENAI_EXTRACTION_MODEL !== 'string' || !provider.OPENAI_EXTRACTION_MODEL.trim()) invalid();
  const scoped = checked(runtime);
  const child = { NODE_ENV: 'production', PATH:'', OPENAI_API_KEY: provider.OPENAI_API_KEY, OPENAI_EXTRACTION_MODEL: provider.OPENAI_EXTRACTION_MODEL,
    ...scoped, ...checkedWorkerFilesEnvironment(fileEnvironment) };
  for (const key of ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'LANG']) if (typeof environment[key] === 'string') child[key] = environment[key];
  return child;
}
