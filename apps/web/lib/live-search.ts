/** Live search timing shared by every search box: search while typing after a short pause, and return to the
 * unfiltered list at once when the text is cleared. Pure helpers so the rules are unit-testable; the React
 * wiring is in components/ui/useLiveSearch.ts. */
export const LIVE_SEARCH_DELAY_MS = 250;

/** The term actually searched: surrounding whitespace never changes results, so it never starts a request. */
export function liveSearchTerm(input: string): string { return input.trim(); }

/** Milliseconds to wait before `next` replaces the searched `settled` term: none when cleared (the normal list
 * returns immediately) or unchanged, otherwise the typing pause. */
export function liveSearchDelay(next: string, settled: string, delay = LIVE_SEARCH_DELAY_MS): number {
  const term = liveSearchTerm(next);
  return term === '' || term === liveSearchTerm(settled) ? 0 : delay;
}

/** Filter records mix typed text (debounced like a search box) with choices such as radios and toggles (applied
 * at once). Clearing or removing a typed filter is also applied at once. */
export function liveFilterDelay(next: Record<string, string>, settled: Record<string, string>, typedKeys: readonly string[], delay = LIVE_SEARCH_DELAY_MS): number {
  let typing = false;
  for (const key of new Set([...Object.keys(next), ...Object.keys(settled)])) {
    const value = next[key] ?? ''; const before = settled[key] ?? '';
    if (value === before) continue;
    if (!typedKeys.includes(key)) return 0;
    if (liveSearchTerm(value) === '') return 0;
    if (liveSearchTerm(value) !== liveSearchTerm(before)) typing = true;
  }
  return typing ? delay : 0;
}

/** Trimmed copy of typed filter values, so the request matches what liveFilterDelay treats as a change. */
export function liveFilterValues(values: Record<string, string>, typedKeys: readonly string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typedKeys.includes(key) ? liveSearchTerm(value) : value]));
}
