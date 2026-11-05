'use client';

import { useDeferredValue, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { SegmentIndicator } from '../motion/SegmentIndicator';
import { Icon } from '../Icon';
import type { StageDeck } from './stage-pages';
import { StageSlide, type HighlightTone, type RenderedDeck } from './StageSlide';

export type ChipTone = 'ok' | 'warn' | 'info' | 'lock' | 'error';
export interface StageChip { tone: ChipTone; text: string }
export interface StageHighlight { field: string; tone: HighlightTone }

/** One stage for every presentation surface: the live draft, the server-checked review, and a deck
 * that is about to be captured. The caller decides which deck it is and says so in the chip; this
 * component only shows it (one slide or every page in print order), pages through it and keeps the
 * thumbnail strip in step. Slide markup comes from the registered template renderer. */
export function DeckStage({ deck, rendered, index, onIndex, chip, meta, tools, notices, disclaimer, highlight, badges, label = 'Slide preview', busy }: {
  deck: StageDeck; rendered: RenderedDeck; index: number; onIndex: (index: number) => void;
  chip: StageChip; meta: ReactNode; tools?: ReactNode; notices?: ReactNode; disclaimer?: ReactNode;
  highlight?: StageHighlight | null; badges?: Record<number, string>; label?: string; busy?: boolean;
}) {
  const [mode, setMode] = useState<'slide' | 'pages'>('slide');
  const pageLabel = (n: number) => `Slide ${n + 1} of ${deck.pages.length}: ${deck.pages[n].label}`;
  function go(next: number) { onIndex(Math.max(0, Math.min(deck.pages.length - 1, next))); }
  function keys(event: KeyboardEvent) {
    if (event.target !== event.currentTarget) return;
    const step = event.key === 'ArrowLeft' || event.key === 'PageUp' ? -1 : event.key === 'ArrowRight' || event.key === 'PageDown' ? 1 : 0;
    if (step) { event.preventDefault(); go(index + step); } else if (event.key === 'Home') { event.preventDefault(); go(0); } else if (event.key === 'End') { event.preventDefault(); go(deck.pages.length - 1); }
  }
  return <section className="live-stage" aria-label={label} aria-busy={busy || undefined}>
    <header className="stage-bar">
      <div className="stage-state"><span className={`stage-chip stage-chip-${chip.tone}`} role="status">{chip.tone === 'lock' ? <Icon name="lock" /> : <span className="stage-chip-dot" aria-hidden="true" />}{chip.text}</span>
        <span className="stage-meta">{meta}</span></div>
      <div className="stage-tools">{tools}
        <div className="segmented" role="group" aria-label="Stage layout"><SegmentIndicator /><button type="button" aria-pressed={mode === 'slide'} onClick={() => setMode('slide')}>Slide</button><button type="button" aria-pressed={mode === 'pages'} onClick={() => setMode('pages')}>All pages</button></div>
      </div>
    </header>
    {notices}
    {mode === 'slide' ? <div className="stage-canvas" tabIndex={0} role="region" aria-roledescription="slide stage" aria-label={`${pageLabel(index)}. Use the arrow keys to change slides.`} onKeyDown={keys}>
      <div className="stage-frame"><StageSlide deck={deck} rendered={rendered} index={index} highlight={highlight?.field ?? null} tone={highlight?.tone} label={pageLabel(index)} /></div>
      <div className="stage-pager"><button type="button" className="icon-button" aria-label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)}><Icon name="chevron-left" /></button>
        <span className="stage-count" aria-hidden="true">{index + 1} / {deck.pages.length}</span>
        <button type="button" className="icon-button" aria-label="Next slide" disabled={index >= deck.pages.length - 1} onClick={() => go(index + 1)}><Icon name="chevron-right" /></button></div>
    </div> : <PageList deck={deck} rendered={rendered} current={index} onPick={go} label={pageLabel} />}
    {disclaimer && <p className="stage-disclaimer small">{disclaimer}</p>}
    <SlideStrip deck={deck} rendered={rendered} current={index} onPick={go} badges={badges} />
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
function SlideStrip({ deck, rendered, current, onPick, badges }: { deck: StageDeck; rendered: RenderedDeck; current: number; onPick: (index: number) => void; badges?: Record<number, string> }) {
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
    <Thumb deck={deck} rendered={lagged} index={n} total={deck.pages.length} current={n === current} title={page.label} badge={badges?.[n]} onPick={onPick} />
  </li>)}</ol></nav>;
}
function Thumb({ deck, rendered, index, total, current, title, badge, onPick }: { deck: StageDeck; rendered: RenderedDeck; index: number; total: number; current: boolean; title: string; badge?: string; onPick: (index: number) => void }) {
  const [ref, near] = useNearViewport<HTMLButtonElement>('.stage-strip');
  // The visible "n  Title" is the name; screen readers also hear "Slide … of N:" and any badge.
  return <button ref={ref} type="button" className="strip-thumb" data-index={index} aria-current={current ? 'true' : undefined} tabIndex={current ? 0 : -1} onClick={() => onPick(index)}>
    <span className="strip-thumb-title"><span className="sr-only">Slide </span><span>{index + 1}</span><span className="sr-only"> of {total}:</span> {title}{badge && <span className="strip-thumb-badge"><span className="sr-only">, </span>{badge}</span>}</span>
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
