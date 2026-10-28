import { spawn } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3100'], {
  cwd: path.join(root, 'apps/web'), stdio: 'inherit',
  env: { ...process.env, CENTRAL_ADAPTER_MODE: 'local_fixture', APP_BASE_URL: 'http://127.0.0.1:3100',
    APP_ENV: 'test', EPS_TEST_SERVER: 'true', EPS_DATA_DIR: path.join(root, '.local/e2e-studio') }
});
child.on('exit', code => { process.exitCode = code ?? 1; });
