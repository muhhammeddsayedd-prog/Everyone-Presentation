"""Inert public evidence and fake local ports. No private/provider/ACL mutation."""
from pathlib import Path
import copy, importlib.util, json, subprocess, sys, unittest
from unittest.mock import Mock,patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('daemon38_reconcile_tests',HERE/'daemon_prepare_reconcile.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)

class FakePorts:
 def __init__(self):
  self.calls=[];self.claimed=False;self.claim_value=None;self.report=None;self.pins_value={'synthetic':'a'*64}
  self.state={'original_receipt_sha256':d.FAILED_SHA,'original_claim_sha256':'b'*64,'export':d.EXPORT,'export_archive_sha256':'c'*64,
   'runtime_digest':'sha256:'+'d'*64,'source_sha256':d.r.SOURCE,'file_count':164,'target_absent':True,'configs':{'synthetic_valid':True}}
  self.extract_failed=False;self.old_refused=False
 def pins(self):return copy.deepcopy(self.pins_value)
 def preflight(self,absent):
  self.calls.append(('preflight',absent));d.need(self.state['target_absent']is absent);return copy.deepcopy(self.state)
 def claim_exists(self):return self.claimed
 def claim(self,value):self.calls.append(('claim',));self.claimed=True;self.claim_value=value
 def extract(self):
  self.calls.append(('extract',))
  if self.extract_failed:raise ValueError('PRIVATE local diagnostic')
  self.state['target_absent']=False
  return {'archive_sha256':self.state['export_archive_sha256'],'runtime_digest':self.state['runtime_digest'],'blobs_verified':17}
 def old_prepared(self):
  self.calls.append(('old_prepared_read',))
  if self.old_refused:raise ValueError('PRIVATE old gate diagnostic')
  return {'export':d.EXPORT,'runtime_digest':self.state['runtime_digest'],'file_count':164}
 def save(self,value):self.report=value;return {'result':value['result'],'receipt':'synthetic-local-reconcile.json','claim_retained':True}

class Tests(unittest.TestCase):
 def test_module_import_and_explicit_false_gate_have_no_process_or_private_IO(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   spec=importlib.util.spec_from_file_location('daemon38_reconcile_import_again',HERE/'daemon_prepare_reconcile.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertIs(type(m.RECONCILE_ENABLED),bool)
  p=FakePorts()
  with patch.object(d,'RECONCILE_ENABLED',False),patch.object(d,'LocalPorts')as ports,patch.object(sys,'argv',['daemon_prepare_reconcile.py']):
   with self.assertRaises(ValueError):d.main()
   with self.assertRaises(ValueError):d.reconcile(p)
  ports.assert_not_called();self.assertFalse(p.calls)

 def test_exact_historical_unconfirmed_receipt_and_executed_sources_are_preserved(self):
  v=d.failed_receipt();self.assertEqual(v['result'],'unconfirmed');self.assertEqual(v['failure_code'],'TRANSPORT_UNCONFIRMED')
  self.assertEqual(v['export'],d.EXPORT);self.assertEqual(len(v['source_pins']),30)
  for name,pin in d.EXECUTED.items():self.assertEqual(d.sha(d.load(HERE/name)),pin)
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):pins=d.source_pins()
  self.assertEqual(len(pins),34);self.assertEqual(pins[d.FAILED],d.FAILED_SHA)

 def test_original_claim_schema_is_exact_and_never_claims_original_success(self):
  pins={'synthetic':'a'*64};claim={'source_pins':pins,'export':d.EXPORT,'local_extraction_may_have_occurred':True,'automatic_retry':False}
  d.validate_original_claim(claim,pins)
  for change in [lambda v:v.update(automatic_retry=True),lambda v:v.update(local_extraction_may_have_occurred=False),lambda v:v.update(source_pins={}),lambda v:v.update(result='passed')]:
   bad=copy.deepcopy(claim);change(bad)
   with self.assertRaises(ValueError):d.validate_original_claim(bad,pins)

 def test_once_only_local_success_checks_original_and_future_unchanged_registry_gate(self):
  p=FakePorts()
  with patch.object(d,'RECONCILE_ENABLED',True):value=d.reconcile(p)
  self.assertEqual(value['result'],'passed');self.assertEqual(p.calls.count(('extract',)),1)
  self.assertLess(p.calls.index(('claim',)),p.calls.index(('extract',)))
  self.assertTrue(p.report['normal_extraction_return_observed']);self.assertTrue(p.report['old_registry_prepared_admitted'])
  self.assertTrue(p.report['original_unconfirmed_outcome_preserved']);self.assertFalse(p.claim_value['automatic_retry'])
  self.assertFalse(p.claim_value['provider_operations_authorized']);self.assertEqual(p.report['after']['original_claim_sha256'],p.report['before']['original_claim_sha256'])

 def test_preexisting_target_or_reconcile_claim_refuses_without_another_extraction(self):
  for existing_target in [False,True]:
   p=FakePorts();p.claimed=not existing_target;p.state['target_absent']=not existing_target
   with patch.object(d,'RECONCILE_ENABLED',True):
    with self.assertRaises(ValueError):d.reconcile(p)
   self.assertNotIn(('extract',),p.calls)

 def test_unknown_or_failed_local_extraction_keeps_new_and_original_claims_without_replay(self):
  p=FakePorts();p.extract_failed=True
  with patch.object(d,'RECONCILE_ENABLED',True):value=d.reconcile(p)
  self.assertEqual(value['result'],'unconfirmed');self.assertTrue(p.claimed);self.assertFalse(p.report['normal_extraction_return_observed'])
  self.assertNotIn('PRIVATE',json.dumps(p.report))
  with patch.object(d,'RECONCILE_ENABLED',True):
   with self.assertRaises(ValueError):d.reconcile(p)
  self.assertEqual(p.calls.count(('extract',)),1)

 def test_claim_source_export_or_config_drift_cannot_earn_local_pass(self):
  for key in ['original_claim_sha256','export_archive_sha256','configs']:
   p=FakePorts();original=p.extract
   def extract():
    proof=original();p.state[key]={'changed':True}if key=='configs'else'changed';return proof
   p.extract=extract
   with patch.object(d,'RECONCILE_ENABLED',True):value=d.reconcile(p)
   self.assertEqual(value['result'],'unconfirmed');self.assertTrue(p.report['normal_extraction_return_observed']);self.assertFalse(p.report['old_registry_prepared_admitted'])
  p=FakePorts();p.pins=Mock(side_effect=[{'a':1},{'a':2}])
  with patch.object(d,'RECONCILE_ENABLED',True):value=d.reconcile(p)
  self.assertEqual(value['result'],'unconfirmed');self.assertNotIn(('extract',),p.calls)

 def test_old_registry_refusal_stays_unconfirmed_after_verified_extraction(self):
  p=FakePorts();p.old_refused=True
  with patch.object(d,'RECONCILE_ENABLED',True):value=d.reconcile(p)
  self.assertEqual(value['result'],'unconfirmed');self.assertTrue(p.report['normal_extraction_return_observed']);self.assertFalse(p.report['old_registry_prepared_admitted'])

 def test_readonly_gate_denies_old_optional_config_writes_and_restores_function(self):
  original=d.r.private_write
  def old_gate(_self,_kind):d.r.private_write(Path('synthetic'),{})
  with patch.object(d,'readonly_configs',return_value={}),patch.object(d.r.Ports,'prepared',old_gate):
   with self.assertRaises(ValueError):d.LocalPorts().old_prepared()
  self.assertIs(d.r.private_write,original)

 def test_source_has_no_old_prepare_directory_protection_login_copy_or_claim_removal_call(self):
  source=(HERE/'daemon_prepare_reconcile.py').read_text()
  for forbidden in ['r.protect_directories(', 'r.prepare(', 'r.configs(', 'r.refresh(', 'r.copy_or_readback(', '.unlink(', '.replace(']:self.assertNotIn(forbidden,source)
  self.assertIn('r.directory_acl(r.PRIVATE,False)',source);self.assertIn('r.directory_acl(r.DOCKER_CONFIG,False)',source)
  self.assertIn("r.b.artifact('daemon','export.tar'),r.folder('daemon')",source)

if __name__=='__main__':unittest.main()
