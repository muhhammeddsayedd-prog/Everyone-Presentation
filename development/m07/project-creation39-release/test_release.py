"""Pure tests: no cloud, CLI, private backup or old operator main execution."""
from pathlib import Path
import copy, importlib.util, json, unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('project39_operator_tests',HERE/'release.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
PRIMARY=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.c=r.s.Context(PRIMARY,HERE)
  fixture=json.loads(r.s.load(PRIMARY/'tracking/evidence/m07/specs-diagnostic-worker38-adoption/2026-11-01T20-00-58-621223Z-resume.json'))['first']
  base=fixture['state'];base.pop('catalogue');base.pop('schema')
  cls.before={'base':base,'processing_config':fixture['config'],'lifecycle':fixture['lifecycle'],'project39':{'remaining_catalogue':{'count':17729,'sha256':'a'*64},'old_identities':{'count':1000,'sha256':'b'*64},'delta':cls.c.project(False),'creator_direct_grants':[],'creator_owners':[],'new_function_metadata':cls.c.expected_functions(False),'creator_no_create':True,'intent_rows':None}}
 def test_precise_local_footprint_and_transition(self):
  self.c.check(self.before);self.assertEqual(len(self.c.keys),143);self.assertEqual(len(self.c.inventory),21)
  for bootstrap in(True,False):self.c.transition(self.before,self.c.after(self.before,bootstrap))
 def test_row_permission_history_oid_and_unknown_delta_drift_fail(self):
  for mutate in[
   lambda v:v['base']['data']['public.projects'].update(count=999),lambda v:v['project39']['old_identities'].update(sha256='0'*64),
   lambda v:v['project39']['creator_direct_grants'].append({'kind':'schema','identity':'private','grantor':'postgres','privilege':'CREATE','grantable':False}),
   lambda v:v['base']['history'].append('20990101000000'),lambda v:v['project39']['delta'].update({'unexpected':{'present':True,'value':True}}),
   lambda v:v['project39']['remaining_catalogue'].update(sha256='0'*64),lambda v:v['processing_config']['specs_pipeline_config']['public'].update(enabled=False),
   lambda v:v['project39']['new_function_metadata']['public.eps_create_project(jsonb,text)'].update(retset=True)]:
   changed=self.c.after(self.before);mutate(changed)
   with self.assertRaises(ValueError):self.c.transition(self.before,changed)
 def test_sql_compiles_and_retains_atomic_guard_and_nonce(self):
  import pglast
  operator=r.Release(self.c);sql=operator.render(self.before,'11111111-1111-4111-8111-111111111111');pglast.parse_sql(sql)
  self.assertIn('PROJECT39_PREFLIGHT_CHANGED',sql);self.assertIn('PROJECT39_POSTCONDITION_FAILED',sql);self.assertIn("commit;select jsonb_build_object",sql)
  self.assertEqual(sql.count('create role eps_project_creator'),1);self.assertNotIn('db push',sql)
 def test_disabled_apply_cannot_read_or_dispatch(self):
  operator=r.Release(self.c);operator.read=lambda _path:self.fail('Disabled apply must not read private files')
  with patch.object(r,'APPLY_ENABLED',False):
   with self.assertRaises(ValueError):operator.apply()
 def test_actual_local_query_proof_binds_current_query_sources_and_cleanup(self):
  proof=json.loads(r.s.load(self.c.proof_root/r.GUARD));operator=r.Release(self.c);operator.check_query_proof(proof)
  changed=copy.deepcopy(proof);changed['owned_database_absent']=False
  with self.assertRaises(ValueError):operator.check_query_proof(changed)
  changed=copy.deepcopy(proof);changed['guard_source_pins']['development/m07/project-creation39-release/state.py']='0'*64
  with self.assertRaises(ValueError):operator.check_query_proof(changed)
 def test_single_dispatch_normal_marker_and_two_readbacks_are_all_required(self):
  for outcome in('normal','lost_return','wrong_marker'):
   memory={};calls=[];c=self.c
   class File:
    def exists(inner):return inner in memory
   operator=r.Release(c);operator.plan=File();operator.claim=File();operator.returned=File()
   pins={'synthetic':'a'*64};admission={'synthetic':True};memory[operator.plan]={'target':r.s.TARGET,'version':r.s.VERSION,'source_pins':pins,'admission':admission,'before':copy.deepcopy(self.before)}
   operator.read=lambda file:copy.deepcopy(memory[file])
   operator.write=lambda file,value:memory.__setitem__(file,copy.deepcopy(value))
   operator.admission=lambda:admission
   operator.read_state=lambda installed=False:copy.deepcopy(c.after(self.before)if installed else self.before)
   def query(_sql,label):
    calls.append(label);self.assertIn(operator.claim,memory)
    if outcome=='lost_return':raise ValueError('Synthetic lost return')
    return {'version':r.s.VERSION,'marker':memory[operator.claim]['marker']if outcome=='normal'else'wrong','migration_sha256':c.migration_sha}
   operator.query=query
   with patch.object(r,'APPLY_ENABLED',True),patch.object(c,'source_pins',lambda:pins),patch.object(r.s,'load',lambda file:json.dumps(memory[file],sort_keys=True).encode()):
    result=operator.apply();self.assertEqual(calls,['apply']);self.assertTrue(result['two_independent_readbacks_equal'])
    self.assertEqual(result['result'],'passed'if outcome=='normal'else'unconfirmed')
    with self.assertRaises(ValueError):operator.apply()
    self.assertEqual(calls,['apply'])

if __name__=='__main__':unittest.main()
