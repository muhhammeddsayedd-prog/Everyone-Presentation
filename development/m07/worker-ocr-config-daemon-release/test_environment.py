"""Synthetic complete metadata; no environment/provider reads."""
from pathlib import Path
import copy,importlib.util,unittest
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_env_tests',HERE/'environment.py');e=importlib.util.module_from_spec(s);s.loader.exec_module(e)
def fixture():
 core=e.base();values={'APP_ENV':'production','EPS_RELEASE_MODE':'production','EPS_NATIVE_MANIFEST_SHA256':e.a.BASELINE['native_manifest_sha256'],'EPS_NATIVE_TRANSPORT':'vercel_sandbox','SUPABASE_URL':'https://pyibofyctwnqpvktepse.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_synthetic_only',**dict.fromkeys(core.FLAGS,'true'),'EPS_DAEMON_SOURCE_SHA256':e.a.BASELINE['daemon_source_sha256'],'EPS_NATIVE_COMPATIBILITY_SHA256':e.a.BASELINE['native_compatibility_sha256']};rows=[]
 for i,key in enumerate(values):rows.append({'id':core.MANIFEST_ID if key=='EPS_NATIVE_MANIFEST_SHA256'else'row_'+str(i),'key':key,'type':'plain','target':['production'],'gitBranch':None,'createdAt':1,'updatedAt':1})
 rows.extend([{'id':'private_row','key':'OPENAI_API_KEY','type':'sensitive','target':['production'],'gitBranch':None,'createdAt':1,'updatedAt':1},{'id':'preview_row','key':'OTHER','type':'plain','target':['preview'],'gitBranch':None,'createdAt':1,'updatedAt':1}])
 return e.projection(core.metadata({'envs':rows}),values),{'EPS_NATIVE_MANIFEST_SHA256':values['EPS_NATIVE_MANIFEST_SHA256'],'EPS_DAEMON_SOURCE_SHA256':'a'*64,'EPS_NATIVE_COMPATIBILITY_SHA256':'b'*64}
def apply(before,action):
 after=copy.deepcopy(before);after['public'][action['key']]=action['body']['value']
 for row in after['metadata']:
  if row['id']==action['id']:row['updatedAt']=2
 return after
class Tests(unittest.TestCase):
 def test_exact_two_existing_PATCHes_leave_native_and_all_other_commitments_unchanged(self):
  before,values=fixture();actions=e.actions(before,values);self.assertEqual([x['method']for x in actions],['PATCH','PATCH']);self.assertEqual([x['key']for x in actions],['EPS_DAEMON_SOURCE_SHA256','EPS_NATIVE_COMPATIBILITY_SHA256']);current=before
  for action in actions:after=apply(current,action);self.assertTrue(e.preserved(current,after,action));current=after
  self.assertTrue(e.production(current,values));self.assertEqual(current['public']['EPS_NATIVE_MANIFEST_SHA256'],e.a.BASELINE['native_manifest_sha256'])
 def test_missing_duplicate_mixed_target_native_or_baseline_drift_cannot_create_or_adopt(self):
  for mode in('missing','duplicate','mixed','native','baseline'):
   before,values=fixture();key='EPS_DAEMON_SOURCE_SHA256';row=next(x for x in before['metadata']if x['key']==key)
   if mode=='missing':before['metadata'].remove(row)
   elif mode=='duplicate':before['metadata'].append({**row,'id':'duplicate'})
   elif mode=='mixed':row['target']=['production','preview']
   elif mode=='native':values['EPS_NATIVE_MANIFEST_SHA256']='c'*64
   else:before['public'][key]='c'*64
   with self.assertRaises(ValueError):e.actions(before,values)
 def test_private_preview_or_unrelated_public_changes_refuse_after_PATCH(self):
  for mode in('private','preview','public'):
   before,values=fixture();action=e.actions(before,values)[0];after=apply(before,action)
   if mode=='public':after['public']['APP_ENV']='preview'
   else:next(x for x in after['metadata']if x['id']==mode+'_row')['updatedAt']=3
   with self.assertRaises(ValueError):e.preserved(before,after,action)
if __name__=='__main__':unittest.main()
