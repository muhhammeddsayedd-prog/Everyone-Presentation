'use client';

import { useState } from 'react';

export function CandidateFrameImage({ assetId, alt }: { assetId: string; alt: string }) {
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null);
  const failed = failedAssetId === assetId;
  const source = `/api/v1/media/${encodeURIComponent(assetId)}/content`;
  return <>
    <img key={assetId} src={source} alt={alt} loading="lazy" hidden={failed}
      onError={() => setFailedAssetId(assetId)} onLoad={() => setFailedAssetId(null)} />
    {failed && <span className="small muted">Frame preview unavailable. Reload this page to try again.</span>}
    <a className="small" href={source} target="_blank" rel="noreferrer noopener" aria-label={`View full-size frame: ${alt}`}>View full-size frame</a>
  </>;
}
