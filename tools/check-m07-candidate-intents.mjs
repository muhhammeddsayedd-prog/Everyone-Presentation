import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import process from 'node:process';
import { URL } from 'node:url';
import { log } from 'node:console';

const requireWeb = createRequire(new URL('../apps/web/package.json', import.meta.url));
const Ajv2020 = requireWeb('ajv/dist/2020').default;
const addFormats = requireWeb('ajv-formats').default;

// Optional immutable Git input permits a source-bound RED replay without
// modifying current contracts or importing any private runtime configuration.
const revision = process.argv[2];
if (process.argv.length > 3 || revision !== undefined && !/^[a-f0-9]{40}$/u.test(revision)) throw new Error('Use an optional exact Git commit.');
const source = revision ? execFileSync('git', ['show', `${revision}:contracts/mcp-tool-catalog.json`], { maxBuffer: 16 * 1024 * 1024 }).toString('utf8')
  : await readFile(new URL('../contracts/mcp-tool-catalog.json', import.meta.url), 'utf8');
const catalog = JSON.parse(source);
const facts = { name: 'Supplied name', casting_id: null, age_or_range: null, stated_gender: null, height_measurements: null,
  languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
const cases = [
  ['update_candidate', { candidate_id: 'synthetic-candidate', body: { row_version: 1, facts } }],
  ['update_candidate_frames', { candidate_media_id: 'synthetic-media', body: { row_version: 1, selected_frame_asset_ids: [] } }],
  ['update_workspace_candidate', { workspace_candidate_id: 'synthetic-project-candidate', body: { row_version: 1, availability: 'Friday' } }],
];
const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
const results = cases.map(([name, input]) => {
  const validate = ajv.compile(catalog.tools.find(tool => tool.name === name).inputSchema);
  const accepts_key = validate({ ...input, idempotency_key: 'synthetic-stable-update-intent' });
  const key_errors = (validate.errors ?? []).map(error => ({ path: error.instancePath, rule: error.keyword, unexpected: error.params.additionalProperty ?? null }));
  const accepts_missing_key = validate(input);
  return { name, accepts_key, accepts_missing_key, key_errors, pass: accepts_key && !accepts_missing_key };
});
log(JSON.stringify({ scope: 'Synthetic JSON Schema only; no app/provider/cloud calls', source: revision ?? 'current', results }, null, 2));
process.exitCode = results.every(result => result.pass) ? 0 : 1;
