"""Offline release guards; never use a provider/database in this suite."""
from pathlib import Path
import copy, importlib.util, json, unittest, uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_release34',HERE/'release.py')
release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)

class ReleaseGuards(unittest.TestCase):
 def baseline(self):
  return {'database':'postgres','operator':'postgres','history':release.HISTORY,
   'protected_m02':release.PROTECTED_M02,'protected_m02_integrity':True,'data':{'candidates':{'count':1,'sha256':'a'*64}},
   'frame_config':{'id':True,'enabled':True,'implementation_version':'frame-extraction.v1','native_image_id':'sha256:77eee0ee51159c6420fffefcdce39406a47350ddae682f4ec86891fe7ec08ed8'},'drain':{'other_active_jobs':0,'leased_outbox':0},
   'oauth':{'coordinator_auth_usage':False},'ports':{row['signature']:{'source_sha256':row['before_sha256'],'attributes_sha256':'b'*64}for row in release.PORTS},
   'english':{'config_column':False,'media_column':False,'version_column':False,'table':False,'flags':None,'rows':None,'legacy_projection_valid':None,'security':None}}
 def test_target_and_exact33_required(self):
  release.check_before(self.baseline())
  for key,value in [('database','other'),('operator','service_role'),('history',release.HISTORY[:-1])]:
   state=self.baseline();state[key]=value
   with self.assertRaises(ValueError):release.check_before(state)
 def test_protected_job_cannot_change(self):
  state=self.baseline();state['protected_m02']=copy.deepcopy(state['protected_m02']);state['protected_m02']['attempt']=4
  with self.assertRaises(ValueError):release.check_before(state)
 def test_partial_english_schema_is_rejected(self):
  state=self.baseline();state['english']['table']=True
  with self.assertRaises(ValueError):release.check_before(state)
 def test_port_source_and_attributes_are_preserved(self):
  before=self.baseline();after=release.expected_after(before);release.check_after(after,before)
  first=next(iter(after['ports']));after['ports'][first]['attributes_sha256']='c'*64
  with self.assertRaises(ValueError):release.check_after(after,before)
 def test_facts_and_ready_rows_cannot_change(self):
  before=self.baseline();after=release.expected_after(before);after['data']['candidates']['sha256']='d'*64
  with self.assertRaises(ValueError):release.check_after(after,before)
 def test_apply_has_in_transaction_pre_and_post_guards(self):
  sql=release.render_apply(self.baseline(),str(uuid.uuid4()))
  self.assertIn('ENGLISH34_PREFLIGHT_CHANGED',sql);self.assertIn('ENGLISH34_POSTCONDITION_FAILED',sql)
  self.assertLess(sql.index('ENGLISH34_PREFLIGHT_CHANGED'),sql.index('create function eps.english_transcript_text_valid'))
  self.assertNotIn('update eps.candidate_asset_config',sql)
  self.assertIn('insert into supabase_migrations.schema_migrations',sql)
 def test_invalid_marker_refused(self):
  with self.assertRaises(ValueError):release.render_apply(self.baseline(),"');drop table eps.candidates;--")
 def test_activation_is_separate_and_compare_and_set(self):
  state=release.expected_after(self.baseline());sql=release.render_activation(state,str(uuid.uuid4()))
  self.assertIn("set english_transcript_version='1.0'",sql)
  self.assertIn('and english_transcript_version is null',sql)
  self.assertIn('changed<>1',sql);self.assertNotIn('create function',sql)
  with self.assertRaises(ValueError):release.render_activation(self.baseline(),str(uuid.uuid4()))
 def test_state_sql_does_not_select_transcripts_or_auth_rows(self):
  sql=release.state_sql(False)
  self.assertNotIn('from auth.',sql.lower());self.assertIn('sha256',sql)
  self.assertIn("to_jsonb(t)-array['english_transcript'",sql)
 def test_source_closure_and_migration_hash(self):
  pins=release.sources();self.assertEqual(pins[release.MIGRATION.relative_to(release.ROOT).as_posix()],release.MIGRATION_SHA)
 def test_queued_work_and_coordinator_auth_expansion_refused(self):
  state=self.baseline();state['drain']['other_active_jobs']=1
  with self.assertRaises(ValueError):release.check_before(state)
  state=self.baseline();state['oauth']['coordinator_auth_usage']=True
  with self.assertRaises(ValueError):release.check_before(state)
 def test_all_three_generated_transactions_parse(self):
  from pglast import parse_sql,parse_plpgsql
  spec=importlib.util.spec_from_file_location('native_pin_test',HERE/'native_pin.py');pin=importlib.util.module_from_spec(spec);spec.loader.exec_module(pin)
  before=self.baseline();run=str(uuid.uuid4())
  parse_sql(release.render_apply(before,run));parse_sql(release.render_activation(release.expected_after(before),run));parse_sql(pin.render(before,'sha256:'+'c'*64,run))
  parse_plpgsql(release.assertion(release.state_sql(False),before,'TEST_STATE'))
 def test_native_pin_changes_only_future_config_image(self):
  spec=importlib.util.spec_from_file_location('native_pin_guard_test',HERE/'native_pin.py');pin=importlib.util.module_from_spec(spec);spec.loader.exec_module(pin)
  before=self.baseline();after=pin.expected_after(before,'sha256:'+'d'*64)
  self.assertEqual(after['data'],before['data']);self.assertEqual(after['protected_m02'],before['protected_m02']);self.assertEqual(after['ports'],before['ports'])
  self.assertEqual(after['frame_config']['native_image_id'],'sha256:'+'d'*64)
  with self.assertRaises(ValueError):pin.expected_after(before,pin.native.OLD_IMAGE)
 def test_manifest_readback_requires_same_ids_and_normal_return(self):
  spec=importlib.util.spec_from_file_location('native_manifest_guard_test',HERE/'native_manifest.py');manifest=importlib.util.module_from_spec(spec);spec.loader.exec_module(manifest)
  rows=[{'id':'id'+str(n),'key':'KEY'+str(n),'type':'plain','target':['production'],'createdAt':1,'updatedAt':1}for n in range(28)];rows[0]['key']='EPS_NATIVE_MANIFEST_SHA256'
  before={'metadata':rows,'manifest_sha256':'a'*64};after=copy.deepcopy(before);after['manifest_sha256']='b'*64;after['metadata'][0]['updatedAt']=2
  self.assertEqual(manifest.outcome(before,after,copy.deepcopy(after),'b'*64,True)['result'],'passed')
  self.assertEqual(manifest.outcome(before,after,copy.deepcopy(after),'b'*64,False)['result'],'unconfirmed')
  after['metadata'][1]['id']='other'
  self.assertEqual(manifest.outcome(before,after,copy.deepcopy(after),'b'*64,True)['result'],'unconfirmed')

if __name__=='__main__':unittest.main()
