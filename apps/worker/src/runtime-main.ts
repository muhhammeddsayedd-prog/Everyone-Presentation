import process from 'node:process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig, specsRuntimeFailureDiagnostics, type SpecsRuntimeFailureDiagnostics } from '@eps/central/specs-runtime';
import { openAISpecsConfigFromEnv } from '@eps/integrations';
import { N8nSpecsOrchestrator } from './n8n-orchestrator.ts';
import { runSpecsWorker, specsWorkerFilesConfiguration } from './runtime.ts';

const startupCodes = new Set(['WORKER_RUNTIME_SCOPE_INVALID','OPENAI_KEY_REQUIRED','OPENAI_EXTRACTION_MODEL_REQUIRED','OPENAI_CONFIGURATION_INVALID',
  'N8N_RUNTIME_CONFIGURATION_REQUIRED','RUNTIME_CONFIG_INVALID','RUNTIME_AUTH_UNVERIFIED','RUNTIME_ROLE_UNVERIFIED','RUNTIME_UNAVAILABLE','DEPENDENCY_UNAVAILABLE']);
function startupCode(error: unknown): string {
  try { const code = error !== null && typeof error === 'object' && 'code' in error ? error.code : undefined;
    return typeof code === 'string' && startupCodes.has(code) ? code : 'WORKER_STARTUP_UNCONFIRMED'; }
  catch { return 'WORKER_STARTUP_UNCONFIRMED'; }
}
type StartupCheckpoint = 'runtime_scope' | 'provider_configuration' | 'orchestration_configuration' | 'file_configuration' | 'gateway_verification';
export class SpecsWorkerStartupError extends Error {
  readonly gateway_phase?: string; readonly transport_code?: string; readonly elapsed_ms?: number;
  constructor(readonly checkpoint: StartupCheckpoint, readonly code: string, readonly files_requested: boolean, readonly attempts = 0,
    diagnostic: SpecsRuntimeFailureDiagnostics = {}) {
    super('Specs worker startup could not be confirmed. Private diagnostics are suppressed.'); this.name = 'SpecsWorkerStartupError';
    const safe = specsRuntimeFailureDiagnostics(diagnostic); this.gateway_phase = safe.gateway_phase; this.transport_code = safe.transport_code; this.elapsed_ms = safe.elapsed_ms;
  }
}
/** Validate the exact startup path without polling, recovering, claiming,
 * contacting n8n/OpenAI/Storage, or reading job/source data. The returned
 * context contains server configuration and must never be serialized. */
export async function verifySpecsWorkerStartup(environment: Readonly<Record<string, string | undefined>> = process.env,
  createGateway: typeof createSpecsRuntimeGateway = createSpecsRuntimeGateway,
  wait: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))) {
  let checkpoint: StartupCheckpoint = 'runtime_scope';
  let attempts = 0;
  const filesRequested = environment.EPS_SPECS_FILES_ENABLED === 'true';
  try {
    if (environment.N8N_API_KEY || !/^v24\./u.test(process.version)) throw Object.assign(new Error('Worker scope invalid.'), { code: 'WORKER_RUNTIME_SCOPE_INVALID' });
    checkpoint = 'provider_configuration'; const openAI = openAISpecsConfigFromEnv(environment);
    checkpoint = 'orchestration_configuration';
    const router = new N8nSpecsOrchestrator({ url: environment.N8N_DISPATCH_URL ?? '', secret: environment.N8N_DISPATCH_SECRET ?? '' });
    checkpoint = 'file_configuration'; const fileConfiguration = specsWorkerFilesConfiguration(environment);
    checkpoint = 'gateway_verification'; const configuration = readSpecsRuntimeConfig(environment);
    let gateway: Awaited<ReturnType<typeof createSpecsRuntimeGateway>> | undefined;
    // Only pre-work availability may retry. Each failed factory closes its own
    // pool; no claim, recovery, n8n request or provider execution has begun.
    for (attempts = 1; attempts <= 3; attempts++) {
      try { gateway = await createGateway(configuration, {}, fileConfiguration); break; }
      catch (error) { const code = startupCode(error);
        if (attempts === 3 || code !== 'RUNTIME_UNAVAILABLE' && code !== 'DEPENDENCY_UNAVAILABLE') throw error;
        await wait(attempts * 500);
      }
    }
    if (!gateway) throw new Error('Gateway startup unconfirmed.');
    return { openAI, router, fileConfiguration, gateway };
  } catch (error) {
    throw new SpecsWorkerStartupError(checkpoint, startupCode(error), filesRequested, attempts, specsRuntimeFailureDiagnostics(error));
  }
}

/** Server-only entry. Provider/DB/webhook credentials arrive by a scrubbed child
 * environment; the n8n management key is never an acceptable runtime input. */
async function main(): Promise<void> {
  const { openAI, router, fileConfiguration, gateway } = await verifySpecsWorkerStartup();
  const controller = new AbortController();
  const stop = () => controller.abort();
  const message = (value: unknown) => { if (value && typeof value === 'object' && Object.keys(value).length === 1
    && 'type' in value && value.type === 'shutdown') stop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('disconnect', stop); process.on('message', message);
  process.stdout.write(JSON.stringify({ event: 'specs_worker_started', authentication: 'narrow_database_login', orchestration: 'n8n_required' }) + '\n');
  try { await runSpecsWorker(gateway, router, { openAI, signal: controller.signal,
    files: fileConfiguration && gateway.files ? { port: gateway.files, publishableKey: fileConfiguration.publishableKey } : undefined,
    notice: event => process.stdout.write(JSON.stringify(event) + '\n') }); }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); process.removeListener('disconnect', stop); process.removeListener('message', message);
    if (process.connected) process.disconnect(); }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch(error => {
  const diagnostic = error instanceof SpecsWorkerStartupError
    ? { checkpoint: error.checkpoint, code: error.code, files_requested: error.files_requested, attempts: error.attempts, ...specsRuntimeFailureDiagnostics(error) }
    : { checkpoint: 'processing_loop', code: 'WORKER_STARTUP_UNCONFIRMED', files_requested: process.env.EPS_SPECS_FILES_ENABLED === 'true' };
  process.stderr.write(JSON.stringify({ event: 'specs_worker_start_failed', ...diagnostic }) + '\n'); process.exitCode = 1;
});
