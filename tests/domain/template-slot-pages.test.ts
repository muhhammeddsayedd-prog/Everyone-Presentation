import assert from 'node:assert/strict';
import test from 'node:test';
import { presentationFixture, presentationId as id } from '../fixtures/presentation.ts';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { renderRegisteredReviewDocument } from '../../packages/templates/src/registered.ts';
import { composeCastingDeck, deckCounts } from '../../packages/templates/versions/1.3.0/compose-casting.ts';
import { renderPageMarkup } from '../../packages/templates/versions/1.3.0/html.ts';
import slotRegistry from '../../packages/templates/versions/1.3.0/registry.json' with { type: 'json' };
import editorialRegistry from '../../packages/templates/versions/1.2.0/registry.json' with { type: 'json' };
import type { ReviewSlide, WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import type { Deck } from '../../packages/templates/versions/1.3.0/deck.ts';

// Template 1.3.0: one page per slot with its people side by side (up to three), only provided facts, and Pending
// pages that list only the requirements that were given. Every record is synthetic.
function review(people: Partial<ReviewSlide['fields']>[], pendingRequirements: Record<string, unknown> | null = null): WorkspaceReview {
  const base = reviewFromRenderSnapshot(presentationFixture({ frames: 1 }));
  const [candidate, pending] = base.slides;
  const empty = Object.fromEntries(Object.keys(candidate.fields).map(key => [key, 'Not provided'])) as ReviewSlide['fields'];
  const slides: ReviewSlide[] = people.map((fields, n) => ({ ...structuredClone(candidate), assignment_id: id(200 + n), candidate_id: id(300 + n), position: n === 0 ? 'main' : n === 1 ? 'backup' : 'option',
    fields: { ...empty, ...fields } as ReviewSlide['fields'], source_fields: { ...empty, ...fields } as ReviewSlide['fields'] }));
  if (pendingRequirements) slides.push({ ...structuredClone(pending), requirements: { ...pending.requirements, ...pendingRequirements } as ReviewSlide['requirements'] });
  return { ...base, template: { key: slotRegistry.key, version: slotRegistry.version, content_sha256: slotRegistry.content_sha256, font_key: slotRegistry.font_key }, slides };
}
const markup = (deck: Deck) => deck.pages.map((_, index) => renderPageMarkup(deck, index, {})).join('\n');
const person = (name: string, extra: Partial<ReviewSlide['fields']> = {}) => ({ name_or_id: name, age_or_range: '30', city: 'Cairo', ...extra });

test('a slot of up to three people is one page with each person and only their provided facts', () => {
  const deck = composeCastingDeck(review([person('Synthetic One', { height_measurements: '180 cm' }), person('Synthetic Two', { skills_experience: 'Swimming and dance' }), person('Synthetic Three')]));
  assert.deepEqual(deck.pages.map(page => page.layout), ['cover_floward', 'section_divider', 'cast_group_detail', 'closing_thank_you']);
  assert.deepEqual(deck.pages[2].sources, [1, 2, 3]);
  const html = markup(deck);
  for (const text of ['Synthetic One', 'Synthetic Two', 'Synthetic Three', '180 cm', 'Swimming and dance', 'Main', 'Backup', 'Option', 'Watch original introduction']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Not provided'), 'no missing-field rows are drawn');
  assert.ok(!html.includes('Previous projects'), 'labels of empty facts are not drawn');
  // Facts are counted as drawn: age and city for each, plus one height and one skills line.
  assert.equal(deckCounts(deck).candidate_fields, 3 * 2 + 2 + 3 /* names */);
});

test('four people in a slot become two pages of two; one person gets the single-person page', () => {
  const four = composeCastingDeck(review([person('A1'), person('A2'), person('A3'), person('A4')]));
  assert.deepEqual(four.pages.filter(page => page.layout === 'cast_group_detail').map(page => page.sources), [[1, 2], [3, 4]]);
  const one = composeCastingDeck(review([person('Solo Person', { presentation_notes: 'Strong on camera.' })]));
  const page = one.pages.find(item => item.layout === 'cast_detail')!;
  const html = renderPageMarkup(one, page.index, {});
  assert.ok(html.includes('Solo Person') && html.includes('Strong on camera.') && html.includes('Name / Casting ID'));
  assert.ok(!html.includes('Not provided') && !html.includes('Video not provided'));
});

test('a typical full profile still shares the slot page; only overfull facts move people to a page each', () => {
  const full = { age_or_range: '30', height_measurements: '180 cm', languages_accents: 'Arabic, English', city: 'Cairo', classification: 'Actor',
    skills_experience: 'TV commercials, swimming, horse riding', previous_projects_roles: 'Telecom spot 2025 — father', availability: 'Available 12–14 Dec', presentation_notes: 'Strong natural chemistry in the callback.' };
  const shared = composeCastingDeck(review([{ name_or_id: 'Full One', ...full }, { name_or_id: 'Full Two', ...full }, { name_or_id: 'Full Three', ...full }]));
  assert.deepEqual(shared.pages.filter(page => page.layout.startsWith('cast_')).map(page => page.layout), ['cast_group_detail']);
  for (const value of Object.values(full)) assert.ok(markup(shared).includes(value), value);
  const long = 'A long paragraph of supplied notes that keeps going with details about earlier work, availability and preferences for the client. '.repeat(2);
  const deck = composeCastingDeck(review([{ name_or_id: 'Busy One', ...full, presentation_notes: long, skills_experience: long, previous_projects_roles: long }, { name_or_id: 'Busy Two', ...full }]));
  assert.deepEqual(deck.pages.filter(page => page.layout.startsWith('cast_')).map(page => page.layout), ['cast_detail', 'cast_detail']);
  const html = markup(deck);
  for (const value of [...Object.values(full).filter(value => !value.startsWith('Strong') && !value.startsWith('TV') && !value.startsWith('Telecom')), long.trim()]) assert.ok(html.includes(value.trim()), value);
});

test('an open slot shows Pending with only the requirements that were provided', () => {
  const some = composeCastingDeck(review([person('Cast One')], { age_range: '30-35', scene_references: ['05 | The Perfume'] }));
  const pending = some.pages.find(page => page.layout === 'cast_pending')!;
  const html = renderPageMarkup(some, pending.index, {});
  assert.ok(html.includes('Pending') && html.includes('30-35') && html.includes('05 | The Perfume'));
  assert.ok(!html.includes('Not provided') && !html.includes('Shoot dates') && !html.includes('Gender requirement'));
  const none = composeCastingDeck(review([person('Cast One')], {}));
  const empty = renderPageMarkup(none, none.pages.find(page => page.layout === 'cast_pending')!.index, {});
  assert.ok(empty.includes('Pending') && !empty.includes('Age / Age range'));
});

test('1.3.0 is a separate registered version; 1.2.0 is unchanged and still renders every field', () => {
  assert.notEqual(slotRegistry.content_sha256, editorialRegistry.content_sha256);
  assert.equal(editorialRegistry.content_sha256, '9f6e281af2ec274af0762eb5fc9a4baa8a1a0130345ac0c3bb8a0477e09c2d4a');
  const slot = review([person('Registered One'), person('Registered Two')]);
  assert.ok(!renderRegisteredReviewDocument(slot).includes('Not provided'));
  const older = { ...slot, template: { key: editorialRegistry.key, version: editorialRegistry.version, content_sha256: editorialRegistry.content_sha256, font_key: editorialRegistry.font_key } };
  assert.ok(renderRegisteredReviewDocument(older).includes('Not provided'));
});
