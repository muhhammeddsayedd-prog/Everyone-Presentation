'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { readCandidateMedia } from './candidate-pages';

interface CandidatePhoto { id: string; cover: boolean; asset_id: string; thumb_asset_id: string }

/** The person's picture: their cover photo from the cast archive, else the first selected (or extracted) video
 * frame. It is read once the card scrolls into view. Without either (or if reading fails) the initial stays —
 * nothing is invented. `size="large"` uses the full photo (profile hero); cards use the thumbnail. */
export function CandidatePortrait({ candidateId, name, size = 'thumb' }: { candidateId: string; name: string | null; size?: 'thumb' | 'large' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [source, setSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const controller = new AbortController();
    async function read() {
      try {
        const photos = await api<CandidatePhoto[]>(`/api/v1/candidates/${encodeURIComponent(candidateId)}/photos`, { signal: controller.signal });
        const photo = photos.data.find(item => item.cover) ?? photos.data[0];
        if (photo) { setSource(`/api/v1/candidate-photos/${encodeURIComponent(size === 'large' ? photo.asset_id : photo.thumb_asset_id)}/content`); return; }
      } catch { if (controller.signal.aborted) return; /* no photo read path or no access: try a video frame */ }
      try {
        const result = await readCandidateMedia(candidateId, { signal: controller.signal });
        const frame = result.data.map(media => media.selected_frame_asset_ids[0] ?? media.available_frames[0]?.asset_id).find(Boolean);
        if (frame) setSource(`/api/v1/media/${encodeURIComponent(frame)}/content`);
      } catch { /* the initial stays */ }
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect(); void read();
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => { observer.disconnect(); controller.abort(); };
  }, [candidateId, size]);
  return <span ref={ref} className="library-portrait" data-loaded={loaded ? '' : undefined}>
    <span className="library-portrait-initial" aria-hidden="true">{name?.trim().slice(0, 1).toUpperCase() || '?'}</span>
    {source && !failed && <img src={source} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />}
  </span>;
}
