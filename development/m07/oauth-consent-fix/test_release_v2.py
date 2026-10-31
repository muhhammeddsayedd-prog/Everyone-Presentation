"""Controlled V2 release negatives; original V1 test bytes are in source-history."""
from pathlib import Path
import copy
import importlib.util
import unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('prior_v2_negative_cases',HERE/'test_release.py')
prior=importlib.util.module_from_spec(spec);spec.loader.exec_module(prior)
release=prior.release

class V2ReleaseTests(prior.ReleaseTests):
 def test_bridge_body_owner_config_or_acl_failure_rejects_after(self):
  before=prior.before();after=copy.deepcopy(before);after['catalogue']=release.expected_after_catalogue(before['catalogue']);after['new_objects']=dict.fromkeys(('role','table','claim','finish'),True);after['security']=dict.fromkeys(release.SECURITY_CHECKS,True)
  for key in ['bridge_definition','bridge_acl','bridge_guard_executable','no_direct_managed_oauth_reads']:
   with self.subTest(check=key):
    value=copy.deepcopy(after);value['security'][key]=False
    with self.assertRaises(ValueError):release.check_after(value,before)
 def test_exact_seven_column_coordinator_grants_and_frozen_originals(self):
  self.assertEqual(sum(map(len,release.COLUMNS.values())),7)
  self.assertEqual(release.COLUMNS[('auth','oauth_authorizations')],set());self.assertEqual(release.COLUMNS[('auth','oauth_clients')],set())
  pins=release.sources();self.assertEqual(pins['development/m07/oauth-consent-fix/source-history/c308fce9-migration.sql'],'c308fce98dbe536ab5d2eb78fdb9d8d737ba66999727e31d9bb8e1910441a07d')
  self.assertEqual(pins['.local/m07-oauth-consent-release/apply.sql'],'7247ce8daa5fcd2318e59663836dc73d55ba51a3a8f0be55ceada9b0b4672fb1')
 def test_separate_claim_namespace_and_pinned_bridge_definition(self):
  self.assertEqual(release.PRIVATE.name,'m07-oauth-consent-release-v2')
  self.assertEqual(release.CLAIM.parent,release.PRIVATE)
  sql=release.render(prior.before(),'60000000-0000-4000-8000-000000000001')
  self.assertIn(release.BRIDGE_BODY_SHA,sql);self.assertIn("proowner='postgres'::regrole and prosecdef",sql)
  self.assertIn("'bridge_acl'",sql);self.assertIn('OAUTH_CONSENT_RELEASE_POSTCONDITION_FAILED',sql)

if __name__=='__main__':unittest.main()
