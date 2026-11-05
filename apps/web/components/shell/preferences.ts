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
