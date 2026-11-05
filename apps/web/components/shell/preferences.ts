'use client';

import { useSyncExternalStore } from 'react';

// Per-viewer conveniences only. Storage can be blocked (private windows, previews), so every access is guarded
// and the choice then lasts for this page view.
const panelKey = 'eps.panel.v1';
const listeners = new Set<() => void>();
let memory: boolean | null = null;

function readCollapsed() {
  try { const value = window.localStorage.getItem(panelKey); if (value === 'collapsed') return true; if (value === 'open') return false; } catch { /* storage blocked */ }
  return memory ?? false;
}
function subscribe(listener: () => void) {
  listeners.add(listener); window.addEventListener('storage', listener);
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
}

/** Whether the desktop config panel is collapsed (shared by every page, like an editor's side panel). */
export function usePanelCollapsed() { return useSyncExternalStore(subscribe, readCollapsed, () => false); }
export function setPanelCollapsed(collapsed: boolean) {
  memory = collapsed;
  try { window.localStorage.setItem(panelKey, collapsed ? 'collapsed' : 'open'); } catch { /* storage blocked */ }
  listeners.forEach(listener => listener());
}

export type PanelKind = 'wide' | 'narrow';
const widthKey = 'eps.panel.width.v1';
const widthMemory: Partial<Record<PanelKind, number>> = {};
const widthListeners = new Set<() => void>();
function readWidth(kind: PanelKind): number | null {
  try { const saved: unknown = JSON.parse(window.localStorage.getItem(widthKey) ?? 'null'); const value = saved && typeof saved === 'object' ? (saved as Record<string, unknown>)[kind] : undefined;
    if (typeof value === 'number' && Number.isFinite(value)) return value; } catch { /* storage blocked */ }
  return widthMemory[kind] ?? null;
}
function subscribeWidth(listener: () => void) {
  widthListeners.add(listener); window.addEventListener('storage', listener);
  return () => { widthListeners.delete(listener); window.removeEventListener('storage', listener); };
}
/** The width the viewer gave the config panel (px), or null for the layout's own default. Wide panels (the workspace
 * editor, presentation screens) and narrow ones (filters, sections) are remembered separately. */
export function usePanelWidth(kind: PanelKind) { return useSyncExternalStore(subscribeWidth, () => readWidth(kind), () => null); }
export function setPanelWidth(kind: PanelKind, width: number | null) {
  if (width === null) delete widthMemory[kind]; else widthMemory[kind] = width;
  try { const saved: unknown = JSON.parse(window.localStorage.getItem(widthKey) ?? 'null'); const next = { ...(saved && typeof saved === 'object' ? saved as Record<string, unknown> : {}) };
    if (width === null) delete next[kind]; else next[kind] = width; window.localStorage.setItem(widthKey, JSON.stringify(next)); } catch { /* storage blocked */ }
  widthListeners.forEach(listener => listener());
}

const noop = () => () => undefined;
/** False in the server HTML and during hydration, true afterwards. */
export function useHydrated() { return useSyncExternalStore(noop, () => true, () => false); }

/** Live match of a media query; false on the server and before hydration. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    listener => { const media = window.matchMedia(query); media.addEventListener('change', listener); return () => media.removeEventListener('change', listener); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
