/** Materialize the already-created CLI migration from the reviewed rollback source. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
const ROOT = path.resolve(import.meta.dirname, '..');
const CANDIDATE = 'development/m03/candidates-candidate.sql';
const MIGRATION = 'supabase/migrations/20261029090724_m03_candidate_library.sql';
const PROOF = 'tracking/evidence/m03/candidate-local/2026-10-29T09-04-40-827Z-25b670e9.json';
const hash = value => createHash('sha256').update(value).digest('hex');
assert.equal(process.argv.length, 2);
const candidate = await readFile(path.join(ROOT, CANDIDATE), 'utf8');
const proof = JSON.parse(await readFile(path.join(ROOT, PROOF), 'utf8'));
assert(proof.result === 'passed' && proof.rollback_verified && proof.cloud_called === false);
assert.equal(hash(candidate), proof.source_seals[CANDIDATE]);
assert.equal((await readFile(path.join(ROOT, MIGRATION), 'utf8')).trim(), '');
const marker = "  or current_setting('eps.m03_candidate_rehearsal',true) is distinct from 'rollback-only-v1'\n";
assert.equal(candidate.split(marker).length, 2);
const source = '-- M03 canonical candidate library. Additive coordinated migration after reviewed14.\n'
  + '-- Rehearsed locally with synthetic profiles and exact rollback; no seed/runtime enablement.\n'
  + candidate.slice(candidate.indexOf('set local lock_timeout')).replace(marker, '')
    .replace('M03_LOCAL14_ROLLBACK_BASELINE_REQUIRED', 'M03_REVIEWED_FOURTEEN_VERSION_BASELINE_REQUIRED');
await writeFile(path.join(ROOT, MIGRATION), source);
process.stdout.write(JSON.stringify({ migration: MIGRATION, sha256: hash(source), candidate_sha256: hash(candidate), proof: PROOF }) + '\n');
