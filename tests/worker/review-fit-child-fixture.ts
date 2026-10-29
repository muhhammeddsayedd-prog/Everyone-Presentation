import assert from 'node:assert/strict';
import process from 'node:process';
import { measureReviewFit } from '../../apps/worker/src/review-fit.ts';
import { fitReview } from './review-fit-fixture.ts';

// Synthetic-only fixture child: never constructs a gateway or reads private
// configuration. It exercises the real browser under the launcher's OS scope.
assert.equal(process.env.NODE_ENV, 'production'); assert.equal(process.env.PATH, '');
assert.equal(process.env.PLAYWRIGHT_BROWSERS_PATH, undefined); assert.equal(process.env.N8N_API_KEY, undefined);
void measureReviewFit(fitReview()).then(proof => process.stdout.write(JSON.stringify(proof))).catch(() => {
  process.stderr.write('Synthetic scrubbed native measurement failed.'); process.exitCode = 1;
});
