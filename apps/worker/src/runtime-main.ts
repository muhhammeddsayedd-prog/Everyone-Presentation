import process from 'node:process';
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig } from '@eps/central/specs-runtime';
import { openAISpecsConfigFromEnv } from '@eps/integrations';
import { N8nSpecsOrchestrator } from './n8n-orchestrator.ts';
import { runSpecsWorker } from './runtime.ts';

/** Server-only entry. Provider/DB/webhook credentials arrive by a scrubbed child
 * environment; the n8n management key is never an acceptable runtime input. */
async function main(): Promise<void> {
  if (process.env.N8N_API_KEY || !/^v24\./u.test(process.version)) throw new Error('WORKER_RUNTIME_SCOPE_INVALID');
  const openAI = openAISpecsConfigFromEnv();
  const router = new N8nSpecsOrchestrator({ url: process.env.N8N_DISPATCH_URL ?? '', secret: process.env.N8N_DISPATCH_SECRET ?? '' });
  const gateway = await createSpecsRuntimeGateway(readSpecsRuntimeConfig(process.env));
  const controller = new AbortController();
  const stop = () => controller.abort();
  const message = (value: unknown) => { if (value && typeof value === 'object' && Object.keys(value).length === 1
    && 'type' in value && value.type === 'shutdown') stop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('disconnect', stop); process.on('message', message);
  process.stdout.write(JSON.stringify({ event: 'specs_worker_started', authentication: 'narrow_database_login', orchestration: 'n8n_required' }) + '\n');
  try { await runSpecsWorker(gateway, router, { openAI, signal: controller.signal,
    notice: event => process.stdout.write(JSON.stringify(event) + '\n') }); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); process.removeListener('disconnect', stop); process.removeListener('message', message);
    if (process.connected) process.disconnect(); }
}
main().catch(() => { process.stderr.write('Specs worker stopped before confirming runtime access or processing. Private diagnostics are suppressed.\n'); process.exitCode = 1; });
