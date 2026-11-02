"""Pure fixed-SQL/source/admission tests. No private ACL/provider/listener execution."""
from pathlib import Path
import copy,hashlib,importlib.util,json,types,unittest,uuid
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('temporary_oauth_coordinator_bridge_test',HERE/'coordinator_bridge.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
PRINCIPAL='11111111-1111-4111-8111-111111111111'

def fixtures():
 run='44444444-4444-4444-8444-444444444444';pins={'coordinator.mjs':'a'*64};ref={'path':'tracking/evidence/m07/production-web-release/future-ready.json','sha256':'b'*64};source_ref={'path':'tracking/evidence/m07/production-web-release/future-source.json','sha256':'c'*64}
 paths=('apps/web/lib/mcp-auth.ts','apps/web/lib/mcp-http.ts','apps/web/app/mcp/route.ts');product=b'synthetic product'
 public={'APP_ENV':'production','EPS_RELEASE_MODE':'production','NODE_ENV':'production','APP_BASE_URL':'https://'+m.ALIAS,'SUPABASE_URL':'https://'+m.TARGET+'.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_synthetic_public_value'}
 gates={'public_build_environment':public,'source':source_ref,'source_commit':'d'*40,'source_sha256':'e'*64,'canonical':{'sha256':'f'*64}};plan={'run_id':'55555555-5555-4555-8555-555555555555','gates':gates,'source_pins':{'web':'1'*64}}
 encode=lambda value:json.dumps(value,sort_keys=True,separators=(',',':')).encode();build={'result':'passed','quality_only':True,'plan_sha256':m.sha(encode(plan)),'source_pins':plan['source_pins']}
 deployment={'state':'READY','id':'dpl_IndependentSynthetic1234','url':'synthetic.vercel.app','project_id':m.PROJECT,'team_id':m.TEAM,'meta':{'epsSourceCommit':gates['source_commit'],'epsSourceManifest':gates['source_sha256'],'epsProductionWebRun':plan['run_id'],'epsProductionWebBuild':m.sha(encode(build)),'epsProductionWebCanonical':gates['canonical']['sha256']}}
 ready={'result':'passed','stable_alias_matches':True,'two_independent_reads_equal':True,'normal_process_return_observed':True,'deployment':deployment};source={'result':'passed','source_commit':gates['source_commit'],'source_sha256':gates['source_sha256'],'files':[{'path':name,'sha256':m.sha(product)}for name in paths]}
 owner={'status':'passed','request_principal_client_project_match':True,'server_receipt':{'client_id':m.CLIENT,'request_id':'23c439a1-4869-4228-a3f1-d4a6004ef4f0','principal_id':PRINCIPAL},'owner_result':{'request_id':'23c439a1-4869-4228-a3f1-d4a6004ef4f0'}}
 docs={str(m.MAIN/m.OWNER):owner,str(m.MAIN/'.local/production-web-release/plan.json'):plan,str(m.MAIN/'.local/production-web-release/build.json'):build,str(m.MAIN/'.local/production-web-release/inputs.json'):{'public_build_environment':public,'source_receipt':source_ref}}
 inputs={'run':run,'source_pins':pins,'web_ready_receipt':ref};j=types.SimpleNamespace(run=run,read=lambda name:copy.deepcopy(inputs),s=types.SimpleNamespace(secure=types.SimpleNamespace(verify=lambda file:None)))
 def load(file,maximum=0):return product if str(file).replace('\\','/').endswith(paths)else encode(docs[str(file)])
 def reference(value):return copy.deepcopy(ready if value==ref else source)
 return j,pins,docs,ready,load,reference

class Tests(unittest.TestCase):
 def test_live_query_and_deployment_entries_refuse_before_auth_source_or_private_read(self):
  self.assertIs(m.LIVE_ENABLED,False)
  with patch.object(Path,'read_text',side_effect=AssertionError('private read')),patch.object(m,'load',side_effect=AssertionError('source read')):
   for kind in('preflight','inventory'):
    with self.assertRaisesRegex(ValueError,'TEMP_OAUTH_COORDINATOR_BRIDGE_REFUSED'):m.query_metadata(None,{},kind)
   with self.assertRaises(ValueError):m.deployment_read({},m.ALIAS)
 def test_actual_preflight_wire_parses_and_selects_no_credentials_or_token_table(self):
  from pglast import parse_sql
  query=m.preflight_sql(PRINCIPAL);parse_sql(query);self.assertTrue(query.startswith('begin isolation level repeatable read read only;'));self.assertTrue(query.endswith('rollback;'))
  for absent in('refresh_tokens','encrypted_password','client_secret','select *','set role','insert into','update auth','delete from'):self.assertNotIn(absent,query.lower())
  for present in('auth.oauth_clients','eps.mcp_oauth_resources','public.app_capability_grants','public.project_memberships','history39'):self.assertIn(present,query)
  with self.assertRaises(ValueError):m.preflight_sql("x';drop table auth.users;--")
 def test_exact_private_web_source_build_owner_and_publishable_key_binding(self):
  j,pins,docs,ready,load,reference=fixtures()
  with patch.object(m,'seal',return_value=pins),patch.object(m,'load',side_effect=load),patch.object(m,'reference',side_effect=reference):
   result=m.context(j);self.assertEqual(result['principal'],PRINCIPAL);self.assertTrue(result['publishable_key'].startswith('sb_publishable_'))
   ready['deployment']['meta']['epsSourceManifest']='0'*64
   with self.assertRaises(ValueError):m.context(j)
  j,pins,docs,ready,load,reference=fixtures();key=str(m.MAIN/'.local/production-web-release/inputs.json');docs[key]['public_build_environment']['SUPABASE_PUBLISHABLE_KEY']='sb_secret_forbidden'
  with patch.object(m,'seal',return_value=pins),patch.object(m,'load',side_effect=load),patch.object(m,'reference',side_effect=reference):
   with self.assertRaises(ValueError):m.context(j)
  j,pins,docs,ready,load,reference=fixtures()
  with patch.object(m,'seal',return_value={'coordinator.mjs':'0'*64}),patch.object(m,'load',side_effect=AssertionError('must refuse first')):
   with self.assertRaises(ValueError):m.context(j)
 def test_frozen_ten_file_primitives_unchanged_and_new_callback_copy_is_finite(self):
  root=HERE.parents[2];receipt=json.loads((root/'tracking/evidence/m07/temporary-oauth-lifecycle/source-validation.json').read_text())
  for relative,digest in receipt['source_files'].items():self.assertEqual(hashlib.sha256((root/relative).read_bytes()).hexdigest(),digest,relative)
  original=(HERE/'owner_callback.mjs').read_text();current=(HERE/'coordinator_callback.mjs').read_text();self.assertEqual(current.split('\n',1)[1],original.split('\n',1)[1]);self.assertIn('export const LIVE_ENABLED=false;',current)
 def test_actual_owned_private_journal_has_protected_acl_and_permanent_immutable_phase(self):
  run=str(uuid.uuid4());j=m.Journal(run);target=j.s.root.resolve();self.assertTrue(target.is_relative_to((m.MAIN/'.local/temporary-oauth-lifecycle').resolve())and target.name==run)
  try:
   j.create('refresh.claim',{'id':'synthetic','private':'SYNTHETIC_ONLY'});j.s.secure.verify(j.path('refresh.claim'));self.assertEqual(j.read('refresh.claim')['id'],'synthetic')
   with self.assertRaises(Exception):j.create('refresh.claim',{'id':'replacement'})
   self.assertFalse(j.exists('refresh.normal'))
   with self.assertRaises(ValueError):j.path('../escape')
  finally:
   for file in target.iterdir():self.assertTrue(file.is_file()and not file.is_symlink()and file.resolve().parent==target);file.unlink()
   target.rmdir()

if __name__=='__main__':unittest.main()
