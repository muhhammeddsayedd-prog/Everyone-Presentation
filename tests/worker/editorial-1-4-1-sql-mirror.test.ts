import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { editorialExpectations } from '../../apps/worker/src/editorial-template.ts';
import { captionHeight, LABELLED_HEIGHT, LEADING_HEIGHT } from '../../packages/templates/versions/1.4.1/compose-casting.ts';
import { generatedCaptioned, HEIGHTS } from '../fixtures/captioned-generator.ts';
import { captionedShowcase } from '../fixtures/captioned-review.ts';

/** Opt-in: EPS_EDITORIAL_SQL_CONTAINER names the disposable replica container where m23 is applied
 * (EPS_REPLICA_CONTAINER, development/cycle7/staging/replica.py). Never a shared, staging or cloud database. */
const container = process.env.EPS_EDITORIAL_SQL_CONTAINER;
const MIGRATION = 'supabase/migrations/20261119110000_m23_editorial_template_1_4_1.sql';

/** The frozen snapshot fields the mirror reads (slides with cover and the caption facts, cover, presentation). */
function snapshotOf(review: WorkspaceReview) {
  return { template: { key: 'everyone-casting', version: '1.4.1' }, cover: review.cover, presentation: review.presentation,
    slides: [{ kind: 'cover' }, ...review.slides.map(item => ({ kind: item.kind, role_id: item.role_id, slot_id: item.slot_id, position: item.position, frames: item.frames, video_asset_id: item.video_asset_id, fields: item.kind === 'candidate' ? item.fields : null }))] };
}
function psql(sql: string) {
  return execFileSync('docker', ['exec', '-i', container!, 'psql', '-U', 'postgres', '-h', 'localhost', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'], { encoding: 'utf8', input: sql, maxBuffer: 1 << 26 });
}
const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;

test('SQL eps.editorial_deck_counts_1_4_1 agrees with the 1.4.1 composer on every proof count', { skip: !container && 'EPS_EDITORIAL_SQL_CONTAINER not set' }, () => {
  const reviews: [string, WorkspaceReview][] = [['showcase', captionedShowcase()]];
  for (let seed = 1; seed <= 300; seed++) reviews.push([`seed ${seed}`, generatedCaptioned(seed)]);
  // One round trip: every snapshot's SQL counts in order.
  const rows = psql(`select eps.editorial_deck_counts_1_4_1(s) from jsonb_array_elements(${literal(reviews.map(([, review]) => snapshotOf(review)))}) with ordinality x(s,o) order by o;`).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, reviews.length);
  let captioned = 0;
  reviews.forEach(([name, review], n) => {
    const ts = editorialExpectations({ ...review, template: { version: '1.4.1' } }); const plain = editorialExpectations({ ...review, template: { version: '1.4.0' } }); const sql = rows[n];
    assert.deepEqual({ pages: sql.pages, frames: sql.frame_draws, logos: sql.logo_draws, regions: sql.text_regions, images: sql.frame_draws + sql.logo_draws + sql.placeholder_draws, fields: sql.candidate_fields, links: sql.video_links },
      { pages: ts.page_count, frames: ts.frame_draw_count, logos: ts.logo_draw_count, regions: ts.text_regions, images: ts.image_draws, fields: ts.candidate_field_count, links: ts.video_link_count }, name);
    assert.equal(ts.page_count, plain.page_count, `${name}: captions never change the page count`);
    if (ts.text_regions > plain.text_regions) captioned++;
  });
  assert.ok(captioned > 200, `captioned decks: ${captioned}`);
});

test('SQL eps.editorial141_has_height agrees with captionHeight on every measurement form', { skip: !container && 'EPS_EDITORIAL_SQL_CONTAINER not set' }, () => {
  const values = [...new Set([...HEIGHTS.filter((value): value is string => value !== undefined), 'Height: 72 in.', '6ft2', 'Hauteur 170 cm', '١٧٣', '170 centimetres tall', 'Weight: 60; Height - 1,68 m', 'Height:  180 mm', 'PENDING', '   ', 'xheight: 180'])];
  const sql = psql(`select string_agg(eps.editorial141_has_height(to_jsonb(v))::text,',' order by o) from jsonb_array_elements_text(${literal(values)}) with ordinality x(v,o);`).trim().split(',');
  assert.deepEqual(sql, values.map(value => String(captionHeight(value) !== null)));
});

test('m23 registers exactly the pinned 1.4.1 registry identity and fonts, and mirrors the composer height grammar verbatim', () => {
  const registry = JSON.parse(readFileSync('packages/templates/versions/1.4.1/registry.json', 'utf8')) as { content_sha256: string; font_key: string; fonts: { path: string; sha256: string }[] };
  const sql = readFileSync(MIGRATION, 'utf8');
  const row = /values\('everyone-casting','1\.4\.1',\s*'([a-f0-9]{64})','([^']+)',\s*'(\{[^']+\})'::jsonb,true\)/u.exec(sql);
  assert.ok(row, 'template row literal');
  assert.equal(row[1], registry.content_sha256); assert.equal(row[2], registry.font_key);
  assert.deepEqual(JSON.parse(row[3]), Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])));
  const patterns = [...sql.matchAll(/~\*\$re\$(.*?)\$re\$/gu)].map(match => match[1]);
  assert.deepEqual(patterns, [LABELLED_HEIGHT.source, LEADING_HEIGHT.source]);
  assert.equal(LABELLED_HEIGHT.flags, 'i'); assert.equal(LEADING_HEIGHT.flags, 'i');
  // m23 never changes the Settings default and refuses a second run.
  assert.doesNotMatch(sql, /update eps\.app_settings/u); assert.match(sql, /M23_ALREADY_APPLIED/u);
});
