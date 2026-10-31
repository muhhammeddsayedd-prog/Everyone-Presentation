import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePublicCentral, environmentMetadata, createdEnvironmentMetadata } from './env-projection.mjs';

test('app publishable slot rejects privileged/legacy/foreign configuration before transfer', () => {
  const origin = 'https://pyibofyctwnqpvktepse.supabase.co';
  for (const key of ['sb_secret_synthetic_fixture', 'eyJ.synthetic.fixture', '', 'sb_publishable_short'])
    assert.throws(() => validatePublicCentral({ SUPABASE_URL: origin, SUPABASE_PUBLISHABLE_KEY: key }));
  assert.throws(() => validatePublicCentral({ SUPABASE_URL: 'https://foreign.invalid', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_fixture' }));
  validatePublicCentral({ SUPABASE_URL: origin, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_fixture' });
});
test('metadata refuses duplicate keys, duplicate/unknown targets, missing targets and unknown types', () => {
  const v = { key: 'EPS_REVIEW_GATEWAY_KEY', type: 'sensitive', target: ['production', 'preview'] };
  for (const values of [[v,v], [{...v,target:['production','production']}], [{...v,target:['unknown']}],
    [{...v,target:[]}], [{...v,type:'unknown'}], [{...v,target:undefined}]])
    assert.throws(() => environmentMetadata(values));
});
test('independent metadata comparison detects private plain downgrade or missing environment', () => {
  const expected = environmentMetadata([{ key:'EPS_REVIEW_GATEWAY_KEY',type:'sensitive',target:['preview','production'] }]);
  for (const v of [{ key:'EPS_REVIEW_GATEWAY_KEY',type:'plain',target:['preview','production'] },
    { key:'EPS_REVIEW_GATEWAY_KEY',type:'sensitive',target:['production'] }])
    assert.throws(() => assert.deepEqual(environmentMetadata([v]),expected));
});
test('projection discards response values and records only bounded metadata', () => {
  const source = [{key:'APP_ENV',type:'plain',target:['production','preview'],value:'synthetic-private-response-not-retained',id:'ignored'}];
  assert.deepEqual(environmentMetadata(source),[{key:'APP_ENV',type:'plain',target:['preview','production']}]);
});
test('observed provider single-created object and batch array preserve metadata; partial failure refuses success', () => {
  const v={key:'APP_ENV',type:'plain',target:['production','preview'],value:'staging'};
  assert.deepEqual(createdEnvironmentMetadata({created:v,failed:[]}),environmentMetadata([v]));
  assert.deepEqual(createdEnvironmentMetadata({created:[v],failed:[]}),environmentMetadata([v]));
  assert.throws(()=>createdEnvironmentMetadata({created:[v],failed:[{key:'FAILED_FIXTURE'}]}));
});
