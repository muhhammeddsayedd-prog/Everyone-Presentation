from pathlib import Path
import copy,importlib.util,json,subprocess,sys,unittest
HERE=Path(__file__).resolve().parent;spec=importlib.util.spec_from_file_location('forward_baseline_proposal_tests',HERE/'proposal.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
def before(c):
 canonical=copy.deepcopy(c.anchor);canonical['processing_config']['frame_extraction_config']['public']['native_image_id']=p.s.NATIVE
 return {'history':c.history,'canonical':canonical,'intents':{'count':canonical['project39']['intent_rows'],'sha256':'a'*64},'functions':{name:{'identity':{'synthetic':True},'source_sha256':sha}for name,sha in c.old.items()},'reason':{'present':False,'shape_valid':False,'historical_nonnull':0},'dependencies':{'old':{'count':0,'sha256':'b'*64},'reason_dependencies_valid':True},'authority':{'roles':'c'*64,'memberships':'d'*64},'history_identity':{'new_entry_valid':False,'old_rows':'e'*64}}
class Tests(unittest.TestCase):
 def test_only_five_classified_scalar_fields_are_new_explicit_baseline(self):
  c=p.ProposedContext();old=copy.deepcopy(c.historical39_anchor);new=copy.deepcopy(c.anchor);new['base']['oauth']['sha256']=old['base']['oauth']['sha256'];new['project39']['old_identities']=old['project39']['old_identities'];new['project39']['remaining_catalogue']=old['project39']['remaining_catalogue'];self.assertEqual(new,old);self.assertFalse(c.historical_identity_equivalence_since39);self.assertEqual(c.forward_identity_scope,p.SCOPE);c.check(before(c),False)
 def test_unknown_identity_catalogue_grant_and_other_static_changes_refuse(self):
  c=p.ProposedContext()
  for path in(('project39','old_identities','sha256'),('project39','remaining_catalogue','sha256'),('base','oauth_static_sha256')):
   value=before(c);node=value['canonical']
   for key in path[:-1]:node=node[key]
   node[path[-1]]='f'*64
   with self.assertRaises(ValueError):c.check(value,False)
  value=before(c);value['canonical']['project39']['creator_no_create']=False
  with self.assertRaises(ValueError):c.check(value,False)
 def test_full_fresh_preimage_and_all_SQL_methods_remain_inherited(self):
  c=p.ProposedContext();old=p.prior.Context();self.assertEqual(c.state_sql(),old.state_sql());self.assertEqual(c.checkpoint_sql(),old.checkpoint_sql())
  for name in('check','render','expected','transition'):self.assertIs(getattr(p.ProposedContext,name),getattr(p.prior.Context,name))
  first=before(c);c.transition(first,c.expected(first))
  for path in(('authority','roles'),('canonical','base','data','jobs','sha256'),('canonical','processing_config','specs_pipeline_config','table_hash')):
   after=c.expected(first);node=after
   for key in path[:-1]:node=node[key]
   node[path[-1]]='f'*64
   with self.assertRaises(ValueError):c.transition(first,after)
 def test_default_off_no_live_or_private_IO_entry(self):
  self.assertFalse(p.LIVE_ENABLED);result=subprocess.run([sys.executable,'-B',str(HERE/'proposal.py')],capture_output=True,timeout=10);self.assertEqual(result.returncode,1);self.assertEqual(json.loads(result.stdout),{'result':'disabled_source_proposal','live_enabled':False})
if __name__=='__main__':unittest.main()
