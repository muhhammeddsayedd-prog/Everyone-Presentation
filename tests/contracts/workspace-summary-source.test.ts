import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Summary35 admits temporary public CREATE only when the owner did not already have it', async () => {
  const sql = await readFile('supabase/migrations/20261031182038_m07_workspace_summary.sql', 'utf8');
  const admission = sql.slice(0, sql.indexOf('create function public.eps_get_workspace_summary'));
  assert.match(admission, /or has_schema_privilege\('eps_review_owner',\s*'public',\s*'CREATE'\)/u,
    'Fail closed before GRANT/REVOKE so a preexisting CREATE privilege cannot be removed.');
  assert.ok(sql.indexOf('M07_SUMMARY_EXACT_REVIEWED34_REQUIRED') < sql.indexOf('grant create on schema public'));
  assert.equal((sql.match(/grant create on schema public to eps_review_owner/gu) ?? []).length, 1);
  assert.equal((sql.match(/revoke create on schema public from eps_review_owner/gu) ?? []).length, 1);
  assert.doesNotMatch(sql, /\b(?:create|alter)\s+role\b|\b(?:create|alter|drop)\s+policy\b/iu);
});

test('Summary fixture supplies presentation asset identities required by the existing typed-purpose constraint', async () => {
  const migration = await readFile('supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql', 'utf8');
  const fixture = await readFile('tests/db/m07-workspace-summary.sql', 'utf8');
  const definition = /definition:=replace\(definition,'ELSE false',E'([\s\S]+?)'\);/u.exec(migration)?.[1].replaceAll("''", "'");
  assert.ok(definition, 'Use the existing M05 typed-purpose branches, not a duplicate test schema.');
  const asset = /insert into eps\.media_assets\(([^)]+)\)[\s\S]+?;/u.exec(fixture);
  assert.ok(asset);
  const columns = new Set(asset[1].split(',').map(value => value.trim()));
  for (const purpose of ['presentation_manifest', 'presentation_pdf']) {
    const branch = new RegExp(`WHEN '${purpose}'::text THEN ([\\s\\S]*?)(?=WHEN |ELSE false)`, 'u').exec(definition)?.[1];
    assert.ok(branch);
    const required = [...branch.matchAll(/\b([a-z_]+) IS NOT NULL/gu)].map(match => match[1]);
    assert.ok(required.includes('producing_job_id') && required.includes('producing_attempt_id'));
    for (const column of required) assert.ok(columns.has(column), `${purpose} requires explicit ${column} in this Ready-asset fixture.`);
    for (const column of ['output_stage', 'output_key']) assert.ok(columns.has(column));
  }
  assert.ok(fixture.indexOf('insert into eps.jobs') < asset.index, 'Producing jobs must exist before the asset FK is inserted.');
  assert.match(asset[0], /'render_presentation'/u);
});
