#!/usr/bin/env node
// Appearance evaluation runner (A4). Runs the real provider adapter directly on authorised local images.
// It never writes to any database; the only network call (with --execute) is the configured model request.
//
//   node --import tsx tools/cycle7/appearance-eval.mjs --manifest eval.json --out .local/cycle7/appearance-eval.json
//        [--execute --max-usd 2.50 --input-usd-per-mtok N --output-usd-per-mtok N --image-token-multiplier N]
//        [--limit 20] [--max-images 6] [--detail high|low|auto] [--max-output-tokens 16384] [--patch-cap 30000]
//        [--retries 0] [--ledger .local/cycle7/appearance-eval-ledger.jsonl]
//   node --import tsx tools/cycle7/appearance-eval.mjs --batch <batch-id> --api-base http://127.0.0.1:3000 ...   (read-only, EPS_API_TOKEN)
//
// Dry run is the default: inputs are validated and a per-call worst-case cost estimate is printed; nothing is sent.
// --execute needs OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL (the configured model; nothing is hardcoded) and an
// operator-supplied price table and image-token multiplier taken from the official model and vision pages at run time.
//
// Budget: ONE aggregate --max-usd covers every call, including retries and failed calls. Before each dispatch the
// worst-case cost of that call is estimated (text estimate + image tokens from JPEG dimensions x multiplier, capped by
// the documented 30,000-patch per-image limit, plus --max-output-tokens at the output price). A call whose worst case
// could exceed the remaining budget is never sent. Actual spend uses the usage each response returns (a failure with no
// returned usage is charged at its worst case). Every call, estimate and outcome is appended to the usage ledger.
//
// Manifest: [{ "candidate_id": "...", "images": [{ "path": "a.jpg", "source_kind": "photo" },
//            { "path": "b.jpg", "source_kind": "frame", "frame_timestamp_ms": 1500 }],
//            "supplied": { "hair_length": ["Long"], "hair_colour": ["Dark Brown"], "hair_texture": ["Wavy"], "hair_style": [],
//                          "playing_age": ["Age 25-34"], "skin_tone": "Olive", "tags": ["Dancer"], "stated_gender": "Female" } }]
// The optional "supplied" archive labels drive the comparison report (agreement / abstention / ambiguity per attribute).
// Output describes real people: keep it private and outside source control.
import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeAppearance, appearanceCostUsd, APPEARANCE_LIMITS } from '../../packages/integrations/src/openai-appearance.ts';
import { APPEARANCE_PROMPT } from '../../packages/integrations/src/prompts/appearance-v1.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { normalizeAppearanceLabel } from '../../packages/domain/src/appearance.ts';

export const OFFICIAL_SOURCES = Object.freeze({
  image_inputs: 'https://developers.openai.com/api/docs/guides/images-vision',
  structured_outputs: 'https://developers.openai.com/api/docs/guides/structured-outputs',
  model_page_pattern: 'https://developers.openai.com/api/docs/models/<OPENAI_EXTRACTION_MODEL>',
});
const DOCUMENTED_PATCH_LIMIT = 30_000; // images-vision guide: images over 30,000 patches are rejected

export function parseArgs(argv) {
  const options = { execute: false, limit: 20, maxImages: 6, detail: 'high', maxOutputTokens: 16_384, patchCap: DOCUMENTED_PATCH_LIMIT, retries: 0 };
  const numeric = { '--limit': 'limit', '--max-usd': 'maxUsd', '--max-images': 'maxImages', '--input-usd-per-mtok': 'inputPrice', '--output-usd-per-mtok': 'outputPrice',
    '--image-token-multiplier': 'imageMultiplier', '--max-output-tokens': 'maxOutputTokens', '--patch-cap': 'patchCap', '--retries': 'retries' };
  const text = { '--manifest': 'manifest', '--batch': 'batch', '--api-base': 'apiBase', '--out': 'out', '--detail': 'detail', '--ledger': 'ledger' };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]; const next = () => { const value = argv[++i]; if (value === undefined) throw new Error(`Missing value for ${flag}`); return value; };
    if (flag === '--execute') options.execute = true;
    else if (numeric[flag]) options[numeric[flag]] = Number(next());
    else if (text[flag]) options[text[flag]] = next();
    else throw new Error(`Unknown argument ${flag}`);
  }
  if (!options.manifest === !options.batch) throw new Error('Provide exactly one of --manifest or --batch.');
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 1000) throw new Error('--limit must be 1-1000.');
  if (!Number.isSafeInteger(options.maxImages) || options.maxImages < 1 || options.maxImages > APPEARANCE_LIMITS.images) throw new Error(`--max-images must be 1-${APPEARANCE_LIMITS.images}.`);
  if (!['high', 'low', 'auto'].includes(options.detail)) throw new Error('--detail must be high, low or auto.');
  if (!Number.isSafeInteger(options.maxOutputTokens) || options.maxOutputTokens < 256 || options.maxOutputTokens > 32_768) throw new Error('--max-output-tokens must be 256-32768.');
  if (!Number.isSafeInteger(options.patchCap) || options.patchCap < 1 || options.patchCap > DOCUMENTED_PATCH_LIMIT) throw new Error(`--patch-cap must be 1-${DOCUMENTED_PATCH_LIMIT}.`);
  if (!Number.isSafeInteger(options.retries) || options.retries < 0 || options.retries > 3) throw new Error('--retries must be 0-3.');
  return options;
}

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
/** Width/height from a baseline or progressive JPEG start-of-frame marker. */
export function jpegSize(bytes) {
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1]; const length = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8] };
    if (marker === 0xd8 || marker >= 0xd0 && marker <= 0xd7) { i += 2; continue; }
    i += 2 + length;
  }
  return null;
}
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
    return { candidate_id: entry.candidate_id, supplied: entry.supplied ?? null,
      images: entry.images.slice(0, options.maxImages).map((image, index) => loadImage(resolve(base, image.path), image.source_kind ?? 'photo', image.frame_timestamp_ms, `m${index + 1}`)) };
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
    const observed = (await (await get(`/candidates/${item.candidate_id}/observations`)).json()).data;
    const refs = [...photos.map(photo => ({ kind: 'photo', ts: null, path: `/candidate-photos/${photo.asset_id}/content`, asset: photo.asset_id })),
      ...media.flatMap(tape => tape.available_frames.filter(frame => tape.selected_frame_asset_ids.includes(frame.asset_id)).map(frame => ({ kind: 'frame', ts: frame.timestamp_ms, path: `/media/${frame.asset_id}/content`, asset: frame.asset_id })))].slice(0, options.maxImages);
    const images = [];
    for (const [index, ref] of refs.entries()) {
      const bytes = new Uint8Array(await (await get(ref.path)).arrayBuffer());
      images.push({ media_ref: `m${index + 1}`, asset_id: ref.asset, source_kind: ref.kind, frame_timestamp_ms: ref.ts, sha256: sha(bytes), bytes, path: ref.path });
    }
    const archive = observed.supplied?.archive; const fact = key => observed.supplied?.facts?.find(entry => entry.key === key)?.value ?? null;
    if (images.length) people.push({ candidate_id: item.candidate_id, images, supplied: archive ? { hair_length: archive.hair_length, hair_colour: archive.hair_colour, hair_texture: archive.hair_texture,
      hair_style: archive.hair_style, playing_age: archive.playing_age, skin_tone: archive.skin_tone, tags: archive.tags, stated_gender: fact('stated_gender') } : null });
  }
  return people;
}

/** Worst-case USD for one call: text tokens (generous character estimate), image tokens from the documented patch rule
 * (ceil(w/32) x ceil(h/32), capped) x the operator's multiplier, and the full output budget. Unknown dimensions use the cap. */
export function estimateCallUsd(images, options, prices) {
  const textTokens = Math.ceil((APPEARANCE_PROMPT.length + 4000) / 2) + 200 * images.length;
  const imageTokens = images.reduce((total, image) => { const size = jpegSize(image.bytes);
    const patches = size ? Math.min(options.patchCap, Math.ceil(size.width / 32) * Math.ceil(size.height / 32)) : options.patchCap;
    return total + Math.ceil(patches * options.imageMultiplier); }, 0);
  return { input_tokens: textTokens + imageTokens, output_tokens: options.maxOutputTokens,
    usd: appearanceCostUsd({ input_tokens: textTokens + imageTokens, output_tokens: options.maxOutputTokens }, prices) };
}

// Comparison against supplied archive labels. Only attributes the model may observe are compared; stated gender and tags
// are reported as "not observed by design" so any leakage would be visible, never scored as agreement.
const COMPARED = ['hair_length', 'hair_colour', 'hair_texture', 'playing_age', 'skin_tone'];
const DARK = ['black', 'dark', 'dark_brown'];
function suppliedKeys(attribute, supplied) {
  const labels = [].concat(supplied?.[attribute] ?? []).filter(Boolean);
  const keys = labels.map(label => normalizeAppearanceLabel(attribute, String(label))).filter(Boolean);
  if (attribute === 'hair_length') for (const style of [].concat(supplied?.hair_style ?? [])) if (['bald', 'shaved head'].includes(String(style).toLowerCase())) keys.push('bald_or_shaved');
  return { keys: [...new Set(keys)], unmapped: labels.length - keys.length };
}
function modelKeys(attribute, media) {
  const values = []; let ambiguous = 0;
  for (const item of media) { if (item.ambiguous) { ambiguous++; continue; } for (const person of item.people) values.push(person.attributes[attribute]?.value); }
  const known = values.filter(value => value && value !== 'unknown');
  return { keys: [...new Set(known)], ambiguous, none: values.length === 0 };
}
const agrees = (attribute, supplied, model) => supplied.some(key => model.includes(key)
  || attribute === 'hair_colour' && (key === 'dark' && model.some(value => DARK.includes(value)) || model.includes('dark') && DARK.includes(key)));
export function compareWithSupplied(candidates) {
  const metrics = Object.fromEntries(COMPARED.map(attribute => [attribute, { compared: 0, agree: 0, disagree: 0, model_unknown: 0, supplied_missing: 0, supplied_unmapped: 0, only_ambiguous_media: 0 }]));
  const summary = { candidates_with_supplied: 0, analysed: 0, ambiguous_media: 0, media: 0, not_observed_by_design: { stated_gender: 0, tags: 0 } };
  for (const candidate of candidates) {
    if (candidate.status !== 'analysed') continue; summary.analysed++;
    summary.media += candidate.observations.length; summary.ambiguous_media += candidate.observations.filter(item => item.ambiguous).length;
    if (!candidate.supplied) continue; summary.candidates_with_supplied++;
    if (candidate.supplied.stated_gender) summary.not_observed_by_design.stated_gender++;
    if ([].concat(candidate.supplied.tags ?? []).length) summary.not_observed_by_design.tags++;
    const rows = {};
    for (const attribute of COMPARED) {
      const supplied = suppliedKeys(attribute, candidate.supplied); const model = modelKeys(attribute, candidate.observations); const metric = metrics[attribute];
      metric.supplied_unmapped += supplied.unmapped; let outcome;
      if (!supplied.keys.length) { outcome = model.keys.length ? 'supplied_missing' : 'neither'; if (model.keys.length) metric.supplied_missing++; }
      else if (model.none && model.ambiguous) { outcome = 'only_ambiguous_media'; metric.only_ambiguous_media++; }
      else if (!model.keys.length) { outcome = 'model_unknown'; metric.model_unknown++; }
      else { metric.compared++; outcome = agrees(attribute, supplied.keys, model.keys) ? 'agree' : 'disagree'; metric[outcome]++; }
      rows[attribute] = { supplied: supplied.keys, model: model.keys, outcome };
    }
    candidate.comparison = rows;
  }
  for (const metric of Object.values(metrics)) metric.agreement_rate = metric.compared ? Number((metric.agree / metric.compared).toFixed(4)) : null;
  return { summary, attributes: metrics, note: 'Agreement compares model values on unambiguous media with attributed archive labels; it is not ground truth. Abstentions (unknown) are counted separately and never as agreement.' };
}

export async function runEvaluation(options, environment = process.env, transport = undefined, log = message => process.stderr.write(message + '\n')) {
  const people = options.manifest ? loadManifest(options.manifest, options) : await loadBatch(options);
  const ledgerPath = options.ledger ?? null;
  const ledger = entry => { if (ledgerPath) { mkdirSync(dirname(resolve(ledgerPath)), { recursive: true }); appendFileSync(ledgerPath, JSON.stringify(entry) + '\n'); } };
  const report = { tool: 'appearance-eval', mode: options.execute ? 'execute' : 'dry_run', started_at: new Date().toISOString(), detail: options.detail, official_sources: OFFICIAL_SOURCES,
    model: environment.OPENAI_EXTRACTION_MODEL ?? null, prices: null, image_token_multiplier: options.imageMultiplier ?? null, max_usd: options.maxUsd ?? null, spent_usd: 0,
    stopped_reason: null, calls: 0, ledger: ledgerPath,
    totals: { candidates: people.length, analysed: 0, failed: 0, refused_forbidden: 0, not_dispatched: 0, images: people.reduce((n, p) => n + p.images.length, 0), input_tokens: 0, output_tokens: 0 },
    candidates: [], comparison: null };
  const pricesKnown = [options.inputPrice, options.outputPrice].every(value => Number.isFinite(value) && value >= 0) && Number.isFinite(options.imageMultiplier) && options.imageMultiplier > 0;
  if (!options.execute) {
    for (const person of people) {
      const estimate = pricesKnown ? estimateCallUsd(person.images, options, { input_usd_per_mtok: options.inputPrice, output_usd_per_mtok: options.outputPrice }) : null;
      report.candidates.push({ candidate_id: person.candidate_id, status: 'planned', worst_case_estimate: estimate,
        images: person.images.map(({ bytes, ...rest }) => ({ ...rest, size_bytes: bytes.length, dimensions: jpegSize(bytes) })) });
    }
    if (pricesKnown) report.planned_worst_case_usd = report.candidates.reduce((total, item) => total + item.worst_case_estimate.usd, 0);
    log(`Dry run: ${people.length} candidates, ${report.totals.images} images.${pricesKnown ? ` Worst case ${report.planned_worst_case_usd.toFixed(4)} USD.` : ' Supply prices and --image-token-multiplier for a cost estimate.'} Nothing was sent.`);
    return report;
  }
  if (!pricesKnown) throw new Error('--execute needs the input and output USD per million token prices and --image-token-multiplier from the official model and vision pages.');
  if (!(Number.isFinite(options.maxUsd) && options.maxUsd > 0)) throw new Error('--execute needs --max-usd.');
  if (!environment.OPENAI_API_KEY || !environment.OPENAI_EXTRACTION_MODEL) throw new Error('--execute needs OPENAI_API_KEY and OPENAI_EXTRACTION_MODEL.');
  const prices = { input_usd_per_mtok: options.inputPrice, output_usd_per_mtok: options.outputPrice }; report.prices = prices;
  const config = { apiKey: environment.OPENAI_API_KEY, model: environment.OPENAI_EXTRACTION_MODEL, timeoutMs: 70_000, maxOutputTokens: options.maxOutputTokens };
  outer: for (const person of people) {
    const images = person.images.map(({ path, ...rest }) => rest);
    const entry = { candidate_id: person.candidate_id, supplied: person.supplied, images: person.images.map(({ bytes, ...rest }) => ({ ...rest, size_bytes: bytes.length, dimensions: jpegSize(bytes) })), attempts: [] };
    const estimate = estimateCallUsd(person.images, options, prices); entry.worst_case_estimate = estimate;
    for (let attempt = 0; attempt <= options.retries; attempt++) {
      if (report.spent_usd + estimate.usd > options.maxUsd) {
        report.stopped_reason = 'budget_would_be_exceeded'; if (!entry.status) { entry.status = 'not_dispatched'; report.totals.not_dispatched++; }
        ledger({ at: new Date().toISOString(), candidate_id: person.candidate_id, attempt, dispatched: false, estimate_usd: estimate.usd, spent_usd: report.spent_usd, reason: 'budget_would_be_exceeded' });
        log(`Not sent: ${person.candidate_id} worst case ${estimate.usd.toFixed(4)} USD exceeds the remaining ${(options.maxUsd - report.spent_usd).toFixed(4)} USD.`);
        report.candidates.push(entry); break outer;
      }
      report.calls++;
      try {
        const { result, metadata } = await analyzeAppearance({ candidate_ref: 'eval', input_hash: sha(Buffer.from(images.map(image => image.sha256).join('\n'))), images, detail: options.detail }, config, undefined, transport);
        const cost = appearanceCostUsd(result.usage, prices); report.spent_usd += cost;
        Object.assign(entry, { status: 'analysed', observations: result.media, usage: metadata.usage, cost_usd: cost, metadata: { ...metadata } });
        entry.attempts.push({ attempt, status: 'analysed', cost_usd: cost }); report.totals.analysed++;
        report.totals.input_tokens += result.usage.input_tokens; report.totals.output_tokens += result.usage.output_tokens;
        ledger({ at: new Date().toISOString(), candidate_id: person.candidate_id, attempt, dispatched: true, estimate_usd: estimate.usd, usage: result.usage, cost_usd: cost, spent_usd: report.spent_usd, model: metadata.resolved_model, status: 'analysed' });
        break;
      } catch (error) {
        const details = error instanceof IntegrationError ? error.details : {};
        const usage = Number.isSafeInteger(details.input_tokens) ? { input_tokens: details.input_tokens, output_tokens: Number(details.output_tokens ?? 0) } : null;
        // A failure without returned usage is charged at its worst-case estimate, so the cap stays a hard ceiling.
        const cost = usage ? appearanceCostUsd(usage, prices) : estimate.usd; report.spent_usd += cost;
        const code = error instanceof IntegrationError ? error.code : 'EVAL_ERROR';
        if (usage) { report.totals.input_tokens += usage.input_tokens; report.totals.output_tokens += usage.output_tokens; }
        entry.attempts.push({ attempt, status: 'failed', code, cost_usd: cost, cost_basis: usage ? 'returned_usage' : 'worst_case_estimate' });
        ledger({ at: new Date().toISOString(), candidate_id: person.candidate_id, attempt, dispatched: true, estimate_usd: estimate.usd, usage, cost_usd: cost, cost_basis: usage ? 'returned_usage' : 'worst_case_estimate', spent_usd: report.spent_usd, status: 'failed', code });
        if (!(error instanceof IntegrationError && error.retryable) || attempt === options.retries) {
          Object.assign(entry, { status: code === 'AI_APPEARANCE_FORBIDDEN_INFERENCE' ? 'refused_forbidden' : 'failed', error: { code, message: error instanceof IntegrationError ? error.message : String(error?.message ?? error) } });
          if (code === 'AI_APPEARANCE_FORBIDDEN_INFERENCE') report.totals.refused_forbidden++; else report.totals.failed++;
          break;
        }
      }
    }
    if (!report.candidates.includes(entry)) report.candidates.push(entry);
    log(`${entry.status} ${person.candidate_id}: total ${report.spent_usd.toFixed(4)} USD`);
  }
  report.comparison = compareWithSupplied(report.candidates);
  report.finished_at = new Date().toISOString();
  return report;
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.execute && !options.ledger) options.ledger = '.local/cycle7/appearance-eval-ledger.jsonl';
    const report = await runEvaluation(options);
    const out = options.out ?? '.local/cycle7/appearance-eval.json';
    mkdirSync(dirname(resolve(out)), { recursive: true }); writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
    process.stderr.write(`Wrote ${out}\n`);
  } catch (error) { process.stderr.write(`appearance-eval: ${error?.message ?? error}\n`); process.exitCode = 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
