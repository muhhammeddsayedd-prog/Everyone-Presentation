from pathlib import Path
import copy,importlib.util,json,tempfile,types,unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('logo41_release_tests',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
spec=importlib.util.spec_from_file_location('logo41_state_fixture',HERE/'test_state.py');fixtures=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixtures)

class Guard:
 def create(self,file):return file.open('xb')
 def verify_open(self,stream):pass
 def verify(self,file):assert file.is_file()

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):fixtures.Tests.setUpClass();cls.c=fixtures.Tests.c
 def test_default_off_precedes_context_or_any_phase(self):
  with patch.object(r,'Release',side_effect=AssertionError('PORT_REACHED')):
   for phase in('prepare','apply','reconcile'):
    with self.assertRaises(ValueError):r.main([phase,'8a100000-0000-4000-8000-000000000001'])
  for phase in('prepare','apply','reconcile'):
   with self.assertRaises(ValueError):getattr(r.Release.__new__(r.Release),phase)()
 def test_inert_class_projection_and_normal_transport_shape(self):
  self.assertTrue(r.PROJECTION['class_inverse_byte_equal']);self.assertEqual(r.PROJECTION['finite_edits'],7)
  self.assertIn('npx.cmd',r.Base.query.__code__.co_consts);self.assertFalse(r.READ_ENABLED);self.assertFalse(r.APPLY_ENABLED)
 def test_collector_admission_requires_actual_nonce_all_preservation_and_sources(self):
  marker='8a100000-0000-4000-8000-000000000001';file=HERE/'release.py';pins={str(file):r.s.sha(file.read_bytes())}
  validation=dict.fromkeys(('actual_state_checkpoint_and_rendered_transaction','all76_full_rows_including_reason_preserved','full_functions_catalogue_roles_dependencies_preserved','actual_negative_preimage_refused_and_rolled_back','diagnostic_rollback_exact','two_equal_before_reads','two_equal_after_reads','before_and_after_full_checkpoints_checked','only_owned_database_identity_qualified'),True)
  validation.update(result='passed',production_identity_admission_claimed=False,normal_commit_nonce=marker,normal_commit_return={'version':r.s.VERSION,'marker':marker,'migration_sha256':r.s.MIGRATION_SHA})
  value={'result':'passed','cloud_called':False,'provider_called':False,'all_owned_resources_absent':True,'original_data_catalogue_and_global_roles_unchanged':True,'shared_lock_released':True,'collector_validation':validation,'source_seals':{'development/m07/logo-info-canonical-release/release.py':r.s.sha(r.old.disabled_release_bytes(file.read_bytes()))}}
  def validate(v,source=pins):
   raw=json.dumps(v).encode();return r.validate_collector_proof(raw,r.s.sha(raw),source)
  self.assertEqual(validate(value)['result'],'passed')
  for mode in('nonce','reason','source','identity_claim'):
   changed=copy.deepcopy(value)
   if mode=='nonce':changed['collector_validation']['normal_commit_return']['marker']='wrong'
   elif mode=='reason':changed['collector_validation']['all76_full_rows_including_reason_preserved']=False
   elif mode=='identity_claim':changed['collector_validation']['production_identity_admission_claimed']=True
   else:changed['source_seals']['development/m07/logo-info-canonical-release/release.py']='0'*64
   with self.assertRaises(ValueError):validate(changed)
 def runner(self,root):
  op=r.Release.__new__(r.Release);op.c=types.SimpleNamespace(root=root,b=types.SimpleNamespace(security=lambda:Guard()));op.run='8a100000-0000-4000-8000-000000000001';op.private=root/'.local/logo-info-canonical-release'/op.run;op.private.mkdir(parents=True);op.claim=op.private/'apply.claim.json';op.claim.write_text(json.dumps({'marker':'fixed'}));return op
 def test_bad_apply_response_is_preserved_before_projection_no_normal_replay(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);(root/'supabase/.temp').mkdir(parents=True);(root/'supabase/.temp/project-ref').write_text(r.s.TARGET)
   op=self.runner(root);calls=[];raw=b'{"rows":[{"wrong":"synthetic-private-canary"}]}'
   reader=types.SimpleNamespace(environment=lambda:{})
   capture=types.SimpleNamespace(bounded_checkpoint=lambda *a,**kw:(calls.append((a,kw))or(0,False,False,raw,b'')))
   def load(name,file):
    if name=='reason40_existing_normal_bounded_reader':return reader
    if name=='reason40_existing_checkpoint_capture':return capture
    raise AssertionError('UNEXPECTED_PORT')
   with patch.object(r,'READ_ENABLED',True),patch.object(r,'APPLY_ENABLED',True),patch.object(r.s,'module',side_effect=load):
    with self.assertRaises(ValueError):op.query('select 1;','apply')
    self.assertEqual((op.private/'apply-response.json').read_bytes(),raw);self.assertTrue(op.claim.exists());self.assertFalse((op.private/'normal-return.json').exists())
    self.assertEqual(len(calls),1)
    with self.assertRaises(ValueError):op.apply()
    self.assertEqual(len(calls),1)
    # The actual inherited apply refuses its permanent claim before transport.
    self.assertFalse((op.private/'normal-return.json').exists())
 def test_normal_response_binding_rechecks_guard_claim_and_actual_response_hash(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);(root/'supabase/.temp').mkdir(parents=True);(root/'supabase/.temp/project-ref').write_text(r.s.TARGET)
   op=self.runner(root);expected={'version':r.s.VERSION,'marker':'fixed','migration_sha256':r.s.MIGRATION_SHA};raw=json.dumps({'rows':[{'reason40_release':expected}]}).encode()
   reader=types.SimpleNamespace(environment=lambda:{})
   capture=types.SimpleNamespace(bounded_checkpoint=lambda *a,**kw:(0,False,False,raw,b''))
   def load(name,file):
    if name=='reason40_existing_normal_bounded_reader':return reader
    if name=='reason40_existing_checkpoint_capture':return capture
    raise AssertionError('UNEXPECTED_PORT')
   with patch.object(r,'READ_ENABLED',True),patch.object(r,'APPLY_ENABLED',True),patch.object(r.s,'module',side_effect=load):self.assertEqual(op.query('select 1;','apply'),expected)
   self.assertEqual(op.response_binding(),r.s.sha(raw))
   (op.private/'apply-response.json').write_bytes(raw+b' ')
   with self.assertRaises(ValueError):op.response_binding()
 def test_full_nonnull_empty_unicode_reason_checkpoint_rows_never_masked(self):
  fixture=fixtures.Tests();before=fixture.before();after=self.c.expected(before)
  rows={table:[]for table in self.c.tables};rows['audit_events']=[{'id':'a','reason':'Unicode Ω\ntext'},{'id':'b','reason':''},{'id':'c','reason':None}]
  identity=before['target']['identity'];func={**identity,'prosrc':self.c.old_body}
  left={'state':before,'application_tables':rows,'catalogue':{'functions|'+r.s.SIGNATURE+'|source_sha256':r.s.OLD},'function_rows':[func],'history_rows':[{'version':version,'statements':[],'name':'historical'}for version in self.c.history]}
  right=copy.deepcopy(left);right['state']=after;right['catalogue']['functions|'+r.s.SIGNATURE+'|source_sha256']=r.s.NEW;right['function_rows'][0]['prosrc']=self.c.candidate.patch_body(self.c.old_body);right['history_rows'].append({'version':r.s.VERSION,'statements':[],'name':'m07_logo_info_operation'})
  op=r.Release.__new__(r.Release);op.c=self.c;op.plan=Path('plan');op.read=lambda path:{'before':before};op.checkpoint_read=lambda ref:left if ref=='before'else right
  self.assertTrue(op.compare_checkpoints('before','after'))
  for field in('reason','other'):
   changed=copy.deepcopy(right);changed['application_tables']['audit_events'][0][field]='changed'
   op.checkpoint_read=lambda ref:left if ref=='before'else changed
   with self.assertRaises(ValueError):op.compare_checkpoints('before','after')

if __name__=='__main__':unittest.main()
