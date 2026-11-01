'use client';

import { useSyncExternalStore } from 'react';

// Per-viewer convenience only: the three most recently opened casting workspaces in this browser.
export type RecentWorkspace = { href: string; projectId: string; workspaceId: string; name: string };
const key = 'eps.recent-workspaces.v1';
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: RecentWorkspace[] } = { raw: null, value: [] };
const empty: RecentWorkspace[] = [];

function read(): RecentWorkspace[] {
  let raw: string | null;
  try { raw = window.localStorage.getItem(key); } catch { return empty; }
  if (raw === cache.raw) return cache.value;
  let value: RecentWorkspace[] = [];
  try { const parsed: unknown = JSON.parse(raw ?? '[]'); if (Array.isArray(parsed)) value = parsed.filter((item): item is RecentWorkspace => typeof item?.href === 'string' && typeof item?.name === 'string' && item.href.startsWith('/projects/')).slice(0, 3); } catch { value = []; }
  cache = { raw, value };
  return value;
}

export function rememberWorkspace(entry: RecentWorkspace) {
  const next = [entry, ...read().filter(item => item.workspaceId !== entry.workspaceId)].slice(0, 3);
  try { window.localStorage.setItem(key, JSON.stringify(next)); } catch { return; }
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
}

export function useRecentWorkspaces() { return useSyncExternalStore(subscribe, read, () => empty); }
