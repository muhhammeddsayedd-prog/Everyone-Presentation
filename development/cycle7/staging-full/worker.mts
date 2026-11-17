// Runs a worker build (this checkout or another, e.g. the previous release) against the cycle-7 staging stack.
//
// Real: the worker's runtime gateway SQL (claim/heartbeat/finish/recover on the narrow eps_specs_runtime login), the
// stage executors (review fit, presentation prepare/render/validate/publish, guest export), private Storage reads and
// writes over HTTP with the minted capability tokens, and Chromium rendering.
// Substituted (stated in every report):
//   * database connection: plain TCP to eps-c7stg-db as eps_specs_runtime (hosted: TLS through the Supavisor pooler);
//   * storage origin: requests the worker builds for https://pyibofyctwnqpvktepse.supabase.co are rewritten to the
//     staging gateway. Every other non-loopback host is REFUSED, so production is never contacted;
//   * n8n: the work-order webhook is answered locally with the same mapping the WF01/WF03/WF05 workflows return
//     (envelope fields + execution id + fixed handler). No provider (OpenAI) call is possible: api.openai.com is refused
//     and no provider-backed stage is enabled.
// Usage (from the checkout whose worker you want to run):
//   npx tsx <cycle7>/development/cycle7/staging-full/worker.mts [--once] [--exports]
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const S = path.resolve(here, '../../../.local/cycle7/stg');
const target = process.cwd();
const secrets = JSON.parse(readFileSync(path.join(S, 'secrets.json'), 'utf8'));
const PROD = 'https://pyibofyctwnqpvktepse.supabase.co';
const GATEWAY = 'http://127.0.0.1:55511';
const PUBLISHABLE = 'sb_publishable_c7staginglocal01';
const handlers: Record<string, string> = { prepare_document: 'native.prepare_document', extract_specs: 'openai.extract_specs', apply_specs: 'domain.apply_specs',
  prepare_candidate: 'native.prepare_candidate', transcribe_candidate: 'openai.transcribe_candidate', extract_candidate: 'openai.extract_candidate', select_frames: 'openai.select_frames', apply_candidate: 'domain.apply_candidate', extract_frames: 'native.extract_frames', apply_frames: 'domain.apply_frames',
  prepare_suggestion: 'domain.prepare_suggestion', generate_suggestion: 'openai.generate_suggestion', validate_suggestion: 'domain.validate_suggestion', measure_review_fit: 'native.measure_review_fit',
  prepare_presentation: 'native.prepare_presentation', render_presentation: 'native.render_presentation', validate_presentation: 'native.validate_presentation', publish_presentation: 'domain.publish_presentation', render_export: 'native.render_export', analyze_appearance: 'openai.analyze_appearance' };

// --- outbound network boundary -------------------------------------------------------------------------------------
const realFetch = globalThis.fetch;
const traffic: Record<string, number> = {};
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  let next: URL;
  if (url.origin === PROD) next = new URL(GATEWAY + url.pathname + url.search);
  else if (['127.0.0.1', 'localhost'].includes(url.hostname)) next = url;
  else throw new Error(`STAGING_BOUNDARY: outbound request to ${url.host} refused`);
  const key = `${init?.method ?? 'GET'} ${next.pathname.split('/').slice(0, 5).join('/')}`; traffic[key] = (traffic[key] ?? 0) + 1;
  if (typeof input !== 'string' && !(input instanceof URL)) return realFetch(new Request(next, input), init);
  return realFetch(next, init);
}) as typeof fetch;
let executions = 0;
const n8nTransport = (async (_url: RequestInfo | URL, init?: RequestInit) => {
  const envelope = JSON.parse(String(init?.body));
  const order = { schema_version: '1.0', event_id: envelope.event_id, job_id: envelope.job_id, kind: envelope.kind, stage: envelope.stage,
    input_hash: envelope.input_hash, correlation_id: envelope.correlation_id, workflow_execution_id: `staging-local-${++executions}`, handler: handlers[envelope.stage] };
  return new Response(JSON.stringify(order), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

// --- build the worker from the target checkout --------------------------------------------------------------------
const imp = (rel: string) => import(pathToFileURL(path.join(target, rel)).href);
const centralRequire = createRequire(path.join(target, 'packages/central/package.json'));
const { Pool } = centralRequire('pg');
const gatewayModule = await imp('packages/central/src/specs-runtime-gateway.ts');
const { N8nSpecsOrchestrator } = await imp('apps/worker/src/n8n-orchestrator.ts');
const { runSpecsWorker, processNextSpecsStage } = await imp('apps/worker/src/runtime.ts');
const { createPresentationStageAssets } = await imp('apps/worker/src/presentation-assets.ts');
const caPem = readFileSync(path.join(S, 'ca.pem'), 'utf8').replace(/\r\n/g, '\n');
const config = { host: gatewayModule.SPECS_RUNTIME_HOST, password: secrets.runtime, caPem };
const poolFactory = (pg: Record<string, unknown>) => new Pool({ ...pg, host: '127.0.0.1', port: 55510, user: 'eps_specs_runtime', ssl: false,
  enableChannelBinding: false, sslnegotiation: undefined, Client: undefined });
const exportsEnabled = process.argv.includes('--exports');
const fileConfiguration = { storageOrigin: PROD, publishableKey: PUBLISHABLE };
const gateway = await gatewayModule.createSpecsRuntimeGateway(config, { poolFactory }, fileConfiguration, undefined, false, true, exportsEnabled);
const route = (pathname: string) => new N8nSpecsOrchestrator({ url: `https://n8n.staging.invalid/webhook/${pathname}`, secret: 'staging-local-dispatch-secret-not-used-0000' }, n8nTransport);
const specs = route('eps-wf01-specs-stage-v1'), review = route('eps-wf05-review-suggestion-stage-v1'), presentation = route('eps-wf03-presentation-stage-v1');
const router = { route: (envelope: { kind: string }, signal?: AbortSignal) =>
  envelope.kind === 'ai_suggestion' || envelope.kind === 'review_fit' ? review.route(envelope, signal)
  : envelope.kind === 'presentation_render' || envelope.kind === 'presentation_export' ? presentation.route(envelope, signal) : specs.route(envelope, signal) };
const pdf = await imp('apps/worker/src/presentation-pdf.ts');
const debug = process.env.EPS_STG_DEBUG === '1';
// Debug only: log the class/code/message of a stage error (never bytes, tokens or URLs) before the executor classifies it.
const traced = (name: string, fn: (...a: unknown[]) => Promise<unknown>) => async (...a: unknown[]) => { try { return await fn(...a); } catch (error) {
  const e = error as { name?: string; code?: string; message?: string }; process.stdout.write(JSON.stringify({ event: 'stage_debug_error', step: name, name: e?.name, code: e?.code, message: String(e?.message ?? '').replace(/https?:\/\/\S+/g, '<url>').slice(0, 300) }) + '\n'); throw error; } };
const assets = createPresentationStageAssets(gateway.presentationFiles, { publishableKey: PUBLISHABLE });
const tracedAssets = debug ? { read: traced('assets.read', assets.read.bind(assets)), write: traced('assets.write', assets.write.bind(assets)) } : assets;
const presentationOptions = debug ? { assets: tracedAssets, prepare: traced('prepare', pdf.preparePresentationAssets), render: traced('render', pdf.renderPresentationPdf), validate: traced('validate', pdf.validatePresentationPdf) } : { assets };
const options = { openAI: { apiKey: 'staging-no-provider', model: 'staging-no-provider' }, review: { openAI: { apiKey: 'staging-no-provider', model: 'staging-no-provider' } }, fit: {},
  presentation: presentationOptions, presentationExport: exportsEnabled ? { assets } : undefined,
  files: undefined, pollMs: 1000, recoverMs: 5000,
  notice: (event: Record<string, unknown>) => process.stdout.write(JSON.stringify({ t: new Date().toISOString(), ...event }) + '\n') };
process.stdout.write(JSON.stringify({ event: 'staging_worker_started', checkout: target, exports: exportsEnabled }) + '\n');
const controller = new AbortController();
process.on('SIGINT', () => controller.abort()); process.on('SIGTERM', () => controller.abort());
if (process.argv.includes('--once')) {
  for (let i = 0; i < 40; i++) { const notice = await processNextSpecsStage(gateway, router, { ...options, signal: controller.signal }); options.notice(notice); if (notice.event === 'idle') break; }
} else {
  await runSpecsWorker(gateway, router, { ...options, signal: controller.signal });
}
await gateway.close();
process.stdout.write(JSON.stringify({ event: 'staging_worker_stopped', traffic }) + '\n');
