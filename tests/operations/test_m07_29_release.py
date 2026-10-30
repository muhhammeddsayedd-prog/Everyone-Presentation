"""Offline fixed29 release boundary tests. Never call cloud, CLI or private configuration."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest import mock
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m07_29_release',ROOT/'tools/release_m07_29.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Release29Tests(unittest.TestCase):
 def setUp(self):
  self.cli=self.enterContext(mock.patch.object(m,'cli_call',side_effect=AssertionError('Offline only')))
  self.plan=json.loads((ROOT/'development/m07/db/release29-plan.json').read_bytes());self.proof=json.loads((ROOT/self.plan['proof']).read_bytes());self.delta=json.loads((ROOT/self.plan['catalog_delta']).read_bytes())
  self.before=copy.deepcopy(self.proof['release']['readback_before']);self.after=copy.deepcopy(self.proof['release']['readback_expected']);self.before['database']=self.after['database']='postgres';self.after['old_data']['versions'].append(self.plan['version'])
  for state in(self.before,self.after):state.update(runtime={'execute':sorted(m.OLD_OPERATIONS),'login':True,'inherit':False,'superuser':False,'bypass_rls':False,'parents':[]},protected_m02={'exists':True,'manual_note_retained':True},active_jobs=0,leased_outbox=0)
  self.inputs={'migration':Path(self.plan['migration_path']).name,'migration_sha256':self.plan['migration_sha256'],'version':self.plan['version'],'versions':self.after['old_data']['versions'],'delta':self.plan['catalog_delta'],'synthetic_offline':True}
 def test_pinned_original_profile_full_catalogue_and_current_promotion(self):
  profile=m.load_original_profile(self.plan,{'path':m.PROFILE_REVIEW,'sha256':m.PROFILE_REVIEW_SHA})
  promotion=json.loads((ROOT/'tracking/evidence/m07/local29-promotion/2026-10-30T11-43-29-462Z-b17a0d67-current-promote.json').read_bytes())
  m.validate_local_promotion(promotion,profile,self.plan)
  self.assertEqual(profile['before']['catalog_count'],16103)
  self.cli.assert_not_called()
 def test_only_preexisting_public_usage_pair_can_differ_from_frozen_delta(self):
  current=json.loads((ROOT/'development/m07/db/release29-original-profile-delta.json').read_bytes())
  m.validate_profile_delta(self.delta,current)
  for mutate in(lambda v:v['created'].update({'unknown':'unsafe'}),lambda v:v['changed']['schemas|public|acl'].update(before=v['changed']['schemas|public|acl']['before'].replace('=U/pg_database_owner','=UC/pg_database_owner')),lambda v:v['changed']['schemas|eps|acl'].update(after='unsafe'),lambda v:v['changed']['schemas|public|acl'].update(after=self.delta['changed']['schemas|public|acl']['after'])):
   value=copy.deepcopy(current);mutate(value)
   with self.subTest(mutate=mutate),self.assertRaises(m.Blocked):m.validate_profile_delta(self.delta,value)
 def test_profile_review_hash_or_linked_source_drift_refused(self):
  for item in({'path':m.PROFILE_REVIEW,'sha256':'0'*64},{'path':'development/m07/db/release29-plan.json','sha256':m.PROFILE_REVIEW_SHA}):
   with self.assertRaises(m.Blocked):m.load_original_profile(self.plan,item)
  real=m.sealed
  def changed(file,digest):
   if file=='tools/promote-m07-local29-current.mjs':raise m.Blocked()
   return real(file,digest)
  with mock.patch.object(m,'sealed',side_effect=changed),self.assertRaises(m.Blocked):m.load_original_profile(self.plan,{'path':m.PROFILE_REVIEW,'sha256':m.PROFILE_REVIEW_SHA})
  self.cli.assert_not_called()
 def test_promotion_requires_exact_baseline_after_and_actual_dispatch(self):
  profile=json.loads((ROOT/'development/m07/db/release29-original-profile.json').read_bytes());promotion=json.loads((ROOT/'tracking/evidence/m07/local29-promotion/2026-10-30T11-43-29-462Z-b17a0d67-current-promote.json').read_bytes())
  for mutate in(lambda v:v['before'].update(catalog_protected_sha256='0'*64),lambda v:v['before']['old_data']['hashes'].update({'eps.presentation_versions':'0'*64}),lambda v:v['after']['old_data']['versions'].append('20990101000000'),lambda v:v['comparison_profile'].update(sha256='0'*64),lambda v:v.update(result='failed'),lambda v:v.update(dispatch_attempted=False),lambda v:v.update(lock_retained=True),lambda v:v['existing_role_oids'][0].update(oid='0'),lambda v:v['source_seals'].pop('tools/promote-m07-local29-current.mjs')):
   value=copy.deepcopy(promotion);mutate(value)
   with self.subTest(mutate=mutate),self.assertRaises(m.Blocked):m.validate_local_promotion(value,profile,self.plan)
  self.cli.assert_not_called()
 def test_source_only_preparer_validates_real_receipts_without_sealing_or_cli(self):
  helper_before=(ROOT/'tools/release_m07_29.py').read_bytes()
  spec=importlib.util.spec_from_file_location('m07_29_freezer',ROOT/'tools/freeze-m07-cloud29-review.py');freezer=importlib.util.module_from_spec(spec);spec.loader.exec_module(freezer)
  config=freezer.build_config('tracking/evidence/m07/local29-promotion/2026-10-30T11-43-29-462Z-b17a0d67-current-promote.json','tracking/evidence/m07/local29-promotion/2026-10-30T11-22-09-016Z-3de2c0a5-auth-prerequisite.json')
  inputs=m.validate_release_config(config)
  self.assertEqual(inputs['delta'],'development/m07/db/release29-original-profile-delta.json')
  self.assertEqual(inputs['original_profile_review'],{'path':m.PROFILE_REVIEW,'sha256':m.PROFILE_REVIEW_SHA})
  self.assertEqual((ROOT/'tools/release_m07_29.py').read_bytes(),helper_before)
  for mutate in(lambda v:v.pop('original_profile_review'),lambda v:v['promotion'].update(sha256='0'*64),lambda v:v['original_profile_review'].update(sha256='0'*64)):
   value=copy.deepcopy(config);mutate(value)
   with self.subTest(mutate=mutate),self.assertRaises(m.Blocked):m.validate_release_config(value)
  self.cli.assert_not_called()
 def test_canonical_original_delta_preserves_its_own_richer_auth_catalogue_hash(self):
  profile=json.loads((ROOT/'development/m07/db/release29-original-profile.json').read_bytes());delta=json.loads((ROOT/profile['catalog_delta']).read_bytes())
  before=copy.deepcopy(profile['before']);after=copy.deepcopy(profile['expected_after']);after['old_data']['versions'].append(self.plan['version'])
  for value in(before,after):
   value.update(runtime={'execute':sorted(m.OLD_OPERATIONS)},protected_m02={'exists':True,'manual_note_retained':True},active_jobs=0,leased_outbox=0)
   value['catalog_count']+=1000;value['catalog_protected_sha256']='a'*64
  m.validate_before_state(before,delta,after['old_data']['versions']);m.compare_states(before,after,delta,self.plan['version'])
  after['catalog_protected_sha256']=profile['expected_after']['catalog_protected_sha256']
  with self.assertRaises(m.Blocked):m.compare_states(before,after,delta,self.plan['version'])
 def test_preparer_rejects_unbounded_nested_receipt_before_read_or_hash(self):
  spec=importlib.util.spec_from_file_location('m07_29_freezer_path_test',ROOT/'tools/freeze-m07-cloud29-review.py');freezer=importlib.util.module_from_spec(spec);spec.loader.exec_module(freezer)
  promotion_file='tracking/evidence/m07/local29-promotion/2026-10-30T11-43-29-462Z-b17a0d67-current-promote.json';real=freezer.read
  def malformed(file):
   value=real(file)
   if file==promotion_file:value['promotion']['receipt']='../M07_SYNTHETIC_REFUSED_PATH'
   return value
  with mock.patch.object(freezer,'read',side_effect=malformed),mock.patch.object(freezer.boundary,'cli_call',side_effect=AssertionError('Offline only')),self.assertRaises(freezer.boundary.Blocked):freezer.build_config(promotion_file,'tracking/evidence/m07/local29-promotion/2026-10-30T11-22-09-016Z-3de2c0a5-auth-prerequisite.json')
  self.cli.assert_not_called()
 def test_reviewed_delta_and_exact_history_data_catalogue_preservation(self):
  m.validate_delta(self.delta);self.assertEqual(len(self.delta['changed']),29);m.validate_before_state(self.before,self.delta,self.inputs['versions']);self.assertTrue(all(m.compare_states(self.before,self.after,self.delta,self.plan['version']).values()))
 def test_broad_auth_grant_policy_role_and_forced_rls_drift_denied(self):
  for mutate in(lambda v:v['changed'].update({'columns|auth.sessions.refresh_token_hmac_key|acl':{'before':None,'after':'unsafe'}}),lambda v:v['created'].update({'policies|auth.sessions.eps_mcp_own_session|roles':['authenticated']}),lambda v:v['created'].update({'tables|eps.app_settings|force_rls':False}),lambda v:v['created'].update({'roles|eps_mcp_session_owner|login':True})):
   delta=copy.deepcopy(self.delta);mutate(delta)
   with self.subTest(mutate=mutate),self.assertRaises(m.Blocked):m.validate_delta(delta)
 def test_new_default_cannot_enable_client_or_rewrite_ready_data(self):
  for mutate in(lambda v:v['new_state']['mcp_oauth_resources'].update(count=1),lambda v:v['old_data']['hashes'].update({'eps.presentation_versions':'0'*64}),lambda v:v['old_data']['managed_auth'].update(session_count=1),lambda v:v['new_state']['prior']['config'].update(enabled=True),lambda v:v.update(catalog_protected_sha256='0'*64)):
   after=copy.deepcopy(self.after);mutate(after)
   with self.subTest(mutate=mutate),self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta,self.plan['version'])
 def test_only_one_history_append_no_worker_or_job_drift(self):
  for mutate in(lambda v:v['old_data']['versions'].append('20990101000000'),lambda v:v['runtime']['execute'].append('eps.unsafe()'),lambda v:v.update(active_jobs=1),lambda v:v.update(leased_outbox=1),lambda v:v['protected_m02'].update(manual_note_retained=False)):
   after=copy.deepcopy(self.after);mutate(after)
   with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta,self.plan['version'])
 def test_fixed_target_skip_vault_no_target_override_or_force_seed(self):
  for dry in(True,False):
   command=m.push_command(dry);self.assertEqual(command[:5],['db','push','--linked','--project-ref','pyibofyctwnqpvktepse']);self.assertIn('--skip-vault',command);self.assertNotIn('--include-seed',command);self.assertNotIn('--include-all',command);self.assertNotIn('--force',command);self.assertEqual('--dry-run'in command,dry)
  for text in('',self.inputs['migration']+'\n20990101000000_unsafe.sql'):
   with self.assertRaises(m.Blocked):m.validate_pending(text,self.inputs['migration'])
 def test_connection_scope_override_refused_before_cli(self):
  for name in('PGHOST','PGPASSWORD','PGOPTIONS','SUPABASE_DB_URL','SUPABASE_WORKDIR'):
   with self.assertRaises(m.Blocked):m.validate_process_scope({name:'synthetic-override'})
  self.cli.assert_not_called()
 def test_unfrozen_pin_and_invalid_arguments_never_call_cli(self):
  with mock.patch.object(m,'CONFIG_SHA',''):
   with self.assertRaises(m.Blocked):m.current_release_inputs()
  for args in(['--force'],['apply','--project-ref','other']):
   with self.assertRaises(m.Blocked):m.main(args)
  self.cli.assert_not_called()
 def test_existing_claim_or_attempt_blocks_second_write(self):
  for claimed,attempts in((True,[]),(False,['synthetic-prior-apply-attempt'])):
   claim=mock.Mock();claim.exists.return_value=claimed;evidence=mock.Mock();evidence.glob.return_value=attempts
   with mock.patch.object(m,'CLAIM',claim),mock.patch.object(m,'EVIDENCE',evidence),self.assertRaises(m.Blocked):m.refuse_repeat_apply()
 def test_quiescence_must_be_recent_same_migration_and_verified_owned_processes(self):
  valid={'observed_at':m.stamp(),'target':m.TARGET,'migration_sha256':self.inputs['migration_sha256'],'owned_processes_verified':True,'web_stopped':True,'worker_stopped':True,'ownership_evidence':'.local/synthetic-process-proof.json'}
  for change in({'target':'wrong'},{'migration_sha256':'0'*64},{'observed_at':'2000-01-01T00:00:00+00:00'},{'owned_processes_verified':False},{'web_stopped':False},{'worker_stopped':False}):
   value={**valid,**change};file=mock.Mock();file.read_bytes.return_value=json.dumps(value).encode()
   with mock.patch.object(m,'QUIESCENCE',file),self.assertRaises(m.Blocked):m.validate_quiescence(self.inputs,self.before)
 def test_apply_claim_follows_admission_and_precedes_one_dispatch(self):
  events=[];dry={'result':'passed','inputs':self.inputs,'before':self.before,'pending_migrations':[self.inputs['migration']],'finished_at':m.stamp()}
  def read(file):
   if file==self.inputs['delta']:return self.delta
   if file.endswith('/dry-run.json'):return dry
   raise AssertionError('Unexpected read')
  def call(command):self.assertEqual(events,['quiescence','claim']);events.append('dispatch');return subprocess.CompletedProcess(command,0,self.inputs['migration'],'')
  with mock.patch.object(m,'current_release_inputs',return_value=self.inputs),mock.patch.object(m,'inspect_state',side_effect=[self.before,self.after]),mock.patch.object(m,'read_json',side_effect=read),mock.patch.object(m,'refuse_repeat_apply'),mock.patch.object(m,'validate_quiescence',side_effect=lambda *args:events.append('quiescence')),mock.patch.object(m,'retain',return_value='tracking/evidence/cloud-m07-29/synthetic-apply-attempt.json'),mock.patch.object(m,'private_write',side_effect=lambda *args:events.append('claim')),mock.patch.object(m,'call',side_effect=call),contextlib.redirect_stdout(io.StringIO()):m.main(['apply'])
  self.assertEqual(events,['quiescence','claim','dispatch']);self.cli.assert_not_called()
 def test_process_absence_check_rejects_live_pid_and_does_not_stop_processes(self):
  for pids in([],['123'],[True],[1,1],[0]):
   with self.assertRaises(m.Blocked):m.verify_owned_processes_absent(pids)
  with mock.patch.object(m.os,'name','nt'),mock.patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],1,'','synthetic-live-pid'))as run,self.assertRaises(m.Blocked):m.verify_owned_processes_absent([123])
  self.assertNotIn('Stop-Process',run.call_args.args[0][-1]);self.assertNotIn('CommandLine',run.call_args.args[0][-1]);self.assertIn('Get-Process',run.call_args.args[0][-1])
 def test_unknown_push_outcome_retains_failure_without_retry(self):
  events=[];receipts=[];dry={'result':'passed','inputs':self.inputs,'before':self.before,'pending_migrations':[self.inputs['migration']],'finished_at':m.stamp()}
  def read(file):return self.delta if file==self.inputs['delta']else dry
  def call(command):events.append('dispatch');raise m.Blocked()
  def retain(receipt,suffix):receipts.append(copy.deepcopy(receipt));return'tracking/evidence/cloud-m07-29/synthetic-apply-attempt.json'
  with mock.patch.object(m,'current_release_inputs',return_value=self.inputs),mock.patch.object(m,'inspect_state',return_value=self.before),mock.patch.object(m,'read_json',side_effect=read),mock.patch.object(m,'refuse_repeat_apply'),mock.patch.object(m,'validate_quiescence'),mock.patch.object(m,'retain',side_effect=retain),mock.patch.object(m,'private_write',side_effect=lambda *args:events.append('claim')),mock.patch.object(m,'call',side_effect=call),contextlib.redirect_stdout(io.StringIO()),self.assertRaises(m.Blocked):m.main(['apply'])
  self.assertEqual(events,['claim','dispatch']);self.assertEqual(receipts[-1]['result'],'failed');self.assertFalse(receipts[-1]['automatic_retry'])
 def test_independent_readback_reconciles_claim_and_never_pushes(self):
  attempt_path='tracking/evidence/cloud-m07-29/synthetic-apply-attempt.json';claim={'target':m.TARGET,'inputs_sha256':m.canonical(self.inputs),'before_sha256':m.canonical(self.before),'attempt_receipt':attempt_path}
  def read(file):
   if file==self.inputs['delta']:return self.delta
   if file=='.local/cloud-m07-29/apply.claim.json':return claim
   if file==attempt_path:return{'before':self.before}
   raise AssertionError('Unexpected read')
  with mock.patch.object(m,'current_release_inputs',return_value=self.inputs),mock.patch.object(m,'inspect_state',return_value=self.after),mock.patch.object(m,'read_json',side_effect=read),mock.patch.object(m,'retain',return_value='synthetic-readback'),mock.patch.object(m,'call')as call,contextlib.redirect_stdout(io.StringIO()):m.main(['readback'])
  call.assert_not_called();self.cli.assert_not_called()

if __name__=='__main__':unittest.main()
