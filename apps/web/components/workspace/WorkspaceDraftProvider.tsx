'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import type { Candidate, CandidateMedia, WorkspaceCandidate } from '../../../../packages/domain/src/candidate-types';
import type { Assignment, CastingOutput } from '../../../../packages/domain/src/casting-types';
import type { PresentationSeries } from '../../../../packages/domain/src/review-types';
import type { Role, Slot } from '../../../../packages/domain/src/specs-types';
import { api, errorMessage, type Envelope, type Workspace } from '../api';
import { readCandidateMedia } from '../candidate-pages';
import type { DraftFocus, DraftOverlay, DraftSource } from './draft-review';

/** One selection shared by the panel and the stage. `from` says who chose it, so each side only follows the other. */
export interface DraftSelection { target: DraftFocus; from: 'panel' | 'stage'; field: string | null; related: string[]; seq: number }
export const focusKey = (focus: DraftFocus) => focus.kind === 'cover' ? 'cover' : `${focus.kind}:${focus.id}`;
function parseFocus(key: string): DraftFocus | null {
  if (key === 'cover') return { kind: 'cover' };
  const [kind, ...rest] = key.split(':'); const id = rest.join(':');
  return id && (kind === 'role' || kind === 'slot' || kind === 'assignment' || kind === 'pool') ? { kind, id } : null;
}
const sameFocus = (a: DraftFocus, b: DraftFocus) => focusKey(a) === focusKey(b);
interface DraftContextValue {
  enabled: boolean; status: 'idle' | 'loading' | 'ready' | 'error'; error: string; stale: string; refreshing: boolean;
  source: DraftSource | null; series: PresentationSeries[]; defaultTemplate: string | null; profilesReadable: boolean;
  output: CastingOutput; overlay: DraftOverlay; selection: DraftSelection | null;
  setDraft: (key: string, value: unknown) => void; clearDraft: (key: string) => void;
  refresh: (full?: boolean) => void; select: (target: DraftFocus, from: 'panel' | 'stage', field?: string | null, related?: string[]) => void;
}
const Context = createContext<DraftContextValue | null>(null);
export function useWorkspaceDraft() { return useContext(Context); }

const encode = encodeURIComponent;
async function pages<T extends { id: string }>(path: string, signal: AbortSignal): Promise<T[]> {
  const result: T[] = []; const seen = new Set<string>(); const cursors = new Set<string>(); let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const response: Envelope<T[]> = await api<T[]>(`${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encode(cursor)}` : ''}`, { signal });
    if (!Array.isArray(response.data) || response.data.some(row => !row || seen.has(row.id))) throw new Error('The workspace changed while the preview was loading.');
    for (const row of response.data) { seen.add(row.id); result.push(row); }
    cursor = response.page?.next_cursor ?? null; if (cursor === null) return result;
    if (!cursor || cursors.has(cursor)) throw new Error('The workspace could not be read safely for the preview.'); cursors.add(cursor);
  }
  throw new Error('This workspace is too large to preview at once.');
}
async function batched<T>(ids: string[], size: number, read: (id: string) => Promise<T>) {
  const found: Record<string, T> = {}; let missing = 0;
  for (let index = 0; index < ids.length; index += size) {
    const batch = ids.slice(index, index + size); const values = await Promise.allSettled(batch.map(read));
    values.forEach((value, n) => { if (value.status === 'fulfilled') found[batch[n]] = value.value; else missing++; });
  }
  return { found, missing };
}

interface Props {
  enabled: boolean; workspaceId: string; projectId: string; canReadProfiles: boolean;
  project: { name: string; client_name: string | null }; workspace: Workspace; children: ReactNode;
  /** Set to this draft's refresh, so saves made outside the panel (header, project, branding) re-read the draft. */
  refreshRef?: MutableRefObject<(() => void) | null>;
}
/** Loads the saved records a working draft is projected from and keeps unsaved panel edits beside them.
 * Saves stay with each panel; after a save (or when the draft revision moves, e.g. Claude or a colleague edited it)
 * the records are read again. The server remains the authority for checks, fit and generation. */
export function WorkspaceDraftProvider({ enabled, workspaceId, projectId, canReadProfiles, project, workspace, children, refreshRef }: Props) {
  const [loaded, setLoaded] = useState<Omit<DraftSource, 'project' | 'workspace'> & { revision: number } | null>(null);
  const [series, setSeries] = useState<PresentationSeries[]>([]); const [defaultTemplate, setDefaultTemplate] = useState<string | null>(null);
  const [status, setStatus] = useState<DraftContextValue['status']>(enabled ? 'loading' : 'idle'); const [error, setError] = useState(''); const [stale, setStale] = useState('');
  const [refreshing, setRefreshing] = useState(false); const [overlay, setOverlay] = useState<Record<string, unknown>>({});
  const [selection, setSelection] = useState<DraftSelection | null>(null);
  const request = useRef<AbortController | null>(null); const pending = useRef(false); const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deferred = useRef(new Set<string>()); const profiles = useRef(new Map<string, Candidate>()); const media = useRef(new Map<string, CandidateMedia[]>());
  const settingsRead = useRef(false); const loadedRevision = useRef<number | null>(null); const mounted = useRef(true);
  const seq = useRef(0);

  const load = useCallback(async (full: boolean) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]); const current = () => mounted.current && request.current === controller;
    setRefreshing(true);
    try {
      const base = `/api/v1/workspaces/${encode(workspaceId)}`;
      let snapshot: { roles: Role[]; slots: Slot[]; pool: WorkspaceCandidate[]; assignments: Assignment[]; revision: number } | null = null;
      for (let attempt = 0; attempt < 3 && !snapshot; attempt++) {
        const before = await api<Workspace>(base, { signal });
        if (before.data.id !== workspaceId || before.data.project_id !== projectId) throw new Error('This workspace does not belong to the requested project.');
        const [roles, pool, assignments, seriesRows] = await Promise.all([pages<Role>(`${base}/roles`, signal), pages<WorkspaceCandidate>(`${base}/candidates`, signal),
          pages<Assignment>(`${base}/assignments?output_type=selection`, signal), pages<PresentationSeries>(`/api/v1/presentation-series?workspace_id=${encode(workspaceId)}`, signal).catch(() => null)]);
        const slots: Slot[] = [];
        for (let index = 0; index < roles.length; index += 4) slots.push(...(await Promise.all(roles.slice(index, index + 4).map(role => pages<Slot>(`/api/v1/roles/${encode(role.id)}/slots`, signal)))).flat());
        const after = await api<Workspace>(base, { signal });
        if (after.data.draft_revision !== before.data.draft_revision) continue;
        if (seriesRows && current()) setSeries(seriesRows.filter(row => row.workspace_id === workspaceId && !row.archived));
        snapshot = { roles: roles.filter(row => !row.archived), slots: slots.filter(row => !row.archived), pool, assignments: assignments.filter(row => !row.archived), revision: after.data.draft_revision };
      }
      if (!snapshot) throw new Error('The workspace kept changing while the preview was loading.');
      if (!settingsRead.current) {
        settingsRead.current = true;
        const settings = await api<{ template_version: string }>('/api/v1/settings', { signal }).catch(() => null);
        if (current() && settings && typeof settings.data?.template_version === 'string') setDefaultTemplate(settings.data.template_version);
      }
      // Only people on the draft need profiles and material; both are cached and re-read on a full refresh.
      const onDraft = new Set(snapshot.assignments.map(row => row.workspace_candidate_id));
      const people = snapshot.pool.filter(row => onDraft.has(row.id));
      const profileIds = [...new Set(people.map(row => row.candidate_id))].filter(id => full || !profiles.current.has(id));
      let missing = 0;
      if (canReadProfiles && profileIds.length) {
        const result = await batched(profileIds, 8, async id => { const value = (await api<Candidate>(`/api/v1/candidates/${encode(id)}`, { signal })).data; if (value.id !== id) throw new Error('mismatch'); return value; });
        for (const [id, value] of Object.entries(result.found)) profiles.current.set(id, value); missing += result.missing;
      }
      const mediaIds = [...new Set(people.filter(row => row.selected_candidate_media_id).map(row => row.candidate_id))].filter(id => full || !media.current.has(id));
      if (mediaIds.length) {
        const result = await batched(mediaIds, 8, async id => (await readCandidateMedia(id, { signal })).data);
        for (const [id, value] of Object.entries(result.found)) media.current.set(id, value); missing += result.missing;
      }
      if (!current()) return;
      setLoaded({ ...snapshot, candidates: Object.fromEntries(profiles.current), media: Object.fromEntries(media.current) });
      loadedRevision.current = snapshot.revision;
      setStatus('ready'); setError(''); setStale(missing ? `${missing} ${missing === 1 ? 'profile or introduction' : 'profiles or introductions'} could not be read. The preview may be incomplete.` : '');
    } catch (reason) {
      if (!current()) return;
      const message = errorMessage(reason);
      setStatus(value => value === 'ready' ? value : 'error'); setError(value => loadedRevision.current === null ? message : value);
      setStale(loadedRevision.current === null ? '' : `The preview could not be refreshed. ${message}`);
    } finally {
      if (current()) {
        request.current = null; pending.current = false; setRefreshing(false);
        if (deferred.current.size) { const keys = [...deferred.current]; deferred.current.clear(); setOverlay(value => { const next = { ...value }; for (const key of keys) delete next[key]; return next; }); }
      }
    }
  }, [workspaceId, projectId, canReadProfiles]);

  const refresh = useCallback((full = false) => {
    if (!enabled) return; pending.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; void load(full); }, 120);
  }, [enabled, load]);
  useEffect(() => { if (!refreshRef) return; refreshRef.current = () => refresh(); return () => { refreshRef.current = null; }; }, [refreshRef, refresh]);
  useEffect(() => {
    mounted.current = true; if (enabled) void Promise.resolve().then(() => load(true));
    return () => { mounted.current = false; request.current?.abort(); if (timer.current) clearTimeout(timer.current); };
  }, [enabled, load]);
  // Someone else (a colleague or Claude) moved the draft: read it again so their edits appear.
  useEffect(() => { if (enabled && loadedRevision.current !== null && workspace.draft_revision !== loadedRevision.current && !pending.current) refresh(); }, [enabled, workspace.draft_revision, refresh]);
  useEffect(() => {
    if (!enabled) return;
    const check = () => { if (document.visibilityState !== 'visible' || pending.current) return;
      void api<Workspace>(`/api/v1/workspaces/${encode(workspaceId)}`).then(result => { if (mounted.current && loadedRevision.current !== null && result.data.draft_revision !== loadedRevision.current && !pending.current) refresh(); }).catch(() => undefined); };
    const interval = setInterval(check, 30000); window.addEventListener('focus', check);
    return () => { clearInterval(interval); window.removeEventListener('focus', check); };
  }, [enabled, workspaceId, refresh]);

  const setDraft = useCallback((key: string, value: unknown) => { deferred.current.delete(key); setOverlay(current => Object.is(current[key], value) ? current : { ...current, [key]: value }); }, []);
  // A save is followed by a refresh: keep the edited value until the saved record arrives, so the slide never flashes back.
  const clearDraft = useCallback((key: string) => {
    if (pending.current) { deferred.current.add(key); return; }
    setOverlay(current => { if (!Object.hasOwn(current, key)) return current; const next = { ...current }; delete next[key]; return next; });
  }, []);
  const select = useCallback((target: DraftFocus, from: 'panel' | 'stage', field: string | null = null, related: string[] = []) => setSelection({ target, from, field, related, seq: ++seq.current }), []);
  // Panel → stage: rows and fields declare what they edit (data-draft-focus / data-draft-field); focusing or clicking one selects it.
  useEffect(() => {
    if (!enabled) return;
    const pick = (event: Event) => {
      const element = event.target instanceof Element ? event.target : null; const row = element?.closest<HTMLElement>('.config-panel [data-draft-focus]'); if (!row) return;
      const target = parseFocus(row.dataset.draftFocus ?? ''); if (!target) return;
      const field = element?.closest<HTMLElement>('[data-draft-field]')?.dataset.draftField ?? null;
      setSelection(current => current && current.from === 'panel' && current.field === field && sameFocus(current.target, target) ? current : { target, from: 'panel', field, related: [], seq: ++seq.current });
    };
    document.addEventListener('focusin', pick); document.addEventListener('click', pick);
    return () => { document.removeEventListener('focusin', pick); document.removeEventListener('click', pick); };
  }, [enabled]);
  // Stage → panel: scroll the matching row into view and mark it, most specific record first.
  useEffect(() => {
    document.querySelectorAll('[data-draft-selected]').forEach(node => node.removeAttribute('data-draft-selected'));
    if (!selection || selection.from !== 'stage') return;
    for (const key of [focusKey(selection.target), ...selection.related]) {
      const row = document.querySelector<HTMLElement>(`.config-panel [data-draft-focus="${CSS.escape(key)}"]`);
      if (row) { row.setAttribute('data-draft-selected', ''); row.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); break; }
    }
  }, [selection]);

  const source = useMemo<DraftSource | null>(() => loaded && { ...loaded, project, workspace: { id: workspace.id, logo_asset_id: workspace.logo_asset_id, logo_placement: workspace.logo_placement, draft_revision: loaded.revision } },
    [loaded, project, workspace.id, workspace.logo_asset_id, workspace.logo_placement]);
  const value = useMemo<DraftContextValue>(() => ({ enabled, status, error, stale, refreshing, source, series, defaultTemplate, profilesReadable: canReadProfiles, output: workspace.active_output, overlay, selection, setDraft, clearDraft, refresh, select }),
    [enabled, status, error, stale, refreshing, source, series, defaultTemplate, canReadProfiles, workspace.active_output, overlay, selection, setDraft, clearDraft, refresh, select]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Mirrors an unsaved panel value onto the live slide while `active`; removes it once saved or discarded. */
export function useDraftValue(key: string, value: unknown, active: boolean) {
  const draft = useWorkspaceDraft(); const setDraft = draft?.setDraft; const clearDraft = draft?.clearDraft;
  const serialized = JSON.stringify(value);
  useEffect(() => { if (!setDraft || !clearDraft) return; if (active) setDraft(key, JSON.parse(serialized)); else clearDraft(key); }, [key, serialized, active, setDraft, clearDraft]);
  useEffect(() => () => clearDraft?.(key), [key, clearDraft]);
}

/** Tells the stage which record the panel is working on (on focus or open), so its slide comes into view. */
export function useDraftSelect() {
  const draft = useWorkspaceDraft(); const select = draft?.select;
  return useCallback((target: DraftFocus, field: string | null = null) => select?.(target, 'panel', field), [select]);
}
