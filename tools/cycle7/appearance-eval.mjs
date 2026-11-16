#!/usr/bin/env node
// Appearance evaluation runner (A4). Runs the real provider adapter directly on authorised local images.
// It never writes to any database and never uploads anything except the images it sends to the configured model.
//
//   node --import tsx tools/cycle7/appearance-eval.mjs --manifest eval.json --out .local/cycle7/appearance-eval.json
//        [--execute] [--limit 20] [--max-usd 2.50] [--input-usd-per-mtok N --output-usd-per-mtok N]
//        [--max-images 6] [--detail high|low|auto]
//   node --import tsx tools/cycle7/appearance-eval.mjs --batch <batch-id> --api-base http://127.0.0.1:3000 --out ... (reads with EPS_API_TOKEN, read-only)
//
// Dry run is the default: it validates the inputs and prints what would be sent, without any provider call.
// --execute needs OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL (the configured extraction model; nothing is hardcoded),
// plus a price table (flags or EPS_EVAL_INPUT_USD_PER_MTOK / EPS_EVAL_OUTPUT_USD_PER_MTOK) and --max-usd.
// The hard stop is computed from the usage each response returns: no further call starts once the spent total, plus the
// most expensive call so far, would exceed --max-usd.
//
// Manifest: [{ "candidate_id": "...", "images": [{ "path": "photos/a.jpg", "source_kind": "photo" },
//            { "path": "frames/b.jpg", "source_kind": "frame", "frame_timestamp_ms": 1500 }] }]
// Paths are relative to the manifest. Only JPEG files are accepted. Output contains observations, usage and cost
// (no image bytes); it still describes real people, so keep it private and outside source control.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeAppearance, appearanceCostUsd, APPEARANCE_LIMITS } from '../../packages/integrations/src/openai-appearance.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';

export function parseArgs(argv) {
  const options = { execute: false, limit: 20, maxImages: 6, detail: 'high' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]; const next = () => { const value = argv[++i]; if (value === undefined) throw new Error(`Missing value for ${flag}`); return value; };
    if (flag === '--execute') options.execute = true;
    else if (flag === '--manifest') options.manifest = next();
    else if (flag === '--batch') options.batch = next();
    else if (flag === '--api-base') options.apiBase = next();
    else if (flag === '--out') options.out = next();
    else if (flag === '--limit') options.limit = Number(next());
    else if (flag === '--max-usd') options.maxUsd = Number(next());
    else if (flag === '--max-images') options.maxImages = Number(next());
    else if (flag === '--detail') options.detail = next();
    else if (flag === '--input-usd-per-mtok') options.inputPrice = Number(next());
    else if (flag === '--output-usd-per-mtok') options.outputPrice = Number(next());
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!options.manifest === !options.batch) throw new Error('Provide exactly one of --manifest or --batch.');
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 1000) throw new Error('--limit must be 1-1000.');
  if (!Number.isSafeInteger(options.maxImages) || options.maxImages < 1 || options.maxImages > APPEARANCE_LIMITS.images) throw new Error(`--max-images must be 1-${APPEARANCE_LIMITS.images}.`);
  if (!['high', 'low', 'auto'].includes(options.detail)) throw new Error('--detail must be high, low or auto.');
  return options;
}

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function loadImage(path, kind, timestamp, ref) {
  const bytes = new Uint8Array(readFileSync(path));
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new Error(`Not a JPEG: ${path}`);
  if (bytes.length > APPEARANCE_LIMITS.imageBytes) throw new Error(`Image larger than ${APPEARANCE_LIMITS.imageBytes} bytes: ${path}`);
  if (!['photo', 'frame'].includes(kind)) throw new Error(`source_kind must be photo or frame: ${path}`);
  return { media_ref: ref, asset_id: sha(bytes).slice(0, 32), source_kind: kind, frame_timestamp_ms: kind === 'frame' ? Number(timestamp ?? 0) : null, sha256: sha(bytes), bytes, path };
}
export function loadManifest(file, options) {
  const base = dirname(resolve(file)); const entries = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('The manifest must be an array.');
  return entries.slice(0, options.limit).map(entry => {
    if (!entry || typeof entry.candidate_id !== 'string' || !Array.isArray(entry.images) || !entry.images.length) throw new Error('Each manifest entry needs candidate_id and images.');
    return { candidate_id: entry.candidate_id, images: entry.images.slice(0, options.maxImages).map((image, index) => loadImage(resolve(base, image.path), image.source_kind ?? 'photo', image.frame_timestamp_ms, `m${index + 1}`)) };
  });
}
// Read-only batch mode through the app API with the operator's own session token (no database credential).
async function loadBatch(options, fetcher = fetch) {
  const base = options.apiBase ?? process.env.EPS_API_BASE_URL; const token = process.env.EPS_API_TOKEN;
  if (!base || !token) throw new Error('Batch mode needs --api-base (or EPS_API_BASE_URL) and EPS_API_TOKEN.');
  const get = async path => { const response = await fetcher(new URL(`/api/v1${path}`, base), { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, redirect: 'error' });
    if (!response.ok) throw new Error(`GET ${path} failed with ${response.status}`); return response; };
  const batch = (await (await get(`/enrichment-batches/${encodeURIComponent(options.batch)}`)).json()).data;
  const people = [];
  for (const item of batch.items.slice(0, options.limit)) {
    const photos = (await (await get(`/candidates/${item.candidate_id}/photos`)).json()).data;
    const media = (await (await get(`/candidates/${item.candidate_id}/media?limit=100`)).json()).data;
    const refs = [...photos.map(photo => ({ asset: photo.asset_id, kind: 'photo', ts: null, path: `/candidate-photos/${photo.asset_id}/content` })),
      ...media.flatMap(tape => tape.available_frames.filter(frame => tape.selected_frame_asset_ids.includes(frame.asset_id)).map(frame => ({ asset: frame.asset_id, kind: 'frame', ts: frame.timestamp_ms, path: `/media/${frame.asset_id}/content` })))].slice(0, options.maxImages);
    const images = [];
    for (const [index, ref] of refs.entries()) {
      const bytes = new Uint8Array(await (await get(ref.path)).arrayBuffer());
      images.push({ media_ref: `m${index + 1}`, asset_id: ref.asset, source_kind: ref.kind, frame_timestamp_ms: ref.ts, sha256: sha(bytes), bytes, path: ref.path });
    }
    if (images.length) people.push({ candidate_id: item.candidate_id, images });
  }
  return people;
}

export async function runEvaluation(options, environment = process.env, transport = undefined, log = message => process.stderr.write(message + '\n')) {
  const people = options.manifest ? loadManifest(options.manifest, options) : await loadBatch(options);
  const report = { tool: 'appearance-eval', mode: options.execute ? 'execute' : 'dry_run', started_at: new Date().toISOString(), detail: options.detail,
    model: environment.OPENAI_EXTRACTION_MODEL ?? null, prices: null, max_usd: options.maxUsd ?? null, spent_usd: 0, stopped_reason: null,
    totals: { candidates: people.length, analysed: 0, failed: 0, images: people.reduce((n, p) => n + p.images.length, 0), input_tokens: 0, output_tokens: 0 }, candidates: [] };
  if (!options.execute) {
    for (const person of people) report.candidates.push({ candidate_id: person.candidate_id, status: 'planned', images: person.images.map(({ bytes, ...rest }) => ({ ...rest, size_bytes: bytes.length })) });
    log(`Dry run: ${people.length} candidates, ${report.totals.images} images. Nothing was sent. Add --execute to call the configured model.`);
    return report;
  }
  const inputPrice = options.inputPrice ?? Number(environment.EPS_EVAL_INPUT_USD_PER_MTOK); const outputPrice = options.outputPrice ?? Number(environment.EPS_EVAL_OUTPUT_USD_PER_MTOK);
  if (![inputPrice, outputPrice].every(value => Number.isFinite(value) && value >= 0)) throw new Error('--execute needs the input and output USD per million token prices.');
  if (!(Number.isFinite(options.maxUsd) && options.maxUsd > 0)) throw new Error('--execute needs --max-usd.');
  if (!environment.OPENAI_API_KEY || !environment.OPENAI_EXTRACTION_MODEL) throw new Error('--execute needs OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL.');
  report.prices = { input_usd_per_mtok: inputPrice, output_usd_per_mtok: outputPrice };
  const config = { apiKey: environment.OPENAI_API_KEY, model: environment.OPENAI_EXTRACTION_MODEL, timeoutMs: 70_000 };
  let largest = 0;
  for (const person of people) {
    if (report.spent_usd + largest > options.maxUsd) { report.stopped_reason = 'max_usd'; log(`Stopping: spent ${report.spent_usd.toFixed(4)} USD; another call could exceed ${options.maxUsd}.`); break; }
    const images = person.images.map(({ path, ...rest }) => rest);
    const entry = { candidate_id: person.candidate_id, images: person.images.map(({ bytes, ...rest }) => ({ ...rest, size_bytes: bytes.length })) };
    try {
      const { result, metadata } = await analyzeAppearance({ candidate_ref: 'eval', input_hash: sha(Buffer.from(images.map(image => image.sha256).join('\n'))), images, detail: options.detail }, config, undefined, transport);
      const cost = appearanceCostUsd(result.usage, report.prices);
      Object.assign(entry, { status: 'analysed', observations: result.media, usage: metadata.usage, cost_usd: cost, metadata: { ...metadata } });
      report.spent_usd += cost; largest = Math.max(largest, cost); report.totals.analysed++;
      report.totals.input_tokens += result.usage.input_tokens; report.totals.output_tokens += result.usage.output_tokens;
    } catch (error) {
      const details = error instanceof IntegrationError ? error.details : {};
      const usage = Number.isSafeInteger(details.input_tokens) ? { input_tokens: details.input_tokens, output_tokens: Number(details.output_tokens ?? 0) } : null;
      const cost = usage ? appearanceCostUsd(usage, report.prices) : 0;
      Object.assign(entry, { status: 'failed', error: { code: error instanceof IntegrationError ? error.code : 'EVAL_ERROR', message: error instanceof IntegrationError ? error.message : String(error?.message ?? error) }, usage, cost_usd: cost });
      report.spent_usd += cost; largest = Math.max(largest, cost); report.totals.failed++;
    }
    report.candidates.push(entry);
    log(`${entry.status} ${person.candidate_id}: ${(entry.cost_usd ?? 0).toFixed(4)} USD (total ${report.spent_usd.toFixed(4)})`);
  }
  report.finished_at = new Date().toISOString();
  return report;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const report = await runEvaluation(options);
    const out = options.out ?? '.local/cycle7/appearance-eval.json';
    mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`Wrote ${out}\n`);
  } catch (error) { process.stderr.write(`appearance-eval: ${error?.message ?? error}\n`); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
