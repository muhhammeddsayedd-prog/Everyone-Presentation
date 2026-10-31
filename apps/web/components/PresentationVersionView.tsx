'use client';
import { ShareDrawer } from './ShareDrawer';

import Link from 'next/link';
import { Icon } from './Icon';
import { useEffect, useRef, useState } from 'react';
import type { PresentationVersion, VersionSlide, VersionMediaPlayback, VersionTranscriptCompanion } from '@eps/domain';
import { presentationCanonicalJson } from '../../../packages/domain/src/presentation';
import { slideWordingFields } from '../../../packages/domain/src/casting-types';
import completeRegistry from '../../../packages/templates/versions/1.1.0/registry.json';
import { PENDING_REQUIREMENT_LABELS } from '../../../packages/templates/versions/1.1.0/render';
import { REVIEW_FIELD_LABELS } from '../../../packages/templates/src/render';
import { api, errorMessage, mutation, type Actor } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { VersionAssetImage } from './VersionAssetImage';
import { SourceTranscript } from './SourceTranscript';
import { StudioDateTime } from './StudioTimeZone';

interface Props { versionId: string; actor: Actor; embedded?: boolean; expectedSeriesId?: string; onSettled?: () => void }
export function PresentationVersionView(props: Props) { return <VersionScope key={`${props.actor.id}:${props.versionId}`} {...props} />; }

function VersionScope({ versionId, embedded = false, expectedSeriesId, onSettled, actor }: Props) {
  const [version, setVersion] = useState<PresentationVersion | null>(null); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [refresh, setRefresh] = useState(0); const [slideIndex, setSlideIndex] = useState(0); const [layout, setLayout] = useState<'app' | 'pdf'>('app'); const [sharing, setSharing] = useState(false);
  const frozen = useRef<string | null>(null); const settled = useRef(false);
  useEffect(() => {
    let current = true; let timer: ReturnType<typeof setTimeout> | undefined; const controller = new AbortController();
    const load = async () => {
      try {
        const value = (await api<PresentationVersion>(`/api/v1/versions/${encodeURIComponent(versionId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) })).data;
        if (!current) return;
        if (value.id !== versionId || expectedSeriesId && value.series_id !== expectedSeriesId || !Array.isArray(value.slides) || !value.slides.length) throw new Error('This saved version could not be read for the selected series.');
        const content = presentationCanonicalJson({ id: value.id, series_id: value.series_id, version_no: value.version_no,
          manifest_hash: value.manifest_hash, input_fingerprint: value.input_fingerprint, slides: value.slides, render_context: value.render_context });
        if (frozen.current !== null && frozen.current !== content) throw new Error('The saved content changed unexpectedly. Refresh access before continuing.');
        frozen.current = content; setVersion(value); setError(''); setLoading(false);
        if (value.status === 'queued' || value.status === 'rendering') timer = setTimeout(() => void load(), 3000);
        else if (!settled.current) { settled.current = true; onSettled?.(); }
      } catch (reason) { if (current) { setError(errorMessage(reason)); setVersion(null); setLoading(false); } }
    };
    void load(); return () => { current = false; controller.abort(); if (timer) clearTimeout(timer); };
  }, [versionId, expectedSeriesId, refresh, onSettled]);
  function reload() { setLoading(true); setRefresh(value => value + 1); }
  if (loading && !version) return <Loading label="Opening saved version…" />;
  if (!version) return <ErrorNotice message={error || 'Saved version unavailable.'} retry={reload} />;
  const slide = version.slides[slideIndex] ?? version.slides[0]; const Heading = embedded ? 'h3' : 'h2';
  const supported = version.render_context.template.key === 'everyone-casting' && version.render_context.template.version === '1.0.0'
    && version.render_context.template.content_sha256 === '8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001'
    || version.render_context.template.key === completeRegistry.key && version.render_context.template.version === completeRegistry.version && version.render_context.template.content_sha256 === completeRegistry.content_sha256;
  return <section className="presentation-version" aria-label={`Saved version ${version.version_no}`}>
    <header className="section-heading"><div><Heading>Saved version {version.version_no}</Heading><p>Captured content · {version.status === 'ready' ? 'Ready' : version.status === 'failed' ? 'Generation failed' : version.status === 'rendering' ? 'Rendering' : 'Queued'} · <StudioDateTime value={version.created_at} /></p></div><button className="button" onClick={reload} disabled={loading}>Refresh saved version</button></header>
    <p className="small muted">This version keeps its captured words and media. Working-draft edits appear in a future version.</p>
    {error && <ErrorNotice message={error} retry={reload} />}
    {version.status !== 'ready' && <div className={`notice${version.status === 'failed' ? ' notice-error' : ''}`}><p>{version.status === 'failed' ? 'The PDF did not finish. Existing ready versions remain available.' : 'The captured content is saved. Its PDF is still processing.'}</p><Link className="button" href={`/processing?job=${version.generation_job_id}`}>Open generation processing</Link></div>}
    {version.status === 'failed' && <p className="small">An authorized retry uses this same captured version.</p>}
    <div className="button-row saved-version-actions">{version.status === 'ready' && <><a className="button button-primary" href={`/api/v1/versions/${version.id}/pdf/content`} download>Download PDF</a><a className="button" href={`/api/v1/versions/${version.id}/pdf/content`} target="_blank" rel="noreferrer">Open saved PDF</a></>}<Link className="button" href={`/presentations/versions/${version.id}`}>Open version page</Link><button type="button" className="button" aria-haspopup="dialog" onClick={() => setSharing(true)}><Icon name="link" />Share for review</button></div>
    {!supported ? <ErrorNotice message="This saved template is unavailable in this viewer. Open the original PDF or restore its registered template." /> : <>
      <div className="version-viewer"><nav className="saved-slide-navigation" aria-label="Slides in saved version"><ol>{version.slides.map((item, index) => <li key={item.id}><button className="button" aria-current={index === slideIndex ? 'step' : undefined} aria-label={slideLabel(item, index)} onClick={() => setSlideIndex(index)}>{index + 1}<span>{item.kind === 'cover' ? 'Cover' : `${item.role_label ?? 'Requirements pending'} / ${item.slot_label ?? 'Pending'}`}</span>{item.kind === 'pending' && <span className="badge">Pending</span>}</button></li>)}</ol></nav>
      <div className="version-stage" onKeyDown={event => { const target = event.target as HTMLElement; if (target.closest('.saved-frame-carousel, input, textarea, select')) return; if (event.key === 'ArrowLeft' && slideIndex > 0) { event.preventDefault(); setSlideIndex(slideIndex - 1); } if (event.key === 'ArrowRight' && slideIndex < version.slides.length - 1) { event.preventDefault(); setSlideIndex(slideIndex + 1); } }}>
        <div className="saved-slide-controls"><div className="segmented" role="group" aria-label="Preview layout"><button type="button" aria-pressed={layout === 'app'} onClick={() => setLayout('app')}>App view</button><button type="button" aria-pressed={layout === 'pdf'} onClick={() => setLayout('pdf')}>PDF preview</button></div><p role="status">Slide {slideIndex + 1} of {version.slides.length}</p><span className="button-row"><button className="button" disabled={slideIndex === 0} onClick={() => setSlideIndex(value => value - 1)}><Icon name="chevron-left" />Previous slide</button><button className="button" disabled={slideIndex >= version.slides.length - 1} onClick={() => setSlideIndex(value => value + 1)}>Next slide<Icon name="chevron-right" /></button></span></div>
        {sharing && <ShareDrawer seriesId={version.series_id} actor={actor} onClose={() => setSharing(false)} />}
      <SavedSlide key={`${slide.id}:${layout}`} version={version} slide={slide} layout={layout} />
        <p className="small muted">{layout === 'pdf' ? 'PDF layout: every saved frame is shown together, as in the downloaded PDF.' : 'App view: frames appear one at a time. Use the arrow keys on the slide or the frame buttons.'}</p>
      </div></div>
    </>}
  </section>;
}

function slideLabel(slide: VersionSlide, index: number) { return `Slide ${index + 1}: ${slide.kind === 'cover' ? 'Cover' : `${slide.role_label ?? 'Requirements pending'} / ${slide.slot_label ?? 'Pending'}`}`; }

function SavedSlide({ version, slide, layout = 'app' }: { version: PresentationVersion; slide: VersionSlide; layout?: 'app' | 'pdf' }) {
  const [frameIndex, setFrameIndex] = useState(0); const context = version.render_context.slide_contexts.find(row => row.slide_id === slide.id);
  const cover = version.render_context.cover; const frames = slide.frame_asset_ids; const frame = frames[frameIndex];
  // The brand and licensed fonts belong to the retained registered v1 layout.
  const brand = <img className="saved-everyone-brand" src={version.template_version === '1.1.0' ? '/brand/everyone-logotype-white.svg' : '/brand/everyone-logotype.svg'} alt="everyone." />;
  if (slide.kind === 'cover') return <article className="saved-casting-slide saved-casting-cover"><header>{brand}{slide.logo_asset_id && <VersionAssetImage versionId={version.id} assetId={slide.logo_asset_id} alt="Saved client logo" className="saved-client-logo" />}</header><div><h2 dir="auto">{cover.project_name}</h2><p dir="auto">{cover.client_name ?? 'Client not provided'}</p><h3 dir="auto">{cover.title}</h3></div><footer>Cast {cover.output_type === 'selection' ? 'Selection' : 'Shortlist'} · Version {version.version_no}</footer></article>;
  const requirements = Object.values(slide.requirements ?? {}).flatMap(value => Array.isArray(value) ? value : value ? [value] : []).join(' · ') || 'Requirements pending';
  return <article className="saved-casting-slide"><header className="saved-casting-header"><div><h3 dir="auto">{slide.role_label ?? 'Requirements pending'}</h3><p dir="auto">{slide.slot_label ?? 'Pending'} · {slide.position ?? 'Pending'}</p></div>{brand}</header>
    {slide.kind === 'pending' ? <section className="saved-pending"><h3>{context?.slot_id ? 'Pending' : 'Casting requirements pending'}</h3>{version.template_version === '1.1.0' ? <dl className="saved-casting-fields saved-requirement-fields">{Object.entries(PENDING_REQUIREMENT_LABELS).map(([key, label]) => { const value = key === 'role_category' ? slide.role_category : slide.requirements?.[key as keyof NonNullable<VersionSlide['requirements']>]; const text = Array.isArray(value) ? value.join('; ') : value; return <div key={key}><dt>{label}</dt><dd dir="auto">{text || 'Not provided'}</dd></div>; })}</dl> : <p dir="auto">{requirements}</p>}</section> : <div className="saved-candidate-body">{layout === 'pdf' ? <section className="saved-frame-sheet" aria-label="Saved candidate frames, PDF layout">{frames.length ? frames.map((asset, index) => <VersionAssetImage key={asset} versionId={version.id} assetId={asset} alt={`Saved frame ${index + 1} of ${frames.length}`} />) : <p className="saved-no-image">Image not provided</p>}</section> : <section className="saved-frame-carousel" aria-label="Saved candidate frames" aria-roledescription="carousel" tabIndex={0} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowLeft' && frameIndex > 0) { event.preventDefault(); setFrameIndex(frameIndex - 1); } if (event.key === 'ArrowRight' && frameIndex < frames.length - 1) { event.preventDefault(); setFrameIndex(frameIndex + 1); } }}>
      {frame ? <VersionAssetImage versionId={version.id} assetId={frame} alt={`Saved frame ${frameIndex + 1} of ${frames.length}`} /> : <p className="saved-no-image">Image not provided</p>}
      {frames.length > 0 && <><p className="small" role="status">Frame {frameIndex + 1} of {frames.length}{context?.frames[frameIndex] ? ` · ${(context.frames[frameIndex].timestamp_ms / 1000).toFixed(2)}s` : ''}</p><div className="button-row"><button className="button" disabled={frameIndex === 0} onClick={() => setFrameIndex(value => value - 1)}>Previous frame</button><button className="button" disabled={frameIndex >= frames.length - 1} onClick={() => setFrameIndex(value => value + 1)}>Next frame</button></div></>}
    </section>}<dl className="saved-casting-fields">{slideWordingFields.map(field => <div key={field}><dt>{REVIEW_FIELD_LABELS[field]}</dt><dd dir="auto">{slide.fields?.[field] || 'Not provided'}</dd></div>)}</dl></div>}
    <footer className="saved-casting-footer"><span dir="auto">{cover.project_name}</span>{slide.video_asset_id ? <Link href={`/presentations/versions/${version.id}/media/${slide.video_asset_id}`}>Watch original introduction</Link> : <span>Video not provided</span>}<span>Version {version.version_no} · {slide.order + 1}</span>{slide.logo_asset_id && <VersionAssetImage versionId={version.id} assetId={slide.logo_asset_id} alt="Saved client logo" className="saved-client-logo saved-client-logo-footer" />}</footer>
  </article>;
}

export function VersionMediaView({ versionId, assetId, actor }: { versionId: string; assetId: string; actor: Actor }) {
  return <VersionMediaScope key={`${actor.id}:${versionId}:${assetId}`} versionId={versionId} assetId={assetId} />;
}
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
  return <section className="version-original-media"><Link className="button" href={`/presentations/versions/${versionId}`}>Back to saved version</Link><header className="page-heading"><div><h1>Original introduction</h1>{version && <p>{version.render_context.cover.project_name} · Saved version {version.version_no}</p>}</div></header><p>This link opens the original video retained by this saved version.</p>
    {error && <ErrorNotice message={error} retry={() => { setVersion(null); setUrl(null); setRefresh(value => value + 1); }} />}
    {!version && !error ? <Loading /> : version && <><button className="button button-primary" disabled={busy} onClick={() => void play()}>{busy ? 'Opening saved video…' : url ? 'Refresh video access' : 'Open saved video'}</button>{url && <><video controls preload="metadata" className="candidate-video" src={url} onError={() => { setUrl(null); setTranscript(undefined); setError('Video access expired or the retained video is unavailable. Refresh video access.'); }} /><SourceTranscript versionId={versionId} assetId={assetId} transcript={transcript} /></>}</>}
  </section>;
}
