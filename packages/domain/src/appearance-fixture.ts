import { randomUUID } from 'node:crypto';
import { DomainError, type Actor, type MutationContext } from './types.ts';
import { FACET_KEYS, effectiveObservationValue, isAppearanceValue, normalizeAppearanceLabel, normalizeSearchText, parseEnrichmentBatchStart, parseFacetFilters, parseObservationReview,
  type AppearanceObservation, type CandidateFacets, type CandidateObservations, type EnrichmentBatch, type FacetFilters, type ObservationMedia } from './appearance.ts';

/** In-memory local_fixture adapter for the five appearance operations. Synthetic people only; the same rules as m20:
 * only confirmed/overridden observations reach facets, ambiguous media needs a target person, reviews are idempotent. */
interface FixturePerson { id: string; name: string; name_ar: string | null; casting_id: string; city: string | null; stated_gender: string | null; languages: string[];
  archive: { talent_type: string; hair_colour: string[]; hair_length: string[]; playing_age: string[]; tags: string[] } | null; active: boolean }
const PEOPLE: FixturePerson[] = [
  { id: 'a4f00000-0000-4000-8000-000000000001', name: 'Synthetic Layla', name_ar: 'ليلى', casting_id: 'SYN-A4-001', city: 'Dubai', stated_gender: 'Female', languages: ['Arabic', 'English'],
    archive: { talent_type: 'talent', hair_colour: ['Black'], hair_length: ['Long'], playing_age: ['Age 25-34'], tags: ['Dancer'] }, active: true },
  { id: 'a4f00000-0000-4000-8000-000000000002', name: 'Synthetic Omar', name_ar: 'عمر', casting_id: 'SYN-A4-002', city: 'Cairo', stated_gender: null, languages: ['Arabic'],
    archive: null, active: true },
  { id: 'a4f00000-0000-4000-8000-000000000003', name: 'Synthetic Family', name_ar: null, casting_id: 'SYN-A4-003', city: 'Dubai', stated_gender: null, languages: [],
    archive: { talent_type: 'real_family', hair_colour: ['Brown'], hair_length: [], playing_age: [], tags: ['dancer'] }, active: true },
];
const now = () => new Date().toISOString();
function seedMedia(): Map<string, ObservationMedia[]> {
  const obs = (media: string, person: number, attribute: string, value: string, status: AppearanceObservation['status'] = 'suggested'): AppearanceObservation => ({
    id: randomUUID(), media_id: media, person_index: person, position_note: person ? 'right' : null, attribute, suggested_value: value, confidence: 'medium',
    evidence: 'Visible in the synthetic image.', status, override_value: null, effective_value: status === 'confirmed' ? value : null,
    reviewed_by: status === 'suggested' ? null : 'a4f00000-0000-4000-8000-0000000000aa', reviewed_at: status === 'suggested' ? null : now(), row_version: 1 });
  const media = (candidate: string, kind: 'photo' | 'frame', people: number, rows: (id: string) => AppearanceObservation[]): ObservationMedia => {
    const id = randomUUID();
    return { id, asset_id: randomUUID(), source_kind: kind, thumb_asset_id: null, candidate_media_id: kind === 'frame' ? randomUUID() : null, frame_timestamp_ms: kind === 'frame' ? 1500 : null,
      media_category: kind === 'frame' ? 'video_frame' : 'headshot', recording_context: kind === 'frame' ? 'introduction_video' : 'archive_photo', media_added_at: now(), people_count: people,
      ambiguous: people !== 1, target_person_index: null, quality_note: null, model: 'fixture-model', prompt_version: 'appearance-v1', analyzed_at: now(), row_version: 1, observations: rows(id) };
  };
  return new Map([
    [PEOPLE[0].id, [media(PEOPLE[0].id, 'photo', 1, id => [obs(id, 0, 'hair_colour', 'black', 'confirmed'), obs(id, 0, 'glasses', 'none'), obs(id, 0, 'playing_age', 'age_25_34')]),
      media(PEOPLE[0].id, 'photo', 2, id => [obs(id, 0, 'hair_colour', 'blonde'), obs(id, 1, 'hair_colour', 'black')])]],
    [PEOPLE[1].id, [media(PEOPLE[1].id, 'frame', 1, id => [obs(id, 0, 'facial_hair', 'beard'), obs(id, 0, 'skin_tone', 'unknown')])]],
  ]);
}

export function createAppearanceFixture() {
  const media = seedMedia(); const batches = new Map<string, { owner: string; key: string; body: string; batch: EnrichmentBatch }>();
  const keys = (person: FixturePerson): string[] => {
    const out = new Set<string>(); const add = (facet: string, value: string | null) => { if (value) out.add(`${facet}:${value}`); };
    add('city', normalizeSearchText(person.city)); add('stated_gender', normalizeSearchText(person.stated_gender)); person.languages.forEach(l => add('languages', normalizeSearchText(l)));
    if (person.archive) { add('talent_type', person.archive.talent_type); person.archive.tags.forEach(t => add('tags', normalizeSearchText(t)));
      for (const attribute of ['hair_colour', 'hair_length', 'playing_age'] as const) person.archive[attribute].forEach(v => add(attribute, normalizeAppearanceLabel(attribute, v) ?? normalizeSearchText(v))); }
    for (const item of media.get(person.id) ?? []) for (const o of item.observations) {
      const value = effectiveObservationValue(o);
      if (value && value !== 'unknown' && (!item.ambiguous || item.target_person_index === o.person_index) && FACET_KEYS.includes(o.attribute)) add(o.attribute, value);
    }
    return [...out];
  };
  const textOk = (person: FixturePerson, q: string | null) => !q || [person.name, person.name_ar, person.casting_id, ...(person.archive?.tags ?? [])].some(v => (normalizeSearchText(v) ?? '').includes(q));
  const TEXT_FACETS = ['city', 'stated_gender', 'languages', 'look', 'tags'];
  const norm = (facet: string, value: string) => value === 'unknown' || !TEXT_FACETS.includes(facet) ? value : normalizeSearchText(value) ?? value;
  const passes = (k: string[], filters: FacetFilters, skip: string | null) => Object.entries(filters.facets).every(([facet, list]) => facet === skip || !list?.length
    || list.some(v => k.includes(`${facet}:${norm(facet, v)}`)) || !k.some(x => x.startsWith(`${facet}:`)) && (filters.include_unknown || list.includes('unknown')));
  function find(observationId: string) {
    for (const [candidate, list] of media) for (const item of list) { const o = item.observations.find(x => x.id === observationId); if (o) return { candidate, item, o }; }
    throw new DomainError('RESOURCE_NOT_FOUND', 'Observation not found.', 404);
  }
  return {
    async listCandidateObservations(_actor: Actor, candidateId: string): Promise<CandidateObservations> {
      const person = PEOPLE.find(p => p.id === candidateId); if (!person) throw new DomainError('RESOURCE_NOT_FOUND', 'Candidate not found.', 404);
      return { candidate_id: candidateId, media: structuredClone(media.get(candidateId) ?? []), supplied: {
        archive: person.archive ? { source: { kind: 'archive_import', source_project: 'synthetic-archive', source_id: person.casting_id, imported_at: '2026-11-09T00:00:00.000Z' }, name_ar: person.name_ar,
          talent_type: person.archive.talent_type, look: null, skin_tone: null, playing_age: person.archive.playing_age, hair_length: person.archive.hair_length, hair_texture: [],
          hair_colour: person.archive.hair_colour, hair_style: [], hair_colouring: [], tags: person.archive.tags } : null,
        facts: [{ key: 'stated_gender', value: person.stated_gender, source: person.stated_gender ? 'manual' : null }, { key: 'age_or_range', value: null, source: null },
          { key: 'city', value: person.city, source: person.city ? 'manual' : null }, { key: 'languages', value: person.languages, source: person.languages.length ? 'manual' : null }] } };
    },
    async reviewCandidateObservation(actor: Actor, observationId: string, input: unknown, context?: MutationContext): Promise<AppearanceObservation> {
      if (!context?.idempotencyKey || context.idempotencyKey.length < 16) throw new DomainError('INVALID_REQUEST', 'Provide a stable Idempotency-Key.', 400);
      const body = parseObservationReview(input); const { item, o } = find(observationId);
      const status = ({ confirm: 'confirmed', reject: 'rejected', override: 'overridden', reset: 'suggested' } as const)[body.action];
      const value = body.action === 'override' ? body.value : null;
      if (value !== null && (!isAppearanceValue(o.attribute, value) || value === 'unknown')) throw new DomainError('VALIDATION_FAILED', 'Choose a value from this attribute\'s vocabulary.', 400);
      if (body.action === 'confirm' && o.suggested_value === 'unknown') throw new DomainError('VALIDATION_FAILED', 'An unknown suggestion cannot be confirmed.', 400);
      if (o.status === status && o.override_value === value) return structuredClone(o);
      if (body.row_version !== o.row_version) throw new DomainError('STALE_RESOURCE_VERSION', 'This observation changed. Reload and review again.', 409);
      if (item.ambiguous && (status === 'confirmed' || status === 'overridden')) {
        if (item.target_person_index === null) item.target_person_index = o.person_index;
        else if (item.target_person_index !== o.person_index) throw new DomainError('TARGET_PERSON_CONFLICT', 'Another person in this media is already confirmed as the candidate.', 409);
      }
      Object.assign(o, { status, override_value: value, effective_value: status === 'confirmed' ? o.suggested_value : value, reviewed_by: status === 'suggested' ? null : actor.principal_id,
        reviewed_at: status === 'suggested' ? null : now(), row_version: o.row_version + 1 });
      if (item.ambiguous && item.target_person_index === o.person_index && !item.observations.some(x => x.person_index === o.person_index && ['confirmed', 'overridden'].includes(x.status))) item.target_person_index = null;
      return structuredClone(o);
    },
    async startEnrichmentBatch(actor: Actor, input: unknown, context?: MutationContext): Promise<EnrichmentBatch> {
      if (!context?.idempotencyKey || context.idempotencyKey.length < 16) throw new DomainError('INVALID_REQUEST', 'Provide a stable Idempotency-Key.', 400);
      const body = parseEnrichmentBatchStart(input); const serial = JSON.stringify(body);
      const existing = [...batches.values()].find(b => b.owner === actor.principal_id && b.key === context.idempotencyKey);
      if (existing) { if (existing.body !== serial) throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was used for a different batch.', 409); return structuredClone(existing.batch); }
      // The fixture never calls a provider: every item is reported as skipped with an explicit reason.
      const ids = (body.candidate_ids ?? PEOPLE.filter(p => p.active).map(p => p.id)).slice(0, body.limit);
      const batch: EnrichmentBatch = { id: randomUUID(), workspace_id: body.workspace_id, status: 'completed', scope: body.candidate_ids ? { kind: 'candidates', candidate_ids: body.candidate_ids } : { kind: 'filters', filters: body.filters },
        item_limit: body.limit, spend_cap_cents: body.spend_cap_cents, spent_micro_usd: 0, model: 'fixture-model', prompt_version: 'appearance-v1', created_at: now(), updated_at: now(), completed_at: now(), row_version: 1,
        counts: { total: ids.length, pending: 0, queued: 0, succeeded: 0, failed: 0, skipped: ids.length, input_tokens: 0, output_tokens: 0 },
        items: ids.map((candidate_id, index) => ({ candidate_id, position: index + 1, status: 'skipped', job_id: null, error_code: 'FIXTURE_NO_PROVIDER', cost_micro_usd: 0 })) };
      batches.set(batch.id, { owner: actor.principal_id, key: context.idempotencyKey, body: serial, batch }); return structuredClone(batch);
    },
    async getEnrichmentBatch(actor: Actor, batchId: string): Promise<EnrichmentBatch> {
      const found = batches.get(batchId); if (!found || found.owner !== actor.principal_id) throw new DomainError('RESOURCE_NOT_FOUND', 'Enrichment batch not found.', 404); return structuredClone(found.batch);
    },
    async getCandidateFacets(_actor: Actor, input: unknown): Promise<CandidateFacets> {
      const filters = parseFacetFilters(input); const q = normalizeSearchText(filters.q);
      const rows = PEOPLE.filter(p => p.active && textOk(p, q)).map(p => ({ id: p.id, keys: keys(p) }));
      const facets = FACET_KEYS.map(key => {
        const scoped = rows.filter(row => passes(row.keys, filters, key)); const counts = new Map<string, number>();
        for (const row of scoped) for (const k of row.keys) if (k.startsWith(`${key}:`)) counts.set(k.slice(key.length + 1), (counts.get(k.slice(key.length + 1)) ?? 0) + 1);
        return { key, matched: scoped.length, unknown: scoped.filter(row => !row.keys.some(k => k.startsWith(`${key}:`))).length,
          values: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count })), selected: filters.facets[key] ?? [] };
      });
      return { total: rows.filter(row => passes(row.keys, filters, null)).length, filters: { facets: filters.facets, include_unknown: filters.include_unknown, q }, facets };
    },
  };
}
