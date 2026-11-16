// Renders the synthetic Floward-structured 1.4.0 deck through the worker's actual PDF path (Chromium,
// renderPresentationPdf + validatePresentationPdf) into .local/cycle7/visual/out/deck.pdf.
// Run from the repository root: npx tsx development/cycle7/visual/render-1-4.mts
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderPresentationPdf, validatePresentationPdf } from '../../../apps/worker/src/presentation-pdf.ts';
import { floward } from '../../../tests/fixtures/reference-review.ts';
import { referenceSnapshot } from '../../../tests/fixtures/reference-snapshot.ts';

const { snapshot, images } = referenceSnapshot(floward(), 3);
const rendered = await renderPresentationPdf(snapshot, images);
const validated = await validatePresentationPdf(snapshot, images, rendered.bytes);
mkdirSync('.local/cycle7/visual/out', { recursive: true });
writeFileSync('.local/cycle7/visual/out/deck.pdf', rendered.bytes);
console.log(JSON.stringify({ render: rendered.proof, validation: validated }));
