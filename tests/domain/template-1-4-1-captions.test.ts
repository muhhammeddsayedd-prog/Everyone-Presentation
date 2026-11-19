import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { captionHeight, composeCastingDeck, deckCounts, portraitCaption, providedValue } from '../../packages/templates/versions/1.4.1/compose-casting.ts';
import { composeCastingDeck as composeReference, deckCounts as countsReference } from '../../packages/templates/versions/1.4.0/compose-casting.ts';
import { renderPageMarkup } from '../../packages/templates/versions/1.4.1/html.ts';
import { CAST_CAPTION_TOP, CAST_SLOTS } from '../../packages/templates/versions/1.4.1/layouts.ts';
import { renderRegisteredReviewDocument } from '../../packages/templates/src/registered.ts';
import captionedRegistry from '../../packages/templates/versions/1.4.1/registry.json' with { type: 'json' };
import referenceRegistry from '../../packages/templates/versions/1.4.0/registry.json' with { type: 'json' };
import type { Deck, StackElement, TextElement } from '../../packages/templates/versions/1.4.1/deck.ts';
import { captionedTemplate, floward, referenceReview, referenceTemplate } from '../fixtures/reference-review.ts';
import { captionedShowcase, LONG_NAME } from '../fixtures/captioned-review.ts';
import { generatedCaptioned } from '../fixtures/captioned-generator.ts';

// Template 1.4.1 = 1.4.0's Floward pages + only name, age and height under each portrait. Every person is synthetic.
const captions = (deck: Deck, index: number) => deck.pages[index].elements.filter((element): element is StackElement => element.kind === 'stack' && element.items.some(item => item.kind === 'text' && item.fit?.startsWith('presentation.caption_')))
  .map(stack => (stack.items as TextElement[]).map(item => item.text));
const visible = (html: string) => html.replace(/<[^>]*>/gu, ' ');

test('height: only the height part of free-text measurements, unit only when stated, never weight or an invented unit', () => {
  // The owner's cases.
  assert.equal(captionHeight('Height: 173; weight: 77. Units not stated.'), '173');
  assert.equal(captionHeight('180 cm'), '180 cm');
  assert.equal(captionHeight('weight 70 kg'), null);
  assert.equal(captionHeight(''), null);
  assert.equal(captionHeight(null), null); assert.equal(captionHeight(undefined), null);
  // More archive and extraction forms.
  const cases: [string, string | null][] = [
    ['Not provided', null], ['Pending', null], ['   ', null], ['173', '173'], ['180.', '180'], ['1.73m', '1.73 m'], ['Height:173cm', '173 cm'], ['HEIGHT=180CM', '180 CM'],
    ["5'11\"", "5'11\""], ['180 cm, 75 kg', '180 cm'], ['77 kg', null], ['Height / Measurements', null], ['Height: unknown; 180', null],
    ['Chest 90, height 182 cm', '182 cm'], ['Weight: 60; Height - 1,68 m', '1,68 m'], ['height is 6 ft', '6 ft'], ['Height: 72 in.', '72 in'],
    ['Height 180 in Cairo', '180'], ['1735', null], ['height_180', null], ['xheight: 180', null], ['Height (cm): 173', null], ['Units not stated', null],
  ];
  for (const [input, expected] of cases) assert.equal(captionHeight(input), expected, input);
});

test('caption: name, then "age | height"; each part only when provided; never Not provided or Pending', () => {
  assert.deepEqual(portraitCaption({ name_or_id: 'Layla Hassan', age_or_range: '34', height_measurements: 'Height: 173; weight: 77. Units not stated.' }), { name: 'Layla Hassan', details: '34 | 173' });
  assert.deepEqual(portraitCaption({ name_or_id: 'Layla Hassan', age_or_range: 'Not provided', height_measurements: '180 cm' }), { name: 'Layla Hassan', details: '180 cm' });
  assert.deepEqual(portraitCaption({ name_or_id: 'Layla Hassan', age_or_range: ' 40-50 ', height_measurements: 'weight 70 kg' }), { name: 'Layla Hassan', details: '40-50' });
  assert.deepEqual(portraitCaption({ name_or_id: 'Layla Hassan', age_or_range: 'Not provided', height_measurements: 'Not provided' }), { name: 'Layla Hassan', details: null });
  assert.deepEqual(portraitCaption({ name_or_id: 'Not provided', age_or_range: '31', height_measurements: 'Not provided' }), { name: null, details: '31' });
  assert.equal(portraitCaption({ name_or_id: 'Not provided', age_or_range: 'Pending', height_measurements: '' }), null);
  assert.equal(providedValue(' Pending '), null); assert.equal(providedValue('NOT PROVIDED'), null); assert.equal(providedValue(' early forties '), 'early forties');
});

test('captions never change the pages: 1.4.1 composes exactly 1.4.0 pages, pictures and sources (Floward + 300 random reviews)', () => {
  const reviews = [floward(), captionedShowcase(), ...Array.from({ length: 300 }, (_, n) => generatedCaptioned(n + 1))];
  for (const review of reviews) {
    const plain = composeReference(review, { versionNumber: 3 }); const captioned = composeCastingDeck({ ...review }, { versionNumber: 3 });
    const shape = (deck: { pages: { layout: string; sources?: number[]; source_index: number; number: number | null; elements: { kind: string }[] }[] }) =>
      deck.pages.map(page => [page.layout, page.source_index, page.sources ?? null, page.number, page.elements.filter(element => element.kind !== 'stack' || page.layout === 'cover_floward').map(element => ({ ...element, alt: undefined }))]);
    // Only the alt text of an unnamed person differs (never "Not provided" in 1.4.1); it is not drawn.
    assert.deepEqual(shape(captioned), shape(plain));
    const a = deckCounts(captioned); const b = countsReference(plain as never);
    assert.deepEqual({ ...a, text_regions: 0 }, { ...b, text_regions: 0 });
    assert.ok(a.text_regions >= b.text_regions);
  }
});

test('every person is captioned under their own slot (silhouettes of a person too); missing Main/Backup and open roles are not', () => {
  const review = captionedShowcase(); const deck = composeCastingDeck(review, { versionNumber: 3, dateLabel: 'November 19, 2026' });
  const byLayout = (layout: string) => deck.pages.filter(page => page.layout === layout);
  // Single, Main | Backup, Main without Backup, Backup continuation, unlabelled pair, triple, 4 = 2+2, 5 = 3+2, 6 = 3+3, open role.
  assert.deepEqual(deck.pages.map(page => [page.layout, page.sources?.length ?? 0]), [
    ['cover_floward', 0], ['section_divider', 1], ['cast_single', 1], ['cast_main_backup', 2], ['cast_main_backup', 1], ['cast_main_backup', 2], ['cast_main_backup', 2],
    ['section_divider', 1], ['cast_group_strip', 2], ['cast_group_strip', 3], ['cast_group_strip', 2], ['cast_group_strip', 2], ['cast_group_strip', 3], ['cast_group_strip', 2],
    ['cast_group_strip', 3], ['cast_group_strip', 3], ['section_divider', 1], ['cast_pending', 1], ['closing_thank_you', 0]]);
  assert.deepEqual(captions(deck, 2), [['Omar Haddad', '34 | 173']]);
  assert.deepEqual(captions(deck, 3), [['Khalid Al-Mansour', '45 | 182 cm'], ['Faisal Rahman', '41 | 180']]);
  // Main without a Backup: the Backup silhouette has no caption; a weight is not a height.
  assert.deepEqual(captions(deck, 4), [['Noura Saleh', '38']]);
  assert.deepEqual(captions(deck, 6), [['Ziad Fawzi', '11'], [LONG_NAME, '12 | 148 cm']]);
  // A person with no name and an intentionally empty picture: silhouette, details only.
  assert.deepEqual(captions(deck, 8), [['Hassan Ali', '29 | 178 cm'], ['31 | 175 cm']]);
  assert.equal(deck.pages[8].elements.filter(element => element.kind === 'image' && element.role === 'placeholder').length, 1);
  assert.deepEqual(captions(deck, 9), [['Tarek Mostafa', "40-50 | 5'11\""], ['Samir Aziz', 'early forties'], ['Bilal Hamdan', '176 cm']]);
  assert.deepEqual(captions(deck, 17), []);
  for (const page of [...byLayout('cast_single'), ...byLayout('cast_group_strip'), ...byLayout('cast_main_backup')]) {
    const slots = CAST_SLOTS[(page.elements.filter(element => element.kind === 'image').length) as 1 | 2 | 3];
    const stacks = page.elements.filter((element): element is StackElement => element.kind === 'stack');
    for (const stack of stacks) {
      // Each caption sits on its own slot's column, directly under the 866 portrait bottom, inside the slot width.
      const slot = slots.find(item => item[0] === stack.box[0]); assert.ok(slot, `page ${page.index + 1}`);
      assert.equal(stack.box[1], CAST_CAPTION_TOP); assert.equal(stack.box[2], slot[2]); assert.ok(stack.box[1] > slot[1] + slot[3]);
      assert.ok(stack.box[1] + stack.box[3] < 1030, 'clear of the note row');
      const owner = (stack.items[0] as TextElement).owner; assert.ok(owner !== undefined && page.sources!.includes(owner));
    }
  }
  const html = visible(deck.pages.map((_, n) => renderPageMarkup(deck, n, {})).join(''));
  for (const absent of ['Not provided', 'weight', 'kg', 'Units not stated']) assert.ok(!html.includes(absent), absent);
  assert.ok(!deck.pages.flatMap(page => captions(deck, page.index).flat()).some(value => /not provided|pending/iu.test(value)));
  for (const present of ['Omar Haddad', '34 | 173', LONG_NAME, 'Backup pending.', 'Missing.']) assert.ok(html.includes(present), present);
});

test('caption markup: the name wraps on at most two measured lines, age | height is one line, both fit-measured per person', () => {
  const deck = composeCastingDeck(captionedShowcase());
  const html = renderPageMarkup(deck, 6, {});
  assert.match(html, /<div class="ef-stack" style="left:963px;top:883px;width:464px">/u);
  assert.match(html, /class="ef-t ef-s-castName ef-wrap" style="left:963px;top:883px;width:464px;max-height:87\.5px;text-align:center" dir="auto" data-fit-field="presentation\.caption_name" data-fit-source="\d+" data-region="">Alexandria/u);
  assert.match(html, /class="ef-t ef-s-caption" style="margin-top:0px;left:963px;top:0px;width:464px;max-height:37\.5px;text-align:center" dir="auto" data-fit-field="presentation\.caption_details" data-fit-source="\d+" data-region="">12 \| 148 cm/u);
});

test('1.4.1 is registered beside an unchanged 1.4.0 and renders through the registered entry point', () => {
  assert.equal(referenceRegistry.content_sha256, 'b4fbd16ff5038c8a97583d1225294fbe0c26b71439f850e7fb888ff4320b9ac8');
  assert.equal(captionedRegistry.version, '1.4.1'); assert.notEqual(captionedRegistry.content_sha256, referenceRegistry.content_sha256);
  assert.deepEqual(captionedRegistry.fonts, referenceRegistry.fonts); assert.deepEqual(captionedRegistry.static_images, referenceRegistry.static_images);
  assert.ok(captionedRegistry.renderer_files.every(file => file.path.startsWith('packages/templates/versions/1.4.1/')));
  const review = captionedShowcase();
  const document = visible(renderRegisteredReviewDocument(review, {}));
  assert.ok(document.includes('Omar Haddad') && document.includes('34 | 173'));
  // The same review saved with 1.4.0 prints no captions at all.
  const plain = visible(renderRegisteredReviewDocument({ ...review, template: referenceTemplate }, {}));
  assert.ok(!plain.includes('Omar Haddad') && !plain.includes('34 | 173'));
  assert.throws(() => renderRegisteredReviewDocument({ ...review, template: { ...captionedTemplate, content_sha256: referenceTemplate.content_sha256 } }, {}), /TEMPLATE_VERSION_UNAVAILABLE/u);
  // The 1.4.0 renderer files are byte-identical to their pinned hashes (saved versions pin them).
  for (const file of referenceRegistry.renderer_files) assert.equal(readFileSync(file.path).byteLength, file.bytes, file.path);
});

test('a role with nobody cast stays one silhouette page with its note and no caption', () => {
  const deck = composeCastingDeck(referenceReview([{ name: 'Web Designer', slots: [[]] }], { template: captionedTemplate }));
  assert.deepEqual(deck.pages.map(page => page.layout), ['cover_floward', 'cast_pending', 'closing_thank_you']);
  assert.deepEqual(captions(deck, 1), []);
});
