"""No provider construction; injected normal CLI command boundary only."""
from pathlib import Path
import copy,importlib.util,json,types,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_provider',HERE/'provider.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class Tests(unittest.TestCase):
 def fixture(self):
  value=p.Provider.__new__(p.Provider);calls=[]
  registry=types.SimpleNamespace(API={'project':'/v9/projects/'+p.PROJECT+'?teamId='+p.TEAM},DAEMON_REPO='repo_daemon')
  value.l=types.SimpleNamespace(registry=registry,cli=lambda args:['normal_cli',*args]);value.o=types.SimpleNamespace(ENDPOINT='/v1/observability/events?teamId='+p.TEAM,HEADER='x-vercel-observability-query-reason:cli/daemons-logs',OBSERVE_ENABLED=False)
  value.run=lambda args,*_:(calls.append(args)or b'{}');value.write=lambda *args:calls.append(('protected_write',args));value._path=lambda name:Path('D:/synthetic-closed-private')/name
  return value,calls
 def test_readonly_SQL_cannot_bypass_target_or_ambient_credential_denials(self):
  sql='begin isolation level repeatable read read only;select 1;rollback;';p.require_normal_sql(sql,p.s.a.TARGET,{})
  for target,env in(('foreign',{}),(p.s.a.TARGET,{'SUPABASE_ACCESS_TOKEN':'PRIVATE'}),(p.s.a.TARGET,{'SUPABASE_DB_PASSWORD':'PRIVATE'})):
   with self.assertRaises(ValueError):p.require_normal_sql(sql,target,env)
  with self.assertRaises(ValueError):p.require_normal_sql('select 1',p.s.a.TARGET,{})
 def test_API_rejects_wrong_project_private_creation_arbitrary_patch_and_log_header(self):
  value,calls=self.fixture();endpoint='/v10/projects/'+p.PROJECT+'/env?teamId='+p.TEAM
  attempts=[('GET','https://foreign.invalid',None,None),('POST',endpoint,{'key':'OPENAI_API_KEY','value':'a'*64,'type':'plain','target':['production']},None),('PATCH','/v9/projects/'+p.PROJECT+'/env/private?teamId='+p.TEAM,{'value':'PRIVATE_CREDENTIAL'},None),('POST',value.o.ENDPOINT,{},value.o.HEADER)]
  for args in attempts:
   with self.assertRaises(ValueError):value.api(*args)
  self.assertEqual(calls,[])
 def test_only_new_production_hash_records_use_closed_normalCLI_input(self):
  value,calls=self.fixture();body={'key':p.s.a.PUBLIC_DIGESTS[0],'value':'a'*64,'type':'plain','target':['production']}
  value.api('POST','/v10/projects/'+p.PROJECT+'/env?teamId='+p.TEAM,body)
  self.assertEqual(calls[0][0],'protected_write');self.assertEqual(calls[0][1][1],body);self.assertEqual(calls[1][0],'normal_cli');self.assertIn('--input',calls[1]);self.assertNotIn('a'*64,calls[1])
 def test_unset_template_cannot_construct_runtime_bindings(self):
  template=json.loads((HERE/'inputs.template.json').read_bytes())
  with self.assertRaises((ValueError,TypeError)):p.validate_inputs(template)
if __name__=='__main__':unittest.main()
