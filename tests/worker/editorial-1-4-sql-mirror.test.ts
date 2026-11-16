import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { editorialExpectations } from '../../apps/worker/src/editorial-template.ts';
import { floward, referenceReview, type RefPerson, type RefRole, type RefScene } from '../fixtures/reference-review.ts';

/** Opt-in: EPS_EDITORIAL_SQL_CONTAINER names the disposable cycle-7 replica container where m19 is applied
 * (EPS_REPLICA_CONTAINER, development/cycle7/staging/replica.py). Never a shared, staging or cloud database. */
const container = process.env.EPS_EDITORIAL_SQL_CONTAINER;

/** The frozen snapshot fields the mirror reads (slides with cover, cover, presentation). */
function snapshotOf(review: WorkspaceReview) {
  return { template: { key: 'everyone-casting', version: '1.4.0' }, cover: review.cover, presentation: review.presentation,
    slides: [{ kind: 'cover' }, ...review.slides.map(item => ({ kind: item.kind, role_id: item.role_id, slot_id: item.slot_id, position: item.position, frames: item.frames, video_asset_id: item.video_asset_id }))] };
}
function random(seed: number) { let state = seed >>> 0; return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; }; }
const NOTES = [undefined, null, '', '   ', 'We’ll choose Only One.', ' Missing. '];

/** Random roles (0-3 slots of 0-8 people with any position), pictures (frame, photo, none, deliberately empty),
 * notes, and scenes with auto/repeat/hidden occurrences, settings and sequences. */
export function generated(seed: number): WorkspaceReview {
  const next = random(seed); const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const roles: RefRole[] = Array.from({ length: 1 + Math.floor(next() * 6) }, (_, r) => ({
    name: `Role ${r}`, note: pick(NOTES) as string | null,
    slotNotes: Array.from({ length: 3 }, () => pick(NOTES) as string | null),
    slots: Array.from({ length: Math.floor(next() * 4) }, () => Array.from({ length: Math.floor(next() * 9) }, (): RefPerson => {
      const picture = next();
      return { position: pick(['main', 'backup', 'option', 'option'] as const), frame: picture > 0.15, portrait: picture > 0.7 ? 'photo' : picture > 0.55 ? 'frame' : null,
        ...next() < 0.1 ? { state: 'intentionally_empty' as const } : {} };
    })),
  }));
  const scenes: RefScene[] = next() < 0.25 ? [] : Array.from({ length: 1 + Math.floor(next() * 4) }, (_, s) => ({
    title: `Scene ${s}`, sequence: pick([null, null, 'Birthday', 'Workshop', '  ']), setting: pick([null, 'Kitchen', 'Garden']),
    occurrences: [...new Set(Array.from({ length: Math.floor(next() * 4) }, () => Math.floor(next() * (roles.length + 1))))].map(role => ({
      role, placement: pick(['auto', 'auto', 'repeat', 'hidden'] as const), note: pick(NOTES) as string | null, setting: pick([null, 'Front Door']) })),
  }));
  return referenceReview(roles, { scenes, coverNote: pick(NOTES) as string | null, logo: next() < 0.5 });
}
function sqlCounts(review: WorkspaceReview) {
  const literal = JSON.stringify(snapshotOf(review)).replaceAll("'", "''");
  return JSON.parse(execFileSync('docker', ['exec', '-i', container!, 'psql', '-U', 'postgres', '-h', 'localhost', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-f', '-'],
    { encoding: 'utf8', input: `select eps.editorial_deck_counts_1_4('${literal}'::jsonb);`, maxBuffer: 1 << 24 }));
}

test('SQL eps.editorial_deck_counts_1_4 agrees with the 1.4.0 composer on every proof count', { skip: !container && 'EPS_EDITORIAL_SQL_CONTAINER not set' }, () => {
  const reviews: [string, WorkspaceReview][] = [['floward', floward()]];
  for (let seed = 1; seed <= 300; seed++) reviews.push([`seed ${seed}`, generated(seed)]);
  const layouts = new Map<string, number>();
  for (const [name, review] of reviews) {
    const ts = editorialExpectations({ ...review, template: { version: '1.4.0' } });
    for (const page of ts.deck.pages) layouts.set(page.layout, (layouts.get(page.layout) ?? 0) + 1);
    const sql = sqlCounts(review);
    assert.deepEqual({ pages: sql.pages, frames: sql.frame_draws, logos: sql.logo_draws, regions: sql.text_regions, images: sql.frame_draws + sql.logo_draws + sql.placeholder_draws, fields: sql.candidate_fields, links: sql.video_links },
      { pages: ts.page_count, frames: ts.frame_draw_count, logos: ts.logo_draw_count, regions: ts.text_regions, images: ts.image_draws, fields: ts.candidate_field_count, links: ts.video_link_count }, name);
  }
  // The generator must exercise every 1.4.0 page type.
  for (const layout of ['cast_main_backup', 'cast_group_strip', 'cast_single', 'cast_pending', 'section_divider']) assert.ok((layouts.get(layout) ?? 0) > 20, `${layout}: ${layouts.get(layout)}`);
});

test('m19 registers exactly the pinned 1.4.0 registry identity and fonts', () => {
  const registry = JSON.parse(readFileSync('packages/templates/versions/1.4.0/registry.json', 'utf8')) as { content_sha256: string; font_key: string; fonts: { path: string; sha256: string }[] };
  const sql = readFileSync('supabase/migrations/20261116130000_m19_editorial_template_1_4.sql', 'utf8');
  const row = /values\('everyone-casting','1\.4\.0',\s*'([a-f0-9]{64})','([^']+)',\s*'(\{[^']+\})'::jsonb\)/u.exec(sql);
  assert.ok(row, 'template row literal');
  assert.equal(row[1], registry.content_sha256); assert.equal(row[2], registry.font_key);
  assert.deepEqual(JSON.parse(row[3]), Object.fromEntries(registry.fonts.map(font => [font.path, font.sha256])));
});
