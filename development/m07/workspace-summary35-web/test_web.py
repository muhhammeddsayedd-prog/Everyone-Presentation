"""Inert release guards; no Git, npm, CLI, network or provider calls."""
import copy,importlib.util,json,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch,Mock
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('summary35_web',HERE/'web.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)

class Tests(unittest.TestCase):
 def public(self):return {'EPS_RELEASE_MODE':'controlled_pilot','APP_ENV':'staging','APP_BASE_URL':'https://'+w.old.ALIAS,
  'CENTRAL_ADAPTER_MODE':'supabase','NODE_ENV':'production','EPS_PILOT_OWNER_CONTROLLED':'true',
  'SUPABASE_URL':'https://pyibofyctwnqpvktepse.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_SYNTHETIC_PUBLIC_ONLY'}
 def test_build_environment_is_public_only_and_owner_controlled(self):
  w.public_environment(self.public())
  for patch_value in [{'OPENAI_API_KEY':'PRIVATE'},{'VERCEL_TOKEN':'PRIVATE'},{'SUPABASE_PUBLISHABLE_KEY':'service_role_private'},
   {'APP_BASE_URL':'http://localhost:3000'},{'EPS_PILOT_OWNER_CONTROLLED':'false'}]:
   value=self.public();value.update(patch_value)
   with self.assertRaises(ValueError):w.public_environment(value)
 def test_metadata_never_retains_environment_values(self):
  row={'id':'env_test','key':'PRIVATE_KEY','type':'sensitive','target':['production'],'value':'PRIVATE_NOT_RETURNED',
   'gitBranch':None,'customEnvironmentIds':[],'createdAt':1,'updatedAt':2}
  value=w.environment_rows({'envs':[row],'pagination':None});self.assertNotIn('PRIVATE_NOT_RETURNED',str(value))
  with self.assertRaises(ValueError):w.environment_rows({'envs':[row,row]})
  with self.assertRaises(ValueError):w.environment_rows({'envs':[row],'pagination':{'next':'more'}})
 def test_stage_checks_actual_dynamic_inventory_not_an_assumed_count(self):
  rows=[{'path':path,'sha256':'a'*64,'bytes':1}for path in sorted(w.REQUIRED)]
  w.validate_rows(rows)
  for bad in [[r for r in rows if r['path']!='apps/web/lib/workspace-summary-http.ts'],rows+[{'path':'../private','sha256':'a'*64,'bytes':1}],
   rows+[{'path':'apps/web/.env.local','sha256':'a'*64,'bytes':1}]]:
   with self.assertRaises(ValueError):w.validate_rows(bad)
 def test_production_build_and_deploy_commands_keep_pull_and_secret_flags_absent(self):
  root=w.PRIVATE/'synthetic'/'build';install,build=w.build_commands(root)
  self.assertIn('--ignore-scripts',install);self.assertIn('--workspace',build);self.assertIn('@eps/web',build);self.assertNotIn(str(w.old.CLI),build)
  self.assertNotIn('--yes',build);self.assertNotIn('--deployment',build);self.assertNotIn('pull',build)
  command=w.deploy_command(root,'a'*64,'b'*64,'c'*64)
  self.assertNotIn('--prebuilt',command);self.assertIn('--prod',command);self.assertIn(w.old.PROJECT,command);self.assertIn(str(root),command)
  self.assertFalse(any(key in command for key in ['--token','--env','--build-env']))
  with patch.dict(w.os.environ,{'DEBUG':'PRIVATE','NODE_OPTIONS':'PRIVATE','OPENAI_API_KEY':'PRIVATE','VERCEL_TOKEN':'PRIVATE'}):
   environment=w.build_environment(self.public(),root)
   self.assertFalse({'DEBUG','NODE_OPTIONS','OPENAI_API_KEY','VERCEL_TOKEN'}&set(environment))
 def test_installed_source_deploy_declares_exact_project_and_production_flags(self):
  for path,digest_value in w.CLI_HELPERS.items():self.assertEqual(w.sha(w.old.load(w.old.CLI.parent/path)),digest_value)
  declarations=w.old.load(w.old.CLI.parent/'chunks/chunk-2PYFJXKS.js').decode('utf8');section=declarations[declarations.index('deployCommand='):]
  section=section[:section.index('examples:')]
  self.assertIn('{...projectOption,description:"Project name or ID to deploy to',section)
  self.assertIn('name:"prod"',section);self.assertIn('name:"no-wait"',section)
 def test_public_prepare_receipt_never_contains_the_actual_publishable_environment_value(self):
  value={'run_id':'SYNTHETIC','source':{'path':'SYNTHETIC','sha256':'a'*64},'source_pins':{},'public_build_environment':self.public()}
  receipt=w.public_plan_receipt(value,'b'*64)
  self.assertNotIn(self.public()['SUPABASE_PUBLISHABLE_KEY'],json.dumps(receipt));self.assertFalse(receipt['environment_values_persisted'])
  self.assertTrue(receipt['publishable_key_present']);self.assertEqual(receipt['plan_sha256'],'b'*64)
 def test_ready_pair_must_match_actual_new_source_quality_and_alias(self):
  row={'id':'dpl_'+'a'*28,'state':'READY','source_sha256':'b'*64,'quality_sha256':'c'*64,'canonical_sha256':'d'*64}
  self.assertEqual(w.ready(row,copy.deepcopy(row),'b'*64,'c'*64,'d'*64),row)
  for change in [{'id':w.CURRENT},{'state':'BUILDING'},{'source_sha256':'e'*64},{'quality_sha256':'e'*64}]:
   with self.assertRaises(ValueError):w.ready({**row,**change},{**row,**change},'b'*64,'c'*64,'d'*64)
 def test_exclusive_claim_precedes_one_dispatch_and_no_private_transfer(self):
  source=(HERE/'web.py').read_text(encoding='utf8')
  self.assertLess(source.index("exclusive(CLAIM"),source.index("raw=old.command(deploy_command"))
  self.assertNotIn("env pull",source);self.assertNotIn("--build-env",source);self.assertNotIn("--token",source)
  self.assertNotIn('unlink(',source);self.assertIn('need(DEPLOY_ENABLED and ',source);self.assertIsInstance(w.DEPLOY_ENABLED,bool)
 def test_actual_root_sparse_snapshot_is_current_without_git_or_provider(self):
  receipt=w.ROOT/'tracking/evidence/m07/controlled-pilot/2026-11-01T00-40-04-581Z-c49c2253-web-source.json'
  doc=json.loads(receipt.read_bytes());w.validate_rows(doc['files'])
  self.assertEqual(doc['entries'],282);self.assertEqual(doc['bytes'],3047075);self.assertEqual(doc['private_hits'],0)
  self.assertEqual(doc['harness_sha256'],w.STAGE_SHA);self.assertFalse(doc['deployed']);self.assertTrue(doc['source_stable']);self.assertTrue(doc['private_input_stable'])
  folder=w.ROOT/doc['source_root']
  for row in doc['files']:
   staged=w.old.load(folder/row['path']);self.assertEqual(len(staged),row['bytes']);self.assertEqual(w.sha(staged),row['sha256']);self.assertEqual(w.sha(w.old.load(w.ROOT/row['path'])),row['sha256'])
  self.assertEqual(json.loads(w.old.load(folder/'.vercel/project.json')),{'projectId':w.old.PROJECT,'orgId':w.old.TEAM,'projectName':'everyone-presentation-pilot'})
 def test_actual282_manifest_serializer_matches_frozen_build_validator_without_git(self):
  receipt=w.ROOT/'tracking/evidence/m07/controlled-pilot/2026-11-01T00-40-04-581Z-c49c2253-web-source.json'
  doc=json.loads(receipt.read_bytes());build={'result':'passed','action':'build','files':doc['files'],'source_sha256':w.digest(doc['files'])}
  with patch.object(w.old,'source_rows',return_value=doc['files']):
   self.assertEqual(w.old.validate_stage(doc,build),w.ROOT/doc['source_root'])
   altered={**build,'source_sha256':w.sha(json.dumps(doc['files'],separators=(',',':')).encode())}
   self.assertNotEqual(altered['source_sha256'],build['source_sha256'])
   with self.assertRaises(ValueError):w.old.validate_stage(doc,altered)
  self.assertEqual(w.sealed_source_files(w.ROOT/doc['source_root']),sorted([r['path']for r in doc['files']]+['.vercel/project.json']))
 def test_source_entry_seal_rejects_link_or_junction_directories_before_following_them(self):
  folder=w.ROOT/'.local/SYNTHETIC_SOURCE';normal=folder/'file.ts';extra=folder/'extra';outside=Path('C:/SYNTHETIC_OUTSIDE')
  def checks(kind):
   return (patch.object(Path,'iterdir',autospec=True,side_effect=lambda path:iter([normal,extra])if path==folder else (_ for _ in () )),
    patch.object(Path,'is_dir',autospec=True,side_effect=lambda path:path in(folder,extra)),
    patch.object(Path,'is_file',autospec=True,side_effect=lambda path:path==normal),
    patch.object(Path,'is_symlink',autospec=True,side_effect=lambda path:path==extra and kind=='symlink'),
    patch.object(Path,'is_junction',autospec=True,side_effect=lambda path:path==extra and kind=='junction'),
    patch.object(Path,'resolve',autospec=True,side_effect=lambda path:outside if path==extra and kind=='escape'else path))
  for kind in ['symlink','junction','escape']:
   from contextlib import ExitStack
   with ExitStack()as stack:
    mocks=[stack.enter_context(item)for item in checks(kind)]
    with self.assertRaises(ValueError):w.sealed_source_files(folder)
    self.assertFalse(any(call.args[0]==extra for call in mocks[0].call_args_list))
 def test_canonical_admission_requires_real_successful_apply_and_matching_committed_readback(self):
  static={'schema':'SYNTHETIC35'}
  helper=SimpleNamespace(VERSION='20261031182038',MIGRATION_SHA='cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0',check_after=Mock(),read_static_state=Mock(return_value=static))
  raw=b'SYNTHETIC_HELPER';doc={'target':'pyibofyctwnqpvktepse','action':'apply','result':'passed','normal_return_marker_observed':True,
   'independent_readback_verified':True,'claim_retained':True,'first':{'data':'ACTUAL_APPLY_METADATA_ONLY','static_schema':static},'second':{'data':'ACTUAL_APPLY_METADATA_ONLY','static_schema':static},
   'before':{'static_schema':{'schema':'SYNTHETIC34'}},'static_schema_before':{'schema':'SYNTHETIC34'},'static_schema_after':static,'source_pins':{w.CANONICAL_HELPER:w.sha(raw)}}
  loader=SimpleNamespace(loader=SimpleNamespace(exec_module=lambda module:None))
  with patch.object(w,'reference',return_value=doc),patch.object(w.old,'load',return_value=raw),patch.object(w.importlib.util,'spec_from_file_location',return_value=loader),patch.object(w.importlib.util,'module_from_spec',return_value=helper):
   self.assertEqual(w.canonical({'synthetic':True},True),w.digest(static));helper.check_after.assert_called_once_with(doc['first'],doc['before'])
   # Only metadata is requested live. Ordinary post-apply job/ledger data is not
   # part of this read API or compared against the historical apply snapshot.
   self.assertFalse(hasattr(helper,'read_state'))
   helper.read_static_state.return_value={'changed':True}
   with self.assertRaises(ValueError):w.canonical({'synthetic':True},True)
   for change in [{'result':'unconfirmed'},{'normal_return_marker_observed':False},{'independent_readback_verified':False},{'target':'other'},{'second':{'changed':True}}]:
    with patch.object(w,'reference',return_value={**doc,**change}):
     with self.assertRaises(ValueError):w.canonical({'synthetic':True})
 def test_actual_dispatch_path_claims_once_and_an_ambiguous_process_never_replays(self):
  value={'run_id':'12345678-1234-4234-8234-123456789abc','source':{'path':'synthetic','sha256':'a'*64},'public_build_environment':self.public()}
  doc={'source_sha256':'a'*64,'quality_output':{'quality_only':True}};bound={'canonical':{'sha256':'c'*64}};before={'SYNTHETIC':True}
  for ambiguous in [False,True]:
   events=[];state={'claimed':False};claim_path=Mock(exists=lambda:state['claimed']);returned_path=Mock(exists=lambda:False)
   def exclusive(path,payload):
    events.append('claim'if path is claim_path else'returned')
    if path is claim_path:state['claimed']=True
   def command(*args,**kwargs):
    events.append('dispatch')
    if ambiguous:raise ValueError('SYNTHETIC_UNCERTAIN')
    return 'https://everyone-presentation-pilot-synthetic.vercel.app\n'
   with patch.object(w,'DEPLOY_ENABLED',True),patch.object(w.sys,'argv',['web.py','deploy']),patch.object(w,'plan',return_value=value),patch.object(w,'stage',return_value=({},w.ROOT/'.local/m07-pilot/web-source-SYNTHETIC')),patch.object(w,'build_receipt',return_value=doc),patch.object(w,'observe',return_value=before),patch.object(w,'admission',return_value=bound),patch.object(w,'source_pins',return_value={}),patch.object(w.old,'load',side_effect=lambda path:b'{"SYNTHETIC":true}'if path==w.INSPECT else b'PUBLIC_HASH_BYTES'),patch.object(w,'CLAIM',claim_path),patch.object(w,'RETURNED',returned_path),patch.object(w,'exclusive',side_effect=exclusive),patch.object(w.old,'command',side_effect=command),patch('builtins.print'):
    if ambiguous:
     with self.assertRaises(ValueError):w.main()
    else:w.main()
    self.assertEqual(events,['claim','dispatch']if ambiguous else['claim','dispatch','returned'])
    with self.assertRaises(ValueError):w.main()
    self.assertEqual(events.count('dispatch'),1)

if __name__=='__main__':unittest.main()
