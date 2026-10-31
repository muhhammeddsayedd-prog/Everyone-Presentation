from pathlib import Path
import copy
import importlib.util
import json
import unittest

HERE=Path(__file__).resolve().parent
def module(name):
 spec=importlib.util.spec_from_file_location(name,HERE/(name+'.py'));value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
release=module('release_v2');discovery=module('discover')

def before():return {'catalogue':json.loads(release.BASELINE.read_text(encoding='utf8'))['catalogue'],'protected_m02':{'id':'b3f90268-147d-41d4-8875-2a6435df1496','status':'waiting_for_input','stage':'apply_specs','attempt':3,'row_version':7},'new_objects':dict.fromkeys(('role','table','claim','finish'),False),'security':None}

class ReleaseTests(unittest.TestCase):
 def test_debug_removed_and_target_overrides_rejected(self):
  self.assertEqual(discovery.environment({'PATH':'normal','DEBUG':'*','SUPABASE_DEBUG':'true','NODE_DEBUG':'http'}),{'PATH':'normal'})
  for key in discovery.FORBIDDEN:
   with self.assertRaises(ValueError):discovery.environment({key:'nonempty'})
 def test_closed_transport_envelopes(self):
  self.assertEqual(release.parse([{'oauth_consent_release':{'ok':True}}]),{'ok':True})
  self.assertEqual(release.parse({'rows':[{'oauth_consent_release':{'ok':True}}],'transport':'discarded'}),{'ok':True})
  for value in [[],{},[{'oauth_consent_release':{},'unknown':'private'}],[{'oauth_consent_release':{}},{'oauth_consent_release':{}}]]:
   with self.assertRaises(ValueError):release.parse(value)
 def test_preflight_exact_history_protected_job_and_absence(self):
  release.check_before(before())
  for mutate in [lambda v:v['catalogue']['history'].pop(),lambda v:v['protected_m02'].update(attempt=4),lambda v:v['new_objects'].update(role=True),lambda v:v['catalogue']['relations'][0].update(rls=True)]:
   value=before();mutate(value)
   with self.assertRaises(ValueError):release.check_before(value)
 def test_render_one_atomic_history_write_and_public_only_inputs(self):
  sql=release.render(before(),'60000000-0000-4000-8000-000000000001')
  self.assertEqual(sql.count('insert into supabase_migrations.schema_migrations'),1)
  self.assertLess(sql.index('OAUTH_CONSENT_RELEASE_PREFLIGHT_CHANGED'),sql.index('create role eps_oauth_consent_owner'))
  self.assertLess(sql.index('insert into supabase_migrations.schema_migrations'),sql.index('commit;select'))
  self.assertNotIn('select * from auth.',sql.lower())
  self.assertNotIn('update auth.',sql.lower())
 def test_normalization_preserves_existing_metadata(self):
  value=release.expected_after_catalogue(before()['catalogue'])
  self.assertEqual(release.normalize_after(value),release.stable_catalogue(before()['catalogue']))
  value['relations'][0]['owner']='untrusted'
  self.assertNotEqual(release.normalize_after(value),release.stable_catalogue(before()['catalogue']))
 def test_unlisted_column_table_and_grant_option_acl_fail(self):
  for change in ['unlisted','table','grant_option']:
   value=release.expected_after_catalogue(before()['catalogue']);relation=next(v for v in value['relations']if v['schema']=='auth'and v['name']=='sessions')
   if change=='table':relation['acl']='{eps_oauth_consent_owner=r/postgres}'
   elif change=='unlisted':next(v for v in relation['columns']if v['name']=='refresh_token_hmac_key')['acl']='{eps_oauth_consent_owner=r/postgres}'
   else:next(v for v in relation['columns']if v['name']=='id')['acl']='{eps_oauth_consent_owner=r*/postgres}'
   with self.assertRaises(ValueError):release.normalize_after(value)
 def test_wrong_policy_authority_relation_or_expression_fail(self):
  for change in ['roles','using','relation']:
   value=release.expected_after_catalogue(before()['catalogue']);relation=next(v for v in value['relations']if v['schema']=='auth'and v['name']=='sessions');policy=next(v for v in relation['policies']if v['name']=='oauth_consent_ordinary_own_session')
   if change=='relation':relation['policies'].remove(policy);value['relations'][0]['policies'].append(policy)
   else:policy[change]=['authenticated']if change=='roles'else'true'
   with self.assertRaises(ValueError):release.normalize_after(value)
 def test_unexpected_role_membership_and_unsafe_flags_fail(self):
  original=before();after=copy.deepcopy(original);after['catalogue']=release.expected_after_catalogue(original['catalogue']);after['new_objects']=dict.fromkeys(('role','table','claim','finish'),True);after['security']=dict.fromkeys(release.SECURITY_CHECKS,True);release.check_after(after,original)
  for change in ['membership','flags']:
   value=copy.deepcopy(after)
   if change=='membership':value['security']['no_role_memberships']=False
   else:next(v for v in value['catalogue']['roles']if v['name']==release.OWNER)['create_role']=True
   with self.assertRaises(ValueError):release.check_after(value,original)
 def test_sources_match_frozen_new_candidate(self):
  self.assertEqual(release.sources()[release.MIGRATION.relative_to(release.ROOT).as_posix()],release.MIGRATION_SHA)

if __name__=='__main__':unittest.main()
