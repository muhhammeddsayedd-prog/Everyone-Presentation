import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CandidateFrameImage } from '../../apps/web/components/CandidateFrameImage';
import { CandidateMediaEditor } from '../../apps/web/components/CandidateDetailView';
import type { CandidateMedia } from '@eps/domain';

test('full-size source preview uses the existing authenticated resource and an isolated new tab', () => {
  const markup = renderToStaticMarkup(createElement(CandidateFrameImage, { assetId: 'source/opaque?frame', alt: 'Video frame at 5.16 seconds' }));
  assert.match(markup, /href="\/api\/v1\/media\/source%2Fopaque%3Fframe\/content"/);
  assert.match(markup, /aria-label="View full-size frame: Video frame at 5\.16 seconds"/);
  assert.match(markup, /target="_blank"/);
  assert.match(markup, /rel="noreferrer noopener"/);
  assert.match(markup, />View full-size frame<\/a>/);
  assert.match(markup, /loading="lazy"/);
  assert.doesNotMatch(markup, /https?:\/\//);
});

test('a read-only profile can inspect original pixels without nesting navigation in a frame-selection label', () => {
  const media: CandidateMedia = {
    id: 'synthetic-media', candidate_id: 'synthetic-person', source_asset_id: 'synthetic-video', preview_asset_id: null,
    transcript_asset_id: null, original_transcript: null, languages: [], processing_issues: [], row_version: 1,
    available_frames: [{ asset_id: 'synthetic-frame', source_asset_id: 'synthetic-video', timestamp_ms: 5160, width: 853, height: 480, quality_flags: [] }],
    selected_frame_asset_ids: ['synthetic-frame'],
  };
  const markup = renderToStaticMarkup(createElement(CandidateMediaEditor, { media, canWrite: false, onSaved: async () => undefined, onDirtyChange: () => undefined }));
  assert.match(markup, /href="\/api\/v1\/media\/synthetic-frame\/content"/);
  assert.match(markup, /aria-label="Video frame at 5\.16 seconds"/);
  const labels = [...markup.matchAll(/<label\b[^>]*>[\s\S]*?<\/label>/gu)].map(match => match[0]);
  assert.equal(labels.length, 1);
  assert.match(labels[0], /type="checkbox"/);
  assert.doesNotMatch(labels[0], /<a\b/);
});
