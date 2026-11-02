"""Source/fake-private-file checks only; never SQL, Docker or provider calls."""
from pathlib import Path
import base64,copy,hashlib,importlib.util,json,re,subprocess,sys,tempfile,types,unittest
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
p=module('test_acl_context',HERE/'context.py');local=module('test_acl_local',HERE/'local.py');compiler=module('test_acl_compiler',HERE/'compiler.py');entry=module('test_acl_entry',HERE/'release.py');fixture=module('test_acl_before',p.typed.PRIOR/'test_release.py')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.old=p.typed.Context();cls.c=p.Context();fixture.TestRelease.c=p.base.Context()
 def before(self):
  value=fixture.TestRelease().before();value['canonical']['base'].update(database='project39',cli_role_safe=False,protected_m02_integrity=False,protected_m02={'synthetic_fixture':'only'});return value
 def test_acl_shape_only_changes_new_acl_requirement_and_three_shape_fields(self):
  self.assertEqual(p.base.replace_once(self.c.reason_sql(),p.NEW,p.OLD),self.old.reason_sql());self.assertEqual(p.base.replace_once(self.c.state_sql(),p.NEW,p.OLD),self.old.state_sql());self.assertEqual(p.base.replace_once(self.c.checkpoint_sql(),p.NEW,p.OLD),self.old.checkpoint_sql());self.assertEqual(self.c.c.identity_sql(),self.old.c.identity_sql());self.assertEqual(self.c.original_catalogue,self.old.original_catalogue)
  reference={'attname':'request_id','attnum':5,'attacl':['eps_specs_submit_owner=r/postgres'],'atttypid':25,'attnotnull':False};reason={**reference,'attname':'reason','attnum':9,'attacl':None};ignore={'attname','attnum','attacl'}
  self.assertEqual({k:v for k,v in reason.items()if k not in ignore},{k:v for k,v in reference.items()if k not in ignore});self.assertIsNone(reason['attacl']);self.assertIsNotNone(reference['attacl']);self.assertIn('a.attacl is null',self.c.reason_sql());self.assertNotIn('reference.attacl is null',self.c.reason_sql())
 def test_diagnostic_has_same_guarded_ddl_but_rolls_back_without_post_guard_or_nonce(self):
  before=self.before();run='734df9f4-7bc5-405d-9548-fba3ef7fb439';value={'before':before,'run':run,'system':'999111222333444555','marker':'97c37609-4166-4fa8-bff8-a53bacda635e'};result=local.dispatch('render',value);c=local.OwnedContext().bind(before,value['system'],run)
  self.assertTrue(result['sql']==c.render(before,value['marker']),'positive rendered bytes changed');self.assertEqual(result['sql'].count('commit;'),1);self.assertTrue('REASON40_POSTIMAGE_CHANGED'in result['sql']);self.assertTrue('commit;'not in result['diagnostic_sql']);self.assertTrue(result['diagnostic_sql'].endswith('rollback;'));self.assertTrue('REASON40_POSTIMAGE_CHANGED'not in result['diagnostic_sql']);self.assertTrue(c.migration.decode().split('-- BEGIN REASON40 FUNCTIONAL CHANGE',1)[1].split('-- END REASON40 FUNCTIONAL CHANGE',1)[0]in result['diagnostic_sql']);self.assertTrue('reason_attribute'in result['diagnostic_sql']);self.assertTrue('REASON40_PREIMAGE_CHANGED'in result['diagnostic_sql'])
  for sql in(result['sql'],result['diagnostic_sql']):
   parse_sql(sql)
   for body in re.findall(r'do \$reason40_assert\$(.*?)\$reason40_assert\$;',sql,re.S):self.assertEqual(len(parse_plpgsql('create function pg_temp.check_acl()returns void language plpgsql as $body$'+body+'$body$;')),1)
 def test_differences_are_bounded_typed_paths_and_hashes_without_values(self):
  differences,truncated=local.differing_paths({'reason':{'shape_valid':True},'secret':'expected-private-value'},{'reason':{'shape_valid':1},'secret':'actual-private-value'})
  self.assertEqual([d['path']for d in differences],[['reason','shape_valid'],['secret']]);self.assertFalse(truncated);self.assertNotIn('private-value',json.dumps(differences));self.assertTrue(all(re.fullmatch('[a-f0-9]{64}',d['actual_sha256'])for d in differences))
  differences,truncated=local.differing_paths({str(i):0 for i in range(101)},{str(i):1 for i in range(101)});self.assertEqual(len(differences),100);self.assertTrue(truncated)
 def test_fake_private_diagnostic_claim_is_once_only_capture_precedes_diff_result(self):
  with tempfile.TemporaryDirectory()as temporary:
   source=Path(temporary).resolve();run='734df9f4-7bc5-405d-9548-fba3ef7fb439';folder=source/'.local/reason40-acl-collector-validation'/run;folder.mkdir(parents=True);self.assertTrue(folder.resolve().is_relative_to(source))
   class Guard:
    def create(self,path):return path.open('xb')
    def verify_open(self,stream):pass
    def verify(self,path):self.asserted=path.is_file()
   expected={'reason':{'shape_valid':True}};context=types.SimpleNamespace(source=source,b=types.SimpleNamespace(security=lambda:Guard()),bind=lambda*a:context,expected=lambda before:expected,transition=lambda before,after:None)
   value={'before':{'synthetic':'before'},'run':run,'system':'999111222333444555'}
   with patch.object(local,'OwnedContext',return_value=context):
    self.assertEqual(local.dispatch('diagnostic_claim',value)['result'],'claimed')
    with self.assertRaises(FileExistsError):local.dispatch('diagnostic_claim',value)
    result=local.dispatch('diagnose',{**value,'observed':{'state':{'reason':{'shape_valid':False}},'reason_attribute':{'synthetic':'private-attribute-value'},'reference_attribute':{'attacl':['retained']}}})
   self.assertEqual(result['result'],'differs');self.assertEqual(result['difference_count'],1);self.assertFalse(result['commit_nonce_claimed']);self.assertNotIn('private-attribute-value',json.dumps(result));saved=json.loads((folder/'diagnostic-poststate.json').read_bytes());self.assertEqual(saved['reason_attribute']['synthetic'],'private-attribute-value');self.assertFalse(saved['canonical_checkpoint'])
 def test_compiled_case_delta_is_closed_and_diagnostic_precedes_unchanged_commit(self):
  source,cfg,library,cases=compiler.compile_source('.local/reason40-acl-collector-source/offline.mjs');old=compiler.module('acl_inverse_typed_compiler',p.TYPED/'compiler.py');_,oldcfg,_,priorcases=old.compile_source('.local/reason40-acl-collector-source/offline.mjs')
  restored=p.base.replace_once(cases,compiler.DIAGNOSTIC,'');restored=p.base.replace_once(restored,"['configuration','render','compare','diagnostic_claim','diagnose']","['configuration','render','compare']");restored=p.base.replace_once(restored,'new URL('+json.dumps((HERE/'local.py').as_uri())+')','new URL('+json.dumps((p.TYPED/'local.py').as_uri())+')');self.assertEqual(restored,priorcases)
  self.assertLess(cases.index("bridge('diagnostic_claim'"),cases.index('query(rendered.diagnostic_sql)'));self.assertLess(cases.index('REASON40_DIAGNOSTIC_POSTIMAGE_DIFFERS'),cases.index('query(rendered.sql)'));self.assertEqual(cases.count('query(rendered.sql)'),1);self.assertIn('eps.reason40acl.run',source);self.assertEqual(cfg['config_setup_sql'],oldcfg['config_setup_sql']);self.assertEqual(cfg['qualification_sql'],oldcfg['qualification_sql']);self.assertFalse(library.exists())
  for text in(source,cases):self.assertEqual(subprocess.run(['C:/Program Files/nodejs/node.exe','--check','--input-type=module'],input=text.encode(),capture_output=True,timeout=10).returncode,0)
 def test_new_entry_and_wrapper_are_default_off_before_target(self):
  script='const m=await import('+json.dumps((HERE/'cases.mjs').as_uri())+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  self.assertEqual(subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',script],capture_output=True,timeout=10).returncode,0);self.assertEqual(subprocess.run([sys.executable,'-B',str(HERE/'release.py'),'prepare','48e88fe1-987e-4692-82dd-07ead832f0b6'],capture_output=True,timeout=10).returncode,1);self.assertFalse(entry.READ_ENABLED);self.assertFalse(entry.APPLY_ENABLED);self.assertFalse(entry.prior.r.READ_ENABLED);self.assertFalse(entry.prior.r.APPLY_ENABLED)
 def test_fake_case_flow_never_commits_on_diagnostic_difference(self):
  _,_,_,cases=compiler.compile_source('.local/reason40-acl-collector-source/fake-flow.mjs');start=cases.index('export async function bridge(');end=cases.index('\nexport async function runCases',start);cases=cases[:start]+"export async function bridge(action,value,root){return globalThis.__aclTestBridge(action,value,root);}\n"+cases[end:];url='data:text/javascript;base64,'+base64.b64encode(cases.encode()).decode()
  script="""import assert from 'node:assert/strict';const {runCases}=await import(MODULE);
async function exercise(diff){let phase=false,commits=0,claims=0,marker;const before={synthetic:'before'},after={synthetic:'after'};
 globalThis.__aclTestBridge=async(action,value)=>{if(action==='render'){marker=value.marker;return{sql:'GUARDED_COMMIT',negative_sql:'NEGATIVE_PREIMAGE',diagnostic_sql:'DIAGNOSTIC_ROLLBACK',expected:after,canonical_render_sha256:'a'.repeat(64),owned_render_sha256:'b'.repeat(64),only_database_system_run_admission_changed:true};}if(action==='diagnostic_claim'){claims++;return{result:'claimed',claim:{synthetic:true}};}if(action==='diagnose')return{result:diff?'differs':'passed',difference_count:diff?1:0,differences:diff?[{path:['reason','shape_valid'],expected_sha256:'a'.repeat(64),actual_sha256:'b'.repeat(64)}]:[],truncated:false};if(action==='compare')return{result:'passed'};throw Error('wrong fake action');};
 const ctx={root:'synthetic-only',system:'999111222333444555',runId:'734df9f4-7bc5-405d-9548-fba3ef7fb439',report:{},inspect:async()=>{},sql:async text=>{let result;if(text.endsWith('NEGATIVE_PREIMAGE'))throw Object.assign(Error('negative'),{diagnostic:{stderr:'REASON40_PREIMAGE_CHANGED'}});if(text.endsWith('DIAGNOSTIC_ROLLBACK'))result={state:after,reason_attribute:{},reference_attribute:{}};else if(text.endsWith('GUARDED_COMMIT')){commits++;phase=true;result={version:'20261102085405',marker,migration_sha256:'c'.repeat(64)};}else if(text.includes('CHECKPOINT'))result={state:phase?after:before};else if(text.includes('SNAPSHOT'))result=phase?after:before;else throw Error('wrong fake SQL');return{stdout:JSON.stringify(result)+'\\n'};}};
 const cfg={source_pins:{},state_sql:'SNAPSHOT',checkpoint_sql:'CHECKPOINT',migration_sha256:'c'.repeat(64)};
 if(diff)await assert.rejects(runCases(ctx,cfg),/REASON40_DIAGNOSTIC_POSTIMAGE_DIFFERS/);else await runCases(ctx,cfg);assert.equal(claims,1);assert.equal(commits,diff?0:1);assert.equal(ctx.report.diagnostic_rollback.rolled_back_preimage_exact,true);}
await exercise(true);await exercise(false);
""".replace('MODULE',json.dumps(url))
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',script],capture_output=True,timeout=15);self.assertEqual(result.returncode,0,result.stderr.decode()[:800])

if __name__=='__main__':unittest.main()
