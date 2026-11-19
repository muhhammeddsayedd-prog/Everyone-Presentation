'use client';

import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { CURRENT_TEMPLATE, isCurrentTemplate, templateName } from './template-names';
import { deckAssetIds, useEditorialAssets, type AssetFetch, type LoadedAsset } from '../EditorialSlide';
import { photoPortraitIds, workspaceMediaFetch } from './useStageDeck';
import { ErrorNotice } from '../Feedback';
import { Icon } from '../Icon';
import { buildDraftReview, focusFor, supportedTemplate, type DraftContext } from './draft-review';
import { pageForFocus, pageForScene, stageDeck, type StageDeck } from './stage-pages';
import { useRenderedDeck } from './StageSlide';
import { DeckStage, type StageChip } from './DeckStage';
import { useWorkspaceDraft } from './WorkspaceDraftProvider';

const NO_ASSETS: Record<string, LoadedAsset> = {};
/** Templates the live stage draws: the current one and the earlier slot-page template. */
const STAGE_TEMPLATES: readonly string[] = ['1.4.1', '1.4.0', '1.3.0'];
const outputTitle = (output: 'selection' | 'shortlist') => output === 'selection' ? 'Cast Selection' : 'Cast Shortlist';
const fetchMedia: AssetFetch = (id, signal) => fetch(`/api/v1/media/${encodeURIComponent(id)}/content`, { cache: 'no-store', signal, headers: { Accept: 'image/*' } });

/** The working draft on a live stage: the same registered template and markup generation prints, recomputed in the
 * browser from saved records plus unsaved panel edits. It is a preview — checks, fit and the saved PDF come from the server. */
export function LiveStage() {
  const draft = useWorkspaceDraft();
  const [choice, setChoice] = useState<string>('auto');
  const output = draft?.output ?? 'selection';
  // The draft is drawn in the selected series' own template (1.3.0, 1.4.0 or 1.4.1); without a series, in the Studio default
  // when it is one of those, else in the current template. The Standard/Scene view never changes the composition.
  const series = useMemo(() => (draft?.series ?? []).filter(row => row.output_type === output && STAGE_TEMPLATES.includes(row.template_version) && supportedTemplate(row.template_version)), [draft?.series, output]);
  const chosen = choice === 'default' ? null : series.find(row => row.id === choice) ?? (choice === 'auto' ? series.find(row => isCurrentTemplate(row.template_version)) ?? series[0] ?? null : null);
  const defaultTemplate = draft?.defaultTemplate ?? null;
  const templateVersion = chosen?.template_version ?? (defaultTemplate && STAGE_TEMPLATES.includes(defaultTemplate) ? defaultTemplate : CURRENT_TEMPLATE); const title = chosen?.title ?? outputTitle(output);
  const coverNote = chosen?.cover_note ?? null;

  // Typing never waits for the deck: on very large drafts the slide catches up a frame later.
  const source = draft?.source ?? null; const overlay = useDeferredValue(draft?.overlay); const profilesReadable = draft?.profilesReadable ?? false;
  const built = useMemo(() => {
    if (!source || !overlay) return null;
    const context: DraftContext = { output, title, templateVersion, coverNote };
    try { const result = buildDraftReview(source, overlay, context); return { deck: stageDeck(result.review), notes: result.notes, error: '' }; }
    catch (reason) { return { deck: null, notes: [], error: reason instanceof Error && reason.message === 'DRAFT_PROFILE_UNAVAILABLE' ? (profilesReadable ? 'A profile on this draft could not be read.' : 'Showing people on slides needs Cast Library access.') : 'An edit is not consistent yet (for example, a record changed elsewhere).' }; }
  }, [source, overlay, profilesReadable, output, title, templateVersion, coverNote]);
  // Keep the last consistent deck on screen while an intermediate edit or refresh cannot be projected.
  const [good, setGood] = useState<StageDeck | null>(null);
  if (built?.deck && built.deck !== good) setGood(built.deck);
  const deck = built?.deck ?? good;

  if (!draft?.enabled) return <section className="live-stage live-stage-empty" aria-label="Slide preview"><div className="empty-state"><Icon name="slides" /><h2>Live preview needs the central connection</h2><p>Sign in to the connected Studio to see this workspace as slides.</p></div></section>;
  if (!deck) return <section className="live-stage live-stage-empty" aria-label="Slide preview" aria-busy={draft.status === 'loading'}>
    {draft.status === 'error' ? <ErrorNotice message={`The live preview could not be opened. ${draft.error}`} retry={() => draft.refresh(true)} />
      : built?.error ? <ErrorNotice message={`Preview paused. ${built.error}`} retry={() => draft.refresh(true)} />
      : <div className="stage-loading" role="status"><span className="stage-loading-slide" aria-hidden="true" /><p>Opening the live preview…</p></div>}
  </section>;
  const pendingDefault = !series.length && defaultTemplate !== null && !isCurrentTemplate(defaultTemplate);
  return <StageView deck={deck} paused={built?.error ?? ''} notes={built?.notes ?? []} choice={chosen?.id ?? 'default'} onChoice={setChoice}
    seriesOptions={series.map(row => ({ id: row.id, label: `${row.title} · ${row.audience_snapshot.label}${isCurrentTemplate(row.template_version) ? '' : ` · ${row.template_version}`}` }))}
    previewOnly={pendingDefault ? `The Studio default is still ${templateName(defaultTemplate)}. Generating with ${templateName(CURRENT_TEMPLATE)} starts once a Studio manager selects it in Settings.` : ''}
    defaultLabel={`No saved series · Everyone Film Editorial ${defaultTemplate && STAGE_TEMPLATES.includes(defaultTemplate) ? defaultTemplate : CURRENT_TEMPLATE}`} />;
}

interface StageViewProps { deck: StageDeck; paused: string; notes: string[]; previewOnly?: string; choice: string; onChoice: (value: string) => void; seriesOptions: { id: string; label: string }[]; defaultLabel: string }
function StageView({ deck, paused, notes, previewOnly, choice, onChoice, seriesOptions, defaultLabel }: StageViewProps) {
  const draft = useWorkspaceDraft()!;
  const ids = useMemo(() => 'deck' in deck ? [...new Set(deckAssetIds(deck.deck))].sort() : [], [deck]);
  const photoKey = useMemo(() => [...photoPortraitIds(deck)].sort().join(','), [deck]);
  const fetcher = useMemo(() => workspaceMediaFetch(new Set(photoKey ? photoKey.split(',') : []), fetchMedia), [photoKey]);
  const { assets, failed } = useEditorialAssets(ids, fetcher);
  const rendered = useRenderedDeck(deck, 'deck' in deck ? assets : NO_ASSETS);
  const [currentKey, setCurrentKey] = useState('cover');
  const found = deck.pages.findIndex(page => page.key === currentKey);
  const [lastIndex, setLastIndex] = useState(0);
  const index = found >= 0 ? found : Math.min(lastIndex, deck.pages.length - 1);
  if (index !== lastIndex) setLastIndex(index);
  const page = deck.pages[index];
  const selection = draft.selection;
  // Panel → stage: bring the record's slide into view (once per selection; a record without a slide leaves the stage alone).
  const [followed, setFollowed] = useState(0);
  if (selection && selection.from === 'panel' && selection.seq !== followed) {
    const target = pageForFocus(deck.pages, selection.target);
    setFollowed(selection.seq); if (target !== null && deck.pages[target].key !== currentKey) setCurrentKey(deck.pages[target].key);
  }
  // Scene breakdown → stage: open the selected scene's first page (its divider, or the first cast page it prints). Only
  // the page changes, never the composition; clearing the focus keeps the current page. A scene with no page yet (for
  // example a proposal) is followed once it prints.
  const [followedScene, setFollowedScene] = useState<string | null>(null);
  const sceneFocus = draft.sceneFocus;
  if (sceneFocus !== followedScene) {
    const target = sceneFocus ? pageForScene(deck, sceneFocus, draft.source?.scenes) : null;
    if (!sceneFocus || target !== null) { setFollowedScene(sceneFocus); if (target !== null && deck.pages[target].key !== currentKey) setCurrentKey(deck.pages[target].key); }
  }
  const go = useCallback((next: number) => {
    const target = deck.pages[next]; if (!target) return;
    const slide = target.slide;
    setCurrentKey(target.key); draft.select(focusFor(slide), 'stage', null, slide ? [slide.workspace_candidate_id && `pool:${slide.workspace_candidate_id}`, slide.slot_id && `slot:${slide.slot_id}`, slide.role_id && `role:${slide.role_id}`].filter((key): key is string => Boolean(key)) : []);
  }, [deck.pages, draft]);
  const highlight = selection?.from === 'panel' && selection.field && page && (page.kind === 'detail' || page.kind === 'pending' || page.kind === 'cover') && pageForFocus(deck.pages, selection.target) === index ? selection.field : null;
  const overlayCount = Object.keys(draft.overlay).length;
  const chip: StageChip = paused ? { tone: 'warn', text: 'Preview paused · showing the last consistent draft' } : draft.refreshing ? { tone: 'info', text: 'Updating from saved changes…' }
    : overlayCount ? { tone: 'ok', text: 'Live preview · includes unsaved edits' } : { tone: 'ok', text: 'Live preview · updates as you edit' };
  return <DeckStage deck={deck} rendered={rendered} index={index} onIndex={go} chip={chip} highlight={highlight ? { field: highlight, tone: 'edit' } : null}
    meta={<>Working draft · Slide {index + 1} of {deck.pages.length}</>}
    tools={<label className="stage-template"><span className="sr-only">Preview as</span><select aria-label="Preview as" value={choice} onChange={event => onChoice(event.target.value)}>
      {choice === 'default' && <option value="default">{defaultLabel}</option>}{seriesOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}{choice !== 'default' && <option value="default">{defaultLabel}</option>}</select></label>}
    notices={<>
      {previewOnly && <p className="stage-note small" role="note"><Icon name="info" />{previewOnly}</p>}
      {paused && <div className="notice notice-warning stage-notice" role="status"><p><strong>Preview paused.</strong> {paused} Your edits are kept; save or reload to continue.</p><button className="button button-small" type="button" onClick={() => draft.refresh(true)}>Reload preview</button></div>}
      {draft.stale && <div className="notice stage-notice"><p>{draft.stale}</p><button className="button button-small" type="button" disabled={draft.refreshing} onClick={() => draft.refresh(true)}>Retry</button></div>}
      {(failed.length > 0 || notes.includes('frames')) && <p className="stage-note small"><Icon name="info" />{failed.length > 0 ? `${failed.length} image${failed.length === 1 ? '' : 's'} could not be opened for the preview. ` : ''}{notes.includes('frames') ? 'Frames that are not part of the selected introduction are left out, as generation would.' : ''}</p>}
    </>}
    disclaimer={<>Draft preview in {deck.template === '1.3.0' || deck.template === '1.4.0' || deck.template === '1.4.1' ? `Everyone Film Editorial ${deck.template}` : templateName(deck.template)}, recomputed from saved records and your unsaved edits. Checks, layout fit and the saved PDF come from Review.</>} />;
}
