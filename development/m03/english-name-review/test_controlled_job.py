"""Synthetic parser/binding/privacy tests; no SQL/provider execution."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('controlled', Path(__file__).with_name('inspect-controlled-job.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def sample():
    plan = {'job_id':'11111111-1111-4111-8111-111111111111','candidate_media_id':'22222222-2222-4222-8222-222222222222',
            'source_asset_id':'33333333-3333-4333-8333-333333333333','source_sha256':module.lookup.SOURCE_SHA}
    raw, english = 'اسمي كريم وعمري عشرون سنة.', 'My name is Karim, and I am twenty years old.'
    source = {
        'candidate_id':'44444444-4444-4444-8444-444444444444','candidate_media_id':plan['candidate_media_id'],'source_job_id':plan['job_id'],
        'source_asset_id':plan['source_asset_id'],'source_sha256':plan['source_sha256'],'job_input_hash':'a'*64,'job_status':'succeeded',
        'frozen_english_version':'1.0','frozen_extraction_model':'gpt-fixture','job_result_candidate_bound':True,'raw_stage_equal':True,
        'english_stage_equal':True,'extraction_schema':'candidate-extraction-stage.v2','original_text':raw,'english_text':english,
        'english_status':'available','english_source_hash':module.lookup.sha(raw.encode()),'english_input_hash':'a'*64,
        'english_metadata':[{'provider':'openai','task':'transcript_english','sdk_version':'7.45.1','requested_model':'gpt-fixture',
                             'resolved_model':'gpt-fixture','request_id':'req_fixture','response_id':'resp_fixture','prompt_version':'transcript-english.v1',
                             'input_sha256':'b'*64,'usage':{'input_tokens':1,'output_tokens':2,'total_tokens':3}}],
    }
    payload = [{'controlled_english_observation':{'database':'postgres','operator':'postgres','history_count':34,'match_count':1,'source':source,
                    'preservation_count':1,'preservation':{'reviewed_facts_preserved':True,'retained_raw_preserved':True,'retained_legacy_cohort_preserved':True}}}]
    return plan, payload


class ControlledJobObservationTests(unittest.TestCase):
    def test_valid_persisted_stage_hash_bindings_and_reviewed_preservation(self):
        plan, payload = sample()
        _, checks = module.summary(payload, plan)
        self.assertTrue(all(checks.values()))
        self.assertNotIn('كريم', str(checks))
        self.assertNotIn('Karim', str(checks))

    def test_other_job_or_ambiguous_match_is_refused(self):
        plan, payload = sample()
        payload[0]['controlled_english_observation']['source']['source_job_id'] = '55555555-5555-4555-8555-555555555555'
        with self.assertRaises(ValueError):
            module.summary(payload, plan)
        plan, payload = sample()
        payload[0]['controlled_english_observation']['match_count'] = 2
        with self.assertRaises(ValueError):
            module.summary(payload, plan)

    def test_unbound_english_or_changed_reviewed_facts_fail_without_mutating_payload(self):
        plan, payload = sample()
        payload[0]['controlled_english_observation']['source']['english_source_hash'] = 'c'*64
        payload[0]['controlled_english_observation']['preservation']['reviewed_facts_preserved'] = False
        before = copy.deepcopy(payload)
        _, checks = module.summary(payload, plan)
        self.assertFalse(checks['english_source_sha_matches_exact_raw'])
        self.assertFalse(checks['reviewed_facts_preserved'])
        self.assertEqual(payload, before)

    def test_raw_script_fallback_fails_and_untrusted_metadata_payload_is_refused(self):
        plan, payload = sample()
        source = payload[0]['controlled_english_observation']['source']
        source['english_text'] = source['original_text']
        _, checks = module.summary(payload, plan)
        self.assertFalse(checks['english_has_latin_letters_only'])
        source['english_metadata'][0]['private_transcript'] = 'never emit this provider extra'
        with self.assertRaises(ValueError):
            module.summary(payload, plan)

    def test_wrong_fixed_metadata_label_is_refused_before_publication(self):
        plan, payload = sample()
        payload[0]['controlled_english_observation']['source']['english_metadata'][0]['provider'] = 'untrusted private value'
        with self.assertRaises(ValueError):
            module.summary(payload, plan)

    def test_source_name_and_owner_name_equality_is_not_a_persistence_gate(self):
        plan, payload = sample()
        _, checks = module.summary(payload, plan)
        self.assertFalse(any('name' in key for key in checks))
        self.assertTrue(all(checks.values()))

    def test_sql_has_no_mutations_and_rejects_uuid_injection(self):
        plan, _ = sample()
        sql = module.sql_for(plan, {'original_sha256':'d'*64}, {'reviewed_facts_fingerprint':'e'*64,'candidate_row_version':3})
        self.assertTrue(sql.startswith('begin read only;'))
        self.assertTrue(sql.rstrip().endswith('rollback;'))
        self.assertIn('eps.cast_is_reviewed(c)', sql)
        self.assertNotRegex(sql, r'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b')
        plan['job_id'] = "x'; delete from eps.jobs; --"
        with self.assertRaises(ValueError):
            module.sql_for(plan, {'original_sha256':'d'*64}, {'reviewed_facts_fingerprint':'e'*64,'candidate_row_version':3})


if __name__ == '__main__':
    unittest.main()
