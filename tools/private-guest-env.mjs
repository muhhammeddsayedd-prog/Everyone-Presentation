import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { TextDecoder } from 'node:util';

const FILE = path.resolve(import.meta.dirname, '..', '.env.guest-runtime.local');
export class PrivateGuestConfigError extends Error {
  constructor() { super('Private guest-review configuration is unavailable.'); this.code = 'PRIVATE_GUEST_CONFIGURATION_INVALID'; }
}
function invalid() { throw new PrivateGuestConfigError(); }
export function parsePrivateGuestEnvironment(text) {
  const match = /^EPS_REVIEW_GATEWAY_KEY=([a-f0-9]{64})\nEPS_REVIEW_REPLAY_KEY=([a-f0-9]{64})\n$/u.exec(text);
  if (!match || match[1] === match[2]) invalid();
  return { EPS_REVIEW_GATEWAY_KEY: match[1], EPS_REVIEW_REPLAY_KEY: match[2] };
}
export async function loadPrivateGuestEnvironment() {
  let handle;
  try {
    const before = await lstat(FILE);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > 1024 || (await realpath(FILE)).toLowerCase() !== FILE.toLowerCase()) invalid();
    if (process.platform !== 'win32' && typeof process.getuid === 'function' && (before.uid !== process.getuid() || (before.mode & 0o077) !== 0)) invalid();
    handle = await open(FILE, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const opened = await handle.stat();
    if (opened.ino !== before.ino || opened.dev !== before.dev || opened.size !== before.size) invalid();
    const bytes = Buffer.alloc(1025); let size = 0;
    for (;;) { const part = await handle.read(bytes, size, bytes.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; if (size > 1024) invalid(); }
    const after = await handle.stat();
    if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || after.ctimeMs !== opened.ctimeMs) invalid();
    return parsePrivateGuestEnvironment(new TextDecoder('utf8', { fatal: true }).decode(bytes.subarray(0, size)));
  } catch (error) { if (error?.code === 'ENOENT') return {}; return invalid(); }
  finally { await handle?.close(); }
}
export async function optionalPrivateGuestEnvironment(loader = loadPrivateGuestEnvironment) {
  try { return { environment: await loader(), unavailable: false }; }
  catch (error) { if (!(error instanceof PrivateGuestConfigError)) throw error; return { environment: {}, unavailable: true }; }
}
