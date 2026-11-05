'use client';

import type { Actor } from './api';
import { ShareWorkspace } from './share/ShareWorkspace';

/** /presentations/series/{id}/sharing: the series' review links and feedback, presentation-first (P3). */
export function ReviewSharingView({ seriesId, actor, onDirtyChange }: { seriesId: string; actor: Actor; onDirtyChange: (value: boolean) => void }) {
  return <ShareWorkspace seriesId={seriesId} actor={actor} onDirtyChange={onDirtyChange} />;
}
