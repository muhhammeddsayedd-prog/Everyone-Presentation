import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import test from 'node:test';
import type { ReviewSlide } from '../../packages/domain/src/review-types.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import { editorialExpectations } from '../../apps/worker/src/editorial-template.ts';
import { castingFixtureReview, fixtureId } from '../fixtures/editorial-decks.ts';

/** Opt-in: EPS_EDITORIAL_SQL_CONTAINER names a disposable local Postgres container where
 * supabase/migrations/20261113120000_m13_editorial_template_1_3.sql is applied (see
 * development/editorial-template/staging/build_staging_1_3.py). Never a shared, staging or cloud database. */
const container = process.env.EPS_EDITORIAL_SQL_CONTAINER;
type Review = ReturnType<typeof castingFixtureReview>;

function snapshotOf(review: Review) {
  const slide = (item: ReviewSlide) => ({ kind: item.kind, role_id: item.role_id, slot_id: item.slot_id, role_category: item.role_category ?? null, position: item.position,
    frames: item.frames, video_asset_id: item.video_asset_id, fields: item.fields, requirements: item.requirements });
  return { template: { key: 'everyone-casting', version: '1.3.0' }, cover: review.cover, slides: [{ kind: 'cover' }, ...review.slides.map(slide)] };
}

/** Deterministic pseudo-random generator, so a failure names a reproducible seed. */
function random(seed: number) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; }; }
const VALUES = ['', '   ', 'Not provided', ' Not provided ', '28', '168 cm', 'Arabic; English', 'Riyadh', 'Lead', ' Cairo　',
  'Commercial and short film work; comfortable with improvisation and live audiences', 'نور الهدى', '🎬 Actor 🎭', 'x'.repeat(26), 'x'.repeat(27), 'y'.repeat(30), 'y'.repeat(31), 'z'.repeat(120)];
const REQUIREMENTS = ['age_range', 'gender_requirement', 'appearance_performance', 'languages', 'accents', 'skills', 'scene_references', 'shoot_dates', 'location', 'availability_requirements', 'other_instructions'] as const;

function generated(seed: number): Review {
  const next = random(seed); const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const base = castingFixtureReview({ logo: next() < 0.4, everySlide: next() < 0.5 });
  if (!base.cover.logo_asset_id && next() < 0.3) base.cover.client_name = pick(['', '  ', 'Synthetic Client']);
  const template = base.slides[0]; const slides: ReviewSlide[] = []; let n = 0;
  const roles = 1 + Math.floor(next() * 5);
  for (let r = 0; r < roles; r++) {
    const role = { id: next() < 0.1 ? null : fixtureId(900 + r), name: `Role ${r}`, category: pick([null, 'Lead cast', 'Lead cast', 'Featured cast', '  ', ' Lead cast\t']) };
    const slots = Math.floor(next() * 4);
    if (!slots) { slides.push({ ...structuredClone(base.slides[7]), role_id: role.id, role_name: role.name, role_category: role.category, requirements: requirementsOf(next, pick) }); continue; }
    for (let s = 0; s < slots; s++) {
      const slot = { id: next() < 0.08 ? null : fixtureId(950 + r * 10 + s), label: `Slot ${s}` };
      const people = Math.floor(next() * 8);
      if (!people) { slides.push({ ...structuredClone(base.slides[6]), role_id: role.id, role_name: role.name, role_category: role.category, slot_id: slot.id, slot_label: slot.label, requirements: requirementsOf(next, pick) }); continue; }
      for (let p = 0; p < people; p++) {
        const item = structuredClone(template); n++;
        const fields = Object.fromEntries(slideWordingFields.map(key => [key, next() < 0.5 ? pick(VALUES) : 'Not provided'])) as ReviewSlide['fields'];
        fields.name_or_id = next() < 0.9 ? `Person ${n}` : pick(VALUES);
        const frames = Math.floor(next() * 4);
        slides.push({ ...item, role_id: role.id, role_name: role.name, role_category: role.category, slot_id: slot.id, slot_label: slot.label, assignment_id: fixtureId(1000 + n),
          position: pick(['main', 'backup', 'option', null] as const), fields, source_fields: fields, frames: item.frames.slice(0, 1).flatMap(frame => Array.from({ length: frames }, (_, f) => ({ ...frame, asset_id: `frame-${n}-${f}` }))),
          video_asset_id: next() < 0.6 ? fixtureId(2000 + n) : null });
      }
    }
  }
  return { ...base, slides };
}
function requirementsOf(next: () => number, pick: <T>(items: readonly T[]) => T): ReviewSlide['requirements'] {
  return Object.fromEntries(REQUIREMENTS.map(key => [key, next() < 0.4 ? null : next() < 0.5 ? pick(VALUES) : Array.from({ length: Math.floor(next() * 3) }, () => pick(VALUES))])) as unknown as ReviewSlide['requirements'];
}

function sqlCounts(review: Review) {
  const literal = JSON.stringify(snapshotOf(review)).replaceAll("'", "''");
  // Sent on stdin: large snapshots exceed the Windows command-line limit.
  return JSON.parse(execFileSync('docker', ['exec', '-i', container!, 'psql', '-U', 'postgres', '-h', 'localhost', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { encoding: 'utf8', input: `select eps.editorial_deck_counts_1_3('${literal}'::jsonb);`, maxBuffer: 1 << 24 }));
}

test('SQL eps.editorial_deck_counts_1_3 agrees with the 1.3.0 composer on every proof count', { skip: !container && 'EPS_EDITORIAL_SQL_CONTAINER not set' }, () => {
  const reviews: [string, Review][] = [['fixture', castingFixtureReview()], ['fixture logo every slide', castingFixtureReview({ logo: true, everySlide: true })]];
  for (let seed = 1; seed <= 300; seed++) reviews.push([`seed ${seed}`, generated(seed)]);
  let grouped = 0;
  for (const [name, review] of reviews) {
    const ts = editorialExpectations({ ...review, template: { version: '1.3.0' } });
    grouped += ts.deck.pages.filter(page => page.layout === 'cast_group_detail').length;
    const sql = sqlCounts(review);
    assert.deepEqual({ pages: sql.pages, frames: sql.frame_draws, logos: sql.logo_draws, regions: sql.text_regions, images: sql.frame_draws + sql.logo_draws + sql.placeholder_draws, fields: sql.candidate_fields },
      { pages: ts.page_count, frames: ts.frame_draw_count, logos: ts.logo_draw_count, regions: ts.text_regions, images: ts.image_draws, fields: ts.candidate_field_count }, name);
  }
  // The generator must exercise slot pages, not only single-person fallbacks.
  assert.ok(grouped > 50, `only ${grouped} slot pages generated`);
});

test('m13 registers exactly the pinned 1.3.0 registry identity and fonts', async () => {
  const { readFileSync } = await import('node:fs');
  const registry = JSON.parse(readFileSync('packages/templates/versions/1.3.0/registry.json', 'utf8')) as { content_sha256: string; font_key: string; fonts: { path: string; sha256: string }[] };
  const sql = readFileSync('supabase/migrations/20261113120000_m13_editorial_template_1_3.sql', 'utf8');
  const row = /values\('everyone-casting','1\.3\.0',\s*'([a-f0-9]{64})','([^']+)',\s*'(\{[^']+\})'::jsonb\)/u.exec(sql);
  assert.ok(row, 'template row literal');
  assert.equal(row[1], registry.content_sha256); assert.equal(row[2], registry.font_key);
  assert.deepEqual(JSON.parse(row[3]), Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])));
});
