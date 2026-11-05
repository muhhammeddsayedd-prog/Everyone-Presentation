'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { WorkspaceReview } from '../../../../packages/domain/src/review-types';
import { renderRegisteredReviewDocument } from '../../../../packages/templates/src/registered';
import { EDITORIAL_CSS, fontFaceCss, PUBLIC_FONT_FACES, renderPageMarkup } from '../../../../packages/templates/versions/1.2.0/html';
import type { LoadedAsset } from '../EditorialSlide';
import type { StageDeck } from './stage-pages';

/** Public copies of the pinned print fonts. Older templates name their faces Latin/Arabic. */
const LEGACY_FONTS = ([['Latin', 'IBMPlexSans'], ['Arabic', 'IBMPlexSansArabic']] as const).flatMap(([family, file]) =>
  ([[400, 'Regular'], [500, 'Medium'], [600, 'SemiBold']] as const).map(([weight, name]) => ({ family, weight, source: `/fonts/${file}-${name}.woff2` })));
const CANVAS = { '1.0.0': [1600, 900], '1.1.0': [1600, 900], '1.2.0': [1920, 1080] } as const;
export const canvasOf = (deck: StageDeck) => CANVAS[deck.template];

function ensureFonts(template: StageDeck['template']) {
  // @font-face must live in the document: browsers ignore font rules inside a shadow root.
  const id = template === '1.2.0' ? 'ef-editorial-fonts' : 'eps-legacy-template-fonts';
  if (document.getElementById(id)) return;
  const style = document.createElement('style'); style.id = id;
  style.textContent = template === '1.2.0' ? fontFaceCss(PUBLIC_FONT_FACES)
    : LEGACY_FONTS.map(font => `@font-face{font-family:${font.family};font-style:normal;font-weight:${font.weight};font-display:block;src:url("${font.source}") format("woff2")}`).join('');
  document.head.append(style);
}

export interface RenderedDeck { css: string; count: number; page: (index: number) => string }
/** The registered renderer's own markup (what the worker prints), per page. 1.2.0 pages are rendered only when
 * shown and then cached for this deck, so a deck of hundreds of pages stays responsive while typing. */
export function useRenderedDeck(deck: StageDeck, assets: Record<string, LoadedAsset>): RenderedDeck {
  return useMemo(() => renderDeck(deck, assets), [deck, assets]);
}
export function renderDeck(deck: StageDeck, assets: Record<string, LoadedAsset>): RenderedDeck {
  if (deck.template === '1.2.0') {
    const imageSources = Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.url])); const cache = new Map<number, string>();
    return { css: EDITORIAL_CSS, count: deck.deck.pages.length, page: index => {
      if (!cache.has(index)) cache.set(index, index < deck.deck.pages.length ? `<div class="ef-deck">${renderPageMarkup(deck.deck, index, { imageSources })}</div>` : '');
      return cache.get(index)!;
    } };
  }
  const ids = deck.review.slides.flatMap(slide => slide.frames.map(frame => frame.asset_id)).concat(deck.review.cover.logo_asset_id ? [deck.review.cover.logo_asset_id] : []);
  const imageSources = Object.fromEntries(ids.filter(id => /^[a-f0-9-]{36}$/u.test(id)).map(id => [id, `/api/v1/media/${id}/content`]));
  const html = renderRegisteredReviewDocument(deck.review as WorkspaceReview, { imageSources });
  // The renderer's pages are flat <article> siblings; the print body sets the page font, which the wrapper carries here.
  const style = /<style>([\s\S]*?)<\/style>/u.exec(html)?.[1] ?? '';
  const pages = html.match(/<article class="eps-page[\s\S]*?<\/article>/gu) ?? [];
  return { css: `${style}.eps-root{font-family:Latin,Arabic,sans-serif;color:#f7f7f7}`, count: pages.length, page: index => pages[index] ? `<div class="eps-root">${pages[index]}</div>` : '' };
}

const escapeAttribute = (value: string) => value.replace(/["\\]/gu, '\\$&');
/** Draws one page on a fixed canvas, scaled as one unit. Links are inert: this is a preview, not the shared deck. */
export function StageSlide({ deck, rendered, index, highlight, label, eager = true }: { deck: StageDeck; rendered: RenderedDeck; index: number; highlight?: string | null; label?: string; eager?: boolean }) {
  const [width, height] = canvasOf(deck);
  const frame = useRef<HTMLDivElement>(null); const host = useRef<HTMLDivElement>(null); const [scale, setScale] = useState(0);
  useEffect(() => { ensureFonts(deck.template); }, [deck.template]);
  useEffect(() => {
    const element = frame.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / width)); observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  const markup = eager ? rendered.page(index) : '';
  const mark = highlight ? `[data-fit-field="${escapeAttribute(highlight)}"],[data-fit-field^="${escapeAttribute(highlight)}."]{outline:6px solid #01bd68;outline-offset:8px;border-radius:6px;background:rgba(1,189,104,.08)}` : '';
  useEffect(() => {
    const element = host.current; if (!element || !eager) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{all:initial;display:block}a{pointer-events:none}${rendered.css}${mark}</style>${markup}`;
  }, [markup, rendered.css, mark, eager]);
  const named = label !== '';
  return <div ref={frame} className="stage-slide" role={named ? 'img' : undefined} aria-hidden={named ? undefined : true} aria-label={named ? label ?? `Slide ${index + 1} of ${rendered.count}` : undefined} style={{ aspectRatio: `${width} / ${height}` }}>
    <div ref={host} className="stage-slide-canvas" aria-hidden="true" style={{ width, height, transform: `scale(${scale})`, visibility: scale && eager ? 'visible' : 'hidden' }} />
  </div>;
}
