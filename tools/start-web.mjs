import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { assertHostedDeploymentConfig } from '../apps/web/lib/hosting-pilot.ts';

const root = path.resolve(import.meta.dirname, '..');

export function productionWebStartPlan(env) {
  if (env.EPS_RELEASE_MODE !== 'production') throw new Error('Production start denied: configure the explicit production release.');
  assertHostedDeploymentConfig(env);
  const port = env.PORT ?? '3000';
  if (!/^[1-9][0-9]{0,4}$/u.test(port) || Number(port) > 65535) throw new Error('Production start denied: configure a valid listener port.');
  return { command: process.execPath,
    args: [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', port],
    cwd: path.join(root, 'apps/web') };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const plan = productionWebStartPlan(process.env);
    const child = spawn(plan.command, plan.args, { cwd: plan.cwd, stdio: 'inherit', env: process.env, shell: false, windowsHide: true });
    const interrupt = () => { child.kill('SIGINT'); };
    const terminate = () => { child.kill('SIGTERM'); };
    const cleanup = () => { process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', terminate); process.removeListener('disconnect', terminate); };
    process.once('SIGINT', interrupt); process.once('SIGTERM', terminate); process.once('disconnect', terminate);
    child.once('error', () => { cleanup(); process.stderr.write('Production startup failed; private values suppressed.\n'); process.exitCode = 1; });
    child.once('exit', code => { cleanup(); process.exitCode = code ?? 1; });
  } catch { process.stderr.write('Production start denied: valid central production configuration is required.\n'); process.exitCode = 1; }
}
