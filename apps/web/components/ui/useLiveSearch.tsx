'use client';

import { useCallback, useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import type { Envelope } from '../api';
import { errorMessage } from '../api';
import { Icon } from '../Icon';
import { createCastLibraryRequests as createLatestRequests } from '../../lib/cast-library-requests';
import { LIVE_SEARCH_DELAY_MS, liveSearchDelay, liveSearchTerm } from '../../lib/live-search';

/** Holds `value` until `delayFor(value, settled)` ms have passed without another change. A delay of 0 applies the
 * value in the same render (cleared searches, toggles), so the list never waits on a timer to return. */
export function useSettledValue<T>(value: T, delayFor: (next: T, settled: T) => number, same: (a: T, b: T) => boolean = Object.is): T {
  const [settled, setSettled] = useState(value);
  const wait = same(value, settled) ? -1 : delayFor(value, settled);
  useEffect(() => {
    if (wait < 0) return;
    const timer = setTimeout(() => setSettled(value), wait);
    return () => clearTimeout(timer);
  }, [value, wait]);
  return wait === 0 ? value : settled;
}

/** The term to search for while the user types: trimmed, debounced (~250 ms), and '' at once when cleared.
 * `typing` is true while the box holds text that has not been searched yet. */
export function useLiveSearch(input: string, delay = LIVE_SEARCH_DELAY_MS): { term: string; typing: boolean } {
  const next = liveSearchTerm(input);
  const term = useSettledValue(next, (value, settled) => liveSearchDelay(value, settled, delay));
  return { term, typing: term !== next };
}

type Settled<T> = { key: string; revision: number; items: T[]; next: string | null; error: string };
export type LiveResults<T> = {
  items: T[]; next: string | null; error: string;
  /** A first page for the current search (or a reload) is in flight; the previous results stay visible meanwhile. */
  loading: boolean;
  /** Nothing has been shown yet (first load). Use this, not `loading`, to decide on a full-page loading state. */
  initial: boolean;
  loadingMore: boolean; loadMore: () => Promise<void>; reload: () => void;
};

/** One current list read per search key: a new key aborts the previous request (and any Load more), late responses
 * are discarded, and the last results stay on screen until the new ones arrive. `load` receives the cursor for the
 * page to read; it may change every render. A `null` key pauses reading. */
export function useLiveResults<T>(key: string | null, load: (cursor: string | null, signal: AbortSignal) => Promise<Envelope<T[]>>): LiveResults<T> {
  const loader = useRef(load);
  useEffect(() => { loader.current = load; });
  const [requests] = useState(createLatestRequests);
  const [revision, setRevision] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  useEffect(() => {
    if (key === null) return;
    const request = requests.start();
    loader.current(null, request.signal).then(
      result => { if (request.isCurrent()) setSettled({ key, revision, items: result.data, next: result.page?.next_cursor ?? null, error: '' }); },
      reason => { if (request.isCurrent()) setSettled(current => ({ key, revision, items: current?.items ?? [], next: current?.key === key ? current.next : null, error: errorMessage(reason) })); });
    return () => { requests.cancel(); setLoadingMore(false); };
  }, [key, revision, requests]);
  const loading = key !== null && (settled?.key !== key || settled.revision !== revision);
  const loadMore = useCallback(async () => {
    const cursor = settled?.next; const forKey = settled?.key;
    if (!cursor || loading || loadingMore || forKey !== key) return;
    const request = requests.start(); setLoadingMore(true);
    try {
      const result = await loader.current(cursor, request.signal);
      if (request.isCurrent()) setSettled(current => current && current.key === forKey ? { ...current, items: [...current.items, ...result.data], next: result.page?.next_cursor ?? null, error: '' } : current);
    } catch (reason) {
      if (request.isCurrent()) setSettled(current => current && current.key === forKey ? { ...current, error: errorMessage(reason) } : current);
    } finally { if (request.isCurrent()) setLoadingMore(false); }
  }, [settled, loading, loadingMore, key, requests]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  return { items: settled?.items ?? [], next: loading ? null : settled?.next ?? null, error: settled?.error ?? '', loading, initial: settled === null, loadingMore, loadMore, reload };
}

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: string; onValueChange: (value: string) => void;
  /** Accessible name. Shown above the box when `visibleLabel`, otherwise read by screen readers only. */
  label: string; visibleLabel?: boolean;
  /** A search is in flight: marks the box busy without hiding the current results. */
  busy?: boolean;
};

/** The app's search box: searches as you type (pair with useLiveSearch), Escape clears it (and only then lets
 * Escape reach an enclosing drawer), and it never needs Enter or a Search button. */
export function SearchField({ value, onValueChange, label, visibleLabel, busy, id, className, onKeyDown, ...rest }: SearchFieldProps) {
  function keys(event: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && value !== '') { event.preventDefault(); event.stopPropagation(); onValueChange(''); }
    if (event.key === 'Enter') event.preventDefault();
  }
  const input = <input {...rest} id={id} type="search" value={value} aria-busy={busy || undefined} autoComplete="off" spellCheck={false} onKeyDown={keys} onChange={event => onValueChange(event.target.value)} />;
  if (visibleLabel) return <div className={`field${className ? ` ${className}` : ''}`}><label htmlFor={id}>{label}</label><span className="search-field search-field-block" data-busy={busy || undefined}><Icon name="search" />{input}</span></div>;
  return <label className={`search-field${className ? ` ${className}` : ''}`} data-busy={busy || undefined}><Icon name="search" /><span className="sr-only">{label}</span>{input}</label>;
}
