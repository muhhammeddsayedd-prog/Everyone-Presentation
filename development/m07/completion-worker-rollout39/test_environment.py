"""Synthetic metadata tests: private/preview entries never mutate or decrypt."""
from pathlib import Path
import copy,importlib.util,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion39_env_tests',HERE/'environment.py');e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
class Tests(unittest.TestCase):
 def fixture(self):
  values={key:'true'for key in e.FLAGS};values.update(EPS_RELEASE_MODE='controlled_pilot',EPS_NATIVE_MANIFEST_SHA256=e.OLD_MANIFEST,EPS_NATIVE_TRANSPORT='vercel_sandbox',SUPABASE_URL='https://pyibofyctwnqpvktepse.supabase.co',SUPABASE_PUBLISHABLE_KEY='sb_publishable_SYNTHETIC_1234',EPS_PILOT_OWNER_CONTROLLED='true')
  rows=[{'id':e.MANIFEST_ID if key=='EPS_NATIVE_MANIFEST_SHA256'else'id_'+key,'key':key,'type':'plain','target':['production'],'gitBranch':None,'createdAt':1,'updatedAt':2}for key in values]
  rows +=[{'id':'private_id','key':'OPENAI_API_KEY','type':'sensitive','target':['production','preview'],'gitBranch':None,'createdAt':1,'updatedAt':2,'value':'PRIVATE_NOT_PROJECTED'}, {'id':'preview','key':'APP_ENV','type':'plain','target':['preview'],'gitBranch':'feature/test','createdAt':1,'updatedAt':2}]
  return e.projection(e.metadata({'envs':rows}),values)
 def apply(self,value,action):
  after=copy.deepcopy(value);key=action['key'];after['public'][key]=action['body']['value']
  if action['method']=='POST':
   after['metadata'].append({'id':'new_app_env','key':key,'type':'plain','target':['production'],'gitBranch':None,'createdAt':3,'updatedAt':3});after['metadata'].sort(key=lambda row:row['id']);after['ids'][key]='new_app_env'
  else:
   next(row for row in after['metadata']if row['id']==action['id'])['updatedAt']=3
  return after
 def test_private_value_discarded_and_all7_flags_required(self):
  value=self.fixture();self.assertNotIn('PRIVATE_NOT_PROJECTED',str(value));self.assertNotIn('OPENAI_API_KEY',value['public']);self.assertEqual(len([key for key in e.FLAGS if value['public'][key]=='true']),7)
 def test_minimal_public_ops_and_all_preview_private_metadata_preserved(self):
  value=self.fixture();actions=e.actions(value);self.assertEqual([v['key']for v in actions],['APP_ENV','EPS_RELEASE_MODE','EPS_NATIVE_MANIFEST_SHA256'])
  self.assertEqual(actions[0]['method'],'POST')
  for action in actions:after=self.apply(value,action);self.assertTrue(e.preserved(value,after,action));value=after
  self.assertTrue(e.production(value));self.assertEqual(next(row for row in value['metadata']if row['id']=='preview')['gitBranch'],'feature/test')
 def test_private_or_preview_metadata_drift_is_denied(self):
  before=self.fixture();action=e.actions(before)[0];after=self.apply(before,action)
  for identity in ['private_id','preview']:
   changed=copy.deepcopy(after);next(row for row in changed['metadata']if row['id']==identity)['updatedAt']=9
   with self.assertRaises(ValueError):e.preserved(before,changed,action)
 def test_same_id_patch_cannot_change_type_target_created_or_other_public_values(self):
  before=self.fixture();action=e.actions(before)[1];after=self.apply(before,action)
  for key,value in [('type','encrypted'),('target',['production','preview']),('createdAt',0)]:
   changed=copy.deepcopy(after);next(row for row in changed['metadata']if row['id']==action['id'])[key]=value
   with self.assertRaises(ValueError):e.preserved(before,changed,action)
  after['public'][e.FLAGS[0]]='false'
  with self.assertRaises(ValueError):e.preserved(before,after,action)
 def test_combined_preview_production_editable_record_is_denied(self):
  value=self.fixture();next(row for row in value['metadata']if row['key']=='EPS_RELEASE_MODE')['target']=['production','preview']
  with self.assertRaises(ValueError):e.actions(value)
 def test_expiry_is_only_blank_patch_and_missing_optional_is_not_created(self):
  value=self.fixture();value['metadata'].append({'id':'expiry','key':'EPS_PILOT_EXPIRES_AT','type':'plain','target':['production'],'gitBranch':None,'createdAt':1,'updatedAt':2});value['ids']['EPS_PILOT_EXPIRES_AT']='expiry';value['public']['EPS_PILOT_EXPIRES_AT']='2026-12-01T00:00:00Z'
  action=e.actions(value)[-1];self.assertEqual(action,{'method':'PATCH','key':'EPS_PILOT_EXPIRES_AT','id':'expiry','body':{'value':''}})
if __name__=='__main__':unittest.main()
