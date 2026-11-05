'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { deckAssetIds, useEditorialAssets, type AssetFetch, type LoadedAsset } from '../EditorialSlide';
import { ErrorNotice } from '../Feedback';
import { Icon } from '../Icon';
import { SegmentIndicator } from '../motion/SegmentIndicator';
import { buildDraftReview, focusFor, supportedTemplate, type DraftContext } from './draft-review';
import { pageForFocus, stageDeck, type StageDeck } from './stage-pages';
import { StageSlide, useRenderedDeck, type RenderedDeck } from './StageSlide';
import { useWorkspaceDraft } from './WorkspaceDraftProvider';

const NO_ASSETS: Record<string, LoadedAsset> = {};
const outputTitle = (output: 'selection' | 'shortlist') => output === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
const templateName = (version: string) => version === '1.2.0' ? 'Everyone Film Editorial 1.2.0' : `Everyone Casting ${version}`;
const fetchMedia: AssetFetch = (id, signal) => fetch(`/api/v1/media/${encodeURIComponent(id)}/content`, { cache: 'no-store', signal, headers: { Accept: 'image/*' } });

/** The working draft on a live stage: the same registered template and markup generation prints, recomputed in the
 * browser from saved records plus unsaved panel edits. It is a preview — checks, fit and the saved PDF come from the server. */
export function LiveStage() {
  const draft = useWorkspaceDraft();
  const [choice, setChoice] = useState<string>('auto');
  const output = draft?.output ?? 'selection';
  const series = useMemo(() => (draft?.series ?? []).filter(row => row.output_type === output && supportedTemplate(row.template_version)), [draft?.series, output]);
  const chosen = choice === 'default' ? null : series.find(row => row.id === choice)
    ?? (choice === 'auto' ? series.find(row => row.template_version === '1.2.0') ?? series.find(row => row.template_version === '1.1.0') ?? series[0] ?? null : null);
  const defaultTemplate = draft?.defaultTemplate && supportedTemplate(draft.defaultTemplate) ? draft.defaultTemplate : null;
  const context: DraftContext = useMemo(() => ({ output, title: chosen?.title ?? outputTitle(output), templateVersion: chosen?.template_version ?? defaultTemplate ?? '1.1.0' }), [output, chosen?.title, chosen?.template_version, defaultTemplate]);

  // Typing never waits for the deck: on very large drafts the slide catches up a frame later.
  const source = draft?.source ?? null; const overlay = useDeferredValue(draft?.overlay); const profilesReadable = draft?.profilesReadable ?? false;
  const built = useMemo(() => {
    if (!source || !overlay) return null;
    try { const result = buildDraftReview(source, overlay, context); return { deck: stageDeck(result.review), notes: result.notes, error: '' }; }
    catch (reason) { return { deck: null, notes: [], error: reason instanceof Error && reason.message === 'DRAFT_PROFILE_UNAVAILABLE' ? (profilesReadable ? 'A profile on this draft could not be read.' : 'Showing people on slides needs Cast Library access.') : 'An edit is not consistent yet (for example, a record changed elsewhere).' }; }
  }, [source, overlay, profilesReadable, context]);
  // Keep the last consistent deck on screen while an intermediate edit or refresh cannot be projected.
  const [good, setGood] = useState<StageDeck | null>(null);
  if (built?.deck && built.deck !== good) setGood(built.deck);
  const deck = built?.deck ?? good;

  if (!draft?.enabled) return <section className="live-stage live-stage-empty" aria-label="Slide preview"><div className="empty-state"><Icon name="slides" /><h2>Live preview needs the central connection</h2><p>Sign in to the connected Studio to see this workspace as slides.</p></div></section>;
  if (!deck) return <section className="live-stage live-stage-empty" aria-label="Slide preview" aria-busy={draft.status === 'loading'}>
    {draft.status === 'error' ? <ErrorNotice message={`The live preview could not be opened. ${draft.error}`} retry={() => draft.refresh(true)} />
      : built?.error ? <ErrorNotice message={`Preview paused. ${built.error}`} retry={() => draft.refresh(true)} />
      : <div className="stage-loading" role="status"><span className="stage-loading-slide" aria-hidden="true" /><p>Opening the live preview…</p></div>}
  </section>;
  return <StageView deck={deck} paused={built?.error ?? ''} notes={built?.notes ?? []} choice={chosen?.id ?? (choice === 'default' || !series.length ? 'default' : 'auto')} onChoice={setChoice}
    seriesOptions={series.map(row => ({ id: row.id, label: `${row.title} · ${templateName(row.template_version)}` }))} defaultLabel={defaultTemplate ? `No saved series · ${templateName(defaultTemplate)} (Studio default)` : 'No saved series · Everyone Casting 1.1.0'} />;
}

interface StageViewProps { deck: StageDeck; paused: string; notes: string[]; choice: string; onChoice: (value: string) => void; seriesOptions: { id: string; label: string }[]; defaultLabel: string }
function StageView({ deck, paused, notes, choice, onChoice, seriesOptions, defaultLabel }: StageViewProps) {
  const draft = useWorkspaceDraft()!;
  const ids = useMemo(() => deck.template === '1.2.0' ? [...new Set(deckAssetIds(deck.deck))].sort() : [], [deck]);
  const { assets, failed } = useEditorialAssets(ids, fetchMedia);
  const rendered = useRenderedDeck(deck, deck.template === '1.2.0' ? assets : NO_ASSETS);
  const [mode, setMode] = useState<'slide' | 'pages'>('slide');
  const [currentKey, setCurrentKey] = useState('cover');
  const found = deck.pages.findIndex(page => page.key === currentKey);
  const [lastIndex, setLastIndex] = useState(0);
  const index = found >= 0 ? found : Math.min(lastIndex, deck.pages.length - 1);
  if (index !== lastIndex) setLastIndex(index);
  const page = deck.pages[index];
  const selection = draft.selection;
  // Panel → stage: bring the record's slide into view (once per selection; a record without a slide leaves the stage alone).
  const [followed, setFollowed] = useState(0);
  if (selection && selection.from === 'panel' && selection.seq !== followed) {
    const target = pageForFocus(deck.pages, selection.target);
    setFollowed(selection.seq); if (target !== null && deck.pages[target].key !== currentKey) setCurrentKey(deck.pages[target].key);
  }
  const go = useCallback((next: number) => {
    const bounded = Math.max(0, Math.min(deck.pages.length - 1, next)); const target = deck.pages[bounded];
    const slide = target.slide;
    setCurrentKey(target.key); draft.select(focusFor(slide), 'stage', null, slide ? [slide.workspace_candidate_id && `pool:${slide.workspace_candidate_id}`, slide.slot_id && `slot:${slide.slot_id}`, slide.role_id && `role:${slide.role_id}`].filter((key): key is string => Boolean(key)) : []);
  }, [deck.pages, draft]);
  const highlight = selection?.from === 'panel' && selection.field && page && (page.kind === 'detail' || page.kind === 'pending' || page.kind === 'cover') && pageForFocus(deck.pages, selection.target) === index ? selection.field : null;
  function keys(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    const step = event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : event.key === 'ArrowRight' || event.key === 'PageDown' ? 1 : 0;
    if (step) { event.preventDefault(); go(index + step); } else if (event.key === 'Home') { event.preventDefault(); go(0); } else if (event.key === 'End') { event.preventDefault(); go(deck.pages.length - 1); }
  }
  const overlayCount = Object.keys(draft.overlay).length;
  const state = paused ? { tone: 'warn', text: 'Preview paused · showing the last consistent draft' } : draft.refreshing ? { tone: 'info', text: 'Updating from saved changes…' }
    : overlayCount ? { tone: 'ok', text: 'Live preview · includes unsaved edits' } : { tone: 'ok', text: 'Live preview · updates as you edit' };
  const label = (n: number) => `Slide ${n + 1} of ${deck.pages.length}: ${deck.pages[n].label}`;
  return <section className="live-stage" aria-label="Slide preview">
    <header className="stage-bar">
      <div className="stage-state"><span className={`stage-chip stage-chip-${state.tone}`} role="status"><span className="stage-chip-dot" aria-hidden="true" />{state.text}</span>
        <span className="stage-meta">Working draft · Slide {index + 1} of {deck.pages.length}</span></div>
      <div className="stage-tools">
        <label className="stage-template"><span className="sr-only">Preview as</span><select aria-label="Preview as" value={choice} onChange={event => onChoice(event.target.value)}>
          {choice === 'default' && <option value="default">{defaultLabel}</option>}{seriesOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}{choice !== 'default' && <option value="default">{defaultLabel}</option>}</select></label>
        <div className="segmented" role="group" aria-label="Stage layout"><SegmentIndicator /><button type="button" aria-pressed={mode === 'slide'} onClick={() => setMode('slide')}>Slide</button><button type="button" aria-pressed={mode === 'pages'} onClick={() => setMode('pages')}>All pages</button></div>
      </div>
    </header>
    {paused && <div className="notice notice-warn stage-notice" role="status"><p><strong>Preview paused.</strong> {paused} Your edits are kept; save or reload to continue.</p><button className="button button-small" type="button" onClick={() => draft.refresh(true)}>Reload preview</button></div>}
    {draft.stale && <div className="notice stage-notice"><p>{draft.stale}</p><button className="button button-small" type="button" disabled={draft.refreshing} onClick={() => draft.refresh(true)}>Retry</button></div>}
    {(failed.length > 0 || notes.includes('frames')) && <p className="stage-note small"><Icon name="info" />{failed.length > 0 ? `${failed.length} image${failed.length === 1 ? '' : 's'} could not be opened for the preview. ` : ''}{notes.includes('frames') ? 'Frames that are not part of the selected introduction are left out, as generation would.' : ''}</p>}
    {mode === 'slide' ? <div className="stage-canvas" tabIndex={0} role="region" aria-roledescription="slide stage" aria-label={`${label(index)}. Use the arrow keys to change slides.`} onKeyDown={keys}>
      <div className="stage-frame"><StageSlide deck={deck} rendered={rendered} index={index} highlight={highlight} label={label(index)} /></div>
      <div className="stage-pager"><button type="button" className="icon-button" aria-label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)}><Icon name="chevron-left" /></button>
        <span className="stage-count" aria-hidden="true">{index + 1} / {deck.pages.length}</span>
        <button type="button" className="icon-button" aria-label="Next slide" disabled={index >= deck.pages.length - 1} onClick={() => go(index + 1)}><Icon name="chevron-right" /></button></div>
    </div> : <PageList deck={deck} rendered={rendered} current={index} onPick={go} label={label} />}
    <p className="stage-disclaimer small">Draft preview in {templateName(deck.template)}, recomputed from saved records and your unsaved edits. Checks, layout fit and the saved PDF come from Review.</p>
    <SlideStrip deck={deck} rendered={rendered} current={index} onPick={go} />
  </section>;
}

function useNearViewport<T extends HTMLElement>(rootSelector: string) {
  const ref = useRef<T>(null); const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current; if (!node || near) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { root: node.closest(rootSelector), rootMargin: '300px' });
    observer.observe(node); return () => observer.disconnect();
  }, [near, rootSelector]);
  return [ref, near] as const;
}

/** Thumbnails render only once they scroll near view, and lag a frame behind typing so the stage stays responsive. */
function SlideStrip({ deck, rendered, current, onPick }: { deck: StageDeck; rendered: RenderedDeck; current: number; onPick: (index: number) => void }) {
  const lagged = useDeferredValue(rendered); const list = useRef<HTMLOListElement>(null);
  // Keep the current thumbnail in view by scrolling the strip only — never the page or the panel beside it.
  useEffect(() => {
    const strip = list.current; const item = strip?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.parentElement; if (!strip || !item) return;
    const left = item.offsetLeft - strip.offsetLeft; const right = left + item.offsetWidth;
    if (left < strip.scrollLeft) strip.scrollLeft = left - 16; else if (right > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = right - strip.clientWidth + 16;
  }, [current]);
  function keys(event: KeyboardEvent<HTMLOListElement>) {
    const step = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0; if (!step) return;
    event.preventDefault(); const next = Math.max(0, Math.min(deck.pages.length - 1, current + step)); onPick(next);
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus());
  }
  return <nav className="slide-strip-nav" aria-label="Slides"><ol ref={list} className="stage-strip" onKeyDown={keys}>{deck.pages.map((page, n) => <li key={page.key}>
    <Thumb deck={deck} rendered={lagged} index={n} total={deck.pages.length} current={n === current} title={page.label} onPick={onPick} />
  </li>)}</ol></nav>;
}
function Thumb({ deck, rendered, index, total, current, title, onPick }: { deck: StageDeck; rendered: RenderedDeck; index: number; total: number; current: boolean; title: string; onPick: (index: number) => void }) {
  const [ref, near] = useNearViewport<HTMLButtonElement>('.stage-strip');
  // The visible "n  Title" is the name; screen readers also hear "Slide … of N:".
  return <button ref={ref} type="button" className="strip-thumb" data-index={index} aria-current={current ? 'true' : undefined} tabIndex={current ? 0 : -1} onClick={() => onPick(index)}>
    <span className="strip-thumb-title"><span className="sr-only">Slide </span><span>{index + 1}</span><span className="sr-only"> of {total}:</span> {title}</span>
    <StageSlide deck={deck} rendered={rendered} index={index} eager={near} label="" />
  </button>;
}
function PageList({ deck, rendered, current, onPick, label }: { deck: StageDeck; rendered: RenderedDeck; current: number; onPick: (index: number) => void; label: (index: number) => string }) {
  return <ol className="stage-pages" aria-label="All pages in print order">{deck.pages.map((page, n) => <li key={page.key}><PageItem deck={deck} rendered={rendered} index={n} current={n === current} label={label(n)} onPick={onPick} /></li>)}</ol>;
}
function PageItem({ deck, rendered, index, current, label, onPick }: { deck: StageDeck; rendered: RenderedDeck; index: number; current: boolean; label: string; onPick: (index: number) => void }) {
  const [ref, near] = useNearViewport<HTMLButtonElement>('.stage-pages');
  return <button ref={ref} type="button" className="stage-page" aria-current={current ? 'true' : undefined} aria-label={label} onClick={() => onPick(index)}><StageSlide deck={deck} rendered={rendered} index={index} eager={near} label="" /></button>;
}
