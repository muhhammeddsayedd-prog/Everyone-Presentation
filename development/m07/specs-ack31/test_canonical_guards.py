"""Synthetic state-machine fixtures only. No process, DB or provider calls."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('canonical_guards',Path(__file__).with_name('canonical_guards.py'))
g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)


def baseline():
    role={'name':'cli_login_postgres','oid':11,**dict.fromkeys(g.FLAGS,False),'connection_limit':-1,'valid_until':'2026-10-31T01:05:00+00:00'}
    return {'catalog':{g.ACK:g.OLD,'functions|eps.mcp_custom_access_token_hook(jsonb)|source_sha256':g.HOOK,'tables|eps.jobs|acl':'synthetic-narrow'},
      'context':{'database':'postgres','operator':'postgres','unrestricted_visibility':True,'migration_versions':['30'],
        'issuer_role_exists':True,'issuer_function_count':1,'issuer_policy_count':2,'all_roles':[role],'all_memberships':[],
        'settings':{'synthetic':True},'registry_count':0,'effective_privileges':{'synthetic':'unchanged'}},
      'admission':{'query_role':'postgres','database':'postgres','unrestricted_visibility':True,'runtime':{'execute':g.RUNTIME},
        'protected_m02':{'exists':True,'manual_note_retained':True},'active_jobs':0,'leased_outbox':0,
        'frame_native_image_id':g.NATIVE,'application_origin':g.ORIGIN,'settings_row_sha256':'a'*64},
      'protected_data':{'counts':{'synthetic':1},'hashes':{'synthetic':'b'*64},'managed_auth':{'synthetic_count':1},'versions':['30']}}


def after():
    value=baseline();value['catalog'][g.ACK]=g.NEW
    value['context']['migration_versions'].append(g.VERSION);value['protected_data']['versions'].append(g.VERSION)
    return value


class Guards(unittest.TestCase):
    def test_passed_local_receipt_still_has_to_bind_the_intended_migration_and_readback(self):
        value={'schema_version':'1.0','result':'passed','checkpoint':'complete','source_seals':{'synthetic.sql':'a'*64},
          'planned_canonical_migration':'supabase/migrations/wrong.sql','unconfirmed_child_processes':[],
          'owned31_ack_readback':{'body_sha256':g.NEW,'private_invoker':True,'whole_job_select_still_denied':True,
            'public_callers_denied':True,'existing_projection_columns_granted':True}}
        for key in('cloud_called','provider_called','original_database_writes','existing_role_ddl','historical_controllers_invoked','command_process_unconfirmed','automatic_retry'):value[key]=False
        for key in('private_acl_verified','local31_only','sources_stable','clone29_full_catalogue_data_exact','only_ack_source_and_history_changed','all_fixture_writes_rolled_back',
                   'after_ddl_rollback_exact','after_history_rollback_exact','issuer30_surface_restored_except_exact_ack31_and_history',
                   'actual_owned_database_absent','actual_new_role_absent','original29_full_catalogue_data_settings_roles_oids_memberships_exact','shared_lock_released'):value[key]=True
        for phase in('red','green'):
            value[phase]={'phase':phase,'expected_failure_observed':phase=='red','sqlstate':'42501'if phase=='red'else None,
              'permission_object':'jobs'if phase=='red'else None,'checks':dict.fromkeys(('ack','idempotency','stale','denial','invalid_relations'),phase=='green')}
        with self.assertRaises(ValueError):g.validate_local_proof(value,{'synthetic.sql':'a'*64})
        value['planned_canonical_migration']='supabase/migrations/20261031010000_m07_specs_submit_ack_projection.sql'
        g.validate_local_proof(value,{'synthetic.sql':'a'*64})
        value['owned31_ack_readback']['whole_job_select_still_denied']=False
        with self.assertRaises(ValueError):g.validate_local_proof(value,{'synthetic.sql':'a'*64})

    def test_only_ack_source_and_one_history_entry_may_change(self):
        original,current=baseline(),after();saved=copy.deepcopy((original,current))
        self.assertEqual(g.compare_after(original,current,'2026-10-31T01:00:00+00:00'),[])
        self.assertEqual((original,current),saved)
        for mutate in (lambda v:v['catalog'].update(extra=True),lambda v:v['protected_data']['hashes'].update(synthetic='c'*64),
                       lambda v:v['context']['effective_privileges'].update(synthetic='broad'),lambda v:v['context']['all_roles'][0].update(oid=12),
                       lambda v:v['context']['migration_versions'].append(g.VERSION)):
            value=after();mutate(value)
            with self.assertRaises(ValueError):g.compare_after(original,value,'2026-10-31T01:00:00+00:00')

    def test_only_monotonic_bounded_cli_expiry_is_qualified(self):
        value=after();value['context']['all_roles'][0]['valid_until']='2026-10-31T01:06:00+00:00'
        qualifications=g.compare_after(baseline(),value,'2026-10-31T01:00:00+00:00')
        self.assertEqual(qualifications[0]['name'],'cli_login_postgres')
        self.assertEqual(value['context']['all_roles'][0]['valid_until'],'2026-10-31T01:06:00+00:00')
        for end in ('2026-10-31T00:59:00+00:00','2026-10-31T01:11:00+00:00'):
            value['context']['all_roles'][0]['valid_until']=end
            with self.assertRaises(ValueError):g.compare_after(baseline(),value,'2026-10-31T01:00:00+00:00')

    def test_unknown_dispatch_is_never_retried_and_requires_two_preserving_reads(self):
        class IO:
            dispatches=0
            def preflight(self):return baseline()
            def claim(self,value):pass
            def dispatch(self,value):self.dispatches+=1;raise TimeoutError()
            def read(self):return after()
            def now(self):return '2026-10-31T01:00:00+00:00'
        io=IO();result=g.apply_once(io)
        self.assertEqual(io.dispatches,1);self.assertTrue(result['application_verified_by_readback'])
        self.assertFalse(result['dispatch_process_returned']);self.assertFalse(result['normal_return_marker_observed'])
        self.assertEqual(result['result'],'unconfirmed')
        def bad():value=after();value['protected_data']['counts']['synthetic']=2;return value
        io=IO();io.read=bad;result=g.apply_once(io)
        self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['application_verified_by_readback'])

    def test_claim_collision_prevents_dispatch_and_missing_baseline_cannot_credit_application(self):
        class IO:
            dispatches=0
            def preflight(self):return baseline()
            def claim(self,value):raise FileExistsError()
            def dispatch(self,value):self.dispatches+=1
            def read(self):return after()
            def now(self):return '2026-10-31T01:00:00+00:00'
        io=IO()
        with self.assertRaises(FileExistsError):g.apply_once(io)
        self.assertEqual(io.dispatches,0)
        self.assertFalse(g.observe(io,None)['application_verified_by_readback'])

    def test_readback_observation_without_claim_bound_normal_return_cannot_pass(self):
        self.assertEqual(g.result_status(True,False,False),'unconfirmed')
        self.assertEqual(g.result_status(True,True,False),'unconfirmed')
        self.assertEqual(g.result_status(False,True,True),'unconfirmed')
        self.assertEqual(g.result_status(True,True,True),'passed')


if __name__=='__main__':unittest.main()
