"""Pure synthetic receipts/states only; no private, CLI, provider or DB actions."""
import copy
import datetime
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('hosted_binding',Path(__file__).with_name('hosted-binding.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
CLIENT='a0000000-0000-4000-8000-000000000011'  # Synthetic only.
ACTOR='a0000000-0000-4000-8000-000000000012'
NOW=datetime.datetime(2026,10,30,22,0,tzinfo=datetime.timezone.utc)


def core():
    return {'schema_version':'1.0','result':'passed','target':module.origin.TARGET,'origin':module.HOST,
            'web_project_id':module.WEB_PROJECT,'web_deployment_id':'dpl_SYNTHETICFIXTURE','acting_user_id':ACTOR,
            'core_checks':{key:'passed' for key in module.CORE_CHECKS},
            'evidence_receipts':['tracking/evidence/m07/controlled-pilot/synthetic-core-metadata.json']}


def provider():
    value={key:False for key in module.client.RECEIPT_FIELDS}
    value.update(schema_version='1.0',evidence_kind='actual_provider_observation',target=module.origin.TARGET,
                 origin=module.HOST,resource=module.RESOURCE,issuer=module.ISSUER,action='readback',result='passed',
                 observed_at='2026-10-30T21:59:00+00:00',finished_at='2026-10-30T21:59:10+00:00',
                 client={'client_id':CLIENT,'client_name':module.client.CLIENT_NAME,'client_type':'public',
                         'token_endpoint_auth_method':'none','redirect_uris':['http://localhost:3118/callback'],
                         'grant_types':['authorization_code','refresh_token'],'response_types':['code'],'registration_type':'manual'},
                 matching_client_count=1,provider_client_observed=True,independent_readback_equal=True,post_outcome='not_attempted',
                 source_pins={'helper_sha256':module.CLIENT_SHA,'plan_sha256':module.PLAN_SHA})
    return value


def state(bound=False):
    metadata={key:{'count':2,'sha256':'a'*64} for key in ('versions','slides','pins','ready_asset_metadata','grants','settings')}
    metadata['protected_m02']={'id':module.origin.PROTECTED_JOB,'status':'failed','stage':'extract_specs','attempt':1,'row_version':3,
                               'resource_id':'a0000000-0000-4000-8000-000000000013','manual_note_retained':True,'spec_sha256':'b'*64}
    return {'database':'postgres','operator':'postgres','history':list(module.origin.VERSIONS),'registry_trigger_count':0,
            'bindings':[{'resource':module.RESOURCE,'client_id':CLIENT,'enabled':True}] if bound else [],
            'acting_user_id':ACTOR,'producer_capabilities':['cast.read','settings.manage','workspaces.read'],
            'hook_security':{key:True for key in module.HOOK_CHECKS},'protected_metadata':metadata}


class FakeIO:
    def __init__(self,unknown=False,applied=True,collision=False,changed=False,bound=False):
        self.unknown,self.applied,self.collision,self.changed,self.bound=unknown,applied,collision,changed,bound
        self.dispatches,self.reads,self.claims=0,0,[]
    def readback(self):
        self.reads+=1;value=state(self.bound or self.dispatches and self.applied)
        if self.changed and self.dispatches:value['protected_metadata']['grants']['sha256']='c'*64
        return value
    def verify_sources(self):pass
    def claim(self,value):
        if self.collision:raise FileExistsError('SYNTHETIC_EXISTING_CLAIM')
        self.claims.append(copy.deepcopy(value))
    def dispatch(self):
        self.dispatches+=1
        if self.unknown:raise TimeoutError('SYNTHETIC_PRIVATE_DIAGNOSTIC')
        return {'resource':module.RESOURCE,'client_id':CLIENT,'enabled':True,'inserted_rows':1,'acting_user_id':ACTOR,
                'producer_capabilities':state()['producer_capabilities'],'hook_security':state()['hook_security'],
                'protected_metadata':state()['protected_metadata'],'business_and_hook_state_preserved':True}


class HostedBindingTests(unittest.TestCase):
    def test_core_gate_exact_actual_host_user_and_all_nine_core_checks_required(self):
        module.validate_core(core())
        for field,value in [('target','foreign'),('origin','http://127.0.0.1:3000'),('result','pending'),('acting_user_id','bad'),
                            ('web_project_id','prj_foreign'),('web_deployment_id','bad'),('evidence_receipts',[])]:
            invalid=core();invalid[field]=value
            with self.assertRaises(ValueError):module.validate_core(invalid)
        for key in module.CORE_CHECKS:
            invalid=core();invalid['core_checks'][key]='pending'
            with self.assertRaises(ValueError):module.validate_core(invalid)
        invalid=core();invalid['evidence_receipts']=['../private.json']
        with self.assertRaises(ValueError):module.validate_core(invalid)

    def test_public_client_actual_receipt_requires_matching_uuid_callback_no_secret_and_current_source(self):
        module.validate_provider_receipt(provider(),CLIENT,NOW)
        for mutate in [lambda v:v.update(evidence_kind='synthetic'),lambda v:v.update(provider_client_observed=False),
                       lambda v:v.update(independent_readback_equal=False),lambda v:v.update(client_secret_observed=True),
                       lambda v:v['client'].update(client_id=ACTOR),lambda v:v['client'].update(redirect_uris=['http://127.0.0.1:3118/callback']),
                       lambda v:v['source_pins'].update(helper_sha256='d'*64),
                       lambda v:v.update(finished_at='2026-10-30T20:00:00+00:00',observed_at='2026-10-30T19:59:00+00:00')]:
            invalid=provider();mutate(invalid)
            with self.assertRaises(ValueError):module.validate_provider_receipt(invalid,CLIENT,NOW)

    def test_state_has_exact30_hook8_real_actor_caps_and_no_foreign_registry_rows(self):
        module.validate_state(state(),CLIENT,ACTOR,require_empty=True)
        for key in module.HOOK_CHECKS:
            invalid=state();invalid['hook_security'][key]=False
            with self.assertRaises(ValueError):module.validate_state(invalid,CLIENT,ACTOR)
        for mutate in [lambda v:v['history'].__setitem__(0,'20261028000000'),lambda v:v.update(acting_user_id=CLIENT),
                       lambda v:v.update(producer_capabilities=[]),lambda v:v.update(registry_trigger_count=1),
                       lambda v:v.update(bindings=[{'resource':'http://127.0.0.1:3000/mcp','client_id':CLIENT,'enabled':True}])]:
            invalid=state();mutate(invalid)
            with self.assertRaises(ValueError):module.validate_state(invalid,CLIENT,ACTOR)

    def test_one_insert_under_claim_and_independent_reads_preserve_business_grants_ready_and_m02(self):
        io=FakeIO();result=module.apply_once(io,CLIENT,ACTOR)
        self.assertEqual(result['result'],'passed');self.assertEqual(io.dispatches,1);self.assertEqual(io.reads,4);self.assertEqual(len(io.claims),1)
        self.assertTrue(result['business_and_hook_state_preserved']);self.assertFalse(result['automatic_dispatch_retry'])

    def test_unknown_commit_readback_verifies_only_actual_binding_and_never_retries(self):
        io=FakeIO(unknown=True);result=module.apply_once(io,CLIENT,ACTOR)
        self.assertEqual(result['result'],'passed');self.assertEqual(io.dispatches,1);self.assertEqual(result['dispatch_outcome'],'unconfirmed')
        self.assertNotIn('SYNTHETIC_PRIVATE',str(result))
        for options in [{'unknown':True,'applied':False},{'changed':True}]:
            io=FakeIO(**options);self.assertEqual(module.apply_once(io,CLIENT,ACTOR)['result'],'unconfirmed');self.assertEqual(io.dispatches,1)

    def test_existing_actual_binding_is_readback_only_and_no_original_preservation_credit(self):
        io=FakeIO(bound=True);result=module.apply_once(io,CLIENT,ACTOR)
        self.assertEqual(io.dispatches,0);self.assertFalse(io.claims);self.assertTrue(result['binding_observed'])
        self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['application_verified_by_readback'])

    def test_claim_collision_and_concurrent_new_row_never_insert(self):
        io=FakeIO(collision=True)
        with self.assertRaises(ValueError):module.apply_once(io,CLIENT,ACTOR)
        self.assertEqual(io.dispatches,0)
        io=FakeIO();original=io.readback
        def read():
            value=original()
            if io.reads==2:value['bindings']=[{'resource':module.RESOURCE,'client_id':CLIENT,'enabled':True}]
            return value
        io.readback=read
        with self.assertRaises(ValueError):module.apply_once(io,CLIENT,ACTOR)
        self.assertEqual(io.dispatches,0)

    def test_sql_rendering_typed_actual_uuids_and_no_auth_or_capability_dml(self):
        text=module.render_sql('__CLIENT_UUID__ __ACTING_USER_UUID__',CLIENT,ACTOR,update=True)
        self.assertEqual(text,CLIENT+' '+ACTOR)
        with self.assertRaises(ValueError):module.render_sql('__CLIENT_UUID__ __ACTING_USER_UUID__',"bad';drop",ACTOR,update=True)
        for name in ['HOSTED_BINDING.sql','HOSTED_BINDING_READBACK.sql']:
            sql=Path(__file__).with_name(name).read_text(encoding='utf8').lower()
            self.assertNotIn('insert into auth.',sql);self.assertNotIn('update auth.',sql)
            self.assertNotIn('insert into public.app_capability_grants',sql);self.assertNotIn('grant ',sql)
            self.assertIn('b6e422c7df5cb146',sql)

    def test_actual_client_writer_utc_filename_is_admitted_without_path_or_url_escape(self):
        relative='tracking/evidence/m07/controlled-pilot/2026-10-30T21-59-10-123456+00-00-1234abcd-hosted-oauth-client-readback.json'
        self.assertEqual(module.receipt_path(relative),module.ROOT/relative)
        for value in [relative+'?token=synthetic',relative.replace('controlled-pilot/','controlled-pilot/../'),
                      'https://foreign.invalid/receipt.json']:
            with self.assertRaises(ValueError):module.receipt_path(value)


if __name__=='__main__':unittest.main()
