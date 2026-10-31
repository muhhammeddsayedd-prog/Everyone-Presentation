"""Public sealed migration source QA only; no DB, process or provider calls."""
from pathlib import Path
import importlib.util
import json
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('source_trust_builder',HERE/'build_specs_submit_trust.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class MaterializationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.value=module.build(HERE.parents[2])

    def test_committed_manifest_is_exact_composed_closure_not_last_explicit_create_only(self):
        self.assertEqual(json.loads((HERE/'SPECS_SUBMIT_TRUST.json').read_text()),self.value)

    def test_both_exact_job_dto_forwards_and_capability_forward_have_sealed_predecessors(self):
        transforms=self.value['source_transforms']
        self.assertEqual([(t['function'],t['before_sha256'])for t in transforms],
          [('eps.jobs_dto',module.PRE_M05),('eps.jobs_dto',module.PRE_M06),('eps.has_capability',module.PRE_M07)])
        self.assertEqual(transforms[1]['after_sha256'],module.POST_M06)
        self.assertEqual(transforms[2]['after_sha256'],'f6cffbe4308b858e28d606fcb454ac7aa5c0dcce6ea6d7e8a47c827279358813')
        for migration in(module.M05,module.M06,module.M07):
            with self.assertRaises(ValueError):module.compose('synthetic untrusted predecessor',migration)

    def test_new_transitive_read_helpers_are_included_without_changing_write_trigger_boundary(self):
        self.assertEqual(len(self.value['functions']),49)
        names={f['name']for f in self.value['functions']}
        self.assertTrue({'eps.presentation_job_actions','eps.export_job_actions','eps.mcp_token_permits_capability',
          'public.eps_validate_own_oauth_session','eps.mcp_claim_uuid','eps.review_stage_can_write','eps.guest_link_live'}<=names)
        self.assertEqual(len(self.value['triggers']),4);self.assertEqual(len(self.value['tables']),10)
        self.assertFalse(self.value['external_call_tokens_found'])


if __name__=='__main__':unittest.main()
