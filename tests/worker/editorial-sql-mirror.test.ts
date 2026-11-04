import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import type { ReviewSlide } from '../../packages/domain/src/review-types.ts';
import { editorialExpectations } from '../../apps/worker/src/editorial-template.ts';
import { castingFixtureReview } from '../fixtures/editorial-decks.ts';

/** Opt-in: EPS_EDITORIAL_SQL_CONTAINER names a disposable local Postgres container
 * where supabase/migrations/20261104210000_m08_editorial_template.sql is applied.
 * Never a shared, staging or cloud database. */
const container = process.env.EPS_EDITORIAL_SQL_CONTAINER;
type Review = ReturnType<typeof castingFixtureReview>;
function snapshotOf(review: Review) {
  const slide = (item: ReviewSlide) => ({ kind: item.kind, role_id: item.role_id, slot_id: item.slot_id, role_category: item.role_category ?? null, position: item.position, frames: item.frames, video_asset_id: item.video_asset_id });
  return { template: { key: 'everyone-casting', version: '1.2.0' }, cover: review.cover, slides: [{ kind: 'cover' }, ...review.slides.map(slide)] };
}
function variants(): [string, Review][] {
  const base = castingFixtureReview(); const result: [string, Review][] = [['base', base], ['logo cover', castingFixtureReview({ logo: true })], ['logo every slide', castingFixtureReview({ logo: true, everySlide: true })]];
  const empty = structuredClone(base); empty.cover.client_name = ''; result.push(['empty client name', empty]);
  const spaced = structuredClone(base); spaced.slides.forEach(item => { item.role_category = item.role_category ? `  ${item.role_category}\t` : '   '; }); result.push(['whitespace categories', spaced]);
  const big = structuredClone(base); const template = big.slides[3];
  for (let n = 0; n < 6; n++) big.slides.splice(4, 0, { ...structuredClone(template), assignment_id: `extra-${n}`, candidate_id: `extra-${n}`, position: 'option', frames: n % 2 ? [] : template.frames });
  result.push(['seven options in one slot', big]);
  const nullRoles = structuredClone(base); nullRoles.slides.forEach(item => { item.role_id = null; item.slot_id = null; }); result.push(['no roles or slots', nullRoles]);
  return result;
}

test('SQL eps.editorial_deck_counts agrees with the TypeScript composer on every proof count', { skip: !container && 'EPS_EDITORIAL_SQL_CONTAINER not set' }, () => {
  for (const [name, review] of variants()) {
    const ts = editorialExpectations(review);
    const literal = JSON.stringify(snapshotOf(review)).replaceAll("'", "''");
    const sql = JSON.parse(execFileSync('docker', ['exec', container!, 'psql', '-U', 'postgres', '-h', 'localhost', '-d', 'postgres', '-Atc', `select eps.editorial_deck_counts('${literal}'::jsonb)`], { encoding: 'utf8' }));
    assert.deepEqual({ pages: sql.pages, frames: sql.frame_draws, logos: sql.logo_draws, regions: sql.text_regions, images: sql.frame_draws + sql.logo_draws + sql.placeholder_draws, fields: sql.candidate_fields },
      { pages: ts.page_count, frames: ts.frame_draw_count, logos: ts.logo_draw_count, regions: ts.text_regions, images: ts.image_draws, fields: ts.candidate_field_count }, name);
  }
});
