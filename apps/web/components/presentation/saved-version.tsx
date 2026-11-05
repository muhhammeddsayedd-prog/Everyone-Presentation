'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { PresentationVersion, VersionSlide } from '@eps/domain';
import { presentationCanonicalJson, reviewFromPresentationVersion } from '../../../../packages/domain/src/presentation';
import { slideWordingFields } from '../../../../packages/domain/src/casting-types';
import completeRegistry from '../../../../packages/templates/versions/1.1.0/registry.json';
import editorialRegistry from '../../../../packages/templates/versions/1.2.0/registry.json';
import { composeCastingDeck, editorialDateLabel } from '../../../../packages/templates/versions/1.2.0/compose-casting';
import { PENDING_REQUIREMENT_LABELS } from '../../../../packages/templates/versions/1.1.0/render';
import { REVIEW_FIELD_LABELS } from '../../../../packages/templates/src/render';
import { EditorialDeck, deckAssetIds, useEditorialAssets, type AssetFetch } from '../EditorialSlide';
import { api, errorMessage } from '../api';
import { ErrorNotice } from '../Feedback';
import { Icon } from '../Icon';
import { SegmentIndicator } from '../motion/SegmentIndicator';
import { StudioDateTime } from '../StudioTimeZone';
import { VersionAssetImage } from '../VersionAssetImage';

/** A saved presentation version, read once and then held fixed: a later read whose captured content differs is
 * refused rather than shown, so a viewer can never drift from the snapshot it opened. Queued and rendering
 * versions are re-read until they settle. */
export function useSavedVersion(versionId: string, expectedSeriesId?: string, onSettled?: () => void) {
  const [version, setVersion] = useState<PresentationVersion | null>(null); const [error, setError] = useState('');
  const [loading, setLoading] = useState(true); const [refresh, setRefresh] = useState(0);
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
  const reload = useCallback(() => { setLoading(true); setRefresh(value => value + 1); }, []);
  return { version, error, loading, reload };
}

export const isEditorial = (version: PresentationVersion) => version.render_context.template.key === editorialRegistry.key && version.render_context.template.version === editorialRegistry.version && version.render_context.template.content_sha256 === editorialRegistry.content_sha256;
export function isSupported(version: PresentationVersion) {
  const template = version.render_context.template;
  return template.key === 'everyone-casting' && template.version === '1.0.0' && template.content_sha256 === '8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001'
    || template.key === completeRegistry.key && template.version === completeRegistry.version && template.content_sha256 === completeRegistry.content_sha256
    || isEditorial(version);
}
export const statusLabel = (version: PresentationVersion) => version.status === 'ready' ? 'Ready' : version.status === 'failed' ? 'Generation failed' : version.status === 'rendering' ? 'Rendering' : 'Queued';
export const outputLabel = (version: PresentationVersion) => version.render_context.cover.output_type === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
export function slideLabel(slide: VersionSlide, index: number) { return `Slide ${index + 1}: ${slide.kind === 'cover' ? 'Cover' : `${slide.role_label ?? 'Requirements pending'} / ${slide.slot_label ?? 'Pending'}`}`; }
/** Visible list text is the slide's place (its accessible name); who is on it is the description. */
export function slidePlace(slide: VersionSlide) { return slide.kind === 'cover' ? 'Cover' : `${slide.role_label ?? 'Requirements pending'} / ${slide.slot_label ?? 'Pending'}`; }
export function slideNote(slide: VersionSlide, comments?: number) {
  const who = slide.kind === 'cover' ? 'Project, client and title' : slide.kind === 'pending' ? 'Pending' : `${slide.fields?.name_or_id || 'Not provided'}${slide.position ? ` · ${slide.position[0].toUpperCase()}${slide.position.slice(1)}` : ''}`;
  return comments ? `${who} · ${comments} ${comments === 1 ? 'comment' : 'comments'}` : who;
}
export function slideName(slide: VersionSlide) { return slide.kind === 'cover' ? 'Cover' : slide.kind === 'pending' ? `${slide.slot_label ?? slide.role_label ?? 'Requirements'} · Pending` : (slide.fields?.name_or_id || 'Not provided'); }

/** The saved version's own download and sharing actions. Only a ready version has a PDF. */
export function VersionActions({ version, onShare, compact = false }: { version: PresentationVersion; onShare?: () => void; compact?: boolean }) {
  return <>
    {version.status === 'ready' && <><a className="button button-primary" href={`/api/v1/versions/${version.id}/pdf/content`} download><Icon name="download" />Download PDF</a>
      {!compact && <a className="button" href={`/api/v1/versions/${version.id}/pdf/content`} target="_blank" rel="noreferrer">Open saved PDF</a>}
      {isEditorial(version) && <a className="button" href={`/api/v1/versions/${version.id}/pptx/content`} download>Download editable PowerPoint</a>}</>}
    {onShare && <button type="button" className="button" aria-haspopup="dialog" onClick={onShare}><Icon name="share" />Share for review</button>}
  </>;
}

/** The selected saved slide, drawn from the version's captured content and retained media only. */
export function SavedSlideView({ version, slide, layout }: { version: PresentationVersion; slide: VersionSlide; layout: 'app' | 'pdf' }) {
  return isEditorial(version) ? <SavedEditorial key={`${slide.id}:${layout}`} version={version} slide={slide} layout={layout} /> : <SavedSlide key={`${slide.id}:${layout}`} version={version} slide={slide} layout={layout} />;
}

/** Stage for a captured version: the slide (App view: one frame at a time; PDF preview: every frame, as printed),
 * pager and keyboard, and optionally a strip of slide names below. Never reads the working draft. */
export function SavedStage({ version, index, onIndex, layout, onLayout, heading, chip, meta, tools, notices, strip = true, badges }: {
  version: PresentationVersion; index: number; onIndex: (index: number) => void; layout: 'app' | 'pdf'; onLayout: (value: 'app' | 'pdf') => void;
  heading?: ReactNode; chip?: string; meta?: ReactNode; tools?: ReactNode; notices?: ReactNode; strip?: boolean; badges?: Record<string, number>;
}) {
  const slide = version.slides[index] ?? version.slides[0];
  const supported = isSupported(version);
  function keys(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement; if (target.closest('.saved-frame-carousel, input, textarea, select, a, button')) return;
    if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); onIndex(index - 1); }
    if (event.key === 'ArrowRight' && index < version.slides.length - 1) { event.preventDefault(); onIndex(index + 1); }
    if (event.key === 'Home') { event.preventDefault(); onIndex(0); }
    if (event.key === 'End') { event.preventDefault(); onIndex(version.slides.length - 1); }
  }
  return <section className="saved-stage presentation-version" aria-label={`Saved version ${version.version_no}`}>
    <header className="stage-bar">
      <div className="stage-state">{heading ?? <span className="stage-chip stage-chip-lock"><Icon name="lock" />{chip ?? 'Saved snapshot'}</span>}<span className="stage-meta">{meta ?? <>{statusLabel(version)} · <StudioDateTime value={version.created_at} /></>}</span></div>
      <div className="stage-tools"><p className="sr-only" role="status">Slide {index + 1} of {version.slides.length}</p>
        <div className="segmented" role="group" aria-label="Preview layout"><SegmentIndicator /><button type="button" aria-pressed={layout === 'app'} onClick={() => onLayout('app')}>App view</button><button type="button" aria-pressed={layout === 'pdf'} onClick={() => onLayout('pdf')}>PDF preview</button></div>{tools}</div>
    </header>
    {notices}
    {version.status !== 'ready' && <div className={`notice${version.status === 'failed' ? ' notice-error' : ''}`}><p>{version.status === 'failed' ? 'The PDF did not finish. Existing ready versions remain available; an authorized retry uses this same captured version.' : 'The captured content is saved. Its PDF is still processing.'}</p><Link className="button button-small" href={`/processing?job=${version.generation_job_id}`}>Open generation processing</Link></div>}
    {!supported ? <div className="saved-stage-body"><ErrorNotice message="This saved template is unavailable in this viewer. Open the original PDF or restore its registered template." /></div> : <>
      <div className="saved-stage-body version-stage" tabIndex={0} role="region" aria-label={`${slideLabel(slide, index)}. Use the arrow keys to change slides.`} onKeyDown={keys}>
        <SavedSlideView version={version} slide={slide} layout={layout} />
        <p className="small saved-stage-note">{layout === 'pdf' ? 'PDF layout: every saved frame is shown together, as in the downloaded PDF.' : 'App view: frames appear one at a time. Use the arrow keys on the slide or the frame buttons.'}</p>
      </div>
      <div className="stage-pager"><button type="button" className="icon-button" aria-label="Previous slide" disabled={index === 0} onClick={() => onIndex(index - 1)}><Icon name="chevron-left" /></button>
        <span className="stage-count" aria-hidden="true">{index + 1} / {version.slides.length}</span>
        <button type="button" className="icon-button" aria-label="Next slide" disabled={index >= version.slides.length - 1} onClick={() => onIndex(index + 1)}><Icon name="chevron-right" /></button></div>
      {strip && <nav className="saved-stage-strip saved-slide-navigation" aria-label="Slides in saved version"><ol>{version.slides.map((item, n) => <li key={item.id} className="saved-slide-chip-item">
        <button type="button" className="saved-slide-chip" aria-current={n === index ? 'step' : undefined} aria-label={slideLabel(item, n)} aria-describedby={`saved-chip-${item.id}`} onClick={() => onIndex(n)}>
          <span>{n + 1}</span>{' '}<span dir="auto">{slidePlace(item)}</span></button>
        <span id={`saved-chip-${item.id}`} className="saved-slide-chip-note" aria-hidden="true" dir="auto">{slideNote(item, badges?.[item.id])}</span></li>)}</ol></nav>}
    </>}
  </section>;
}

/** The slide list for the viewer's panel: one row per saved slide, with feedback counts when known. */
export function SavedSlideList({ version, index, onIndex, badges }: { version: PresentationVersion; index: number; onIndex: (index: number) => void; badges?: Record<string, number> }) {
  return <nav className="saved-slide-navigation" aria-label="Slides in saved version"><ol className="version-slide-list">{version.slides.map((item, n) => <li key={item.id} className="version-slide-row">
    <button type="button" className="version-slide-item" aria-current={n === index ? 'step' : undefined} aria-label={slideLabel(item, n)} aria-describedby={`saved-item-${item.id}`} onClick={() => onIndex(n)}>
      <span>{n + 1}</span>{' '}<strong className="version-slide-place" dir="auto">{slidePlace(item)}</strong></button>
    <span id={`saved-item-${item.id}`} className="version-slide-note" aria-hidden="true" dir="auto">{slideNote(item)}</span>
    {badges?.[item.id] ? <span className="pill version-slide-count" aria-hidden="true"><Icon name="comment" />{badges[item.id]}</span> : null}
  </li>)}</ol></nav>;
}

/** Everyone Film editorial 1.2.0: the same composed pages and markup as the saved PDF.
 * App view shows this slide's own page; PDF preview shows every page in print order. */
function SavedEditorial({ version, slide, layout }: { version: PresentationVersion; slide: VersionSlide; layout: 'app' | 'pdf' }) {
  const review = useMemo(() => reviewFromPresentationVersion(version, 'saved-version'), [version]);
  const options = useMemo(() => ({ versionLabel: `Version ${version.version_no}`, dateLabel: editorialDateLabel(version.created_at) }), [version.version_no, version.created_at]);
  const base = useMemo(() => composeCastingDeck(review, options), [review, options]);
  const pages = useMemo(() => layout === 'pdf' ? undefined : base.pages.filter(page => page.source_index === slide.order && ['cover_floward', 'cast_detail', 'cast_pending'].includes(page.layout)).map(page => page.index), [base, layout, slide.order]);
  const fetchAsset = useCallback<AssetFetch>((id, signal) => fetch(`/api/v1/versions/${encodeURIComponent(version.id)}/media/${encodeURIComponent(id)}/content`, { cache: 'no-store', signal, headers: { Accept: 'image/*' } }), [version.id]);
  const { assets, failed } = useEditorialAssets(useMemo(() => deckAssetIds(base, pages), [base, pages]), fetchAsset);
  // The worker lays the client logo out from its retained pixel size (editorialSnapshotOptions); the decoded logo has the same size.
  const logo = version.render_context.cover.logo_asset_id; const width = logo ? assets[logo]?.width : undefined; const height = logo ? assets[logo]?.height : undefined;
  const deck = useMemo(() => width && height ? composeCastingDeck(review, { ...options, logoNatural: [width, height] as const }) : base, [base, review, options, width, height]);
  const videoHrefs = useMemo(() => Object.fromEntries(version.slides.flatMap(item => item.video_asset_id ? [[item.video_asset_id, `/presentations/versions/${version.id}/media/${item.video_asset_id}`]] : [])), [version]);
  return <div className="stack">{failed.length > 0 && <ErrorNotice message={`${failed.length} saved image${failed.length === 1 ? '' : 's'} could not be opened. The saved PDF is unchanged; refresh to retry.`} />}<EditorialDeck deck={deck} assets={assets} videoHrefs={videoHrefs} pages={pages} /></div>;
}

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
