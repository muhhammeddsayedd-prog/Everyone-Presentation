'use client';
import { useEffect, useId, useState } from 'react';
import { APPEARANCE_TAXONOMY, appearanceValueLabel, type CandidateFacets, type FacetCounts, type FacetFilters } from '../../../../packages/domain/src/appearance';
import { api, errorMessage } from '../api';
import { ErrorNotice } from '../Feedback';
import { APPEARANCE_STYLES as styles } from '../candidate/appearance-styles';

/** Standalone Cast Library facet filters (not yet mounted in CastLibraryView; A1 owns that view and search).
 *
 * Integration API: controlled `value: FacetFilters` ({ facets: { facet: [values] }, include_unknown, q? }) and `onChange`.
 * Keep the URL in sync with facetFiltersToSearchParams / facetFiltersFromSearchParams from @eps/domain
 * (repeatable `facet=<key>:<value>` plus `include_unknown=true`), and pass the same object to search as
 * `p_search.facets` (see docs/integrations/A4_APPEARANCE_ENRICHMENT.md). Counts come from POST /api/v1/candidate-facets/query.
 * Counts are distinct people. Appearance facets use confirmed and corrected values only; suggestions awaiting review are not counted. */
const FACET_LABELS = Object.fromEntries(APPEARANCE_TAXONOMY.facets.map(facet => [facet.key, facet]));
const OBSERVED = new Set(['playing_age', 'skin_tone', 'hair_length', 'hair_colour', 'hair_texture', 'facial_hair', 'glasses', 'build']);
const ARABIC = /[؀-ۿ]/u;
export function facetValueLabel(facet: string, value: string) {
  if (value === 'unknown') return 'Unknown';
  if (APPEARANCE_TAXONOMY.attributes[facet] || APPEARANCE_TAXONOMY.supplied_values[facet]) return appearanceValueLabel(facet, value);
  return value;
}
export const EMPTY_FACET_FILTERS: FacetFilters = { facets: {}, include_unknown: false };

export function LibraryFacetFilters({ value, onChange, groups = APPEARANCE_TAXONOMY.facets.map(facet => facet.key), initiallyOpen = 4 }:
  { value: FacetFilters; onChange: (next: FacetFilters) => void; groups?: string[]; initiallyOpen?: number }) {
  const [data, setData] = useState<CandidateFacets | null>(null); const [error, setError] = useState(''); const [loadedFor, setLoadedFor] = useState(''); const [attempt, setAttempt] = useState(0);
  const body = JSON.stringify({ facets: value.facets, include_unknown: value.include_unknown, ...(value.q ? { q: value.q } : {}), ...(value.search && Object.keys(value.search).length ? { search: value.search } : {}) });
  useEffect(() => {
    const controller = new AbortController();
    api<CandidateFacets>('/api/v1/candidate-facets/query', { method: 'POST', body, signal: controller.signal })
      .then(result => { setData(result.data); setError(''); setLoadedFor(body); }).catch(cause => { if (!controller.signal.aborted) { setError(errorMessage(cause)); setLoadedFor(body); } });
    return () => controller.abort();
  }, [body, attempt]);
  const loading = loadedFor !== body;
  const toggle = (facet: string, item: string) => {
    const current = value.facets[facet] ?? []; const next = current.includes(item) ? current.filter(entry => entry !== item) : [...current, item];
    const facets = { ...value.facets }; if (next.length) facets[facet] = next; else delete facets[facet]; onChange({ ...value, facets });
  };
  const chips = Object.entries(value.facets).flatMap(([facet, list]) => (list ?? []).map(item => ({ facet, item })));
  return <section style={styles.filters} aria-label="Cast Library filters" aria-busy={loading}>
    <div style={styles.head}>
      <p style={styles.total} aria-live="polite">{data ? `${data.total} ${data.total === 1 ? 'person' : 'people'}` : loading ? 'Counting…' : ''}</p>
      <button type="button" className="button button-small" disabled={!chips.length && !value.include_unknown} onClick={() => onChange({ ...EMPTY_FACET_FILTERS, ...(value.q ? { q: value.q } : {}), ...(value.search ? { search: value.search } : {}) })}>Reset filters</button>
    </div>
    <p className="small muted">Counts are people. Appearance filters use confirmed and corrected values only; suggestions awaiting review are not counted. Archive labels and supplied facts count as supplied.</p>
    {chips.length > 0 && <ul style={styles.chips} aria-label="Active filters">{chips.map(({ facet, item }) => <li key={`${facet}:${item}`}>
      <button type="button" style={styles.chip} onClick={() => toggle(facet, item)} aria-label={`Remove filter ${FACET_LABELS[facet]?.label}: ${facetValueLabel(facet, item)}`}>
        <span>{FACET_LABELS[facet]?.label}:</span> <span dir="auto">{facetValueLabel(facet, item)}</span> <span aria-hidden="true">×</span></button></li>)}</ul>}
    <label style={styles.unknown}><input type="checkbox" checked={value.include_unknown} onChange={event => onChange({ ...value, include_unknown: event.target.checked })} />
      Include people with unknown value <span className="small muted">(when a filter is active, people with no value for that filter are also shown)</span></label>
    {error && <ErrorNotice message={error} retry={() => setAttempt(count => count + 1)} />}
    {data && groups.map((key, index) => { const facet = data.facets.find(entry => entry.key === key); return facet ? <FacetGroup key={key} facet={facet} open={index < initiallyOpen} selected={value.facets[key] ?? []} onToggle={item => toggle(key, item)} /> : null; })}
  </section>;
}

function FacetGroup({ facet, open, selected, onToggle }: { facet: FacetCounts; open: boolean; selected: string[]; onToggle: (value: string) => void }) {
  const titleId = useId(); const meta = FACET_LABELS[facet.key];
  const values = [...facet.values]; for (const item of selected) if (item !== 'unknown' && !values.some(entry => entry.value === item)) values.push({ value: item, count: 0 });
  const arabic = values.some(entry => ARABIC.test(entry.value));
  return <details style={styles.group} open={open || selected.length > 0}>
    <summary id={titleId}><span>{meta?.label ?? facet.key}</span>{arabic && <span className="small muted" lang="ar" dir="rtl"> {meta?.label_ar}</span>}
      {OBSERVED.has(facet.key) && <span className="small muted"> · confirmed only</span>}{selected.length > 0 && <span className="badge"> {selected.length}</span>}</summary>
    <ul style={styles.values} aria-labelledby={titleId}>
      {values.map(entry => <li key={entry.value}><label style={styles.valueLabel}><input type="checkbox" checked={selected.includes(entry.value)} onChange={() => onToggle(entry.value)} />
        <span dir="auto" lang={ARABIC.test(entry.value) ? 'ar' : undefined}>{facetValueLabel(facet.key, entry.value)}</span><span style={styles.count}>{entry.count}</span></label></li>)}
      <li><label style={styles.valueLabel}><input type="checkbox" checked={selected.includes('unknown')} onChange={() => onToggle('unknown')} />
        <span>Unknown / not provided</span><span style={styles.count}>{facet.unknown}</span></label></li>
    </ul>
    {!values.length && <p className="small muted">No {facet.key === 'tags' ? 'tags' : 'values'} recorded for people matching the other filters.</p>}
  </details>;
}
