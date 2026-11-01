import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRaceResource } from './concurrency.mjs';

test('independent race cleanup refuses a wrong resource ID, name, image or ownership label', () => {
  const expected = { id: 'owned-id', name: 'eps-c39-synthetic-db', image: 'sha256:synthetic', labels: { 'eps.project39.run': 'synthetic', 'eps.project39.purpose': 'independent-race39' } };
  const actual = { Id: expected.id, Name: '/' + expected.name, Image: expected.image, Config: { Labels: expected.labels } };
  assert.doesNotThrow(() => assertRaceResource(actual, expected));
  for (const change of [{ Id: 'other' }, { Name: '/other' }, { Image: 'other' }, { Config: { Labels: {} } }]) assert.throws(() => assertRaceResource({ ...actual, ...change }, expected));
});
