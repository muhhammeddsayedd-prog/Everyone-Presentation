import { notFound } from 'next/navigation';
import { readRuntimeConfig } from '../../../lib/config';
import { LibraryFacetFiltersPreview } from '../../../components/library/LibraryFacetFiltersPreview';

export const dynamic = 'force-dynamic';
/** Development/test preview of the standalone Library facet filters until A1 mounts them in CastLibraryView. */
export default function LibraryFiltersPreviewPage() {
  let environment: string; try { environment = readRuntimeConfig().environment; } catch { notFound(); }
  if (!['development', 'test'].includes(environment)) notFound();
  return <main className="main-content"><h1>Cast Library filters (preview)</h1>
    <p>Standalone facet filters. Search results are wired in by the Cast Library search owner; this preview shows counts only.</p>
    <LibraryFacetFiltersPreview /></main>;
}
