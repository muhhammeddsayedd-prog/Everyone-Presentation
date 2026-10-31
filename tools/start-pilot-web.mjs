import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { assertHostedPilotConfig } from '../apps/web/lib/hosting-pilot.ts';

const root = path.resolve(import.meta.dirname, '..');

/** Separate controlled-pilot entrypoint. tools/start-web.mjs continues to refuse
 * ordinary production release while its acceptance evidence is incomplete. */
export function pilotWebStartPlan(env, now = Date.now()) {
  assertHostedPilotConfig(env, now);
  const port = env.PORT ?? '3000';
  if (!/^[1-9][0-9]{0,4}$/u.test(port) || Number(port) > 65535) throw new Error('PILOT_CONFIGURATION_REQUIRED: use a bounded pilot listener port.');
  return { command: process.execPath, args: [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', port],
    cwd: path.join(root, 'apps/web') };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const plan = pilotWebStartPlan(process.env);
    const child = spawn(plan.command, plan.args, { cwd: plan.cwd, stdio: 'inherit', env: process.env });
    child.on('error', () => { process.stderr.write('Controlled pilot startup failed; private values suppressed.\n'); process.exitCode = 1; });
    child.on('exit', code => { process.exitCode = code ?? 1; });
  } catch { process.stderr.write('PILOT_CONFIGURATION_REQUIRED: controlled pilot startup refused.\n'); process.exitCode = 1; }
}
