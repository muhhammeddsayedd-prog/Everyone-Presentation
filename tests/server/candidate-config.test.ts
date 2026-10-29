import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { readCentralCandidateOptions } from '../../apps/web/lib/candidate-config.ts';

const base = { CENTRAL_CANDIDATE_UPLOADS_ENABLED:'true', CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES:'52428800',
  SUPABASE_URL:'https://synthetic.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic-test-key' };

test('central candidate uploads require an explicit positive verified environment limit within the technical bound', () => {
  assert.equal(readCentralCandidateOptions({}), undefined);
  assert.equal(readCentralCandidateOptions({ ...base, CENTRAL_CANDIDATE_UPLOADS_ENABLED:'false' }), undefined);
  assert.deepEqual(readCentralCandidateOptions(base), {storageOrigin:base.SUPABASE_URL,maximumBytes:52428800});
  for (const changed of [{CENTRAL_CANDIDATE_UPLOADS_ENABLED:'enabled'}, ...[undefined,'','0','-1','50MiB','52428800.5','0268435456','268435457'].map(value=>({CENTRAL_CANDIDATE_MAXIMUM_UPLOAD_BYTES:value}))]) {
    assert.throws(()=>readCentralCandidateOptions({...base,...changed}),error=>error instanceof DomainError&&error.code==='CANDIDATE_STORAGE_CONFIGURATION_REQUIRED');
  }
});
