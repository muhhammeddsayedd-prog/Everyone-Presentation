'use client';

import { useState } from 'react';
import type { PortraitCrop, PortraitSource, WorkspaceCandidate } from '@eps/domain';
import { Icon } from './Icon';

export function pictureUrl(assetId: string, source: PortraitSource) {
  return source === 'photo' ? `/api/v1/candidate-photos/${encodeURIComponent(assetId)}/content` : `/api/v1/media/${encodeURIComponent(assetId)}/content`;
}
/** The same focal point the PDF and PowerPoint use; a crop rectangle centres on its middle. */
export function cropPosition(crop: PortraitCrop | null) {
  if (!crop) return undefined;
  const x = crop.rect ? crop.rect.x + crop.rect.width / 2 : crop.focal_x; const y = crop.rect ? crop.rect.y + crop.rect.height / 2 : crop.focal_y;
  return `${Math.round(x * 1000) / 10}% ${Math.round(y * 1000) / 10}%`;
}

type Picture = Pick<WorkspaceCandidate, 'portrait_asset_id' | 'portrait_source' | 'portrait_crop' | 'media_selection_state'>;

/** A project row's presentation picture: only the project's pinned picture, never a Library fallback.
 * Every missing state is named in words, not colour alone. */
export function ProjectPicture({ item, processing }: { item: Picture; processing?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const asset = item.portrait_asset_id; const source = item.portrait_source;
  const broken = asset !== null && failed === asset;
  const state = processing && !asset ? { label: 'Processing', tone: 'info' } : broken ? { label: 'Picture can’t be loaded', tone: 'bad' }
    : asset ? null : item.media_selection_state === 'intentionally_empty' ? { label: 'No picture (intentional)', tone: 'outline' } : { label: 'No presentation picture', tone: 'warn' };
  return <span className="project-picture">
    <span className="candidate-portrait" aria-hidden="true">{asset && source && !broken
      ? <img key={asset} src={pictureUrl(asset, source)} alt="" loading="lazy" decoding="async" style={{ objectPosition: cropPosition(item.portrait_crop) }} onError={() => setFailed(asset)} />
      : <Icon name={broken ? 'alert' : 'people'} />}</span>
    {state && <span className={`badge badge-${state.tone} project-picture-state`}>{state.label}</span>}
  </span>;
}
