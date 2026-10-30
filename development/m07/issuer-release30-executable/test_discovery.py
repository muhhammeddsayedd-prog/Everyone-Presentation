"""Small admission tests; no database, provider, subprocess or credentials."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('issuer30_discovery', HERE/'discovery.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class DiscoveryAdmission(unittest.TestCase):
    def fixture(self):
        snapshot = json.loads((HERE.parent/'issuer-release30/historical29-expected.json').read_text())
        return {'catalog': snapshot['selected_metadata'], 'context': {
            'database': 'postgres', 'operator': 'postgres', 'unrestricted_visibility': True,
            'migration_versions': snapshot['versions'], 'issuer_role_exists': False,
            'issuer_function_count': 0, 'issuer_policy_count': 0,
            'all_roles': [{'name': 'postgres', 'oid': '10', 'login': True,
                'super': False, 'inherit': True, 'bypassrls': True, 'create_role': True,
                'create_db': True, 'replication': True, 'connection_limit': -1, 'valid_until': None}],
            'all_memberships': [], 'effective_privileges': {},
            'settings': {'template_version':'1.1.0','default_timezone':'Africa/Cairo','row_version':3,'default_review_expiry_days':30},
            'registry_count':0}, 'admission': {'query_role':'postgres','database':'postgres',
                'unrestricted_visibility':True,'runtime':{},'protected_m02':{'exists':True,'manual_note_retained':True},
                'active_jobs':0,'leased_outbox':0}, 'protected_data': {}}

    def test_history_requires_entire_ordered_list_even_when_count_and_max_match(self):
        state = self.fixture()
        module.validate_discovery(state)
        for mutation in (lambda v:v.__setitem__(0,'20261028010944'),lambda v:v.reverse(),lambda v:v.__setitem__(1,v[0])):
            changed=copy.deepcopy(state);mutation(changed['context']['migration_versions'])
            with self.assertRaises(ValueError):module.validate_discovery(changed)

    def test_source_owner_acl_rls_and_missing_or_null_facts_fail_closed(self):
        state=self.fixture()
        keys=['functions|eps.mcp_claim_uuid(text)|source_sha256',
            'functions|public.eps_validate_own_oauth_session(text)|owner',
            'functions|eps.mcp_token_permits_capability(text)|acl',
            'tables|eps.mcp_oauth_resources|force_rls']
        for key in keys:
            for replacement in (None,'changed',False):
                changed=copy.deepcopy(state);changed['catalog'][key]=replacement
                with self.assertRaises(ValueError):module.validate_discovery(changed)
            changed=copy.deepcopy(state);del changed['catalog'][key]
            with self.assertRaises(ValueError):module.validate_discovery(changed)

    def test_existing_role_overload_policy_wrong_connection_or_extra_payload_rejected(self):
        state=self.fixture()
        for key,value in [('issuer_role_exists',True),('issuer_function_count',1),('issuer_policy_count',1),
                          ('database','other'),('operator','supabase_admin'),('unrestricted_visibility',False)]:
            changed=copy.deepcopy(state);changed['context'][key]=value
            with self.assertRaises(ValueError):module.validate_discovery(changed)
        changed=copy.deepcopy(state);changed['access_token']='not-a-real-token'
        with self.assertRaises(ValueError):module.validate_discovery(changed)

    def test_fixed_cli_and_environment_do_not_accept_caller_target_or_pg_overrides(self):
        command=module.query_command()
        self.assertEqual(command[:4],['npx.cmd','--yes','supabase@2.122.0','db'])
        self.assertEqual(command[command.index('--project-ref')+1],'pyibofyctwnqpvktepse')
        self.assertNotIn('--password',command)
        module.validate_environment({})
        for name in ['SUPABASE_WORKDIR','SUPABASE_DB_URL','PGHOST','PGDATABASE','PGOPTIONS']:
            with self.assertRaises(ValueError):module.validate_environment({name:'override'})

    def test_oid_boundary_rejects_noncanonical_or_unknown_identity(self):
        for value in [1,'1',4294967295,'4294967295']:
            self.assertEqual(module.oid(value),int(value))
        for value in [True,False,0,-1,4294967296,'01','+1','1.0',' 1','1 ','',None]:
            with self.assertRaises(ValueError):module.oid(value)

    def test_malformed_or_extra_payload_never_enters_public_receipt(self):
        for value in [None,{},dict(self.fixture(),access_token='synthetic-private-sentinel')]:
            report={'result':'failed'}
            with self.assertRaises(ValueError):module.publish_discovery(report,value)
            self.assertEqual(report,{'result':'failed'})
        report={};state=self.fixture();module.publish_discovery(report,state)
        self.assertEqual(report,{'discovery':state})

if __name__=='__main__':unittest.main()
