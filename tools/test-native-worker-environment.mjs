import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { createSpecsWorkerEnvironment } from './worker-runtime-env.mjs';
const root = path.resolve(import.meta.dirname, '..');
const environment = createSpecsWorkerEnvironment({ OPENAI_API_KEY: 'synthetic-private-not-for-native', OPENAI_EXTRACTION_MODEL: 'synthetic-unused-model' },
  { EPS_SPECS_PG_HOST: 'synthetic-unused', EPS_SPECS_PG_PASSWORD: 'synthetic-private-not-for-native', EPS_SPECS_PG_CA_BASE64: 'synthetic-unused', N8N_DISPATCH_URL: 'synthetic-unused', N8N_DISPATCH_SECRET: 'synthetic-private-not-for-native' }, process.env);
assert.equal(environment.PATH, ''); assert.equal(environment.Path, undefined); assert.equal(environment.DOCKER_HOST, undefined);
const entry = path.join(root, 'tools/test-native-worker-environment-child.ts');
const report = await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['--import', 'tsx', entry], { cwd: root, env: environment, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = []; let length = 0; let problem = false; const timer = setTimeout(() => { problem = true; child.kill(); }, 60_000);
  child.on('error', () => { problem = true; }); child.stdout.on('data', chunk => { length += chunk.length; if (length > 65536) { problem = true; child.kill(); } else output.push(chunk); }); child.stderr.on('data', () => {});
  child.on('close', code => { clearTimeout(timer); if (problem || code !== 0) { let safe='CHILD_UNCONFIRMED'; try { const value=JSON.parse(Buffer.concat(output).toString('utf8')); if(/^[A-Z_]{1,100}$/u.test(value.code))safe=value.code; }catch{ /* Do not expose private child diagnostics. */ } reject(new Error(`Scrubbed native worker verification failed: ${safe}`)); } else { try { resolve(JSON.parse(Buffer.concat(output).toString('utf8'))); } catch { reject(new Error('Scrubbed worker protocol failed.')); } } });
});
const summary = { observed_at: new Date().toISOString(), scope: 'Native PDF execution inside a child using the actual scrubbed worker environment projector, synthetic credentials only', passed: true,
  parent_path_inherited: false, docker_host_from_environment: false, docker_configuration: 'fixed project-local empty configuration', provider_called: false, database_called: false, hosted: false, ...report };
const directory = path.join(root, 'tracking/evidence/m02/scrubbed-native-worker'); await mkdir(directory, { recursive: true }); await writeFile(path.join(directory, `${summary.observed_at.replace(/[:.]/gu, '-')}.json`), JSON.stringify(summary, null, 2) + '\n'); process.stdout.write(JSON.stringify(summary) + '\n');
