"""Inert source/deploy-controller tests. No CLI, DB, provider or build calls."""
import contextlib,copy,importlib.util,io,json,unittest
from pathlib import Path
from unittest.mock import Mock,patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('source_unreadable36_web',HERE/'web.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)

class WebTests(unittest.TestCase):
 def report(self):
  value=copy.deepcopy(w.anchor('baseline_source'));rows={r['path']:r for r in value['files']}
  for path,digest in w.COPY_FILES.items():rows[path]={'path':path,'bytes':len(w.old.load(w.ROOT/path)),'sha256':digest}
  path=w.ADDED_TRACE;rows[path]={'path':path,'bytes':len(w.old.load(w.ROOT/path)),'sha256':w.ADDED_TRACE_SHA}
  value['files']=sorted(rows.values(),key=lambda row:row['path']);value['entries']=len(rows);return value
 def test_explicit_delta_is_two_copy_changes_and_one_previously_merged_parser(self):
  delta=w.source_delta(self.report());self.assertEqual(delta['baseline_entries'],282);self.assertEqual(delta['current_entries'],283)
  self.assertEqual([r['path']for r in delta['changed']],sorted(w.COPY_FILES));self.assertEqual([r['path']for r in delta['added']],[w.ADDED_TRACE]);self.assertEqual(delta['removed'],[])
  self.assertEqual(delta['baseline_source_sha256'],'13209ba54d3e47a5f794ee6a4956fef8096c421e4691bd979b177e545afb831c')
  for mutation in [lambda r:r['files'].pop(),lambda r:r['files'].append({'path':'development/private-runtime.mjs','bytes':1,'sha256':'a'*64}),lambda r:r['files'][0].update(sha256='0'*64)]:
   report=self.report();mutation(report)
   with self.assertRaises((ValueError,AssertionError)):w.source_delta(report)
 def test_apply_and_separate_readback_are_exact_public_anchors(self):
  self.assertEqual(w.canonical(w.ANCHORS['apply']),w.base.digest(w.anchor('readback')['static_schema_after']))
  with self.assertRaises(ValueError):w.canonical({'path':w.ANCHORS['apply']['path'],'sha256':'0'*64})
 def test_live_admission_freezes_static_schema_but_tolerates_ordinary_job_data(self):
  class State:
   VERSION='20261101012057'
   def static_schema(self,value):return value['synthetic_static']
  class Helper:
   s=State()
   def _installed(self,value,accepted):self_installed.append((value,accepted))
   def read_state(self,phase):self_test.assertEqual(phase,'after');return current
  self_test=self;self_installed=[];after=w.anchor('readback')['static_schema_after'];current={'synthetic_static':after,'ordinary_jobs':'changed_after_apply'}
  with patch.object(w,'canonical_helper',return_value=Helper()):self.assertEqual(w.canonical(w.ANCHORS['apply'],True),w.base.digest(after))
  current['synthetic_static']={**after,'claim_ports':{'wrong':True}}
  with patch.object(w,'canonical_helper',return_value=Helper()),self.assertRaises(ValueError):w.canonical(w.ANCHORS['apply'],True)
 def test_deploy_uses_original_source_and_new_markers_without_prebuilt_or_env_transfer(self):
  command=w.deploy_command(Path('synthetic-source'),'a'*64,'b'*64,'c'*64)
  self.assertIn('synthetic-source',command);self.assertNotIn('--prebuilt',command)
  self.assertIn('epsSourceUnreadable36Source='+'a'*64,command);self.assertNotIn('--env',command);self.assertNotIn('--build-env',command)
  self.assertEqual(w.base.CURRENT,'dpl_6L6vS8FnaGDckcYq8Xm4QxHGc74b');self.assertIsInstance(w.DEPLOY_ENABLED,bool);self.assertEqual(w.base.DEPLOY_ENABLED,w.DEPLOY_ENABLED)
  self.assertEqual(w.base.PLAN,w.PRIVATE/'plan.json')
  for key in ['PLAN','INSPECT','BUILD_CLAIM','BUILD','CLAIM','RETURNED','ADMISSION']:self.assertEqual(getattr(w.base,key).parent,w.PRIVATE)
 def test_metadata_parser_requires_current_direct_and_alias_ready_identity(self):
  row={'id':'dpl_new','project_id':w.old.PROJECT,'team_id':w.old.TEAM,'state':'READY','url':'synthetic.vercel.app','source_sha256':'a'*64,'quality_sha256':'b'*64,'canonical_sha256':'c'*64}
  self.assertEqual(w.base.ready(row,row,'a'*64,'b'*64,'c'*64),row)
  with self.assertRaises(ValueError):w.base.ready(row,{**row,'id':'dpl_other'},'a'*64,'b'*64,'c'*64)
 def test_import_and_manifest_do_not_ship_test_client_or_development_runtime(self):
  report=self.report();w.base.validate_rows(report['files'])
  self.assertTrue(w.PRODUCT_FILES<=set(r['path']for r in report['files']))
  for path in ['tools/client-upload-transfer.mts','tests/server/job-http.test.ts','development/m07/source-unreadable36-web/web.py']:
   self.assertNotIn(path,[r['path']for r in report['files']])
 def test_disabled_main_has_no_provider_or_file_actions(self):
  with patch.object(w,'DEPLOY_ENABLED',False),patch.object(w.base,'main')as main,self.assertRaises(ValueError):w.main()
  main.assert_not_called()
 def test_bad_delta_fails_before_private_plan_mutation(self):
  report=self.report();report['files'].pop();plan=Mock();plan.exists.return_value=False
  env={'EPS_RELEASE_MODE':'controlled_pilot','APP_ENV':'staging','APP_BASE_URL':'https://'+w.old.ALIAS,'CENTRAL_ADAPTER_MODE':'supabase','NODE_ENV':'production','EPS_PILOT_OWNER_CONTROLLED':'true','SUPABASE_URL':'https://pyibofyctwnqpvktepse.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_synthetic-test-key'}
  inputs=json.dumps({'source_receipt':{'path':'synthetic','sha256':'a'*64},'public_build_environment':env}).encode()
  with patch.object(w,'DEPLOY_ENABLED',True),patch.object(w.base,'DEPLOY_ENABLED',True),patch.object(w.base,'PLAN',plan),patch.object(w.base,'source_pins',return_value={'synthetic':'a'*64}),patch.object(w,'ORIGINAL_STAGE',return_value=(report,Path('synthetic-source'))),patch.object(w.old,'load',return_value=inputs),patch.object(w.base,'exclusive')as exclusive,patch.object(w.sys,'argv',['web.py','prepare','synthetic-input.json']),self.assertRaises(ValueError):w.main()
  exclusive.assert_not_called()
 def test_ambiguous_dispatch_retains_new_claim_and_cannot_replay(self):
  value={'source':{'path':'synthetic','sha256':'a'*64},'run_id':'10000000-0000-4000-8000-000000000001'}
  before={'project':{'synthetic':True},'environment':[],'deployment':{'id':w.CURRENT,'state':'READY'}}
  build={'source_sha256':'b'*64};bound={'canonical':w.ANCHORS['apply']};claim=Mock();claim.exists.return_value=False;returned=Mock();returned.exists.return_value=False
  def save_claim(path,body):
   self.assertIs(path,claim);self.assertIs(body['automatic_retry'],False);self.assertIs(body['dispatch_may_have_occurred'],True);claim.exists.return_value=True
  with patch.object(w,'DEPLOY_ENABLED',True),patch.object(w.base,'DEPLOY_ENABLED',True),patch.object(w.base,'CLAIM',claim),patch.object(w.base,'RETURNED',returned),patch.object(w.base,'plan',return_value=value),patch.object(w.base,'stage',return_value=(self.report(),Path('synthetic-source'))),patch.object(w.base,'build_receipt',return_value=build),patch.object(w.base,'admission',return_value=bound),patch.object(w.base,'observe',return_value=before),patch.object(w.base,'source_pins',return_value={'synthetic':'a'*64}),patch.object(w.old,'load',return_value=json.dumps(before).encode()),patch.object(w.base,'exclusive',side_effect=save_claim),patch.object(w.old,'command',side_effect=TimeoutError('synthetic transport'))as command,patch.object(w.sys,'argv',['web.py','deploy']),contextlib.redirect_stdout(io.StringIO()):
   with self.assertRaises(TimeoutError):w.main()
   with self.assertRaises(ValueError):w.main()
   self.assertEqual(command.call_count,1);self.assertIn('epsSourceUnreadable36Source='+'b'*64,command.call_args.args[0])

if __name__=='__main__':unittest.main()
