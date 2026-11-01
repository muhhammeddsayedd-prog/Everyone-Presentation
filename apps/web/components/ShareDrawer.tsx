'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { PresentationSeries } from '@eps/domain';
import { api, errorMessage, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { ReviewLinksPanel } from './ReviewLinksPanel';
import { Drawer } from './ui/Overlay';

/** Sharing in context: the same link controls as /presentations/series/{id}/sharing, in a drawer. */
export function ShareDrawer({ seriesId, actor, onClose }: { seriesId: string; actor: Actor; onClose: () => void }) {
  const [series, setSeries] = useState<PresentationSeries | null>(null); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<PresentationSeries>(`/api/v1/presentation-series/${encodeURIComponent(seriesId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
      .then(result => { if (result.data.id !== seriesId) throw new Error('This series could not be confirmed. Reload the page.'); setSeries(result.data); setError(''); })
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); });
    return () => controller.abort();
  }, [seriesId, attempt]);
  const canManage = actor.capabilities?.includes('review_links.manage') === true;
  return <Drawer wide title="Share for review" busy={pending} closeLabel="Close sharing"
    description={series ? <>{series.title} · {series.audience_snapshot.label}. Guests always see the newest ready version of this series and its output.</> : 'Review links for this presentation series.'}
    onClose={onClose} footer={<><Link className="button button-quiet" href={`/presentations/series/${seriesId}/sharing`}>Open sharing and feedback page<Icon name="external" /></Link><span className="grow" /><button type="button" className="button" onClick={onClose} disabled={pending}>Done</button></>}>
    {error ? <ErrorNotice message={error} retry={() => setAttempt(value => value + 1)} />
      : !series ? <Loading label="Opening sharing…" />
      : series.archived ? <div className="notice notice-warning"><p>This series is archived. Restore it from Presentations before sharing it again.</p></div>
      : series.audience_snapshot.scope !== 'external' ? <div className="notice notice-info"><p>This series uses an internal audience, so it cannot be shared with guests. Generate a series for an external audience to share it.</p></div>
      : !canManage ? <p className="permission-note"><Icon name="lock" />Creating and changing review links requires review link permission.</p>
      : <ReviewLinksPanel seriesId={series.id} workspaceId={series.workspace_id} actor={actor} onDirtyChange={setPending} />}
  </Drawer>;
}
