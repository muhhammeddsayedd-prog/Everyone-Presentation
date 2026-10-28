import { spawn } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const port = process.env.EPS_DEV_PORT ?? '3000';
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535) throw new Error('EPS_DEV_PORT must be a valid local development port.');
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', port], {
  cwd: path.join(root, 'apps/web'), stdio: 'inherit',
  env: { ...process.env, CENTRAL_ADAPTER_MODE: 'supabase', APP_BASE_URL: `http://127.0.0.1:${port}`, APP_ENV: 'development' }
});
child.on('exit', code => { process.exitCode = code ?? 1; });
