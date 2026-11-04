import type { ReviewSlide, WorkspaceReview } from '../../packages/domain/src/review-types.ts';
import { slideWordingFields } from '../../packages/domain/src/casting-types.ts';
import type { Deck, DeckElement, DeckPage, LayoutId } from '../../packages/templates/versions/1.2.0/deck.ts';
import { composeCastingDeck } from '../../packages/templates/versions/1.2.0/compose-casting.ts';
import * as L from '../../packages/templates/versions/1.2.0/layouts.ts';

/** Synthetic presentation content only: invented placeholder names, no real
 * people, clients or source photographs. Image keys resolve to generated art. */
export const fixtureId = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export interface FixtureImage { key: string; width: number; height: number; tone: string }
const images = new Map<string, FixtureImage>();
export function fixtureImage(key: string, width: number, height: number, tone = '#7a8a99'): L.Media {
  images.set(key, { key, width, height, tone });
  return { source: { type: 'asset', asset_id: key }, alt: `Synthetic ${key}`, natural: [width, height] };
}
export function fixtureImages() { return [...images.values()]; }

function requirements() {
  return { age_range: '25–35', gender_requirement: null, appearance_performance: 'Warm, confident on camera', languages: ['Arabic', 'English'], accents: ['Saudi'], skills: [],
    scene_references: ['Home gathering'], shoot_dates: ['12–14 Dec'], location: 'Riyadh', availability_requirements: null, other_instructions: null };
}
function candidate(n: number, role: { id: string; name: string; category: string | null }, slot: { id: string; label: string }, position: 'main' | 'backup' | 'option', frames: [number, number][], name: string, video = true): ReviewSlide {
  const fields = Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as ReviewSlide['fields'];
  Object.assign(fields, { name_or_id: name, age_or_range: '28', height_measurements: '168 cm', languages_accents: 'Arabic; English; Saudi accent', skills_experience: 'Commercial and short film work; comfortable with improvisation',
    city: 'Riyadh', previous_projects_roles: 'Two regional TV commercials', classification: 'Lead', availability: 'Available on all shoot dates', presentation_notes: n % 2 ? 'Strong natural delivery in the introduction video' : 'Not provided' });
  return { kind: 'candidate', role_id: role.id, role_name: role.name, role_category: role.category, slot_id: slot.id, slot_label: slot.label,
    assignment_id: fixtureId(100 + n), workspace_candidate_id: fixtureId(200 + n), candidate_id: fixtureId(300 + n), candidate_media_id: fixtureId(400 + n), position, review_status: 'reviewed',
    assignment_row_version: 1, workspace_candidate_row_version: 1, candidate_row_version: 1, requirements: requirements(), provisional: false, fields, source_fields: fields,
    frames: frames.map(([width, height], f) => { const key = `frame-${n}-${f}`; fixtureImage(key, width, height, ['#5d7c9b', '#8c6f5a', '#6f8c63'][f % 3]); return { asset_id: key, source_asset_id: fixtureId(500 + n), timestamp_ms: 1000 * (f + 1), width, height, sha256: 'a'.repeat(64) }; }),
    video_asset_id: video ? fixtureId(500 + n) : null };
}
function pending(role: { id: string; name: string; category: string | null }, slot: { id: string; label: string } | null): ReviewSlide {
  const fields = Object.fromEntries(slideWordingFields.map(key => [key, 'Not provided'])) as ReviewSlide['fields'];
  return { kind: 'pending', role_id: role.id, role_name: role.name, role_category: role.category, slot_id: slot?.id ?? null, slot_label: slot?.label ?? 'Pending', assignment_id: null, workspace_candidate_id: null, candidate_id: null, candidate_media_id: null, position: null, review_status: null,
    assignment_row_version: null, workspace_candidate_row_version: null, candidate_row_version: null, requirements: requirements(), provisional: !slot, fields, source_fields: fields, frames: [], video_asset_id: null };
}

/** Selection covering single, Main+Backup, Main+2 options, missing image, pending slot,
 * pending role, long names and portrait/landscape/square frames. */
export function castingFixtureReview(options: { logo?: boolean; everySlide?: boolean; output?: 'selection' | 'shortlist' } = {}): Pick<WorkspaceReview, 'cover' | 'slides' | 'output_type'> {
  const lead = { id: fixtureId(1), name: 'Saudi Daughter', category: 'Lead cast' }; const mother = { id: fixtureId(2), name: 'Mother', category: 'Lead cast' };
  const guests = { id: fixtureId(3), name: 'Featured Female Guests', category: 'Featured cast' }; const designer = { id: fixtureId(4), name: 'Web Designer', category: 'Featured cast' };
  const driver = { id: fixtureId(5), name: 'Delivery Driver', category: null };
  const slot = (n: number, label: string) => ({ id: fixtureId(50 + n), label });
  if (options.logo) fixtureImage('client-logo', 808, 240, '#20323a');
  return { output_type: options.output ?? 'selection', cover: { project_name: 'Synthetic Launch', client_name: 'Synthetic Client', title: 'Cast Selection - V1', output_type: options.output ?? 'selection', logo_asset_id: options.logo ? 'client-logo' : null, logo_placement: options.everySlide ? 'every_slide' : 'cover' },
    slides: [
      candidate(1, lead, slot(1, 'Front Door & Home Gathering'), 'main', [[1080, 1920], [1080, 1920]], 'Layla Example'),
      candidate(2, lead, slot(1, 'Front Door & Home Gathering'), 'backup', [[1920, 1080]], 'Noor Placeholder'),
      candidate(3, mother, slot(2, 'Home Gathering'), 'main', [[1920, 1080], [1920, 1080], [1920, 1080]], 'Huda Sample'),
      candidate(4, guests, slot(3, 'Guest 1'), 'option', [[1080, 1080]], 'Rana Fictional'),
      candidate(5, guests, slot(3, 'Guest 1'), 'option', [], 'Sara Invented', false),
      candidate(6, guests, slot(3, 'Guest 1'), 'option', [[1080, 1350]], 'Mariam Abdelrahman Synthetic-Longname'),
      pending(designer, slot(4, 'UX Studio')),
      pending(driver, null),
    ] };
}
export function castingFixtureDeck(options: Parameters<typeof castingFixtureReview>[0] = {}): Deck {
  return composeCastingDeck(castingFixtureReview(options), { versionLabel: 'Version 1', dateLabel: 'November 04, 2026', logoNatural: options.logo ? [808, 240] : undefined });
}

/** One page per source archetype, numbered as one demonstration deck. */
export function archetypeFixtureDeck(): { deck: Deck; references: Partial<Record<number, string>> } {
  const pages: { layout: LayoutId; elements: DeckElement[]; reference?: string }[] = [];
  const add = (layout: LayoutId, elements: DeckElement[], reference?: string) => pages.push({ layout, elements, reference });
  const header = (title: string, subtitle: string) => L.header(title, subtitle);
  const portrait = (key: string, label?: string, name?: string) => ({ ...fixtureImage(key, 1080, 1160, '#3e64b5'), label, name });

  add('cover_floward', L.coverFloward({ title: 'Synthetic Launch | Cast Shortlist - V3.', date: 'October 09, 2026', note: 'Pending Availability.', client: fixtureImage('client-badge', 808, 240, '#00313c').source }), 'floward_cast_p001.png');
  add('cover_partners', L.coverPartners({ title: 'Synthetic Brand | PPM v2.', date: 'October 24, 2026', client: fixtureImage('client-mark', 757, 300, '#b0007a').source, partner: fixtureImage('partner-mark', 471, 200, '#111111').source }), 'breadfast_ppm_p001.png');
  add('agenda_slash', L.agenda(['Script.', 'STB.', 'Art Direction.', 'Cast.', 'Wardrobe.']), 'breadfast_ppm_p002.png');
  add('section_divider', L.sectionDivider('Mother’s Birthday.'), 'floward_cast_p002.png');
  add('cast_main_backup', [...header('Cast Shortlist.', 'Mother’s Birthday | Front Door & Home Gathering | Saudi Daughter.'), ...L.castPortraits([portrait('cast-a', 'Main'), portrait('cast-b', 'Backup')], { labels: true })], 'floward_cast_p004.png');
  add('cast_main_backup', [...header('Cast Shortlist.', 'Restaurant Celebration | Waiter.'), ...L.castPortraits([portrait('cast-c', 'Main'), { source: null, alt: 'Backup missing', label: 'Backup' }], { labels: true })]);
  add('cast_main_backup', [...header('Cast Shortlist.', 'Restaurant Celebration | Host.'), ...L.castPortraits([{ source: null, alt: 'Main missing', label: 'Main' }, { source: null, alt: 'Backup missing', label: 'Backup' }], { labels: true })], 'floward_cast_p012.png');
  add('cast_group_strip', [...header('Cast Shortlist.', 'Mother’s Birthday | Home Gathering | 2 Featured Female Guests.'), ...L.castPortraits([portrait('cast-d'), portrait('cast-e'), portrait('cast-f')], { labels: false }), L.note('small', 'We’ll choose Only One.')], 'floward_cast_p008.png');
  add('cast_single', [...header('Cast Shortlist.', 'Synthetic Workshop | UX Studio | Web Designer.'), ...L.castPortraits([{ source: null, alt: 'Missing' }], { labels: false }), L.note('small', 'Missing.')], 'floward_cast_p033.png');
  add('cast_profile', [...header('Cast.', 'The Presenter.'), ...L.castPortraits([portrait('cast-g', null as unknown as string, 'Synthetic Presenter')], { labels: false })], 'breadfast_ppm_p046.png');
  const wide = fixtureImage('audition-still', 1920, 1080, '#3e64b5'); add('cast_profile', [...header('Cast.', 'The Presenter.'), ...L.castAuditionWide(wide.source, wide.alt, 'Synthetic Presenter', wide.natural)]);
  add('cast_ensemble', [...header('Cast.', 'The Family.'), ...L.castEnsemble(Array.from({ length: 9 }, (_, n) => portrait(`ensemble-${n}`)))], 'breadfast_ppm_p057.png');
  for (const count of [1, 2, 3, 4, 5]) add('fitting_strip', [...header('Fitting.', `Restaurant Celebration | Option set ${count}.`), ...L.fittingStrip(Array.from({ length: count }, (_, n) => fixtureImage(`fit-${count}-${n}`, 1200, 2400, '#c9a86a'))), ...count === 1 ? [L.note('fitting', 'We’ll have an extra black vest option.')] : []],
    count === 2 ? 'floward_fitting_p003.png' : count === 4 ? 'floward_fitting_p004.png' : count === 5 ? 'floward_fitting_p011.png' : count === 1 ? 'floward_fitting_p005.png' : undefined);
  add('fitting_strip', [...header('Fitting.', 'Crop safety | Very tall photograph.'), ...L.fittingStrip([fixtureImage('fit-tall', 600, 2000, '#c9a86a'), fixtureImage('fit-wide', 1600, 1200, '#c9a86a')])]);
  for (const count of [2, 3, 4, 5]) add('wardrobe_look_row', [...header('Wardrobe Mood Board.', `Mother’s Birthday | Home Gathering | Look set ${count}.`), ...L.wardrobeLookRow(Array.from({ length: count }, (_, n) => fixtureImage(`look-${count}-${n}`, [800, 1000, 900, 1200, 700][n], 1100, '#a88c8c')))],
    count === 4 ? 'floward_wardrobe_p004.png' : count === 5 ? 'floward_wardrobe_p009.png' : count === 2 ? 'floward_wardrobe_p003.png' : undefined);
  add('wardrobe_technical_board', [...header('Wardrobe Mood Board.', 'Synthetic Workshop | Florists.'), ...L.mosaic([[fixtureImage('tech-1', 600, 600), fixtureImage('tech-2', 600, 800), fixtureImage('tech-3', 900, 600)], [fixtureImage('tech-4', 800, 600), fixtureImage('tech-5', 600, 600), fixtureImage('tech-6', 700, 600)]]), L.note('small', 'The florist’s uniform will be tailored.')], 'floward_wardrobe_p018.png');
  add('wardrobe_reference_actuals', [...header('Wardrobe Actuals.', 'The Groom | Engagement Fit.'), ...L.referenceActuals([{ references: [fixtureImage('ref-1', 700, 1000, '#8f7a63')], actuals: [fixtureImage('act-1', 900, 1000, '#5d6b78')] }])], 'breadfast_ppm_p088.png');
  add('wardrobe_reference_actuals', [...header('Wardrobe Actuals.', 'The Grandfather | Casual Fit.'), ...L.referenceActuals([{ references: [fixtureImage('ref-2', 600, 800, '#8f7a63')], actuals: [fixtureImage('act-2', 800, 800), fixtureImage('act-3', 800, 800), fixtureImage('act-4', 800, 800)] }, { references: [fixtureImage('ref-3', 600, 800, '#8f7a63')], actuals: [fixtureImage('act-5', 800, 800), fixtureImage('act-6', 800, 800), fixtureImage('act-7', 800, 800)] }])], 'breadfast_ppm_p071.png');
  add('script_dialogue', [...header('Script.', '01 | The Kofta.'), ...L.scriptDialogue([{ speaker: 'The Presenter:', lines: ['”دي كفتة باربيكيو من فام بيف من بريدفاست“'], lang: 'ar' }, { speaker: 'The Mother Asks:', lines: ['”طب يا سيدي شكرا“', '”مفتاش في الكفتة“', '”احنا vegetarian اصلا“'], lang: 'ar' }, { speaker: 'The Little Child', lines: ['”انا مخدتش غير كيلو بس“'], lang: 'ar' }])], 'breadfast_ppm_p005.png');
  const sb = (n: string, key: string, action: string, dialogue: string[]) => ({ number: n, media: fixtureImage(key, 1920, 1080, '#9a9a9a'), action, dialogue });
  add('storyboard_two', [...header('STB.', '01 | The Kofta.'), ...L.storyboardTwo([sb('3', 'stb-3', 'Cut to him in medium shot as he holds the pack.', ['”دي كفتة باربيكيو من فام بيف من بريدفاست“']), sb('4', 'stb-4', 'We cut to the family watching TV. All sitting relaxed, the mother asks:', ['”طب يا سيدي شكرا“', '”مفتاش في الكفتة“'])])], 'breadfast_ppm_p014.png');
  add('storyboard_one', [...header('STB.', '04 | The End.'), ...L.storyboardOne(sb('12', 'stb-12', 'Pack shot with the product on the table.', ['”بريدفاست… كل اللي محتاجه“']))]);
  add('key_reference_16x9', [...header('Art Direction Mood Board.', 'Podium Setup.'), ...L.keyReference(fixtureImage('key-art', 1920, 1080, '#7b1a4f'))], 'breadfast_ppm_p029.png');
  add('single_location_reference', [...header('Real Location.', 'Living Room.'), ...L.singleLocation(fixtureImage('location', 1080, 1440, '#6b6457'))]);
  add('production_mosaic', [...header('Art Direction Actuals.', 'The Kofta | Living Room.'), ...L.mosaic([[fixtureImage('prop-1', 1000, 700, '#d8d2c4'), fixtureImage('prop-2', 500, 700, '#e0b000'), fixtureImage('prop-3', 700, 700, '#4c6b3a')], [fixtureImage('prop-4', 1000, 500, '#9c6b3a'), fixtureImage('prop-5', 500, 500, '#ddd'), fixtureImage('prop-6', 700, 500, '#e5c100')]], { captions: false }),
    L.localNote([425, 760, 300, 0], 'Table without fabric')], 'breadfast_ppm_p039.png');
  add('closing_thank_you', L.closing(), 'floward_cast_p035.png');

  const references: Partial<Record<number, string>> = {}; const last = pages.length - 1;
  const deckPages: DeckPage[] = pages.map((page, index) => {
    if (page.reference) references[index] = page.reference;
    const number = index === 0 || index === 1 || index === last ? null : index + 1;
    return { index, layout: page.layout, number, source_index: 0, elements: number === null ? page.elements : [...page.elements, L.pageNumber(number)] };
  });
  return { deck: { canvas: { width: 1920, height: 1080 }, title: 'Synthetic archetype deck', pages: deckPages }, references };
}
