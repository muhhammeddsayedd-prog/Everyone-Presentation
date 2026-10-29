/** Fixed optional review webhook file; importing performs no private IO. */
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { parseEnv, TextDecoder } from 'node:util';
import path from 'node:path';
import process from 'node:process';
import { Buffer } from 'node:buffer';

const FILE = path.resolve(import.meta.dirname, '..', '.env.review-runtime.local');
const FIELDS = ['EPS_REVIEW_ENABLED', 'N8N_REVIEW_DISPATCH_URL', 'N8N_REVIEW_DISPATCH_SECRET'];
const MAXIMUM = 4096;
const files = { lstat, open, realpath, uid: () => typeof process.getuid === 'function' ? process.getuid() : null };
function invalid() { throw new Error('REVIEW_RUNTIME_CONFIGURATION_INVALID'); }
export function parseReviewRuntimeEnvironment(text) {
  try {
    if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAXIMUM || text.includes('\0')) invalid();
    const values = parseEnv(text);
    if (Object.keys(values).length !== FIELDS.length || FIELDS.some(key => typeof values[key] !== 'string' || !values[key] || /[\r\n\0]/u.test(values[key])) || !['true', 'false'].includes(values.EPS_REVIEW_ENABLED) || !/^[a-f0-9]{64}$/u.test(values.N8N_REVIEW_DISPATCH_SECRET)) invalid();
    const url = new URL(values.N8N_REVIEW_DISPATCH_URL);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/webhook/eps-wf05-review-suggestion-stage-v1') invalid();
    return Object.fromEntries(FIELDS.map(key => [key, values[key]]));
  } catch { return invalid(); }
}
const same = (a, b) => a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
function checked(info, uid) { if (!info.isFile() || info.isSymbolicLink?.() || info.size < 1 || info.size > MAXIMUM || uid !== null && (BigInt(info.uid) !== BigInt(uid) || (BigInt(info.mode) & 0o077n) !== 0n)) invalid(); }
const matches = value => path.resolve(value).toLowerCase() === FILE.toLowerCase();
/** POSIX owner/mode checked; Windows private DACL is provisioned and attested
 * separately by the protected configuration writer, never inferred by Node. */
export async function loadReviewRuntimeEnvironment({ io = files } = {}) {
  let initial;
  try { initial = await io.lstat(FILE, { bigint: true }); } catch (error) { if (error?.code === 'ENOENT') return {}; return invalid(); }
  try {
    const uid = io.uid(); checked(initial, uid); if (!matches(await io.realpath(FILE))) invalid();
    const handle = await io.open(FILE, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = await handle.stat({ bigint: true }); checked(opened, uid); if (!same(initial, opened)) invalid();
      const bytes = Buffer.alloc(MAXIMUM + 1); let length = 0;
      while (length < bytes.length) { const part = await handle.read(bytes, length, bytes.length - length, null); if (!part.bytesRead) break; length += part.bytesRead; }
      if (length > MAXIMUM || BigInt(length) !== BigInt(opened.size)) invalid();
      const after = await handle.stat({ bigint: true }); const current = await io.lstat(FILE, { bigint: true }); checked(current, uid);
      if (!same(opened, after) || !same(opened, current) || !matches(await io.realpath(FILE))) invalid();
      return parseReviewRuntimeEnvironment(new TextDecoder('utf8', { fatal: true }).decode(bytes.subarray(0, length)));
    } finally { await handle.close(); }
  } catch { return invalid(); }
}
