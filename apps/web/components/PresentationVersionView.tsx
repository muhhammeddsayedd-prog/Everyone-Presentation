'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { PresentationVersion, VersionMediaPlayback, VersionTranscriptCompanion } from '@eps/domain';
import { feedbackSummaryDto, type FeedbackSummary } from '../../../packages/domain/src/feedback-summary.ts';
import { api, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { Icon } from './Icon';
import { ReviewFeedbackPanel } from './ReviewFeedbackPanel';
import { ShareDrawer } from './ShareDrawer';
import { SourceTranscript } from './SourceTranscript';
import { StudioDateTime } from './StudioTimeZone';
import { FramePortal } from './shell/Frame';
import { PageFrame, RightPanel } from './shell/PageFrame';
import { useConfirm } from './ui/Confirm';
import { outputLabel, SavedSlideList, SavedStage, slideName, statusLabel, useSavedVersion, VersionActions } from './presentation/saved-version';

/** Comment counts per saved slide for one version, when the reader may see them. Unavailable leaves the list unbadged. */
export function useFeedbackCounts(versionId: string | null, refresh = 0) {
  const [summary, setSummary] = useState<FeedbackSummary | null>(null);
  useEffect(() => {
    if (!versionId) return; let current = true; const controller = new AbortController();
    api<unknown>(`/api/v1/versions/${encodeURIComponent(versionId)}/feedback/summary`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })
      .then(result => { const parsed = feedbackSummaryDto(result.data); if (current && parsed.version_id === versionId) setSummary(parsed); })
      .catch(() => { if (current) setSummary(null); });
    return () => { current = false; controller.abort(); };
  }, [versionId, refresh]);
  return summary && summary.version_id === versionId ? Object.fromEntries(summary.per_slide.filter(row => row.comment_count > 0).map(row => [row.version_slide_id, row.comment_count])) : undefined;
}

/** The saved presentation viewer: the slide list in the panel, the captured version on the stage and its feedback
 * beside it. Everything shown is the version's own snapshot and retained media — never the working draft. */
export function PresentationVersionView({ versionId, actor, onDirtyChange }: { versionId: string; actor: Actor; onDirtyChange?: (dirty: boolean) => void }) {
  return <VersionPage key={`${actor.id}:${versionId}`} versionId={versionId} actor={actor} onDirtyChange={onDirtyChange} />;
}
function VersionPage({ versionId, actor, onDirtyChange }: { versionId: string; actor: Actor; onDirtyChange?: (dirty: boolean) => void }) {
  const { version, error, loading, reload } = useSavedVersion(versionId);
  const confirm = useConfirm();
  const [index, setIndex] = useState(0); const [layout, setLayout] = useState<'app' | 'pdf'>('app'); const [sharing, setSharing] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(true); const [feedback, setFeedback] = useState({ locked: false, dirty: false });
  const feedbackChanged = useCallback((value: { locked: boolean; dirty: boolean }) => setFeedback(value), []);
  useEffect(() => { onDirtyChange?.(feedback.locked || feedback.dirty); return () => onDirtyChange?.(false); }, [feedback, onDirtyChange]);
  const counts = useFeedbackCounts(version?.status === 'ready' ? version.id : null);
  async function go(next: number) {
    if (!version || next === index || next < 0 || next >= version.slides.length) return;
    if (feedback.locked) return;
    if (feedback.dirty && !await confirm({ title: 'Discard your unsent comment?', description: 'Moving to another slide discards the comment you have not posted. Feedback stays with the slide it was given on.', confirmLabel: 'Discard comment', cancelLabel: 'Keep writing', danger: true })) return;
    setIndex(next);
  }
  if (loading && !version) return <Loading label="Opening saved version…" />;
  if (!version) return <div className="system-state"><span className="system-state-code" aria-hidden="true"><Icon name="slides" /></span><h1>Saved version unavailable</h1><ErrorNotice message={error || 'Saved version unavailable.'} retry={reload} /><div className="button-row"><Link className="button" href="/presentations">All presentations</Link></div></div>;
  const slide = version.slides[index] ?? version.slides[0];
  const candidate = slide.kind === 'candidate';
  const canWrite = actor.capabilities?.includes('workspaces.write');
  const right = feedbackOpen && version.status === 'ready' ? <RightPanel title="Feedback" subtitle={`${candidate ? slideName(slide) : 'Choose a candidate slide'} · Version ${version.version_no}`} closeLabel="Close feedback" onClose={feedback.dirty || feedback.locked ? undefined : () => setFeedbackOpen(false)}>
    <ReviewFeedbackPanel versionId={version.id} versionNo={version.version_no} slides={version.slides} slideId={candidate ? slide.id : undefined} canWrite={canWrite} onStateChange={feedbackChanged}
      onSlideChange={id => { const next = version.slides.findIndex(item => item.id === id); if (next >= 0) setIndex(next); }} />
  </RightPanel> : undefined;
  return <>
    <FramePortal slot="top"><div className="workspace-top">
      <div className="workspace-title"><h1 dir="auto">{version.render_context.cover.project_name} · Version {version.version_no}</h1></div>
      <nav className="workspace-breadcrumb" aria-label="Breadcrumb"><Link href="/presentations">Presentations</Link><Icon name="chevron-right" /><span dir="auto">{version.render_context.cover.title}</span><Icon name="chevron-right" /><span aria-current="page">Version {version.version_no}</span></nav>
    </div></FramePortal>
    <PageFrame inline className="presentation-frame version-frame" right={right}
      panel={{ title: `Saved version ${version.version_no}`, subtitle: `${outputLabel(version)} · ${statusLabel(version)}`, label: 'Saved version panel', wide: true,
        body: <>
          <p className="small muted">Captured <StudioDateTime value={version.created_at} />. This version keeps its captured words and media; working-draft edits appear in a future version.</p>
          <div className="button-row version-meta-actions"><VersionActions version={version} compact onShare={() => setSharing(true)} /></div>
          {error && <ErrorNotice message={error} retry={reload} />}
          <SavedSlideList version={version} index={index} onIndex={value => void go(value)} badges={counts} />
        </>,
        footer: <div className="panel-foot-actions"><Link className="button button-quiet" href="/presentations">All presentations</Link><span className="grow" /><button type="button" className="button button-quiet" onClick={reload} disabled={loading}><Icon name="refresh" />Refresh saved version</button></div> }}>
      <SavedStage version={version} index={index} onIndex={value => void go(value)} layout={layout} onLayout={setLayout} strip={false}
        meta={<>Slide {index + 1} of {version.slides.length}</>}
        tools={version.status === 'ready' && !feedbackOpen ? <button type="button" className="button button-small" onClick={() => setFeedbackOpen(true)}><Icon name="comment" />Show feedback</button> : undefined} />
    </PageFrame>
    {sharing && <ShareDrawer seriesId={version.series_id} actor={actor} onClose={() => setSharing(false)} />}
  </>;
}

export function VersionMediaView({ versionId, assetId, actor }: { versionId: string; assetId: string; actor: Actor }) {
  return <VersionMediaScope key={`${actor.id}:${versionId}:${assetId}`} versionId={versionId} assetId={assetId} />;
}
/** The original introduction a saved slide links to: played from the saved version's retained video, with the
 * transcript captured beside it. Access is requested only when the viewer asks to play. */
function VersionMediaScope({ versionId, assetId }: { versionId: string; assetId: string }) {
  const [url, setUrl] = useState<string | null>(null); const [version, setVersion] = useState<PresentationVersion | null>(null);
  const [transcript, setTranscript] = useState<VersionTranscriptCompanion>();
  const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0); const [busy, setBusy] = useState(false);
  useEffect(() => { let current = true; const controller = new AbortController();
    api<PresentationVersion>(`/api/v1/versions/${encodeURIComponent(versionId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) }).then(result => {
      if (!current) return; if (result.data.id !== versionId || !result.data.slides.some(slide => slide.video_asset_id === assetId)) throw new Error('This original introduction is not part of the saved version.'); setVersion(result.data); setError('');
    }).catch(reason => { if (current) setError(errorMessage(reason)); }); return () => { current = false; controller.abort(); };
  }, [versionId, assetId, refresh]);
  async function play() { setBusy(true); setError(''); setUrl(null); setTranscript(undefined);
    try { const value = (await api<VersionMediaPlayback>(`/api/v1/versions/${versionId}/media/${assetId}/playback`, { ...mutation('POST'), signal: AbortSignal.timeout(30000) })).data;
      if (value.source_version_id !== versionId || value.asset_id !== assetId) throw new Error('Saved media identity changed. Refresh access.'); setUrl(value.url); setTranscript(value.transcript);
    } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); }
  }
  const index = version ? version.slides.findIndex(slide => slide.video_asset_id === assetId) : -1; const slide = version && index >= 0 ? version.slides[index] : null;
  const person = slide ? slideName(slide) : null;
  return <>
    <FramePortal slot="top"><div className="workspace-top">
      <div className="workspace-title"><span className="media-top-title" dir="auto">{person ? `${person} · Original introduction` : 'Original introduction'}</span></div>
      <nav className="workspace-breadcrumb" aria-label="Breadcrumb"><Link href={`/presentations/versions/${versionId}`}>{version ? `Version ${version.version_no}` : 'Saved version'}</Link>{slide && <><Icon name="chevron-right" /><span aria-current="page" dir="auto">Slide {index + 1} · {slide.role_label ?? 'Requirements pending'}</span></>}</nav>
    </div></FramePortal>
    <PageFrame inline className="presentation-frame media-frame"
      panel={{ title: 'Transcript', subtitle: 'Machine transcript · may contain errors', label: 'Transcript panel', wide: true,
        body: <div className="media-transcript">{url ? <SourceTranscript versionId={versionId} assetId={assetId} transcript={transcript} /> : <p className="small muted">The transcript captured with this saved video appears once the video is opened. It is never part of the slide or the PDF.</p>}</div>,
        footer: <p className="small muted">Played from the saved version · private link</p> }}>
      <section className="media-stage version-original-media" aria-label="Original introduction">
        <header className="stage-bar"><div className="stage-state"><h1 className="stage-heading">Original introduction</h1>{version && <span className="stage-meta" dir="auto">{version.render_context.cover.project_name} · Saved version {version.version_no}</span>}</div>
          <div className="stage-tools"><Link className="button button-small" href={`/presentations/versions/${versionId}`}><Icon name="chevron-left" />Back to saved version</Link></div></header>
        {error && <div className="stage-notice"><ErrorNotice message={error} retry={() => { setVersion(null); setUrl(null); setRefresh(value => value + 1); }} /></div>}
        <div className="media-stage-body">{!version && !error ? <Loading /> : version && <div className="media-player">
          {url ? <video controls preload="metadata" className="candidate-video" src={url} onError={() => { setUrl(null); setTranscript(undefined); setError('Video access expired or the retained video is unavailable. Refresh video access.'); }} />
            : <button type="button" className="video-poster" disabled={busy} onClick={() => void play()}><Icon name="play" /><span>{busy ? 'Opening saved video…' : 'Open saved video'}</span></button>}
        </div>}</div>
        <p className="media-caption">{url && <button type="button" className="button button-small button-quiet" disabled={busy} onClick={() => void play()}><Icon name="refresh" />Refresh video access</button>} This link opens the original video retained by this saved version.{person && <> · <strong dir="auto">{person}</strong>{slide?.role_label ? ` · ${slide.role_label}` : ''}</>}</p>
      </section>
    </PageFrame>
  </>;
}
