import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CandidateProcessingIssues } from '../../apps/web/components/CandidateProcessingIssues';

test('frame review failure is actionable and distinct from an ordinary frame shortfall', () => {
  const markup = renderToStaticMarkup(createElement(CandidateProcessingIssues, { issues: ['FRAME_SELECTION_UNAVAILABLE'] }));
  assert.match(markup, /Automatic frame review was unavailable/);
  assert.match(markup, /choose.*source frames manually/);
  const shortfall = renderToStaticMarkup(createElement(CandidateProcessingIssues, { issues: ['INSUFFICIENT_FRAMES'] }));
  assert.doesNotMatch(shortfall, /was unavailable/);
  assert.match(shortfall, /Fewer than three frames/);
});
