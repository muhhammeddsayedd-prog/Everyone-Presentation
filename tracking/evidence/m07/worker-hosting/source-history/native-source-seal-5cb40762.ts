import { createHash } from 'node:crypto';
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
function fail(): never { throw new Error('NATIVE_CONFIGURATION_INVALID'); }
function sourcePath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 240 || value.includes('..') || value.includes('\\') || value.includes(':')) return false;
  return /^(?:package(?:-lock)?\.json|apps\/(?:web|worker)\/package\.json|apps\/worker\/Dockerfile\.(?:daemon|native-sandbox)|packages\/(?:domain|jobs|integrations|central)\/package\.json|(?:apps\/worker\/src|packages\/(?:domain|jobs|integrations|central)\/src|packages\/templates\/(?:src|versions))\/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|packages\/templates\/registry\.json|apps\/web\/public\/fonts\/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps\/web\/public\/brand\/everyone-logotype(?:-white)?\.svg)$/u.test(value);
}
/** Validate the COMPLETE list before reading one path. Image admission proves
 * this deployed source graph matches the independently pinned build manifest. */
export function verifyNativeSourceSeal(source: unknown, expected: string, read: (relative: string) => Uint8Array): void {
  if (!object(source) || Object.keys(source).sort().join(',') !== 'files,source_sha256' || source.source_sha256 !== expected || !/^[a-f0-9]{64}$/u.test(expected)
    || !Array.isArray(source.files) || !source.files.length || source.files.length > 1000 || hash(JSON.stringify(source.files)) !== expected) fail();
  let previous = '';
  for (const item of source.files) {
    if (!object(item) || Object.keys(item).sort().join(',') !== 'bytes,path,sha256' || !sourcePath(item.path) || item.path <= previous || typeof item.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(item.sha256)
      || !Number.isSafeInteger(item.bytes) || Number(item.bytes) < 1 || Number(item.bytes) > 16 * 1024 ** 2) fail(); previous = item.path;
  }
  for (const item of source.files) { const bytes = read(item.path); if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) fail(); }
}
