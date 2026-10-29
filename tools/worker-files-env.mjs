/** Fixed public-only projection for optional document transfers. Importing does
 * no IO, enabling no feature and never reading worker/provider configuration. */
import { Buffer } from 'node:buffer';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseEnv, TextDecoder } from 'node:util';

const FILE = path.resolve(import.meta.dirname, '..', 'apps/web/.env.local');
const MAXIMUM = 64 * 1024;
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
const FIELDS = ['EPS_SPECS_FILES_ENABLED', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'];
const files = { lstat, open, realpath, uid: () => typeof process.getuid === 'function' ? process.getuid() : null };
function invalid() { throw new Error('WORKER_FILES_CONFIGURATION_REQUIRED'); }
export function checkedWorkerFilesEnvironment(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  if (Object.keys(value).length === 0) return {};
  if (Object.keys(value).length !== FIELDS.length || FIELDS.some(key => !Object.hasOwn(value, key))
    || value.EPS_SPECS_FILES_ENABLED !== 'true' || value.SUPABASE_URL !== ORIGIN
    || typeof value.SUPABASE_PUBLISHABLE_KEY !== 'string' || value.SUPABASE_PUBLISHABLE_KEY.length > 4096
    || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(value.SUPABASE_PUBLISHABLE_KEY)) invalid();
  return Object.fromEntries(FIELDS.map(key => [key, value[key]]));
}
export function parseWorkerFilesEnvironment(text) {
  try {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAXIMUM || text.includes('\0')) invalid();
    const parsed = parseEnv(text);
    // This web file can contain other server fields. Never copy or report them.
    return checkedWorkerFilesEnvironment({ EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: parsed.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: parsed.SUPABASE_PUBLISHABLE_KEY });
  } catch { return invalid(); }
}
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const samePath = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() === FILE.toLowerCase() : path.resolve(value) === FILE;
function fileCheck(info, uid) {
  if (!info.isFile() || info.isSymbolicLink?.() || info.size < 1 || info.size > MAXIMUM
    || uid !== null && BigInt(info.uid) !== BigInt(uid)) invalid();
}
/** Fixed web file only, no ambient URL/key overrides. Disabled mode performs no
 * file IO. The injected reader is an offline test seam, not a runtime target. */
export async function loadWorkerFilesEnvironment({ environment = process.env, io = files } = {}) {
  if (environment.EPS_SPECS_FILES_ENABLED === undefined || environment.EPS_SPECS_FILES_ENABLED === 'false') return {};
  if (environment.EPS_SPECS_FILES_ENABLED !== 'true') invalid();
  try {
    const uid = io.uid(); const initial = await io.lstat(FILE, { bigint: true }); fileCheck(initial, uid);
    if (!samePath(await io.realpath(FILE))) invalid();
    const handle = await io.open(FILE, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat({ bigint: true }); fileCheck(opened, uid); if (!same(initial, opened)) invalid();
      const bytes = Buffer.alloc(MAXIMUM + 1); let length = 0;
      while (length < bytes.length) { const next = await handle.read(bytes, length, bytes.length - length, null); if (!next.bytesRead) break; length += next.bytesRead; }
      if (length > MAXIMUM || BigInt(length) !== BigInt(opened.size)) invalid();
      const after = await handle.stat({ bigint: true }); const current = await io.lstat(FILE, { bigint: true }); fileCheck(current, uid);
      if (!same(opened, after) || !same(opened, current) || !samePath(await io.realpath(FILE))) invalid();
      return parseWorkerFilesEnvironment(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length)));
    } finally { await handle.close(); }
  } catch { return invalid(); }
}
