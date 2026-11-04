import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import registry from '../../packages/templates/versions/1.2.0/registry.json';
import { SOURCE_LAYOUTS } from '../../packages/templates/versions/1.2.0/deck.ts';
import { arrangeFrames, CAST_SLOTS, DETAIL_MEDIA_ZONE, FITTING_SLOTS, fittingStrip, lineBox } from '../../packages/templates/versions/1.2.0/layouts.ts';
import { composeCastingDeck, deckCounts, overviewChunks, sentence } from '../../packages/templates/versions/1.2.0/compose-casting.ts';
import { renderDeckDocument, renderPageMarkup } from '../../packages/templates/versions/1.2.0/html.ts';
import { archetypeFixtureDeck, castingFixtureDeck, castingFixtureReview } from '../fixtures/editorial-decks.ts';

const texts = (deck: ReturnType<typeof composeCastingDeck>, index: number) => deck.pages[index].elements.flatMap(element => element.kind === 'text' || element.kind === 'link' ? [element.text] : element.kind === 'runs' ? [element.runs.map(run => run.text).join('')] : element.kind === 'stack' ? element.items.map(item => item.kind === 'text' ? item.text : item.runs.map(run => run.text).join('')) : []);

test('registry pins current renderer bytes and the migration registers the same identity', () => {
  execFileSync(process.execPath, ['tools/editorial-template-registry.mjs', '--check'], { stdio: 'pipe' });
  const migration = readFileSync('supabase/migrations/20261104210000_m08_editorial_template.sql', 'utf8');
  assert.ok(migration.includes(`'${registry.content_sha256}'`), 'migration content_sha256 must match the registry');
  for (const font of registry.fonts) assert.ok(migration.includes(`"${font.path}":"${font.sha256}"`), font.path);
  assert.equal(registry.width, 1920); assert.equal(registry.height, 1080); assert.equal(registry.fonts.filter(font => font.path.includes('GeneralSans-')).length, 6);
});

test('kit geometry: 1920×1080 type scale, portrait and fitting slots, 1.25 line boxes', () => {
  assert.equal(lineBox('heading'), 92.5); assert.equal(lineBox('subtitle'), 62.5); assert.equal(lineBox('pageNumber'), 30); assert.equal(lineBox('closing'), 80);
  assert.deepEqual(CAST_SLOTS[2], [[493, 367, 464, 500], [963, 367, 464, 500]]);
  assert.deepEqual(FITTING_SLOTS[5].map(box => box[0]), [62, 426, 788, 1152, 1514]);
  for (const count of [1, 2, 3, 4, 5] as const) for (const box of FITTING_SLOTS[count]) { assert.equal(box[1], 244); assert.equal(box[3], 746); }
  // A very tall outfit narrows its strip rather than cropping head or shoes.
  const [tall] = fittingStrip([{ source: { type: 'asset', asset_id: 'a' }, alt: 'a', natural: [600, 2000] }]);
  assert.equal(tall.kind === 'image' && Math.round(tall.box[2] / tall.box[3] * 1000), Math.round(600 / 2000 * 1000));
  assert.deepEqual(SOURCE_LAYOUTS.length, 20);
});

test('candidate frames keep their exact aspect and stay inside the media zone', () => {
  for (const naturals of [[[1080, 1920]], [[1920, 1080], [1920, 1080], [1920, 1080]], [[1080, 1920], [1920, 1080]], [[1080, 1080], [1080, 1350]]] as [number, number][][]) {
    const boxes = arrangeFrames(naturals);
    boxes.forEach((box, n) => {
      assert.ok(Math.abs(box[2] / box[3] - naturals[n][0] / naturals[n][1]) < 0.01);
      assert.ok(box[0] >= DETAIL_MEDIA_ZONE[0] - 0.1 && box[1] >= DETAIL_MEDIA_ZONE[1] - 0.1 && box[0] + box[2] <= DETAIL_MEDIA_ZONE[0] + DETAIL_MEDIA_ZONE[2] + 0.1 && box[1] + box[3] <= DETAIL_MEDIA_ZONE[1] + DETAIL_MEDIA_ZONE[3] + 0.1);
    });
  }
});

test('casting deck: data-driven structure, numbering and labels; every candidate keeps all ten fields', () => {
  const deck = castingFixtureDeck({ logo: true });
  assert.deepEqual(deck.pages.map(page => page.layout), ['cover_floward', 'section_divider', 'cast_main_backup', 'cast_detail', 'cast_detail', 'cast_detail', 'section_divider', 'cast_group_strip', 'cast_detail', 'cast_detail', 'cast_detail', 'cast_pending', 'cast_pending', 'closing_thank_you']);
  assert.deepEqual(deck.pages.map(page => page.number), [null, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, null]);
  assert.deepEqual(texts(deck, 2).filter(text => ['Main', 'Backup', 'Option'].includes(text)), ['Main', 'Backup']);
  assert.ok(!texts(deck, 7).some(text => ['Main', 'Backup', 'Option'].includes(text)), 'an all-Option slot is an unranked group');
  for (const page of deck.pages.filter(item => item.layout === 'cast_detail')) assert.equal(page.elements.filter(element => element.kind === 'text' && element.fit && element.style === 'fieldValue').length, 10);
  assert.ok(texts(deck, 12).includes('Note: Casting requirements pending.')); assert.ok(texts(deck, 11).includes('Note: Pending.'));
  assert.ok(texts(deck, 9).includes('Image not provided') && texts(deck, 9).includes('Video not provided'));
  // Overview pages attribute to the slot's first captured slide; detail pages to their own.
  assert.deepEqual(deck.pages.filter(page => page.layout === 'cast_detail').map(page => page.source_index), [1, 2, 3, 4, 5, 6]);
});

test('composer never invents text: every visible string comes from input, labels or fixed template words', () => {
  const review = castingFixtureReview({ logo: true }); const deck = composeCastingDeck(review, { versionLabel: 'Version 1', dateLabel: 'November 04, 2026' });
  const sources = new Set([...review.slides.flatMap(slide => [slide.role_name, slide.slot_label, slide.role_category ?? '', ...Object.values(slide.fields), ...Object.values(slide.requirements).flatMap(value => Array.isArray(value) ? [value.join('; ')] : value ? [value] : [])]), review.cover.project_name, review.cover.title]);
  const fixed = /^(?:Cast Selection\.|Cast Shortlist\.|Main|Backup|Option|Pending|THANK YOU!|Image not provided|Video not provided|Watch original introduction|Not provided|Note: (?:Pending|Casting requirements pending)\.|November 04, 2026 \| Version 1|\d+|[A-Z][A-Za-z /&]+)$/u;
  for (const page of deck.pages) for (const text of texts(deck, page.index)) {
    const parts = text.replace(/\.$/u, '').split(' | ');
    assert.ok(fixed.test(text) || parts.every(part => [...sources].some(source => source && (source === part || source.replace(/\.$/u, '') === part))), `unexpected text: ${text}`);
  }
});

test('overview chunking keeps pages balanced and sentence() keeps existing punctuation', () => {
  assert.deepEqual(overviewChunks([1, 2, 3, 4]).map(chunk => chunk.length), [2, 2]);
  assert.deepEqual(overviewChunks([1, 2, 3, 4, 5, 6, 7]).map(chunk => chunk.length), [3, 2, 2]);
  assert.equal(sentence('Saudi Daughter'), 'Saudi Daughter.'); assert.equal(sentence('Ready?'), 'Ready?');
});

test('HTML: escaped content, fixed-canvas pages, untrusted sources and links refused, no app chrome', () => {
  const review = castingFixtureReview(); review.slides[0].fields.name_or_id = '<img src=x onerror=alert(1)>';
  const deck = composeCastingDeck(review); const html = renderDeckDocument(deck, { videoHrefs: { [review.slides[0].video_asset_id!]: '/presentations/versions/v/media/m' } });
  assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('@page{size:1920px 1080px;margin:0}')); assert.equal((html.match(/class="ef-slide"/gu) ?? []).length, deck.pages.length);
  assert.ok(!/<button|<nav|<script/u.test(html));
  assert.throws(() => renderPageMarkup(deck, 3, { imageSources: { [review.slides[0].frames[0].asset_id]: 'https://tracker.invalid/x.png' } }), /TEMPLATE_ASSET_SOURCE_INVALID/u);
  assert.throws(() => renderPageMarkup(deck, 3, { videoHrefs: { [review.slides[0].video_asset_id!]: 'javascript:alert(1)' } }), /TEMPLATE_LINK_INVALID/u);
  assert.throws(() => renderDeckDocument(deck, { fontFaces: [{ family: 'Latin', weight: 400, source: 'https://fonts.invalid/x.ttf' }] }), /TEMPLATE_ASSET_SOURCE_INVALID/u);
});

test('every source archetype renders from the shared layout registry', () => {
  const { deck } = archetypeFixtureDeck(); const used = new Set(deck.pages.map(page => page.layout));
  for (const layout of SOURCE_LAYOUTS) assert.ok(used.has(layout), layout);
  const counts = deckCounts(deck); assert.equal(counts.pages, deck.pages.length); assert.ok(counts.static_images > 0);
});
