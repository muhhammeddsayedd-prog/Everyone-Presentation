"""Pure exact four-policy release boundary checks. No CLI or private config."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest import mock
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m06_storage27_release',ROOT/'tools/release_m06_storage27.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Storage27ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.cli=self.enterContext(mock.patch.object(m,'cli_call',side_effect=AssertionError('Offline only')))
        self.enterContext(mock.patch.object(m,'MIGRATION','20261030020000_m06_guest_storage_policy_composition.sql'))
        self.delta={'schema_version':'1.0','created':{m.MEDIA_POLICY+'cmd':'SELECT',m.MEDIA_POLICY+'permissive':'PERMISSIVE',m.MEDIA_POLICY+'roles':['eps_review_owner'],m.MEDIA_POLICY+'with_check':None,m.MEDIA_POLICY+'qual':'current Ready exact export metadata only'},'deleted':{},'changed':{key:{'before':'existing narrow predicate '+key,'after':'composed narrow predicate '+key}for key in m.POLICY_KEYS},
            'new_state':{'config':{'enabled':False,'key_present':False,'key_bytes':None,'replay_ttl_seconds':86400,'session_ttl_seconds':3600},'tables':{'review_gateway_config':{'count':1}}}}
        self.before={'old_data':{'versions':[str(n)for n in range(25)]+['20261030004643'],'hashes':{'eps.jobs':'a'*64,'storage.objects':'b'*64},'managed_auth':{'user_count':1,'users_metadata':{'rls':True}}},
            'new_state':{'config':{'enabled':True,'key_present':True,'key_bytes':32,'replay_ttl_seconds':86400,'session_ttl_seconds':3600},'tables':{'review_gateway_config':{'count':1},'review_links':{'count':2}}},
            'catalog_count':100,'catalog_protected_sha256':'c'*64,'catalog_delta_values':{k:v['before']for k,v in self.delta['changed'].items()},
            'runtime':{'execute':sorted(m.OLD_OPERATIONS),'login':True,'superuser':False,'parents':[]},'protected_m02':{'exists':True,'manual_note_retained':True}}
        self.after=copy.deepcopy(self.before);self.after['old_data']['versions'].append(m.MIGRATION[:14]);self.after['catalog_delta_values']={**self.delta['created'],**{k:v['after']for k,v in self.delta['changed'].items()}};self.after['catalog_count']+=5
    def test_exact_four_policy_deltas_and_data_preservation(self):
        self.assertEqual(len(m.validate_delta(self.delta)),9);m.validate_before_state(self.before,self.delta);self.assertTrue(all(m.compare_states(self.before,self.after,self.delta).values()))
    def test_new_functions_roles_or_arbitrary_policy_delta_denied(self):
        for change in('created','deleted','extra','missing'):
            delta=copy.deepcopy(self.delta)
            if change in('created','deleted'):delta[change]={'functions|unsafe()|owner':'broad'}
            elif change=='extra':delta['changed']['policies|storage.objects.other|roles']={'before':[],'after':['public']}
            else:delta['changed'].pop(next(iter(delta['changed'])))
            with self.subTest(change=change),self.assertRaises(m.Blocked):m.validate_delta(delta)
    def test_new_media_policy_is_exact_existing_owner_select_only(self):
        for field,value in(('roles',['anon']),('cmd','ALL'),('with_check','true'),('permissive','RESTRICTIVE')):
            delta=copy.deepcopy(self.delta);delta['created'][m.MEDIA_POLICY+field]=value
            with self.assertRaises(m.Blocked):m.validate_delta(delta)
    def test_cloud_preflight_requires_existing_enabled_32byte_key(self):
        for field,value in(('enabled',False),('key_present',False),('key_bytes',16),('replay_ttl_seconds',100)):
            before=copy.deepcopy(self.before);before['new_state']['config'][field]=value
            with self.assertRaises(m.Blocked):m.validate_before_state(before,self.delta)
    def test_exact26_history_required(self):
        for versions in(self.before['old_data']['versions'][:-1],self.after['old_data']['versions'],['0']*26):
            before=copy.deepcopy(self.before);before['old_data']['versions']=versions
            with self.assertRaises(m.Blocked):m.validate_before_state(before,self.delta)
    def test_unexpected_predecessor_policy_expression_denied(self):
        self.before['catalog_delta_values'][next(iter(m.POLICY_KEYS))]='unexpected'
        with self.assertRaises(m.Blocked):m.validate_before_state(self.before,self.delta)
    def test_noncredential_business_and_storage_rows_preserved(self):
        for table in('eps.jobs','storage.objects'):
            after=copy.deepcopy(self.after);after['old_data']['hashes'][table]='0'*64
            with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_managed_auth_rls_and_count_preserved(self):
        self.after['old_data']['managed_auth']['users_metadata']['rls']=False
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_other_catalog_fields_and_policy_roles_preserved(self):
        self.after['catalog_protected_sha256']='0'*64
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_catalog_count_cannot_change(self):
        self.after['catalog_count']+=1
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_key_metadata_configuration_and_counts_preserved(self):
        for mutate in(lambda v:v['new_state']['config'].update(enabled=False),lambda v:v['new_state']['config'].update(key_bytes=31),lambda v:v['new_state']['tables']['review_links'].update(count=3)):
            after=copy.deepcopy(self.after);mutate(after)
            with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_exact_one_history_append_only(self):
        self.after['old_data']['versions'].append('20261030020001')
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_exact_four_new_expressions_required(self):
        self.after['catalog_delta_values'].pop(next(iter(m.POLICY_KEYS)))
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_runtime12_no_operation13_or_privilege_change(self):
        for mutate in(lambda v:v['runtime']['execute'].append('eps.unsafe()'),lambda v:v['runtime'].update(superuser=True),lambda v:v['runtime']['parents'].append('authenticated')):
            after=copy.deepcopy(self.after);mutate(after)
            with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_protected_manual_m02_preserved(self):
        self.after['protected_m02']['manual_note_retained']=False
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_exact_one_pending_migration(self):
        m.validate_pending(m.MIGRATION)
        for value in('',m.MIGRATION+'\n20261030020001_unsafe.sql'):
            with self.assertRaises(m.Blocked):m.validate_pending(value)
    def test_connection_environment_overrides_denied(self):
        for key in('PGHOST','PGPASSWORD','PGOPTIONS','SUPABASE_DB_URL','SUPABASE_WORKDIR'):
            with self.assertRaises(m.Blocked):m.validate_process_scope({key:'unexpected'})
    def test_missing_config_pin_denies_before_cli(self):
        with mock.patch.object(m,'CONFIG_SHA',''):
            with self.assertRaises(m.Blocked):m.current_release_inputs()
        self.cli.assert_not_called()
    def test_historical_claim_or_attempt_denies_repeated_apply(self):
        for claimed,attempts in((True,[]),(False,['historical'])):
            claim=mock.Mock();claim.exists.return_value=claimed;evidence=mock.Mock();evidence.glob.return_value=attempts
            with mock.patch.object(m,'CLAIM',claim),mock.patch.object(m,'EVIDENCE',evidence),self.assertRaises(m.Blocked):m.refuse_repeat_apply()

if __name__=='__main__':unittest.main()
