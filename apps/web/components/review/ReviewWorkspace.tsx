'use client';

import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { AiSuggestion, AudiencePreset, CandidateMedia, PresentationSeries, ReviewJobAccepted, ReviewSlide, WorkspaceReview } from '@eps/domain';
import { slideWordingFields, type SlideWordingField } from '../../../../packages/domain/src/casting-types.ts';
import { REVIEW_FIELD_LABELS } from '../../../../packages/templates/src/render.ts';
import { PENDING_REQUIREMENT_LABELS } from '../../../../packages/templates/versions/1.1.0/render.ts';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope, type Workspace } from '../api';
import { CandidateEnglishTranscript } from '../english-transcript';
import { ErrorNotice, Loading } from '../Feedback';
import { CandidateFrameImage } from '../CandidateFrameImage';
import { readCandidateMedia } from '../candidate-pages';
import { Icon } from '../Icon';
import { SegmentIndicator } from '../motion/SegmentIndicator';
import { PageFrame, RightPanel } from '../shell/PageFrame';
import { DeckStage, type StageChip, type StageHighlight } from '../workspace/DeckStage';
import { useStageDeck } from '../workspace/useStageDeck';
import { CHECK_GROUPS, checkGroup, pageForSlide, previewReview, slideForIssue, type CheckGroupKey, type ReviewPreviewEdit } from './review-preview';

interface Props { workspaceId: string; projectId: string; actor: Actor; initialOutput: 'selection' | 'shortlist'; requestedSeriesId?: string | null; onSeriesChanged?: (value: string) => void; onDirtyChange: (value: boolean) => void; onWorkspaceChanged: () => void }
interface Intent { path: string; init: RequestInit; label: string; refresh?: boolean; accepted?: (data: unknown) => void }
type Issue = WorkspaceReview['issues'][number];
type InspectorTab = 'facts' | 'video' | 'wording';

const editorialLabels: Record<string, string> = { role_name: 'Role / slot title', project_name: 'Cover title', client_name: 'Client name', title: 'Presentation title', layout: 'Page layout' };
export function fitFieldLabel(field: string) {
  const key = field.replace(/^requirements\./, '');
  return REVIEW_FIELD_LABELS[field as SlideWordingField] ?? PENDING_REQUIREMENT_LABELS[key as keyof typeof PENDING_REQUIREMENT_LABELS] ?? editorialLabels[field] ?? field;
}
async function allRows<T>(path: string, signal: AbortSignal) {
  const result: T[] = []; const seen = new Set<string>(); let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const data: Envelope<T[]> = await api(`${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal });
    if (!Array.isArray(data.data)) throw new Error('The saved review choices could not be read.');
    result.push(...data.data); cursor = data.page?.next_cursor ?? null; if (!cursor) return result;
    if (seen.has(cursor)) break; seen.add(cursor);
  }
  throw new Error('The review choices changed while paging. Refresh them.');
}
const outputName = (value: 'selection' | 'shortlist') => value === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
const templateName = (version: string) => version === '1.2.0' ? 'Everyone Film Editorial 1.2.0' : `Everyone Casting ${version}`;
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
function slideTitle(slide: ReviewSlide) { return slide.kind === 'candidate' ? slide.fields.name_or_id : `${slide.slot_label} · Pending`; }

/** Final review, presentation-first: series and server checks in the panel, the checked draft on the stage,
 * and the selected assignment's facts, source video and wording in the inspector. Every check, fit result
 * and the generation gate still come from the server review; the stage only previews an unsaved edit. */
export function ReviewWorkspace(props: Props) { return <ReviewScope key={`${props.actor.id}:${props.workspaceId}`} {...props} />; }
function ReviewScope({ workspaceId, projectId, actor, initialOutput, requestedSeriesId, onSeriesChanged, onDirtyChange, onWorkspaceChanged }: Props) {
  const [series, setSeries] = useState<PresentationSeries[]>([]); const [presets, setPresets] = useState<AudiencePreset[]>([]);
  const [seriesId, setSeriesId] = useState(''); const [output, setOutput] = useState(initialOutput); const [presetId, setPresetId] = useState('');
  const [review, setReview] = useState<WorkspaceReview | null>(null); const [loading, setLoading] = useState(true); const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [uncertain, setUncertain] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [field, setField] = useState<SlideWordingField>('skills_experience');
  const [tab, setTab] = useState<InspectorTab>('facts');
  const [wording, setWording] = useState(''); const [availability, setAvailability] = useState(''); const [wordingDirty, setWordingDirty] = useState(false); const [availabilityDirty, setAvailabilityDirty] = useState(false); const edited = wordingDirty || availabilityDirty;
  function resetEdits() { setWordingDirty(false); setAvailabilityDirty(false); }
  const [instruction, setInstruction] = useState('Shorten the supplied wording while preserving every stated fact and qualifier.');
  const [suggestionId, setSuggestionId] = useState<string | null>(null); const [proposal, setProposal] = useState<AiSuggestion | null>(null);
  const [suggestionFingerprint, setSuggestionFingerprint] = useState<string | null>(null); const [fitJob, setFitJob] = useState<string | null>(null);
  const [applying, setApplying] = useState(false); const applyingRef = useRef(false);
  const [openGroups, setOpenGroups] = useState<Partial<Record<CheckGroupKey, boolean>>>({});
  const [stageKey, setStageKey] = useState('cover'); const [mark, setMark] = useState<{ key: string } & StageHighlight | null>(null);
  const [drift, setDrift] = useState<number | null>(null);
  const alive = useRef(false); const intent = useRef<Intent | null>(null); const pending = useRef(false);
  const canWrite = actor.capabilities?.includes('workspaces.write') === true;
  const canCreate = actor.capabilities?.includes('presentations.generate') === true;
  const selected = selectedId ? review?.slides.find(row => row.kind === 'candidate' && row.assignment_id === selectedId) ?? null : null;
  const locked = busy || uncertain || applying;
  useEffect(() => { if (seriesId) onSeriesChanged?.(seriesId); }, [seriesId, onSeriesChanged]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { onDirtyChange(edited || locked); return () => onDirtyChange(false); }, [edited, locked, onDirtyChange]);
  const reload = useCallback(() => setRefresh(value => value + 1), []);
  const loadedFingerprint = useRef<string | null>(null);
  const acceptReview = useEffectEvent((value: WorkspaceReview) => {
    if (loadedFingerprint.current !== value.input_fingerprint) {
      const updated = value.slides.find(slide => slide.assignment_id === selectedId && slide.kind === 'candidate');
      if (selectedId && !updated) setSelectedId(null);
      setWording(updated && updated.fields[field] !== 'Not provided' ? updated.fields[field] : '');
      setAvailability(updated && updated.source_fields.availability !== 'Not provided' ? updated.source_fields.availability : '');
      resetEdits(); setProposal(null); setSuggestionId(null); setSuggestionFingerprint(null);
    }
    loadedFingerprint.current = value.input_fingerprint;
    setReview(value); setOutput(value.output_type); setError(''); setDrift(null);
  });
  useEffect(() => {
    const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]); let current = true;
    Promise.all([allRows<PresentationSeries>(`/api/v1/presentation-series?workspace_id=${encodeURIComponent(workspaceId)}`, signal), allRows<AudiencePreset>('/api/v1/audience-presets', signal)])
      .then(([choices, audiences]) => { if (!current) return;
        if (choices.some(row => row.workspace_id !== workspaceId)) throw new Error('The saved series belongs to a different workspace.');
        const active = choices.filter(row => !row.archived); const available = audiences.filter(row => !row.archived);
        if (requestedSeriesId && !active.some(row => row.id === requestedSeriesId)) throw new Error('The linked review series is unavailable in this workspace. Choose a review context from the workspace again.');
        setSeries(active); setPresets(available); setPresetId(value => available.some(row => row.id === value) ? value : available[0]?.id ?? '');
        setSeriesId(value => active.some(row => row.id === value) ? value : requestedSeriesId ?? active.find(row => row.output_type === initialOutput && row.template_version === '1.2.0')?.id ?? active.find(row => row.output_type === initialOutput && row.template_version === '1.1.0')?.id ?? active.find(row => row.output_type === initialOutput)?.id ?? active[0]?.id ?? ''); setError('');
      }).catch(reason => { if (current) setError(errorMessage(reason)); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; controller.abort(); };
  }, [workspaceId, initialOutput, requestedSeriesId, refresh]);
  useEffect(() => {
    if (!seriesId) return;
    const controller = new AbortController(); let current = true;
    async function load() {
      if (!current) return; setLoading(true); setReview(null);
      try { const result = await api<WorkspaceReview>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/review?series_id=${encodeURIComponent(seriesId)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]) });
        if (!current) return; if (result.data.workspace_id !== workspaceId || result.data.series_id !== seriesId) throw new Error('The review context changed. Choose the series again.'); acceptReview(result.data);
      } catch (reason) { if (current) setError(errorMessage(reason)); } finally { if (current) setLoading(false); }
    }
    void Promise.resolve().then(load);
    return () => { current = false; controller.abort(); };
  }, [workspaceId, seriesId, refresh]);
  // Someone (a colleague, Claude, another tab) moved the draft after this check: say so instead of silently re-checking.
  useEffect(() => {
    if (!review) return; let current = true;
    const check = () => { if (document.visibilityState !== 'visible') return;
      void api<Workspace>(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}`).then(result => { if (current && result.data.id === workspaceId && result.data.draft_revision !== review.draft_revision) setDrift(result.data.draft_revision); }).catch(() => undefined); };
    const timer = setInterval(check, 30000); window.addEventListener('focus', check);
    return () => { current = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, [review, workspaceId]);
  useEffect(() => {
    if (!suggestionId) return; let current = true; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    const load = async () => {
      try { const value = (await api<AiSuggestion>(`/api/v1/ai-suggestions/${encodeURIComponent(suggestionId)}`, { signal: controller.signal })).data;
        if (!current) return; if (value.id !== suggestionId) throw new Error('Suggestion identity changed.');
        if (value.status === 'succeeded') { setProposal(value); setSuggestionId(null); }
        else if (['failed', 'cancelled', 'waiting_for_input'].includes(value.status)) { setSuggestionId(null); setError('The wording proposal could not complete for the current input. Existing wording is unchanged.'); }
        else timer = setTimeout(() => void load(), 3000);
      } catch (reason) { if (current) { setSuggestionId(null); setError(errorMessage(reason)); } }
    }; void load(); return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [suggestionId]);
  useEffect(() => {
    if (!fitJob) return; let current = true; let timer: ReturnType<typeof setTimeout>; const controller = new AbortController();
    const load = async () => {
      try { const job = (await api<{ id: string; status: string }>(`/api/v1/jobs/${encodeURIComponent(fitJob)}`, { signal: controller.signal })).data;
        if (!current) return; if (job.id !== fitJob) throw new Error('Layout job identity changed.');
        if (['succeeded', 'failed', 'cancelled', 'waiting_for_input'].includes(job.status)) { setFitJob(null); setNotice(edited ? 'Layout processing finished. Save or discard your edit, then refresh the review.' : job.status === 'succeeded' ? 'Layout measurement completed.' : 'Layout measurement needs attention. Existing work is unchanged.'); if (!edited) reload(); }
        else timer = setTimeout(() => void load(), 3000);
      } catch (reason) { if (current) { setFitJob(null); setError(errorMessage(reason)); } }
    }; void load(); return () => { current = false; controller.abort(); clearTimeout(timer); };
  }, [fitJob, edited, reload]);
  async function send(change: Intent, retry = false) {
    if (pending.current || !retry && uncertain) return;
    if (!retry) intent.current = change; pending.current = true; setBusy(true); setError(''); setNotice('');
    try { const response = await api(change.path, { ...change.init, signal: AbortSignal.timeout(30000) });
      if (!alive.current) return; intent.current = null; setUncertain(false); resetEdits(); setNotice(`${change.label} saved.`);
      change.accepted?.(response.data); if (change.refresh !== false) { onWorkspaceChanged(); reload(); }
    } catch (reason) { if (alive.current) { const unknown = uncertain || !(reason instanceof ApiError) || reason.status >= 500 || [408, 429].includes(reason.status);
      setUncertain(unknown); if (!unknown) intent.current = null; setError(`${unknown ? 'This change may have saved. Retry the same request to confirm it. ' : ''}${errorMessage(reason)}`); }
    } finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  function createSeries() {
    void send({ path: '/api/v1/presentation-series', init: mutation('POST', { workspace_id: workspaceId, output_type: output, audience_preset_id: presetId }), label: 'Review series', accepted: data => {
      const value = data as PresentationSeries; setSeries(old => [...old.filter(row => row.id !== value.id), value]); setSeriesId(value.id); setSelectedId(null);
    } });
  }
  function open(slide: ReviewSlide, nextTab: InspectorTab = tab, nextField: SlideWordingField = 'skills_experience') {
    setSelectedId(slide.assignment_id); setTab(nextTab); setField(nextField);
    setWording(slide.fields[nextField] === 'Not provided' ? '' : slide.fields[nextField]); setAvailability(slide.source_fields.availability === 'Not provided' ? '' : slide.source_fields.availability);
    resetEdits(); setProposal(null); setSuggestionId(null);
  }
  function selectField(value: SlideWordingField) { setField(value); setWording(selected?.fields[value] === 'Not provided' ? '' : selected?.fields[value] ?? ''); resetEdits(); setProposal(null); }
  function saveWording(value = wording) { if (!selected) return; void send({ path: `/api/v1/assignments/${selected.assignment_id}`, init: mutation('PATCH', { row_version: selected.assignment_row_version, slide_wording: { [field]: value.trim() || null } }), label: 'Slide wording', accepted: () => { setProposal(null); } }); }
  function suggest() { if (!selected || !review) return; setSuggestionFingerprint(review.input_fingerprint); void send({ path: '/api/v1/ai-suggestions', init: mutation('POST', { workspace_id: workspaceId, capability: 'slide_shorten', target_type: 'assignment', target_id: selected.assignment_id, target_row_version: selected.assignment_row_version, field, instruction, source_text: selected.fields[field] }), label: 'Suggestion request', refresh: false, accepted: data => setSuggestionId((data as ReviewJobAccepted).resource_id) }); }
  async function applyProposal() { if (!proposal || !review || !selected || edited || locked || applyingRef.current || proposal.suggested_text === null) return;
    if (proposal.proposed_changes.length !== 1 || proposal.proposed_changes[0].field !== field || proposal.proposed_changes[0].old_value !== selected.fields[field]) { setProposal(null); setError('This proposal belongs to a different supplied field. Request it again.'); return; }
    const change: Intent = { path: `/api/v1/assignments/${selected.assignment_id}`, init: mutation('PATCH', { row_version: selected.assignment_row_version, slide_wording: { [field]: proposal.suggested_text }, ai_suggestion_id: proposal.id, expected_series_id: review.series_id, expected_input_fingerprint: suggestionFingerprint }), label: 'Slide wording', accepted: () => setProposal(null) };
    applyingRef.current = true; setApplying(true); setError('');
    try { const fresh = (await api<WorkspaceReview>(`/api/v1/workspaces/${workspaceId}/review?series_id=${seriesId}`, { signal: AbortSignal.timeout(30000) })).data;
      if (!alive.current) return;
      if (fresh.input_fingerprint !== suggestionFingerprint || proposal.target_row_version !== selected.assignment_row_version || proposal.target_id !== selected.assignment_id) { setProposal(null); setError('The reviewed source changed. Refresh the review and request a new suggestion.'); return; }
      await send(change);
    } catch (reason) { if (alive.current) setError(errorMessage(reason)); }
    finally { applyingRef.current = false; if (alive.current) setApplying(false); }
  }
  function measureFit() { if (review) void send({ path: `/api/v1/workspaces/${workspaceId}/review/fit`, init: mutation('POST', { series_id: seriesId, expected_input_fingerprint: review.input_fingerprint }), label: 'Layout check', refresh: false, accepted: data => setFitJob((data as ReviewJobAccepted).job_id) }); }

  // The stage: the server's checked draft, with the one unsaved inspector edit (or an unapplied suggestion) previewed on it.
  const previewEdit: ReviewPreviewEdit | null = !selected?.assignment_id ? null
    : proposal?.suggested_text != null && !edited ? { assignmentId: selected.assignment_id, field, wording: proposal.suggested_text, suggestion: true }
    : wordingDirty ? { assignmentId: selected.assignment_id, field, wording }
    : availabilityDirty ? { assignmentId: selected.assignment_id, availability } : null;
  const shown = useMemo(() => review && previewReview(review, previewEdit), [review, previewEdit?.assignmentId, previewEdit?.field, previewEdit?.wording, previewEdit?.availability]); // eslint-disable-line react-hooks/exhaustive-deps
  const stage = useStageDeck(shown);
  const pages = stage.deck?.pages ?? [];
  const found = pages.findIndex(page => page.key === stageKey);
  const [lastIndex, setLastIndex] = useState(0);
  const index = found >= 0 ? found : Math.min(lastIndex, Math.max(0, pages.length - 1));
  if (pages.length && index !== lastIndex) setLastIndex(index);
  const current = pages[index]?.slide ?? null;
  function moveTo(page: number | null) { if (page === null || !pages[page]) return; setStageKey(pages[page].key); }
  function stageIndex(next: number) {
    const page = pages[next]; if (!page) return; setStageKey(page.key); setMark(null);
    // The inspector follows the stage to another person, unless it holds an unsaved edit.
    if (selected && page.slide?.kind === 'candidate' && page.slide.assignment_id !== selected.assignment_id && !edited && !locked && !proposal && !suggestionId) open(page.slide);
  }
  function inspect(slide: ReviewSlide, nextTab: InspectorTab, nextField?: SlideWordingField) {
    open(slide, nextTab, nextField); moveTo(pageForSlide(pages, slide));
    requestAnimationFrame(() => document.getElementById('assignment-review-heading')?.focus());
  }
  function showIssue(issue: Issue) {
    if (!review) return; const slide = slideForIssue(review, issue); const page = pageForSlide(pages, slide);
    if (page === null) return; moveTo(page);
    setMark(issue.field ? { key: pages[page].key, field: issue.field, tone: issue.severity === 'blocking' ? 'overflow' : 'issue' } : null);
  }
  function fix(issue: Issue) {
    showIssue(issue); const slide = review && slideForIssue(review, issue);
    if (!slide || slide.kind !== 'candidate') return;
    const wordingField = slideWordingFields.includes(issue.field as SlideWordingField) ? issue.field as SlideWordingField : undefined;
    inspect(slide, issue.code === 'UNREVIEWED_PROFILE' ? 'facts' : ['MEDIA_UNAVAILABLE', 'FRAME_UNAVAILABLE', 'FEWER_FRAMES', 'NO_INTRODUCTION'].includes(issue.code) ? 'video' : wordingField ? 'wording' : 'facts', wordingField);
  }
  function fixOverflow(overflow: WorkspaceReview['fit']['overflows'][number]) {
    const page = pages[overflow.slide_index]; if (!page) return; moveTo(page.index);
    setMark({ key: page.key, field: overflow.field, tone: 'overflow' });
    const wordingField = slideWordingFields.includes(overflow.field as SlideWordingField) ? overflow.field as SlideWordingField : undefined;
    if (page.slide?.kind === 'candidate' && wordingField) inspect(page.slide, 'wording', wordingField);
  }

  const base = `/projects/${projectId}/casting/${workspaceId}`;
  function linkFor(issue: Issue): { href: string; label: string } | null {
    switch (issue.code) {
      case 'PROFILE_ARCHIVED': return issue.entity_id ? { href: `/library/cast/${issue.entity_id}`, label: 'Open profile' } : null;
      case 'MEDIA_UNAVAILABLE': case 'FRAME_UNAVAILABLE': case 'FEWER_FRAMES': case 'NO_INTRODUCTION': return { href: `${base}/cast`, label: 'Choose project material' };
      case 'OPEN_SLOT': case 'NO_MAIN': return { href: `${base}/organize`, label: 'Open Casting' };
      case 'ROLE_NEEDS_CLARIFICATION': case 'NO_REQUIREMENTS': return { href: `${base}/specs`, label: 'Open Specs' };
      case 'LOGO_UNAVAILABLE': return { href: `${base}/project`, label: 'Open Project branding' };
      default: return null;
    }
  }
  const selectedSeries = series.find(row => row.id === seriesId) ?? null;
  const blocking = review?.issues.filter(issue => issue.severity === 'blocking').length ?? 0;
  const notes = (review?.issues.length ?? 0) - blocking;
  const fitState = !review ? null : fitJob ? { tone: 'info', text: 'Measuring…' } : review.fit.status === 'measured' ? review.fit.overflows.length ? { tone: 'error', text: `${review.fit.overflows.length} overflow${review.fit.overflows.length === 1 ? '' : 's'}` } : { tone: 'ok', text: 'Fits' }
    : review.fit.status === 'failed' ? { tone: 'error', text: 'Measurement failed' } : { tone: 'warn', text: 'Not measured' };
  const groups = review ? CHECK_GROUPS.map(group => ({ ...group, issues: review.issues.filter(issue => checkGroup(issue) === group.key) })) : [];

  const panelBody = <div className="review-panel">
    {error && <ErrorNotice message={error} />}{notice && <p className="review-notice" role="status">{notice}</p>}
    {uncertain && <div className="notice" role="status"><p>Other changes stay locked until this request is confirmed.</p><button className="button" disabled={busy} onClick={() => { if (intent.current) void send(intent.current, true); }}>Retry same change</button></div>}
    <section className="panel-section" aria-labelledby="review-series-heading">
      <h3 id="review-series-heading" className="panel-eyebrow">Presentation series</h3>
      <fieldset className="review-context" disabled={locked || edited}><legend className="sr-only">Presentation context</legend>
        <label className="sr-only" htmlFor="review-series-choice">Saved series</label>
        <select id="review-series-choice" aria-label="Saved review series" value={seriesId} onChange={event => { setSeriesId(event.target.value); setReview(null); setSelectedId(null); setProposal(null); setSuggestionId(null); setFitJob(null); setStageKey('cover'); setMark(null); }}>
          <option value="">Choose or create a series</option>{series.map(row => <option key={row.id} value={row.id}>{row.title} · {row.audience_snapshot.label} · {templateName(row.template_version)}</option>)}</select>
        {selectedSeries && <p className="small muted">{outputName(selectedSeries.output_type)} · Audience: {selectedSeries.audience_snapshot.label} ({selectedSeries.audience_snapshot.scope === 'external' ? 'guests see shared feedback only' : 'internal only'}) · {templateName(selectedSeries.template_version)}</p>}
        <details className="review-new-series" open={!series.length || undefined}><summary>Create or reuse a series</summary>
          <div className="form-grid"><label>Output for a new series<select value={output} onChange={event => setOutput(event.target.value as typeof output)}><option value="selection">Cast Selection</option><option value="shortlist">Cast Shortlist</option></select></label><label>Audience for a new series<select value={presetId} onChange={event => setPresetId(event.target.value)}>{presets.map(row => <option key={row.id} value={row.id}>{row.label} · {row.scope}</option>)}</select></label></div>
          <p className="small muted">Output, audience and template are fixed per series. Changing the audience creates a separate series; an existing matching series is reused.</p>
          <button className="button" type="button" disabled={!canCreate || !presetId || loading} onClick={createSeries}>Create / reuse review series</button>{!canCreate && <p className="small">Creating a series requires presentation generation permission.</p>}
        </details>
      </fieldset>
    </section>
    {loading && !review ? <Loading label="Checking the draft…" /> : !review ? <div className="empty-state compact"><Icon name="checklist" /><h3>No review series selected</h3><p>Choose or create a saved series to check its casting output.</p></div> : <>
      <section className="panel-section review-checks" aria-labelledby="review-checks-heading">
        <header className="review-checks-head"><h3 id="review-checks-heading">Before generating</h3><span className={blocking ? 'review-gate review-gate-blocked' : 'review-gate'}>{blocking ? `${plural(blocking, 'check blocks', 'checks block')} generation` : 'Nothing here blocks generation'}</span></header>
        <p className="small muted review-server-line"><Icon name="lock" />Server check · revision {review.draft_revision} · {review.cover.title}</p>
        <p className="small review-counts">{plural(review.candidate_slide_count, 'candidate slide')} · {plural(review.pending_slide_count, 'Pending slot')}</p>
        {drift !== null && <div className="notice notice-warning" role="status"><p>The draft changed after this check (revision {review.draft_revision} → {drift}). The stage and checks show the checked revision.</p><button type="button" className="button button-small" disabled={locked || edited} onClick={reload}>Check again</button></div>}
        <p className="small muted">Missing facts, Unreviewed profiles, fewer frames and open slots are allowed and print as stated. Reviewed confirms facts; it does not approve casting.</p>
        {groups.map(group => {
          const isLayout = group.key === 'layout'; const count = group.issues.length + (isLayout ? review.fit.overflows.length : 0);
          if (!count && !isLayout) return null;
          const groupBlocking = group.issues.some(issue => issue.severity === 'blocking');
          const expanded = openGroups[group.key] ?? (groupBlocking || isLayout && !!review.fit.overflows.length);
          const tone = isLayout ? fitState!.tone : groupBlocking ? 'error' : group.issues.some(issue => issue.severity === 'warning') ? 'warn' : 'info';
          return <div key={group.key} className={`check-group check-group-${tone}`}>
            <h4><button type="button" className="check-group-toggle" aria-expanded={expanded} aria-controls={`check-group-${group.key}`} onClick={() => setOpenGroups(value => ({ ...value, [group.key]: !expanded }))}>
              <Icon name={tone === 'ok' ? 'check' : tone === 'info' ? 'info' : 'alert'} /><span className="check-group-title">{group.title}</span>
              {isLayout ? <span className={`pill pill-${fitState!.tone}`}>{fitState!.text}</span> : <span className={`pill pill-${tone}`}>{count}</span>}<Icon name="chevron-down" />
            </button></h4>
            <div id={`check-group-${group.key}`} className="check-group-body" hidden={!expanded}>
              <ul className="check-list">{group.issues.map((issue, n) => {
                const slide = slideForIssue(review, issue); const link = linkFor(issue);
                const title = slide ? slideTitle(slide) : issue.entity_id ? 'Workspace record' : 'This draft';
                const fixable = slide?.kind === 'candidate' && ['UNREVIEWED_PROFILE', 'MISSING_FIELD', 'LAYOUT_OVERFLOW', 'MISSING_FACTS'].includes(issue.code);
                return <li key={`${issue.code}:${n}`} className={`check-row check-row-${issue.severity}`}>
                  <button type="button" className="check-row-main" disabled={!slide} onClick={() => showIssue(issue)}>
                    <span className="check-row-title"><span className="sr-only">Show </span>{title}<span className="sr-only"> on the slide:</span>{issue.severity === 'blocking' && <span className="pill pill-error">Blocks generation</span>}</span>
                    <span className="check-row-detail">{issue.message}{issue.field && <> · {fitFieldLabel(issue.field)}</>}</span>
                    {issue.repair_action && <span className="check-row-detail muted">{issue.repair_action}</span>}
                  </button>
                  <span className="check-row-actions">
                    {isLayout && ['FIT_MEASUREMENT_REQUIRED', 'FIT_MEASUREMENT_FAILED'].includes(issue.code) ? <button type="button" className="button button-small" disabled={!canWrite || locked || edited || !!fitJob} onClick={measureFit}>{fitJob ? 'Measuring layout…' : issue.code === 'FIT_MEASUREMENT_FAILED' ? 'Retry layout measurement' : 'Measure layout now'}</button>
                      : fixable ? <button type="button" className="button button-small" disabled={locked || edited} aria-label={`Fix ${title}`} onClick={() => fix(issue)}>Fix</button>
                      : link ? <Link className="button button-small button-quiet" href={link.href}>{link.label}</Link> : null}
                  </span>
                </li>;
              })}
              {isLayout && review.fit.overflows.map((overflow, n) => { const page = pages[overflow.slide_index]; const title = `Slide ${overflow.slide_index + 1}${page ? ` · ${page.label}` : ''}`;
                return <li key={`overflow:${n}`} className="check-row check-row-blocking">
                  <button type="button" className="check-row-main" onClick={() => fixOverflow(overflow)}>
                    <span className="check-row-title"><span className="sr-only">Show </span>{title}<span className="sr-only"> on the slide:</span></span><span className="check-row-detail">{fitFieldLabel(overflow.field)} overflows by {Math.ceil(overflow.overflow_px)} px ({overflow.axis === 'vertical' ? 'height' : 'width'}). Shorten the wording or the source field.</span>
                  </button>
                  <span className="check-row-actions">{page?.slide?.kind === 'candidate' && slideWordingFields.includes(overflow.field as SlideWordingField) ? <button type="button" className="button button-small" disabled={locked || edited} aria-label={`Edit ${title}`} onClick={() => fixOverflow(overflow)}>Edit</button> : null}</span>
                </li>; })}
              </ul>
              {isLayout && <div className="check-group-foot"><p className="small muted">{review.fit.status === 'measured' ? review.fit.overflows.length ? 'Measured with the registered template and fonts. Repair the fields above, then measure again.' : 'Measured with the registered template and bundled fonts for this exact draft.' : review.fit.status === 'failed' ? 'Measurement failed. Retry after fixing the reported problem; the stage preview is not a measurement.' : 'Layout is measured by the server with the registered template before generation.'}</p>
                <button type="button" className="button button-small" disabled={!canWrite || locked || edited || !!fitJob} onClick={measureFit}>{fitJob ? 'Measuring layout…' : 'Check actual layout fit'}</button>{fitJob && <Link className="small" href={`/processing?job=${fitJob}`}>Open layout processing</Link>}</div>}
            </div>
          </div>;
        })}
        {!review.issues.length && !review.fit.overflows.length && <p className="review-clear"><Icon name="check" />No checks to report for this draft.</p>}
      </section>
    </>}
  </div>;
  const panelFooter = review ? <div className="review-foot"><p className="small"><strong>{plural(notes, 'note')} · {plural(blocking, 'blocker')}</strong><span className="muted"> · {review.can_generate ? 'ready for generation' : 'generation is not available yet'}</span></p>
    <div className="button-row"><Link className="button button-quiet" href={`${base}/organize`}>Back to Casting</Link><Link className={`button${review.can_generate ? ' button-primary' : ''}`} href={`${base}/presentations?series_id=${review.series_id}`}>Open Presentation</Link></div></div> : undefined;

  const highlight: StageHighlight | null = previewEdit && current?.assignment_id === previewEdit.assignmentId ? { field: previewEdit.field ?? 'availability', tone: 'edit' }
    : mark && pages[index]?.key === mark.key ? { field: mark.field, tone: mark.tone } : null;
  const chip: StageChip = previewEdit?.suggestion ? { tone: 'ok', text: 'Previewing suggestion · not saved' } : previewEdit ? { tone: 'ok', text: 'Previewing your unsaved edit' }
    : drift !== null ? { tone: 'warn', text: 'Draft changed since this check' } : { tone: 'lock', text: `Server-checked draft · revision ${review?.draft_revision ?? ''}` };
  const stageNode = !review ? <section className="live-stage live-stage-empty" aria-label="Slide preview" aria-busy={loading || undefined}>{loading ? <div className="stage-loading" role="status"><span className="stage-loading-slide" aria-hidden="true" /><p>Opening the checked draft…</p></div> : <div className="empty-state"><Icon name="slides" /><h2>Choose a presentation series</h2><p>The checked draft for the chosen series appears here.</p></div>}</section>
    : !stage.deck ? <section className="live-stage live-stage-empty" aria-label="Slide preview"><ErrorNotice message={stage.error || 'The checked draft could not be shown.'} /></section>
    : <DeckStage deck={stage.deck} rendered={stage.rendered} index={index} onIndex={stageIndex} chip={chip} highlight={highlight} busy={loading}
      meta={<>Slide {index + 1} of {pages.length}</>}
      tools={current?.kind === 'candidate' && current.assignment_id !== selectedId ? <button type="button" className="button button-small" disabled={locked || edited} onClick={() => inspect(current, 'facts')}>Review {current.slot_label}</button> : undefined}
      notices={stage.failed.length > 0 ? <p className="stage-note small"><Icon name="info" />{plural(stage.failed.length, 'image')} could not be opened for the preview.</p> : undefined}
      disclaimer={<>The content the server checked for revision {review.draft_revision}, in {templateName(review.template.version)}. Unsaved edits show only while previewed; layout fit is measured by the server.</>} />;

  const inspector = selected && <RightPanel title={<span id="assignment-review-heading" tabIndex={-1}>{selected.fields.name_or_id}</span>} subtitle={`${selected.role_name} · ${selected.slot_label} · ${selected.position ? selected.position[0].toUpperCase() + selected.position.slice(1) : 'Pending'}`} label="Assignment review"
    closeLabel="Close assignment" onClose={locked || edited ? undefined : () => { setSelectedId(null); setSuggestionId(null); setProposal(null); }}>
    <div className="inspector">
      <div className="segmented inspector-tabs" role="tablist" aria-label="Assignment review sections" onKeyDown={event => {
        const order: InspectorTab[] = ['facts', 'video', 'wording']; const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0; if (!step) return;
        event.preventDefault(); const next = order[(order.indexOf(tab) + step + order.length) % order.length]; setTab(next); requestAnimationFrame(() => document.getElementById(`inspector-tab-${next}`)?.focus());
      }}><SegmentIndicator />{([['facts', 'Facts'], ['video', 'Video & transcript'], ['wording', 'Wording']] as const).map(([key, label]) => <button key={key} type="button" role="tab" id={`inspector-tab-${key}`} aria-controls={`inspector-${key}`} aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} onClick={() => setTab(key)}>{label}</button>)}</div>
      <div id="inspector-facts" role="tabpanel" aria-labelledby="inspector-tab-facts" hidden={tab !== 'facts'} className="inspector-section">
        <div className="candidate-frames inspector-frames">{selected.frames.length ? selected.frames.map((frame, n) => <div className="candidate-frame" key={frame.asset_id}><CandidateFrameImage assetId={frame.asset_id} alt={`Selected frame ${n + 1} of ${selected.frames.length}`} /><span>{(frame.timestamp_ms / 1000).toFixed(2)}s</span></div>) : <p className="saved-no-image">Image not provided</p>}</div>
        <dl className="inspector-facts">{slideWordingFields.map(key => { const overridden = selected.fields[key] !== selected.source_fields[key];
          return <div key={key} className={selected.fields[key] === 'Not provided' ? 'is-missing' : undefined}><dt>{REVIEW_FIELD_LABELS[key]}</dt><dd dir="auto">{selected.fields[key]}</dd>{overridden && <span className="pill pill-info">Slide wording</span>}</div>; })}</dl>
        <p className="inspector-status">{selected.review_status === 'reviewed' ? <><Icon name="check" />Reviewed · supplied facts confirmed</> : <><Icon name="alert" />Unreviewed · facts not yet confirmed</>}</p>
        <div className="button-row">{actor.capabilities?.includes('cast.review') && <button className="button" disabled={locked || edited || selected.review_status === 'reviewed'} onClick={() => void send({ path: `/api/v1/candidates/${selected.candidate_id}/reviewed`, init: mutation('POST', { row_version: selected.candidate_row_version }), label: 'Factual confirmation' })}>Confirm supplied facts as Reviewed</button>}
          <Link className="button button-quiet" href={`/library/cast/${selected.candidate_id}`}>Open shared facts and source material</Link></div>
        <fieldset className="inspector-availability" disabled={!canWrite || locked || wordingDirty}><legend>Availability for this project</legend><label>Project availability<input value={availability} onChange={event => { setAvailability(event.target.value); setAvailabilityDirty(true); setSuggestionId(null); setSuggestionFingerprint(null); setProposal(null); }} maxLength={8000} /></label>
          <div className="button-row"><button className="button button-primary" disabled={!availabilityDirty} onClick={() => void send({ path: `/api/v1/workspace-candidates/${selected.workspace_candidate_id}`, init: mutation('PATCH', { row_version: selected.workspace_candidate_row_version, availability: availability.trim() || null }), label: 'Project availability' })}>Save project availability</button><button className="button" disabled={!availabilityDirty} onClick={() => { setAvailability(selected.source_fields.availability === 'Not provided' ? '' : selected.source_fields.availability); setAvailabilityDirty(false); }}>Discard availability edit</button></div></fieldset>
      </div>
      <div id="inspector-video" role="tabpanel" aria-labelledby="inspector-tab-video" hidden={tab !== 'video'} className="inspector-section">
        {tab === 'video' && <ReviewSource key={selected.candidate_media_id ?? selected.assignment_id!} slide={selected} />}
      </div>
      <div id="inspector-wording" role="tabpanel" aria-labelledby="inspector-tab-wording" hidden={tab !== 'wording'} className="inspector-section">
        <fieldset className="review-wording" disabled={!canWrite || locked || availabilityDirty}><legend className="sr-only">Presentation-only wording</legend>
          <label>Slide wording field<select aria-label="Slide wording field" value={field} disabled={edited || !!suggestionId} onChange={event => selectField(event.target.value as SlideWordingField)}>{slideWordingFields.map(key => <option key={key} value={key}>{REVIEW_FIELD_LABELS[key]}</option>)}</select></label>
          <p className="small inspector-source">Full source · <span dir="auto">{selected.source_fields[field]}</span></p>
          <label>Presentation wording<textarea aria-label="Presentation wording" value={wording} onChange={event => { setWording(event.target.value); setWordingDirty(true); setSuggestionId(null); setSuggestionFingerprint(null); setProposal(null); }} rows={4} maxLength={8000} /></label>
          <p className="small muted">An empty override inherits the full source. Keep supplied facts and qualifiers. Saving here does not change the library profile.</p>
          <div className="button-row"><button className="button button-primary" disabled={!wordingDirty} onClick={() => saveWording()}>Save slide wording</button><button className="button" disabled={!wordingDirty} onClick={() => selectField(field)}>Discard wording edit</button></div>
          <details className="inspector-instruction"><summary>Suggestion instruction</summary><label>Wording instruction<input value={instruction} disabled={!!suggestionId} maxLength={2000} onChange={event => setInstruction(event.target.value)} /></label></details>
          <button className="button" disabled={edited || !!suggestionId || selected.fields[field] === 'Not provided'} onClick={suggest}><Icon name="sparkle" />{suggestionId ? 'Preparing suggestion…' : 'Suggest shorter saved wording'}</button>
          {proposal && <div className="suggestion-card"><h4><Icon name="sparkle" />Suggested wording · not applied</h4><p dir="auto">{proposal.suggested_text}</p>{proposal.warnings.map((warning, n) => <p key={n} className="small">{warning.message}</p>)}
            <p className="small muted">The slide preview shows the suggestion. It is saved only when you apply it.</p>
            <div className="button-row"><button className="button" onClick={() => setProposal(null)}>Discard suggestion</button><button className="button button-primary" disabled={edited || locked} onClick={() => void applyProposal()}>Apply this suggestion</button></div></div>}
        </fieldset>
      </div>
    </div>
  </RightPanel>;

  return <PageFrame inline className="workspace-frame presentation-frame review-frame" right={inspector || undefined}
    panel={{ title: 'Review', subtitle: 'Check facts, images and layout', label: 'Review panel', wide: true, body: panelBody, footer: panelFooter,
      actions: <button type="button" className="icon-button icon-button-small" aria-label="Refresh review" title="Refresh review" disabled={locked || edited || loading} onClick={reload}><Icon name="refresh" /></button> }}>
    {stageNode}
  </PageFrame>;
}

function ReviewSource({ slide }: { slide: ReviewSlide }) {
  const [media, setMedia] = useState<CandidateMedia | null>(null); const [error, setError] = useState(''); const [video, setVideo] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => { if (!slide.candidate_media_id) return; let current = true; const controller = new AbortController();
    readCandidateMedia(slide.candidate_id!, { signal: controller.signal }).then(result => { if (current) { const source = result.data.find(row => row.id === slide.candidate_media_id); if (!source || source.source_asset_id !== slide.video_asset_id) throw new Error('The source introduction changed. Refresh the review.'); setError(''); setMedia(source); } }).catch(reason => { if (current) setError(errorMessage(reason)); });
    return () => { current = false; controller.abort(); };
  }, [slide.candidate_id, slide.candidate_media_id, slide.video_asset_id]);
  async function play() { setBusy(true); try { if (media) setVideo((await api<{ url: string }>(`/api/v1/media/${media.preview_asset_id ?? media.source_asset_id}/playback`, mutation('POST'))).data.url); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } }
  return <div className="review-source">{error && <ErrorNotice message={error} />}{!slide.candidate_media_id ? <p className="small muted">Source introduction not provided.</p> : !media ? !error && <Loading label="Loading source material…" /> : <>
    <div className="inspector-video">{video ? <video controls preload="metadata" className="candidate-video" src={video} onError={() => { setVideo(null); setError('Video access expired or the source is unavailable. Play it again to refresh access.'); }} /> : <button type="button" className="video-poster" disabled={busy} onClick={() => void play()}><Icon name="play" /><span>{busy ? 'Opening source video…' : 'Play source video'}</span></button>}</div>
    <h4 className="panel-eyebrow">English transcript</h4>
    <CandidateEnglishTranscript media={media} className="source-transcript" />
    <p className="small muted">Source material is shown separately from the checked review. Refresh the review after changing source material.</p>
  </>}</div>;
}
