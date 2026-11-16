'use client';
import type { FacetFilters } from '../../../../packages/domain/src/appearance';
import { LibraryFacetFilters } from './LibraryFacetFilters';

/** Bridge for CastLibraryView's renderFacets: facet state lives in its pass-through search params
 * (`facets` = JSON {facet:[values]}, `facet_include_unknown` = "true"), and the view's own supplied-fact filters and
 * query are forwarded so the facet counts are computed with exactly the filters the result list uses. */
export function CastLibraryFacets({ params, setParam, search }: { params: Record<string, string>; setParam: (key: string, value: string) => void; search: Record<string, string> }) {
  let facets: FacetFilters['facets'] = {};
  try { const parsed = params.facets ? JSON.parse(params.facets) : {}; if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) facets = parsed; } catch { facets = {}; }
  const forwarded: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(search)) {
    if (value === '' || value === undefined) continue;
    if (key === 'include_unknown') forwarded.include_unknown = value !== 'false'; else forwarded[key] = value;
  }
  const value: FacetFilters = { facets, include_unknown: params.facet_include_unknown === 'true', search: forwarded };
  return <LibraryFacetFilters value={value} initiallyOpen={2} onChange={next => {
    setParam('facets', Object.keys(next.facets).length ? JSON.stringify(next.facets) : '');
    setParam('facet_include_unknown', next.include_unknown ? 'true' : '');
  }} />;
}
