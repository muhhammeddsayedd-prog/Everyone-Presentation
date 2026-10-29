'use client';

import { useEffect, useState } from 'react';

export function VersionAssetImage(props: { versionId: string; assetId: string; alt: string; className?: string }) {
  return <ImageScope key={`${props.versionId}:${props.assetId}`} {...props} />;
}

function ImageScope({ versionId, assetId, alt, className }: { versionId: string; assetId: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let current = true; let objectUrl: string | null = null;
    const load = async () => {
      try {
        const response = await fetch(`/api/v1/versions/${encodeURIComponent(versionId)}/media/${encodeURIComponent(assetId)}/content`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), headers: { Accept: 'image/*' },
        });
        const mime = response.headers.get('content-type')?.split(';')[0].trim();
        if (!response.ok || !mime || !['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(mime) || !response.body) { await response.body?.cancel(); throw new Error('SAVED_IMAGE_UNAVAILABLE'); }
        const reader = response.body.getReader(); const chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
        try {
          for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength;
            if (size > 20 * 1024 * 1024) { await reader.cancel(); throw new Error('SAVED_IMAGE_UNAVAILABLE'); }
            chunks.push(new Uint8Array(part.value)); }
        } finally { reader.releaseLock(); }
        if (!size) throw new Error('SAVED_IMAGE_UNAVAILABLE');
        if (!current) return;
        objectUrl = URL.createObjectURL(new Blob(chunks, { type: mime })); setFailed(false); setUrl(objectUrl);
      } catch { if (current) setFailed(true); }
    };
    void load();
    return () => { current = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [versionId, assetId, retry]);
  if (failed) return <div className="saved-image-error"><p role="status">This saved image is unavailable. Retry access or open the saved PDF.</p><button className="button" onClick={() => { setFailed(false); setUrl(null); setRetry(value => value + 1); }}>Retry saved image</button></div>;
  if (!url) return <p className="saved-image-loading" role="status">Opening saved image…</p>;
  // The version content route verifies the exact retained asset and its bytes.
  return <img className={className} src={url} alt={alt} onError={() => setFailed(true)} />;
}
