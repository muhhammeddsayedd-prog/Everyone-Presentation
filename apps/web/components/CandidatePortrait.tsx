'use client';

import { useEffect, useRef, useState } from 'react';
import { readCandidateMedia } from './candidate-pages';

/** A real video frame for a Cast Library card: the first selected frame, else the first extracted one. It is only
 * read once the card scrolls into view. Without a frame (or if reading fails) the initial stays — nothing is invented. */
export function CandidatePortrait({ candidateId, name }: { candidateId: string; name: string | null }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      readCandidateMedia(candidateId, { signal: controller.signal }).then(result => {
        const frame = result.data.map(media => media.selected_frame_asset_ids[0] ?? media.available_frames[0]?.asset_id).find(Boolean);
        if (frame) setAssetId(frame);
      }).catch(() => undefined);
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => { observer.disconnect(); controller.abort(); };
  }, [candidateId]);
  return <span ref={ref} className="library-portrait">
    <span className="library-portrait-initial" aria-hidden="true">{name?.trim().slice(0, 1).toUpperCase() || '?'}</span>
    {assetId && !failed && <img src={`/api/v1/media/${encodeURIComponent(assetId)}/content`} alt="" loading="lazy" onError={() => setFailed(true)} />}
  </span>;
}
