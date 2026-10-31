import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC=importlib.util.spec_from_file_location('hosted_oauth_final31_guard',Path(__file__).with_name('hosted-oauth-web-final31-guard.py'))
guard=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(guard)


def inputs():
    plan={'schema_version':'1.0','status':'actual_canonical31_and_hosted_core','target':guard.TARGET,'version':guard.VERSION,
      'candidate_path':guard.CANDIDATE,'candidate_sha256':guard.CANDIDATE_SHA,'migration_path':guard.MIGRATION,'migration_sha256':guard.CANDIDATE_SHA,
      'canonical_release_receipt':'tracking/evidence/m07/specs-ack31/SYNTHETIC-readback.json','canonical_release_sha256':'a'*64,
      'canonical_source_pins':{'development/m07/specs-ack31/'+name:'b'*64 for name in ['canonical-release.py','canonical_guards.py','canonical_sql.py','canonical-plan.json','canonical-query.sql',
          'canonical-continuation.py','continuation_sql.py','continuation_guards.py','canonical-continuation-plan.json']},'hosted_core_sha256':'c'*64}
    core={'schema_version':'1.0','result':'passed','target':guard.TARGET,'origin':guard.HOST,'web_project_id':guard.WEB_PROJECT,
      'web_deployment_id':'dpl_SYNTHETIC00000000','acting_user_id':'a0310000-0000-4000-8000-000000000001',
      'core_checks':{key:'passed' for key in guard.CORE_CHECKS},'evidence_receipts':['tracking/evidence/m07/controlled-pilot/SYNTHETIC-core.json']}
    before={'history':list(guard.OLD_VERSIONS),'ack_body_sha256':guard.OLD_ACK,'hook_body_sha256':guard.HOOK_BODY}
    after={'history':list(guard.VERSIONS),'ack_body_sha256':guard.ACK_BODY,'hook_body_sha256':guard.HOOK_BODY}
    release={key:False for key in guard.RELEASE_FIELDS}
    release.update(schema_version='1.0',evidence_kind='actual_canonical_observation',target=guard.TARGET,action='readback',result='passed',version=guard.VERSION,
      migration_path=guard.MIGRATION,migration_sha256=guard.CANDIDATE_SHA,source_pins=copy.deepcopy(plan['canonical_source_pins']),local_proof={},
      before_summary=before,after_summary=after,independent_summary=copy.deepcopy(after),dispatch_process_returned=True,
      normal_return_marker_observed=True,application_verified_by_readback=True,independent_readback_equal=True,protected_before_after_equal=True,
      claim_retained=True,cli_short_login_expiry_qualifications={})
    release.update(observed_at='2026-10-31T02:00:00+00:00',finished_at='2026-10-31T02:01:00+00:00',phase='complete',helper_sha256='b'*64,
      cli_internal_retries_not_characterized=True,cli_commands_attempted=2,raw_source_credentials_or_cli_diagnostics_persisted=False,
      original_claim_retained=True,original_transport_outcome='unknown_retained',old_transaction_cutoff='2026-10-31T01:37:38.327713+00:00',activity_fence_required=True,
      command_diagnostics=[{'sequence':i,'operation':'read_state','exit_code':0,'timed_out':False,'http_status':None,'sqlstate':None,
          'request_entity_too_large':False,'fixed_error_tokens':[],'response_envelope_valid':True}for i in(1,2)])
    release['source_pins'].update({guard.CANDIDATE:guard.CANDIDATE_SHA,guard.MIGRATION:guard.CANDIDATE_SHA})
    return {'plan':plan,'core':core,'release':release,'pins':{'development/m07/controlled-pilot/OAUTH31_PLAN.json':'d'*64},'plan_sha256':'d'*64}


def state():
    return {'database':'postgres','operator':'postgres','history':list(guard.VERSIONS),'hook_body_sha256':guard.HOOK_BODY,'ack_body_sha256':guard.ACK_BODY,
      'hook_security':{key:True for key in guard.HOOK_CHECKS},'ack_security':{key:True for key in guard.ACK_CHECKS}}


class Fake:
    def __init__(self):self.value=inputs();self.state=state();self.reads=0
    def inputs(self):return copy.deepcopy(self.value)
    def read_database(self):self.reads+=1;return copy.deepcopy(self.state)


class Tests(unittest.TestCase):
    def test_live_boundary_accepts_exact_one_raw_row_as_observed_without_cli_execution(self):
        expected=state();completed=guard.subprocess.CompletedProcess(['SYNTHETIC'],0,stdout=json.dumps([{'oauth31_guard':expected}]),stderr='')
        with patch.dict(guard.os.environ,{},clear=True),patch.object(guard.subprocess,'run',return_value=completed)as run:
            self.assertEqual(guard.LiveIO().read_database(),expected)
        self.assertEqual(run.call_count,1)
    def test_wrapped_and_raw_states_match_and_outer_transport_metadata_never_publishes(self):
        expected=state();row={'oauth31_guard':expected}
        wrapped={'rows':[row],'boundary':'SYNTHETIC_PRIVATE','warning':{'access_token':'SYNTHETIC_PRIVATE'}}
        self.assertEqual(guard.parse_query_result([row]),expected);self.assertEqual(guard.parse_query_result(wrapped),expected)
        self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(guard.parse_query_result(wrapped)))
    def test_empty_multiple_wrong_alias_inner_extras_or_malformed_state_are_denied(self):
        row={'oauth31_guard':state()}
        malformed=[None,True,'SYNTHETIC_PRIVATE',[],[row,row],{'rows':[]},{'rows':[row,row]},{'rows':{}},[None],[{'wrong':state()}],[{**row,'private':'SYNTHETIC_PRIVATE'}]]
        for mutate in [lambda v:v.update(history=list(guard.OLD_VERSIONS)),lambda v:v['hook_security'].update(auth_admin_execute='true'),lambda v:v['ack_security'].update(column_selects=False),lambda v:v.update(private='SYNTHETIC_PRIVATE')]:
            value=state();mutate(value);malformed.append([{'oauth31_guard':value}])
        for value in malformed:
            with self.assertRaises(ValueError)as error:guard.parse_query_result(value)
            self.assertNotIn('SYNTHETIC_PRIVATE',str(error.exception))
    def test_completed_guard_source_and_shared_plan_sql_are_preserved(self):
        path='development/m07/controlled-pilot/hosted-oauth-final31-guard.py';expected='703be7164725929d8473af5145a1e3640cdfe1eac244f706f3e66b5e2f57514d'
        self.assertEqual(guard.FROZEN[path],expected);self.assertEqual(guard.digest(guard.public_bytes(guard.ROOT/path)),expected)
        self.assertEqual(guard.PLAN.name,'HOSTED_OAUTH_FINAL31_PLAN.json');self.assertEqual(guard.SQL.name,'OAUTH31_GUARD.sql')
        self.assertEqual(guard.PLAN_SHA256,'dea972d170e862c168689b7efde9b3790e70e0b769c4c25214250f046ae60687')
    def test_final_family_keeps_completed_guard_and_plan_frozen_and_uses_a_distinct_plan(self):
        expected={'oauth31-guard.py':'2bb655b62dedd61aff1e60f07722473dcbe92e53149b57340c4fcf6d1f2532d1',
                  'OAUTH31_PLAN.json':'32520a46146ed76da8feba032a6a0b599a5c4f6021f399c2b508970edc2bdc7c'}
        self.assertEqual(guard.PLAN.name,'HOSTED_OAUTH_FINAL31_PLAN.json')
        for name,digest in expected.items():
            relative='development/m07/controlled-pilot/'+name
            self.assertEqual(guard.FROZEN[relative],digest)
            self.assertEqual(guard.digest(guard.public_bytes(guard.ROOT/relative)),digest)

    def test_exact31_without_mutating_frozen30_and_controlled_proof_is_not_actual(self):
        io=Fake();value=guard.admit31(io)
        self.assertEqual(io.reads,1);self.assertEqual(len(guard.OLD_VERSIONS),30);self.assertEqual(len(guard.base.VERSIONS),30)
        self.assertEqual(value['history'],list(guard.VERSIONS));self.assertEqual(value['evidence_kind'],'controlled_source_test')
        guard.validate_gate(value,require_actual=False)
        with self.assertRaises(ValueError):guard.validate_gate(value,require_actual=True)

    def test_missing_release_pending_plan_or_one_incomplete_core_check_blocks_before_query(self):
        for mutate in [lambda v:v['plan'].update(status='awaiting_actual_release'),lambda v:v['release'].update(result='unconfirmed'),
                       lambda v:v['release'].update(normal_return_marker_observed=False),lambda v:v['core']['core_checks'].update(specs_openai_n8n='pending')]:
            io=Fake();mutate(io.value)
            with self.assertRaises(ValueError):guard.admit31(io)
            self.assertEqual(io.reads,0)

    def test_wrong_history_hook_ack_or_one_bad_acl_never_passes(self):
        for mutate in [lambda v:v.update(history=list(guard.OLD_VERSIONS)),lambda v:v.update(ack_body_sha256=guard.OLD_ACK),
                       lambda v:v.update(hook_body_sha256='a'*64),lambda v:v['hook_security'].update(auth_admin_execute=False),
                       lambda v:v['ack_security'].update(whole_job_select_denied=False),lambda v:v.update(private='SYNTHETIC_PRIVATE')]:
            io=Fake();mutate(io.state)
            with self.assertRaises(ValueError):guard.admit31(io)

    def test_fixed_release_source_and_body_and_target_bindings(self):
        for mutate in [lambda v:v['release'].update(target='other'),lambda v:v['release'].update(migration_sha256='a'*64),
                       lambda v:v['release']['after_summary'].update(ack_body_sha256=guard.OLD_ACK),
                       lambda v:v['release']['source_pins'].update(unknown='SYNTHETIC_PRIVATE')]:
            io=Fake();mutate(io.value)
            with self.assertRaises(ValueError):guard.admit31(io)
            self.assertEqual(io.reads,0)

    def test_core_is_closed_nine_checks_and_fixed_host_with_no_private_output(self):
        io=Fake();io.value['core']['private']='SYNTHETIC_PRIVATE'
        with self.assertRaises(ValueError):guard.admit31(io)
        io=Fake();io.value['core']['origin']='http://localhost:3000'
        with self.assertRaises(ValueError):guard.admit31(io)
        self.assertEqual(io.reads,0)

    def test_fresh_guard_has_no_mutation_mode_and_environment_denial_is_case_insensitive(self):
        for key in ['node_options','Npm_Config_Node_Options','supabase_debug','PGHOST']:
            with self.assertRaises(ValueError) as error:guard.validate_environment({key:'SYNTHETIC_PRIVATE'})
            self.assertNotIn('SYNTHETIC_PRIVATE',str(error.exception))
        self.assertEqual(guard.query_command()[3:6],['db','query','--linked'])
        self.assertIn('--project-ref',guard.query_command());self.assertNotIn('--db-url',guard.query_command())

    def test_draft_plan_cannot_reach_any_actual_cli_and_cannot_override_candidate_pin(self):
        with patch.object(guard,'PLAN_SHA256',''),patch.object(guard.subprocess,'run',side_effect=AssertionError('UNEXPECTED_CLI')):
            with self.assertRaises(ValueError):guard.admit31()
        plan=inputs()['plan'];plan['canonical_source_pins'][guard.CANDIDATE]='f'*64
        with self.assertRaises(ValueError):guard.validate_plan(plan)

    def test_public_canonical_tool_source_pins_are_retained_but_private_paths_are_denied(self):
        io=Fake();io.value['pins']['tools/local-postgres.mjs']='a'*64
        value=guard.admit31(io);self.assertEqual(value['source_pins']['tools/local-postgres.mjs'],'a'*64)
        value['source_pins']['.local/private.json']='a'*64
        with self.assertRaises(ValueError):guard.validate_gate(value,require_actual=False)

    def test_actual_static_inventory_composes31_without_frozen30_call_or_nonpath_pin(self):
        with patch.object(guard.base,'source_pins',side_effect=AssertionError('frozen30 inventory must not execute')):
            pins=guard.static_source_pins()
        self.assertEqual(pins,{**guard.base.PINS,'development/m07/controlled-pilot/future-origin.py':guard.BASE_SHA})
        self.assertNotIn('preflight_sql_sha256',pins)
        self.assertEqual(guard.digest(guard.base.PREFLIGHT_SQL.encode()),guard.BASE_PREFLIGHT_SHA256)
        self.assertEqual(len(guard.base.VERSIONS),30)
        io=Fake();io.value['pins']=pins
        self.assertEqual(guard.admit31(io)['source_pins'],pins)

    def test_static_inventory_rejects30_unknown_migration_and_changed_frozen_preflight(self):
        for versions in [guard.OLD_VERSIONS,(*guard.VERSIONS,'20261031020000')]:
            files=[Path(version+'_synthetic.sql')for version in versions]
            with patch.object(Path,'glob',return_value=files):
                with self.assertRaises(ValueError):guard.static_source_pins()
        with patch.object(guard.base,'PREFLIGHT_SQL',guard.base.PREFLIGHT_SQL+'--synthetic change'):
            with self.assertRaises(ValueError):guard.static_source_pins()

    def test_public_input_composition_uses_actual31_inventory_with_controlled_public_receipts(self):
        value=inputs();plan=value['plan'];core=value['core'];release=value['release']
        original=guard.public_bytes
        plan['canonical_source_pins']={relative:guard.digest(original(guard.ROOT/relative))for relative in plan['canonical_source_pins']}
        release['source_pins']={**plan['canonical_source_pins'],guard.CANDIDATE:guard.CANDIDATE_SHA,guard.MIGRATION:guard.CANDIDATE_SHA}
        release['helper_sha256']=plan['canonical_source_pins'][guard.CANONICAL_HELPER]
        encode=lambda item:json.dumps(item,sort_keys=True).encode()
        release_bytes=encode(release);core_bytes=encode(core)
        plan['canonical_release_sha256']=guard.digest(release_bytes);plan['hosted_core_sha256']=guard.digest(core_bytes)
        plan_bytes=encode(plan)
        controlled={guard.PLAN:plan_bytes,guard.receipt_path(plan['canonical_release_receipt']):release_bytes,
                    guard.ROOT/guard.CORE:core_bytes,guard.receipt_path(core['evidence_receipts'][0]):b'{}'}
        def public_file(file,maximum=256*1024):return controlled[file]if file in controlled else original(file,maximum)
        with patch.object(guard,'PLAN_SHA256',guard.digest(plan_bytes)),patch.object(guard,'public_bytes',side_effect=public_file),\
             patch.object(guard.base,'source_pins',side_effect=AssertionError('frozen30 inventory must not execute')):
            composed=guard.public_inputs()
        self.assertNotIn('preflight_sql_sha256',composed['pins'])
        self.assertTrue(all(relative.startswith(('development/','supabase/','tracking/','tools/'))for relative in composed['pins']))
        io=Fake();io.value=composed
        self.assertEqual(guard.admit31(io)['evidence_kind'],'controlled_source_test')

    def test_compact_receipt_requires_exact_continuation_helper_fields_and_successful_closed_commands(self):
        value=inputs();plan=value['plan'];release=value['release']
        helper='development/m07/specs-ack31/canonical-continuation.py'
        for name in ['canonical-continuation.py','continuation_sql.py','continuation_guards.py','canonical-continuation-plan.json']:
            plan['canonical_source_pins']['development/m07/specs-ack31/'+name]='c'*64
        release['source_pins'].update(plan['canonical_source_pins']);release['helper_sha256']='c'*64
        release.update(original_claim_retained=True,original_transport_outcome='unknown_retained',
            old_transaction_cutoff='2026-10-31T01:37:38.327713+00:00',activity_fence_required=True,
            command_diagnostics=[{'sequence':i,'operation':'read_state','exit_code':0,'timed_out':False,'http_status':None,'sqlstate':None,
                'request_entity_too_large':False,'fixed_error_tokens':[],'response_envelope_valid':True}for i in (1,2)],cli_commands_attempted=2)
        guard.validate_release(release,plan)
        for mutate in [lambda r:r.update(original_claim_retained=False),lambda r:r.update(activity_fence_required=False),lambda r:r.update(phase='apply'),
                       lambda r:r.update(helper_sha256='b'*64),lambda r:r['command_diagnostics'][0].update(timed_out=True),
                       lambda r:r['command_diagnostics'][0].update(private='SYNTHETIC_PRIVATE'),
                       lambda r:r['source_pins'].update({helper:'a'*64})]:
            bad=copy.deepcopy(release);mutate(bad)
            with self.assertRaises(ValueError):guard.validate_release(bad,plan)


if __name__=='__main__':unittest.main()
