'use client';
import { useEffect, useState } from 'react';
import { facetFiltersFromSearchParams, facetFiltersToSearchParams, type FacetFilters } from '../../../../packages/domain/src/appearance';
import { LibraryFacetFilters } from './LibraryFacetFilters';

/** URL-synchronised harness: the same wiring CastLibraryView can reuse (facet=key:value, include_unknown=true). */
export function LibraryFacetFiltersPreview() {
  const [filters, setFilters] = useState<FacetFilters | null>(null);
  useEffect(() => { setFilters(facetFiltersFromSearchParams(new URLSearchParams(window.location.search))); }, []);
  if (!filters) return null;
  return <LibraryFacetFilters value={filters} onChange={next => { setFilters(next); const params = facetFiltersToSearchParams(next, new URLSearchParams(window.location.search));
    window.history.replaceState(null, '', `${window.location.pathname}${params.size ? `?${params}` : ''}`); }} />;
}
