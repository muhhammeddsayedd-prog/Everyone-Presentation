/** Fixed credential-free SSLRequest. Never sends a Postgres startup/password. */
import net from 'node:net';
import tls from 'node:tls';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const host = 'aws-0-eu-west-1.pooler.supabase.com';
const ca = await readFile(path.join(root, '.local/specs-runtime/prod-ca-2021.crt'), 'utf8');
let report;
try {
  report = await new Promise((resolve, reject) => {
    const socket = net.connect({ host, port: 5432 }); let secure;
    const timer = setTimeout(() => finish(new Error()), 15_000);
    function finish(error, value) { clearTimeout(timer); secure?.destroy(); socket.destroy(); error ? reject(error) : resolve(value); }
    socket.once('error', () => finish(new Error()));
    socket.once('connect', () => { const bytes = Buffer.alloc(8); bytes.writeInt32BE(8, 0); bytes.writeInt32BE(80877103, 4); socket.write(bytes); });
    socket.once('data', bytes => {
      if (bytes.toString('ascii') !== 'S') return finish(new Error());
      secure = tls.connect({ socket, ca, servername: host, rejectUnauthorized: true, minVersion: 'TLSv1.2' });
      secure.once('error', () => finish(new Error()));
      secure.once('secureConnect', () => finish(null, { result: 'passed', hostname_verified: true, ca_verified: secure.authorized,
        tls_protocol: secure.getProtocol(), leaf_fingerprint_sha256: secure.getPeerCertificate().fingerprint256 }));
    });
  });
} catch { report = { result: 'failed', code: 'TLS_VERIFICATION_UNCONFIRMED' }; }
report = { observed_at: new Date().toISOString(), ...report, host, port: 5432,
  ca_sha256: createHash('sha256').update(ca).digest('hex'), credentials_sent: false, postgres_startup_sent: false };
const directory = path.join(root, 'tracking/evidence/m02/specs-runtime'); await mkdir(directory, { recursive: true });
await writeFile(path.join(directory, report.observed_at.replace(/[:.]/gu, '-') + '-tls.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(report));
if (report.result !== 'passed') process.exitCode = 1;
