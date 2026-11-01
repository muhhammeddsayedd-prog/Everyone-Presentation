"""Offline design/metadata query checks. Never dispatches SQL or calls a CLI."""
import importlib.util,json,unittest
from pathlib import Path
from unittest.mock import patch
from pglast import parse_sql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('attempt36_proposal',HERE/'proposal.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)

class ProposalTests(unittest.TestCase):
 def test_promotion_preserves_every_functional_candidate_byte(self):
  candidate=(p.ROOT/p.CANDIDATE).read_bytes();promoted=b'-- Reviewed canonical admission will be finalized separately.\n'+p.functional_bytes(candidate)
  self.assertTrue(p.assert_functional_promotion(promoted,candidate)['functional_bytes_equal'])
  for raw in [promoted.replace(b'nobypassrls',b'bypassrls'),promoted+b'\n-- extra',b'other']:
   with self.assertRaises(ValueError):p.assert_functional_promotion(raw,candidate)
 def test_readback_is_one_closed_readonly_metadata_projection_and_parses(self):
  sql=p.readback_sql('20261101020000');self.assertEqual(len(parse_sql(sql)),6)
  self.assertIn('begin isolation level repeatable read read only;',sql);self.assertTrue(sql.endswith('rollback;'))
  self.assertIn('as attempt36_readback',sql);self.assertIn("'previous74_and_security'",sql)
  self.assertIn("'cli_login_postgres'",sql);self.assertIn('isfinite(rolvaliduntil)',sql)
  self.assertIn("'trace_rows'",sql);self.assertIn('to_jsonb(t)',sql);self.assertIn('limit 65',sql)
  for forbidden in ['from auth.users','from auth.sessions','select p.prosrc','select input','select result','select receipt']:
   self.assertNotIn(forbidden,sql.lower())
 def test_version_and_input_shapes_fail_closed(self):
  for version in [None,36,False,'20261031182038','20261101020000;commit','2026110102000']:
   with self.assertRaises(ValueError):p.readback_sql(version)
 def test_new_objects_and_jobs_foreign_key_trigger_inventory_are_explicit(self):
  sql=p.readback_sql('20261101020000')
  for field in ['jobs_has_triggers','jobs_trigger_inventory','constraint_on_trace','references_jobs','force_rls','body_sha256','table_acl','attribute_numbers']:
   self.assertIn("'"+field+"'",sql)
  self.assertIn("t.tgrelid='eps.jobs'::regclass",sql)
  self.assertIn("c.conrelid='eps.job_stage_attempts'::regclass",sql)
  self.assertEqual([node.stmt.__class__.__name__ for node in parse_sql(sql)],
   ['TransactionStmt','VariableSetStmt','VariableSetStmt','VariableSetStmt','SelectStmt','TransactionStmt'])
 def test_proof_requires_actual_cleanup_scope_and_exact_candidate(self):
  value={'run_id':'7cff5c7d-8329-4abd-ba27-a6e390a7208d','result':'passed','checkpoint':'complete',
   **{k:False for k in ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes']},
   **{k:True for k in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
    'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']},
   'actual_disposable_database_absence':{'eps_m07_r33_source_7cff5c7d83294abdba27a6e390a7208d':False,'eps_m07_r33_restore_7cff5c7d83294abdba27a6e390a7208d':False},
   'source_seals':{**{str(i):'synthetic'for i in range(184)},p.CANDIDATE:p.CANDIDATE_SHA},
   'attempt36_sql':{'result':'passed','candidate36_sha256':p.CANDIDATE_SHA,'fixture_markers':p.MARKERS,'persistent_history_count':33,
    **{k:True for k in ['functional_sql_unchanged','actual_claim_callback_manual_retry','ddl_data_catalogue_rolled_back','trace_role_rolled_back','history34_and35_ephemeral']},
    **{k:False for k in ['candidate36_history_inserted','managed_auth_policy_changed','native_executed','cloud_called','provider_called','hosted_acceptance']}}}
  raw=json.dumps(value).encode()
  with self.assertRaises(ValueError):p.validate_proof(raw)
  with patch.object(p,'PROOF_SHA',p.sha(raw)):
   self.assertTrue(p.validate_proof(raw)['passed_local_sql_and_cleanup'])
  for key in ['disposable_databases_removed','new33_roles_removed','original29_full_auth_storage_catalogue_unchanged','shared_test_lock_released']:
   bad={**value,key:False};raw=json.dumps(bad).encode()
   with patch.object(p,'PROOF_SHA',p.sha(raw)):
    with self.assertRaises(ValueError):p.validate_proof(raw)

if __name__=='__main__':unittest.main()
