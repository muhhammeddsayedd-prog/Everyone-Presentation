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
