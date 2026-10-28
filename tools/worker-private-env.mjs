import { constants } from 'node:fs';
import { Buffer } from 'node:buffer';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';
import { URL } from 'node:url';

const privateFile = path.resolve(import.meta.dirname, '..', '.env.worker.local');
const maximumBytes = 16 * 1024;
const fields = ['OPENAI_API_KEY', 'OPENAI_EXTRACTION_MODEL', 'N8N_API_KEY', 'N8N_BASE_URL'];
const localFiles = { lstat, open, realpath, currentUserId: () => typeof process.getuid === 'function' ? process.getuid() : null };
export class PrivateWorkerConfigError extends Error {
  constructor() {
    super('Private worker configuration is invalid or unavailable.');
    this.name = 'PrivateWorkerConfigError'; this.code = 'PRIVATE_WORKER_CONFIGURATION_INVALID';
  }
}
function invalid() { throw new PrivateWorkerConfigError(); }
function origin(value) {
  if (value === '') return value;
  const url = new URL(value);
  const tenant = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash
    || !new RegExp(`^${tenant}(?:\\.app)?\\.n8n\\.cloud$`, 'u').test(url.hostname)
    || value !== url.origin && value !== `${url.origin}/`) invalid();
  return url.origin;
}
/** Pure Node24 parser. Returned values are private; never serialize or log them. */
export function parseWorkerPrivateEnv(text, environment = {}) {
  try {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > maximumBytes || text.includes('\0')) invalid();
    const fallback = parseEnv(text); const result = {};
    for (const key of fields) {
      const runtime = Object.hasOwn(environment, key) ? environment[key] : undefined;
      if (runtime !== undefined && typeof runtime !== 'string') invalid();
      const value = runtime !== undefined && runtime !== '' ? runtime : fallback[key] ?? '';
      if (typeof value !== 'string' || /[\r\n\0]/u.test(value)) invalid();
      result[key] = key === 'N8N_BASE_URL' ? origin(value) : value;
    }
    return result;
  } catch { return invalid(); }
}
function samePath(first, second) {
  const normalize = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
  return typeof second === 'string' && normalize(first) === normalize(second);
}
function checkFile(info, userId) {
  if (!info.isFile() || info.isSymbolicLink?.() || info.size < 0 || info.size > maximumBytes
    || userId !== null && BigInt(info.uid) !== BigInt(userId)) invalid();
}
function sameFile(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.size === after.size
    && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}
async function readPrivateFile(io) {
  let initial;
  try { initial = await io.lstat(privateFile, { bigint: true }); }
  catch (error) { if (error?.code === 'ENOENT') return ''; throw error; }
  const userId = io.currentUserId(); checkFile(initial, userId);
  if (!samePath(privateFile, await io.realpath(privateFile))) invalid();
  const handle = await io.open(privateFile, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat({ bigint: true }); checkFile(opened, userId);
    if (!sameFile(initial, opened)) invalid();
    const bytes = Buffer.alloc(maximumBytes + 1); let length = 0;
    while (length < bytes.length) {
      const next = await handle.read(bytes, length, bytes.length - length, null);
      if (!next.bytesRead) break;
      length += next.bytesRead;
    }
    if (length > maximumBytes || BigInt(length) !== BigInt(opened.size)) invalid();
    const after = await handle.stat({ bigint: true }); const current = await io.lstat(privateFile, { bigint: true }); checkFile(current, userId);
    if (!sameFile(opened, after) || !sameFile(opened, current) || !samePath(privateFile, await io.realpath(privateFile))) invalid();
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length));
  } finally { await handle.close(); }
}
/** Fixed repository-root fallback only. io is an offline test seam, never an HTTP option.
 * POSIX owner UID is checked; Node's Windows metadata does not verify SID/DACLs. */
export async function loadWorkerPrivateEnvironment({ environment = process.env, io = localFiles } = {}) {
  try { return parseWorkerPrivateEnv(await readPrivateFile(io), environment); }
  catch { return invalid(); }
}
/** Presence is not authentication, model validation, MCP connectivity or readiness. */
export function workerPrivatePresence(environment) {
  const present = key => typeof environment[key] === 'string' && environment[key] !== '';
  return { openai_key_present: present('OPENAI_API_KEY'), extraction_model_selected: present('OPENAI_EXTRACTION_MODEL'),
    n8n_key_present: present('N8N_API_KEY'), n8n_base_url_present: present('N8N_BASE_URL') };
}
