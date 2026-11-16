'use client';

import { useState } from 'react';
import type { PortraitCrop, PortraitSource, WorkspaceCandidate } from '@eps/domain';
import { Icon } from './Icon';
import { PORTRAIT_FOCAL } from '../../../packages/templates/versions/1.4.0/layouts';

export function pictureUrl(assetId: string, source: PortraitSource) {
  return source === 'photo' ? `/api/v1/candidate-photos/${encodeURIComponent(assetId)}/content` : `/api/v1/media/${encodeURIComponent(assetId)}/content`;
}
const fraction = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : fallback;
/** The template rule the PDF and PowerPoint use: cover the box at the focal point (focal_x/focal_y only), else the
 * template's portrait default. Any other crop field is ignored, so the app never frames differently from the deck. */
export function cropPosition(crop: Pick<PortraitCrop, 'focal_x' | 'focal_y'> | null) {
  const x = fraction(crop?.focal_x, PORTRAIT_FOCAL[0]); const y = fraction(crop?.focal_y, PORTRAIT_FOCAL[1]);
  return `${x * 100}% ${y * 100}%`;
}

type Picture = Pick<WorkspaceCandidate, 'portrait_asset_id' | 'portrait_source' | 'portrait_crop' | 'media_selection_state'>;

/** A project row's presentation picture: only the project's pinned picture, never a Library fallback.
 * Every missing state is named in words, not colour alone. `processing` = this person's material is still being
 * prepared: a pinned picture that cannot be read yet shows "Processing" and is retried once processing ends;
 * only a picture that fails to load or decode when nothing is processing shows "Picture can't be loaded". */
export function ProjectPicture({ item, processing = false }: { item: Picture; processing?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const asset = item.portrait_asset_id; const source = item.portrait_source;
  // A failure is remembered per asset and per processing phase: when processing ends the picture is read again.
  const attempt = asset ? `${asset}/${processing ? 'processing' : 'ready'}` : null;
  const broken = attempt !== null && failed === attempt;
  const state = processing && (!asset || broken) ? { label: 'Processing', tone: 'info' } : broken ? { label: 'Picture can’t be loaded', tone: 'bad' }
    : asset ? null : item.media_selection_state === 'intentionally_empty' ? { label: 'No picture (intentional)', tone: 'outline' } : { label: 'No presentation picture', tone: 'warn' };
  return <span className="project-picture">
    <span className="candidate-portrait" aria-hidden="true">{asset && source && !broken
      ? <img key={attempt} src={pictureUrl(asset, source)} alt="" loading="lazy" decoding="async" style={{ objectFit: 'cover', objectPosition: cropPosition(item.portrait_crop) }} onError={() => setFailed(attempt)} />
      : <Icon name={broken && !processing ? 'alert' : 'people'} />}</span>
    {state && <span className={`badge badge-${state.tone} project-picture-state`}>{state.label}</span>}
  </span>;
}
