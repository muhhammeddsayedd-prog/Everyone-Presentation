import assert from 'node:assert/strict';
import test from 'node:test';
import { presentationFixture, presentationVersionFixture } from '../fixtures/presentation.ts';
import { reviewFromPresentationVersion, reviewFromRenderSnapshot } from '../../packages/domain/src/presentation.ts';
import { renderRegisteredReviewDocument } from '../../packages/templates/src/registered.ts';
import { composeCastingDeck, editorialDateLabel } from '../../packages/templates/versions/1.2.0/compose-casting.ts';
import { renderPageMarkup } from '../../packages/templates/versions/1.2.0/html.ts';
import editorialRegistry from '../../packages/templates/versions/1.2.0/registry.json' with { type: 'json' };
import { editorialSnapshotOptions } from '../../apps/worker/src/editorial-template.ts';
import type { RenderSnapshot } from '../../packages/domain/src/presentation-types.ts';

// The saved-version viewer reads a version (GET /versions/{id}); the worker printed the same version from its frozen
// render snapshot. Both must yield one review and one page sequence, so the viewer never shows other content than the PDF.

function editorial(snapshot: RenderSnapshot): RenderSnapshot {
  const next = structuredClone(snapshot);
  next.template = { key: editorialRegistry.key, version: editorialRegistry.version, content_sha256: editorialRegistry.content_sha256, font_key: editorialRegistry.font_key,
    font_hashes: Object.fromEntries(editorialRegistry.fonts.map(font => [font.path, font.sha256])) };
  return next;
}

test('a saved 1.1.0 version gives the viewer the exact review and printed markup the worker produced', () => {
  const snapshot = presentationFixture({ frames: 2, logo: true }); const version = presentationVersionFixture(snapshot);
  const printed = reviewFromRenderSnapshot(snapshot); const viewed = reviewFromPresentationVersion(version, snapshot.workspace_id);
  assert.deepEqual(viewed, printed);
  const sources = Object.fromEntries(snapshot.asset_inventory.filter(asset => asset.asset_kind !== 'candidate_video').map(asset => [asset.asset_id, `data:image/png;base64,AAAA`]));
  const options = { imageSources: sources, versionLabel: `Version ${snapshot.version_no}` };
  assert.equal(renderRegisteredReviewDocument(viewed, options), renderRegisteredReviewDocument(printed, options));
});

test('a saved 1.2.0 version composes the same pages as the PDF, including the logo layout once its size is known', () => {
  for (const placement of ['cover', 'every_slide'] as const) {
    const snapshot = editorial(presentationFixture({ frames: 3, logo: true })); snapshot.cover.logo_placement = placement;
    if (placement === 'every_slide') snapshot.slides.forEach((slide, n) => { if (n > 0) slide.logo_asset_id = snapshot.cover.logo_asset_id; });
    const version = presentationVersionFixture(snapshot);
    const worker = editorialSnapshotOptions(snapshot);
    const printed = composeCastingDeck(reviewFromRenderSnapshot(snapshot), worker);
    // What the viewer composes after decoding the retained logo (its pixel size is the frozen inventory size).
    const logo = snapshot.asset_inventory.find(asset => asset.asset_id === snapshot.cover.logo_asset_id)!;
    const viewed = composeCastingDeck(reviewFromPresentationVersion(version, 'saved-version'), { versionLabel: `Version ${version.version_no}`, dateLabel: editorialDateLabel(version.created_at), logoNatural: [logo.width!, logo.height!] });
    assert.deepEqual(viewed, printed, placement);
    const imageSources = Object.fromEntries(snapshot.asset_inventory.map(asset => [asset.asset_id, 'data:image/png;base64,AAAA']));
    for (let index = 0; index < printed.pages.length; index++) assert.equal(renderPageMarkup(viewed, index, { imageSources }), renderPageMarkup(printed, index, { imageSources }));
    // Before the logo is decoded the page sequence and every text are already the PDF's; only the logo box may differ.
    const early = composeCastingDeck(reviewFromPresentationVersion(version, 'saved-version'), { versionLabel: `Version ${version.version_no}`, dateLabel: editorialDateLabel(version.created_at) });
    assert.deepEqual(early.pages.map(page => [page.layout, page.source_index]), printed.pages.map(page => [page.layout, page.source_index]));
    const texts = (deck: typeof printed) => deck.pages.map(page => page.elements.filter(element => element.kind === 'text').map(element => JSON.stringify(element)));
    assert.deepEqual(texts(early), texts(printed));
  }
});
