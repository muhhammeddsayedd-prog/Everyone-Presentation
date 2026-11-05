'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Deck } from '../../../packages/templates/versions/1.2.0/deck';
import { EDITORIAL_CSS, fontFaceCss, PUBLIC_FONT_FACES, renderPageMarkup } from '../../../packages/templates/versions/1.2.0/html';

/** In-app preview of the Everyone Film editorial template. It renders the exact
 * page markup and stylesheet the PDF worker prints, inside a Shadow DOM so app
 * styles cannot reach the slide, on a fixed 1920×1080 stage scaled as one unit. */
export type AssetFetch = (assetId: string, signal: AbortSignal) => Promise<Response>;
export interface LoadedAsset { url: string; width: number; height: number }
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

/** Retained-asset bytes become object URLs; the template accepts only those, data URIs and its fixed public files. */
export function useEditorialAssets(assetIds: readonly string[], fetchAsset: AssetFetch) {
  const key = [...new Set(assetIds)].sort().join(',');
  const [assets, setAssets] = useState<Record<string, LoadedAsset>>({}); const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    const controller = new AbortController(); const urls: string[] = []; let current = true;
    void Promise.all(key ? key.split(',').map(async id => {
      try {
        const response = await fetchAsset(id, AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]));
        const mime = response.headers.get('content-type')?.split(';')[0].trim();
        if (!response.ok || !mime || !IMAGE_TYPES.includes(mime)) throw new Error('IMAGE_UNAVAILABLE');
        const blob = await response.blob(); if (!blob.size || blob.size > 20 * 1024 * 1024) throw new Error('IMAGE_UNAVAILABLE');
        const bitmap = await createImageBitmap(blob); const size = [bitmap.width, bitmap.height]; bitmap.close();
        const url = URL.createObjectURL(new Blob([blob], { type: mime })); urls.push(url);
        return [id, { url, width: size[0], height: size[1] }] as const;
      } catch { return [id, null] as const; }
    }) : []).then(entries => {
      if (!current) return;
      setAssets(Object.fromEntries(entries.filter(([, value]) => value).map(([id, value]) => [id, value!])));
      setFailed(entries.filter(([, value]) => !value).map(([id]) => id));
    });
    return () => { current = false; controller.abort(); for (const url of urls) URL.revokeObjectURL(url); };
  }, [key, fetchAsset]);
  return { assets, failed };
}

function useEditorialFonts() {
  useEffect(() => {
    // @font-face must live in the document; Shadow DOM font rules are ignored by browsers.
    if (document.getElementById('ef-editorial-fonts')) return;
    const style = document.createElement('style'); style.id = 'ef-editorial-fonts'; style.textContent = fontFaceCss(PUBLIC_FONT_FACES); document.head.append(style);
  }, []);
}

export function EditorialPage({ deck, index, assets, videoHrefs, label }: { deck: Deck; index: number; assets: Record<string, LoadedAsset>; videoHrefs?: Record<string, string>; label?: string }) {
  useEditorialFonts();
  const frame = useRef<HTMLDivElement>(null); const host = useRef<HTMLDivElement>(null); const [scale, setScale] = useState(0);
  const markup = useMemo(() => renderPageMarkup(deck, index, { imageSources: Object.fromEntries(Object.entries(assets).map(([id, asset]) => [id, asset.url])), videoHrefs }), [deck, index, assets, videoHrefs]);
  useEffect(() => {
    const element = frame.current; if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / deck.canvas.width)); observer.observe(element);
    return () => observer.disconnect();
  }, [deck.canvas.width]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const root = element.shadowRoot ?? element.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${EDITORIAL_CSS}</style><div class="ef-deck">${markup}</div>`;
  }, [markup]);
  const page = deck.pages[index];
  return <div ref={frame} className="ef-preview-frame" role="group" aria-roledescription="slide" aria-label={label ?? `Slide ${index + 1} of ${deck.pages.length}`} data-layout={page?.layout}>
    <div ref={host} className="ef-preview-stage" style={{ transform: `scale(${scale})`, visibility: scale ? 'visible' : 'hidden' }} />
  </div>;
}

/** Every composed page in print order — what the downloaded PDF contains. */
export function EditorialDeck({ deck, assets, videoHrefs, pages }: { deck: Deck; assets: Record<string, LoadedAsset>; videoHrefs?: Record<string, string>; pages?: number[] }) {
  const shown = pages ?? deck.pages.map(page => page.index);
  return <ol className="ef-preview-deck">{shown.map(index => <li key={index}><EditorialPage deck={deck} index={index} assets={assets} videoHrefs={videoHrefs} /></li>)}</ol>;
}

/** Retained images a composed editorial deck (1.2.0 or 1.3.0) draws. */
interface AssetElementLike { kind: string; source?: { type: string; asset_id?: string } }
export function deckAssetIds(deck: { pages: readonly { index: number; elements: readonly AssetElementLike[] }[] }, pages?: number[]) {
  const selected = pages ? deck.pages.filter(page => pages.includes(page.index)) : deck.pages;
  return selected.flatMap(page => page.elements.flatMap(element => element.kind === 'image' && element.source?.type === 'asset' && element.source.asset_id ? [element.source.asset_id] : []));
}
