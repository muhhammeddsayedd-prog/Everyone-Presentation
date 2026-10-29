import process from 'node:process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSpecsRuntimeGateway, readSpecsRuntimeConfig, specsRuntimeFailureDiagnostics, type SpecsRuntimeFailureDiagnostics } from '@eps/central/specs-runtime';
import { openAISpecsConfigFromEnv, openAIMediaConfigFromEnv } from '@eps/integrations';
import { N8nSpecsOrchestrator } from './n8n-orchestrator.ts';
import { runSpecsWorker, specsWorkerFilesConfiguration } from './runtime.ts';
import { createCandidateStageAssets } from './candidate-assets.ts';
import type { CandidateStageOptions } from './candidate-stage-executor.ts';
import type { FrameStageOptions } from './frame-stage-executor.ts';
import type { ReviewStageOptions } from './review-stage-executor.ts';
import type { ReviewFitStageOptions } from './review-fit-stage-executor.ts';
import type { SpecsStageRouter } from './runtime-types.ts';
import { createPresentationStageAssets } from './presentation-assets.ts';
import type { PresentationStageOptions } from './presentation-stage-executor.ts';

const startupCodes = new Set(['WORKER_RUNTIME_SCOPE_INVALID','OPENAI_KEY_REQUIRED','OPENAI_EXTRACTION_MODEL_REQUIRED','OPENAI_CONFIGURATION_INVALID',
  'N8N_RUNTIME_CONFIGURATION_REQUIRED','RUNTIME_CONFIG_INVALID','RUNTIME_AUTH_UNVERIFIED','RUNTIME_ROLE_UNVERIFIED','RUNTIME_UNAVAILABLE','DEPENDENCY_UNAVAILABLE', 'CANDIDATE_RUNTIME_CONFIGURATION_INVALID', 'FRAME_RUNTIME_CONFIGURATION_INVALID', 'PDF_VISION_CONFIGURATION_INVALID', 'REVIEW_RUNTIME_CONFIGURATION_INVALID', 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID']);
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
    const specsRouter = new N8nSpecsOrchestrator({ url: environment.N8N_DISPATCH_URL ?? '', secret: environment.N8N_DISPATCH_SECRET ?? '' });
    let router: SpecsStageRouter = specsRouter;
    checkpoint = 'file_configuration'; const fileConfiguration = specsWorkerFilesConfiguration(environment);
    const visionEnabled = environment.EPS_PDF_VISION_ENABLED;
    if (visionEnabled !== undefined && visionEnabled !== 'true' && visionEnabled !== 'false' || visionEnabled === 'true' && (!fileConfiguration || !/^sha256:[a-f0-9]{64}$/u.test(environment.EPS_PDF_RASTER_IMAGE_ID ?? ''))) throw { code: 'PDF_VISION_CONFIGURATION_INVALID' };
    const vision = visionEnabled === 'true' ? { imageId: environment.EPS_PDF_RASTER_IMAGE_ID! } : undefined;
    const enabled = environment.EPS_CANDIDATE_MEDIA_ENABLED;
    if (enabled !== undefined && enabled !== 'false' && enabled !== 'true') throw { code: 'CANDIDATE_RUNTIME_CONFIGURATION_INVALID' };
    const framesEnabled = environment.EPS_FRAME_EXTRACTION_ENABLED;
    if (framesEnabled !== undefined && framesEnabled !== 'false' && framesEnabled !== 'true' || framesEnabled === 'true' && (!fileConfiguration || !/^sha256:[a-f0-9]{64}$/u.test(environment.EPS_FRAME_IMAGE_ID ?? ''))) throw { code: 'FRAME_RUNTIME_CONFIGURATION_INVALID' };
    let candidateConfiguration: Omit<CandidateStageOptions, 'assets'> | undefined;
    if (enabled === 'true') {
      if (!fileConfiguration || !/^sha256:[a-f0-9]{64}$/u.test(environment.EPS_MEDIA_IMAGE_ID ?? '')) throw { code: 'CANDIDATE_RUNTIME_CONFIGURATION_INVALID' };
      const transcription = openAIMediaConfigFromEnv('transcription', environment); const extraction = openAIMediaConfigFromEnv('extraction', environment);
      candidateConfiguration = { imageId: environment.EPS_MEDIA_IMAGE_ID!, transcription, extraction };
    }
    if (enabled === 'true' || framesEnabled === 'true') {
      const candidateRouter = new N8nSpecsOrchestrator({ url: environment.N8N_CANDIDATE_DISPATCH_URL ?? '', secret: environment.N8N_CANDIDATE_DISPATCH_SECRET ?? '' });
      if (environment.N8N_CANDIDATE_DISPATCH_SECRET === environment.N8N_DISPATCH_SECRET || environment.N8N_CANDIDATE_DISPATCH_URL === environment.N8N_DISPATCH_URL) throw { code: 'CANDIDATE_RUNTIME_CONFIGURATION_INVALID' };
      router = { route: (envelope, signal) => envelope.kind === 'candidate_scan' || envelope.kind === 'frame_extract' ? candidateRouter.route(envelope, signal) : specsRouter.route(envelope, signal) };
    }
    let review: Omit<ReviewStageOptions, 'signal'> | undefined; let fit: Omit<ReviewFitStageOptions, 'signal'> | undefined;
    const reviewEnabled = environment.EPS_REVIEW_ENABLED;
    if (reviewEnabled !== undefined && reviewEnabled !== 'true' && reviewEnabled !== 'false') throw { code: 'REVIEW_RUNTIME_CONFIGURATION_INVALID' };
    if (reviewEnabled === 'true') {
      let destination: URL; let base: URL;
      try { destination = new URL(environment.N8N_REVIEW_DISPATCH_URL ?? ''); base = new URL(environment.N8N_DISPATCH_URL ?? ''); } catch { throw { code: 'REVIEW_RUNTIME_CONFIGURATION_INVALID' }; }
      if (destination.origin !== base.origin || destination.pathname !== '/webhook/eps-wf05-review-suggestion-stage-v1' || !/^[a-f0-9]{64}$/u.test(environment.N8N_REVIEW_DISPATCH_SECRET ?? '')
        || [environment.N8N_DISPATCH_SECRET, environment.N8N_CANDIDATE_DISPATCH_SECRET].includes(environment.N8N_REVIEW_DISPATCH_SECRET)
        || [environment.N8N_DISPATCH_URL, environment.N8N_CANDIDATE_DISPATCH_URL].includes(environment.N8N_REVIEW_DISPATCH_URL)) throw { code: 'REVIEW_RUNTIME_CONFIGURATION_INVALID' };
      const reviewRouter = new N8nSpecsOrchestrator({ url: environment.N8N_REVIEW_DISPATCH_URL!, secret: environment.N8N_REVIEW_DISPATCH_SECRET! });
      const prior = router; router = { route: (envelope, signal) => envelope.kind === 'ai_suggestion' || envelope.kind === 'review_fit' ? reviewRouter.route(envelope, signal) : prior.route(envelope, signal) };
      review = { openAI: openAIMediaConfigFromEnv('extraction', environment) }; fit = {};
    }
    const presentationEnabled = environment.EPS_PRESENTATION_ENABLED;
    if (presentationEnabled !== undefined && presentationEnabled !== 'true' && presentationEnabled !== 'false') throw { code: 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID' };
    if (presentationEnabled === 'true') {
      let destination: URL; let base: URL;
      try { destination = new URL(environment.N8N_PRESENTATION_DISPATCH_URL ?? ''); base = new URL(environment.N8N_DISPATCH_URL ?? ''); } catch { throw { code: 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID' }; }
      if (!fileConfiguration || destination.origin !== base.origin || destination.pathname !== '/webhook/eps-wf03-presentation-stage-v1' || !/^[a-f0-9]{64}$/u.test(environment.N8N_PRESENTATION_DISPATCH_SECRET ?? '')
        || [environment.N8N_DISPATCH_SECRET, environment.N8N_CANDIDATE_DISPATCH_SECRET, environment.N8N_REVIEW_DISPATCH_SECRET].includes(environment.N8N_PRESENTATION_DISPATCH_SECRET)
        || [environment.N8N_DISPATCH_URL, environment.N8N_CANDIDATE_DISPATCH_URL, environment.N8N_REVIEW_DISPATCH_URL].includes(environment.N8N_PRESENTATION_DISPATCH_URL)) throw { code: 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID' };
      const presentationRouter = new N8nSpecsOrchestrator({ url: environment.N8N_PRESENTATION_DISPATCH_URL!, secret: environment.N8N_PRESENTATION_DISPATCH_SECRET! });
      const prior = router; router = { route: (envelope, signal) => envelope.kind === 'presentation_render' ? presentationRouter.route(envelope, signal) : prior.route(envelope, signal) };
    }
    checkpoint = 'gateway_verification'; const configuration = readSpecsRuntimeConfig(environment);
    let gateway: Awaited<ReturnType<typeof createSpecsRuntimeGateway>> | undefined;
    // Only pre-work availability may retry. Each failed factory closes its own
    // pool; no claim, recovery, n8n request or provider execution has begun.
    for (attempts = 1; attempts <= 3; attempts++) {
      try { gateway = await createGateway(configuration, {}, fileConfiguration, undefined, enabled === 'true' || framesEnabled === 'true', presentationEnabled === 'true'); break; }
      catch (error) { const code = startupCode(error);
        if (attempts === 3 || code !== 'RUNTIME_UNAVAILABLE' && code !== 'DEPENDENCY_UNAVAILABLE') throw error;
        await wait(attempts * 500);
      }
    }
    if (!gateway) throw new Error('Gateway startup unconfirmed.');
    let candidate: CandidateStageOptions | undefined;
    let frames: FrameStageOptions | undefined;
    if (candidateConfiguration && fileConfiguration) {
      const port = gateway.candidateFiles;
      if (!port || typeof port.getAssetAccess !== 'function' || typeof port.reserveOutput !== 'function' || typeof port.completeOutput !== 'function') { await gateway.close(); throw { code: 'CANDIDATE_RUNTIME_CONFIGURATION_INVALID' }; }
      candidate = { ...candidateConfiguration, assets: createCandidateStageAssets(port, { publishableKey: fileConfiguration.publishableKey }) };
    }
    if (framesEnabled === 'true' && fileConfiguration) {
      const port = gateway.candidateFiles;
      if (!port || typeof port.getAssetAccess !== 'function' || typeof port.reserveOutput !== 'function' || typeof port.completeOutput !== 'function') { await gateway.close(); throw { code: 'FRAME_RUNTIME_CONFIGURATION_INVALID' }; }
      frames = { imageId: environment.EPS_FRAME_IMAGE_ID!, assets: createCandidateStageAssets(port, { publishableKey: fileConfiguration.publishableKey }) };
    }
    let presentation: Omit<PresentationStageOptions, 'signal'> | undefined;
    if (presentationEnabled === 'true' && fileConfiguration) {
      const port = gateway.presentationFiles;
      if (!port || typeof port.getAssetAccess !== 'function' || typeof port.reserveOutput !== 'function' || typeof port.completeOutput !== 'function') { await gateway.close(); throw { code: 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID' }; }
      presentation = { assets: createPresentationStageAssets(port, { publishableKey: fileConfiguration.publishableKey }) };
    }
    return { openAI, router, fileConfiguration, gateway, candidate, frames, vision, review, fit, presentation };
  } catch (error) {
    throw new SpecsWorkerStartupError(checkpoint, startupCode(error), filesRequested, attempts, specsRuntimeFailureDiagnostics(error));
  }
}

/** Server-only entry. Provider/DB/webhook credentials arrive by a scrubbed child
 * environment; the n8n management key is never an acceptable runtime input. */
async function main(): Promise<void> {
  const { openAI, router, fileConfiguration, gateway, candidate, frames, vision, review, fit, presentation } = await verifySpecsWorkerStartup();
  const controller = new AbortController();
  const stop = () => controller.abort();
  const message = (value: unknown) => { if (value && typeof value === 'object' && Object.keys(value).length === 1
    && 'type' in value && value.type === 'shutdown') stop(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop); process.once('disconnect', stop); process.on('message', message);
  process.stdout.write(JSON.stringify({ event: 'specs_worker_started', authentication: 'narrow_database_login', orchestration: 'n8n_required' }) + '\n');
  try { await runSpecsWorker(gateway, router, { openAI, signal: controller.signal, review, fit, presentation,
    candidate: candidate ? { ...candidate, onDiagnostic: value => process.stdout.write(JSON.stringify({ event: value.error_kind === 'native' ? 'candidate_video_processing_failed' : 'candidate_stage_processing_failed', ...value }) + '\n') } : undefined,
    frames: frames ? { ...frames, onDiagnostic: value => process.stdout.write(JSON.stringify({ event: 'frame_processing_failed', ...value }) + '\n') } : undefined,
    vision: vision ? { ...vision, onMetadata: metadata => process.stdout.write(JSON.stringify({ event: 'document_vision_page_processed', ...metadata }) + '\n') } : undefined,
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
