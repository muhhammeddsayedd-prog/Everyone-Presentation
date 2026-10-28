/** Fixed public certificate acquisition. No credentials or database operations. */
import { mkdir, writeFile } from 'node:fs/promises';
import { X509Certificate, createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const url = 'https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt';
const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15_000) });
if (!response.ok) throw new Error('CERTIFICATE_UNAVAILABLE');
const pem = await response.text();
if (pem.length > 16384 || !new X509Certificate(pem).ca) throw new Error('CERTIFICATE_INVALID');
const directory = path.join(root, '.local/specs-runtime');
await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, 'prod-ca-2021.crt'), pem, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: response.status, official_dashboard_link: url, ca: true,
  sha256: createHash('sha256').update(pem).digest('hex') }));
