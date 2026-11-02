"""Closed synthetic env metadata; no provider or private values."""
from pathlib import Path
import copy,importlib.util,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_env',HERE/'environment.py');e=importlib.util.module_from_spec(spec);spec.loader.exec_module(e)
class Tests(unittest.TestCase):
 def fixture(self):
  e0=e.base();rows=[];values={'APP_ENV':'production','EPS_RELEASE_MODE':'production','EPS_NATIVE_MANIFEST_SHA256':e.a.OLD['manifest_sha256'],'EPS_NATIVE_TRANSPORT':'vercel_sandbox','SUPABASE_URL':'https://pyibofyctwnqpvktepse.supabase.co','SUPABASE_PUBLISHABLE_KEY':'sb_publishable_synthetic_only',**dict.fromkeys(e0.FLAGS,'true')}
  for i,key in enumerate(values):
   rows.append({'id':e0.MANIFEST_ID if key=='EPS_NATIVE_MANIFEST_SHA256'else'row_'+str(i),'key':key,'type':'plain','target':['production'],'gitBranch':None,'createdAt':1,'updatedAt':1})
  rows.append({'id':'private_row','key':'OPENAI_API_KEY','type':'sensitive','target':['production'],'gitBranch':None,'createdAt':1,'updatedAt':1})
  return e.projection(e0.metadata({'envs':rows}),values),{key:('a'if key==e.EDITABLE[0]else'b'if key==e.EDITABLE[1]else'c')*64 for key in e.EDITABLE}
 def apply(self,before,action):
  after=copy.deepcopy(before);key=action['key'];after['public'][key]=action['body']['value']
  if action['method']=='POST':
   row={'id':'new_'+key,'key':key,'type':'plain','target':['production'],'gitBranch':None,'createdAt':2,'updatedAt':2};after['metadata'].append(row);after['ids'][key]=row['id']
  else:
   for row in after['metadata']:
    if row['id']==action['id']:row['updatedAt']=2
  return after
 def test_only_manifest_patch_and_two_absent_public_production_creates(self):
  before,values=self.fixture();actions=e.actions(before,values);self.assertEqual([v['method']for v in actions],['PATCH','POST','POST'])
  current=before
  for action in actions:after=self.apply(current,action);self.assertTrue(e.preserved(current,after,action));current=after
  self.assertTrue(e.production(current,values));self.assertEqual(current['public']['APP_ENV'],'production')
 def test_existing_public_hash_gets_same_ID_value_only_patch(self):
  before,values=self.fixture();action=e.actions(before,values)[1];before=self.apply(before,action);values[e.EDITABLE[1]]='d'*64
  patch=[v for v in e.actions(before,values)if v['key']==e.EDITABLE[1]][0];self.assertEqual(patch,{'method':'PATCH','key':e.EDITABLE[1],'id':before['ids'][e.EDITABLE[1]],'body':{'value':'d'*64}})
 def test_private_or_preview_metadata_change_refuses(self):
  before,values=self.fixture();action=e.actions(before,values)[0];after=self.apply(before,action)
  for field,value in(('target',['preview']),('type','plain')):
   changed=copy.deepcopy(after);row=next(r for r in changed['metadata']if r['id']=='private_row');row[field]=value
   with self.assertRaises(ValueError):e.preserved(before,changed,action)
 def test_mixed_target_or_duplicate_new_hash_is_not_split_or_adopted(self):
  before,_=self.fixture();row={'id':'unknown','key':e.EDITABLE[1],'type':'plain','target':['production','preview'],'gitBranch':None}
  with self.assertRaises(ValueError):e.selected(before['metadata']+[row],e.EDITABLE[1])
  row['target']=['production']
  with self.assertRaises(ValueError):e.selected(before['metadata']+[row,{**row,'id':'duplicate'}],e.EDITABLE[1])
 def test_wrong_new_record_key_cannot_claim_an_identity_hash_creation(self):
  before,values=self.fixture();action=e.actions(before,values)[1];after=self.apply(before,action);after['metadata'][-1]['key']='OTHER_PUBLIC'
  with self.assertRaises(ValueError):e.preserved(before,after,action)
 def test_hash_inputs_cannot_be_credentials_or_extra_settings(self):
  _,values=self.fixture()
  for change in({e.EDITABLE[0]:'PRIVATE_CREDENTIAL'},{'DATABASE_URL':'PRIVATE_CREDENTIAL'}):
   with self.assertRaises(ValueError):e.wanted({**values,**change})
if __name__=='__main__':unittest.main()
