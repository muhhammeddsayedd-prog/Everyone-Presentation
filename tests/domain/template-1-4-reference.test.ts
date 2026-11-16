import assert from 'node:assert/strict';
import test from 'node:test';
import { composeCastingDeck, deckCounts, optionChunks } from '../../packages/templates/versions/1.4.0/compose-casting.ts';
import { renderPageMarkup } from '../../packages/templates/versions/1.4.0/html.ts';
import { renderRegisteredReviewDocument } from '../../packages/templates/src/registered.ts';
import referenceRegistry from '../../packages/templates/versions/1.4.0/registry.json' with { type: 'json' };
import slotRegistry from '../../packages/templates/versions/1.3.0/registry.json' with { type: 'json' };
import type { Deck } from '../../packages/templates/versions/1.4.0/deck.ts';
import { floward, refId, referenceReview, type RefPerson } from '../fixtures/reference-review.ts';

// Template 1.4.0 reproduces the supplied Floward cast shortlist. Every person here is synthetic.
const texts = (deck: Deck, index: number) => deck.pages[index].elements.flatMap(element => element.kind === 'text' ? [element.text] : element.kind === 'runs' ? [element.runs.map(run => run.text).join('')] : element.kind === 'stack' ? element.items.map(item => item.kind === 'text' ? item.text : item.runs.map(run => run.text).join('')) : []);
const images = (deck: Deck, index: number) => deck.pages[index].elements.filter(element => element.kind === 'image' && element.role !== 'brand' && element.role !== 'logo');
/** Visible text only (alt text stays for accessibility and is not drawn). */
const visible = (html: string) => html.replace(/<[^>]*>/gu, ' ');
const options = (n: number): RefPerson[] => Array.from({ length: n }, () => ({ position: 'option' }));

test('unlabelled option pages split 1/2/3/2+2/3+2/3+3/3+2+2/3+3+2/3+3+3 and keep assignment order', () => {
  const sizes = Array.from({ length: 10 }, (_, n) => optionChunks(Array.from({ length: n + 1 }, (_, i) => i)).map(chunk => chunk.length));
  assert.deepEqual(sizes, [[1], [2], [3], [2, 2], [3, 2], [3, 3], [3, 2, 2], [3, 3, 2], [3, 3, 3], [3, 3, 2, 2]]);
  assert.deepEqual(optionChunks([1, 2, 3, 4, 5]).flat(), [1, 2, 3, 4, 5]);
  for (let n = 1; n <= 9; n++) {
    const deck = composeCastingDeck(referenceReview([{ name: 'Featured Guests', slots: [options(n)] }]));
    const cast = deck.pages.filter(page => page.layout.startsWith('cast_'));
    assert.deepEqual(cast.map(page => page.sources!.length), optionChunks(Array.from({ length: n }, (_, i) => i)).map(chunk => chunk.length), `${n} options`);
    assert.deepEqual(cast.flatMap(page => page.sources), Array.from({ length: n }, (_, i) => i + 1));
    assert.deepEqual(cast.map(page => page.layout), cast.map(page => page.sources!.length === 1 ? 'cast_single' : 'cast_group_strip'));
    for (const page of cast) assert.ok(!texts(deck, page.index).some(value => value === 'Main' || value === 'Backup' || value === 'Option'), 'no labels on option pages');
  }
});

test('the Floward structure reproduces the reference: 35 pages, dividers, subtitles, labels and notes', () => {
  const deck = composeCastingDeck(floward(), { versionNumber: 3, dateLabel: 'October 09, 2026' });
  assert.equal(deck.pages.length, 35);
  assert.deepEqual(texts(deck, 0).slice(0, 3), ['Floward Launch | Cast Shortlist - V3.', 'October 09, 2026', 'Note: Pending Availability.']);
  const dividers = deck.pages.filter(page => page.layout === 'section_divider').map(page => [page.index + 1, texts(deck, page.index)[0]]);
  assert.deepEqual(dividers, [[2, 'Mother’s Birthday.'], [11, 'Restaurant Celebration.'], [17, 'Father’s Day | Living Room.'], [20, 'Floward Workshop | Car.'], [22, 'Floward Workshop | Packaging.'], [25, 'Floward Workshop | Florists.'], [30, 'Floward Workshop | UX Studio.']]);
  const subtitle = (page: number) => texts(deck, page - 1)[1];
  assert.equal(subtitle(3), 'Mother’s Birthday | Front Door | Delivery Guy.');
  assert.equal(subtitle(4), 'Mother’s Birthday | Front Door & Home Gathering | Saudi Daughter.');
  assert.equal(subtitle(6), 'Mother’s Birthday | Home Gathering | Saudi Father.');
  assert.equal(subtitle(8), 'Mother’s Birthday | Home Gathering | 2 Featured Female Guests.');
  assert.equal(subtitle(12), 'Restaurant Celebration | Date Guy.');
  assert.equal(subtitle(18), 'Father’s Day | Living Room | Kuwaiti Father.');
  assert.equal(subtitle(33), 'Floward Workshop | UX Studio | Web Designer.');
  assert.equal(texts(deck, 34)[0], 'THANK YOU!');
  for (const page of deck.pages.slice(2, 34)) if (page.layout !== 'section_divider') assert.equal(texts(deck, page.index)[0], 'Cast Shortlist.');
  // Labels only on Main/Backup pages; Backup silhouette when the slot has a Main and no Backup.
  for (const page of deck.pages) {
    const labels = texts(deck, page.index).filter(value => value === 'Main' || value === 'Backup');
    assert.deepEqual(labels, page.layout === 'cast_main_backup' ? ['Main', 'Backup'] : [], `page ${page.index + 1}`);
  }
  assert.deepEqual(images(deck, 2).map(element => element.kind === 'image' && element.role), ['frame', 'placeholder']);
  assert.deepEqual(images(deck, 6).map(element => element.kind === 'image' && element.role), ['frame', 'frame']);
  // Notes: the role note on the role's last page only; an open role prints its note on the silhouette page.
  assert.deepEqual(deck.pages.filter(page => texts(deck, page.index).some(value => value.startsWith('Note:'))).map(page => page.index + 1), [1, 10, 33]);
  assert.ok(texts(deck, 9).includes('Note: We’ll choose Only One.') && !texts(deck, 8).some(value => value.startsWith('Note:')));
  assert.ok(texts(deck, 32).includes('Note: Missing.'));
  assert.equal(deck.pages[32].layout, 'cast_pending');
  // Page numbers on every page but the cover and the closing page; no captions, facts, links or every-slide logo.
  assert.deepEqual(deck.pages.map(page => page.number), deck.pages.map((_, n) => n === 0 || n === 34 ? null : n + 1));
  const counts = deckCounts(deck);
  assert.equal(counts.candidate_fields, 0); assert.equal(counts.video_links, 0); assert.equal(counts.logo_draws, 1);
  const html = visible(deck.pages.map((_, n) => renderPageMarkup(deck, n, {})).join(''));
  for (const absent of ['Synthetic Person', 'Not provided', 'Age', 'City', 'Watch original introduction', 'Option']) assert.ok(!html.includes(absent), absent);
});

test('scenes: a recurring role prints once at its first auto occurrence; repeat prints again; hidden skips; unscened roles first', () => {
  const roles = [{ name: 'Hero', slots: [options(1)] }, { name: 'Friend', slots: [options(2)] }, { name: 'Extra', slots: [options(1)] }, { name: 'Unscened', slots: [options(1)] }];
  const deck = composeCastingDeck(referenceReview(roles, { scenes: [
    { title: 'Morning', setting: 'Kitchen', occurrences: [{ role: 0 }, { role: 1, display: 'Best Friend', note: 'Same person in both scenes.' }, { role: 2, placement: 'hidden' }] },
    { title: 'Morning', setting: 'Garden', occurrences: [{ role: 0 }, { role: 1, placement: 'repeat' }, { role: 2 }] },
  ] }));
  const flow = deck.pages.slice(1, -1).map(page => page.layout === 'section_divider' ? `# ${texts(deck, page.index)[0]}` : texts(deck, page.index)[1]);
  assert.deepEqual(flow, ['Unscened.', '# Morning | Kitchen.', 'Morning | Kitchen | Hero.', 'Morning | Kitchen | Best Friend.', '# Morning | Garden.', 'Morning | Garden | Friend.', 'Morning | Garden | Extra.']);
  assert.ok(texts(deck, 4).includes('Note: Same person in both scenes.'));
  // One sequence groups its scenes under one divider and combines the auto places of a recurring role.
  const grouped = composeCastingDeck(referenceReview(roles.slice(0, 2), { scenes: [
    { sequence: 'Birthday', title: 'Front Door', occurrences: [{ role: 0 }] }, { sequence: 'Birthday', title: 'Home Gathering', occurrences: [{ role: 0 }, { role: 1, setting: 'Living Room' }] }] }));
  assert.deepEqual(grouped.pages.slice(1, -1).map(page => texts(grouped, page.index)[page.layout === 'section_divider' ? 0 : 1]), ['Birthday.', 'Birthday | Front Door & Home Gathering | Hero.', 'Birthday | Living Room | Friend.']);
});

test('without scenes every role follows in role order with no dividers (no category dividers)', () => {
  const review = referenceReview([{ name: 'Father', slots: [[{ position: 'main' }, { position: 'backup' }]] }, { name: 'Mother', slots: [options(3)] }]);
  review.slides.forEach(slide => { slide.role_category = 'Lead'; });
  const deck = composeCastingDeck(review);
  assert.deepEqual(deck.pages.map(page => page.layout), ['cover_floward', 'cast_main_backup', 'cast_group_strip', 'closing_thank_you']);
  assert.deepEqual(deck.pages.slice(1, 3).map(page => texts(deck, page.index)[1]), ['Father.', 'Mother.']);
});

test('Main/Backup: one Backup per page beside the Main; a missing Main is the silhouette; options of that slot follow unlabelled', () => {
  const deck = composeCastingDeck(referenceReview([{ name: 'Lead', slots: [[{ position: 'main' }, { position: 'backup' }, { position: 'backup' }, { position: 'option' }, { position: 'option' }]], slotNotes: ['Two backups held.'] },
    { name: 'Second', slots: [[{ position: 'backup' }]] }], { output: 'selection' }));
  assert.deepEqual(deck.pages.slice(1, -1).map(page => [page.layout, page.sources]), [['cast_main_backup', [1, 2]], ['cast_main_backup', [1, 3]], ['cast_group_strip', [4, 5]], ['cast_main_backup', [6]]]);
  assert.equal(texts(deck, 1)[0], 'Cast Selection.');
  assert.ok(texts(deck, 3).includes('Note: Two backups held.') && !texts(deck, 2).some(value => value.startsWith('Note:')));
  assert.deepEqual(images(deck, 4).map(element => element.kind === 'image' && element.role), ['placeholder', 'frame']);
  assert.equal(texts(deck, 0)[0], 'Synthetic Launch | Cast Selection.');
});

test('pictures: pinned photo with its focus, frame fallback, deliberately empty and missing pictures draw the silhouette', () => {
  const deck = composeCastingDeck(referenceReview([{ name: 'Group', slots: [[
    { position: 'option', portrait: 'photo', focal: [300, 200] }, { position: 'option' }, { position: 'option', state: 'intentionally_empty' }, { position: 'option', frame: false }]] }]));
  const drawn = deck.pages.filter(page => page.layout === 'cast_group_strip').flatMap(page => images(deck, page.index));
  assert.deepEqual(drawn.map(element => element.kind === 'image' && [element.role, element.source.type === 'asset' ? element.source.asset_id : 'static', element.focal ?? null, element.owner]), [
    ['frame', refId(7001), [0.3, 0.2], 1], ['frame', refId(5002), [0.5, 0.4], 2], ['placeholder', 'static', null, 3], ['placeholder', 'static', null, 4]]);
  for (const element of drawn) if (element.kind === 'image' && element.role === 'frame') assert.equal(element.fit, 'cover');
  assert.equal(deckCounts(deck).placeholder_draws, 2);
});

test('grouped pages name every assignment they draw (data-fit-source) and fit regions for subtitle and note', () => {
  const deck = composeCastingDeck(referenceReview([{ name: 'Trio', slots: [options(3)], note: 'Choose one.' }], { coverNote: 'Pending availability.' }));
  const html = renderPageMarkup(deck, 1, {});
  for (const source of [1, 2, 3]) assert.ok(html.includes(`data-fit-source="${source}"`), String(source));
  assert.ok(html.includes('data-sources="1 2 3"') && html.includes('data-fit-field="presentation.subtitle"') && html.includes('data-fit-field="presentation.note"'));
  assert.ok(renderPageMarkup(deck, 0, {}).includes('data-fit-field="cover_note"'));
});

test('1.4.0 is a separate registered version; 1.3.0 and its saved rules are unchanged', () => {
  assert.notEqual(referenceRegistry.content_sha256, slotRegistry.content_sha256);
  assert.equal(slotRegistry.content_sha256, '1e62d22bc41141a085ca2eab974062193a52c1bd95ab8031de2da7c34028c665');
  const review = referenceReview([{ name: 'Registered', slots: [options(2)] }]);
  const html = visible(renderRegisteredReviewDocument(review).replace(/<style>.*<\/style>/su, ''));
  assert.ok(html.includes('Cast Shortlist.') && !html.includes('Synthetic Person'));
  assert.throws(() => renderRegisteredReviewDocument({ ...review, template: { ...review.template, content_sha256: '0'.repeat(64) } }), /TEMPLATE_VERSION_UNAVAILABLE/u);
});
