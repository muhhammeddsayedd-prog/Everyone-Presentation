'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { APPEARANCE_TAXONOMY, appearanceValueLabel, appearanceValues, type AppearanceObservation, type CandidateObservations, type ObservationMedia } from '../../../../packages/domain/src/appearance';
import { api, errorMessage, mutation } from '../api';
import { ErrorNotice } from '../Feedback';
import { APPEARANCE_STYLES as styles } from './appearance-styles';

/** Candidate profile panel: visible-appearance suggestions per photo/frame, kept apart from supplied information.
 * Only confirmed or corrected values are searchable; suggestions wait for a person with cast.review. */
const STATUS: Record<AppearanceObservation['status'], { label: string; tone: string }> = {
  suggested: { label: 'Suggestion awaiting review', tone: 'badge badge-pending' }, confirmed: { label: 'Confirmed', tone: 'badge badge-ok' },
  overridden: { label: 'Corrected by reviewer', tone: 'badge badge-info' }, rejected: { label: 'Rejected', tone: 'badge' },
};
const CATEGORY = Object.fromEntries(APPEARANCE_TAXONOMY.media_categories.map(item => [item.key, item.label]));
const attributeLabel = (key: string) => APPEARANCE_TAXONOMY.attributes[key]?.label ?? key;
const time = (ms: number | null) => ms === null ? '' : `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const FACT_LABEL: Record<string, string> = { stated_gender: 'Gender (as supplied)', age_or_range: 'Stated age (supplied, not verified by appearance)', city: 'City', languages: 'Languages' };
const SOURCE_LABEL: Record<string, string> = { manual: 'Entered manually', transcript: 'From the introduction transcript', archive: 'Imported from the cast archive' };

export function AppearanceObservations({ candidateId, canReview }: { candidateId: string; canReview: boolean }) {
  const [data, setData] = useState<CandidateObservations | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'pending' | 'all'>('all'); const [message, setMessage] = useState('');
  const intents = useRef(new Map<string, RequestInit>()); const headingId = useId();
  const load = useCallback(async () => {
    try { setData((await api<CandidateObservations>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/observations`)).data); setError(''); }
    catch (cause) { setError(errorMessage(cause)); }
  }, [candidateId]);
  useEffect(() => { let current = true;
    api<CandidateObservations>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/observations`).then(result => { if (current) { setData(result.data); setError(''); } })
      .catch(cause => { if (current) setError(errorMessage(cause)); });
    return () => { current = false; }; }, [candidateId]);
  async function review(observation: AppearanceObservation, action: 'confirm' | 'reject' | 'override' | 'reset', value?: string) {
    const body = { row_version: observation.row_version, action, ...(action === 'override' ? { value } : {}) };
    const intentKey = `${observation.id}:${observation.row_version}:${action}:${value ?? ''}`;
    let intent = intents.current.get(intentKey); if (!intent) { intent = mutation('POST', body); intents.current.set(intentKey, intent); }
    setBusy(observation.id); setMessage('');
    try {
      await api(`/api/v1/candidate-observations/${encodeURIComponent(observation.id)}/review`, intent); intents.current.delete(intentKey);
      setMessage(action === 'confirm' ? 'Confirmed. It is now searchable.' : action === 'override' ? 'Correction saved. It is now searchable.' : action === 'reject' ? 'Suggestion rejected.' : 'Returned to awaiting review.');
      await load();
    } catch (cause) { setError(errorMessage(cause)); } finally { setBusy(null); }
  }
  const all = data?.media.flatMap(media => media.observations) ?? [];
  const pending = all.filter(item => item.status === 'suggested' && item.suggested_value !== 'unknown').length;
  const searchable = all.filter(item => item.status === 'confirmed' || item.status === 'overridden').length;
  return <section className="editor-section" style={styles.panel} aria-labelledby={headingId}>
    <div className="section-heading"><div><h2 id={headingId}>Visible appearance</h2>
      <p>Suggestions describe what is visible in each authorised photo or video frame. Search and Library filters use <strong>confirmed and corrected values only</strong>; suggestions awaiting review are never searchable.</p></div></div>
    {error && <ErrorNotice message={error} retry={() => void load()} />}
    {message && <div className="notice" role="status"><p>{message}</p></div>}
    {data && <SuppliedInformation supplied={data.supplied} />}
    {data && <div style={styles.toolbar}>
      <p className="small" aria-live="polite"><span className="badge badge-pending">{pending} awaiting review</span> <span className="badge badge-ok">{searchable} searchable</span></p>
      <div role="group" aria-label="Show observations" className="segmented">
        <button type="button" aria-pressed={view === 'pending'} onClick={() => setView('pending')}>Awaiting review</button>
        <button type="button" aria-pressed={view === 'all'} onClick={() => setView('all')}>All</button>
      </div></div>}
    {data && !data.media.length && <p className="muted">No appearance suggestions yet. They appear after an enrichment batch analyses this person's photos or video frames.</p>}
    {data?.media.map(media => <MediaGroup key={media.id} media={media} view={view} canReview={canReview} busy={busy} onReview={review} />)}
  </section>;
}

function SuppliedInformation({ supplied }: { supplied: CandidateObservations['supplied'] }) {
  const archive = supplied.archive; const facts = (supplied.facts ?? []).filter(fact => fact.value !== null && !(Array.isArray(fact.value) && !fact.value.length));
  const labels = archive ? (['playing_age', 'hair_length', 'hair_colour', 'hair_texture', 'hair_style', 'hair_colouring', 'tags'] as const).filter(key => archive[key].length)
    .map(key => [key === 'tags' ? 'Tags' : key === 'playing_age' ? 'Playing age (archive label)' : attributeLabel(key) ?? key, archive[key].join(', ')] as const) : [];
  if (archive?.skin_tone) labels.unshift(['Skin tone (archive label)', archive.skin_tone]);
  if (archive?.look) labels.unshift(['Look (archive label)', archive.look]);
  if (!archive && !facts.length) return null;
  return <div style={styles.supplied}>
    <h3>Supplied information</h3>
    {archive && <><p className="small muted">Imported from the cast archive{archive.source.source_project ? ` (${archive.source.source_project}` : ''}{archive.source.source_id ? `, record ${archive.source.source_id})` : archive.source.source_project ? ')' : ''}. Archive labels are neither self-reported nor confirmed by a reviewer here.</p>
      <dl style={styles.facts}>{labels.map(([label, value]) => <div key={label}><dt>{label}</dt><dd dir="auto">{value}</dd></div>)}
        <div><dt>Talent type</dt><dd>{appearanceValueLabel('talent_type', archive.talent_type)}</dd></div></dl></>}
    {facts.length > 0 && <dl style={styles.facts}>{facts.map(fact => <div key={fact.key}><dt>{FACT_LABEL[fact.key]}</dt>
      <dd><span dir="auto">{Array.isArray(fact.value) ? fact.value.join(', ') : fact.value}</span> <span className="small muted">· {fact.source ? SOURCE_LABEL[fact.source] : 'Source not recorded'}</span></dd></div>)}</dl>}
  </div>;
}

function MediaGroup({ media, view, canReview, busy, onReview }: { media: ObservationMedia; view: 'pending' | 'all'; canReview: boolean; busy: string | null;
  onReview: (observation: AppearanceObservation, action: 'confirm' | 'reject' | 'override' | 'reset', value?: string) => Promise<void> }) {
  const people = [...new Set(media.observations.map(item => item.person_index))].sort();
  const thumb = media.source_kind === 'photo' ? `/api/v1/candidate-photos/${encodeURIComponent(media.thumb_asset_id ?? media.asset_id)}/content` : `/api/v1/media/${encodeURIComponent(media.asset_id)}/content`;
  const context = media.source_kind === 'frame' ? `Video frame at ${time(media.frame_timestamp_ms)}` : 'Archive photo';
  const visible = (item: AppearanceObservation) => view === 'all' || item.status === 'suggested' && item.suggested_value !== 'unknown';
  if (!media.observations.some(visible)) return null;
  return <article style={styles.media} aria-label={`${CATEGORY[media.media_category]}, ${context}`}>
    <div style={styles.mediaHead}>
      <img style={styles.thumb} src={thumb} alt={`${context} used for these suggestions`} loading="lazy" />
      <div><h3>{CATEGORY[media.media_category]}</h3><p className="small muted">{context} · added {new Date(media.media_added_at).toLocaleDateString()} · analysed {new Date(media.analyzed_at).toLocaleDateString()}</p>
        <p className="small muted">Hair, facial hair, glasses and build belong to this image; other images may differ.</p>
        {media.quality_note && <p className="small">{media.quality_note}</p>}</div>
    </div>
    {media.ambiguous && <div className="notice notice-warn" role="note"><p><strong>Needs review:</strong> {media.people_count === 0 ? 'no clear person was found' : `${media.people_count} people are visible or the subject is unclear`}. {media.target_person_index === null
      ? 'Nothing from this image is searchable until a reviewer confirms which person is this candidate. Confirming a value selects that person.'
      : `Person ${media.target_person_index + 1} was confirmed as this candidate; other people in this image are ignored.`}</p></div>}
    {people.map(person => <div key={person} style={styles.person}>
      {media.ambiguous && <h4>Person {person + 1}{media.observations.find(o => o.person_index === person)?.position_note ? ` · ${media.observations.find(o => o.person_index === person)!.position_note}` : ''}
        {media.target_person_index === person && <span className="badge badge-ok"> This candidate</span>}</h4>}
      <ul style={styles.rows}>{media.observations.filter(item => item.person_index === person && visible(item)).map(item =>
        <ObservationRow key={item.id} item={item} canReview={canReview && !(media.ambiguous && media.target_person_index !== null && media.target_person_index !== person)} busy={busy === item.id} onReview={onReview} />)}</ul>
    </div>)}
  </article>;
}

function ObservationRow({ item, canReview, busy, onReview }: { item: AppearanceObservation; canReview: boolean; busy: boolean;
  onReview: (observation: AppearanceObservation, action: 'confirm' | 'reject' | 'override' | 'reset', value?: string) => Promise<void> }) {
  const [correcting, setCorrecting] = useState(false); const [value, setValue] = useState(''); const selectId = useId();
  const status = STATUS[item.status]; const definition = APPEARANCE_TAXONOMY.attributes[item.attribute];
  return <li style={styles.row}>
    <div style={styles.rowText}>
      <span style={styles.attribute}>{attributeLabel(item.attribute)}</span>
      <span style={styles.value}>{item.status === 'overridden' ? <>{appearanceValueLabel(item.attribute, item.override_value!)} <s className="small muted" aria-label={`suggested ${appearanceValueLabel(item.attribute, item.suggested_value)}`}>{appearanceValueLabel(item.attribute, item.suggested_value)}</s></>
        : appearanceValueLabel(item.attribute, item.suggested_value)}</span>
      <span className={status.tone}>{status.label}</span>
      <span className="small muted">{item.suggested_value === 'unknown' ? 'Not clearly visible' : `${item.confidence} confidence`}{definition?.lighting_sensitive ? ' · lighting can change visible tone' : ''}{item.attribute === 'playing_age' ? ' · casting range, not verified age' : ''}</span>
      {item.evidence && <span className="small muted">“{item.evidence}”</span>}
    </div>
    {canReview && <div className="row-actions">
      {item.status === 'suggested' ? <>
        {item.suggested_value !== 'unknown' && <button type="button" className="button button-small button-primary" disabled={busy} onClick={() => void onReview(item, 'confirm')}>Confirm</button>}
        <button type="button" className="button button-small" disabled={busy} onClick={() => void onReview(item, 'reject')}>Reject</button>
      </> : <button type="button" className="button button-small" disabled={busy} onClick={() => void onReview(item, 'reset')}>Undo review</button>}
      <button type="button" className="button button-small" disabled={busy} aria-expanded={correcting} onClick={() => setCorrecting(open => !open)}>Correct</button>
    </div>}
    {canReview && correcting && <form style={styles.correct} onSubmit={event => { event.preventDefault(); if (value) void onReview(item, 'override', value).then(() => setCorrecting(false)); }}>
      <label htmlFor={selectId}>Correct {attributeLabel(item.attribute).toLowerCase()}</label>
      <select id={selectId} value={value} onChange={event => setValue(event.target.value)} required>
        <option value="">Choose a value</option>{appearanceValues(item.attribute).map(key => <option key={key} value={key}>{appearanceValueLabel(item.attribute, key)}</option>)}
      </select>
      <button className="button button-small button-primary" disabled={busy || !value}>Save correction</button>
    </form>}
  </li>;
}
