'use client';

import { useState } from 'react';

export function CandidateFrameImage({ assetId, alt }: { assetId: string; alt: string }) {
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null);
  const failed = failedAssetId === assetId;
  return <>
    <img key={assetId} src={`/api/v1/media/${encodeURIComponent(assetId)}/content`} alt={alt} loading="lazy" hidden={failed}
      onError={() => setFailedAssetId(assetId)} onLoad={() => setFailedAssetId(null)} />
    {failed && <span className="small muted">Frame preview unavailable. Reload this page to try again.</span>}
  </>;
}
