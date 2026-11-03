"""Retained actual state validators; raw checkpoint rows are synthetic only."""
from pathlib import Path
import copy,importlib.util,json,subprocess,tempfile,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
m=module('acl_collector_compiler_test',HERE/'compiler.py');local=module('acl_collector_local_test',HERE/'local.py')
INPUT='.local/logo-info-collector-alias-proof/c8792790-efe3-4368-bb30-44ccb45f19d4/bridge-check-83b76609-e6c1-44b6-8ee5-edbb8caa1932-input.json'
INPUT_SHA='f7a22df2c058d96ffc278f1ac73fcd6b9920c30fcbea01e928475ec0141527e2'
MARKER='8a200000-0000-4000-8000-000000000001'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  raw=local.s.load(MAIN/INPUT);local.s.need(local.s.sha(raw)==INPUT_SHA);cls.value=json.loads(raw)
  cls.c=local.Context().bind(cls.value['initial'],cls.value['system'],cls.value['run'])
  cls.after=cls.c.expected(cls.value['initial'])
  cls.release=module('acl_collector_full_checkpoint_library',MAIN/'development/m07/logo-info-canonical-release/release.py')
 def request(self,**extra):return {**copy.deepcopy(self.value),**extra}
 def test_actual_original_RED_new_full_strict_check_expected_transition_GREEN(self):
  with self.assertRaises(ValueError):local.prior.Context().bind(self.value['initial'],self.value['system'],self.value['run'])
  self.assertTrue(local.dispatch('check',self.value)=={'result':'passed'})
  self.c.check(self.after,True);self.assertTrue(all(self.c.transition(self.value['initial'],self.after).values()))
  self.assertTrue(local.Context.bind.__code__ is local.frozen.__code__)
  self.assertIsNot(local.Context.bind.__globals__,local.frozen.__globals__)
  self.assertTrue(local.dispatch.__code__ is local.prior.dispatch.__code__)
  state=self.value['initial']['compatibility']['schema40']
  self.assertEqual(state['canonical']['base']['data']['audit_events']['count'],14)
  self.assertEqual(state['reason']['historical_nonnull'],2)
 def test_complete_ACL_not_unknown_extra_missing_or_order_accepted(self):
  for mode in('public_usage','extra','missing_other','reordered'):
   changed=copy.deepcopy(self.value['initial']);acl=changed['compatibility']['schema40']['canonical']['project39']['delta'][local.KEY]['value']
   if mode=='public_usage':acl.append(local.PUBLIC_USAGE)
   elif mode=='extra':acl.append('synthetic_unknown=U/pg_database_owner')
   elif mode=='missing_other':acl.pop(0)
   else:acl.reverse()
   with self.assertRaises(ValueError):local.Context().bind(changed,self.value['system'],self.value['run'])
 def test_actual_state_downstream_guard_and_exact_transition_negatives(self):
  paths=[('compatibility','lifecycle','running'),('compatibility','schema40','authority','roles'),('compatibility','schema40','dependencies','old','sha256'),('compatibility','schema40','canonical','processing_config','frame_extraction_config','public','native_image_id'),('compatibility','schema40','canonical','processing_config','specs_pipeline_config','public','enabled'),('history','old_rows_sha256'),('full_scope','dependencies_sha256'),('full_scope','audit_attributes_sha256'),('target','identity','proowner')]
  for path in paths:
   changed=copy.deepcopy(self.after);parent=changed
   for key in path[:-1]:parent=parent[key]
   old=parent[path[-1]];parent[path[-1]]=not old if type(old)is bool else old+1 if type(old)is int else '0'*64
   with self.assertRaises(ValueError):self.c.transition(self.value['initial'],changed)
 def test_all_dispatch_render_diagnose_and_resolved_SQL_without_execution(self):
  value=self.request(before=self.value['initial'],marker=MARKER)
  rendered=local.dispatch('render',value);self.assertTrue(rendered['expected']==self.after)
  parse_sql(rendered['sql']);parse_sql(rendered['diagnostic_sql']);parse_sql(self.c.state_sql());parse_sql(self.c.checkpoint_sql())
  self.assertEqual(rendered['sql'].count('commit;'),1);self.assertNotIn('commit;',rendered['diagnostic_sql'])
  self.assertIn("current_database()<>'project39'",rendered['sql'])
  self.assertIn("set local search_path='';",rendered['sql'])
  self.assertEqual(local.dispatch('diagnose',self.request(before=self.value['initial'],observed=self.after))['difference_count'],0)
  changed=copy.deepcopy(self.after);changed['full_scope']['audit_attributes_sha256']='0'*64
  result=local.dispatch('diagnose',self.request(before=self.value['initial'],observed=changed));self.assertEqual(result['difference_count'],1)
  self.assertFalse(result['normal_nonce_claimed'])
 def checkpoints(self):
  before=copy.deepcopy(self.value['initial']);state=before['compatibility']['schema40'];base=state['canonical']['base']
  rows={}
  for table in self.c.tables:
   count=state['intents']['count']if table=='project_creation_intents'else base['trace_rows']['count']if table=='job_stage_attempts'else base['data'][table]['count']
   rows[table]=[{'synthetic_ordinal':n}for n in range(count)]
  for n,row in enumerate(rows['audit_events']):row['reason']='Synthetic Ω\nالعربية'if n==0 else''if n==1 else None
  target={**copy.deepcopy(before['target']['identity']),'prosrc':self.c.old_body}
  functions=[{'oid':-n-1,'prosrc':'synthetic function'}for n in range(before['full_scope']['function_count']-1)]+[target]
  left={'state':before,'application_tables':rows,'catalogue':{'functions|'+local.s.SIGNATURE+'|source_sha256':local.s.OLD,'schemas|public|acl':copy.deepcopy(state['canonical']['project39']['delta'][local.KEY]['value'])},'function_rows':functions,'history_rows':[{'version':v,'statements':[],'name':'synthetic historical'}for v in self.c.history]}
  right=copy.deepcopy(left);right['state']=copy.deepcopy(self.after);right['catalogue']['functions|'+local.s.SIGNATURE+'|source_sha256']=local.s.NEW;right['function_rows'][-1]['prosrc']=self.c.candidate.patch_body(self.c.old_body);right['history_rows'].append({'version':local.s.VERSION,'statements':[],'name':'m07_logo_info_operation'})
  return left,right
 def compare(self,left,right):
  self.c.checkpoint_check(left,False);self.c.checkpoint_check(right,True);self.c.transition(left['state'],right['state'])
  class Views:
   plan=object()
   def checkpoint_read(self,reference):return left if reference=='before'else right
   def read(self,path):return {'before':left['state']}
  view=Views();view.c=self.c;return self.release.Release.compare_checkpoints(view,'before','after')
 def test_synthetic_full76_checkpoint_counts_and_full_comparator(self):
  left,right=self.checkpoints();self.c.checkpoint_check(left,False);self.c.checkpoint_check(right,True)
  self.assertTrue(local.dispatch('compare',self.request(before_checkpoint=left,after_checkpoint=right))['all76_full_rows_including_reason_preserved'])
  self.assertTrue(self.compare(left,right))
  for table in self.c.tables:
   changed=copy.deepcopy(right);rows=changed['application_tables'][table]
   if rows:rows[0]['synthetic_tamper']=True
   else:rows.append({'synthetic_tamper':True})
   with self.assertRaises(ValueError):self.compare(left,changed)
 def test_synthetic_reason_catalogue_function_history_changes_refused(self):
  left,right=self.checkpoints()
  for mode in('nonnull_reason','empty_reason','null_reason','acl','function_owner','history'):
   changed=copy.deepcopy(right)
   if mode.endswith('_reason'):changed['application_tables']['audit_events'][{'nonnull_reason':0,'empty_reason':1,'null_reason':2}[mode]]['reason']='tampered'
   elif mode=='acl':changed['catalogue']['schemas|public|acl'].append(local.PUBLIC_USAGE)
   elif mode=='function_owner':changed['function_rows'][-1]['proowner']='synthetic_changed_owner'
   else:changed['history_rows'][0]['name']='tampered'
   with self.assertRaises(ValueError):self.compare(left,changed)
 def test_exact_controller_entry_bridge_inverse_SQL_and_default_OFF(self):
  run='8a200000-0000-4000-8000-000000000002';source,bridge,entry,proof=m.compile_source('.local/logo-info-collector-acl-compiled/controller-'+run+'.mjs')
  self.assertTrue(all(proof[k]is True for k in('parent_controller_inverse_byte_equal','parent_entry_inverse_byte_equal','parent_bridge_inverse_byte_equal','actual_snapshot_checkpoint_SQL_byte_equal','only_owned_expected_PUBLIC_USAGE_absence_qualified')))
  self.assertIn('logo-info-collector-acl-once',entry);self.assertIn('eps.logoacl.run',source)
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory);entry_file=root/'entry.mjs';original=(m.MAIN/'.local/logo-info-collector-acl-compiled'/('entry-'+run+'.mjs')).as_uri();source=source.replace(original,entry_file.as_uri())
   for name,text in[('controller.mjs',source),('entry.mjs',entry),('bridge.mjs',bridge)]:
    file=root/name;file.write_text(text,encoding='utf8',newline='\n');result=subprocess.run(['node','--check',str(file)],capture_output=True,timeout=15);self.assertEqual(result.returncode,0,'generated syntax')
   script='const m=await import('+json.dumps((root/'controller.mjs').as_uri())+");try{await m.runRace('D:/unreachable');process.exitCode=2}catch(e){if(e.message!=='LOGO_INFO_COLLECTOR_DISABLED')process.exitCode=3}"
   result=subprocess.run(['node','--input-type=module','-e',script],capture_output=True,timeout=15);self.assertEqual(result.returncode,0,'default OFF pre-port gate')
if __name__=='__main__':unittest.main()
