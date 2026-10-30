'use client';

import Link from 'next/link';
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import type { AiSuggestion, AudiencePreset, CandidateMedia, PresentationSeries, ReviewJobAccepted, ReviewSlide, WorkspaceReview } from '@eps/domain';
import { slideWordingFields, type SlideWordingField } from '../../../packages/domain/src/casting-types.ts';
import { REVIEW_FIELD_LABELS } from '../../../packages/templates/src/render.ts';
import { PENDING_REQUIREMENT_LABELS } from '../../../packages/templates/versions/1.1.0/render.ts';
import { api, ApiError, errorMessage, mutation, type Actor, type Envelope } from './api';
import { ErrorNotice, Loading } from './Feedback';
import { CandidateFrameImage } from './CandidateFrameImage';
import { readCandidateMedia } from './candidate-pages';

interface Props { workspaceId: string; projectId: string; actor: Actor; initialOutput: 'selection' | 'shortlist'; requestedSeriesId?: string | null; onSeriesChanged?: (value: string) => void; onDirtyChange: (value: boolean) => void; onWorkspaceChanged: () => void }
interface Intent { path: string; init: RequestInit; label: string; refresh?: boolean; accepted?: (data: unknown) => void }
function fitFieldLabel(field: string) {
  const key = field.replace(/^requirements\./, '');
  return REVIEW_FIELD_LABELS[field as SlideWordingField] ?? PENDING_REQUIREMENT_LABELS[key as keyof typeof PENDING_REQUIREMENT_LABELS] ?? field;
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

export function WorkspaceReviewView(props: Props) { return <ReviewScope key={`${props.actor.id}:${props.workspaceId}`} {...props} />; }
function ReviewScope({ workspaceId, projectId, actor, initialOutput, requestedSeriesId, onSeriesChanged, onDirtyChange, onWorkspaceChanged }: Props) {
  const [series, setSeries] = useState<PresentationSeries[]>([]); const [presets, setPresets] = useState<AudiencePreset[]>([]);
  const [seriesId, setSeriesId] = useState(''); const [output, setOutput] = useState(initialOutput); const [presetId, setPresetId] = useState('');
  const [review, setReview] = useState<WorkspaceReview | null>(null); const [loading, setLoading] = useState(true); const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false); const [uncertain, setUncertain] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [field, setField] = useState<SlideWordingField>('skills_experience');
  const [wording, setWording] = useState(''); const [availability, setAvailability] = useState(''); const [wordingDirty, setWordingDirty] = useState(false); const [availabilityDirty, setAvailabilityDirty] = useState(false); const edited = wordingDirty || availabilityDirty;
  function resetEdits() { setWordingDirty(false); setAvailabilityDirty(false); }
  const [instruction, setInstruction] = useState('Shorten the supplied wording while preserving every stated fact and qualifier.');
  const [suggestionId, setSuggestionId] = useState<string | null>(null); const [proposal, setProposal] = useState<AiSuggestion | null>(null);
  const [suggestionFingerprint, setSuggestionFingerprint] = useState<string | null>(null); const [fitJob, setFitJob] = useState<string | null>(null);
  const [applying, setApplying] = useState(false); const applyingRef = useRef(false);
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
    setReview(value); setOutput(value.output_type); setError('');
  });
  useEffect(() => {
    const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]); let current = true;
    Promise.all([allRows<PresentationSeries>(`/api/v1/presentation-series?workspace_id=${encodeURIComponent(workspaceId)}`, signal), allRows<AudiencePreset>('/api/v1/audience-presets', signal)])
      .then(([choices, audiences]) => { if (!current) return;
        if (choices.some(row => row.workspace_id !== workspaceId)) throw new Error('The saved series belongs to a different workspace.');
        const active = choices.filter(row => !row.archived); const available = audiences.filter(row => !row.archived);
        if (requestedSeriesId && !active.some(row => row.id === requestedSeriesId)) throw new Error('The linked review series is unavailable in this workspace. Choose a review context from the workspace again.');
        setSeries(active); setPresets(available); setPresetId(value => available.some(row => row.id === value) ? value : available[0]?.id ?? '');
        setSeriesId(value => active.some(row => row.id === value) ? value : requestedSeriesId ?? active.find(row => row.output_type === initialOutput && row.template_version === '1.1.0')?.id ?? active.find(row => row.output_type === initialOutput)?.id ?? active[0]?.id ?? ''); setError('');
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
  function open(slide: ReviewSlide) { setSelectedId(slide.assignment_id); setField('skills_experience'); setWording(slide.fields.skills_experience === 'Not provided' ? '' : slide.fields.skills_experience); setAvailability(slide.source_fields.availability === 'Not provided' ? '' : slide.source_fields.availability); resetEdits(); setProposal(null); setSuggestionId(null); }
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
  const base = `/projects/${projectId}/casting/${workspaceId}`;
  return <section className="workspace-review" aria-busy={loading || busy}><header className="section-heading"><div><h2>Final review</h2><p>Choose the output, audience and registered template before reviewing the exact draft.</p></div><button className="button" disabled={locked || edited || loading} onClick={reload}>Refresh review</button></header>
    {error && <ErrorNotice message={error} />}{notice && <p role="status">{notice}</p>}{uncertain && <div className="notice" role="status"><p>Other changes stay locked until this request is confirmed.</p><button className="button" disabled={busy} onClick={() => { if (intent.current) void send(intent.current, true); }}>Retry same change</button></div>}
    <fieldset className="review-context" disabled={locked || edited}><legend>Presentation context</legend><label>Saved series<select aria-label="Saved review series" value={seriesId} onChange={event => { setSeriesId(event.target.value); setReview(null); setSelectedId(null); setProposal(null); setSuggestionId(null); setFitJob(null); }}><option value="">Choose or create a series</option>{series.map(row => <option key={row.id} value={row.id}>{row.title} · {row.output_type} · {row.audience_snapshot.label} / template {row.template_version}</option>)}</select></label><div className="form-grid"><label>Output for a new series<select value={output} onChange={event => setOutput(event.target.value as typeof output)}><option value="selection">Cast Selection</option><option value="shortlist">Cast Shortlist</option></select></label><label>Audience for a new series<select value={presetId} onChange={event => setPresetId(event.target.value)}>{presets.map(row => <option key={row.id} value={row.id}>{row.label} · {row.scope}</option>)}</select></label></div><p className="small muted">Everyone Casting {review?.template.version ?? 'current registered layout'} · registered layout and bundled fonts. Changing audience policy creates a separate series.</p><button className="button" disabled={!canCreate || !presetId || loading} onClick={createSeries}>Create / reuse review series</button>{!canCreate && <p className="small">Creating a series requires presentation generation permission.</p>}</fieldset>
    {loading ? <Loading /> : !review ? <p>Choose or create a saved series to review its casting output.</p> : <><div className="section-heading"><div><h3>{review.cover.title}</h3><p>{review.candidate_slide_count} candidate slide{review.candidate_slide_count === 1 ? '' : 's'} · {review.pending_slide_count} Pending slot{review.pending_slide_count === 1 ? '' : 's'}</p></div><span className="badge">Working draft · revision {review.draft_revision}</span></div>
      <section className="notice review-checks"><h3>Content and layout checks</h3><p>Missing facts, Unreviewed profiles, fewer frames and open slots remain permitted. Reviewed confirms facts; it does not approve casting.</p><p>Layout: {review.fit.status === 'measured' ? review.fit.overflows.length ? `${review.fit.overflows.length} fields need repair` : 'Measured with the registered template and fonts' : review.fit.status === 'failed' ? 'Measurement failed; retry after fixing the reported problem' : 'Not measured yet'}</p>
        <button className="button" disabled={!canWrite || locked || edited || !!fitJob} onClick={() => void send({ path: `/api/v1/workspaces/${workspaceId}/review/fit`, init: mutation('POST', { series_id: seriesId, expected_input_fingerprint: review.input_fingerprint }), label: 'Layout check', refresh: false, accepted: data => setFitJob((data as ReviewJobAccepted).job_id) })}>{fitJob ? 'Measuring layout…' : 'Check actual layout fit'}</button>{fitJob && <Link href={`/processing?job=${fitJob}`}>Open layout processing</Link>}
        {!!review.issues.length && <ul>{review.issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.message}{issue.repair_action && ` · ${issue.repair_action}`}</li>)}</ul>}
        {!!review.fit.overflows.length && <ul>{review.fit.overflows.map((issue, index) => <li key={index}>Page {issue.slide_index + 1} · {fitFieldLabel(issue.field)}: {Math.ceil(issue.overflow_px)}px {issue.axis} overflow. Edit wording or the source field.</li>)}</ul>}
      </section>
      <ol className="review-slides">{review.slides.map((slide, index) => <li key={slide.assignment_id ?? slide.slot_id ?? 'requirements-pending'}><div><span className="small muted">Slide {index + 2}</span><h3>{slide.role_name} · {slide.slot_label}</h3><p>{slide.kind === 'pending' ? 'Pending' : `${slide.fields.name_or_id} · ${slide.position} · ${slide.review_status === 'reviewed' ? 'Reviewed facts' : 'Unreviewed facts'}`}</p></div>{slide.kind === 'candidate' ? <button className="button" disabled={locked || edited} onClick={() => open(slide)} aria-label={`Review ${slide.slot_label}`}>Review assignment</button> : <p className="small">No assignment is included for this output. This slot gets a Pending page.</p>}</li>)}</ol>
      {selected && <section className="review-inspector" aria-labelledby="assignment-review-heading"><div className="section-heading"><div><h3 id="assignment-review-heading">Assignment review</h3><p>{selected.role_name} · {selected.slot_label}</p></div><button className="button" disabled={locked || edited} onClick={() => { setSelectedId(null); setSuggestionId(null); setProposal(null); }}>Close assignment</button></div>
        <div className="candidate-frames">{selected.frames.length ? selected.frames.map((frame, index) => <div className="candidate-frame" key={frame.asset_id}><CandidateFrameImage assetId={frame.asset_id} alt={`Selected frame ${index + 1} of ${selected.frames.length}`} /><span>{(frame.timestamp_ms / 1000).toFixed(2)}s</span></div>) : <p>Image not provided</p>}</div>
        <dl className="candidate-facts">{slideWordingFields.map(key => <div key={key}><dt>{REVIEW_FIELD_LABELS[key]}</dt><dd dir="auto">{selected.fields[key]}</dd></div>)}</dl>
        <p className="small muted">Full reusable facts remain separate from the presentation wording below.</p><div className="button-row"><Link className="button" href={`/library/cast/${selected.candidate_id}`}>Open shared facts and source material</Link>{actor.capabilities?.includes('cast.review') && <button className="button" disabled={locked || edited || selected.review_status === 'reviewed'} onClick={() => void send({ path: `/api/v1/candidates/${selected.candidate_id}/reviewed`, init: mutation('POST', { row_version: selected.candidate_row_version }), label: 'Factual confirmation' })}>Confirm supplied facts as Reviewed</button>}</div>
        <ReviewSource key={selected.candidate_media_id ?? selected.assignment_id!} slide={selected} />
        <fieldset className="review-wording" disabled={!canWrite || locked || availabilityDirty}><legend>Presentation-only wording</legend><label>Slide wording field<select aria-label="Slide wording field" value={field} disabled={edited || !!suggestionId} onChange={event => selectField(event.target.value as SlideWordingField)}>{slideWordingFields.map(key => <option key={key} value={key}>{REVIEW_FIELD_LABELS[key]}</option>)}</select></label><p className="small">Full source: <span dir="auto">{selected.source_fields[field]}</span></p><label>Presentation wording<textarea aria-label="Presentation wording" value={wording} onChange={event => { setWording(event.target.value); setWordingDirty(true); setSuggestionId(null); setSuggestionFingerprint(null); setProposal(null); }} rows={4} maxLength={8000} /></label><p className="small muted">An empty override inherits the full source. Keep supplied facts and qualifiers. Saving here does not shorten the library profile.</p><div className="button-row"><button className="button button-primary" disabled={!wordingDirty} onClick={() => saveWording()}>Save slide wording</button><button className="button" disabled={!wordingDirty} onClick={() => selectField(field)}>Discard wording edit</button></div>
          <label>Wording instruction<input value={instruction} disabled={!!suggestionId} maxLength={2000} onChange={event => setInstruction(event.target.value)} /></label><button className="button" disabled={edited || !!suggestionId || selected.fields[field] === 'Not provided'} onClick={suggest}>{suggestionId ? 'Preparing suggestion…' : 'Suggest shorter saved wording'}</button>
          {proposal && <div className="notice"><h4>Suggested wording · not applied</h4><p dir="auto">{proposal.suggested_text}</p>{proposal.warnings.map((warning, index) => <p key={index}>{warning.message}</p>)}<div className="button-row"><button className="button" disabled={edited || locked} onClick={() => void applyProposal()}>Apply this suggestion</button><button className="button" onClick={() => setProposal(null)}>Discard suggestion</button></div></div>}
        </fieldset>
        <fieldset disabled={!canWrite || locked || wordingDirty}><legend>Availability for this project</legend><label>Project availability<input value={availability} onChange={event => { setAvailability(event.target.value); setAvailabilityDirty(true); setSuggestionId(null); setSuggestionFingerprint(null); setProposal(null); }} maxLength={8000} /></label><button className="button" disabled={!availabilityDirty} onClick={() => void send({ path: `/api/v1/workspace-candidates/${selected.workspace_candidate_id}`, init: mutation('PATCH', { row_version: selected.workspace_candidate_row_version, availability: availability.trim() || null }), label: 'Project availability' })}>Save project availability</button><button className="button" disabled={!availabilityDirty} onClick={() => { setAvailability(selected.source_fields.availability === 'Not provided' ? '' : selected.source_fields.availability); setAvailabilityDirty(false); }}>Discard availability edit</button></fieldset>
      </section>}
      <footer className="workspace-footer"><Link className="button" href={`${base}/organize`}>Back to Casting</Link><p className="small">{review.can_generate ? 'Review inputs and measured layout are ready for generation.' : 'Review the reported content and technical checks before generation.'}</p><Link className="button" href={`${base}/presentations?series_id=${review.series_id}`}>Open Presentation</Link></footer>
    </>}
  </section>;
}

function ReviewSource({ slide }: { slide: ReviewSlide }) {
  const [open, setOpen] = useState(false); const [media, setMedia] = useState<CandidateMedia | null>(null); const [error, setError] = useState(''); const [video, setVideo] = useState<string | null>(null);
  useEffect(() => { if (!open || !slide.candidate_media_id) return; let current = true; const controller = new AbortController();
    readCandidateMedia(slide.candidate_id!, { signal: controller.signal }).then(result => { if (current) { const source = result.data.find(row => row.id === slide.candidate_media_id); if (!source || source.source_asset_id !== slide.video_asset_id) throw new Error('The source introduction changed. Refresh the review.'); setError(''); setMedia(source); } }).catch(reason => { if (current) setError(errorMessage(reason)); });
    return () => { current = false; controller.abort(); };
  }, [open, slide.candidate_id, slide.candidate_media_id, slide.video_asset_id]);
  async function play() { try { if (media) setVideo((await api<{ url: string }>(`/api/v1/media/${media.preview_asset_id ?? media.source_asset_id}/playback`, mutation('POST'))).data.url); } catch (reason) { setError(errorMessage(reason)); } }
  return <details className="review-source" onToggle={event => setOpen(event.currentTarget.open)}><summary>Original transcript and video</summary>{error && <ErrorNotice message={error} />}{!slide.candidate_media_id ? <p>Source introduction not provided.</p> : !media ? !error && <p>Loading source material…</p> : <><p className="small">Source material is shown separately from the frozen review projection. Refresh review after making source changes.</p><pre dir="auto" className="source-transcript">{media.original_transcript ?? 'Transcript not provided'}</pre><button className="button" onClick={() => void play()}>Play source video</button>{video && <video controls preload="metadata" className="candidate-video" src={video} />}</>}</details>;
}
