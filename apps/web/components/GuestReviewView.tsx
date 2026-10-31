'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExternalPresentationVersion, GuestBrowserAccess } from '../../../packages/domain/src/guest-types';
import type { VersionSlide, VersionMediaPlayback, VersionTranscriptCompanion } from '@eps/domain';
import { slideWordingFields } from '../../../packages/domain/src/casting-types';
import { REVIEW_FIELD_LABELS } from '../../../packages/templates/src/render';
import { PENDING_REQUIREMENT_LABELS } from '../../../packages/templates/versions/1.1.0/render';
import { ApiError } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { ReviewFeedbackPanel } from './ReviewFeedbackPanel';
import { GuestPdfDownload } from './GuestPdfDownload';
import { SourceTranscript } from './SourceTranscript';
import { reviewError, reviewRequest, sameOriginReviewUrl } from './review-client';

const identifier = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const browserHeaders = { 'X-EPS-Review-Browser': '1' };
export function GuestReviewView({ entryToken }: { entryToken: string }) {
  const [access, setAccess] = useState<GuestBrowserAccess | null>(null), [version, setVersion] = useState<ExternalPresentationVersion | null>(null);
  const [loading, setLoading] = useState(true), [unavailable, setUnavailable] = useState(false), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [nextVersion, setNextVersion] = useState<ExternalPresentationVersion | null>(null);
  const [slideIndex, setSlideIndex] = useState(0), [feedbackState, setFeedbackState] = useState({ locked: false, dirty: false });
  const [pdfLocked, setPdfLocked] = useState(false);
  const opening = useRef<Promise<GuestBrowserAccess> | null>(null), currentVersion = useRef<ExternalPresentationVersion | null>(null);
  const updateSequence = useRef(0);
  const invalidateUpdates = useCallback(() => { updateSequence.current++; }, []);
  const onFeedbackState = useCallback((value: { locked: boolean; dirty: boolean }) => setFeedbackState(value), []);
  const onPdfState = useCallback((locked: boolean) => setPdfLocked(locked), []);
  const navigationLocked = feedbackState.locked || pdfLocked;
  function denied(reason: unknown) { return reason instanceof ApiError && [401, 403, 404, 410].includes(reason.status); }
  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        if (!opening.current) {
          if (entryToken === 'review') {
            const context = new URLSearchParams(window.location.search).get('session') ?? '';
            if (!identifier.test(context)) throw new ApiError(404, 'REVIEW_UNAVAILABLE', 'Unavailable');
            opening.current = reviewRequest<GuestBrowserAccess>('/api/v1/review/session', context, { headers: browserHeaders, signal: AbortSignal.timeout(30000) }).then(result => result.data);
          } else {
            if (!/^[A-Za-z0-9_-]{43}$/u.test(entryToken)) throw new ApiError(404, 'REVIEW_UNAVAILABLE', 'Unavailable');
            opening.current = reviewRequest<GuestBrowserAccess>('/api/v1/review/open', undefined,
              { method: 'POST', headers: { ...browserHeaders, 'X-Review-Token': entryToken }, signal: AbortSignal.timeout(30000) }).then(result => result.data);
          }
        }
        const session = await opening.current;
        if (!identifier.test(session.guest_session_id) || !identifier.test(session.series_id)) throw new Error('The review session response could not be confirmed.');
        window.history.replaceState(null, '', `/r/review?session=${session.guest_session_id}`);
        const saved = (await reviewRequest<ExternalPresentationVersion | null>('/api/v1/review/presentation', session.guest_session_id, { signal: AbortSignal.timeout(30000) })).data;
        if (saved && (saved.series_id !== session.series_id || saved.status !== 'ready' || !saved.slides.length)) throw new Error('The shared version response could not be confirmed.');
        if (!current) return;
        currentVersion.current = saved; setAccess(session); setVersion(saved); setError(''); setUnavailable(false);
      } catch (reason) { if (current) { setUnavailable(denied(reason)); setError(denied(reason) ? '' : reviewError(reason)); setAccess(null); setVersion(null); } }
      finally { if (current) setLoading(false); }
    }; void load(); return () => { current = false; invalidateUpdates(); };
  }, [entryToken, refresh, invalidateUpdates]);
  const checkUpdates = useCallback(async () => {
    if (!access) return;
    const sequence = ++updateSequence.current;
    try {
      const session = (await reviewRequest<GuestBrowserAccess>('/api/v1/review/session', access.guest_session_id, { headers: browserHeaders, signal: AbortSignal.timeout(30000) })).data;
      if (sequence !== updateSequence.current) return;
      if (session.guest_session_id !== access.guest_session_id || session.series_id !== access.series_id) throw new Error('Review scope changed. Reopen the original shared link.');
      const latest = (await reviewRequest<ExternalPresentationVersion | null>('/api/v1/review/presentation', access.guest_session_id, { signal: AbortSignal.timeout(30000) })).data;
      if (sequence !== updateSequence.current) return;
      if (latest && (latest.series_id !== access.series_id || latest.status !== 'ready' || !latest.slides.length)) throw new Error('The shared version response could not be confirmed.');
      setAccess(session);
      if (!currentVersion.current && latest) { currentVersion.current = latest; setVersion(latest); }
      else if (latest && currentVersion.current && latest.id !== currentVersion.current.id && latest.version_no > currentVersion.current.version_no) {
        setNextVersion(previous => !previous || latest.version_no > previous.version_no ? latest : previous);
      }
      setError('');
    } catch (reason) { if (sequence !== updateSequence.current) return; if (denied(reason)) { setUnavailable(true); setVersion(null); setAccess(null); } else setError(reviewError(reason)); }
  }, [access]);
  useEffect(() => { if (!access) return; const timer = setInterval(() => void checkUpdates(), 30000); return () => clearInterval(timer); }, [access, checkUpdates]);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (feedbackState.dirty || navigationLocked) { event.preventDefault(); event.returnValue = ''; } }
    window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [feedbackState.dirty, navigationLocked]);
  function canNavigate() { return !navigationLocked && (!feedbackState.dirty || window.confirm('Discard your unsent comment and change the viewed slide or version?')); }
  function go(index: number) { if (version && index >= 0 && index < version.slides.length && canNavigate()) setSlideIndex(index); }
  if (unavailable) return <GuestShell><section className="guest-unavailable"><h1>This review link is no longer available.</h1><p>Please ask the producer for a new review link.</p></section></GuestShell>;
  if (loading) return <GuestShell><Loading label="Opening shared presentation…" /></GuestShell>;
  if (!access) return <GuestShell><h1>Review presentation</h1><ErrorNotice message={error || 'The presentation could not be opened.'} retry={() => { opening.current = null; setLoading(true); setRefresh(value => value + 1); }} /></GuestShell>;
  if (!version) return <GuestShell><section className="guest-preparing"><h1>Your presentation is being prepared</h1><p>This link will show its first ready version here.</p>{error && <ErrorNotice message={error} />}<button className="button" onClick={() => void checkUpdates()}>Check for updates</button></section></GuestShell>;
  const slide = version.slides[slideIndex];
  return <GuestShell><header className="guest-heading"><div><p className="eyebrow">Cast {version.output_type === 'selection' ? 'Selection' : 'Shortlist'}</p><h1>Review presentation</h1><p dir="auto">{version.cover.project_name}{version.cover.client_name ? ` · ${version.cover.client_name}` : ''}</p><p className="small">Viewing version {version.version_no}</p></div><div className="button-row"><button className="button" onClick={() => void checkUpdates()}>Check for updates</button><GuestPdfDownload key={`${version.id}:${access.guest_session_id}`} version={version} access={access} onStateChange={onPdfState} /></div></header>
    {error && <ErrorNotice message={error} />}
    {nextVersion && <div className="notice" role="status"><p>A new version is available.</p><button className="button button-primary" disabled={navigationLocked} onClick={() => { if (canNavigate()) { updateSequence.current++; currentVersion.current = nextVersion; setVersion(nextVersion); setSlideIndex(0); setNextVersion(null); setFeedbackState({ locked: false, dirty: false }); } }}>Open version {nextVersion.version_no}</button><p className="small">Your feedback stays on the version you viewed.</p></div>}
    <nav className="saved-slide-navigation" aria-label="Shared presentation slides"><ol>{version.slides.map((item, index) => <li key={item.id}><button className="button" aria-current={index === slideIndex ? 'step' : undefined} disabled={navigationLocked} aria-label={`Slide ${index + 1}: ${item.kind === 'cover' ? 'Cover' : `${item.role_label ?? 'Pending'} / ${item.slot_label ?? 'Pending'}`}`} onClick={() => go(index)}>{index + 1}<span>{item.kind === 'cover' ? 'Cover' : `${item.role_label ?? 'Pending'} / ${item.slot_label ?? 'Pending'}`}</span>{item.kind === 'pending' && <span className="badge">Pending</span>}</button></li>)}</ol></nav>
    <div className="saved-slide-controls"><button className="button" disabled={slideIndex === 0 || navigationLocked} onClick={() => go(slideIndex - 1)}>Previous slide</button><p role="status">Slide {slideIndex + 1} of {version.slides.length}</p><button className="button" disabled={slideIndex === version.slides.length - 1 || navigationLocked} onClick={() => go(slideIndex + 1)}>Next slide</button></div>
    <div className="guest-review-layout"><section aria-label="Shared slide" tabIndex={0} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowLeft') { event.preventDefault(); go(slideIndex - 1); } if (event.key === 'ArrowRight') { event.preventDefault(); go(slideIndex + 1); } }}><GuestSlide key={`${version.id}:${slide.id}`} slide={slide} version={version} context={access.guest_session_id} /></section>
      <ReviewFeedbackPanel versionId={version.id} versionNo={version.version_no} slides={version.slides} slideId={slide.id} access={access} onIdentified={setAccess} onStateChange={onFeedbackState} />
    </div></GuestShell>;
}

export function GuestShell({ children }: { children: React.ReactNode }) {
  return <div className="guest-shell"><a className="skip-link" href="#guest-content">Skip to presentation</a><header className="guest-brand"><img src="/brand/everyone-logotype.svg" alt="everyone." /><span>Presentation review</span></header><main id="guest-content" tabIndex={-1}>{children}</main><footer className="guest-footer">everyone. · Presentation Studio</footer></div>;
}

function GuestSlide({ slide, version, context }: { slide: VersionSlide; version: ExternalPresentationVersion; context: string }) {
  const [frameIndex, setFrameIndex] = useState(0), [video, setVideo] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [transcript, setTranscript] = useState<VersionTranscriptCompanion>();
  const brand = <img className="saved-everyone-brand" src="/brand/everyone-logotype-white.svg" alt="everyone." />;
  async function play() {
    if (!slide.video_asset_id) return; setBusy(true); setError(''); setVideo(''); setTranscript(undefined);
    try {
      const result = (await reviewRequest<VersionMediaPlayback>(`/api/v1/review/versions/${version.id}/media/${slide.video_asset_id}`, context, { method: 'POST', signal: AbortSignal.timeout(30000) })).data;
      if (result.source_version_id !== version.id || result.asset_id !== slide.video_asset_id) throw new Error('Original video identity could not be confirmed.');
      setVideo(sameOriginReviewUrl(result.url, `/api/v1/review/versions/${version.id}/media/${slide.video_asset_id}/content`, context));
      setTranscript(result.transcript);
    } catch (reason) { setError(reviewError(reason)); } finally { setBusy(false); }
  }
  if (slide.kind === 'cover') return <article className="saved-casting-slide saved-casting-cover"><header>{brand}{slide.logo_asset_id && <GuestAssetImage versionId={version.id} assetId={slide.logo_asset_id} context={context} alt="Client logo" className="saved-client-logo" />}</header><div><h2 dir="auto">{version.cover.project_name}</h2><p dir="auto">{version.cover.client_name ?? 'Client not provided'}</p><h3 dir="auto">{version.cover.title}</h3></div><footer>Version {version.version_no} · {version.slides.length} slides</footer></article>;
  const frame = slide.frame_asset_ids[frameIndex];
  return <><article className="saved-casting-slide"><header className="saved-casting-header"><div><h2 dir="auto">{slide.role_label ?? 'Requirements pending'}</h2><p dir="auto">{slide.slot_label ?? 'Pending'} · {slide.position ?? 'Pending'}</p></div>{brand}</header>
    {slide.kind === 'pending' ? <section className="saved-pending"><h3>Pending</h3><dl className="saved-casting-fields saved-requirement-fields">{Object.entries(PENDING_REQUIREMENT_LABELS).map(([key, label]) => { const value = key === 'role_category' ? slide.role_category : slide.requirements?.[key as keyof NonNullable<VersionSlide['requirements']>]; return <div key={key}><dt>{label}</dt><dd dir="auto">{(Array.isArray(value) ? value.join('; ') : value) || 'Not provided'}</dd></div>; })}</dl></section> : <><div className="saved-candidate-body"><section className="saved-frame-carousel" aria-label="Candidate frames" aria-roledescription="carousel">
      {frame ? <GuestAssetImage key={frame} versionId={version.id} assetId={frame} context={context} alt={`Candidate frame ${frameIndex + 1} of ${slide.frame_asset_ids.length}`} /> : <p className="saved-no-image">Image not provided</p>}
      {!!slide.frame_asset_ids.length && <><p role="status" className="small">Frame {frameIndex + 1} of {slide.frame_asset_ids.length}</p><div className="button-row"><button className="button" disabled={frameIndex === 0} onClick={() => setFrameIndex(value => value - 1)}>Previous frame</button><button className="button" disabled={frameIndex === slide.frame_asset_ids.length - 1} onClick={() => setFrameIndex(value => value + 1)}>Next frame</button></div></>}
    </section><dl className="saved-casting-fields">{slideWordingFields.map(field => <div key={field}><dt>{REVIEW_FIELD_LABELS[field]}</dt><dd dir="auto">{slide.fields?.[field] || 'Not provided'}</dd></div>)}</dl></div>
      {slide.video_asset_id ? <section className="guest-original"><button className="button" disabled={busy} onClick={() => void play()}>{busy ? 'Opening original video…' : video ? 'Refresh video access' : 'Watch original introduction'}</button>{error && <ErrorNotice message={error} />}{video && <video src={video} controls preload="metadata" className="candidate-video" onError={() => { setVideo(''); setError('Video access is no longer available. Try opening the original video again.'); }} />}</section> : <p className="small">Video not provided</p>}
    </>}
    <footer className="saved-casting-footer"><span dir="auto">{version.cover.project_name}</span><span>Version {version.version_no} · {slide.order + 1}</span>{slide.logo_asset_id && <GuestAssetImage versionId={version.id} assetId={slide.logo_asset_id} context={context} alt="Client logo" className="saved-client-logo saved-client-logo-footer" />}</footer>
  </article>{video && slide.video_asset_id && <SourceTranscript versionId={version.id} assetId={slide.video_asset_id} transcript={transcript} />}</>;
}

function GuestAssetImage({ versionId, assetId, context, alt, className }: { versionId: string; assetId: string; context: string; alt: string; className?: string }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let current = true, objectUrl = '';
    const load = async () => {
      try {
        const result = await fetch(`/api/v1/review/versions/${versionId}/media/${assetId}/content`, { cache: 'no-store', headers: { 'X-Review-Context': context, Accept: 'image/*' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        const mime = result.headers.get('content-type')?.split(';')[0].trim();
        if (!result.ok || !mime || !['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(mime) || !result.body) { await result.body?.cancel(); throw new Error('IMAGE_UNAVAILABLE'); }
        const reader = result.body.getReader(), chunks: Uint8Array<ArrayBuffer>[] = []; let size = 0;
        try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 20 * 1024 * 1024) { await reader.cancel(); throw new Error('IMAGE_UNAVAILABLE'); } chunks.push(new Uint8Array(part.value)); } } finally { reader.releaseLock(); }
        if (!current) return; if (!size) throw new Error('IMAGE_UNAVAILABLE');
        objectUrl = URL.createObjectURL(new Blob(chunks, { type: mime })); setUrl(objectUrl); setFailed(false);
      } catch { if (current) setFailed(true); }
    }; void load(); return () => { current = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [versionId, assetId, context, retry]);
  if (failed) return <div className="saved-image-error"><p role="status">This image could not be opened.</p><button className="button" onClick={() => { setUrl(''); setFailed(false); setRetry(value => value + 1); }}>Retry image</button></div>;
  if (!url) return <p role="status" className="small">Opening image…</p>;
  return <img src={url} alt={alt} className={className} onError={() => setFailed(true)} />;
}
