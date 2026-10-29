"""Offline activation boundary tests; no CLI, config mutation or cloud call."""
import copy, importlib.util, json, pathlib, re, sys, unittest
from unittest.mock import patch
from candidate_pipeline_historical_fixture import historical17_root, install_current19_fixture
ROOT=pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('candidate_activation',ROOT/'tools/configure-candidate-pipeline.py')
activation=importlib.util.module_from_spec(spec);spec.loader.exec_module(activation)
local_spec=importlib.util.spec_from_file_location('local_candidate_activation',ROOT/'tools/configure-candidate-runtime.py')
local_activation=importlib.util.module_from_spec(local_spec);local_spec.loader.exec_module(local_activation)
import release_candidate_pipeline as release


class ActivationTests(unittest.TestCase):
    def setUp(self):
        self.root=self.enterContext(historical17_root(release,activation.SEALS))
        self.enterContext(patch.object(release,'ROOT',self.root))
        self.enterContext(patch.object(activation,'ROOT',self.root))
        self.cli=self.enterContext(patch.object(release,'cli_call',side_effect=AssertionError('No live CLI in offline activation tests.')))
        self.snapshot=json.loads((self.root/release.PROMOTION).read_bytes())['after']

    def state(self):
        snapshot=copy.deepcopy(self.snapshot)
        if snapshot['runtime'] is None:snapshot['runtime']={'execute':['synthetic-narrow-runtime-operation()']}
        return {'snapshot':snapshot,'configuration':{'query_role':'postgres','database':'postgres',
          'configuration_rows':1,'configuration':copy.deepcopy(activation.PRISTINE),'active_candidate_jobs':0,'active_candidate_uploads':0}}

    def changed(self,before):
        after=copy.deepcopy(before);after['configuration']['configuration']=copy.deepcopy(activation.ENABLED)
        after['snapshot']['data_sha256']['eps.candidate_asset_config']='a'*64
        if after['snapshot']['data_sha256']['eps.candidate_asset_config']==before['snapshot']['data_sha256']['eps.candidate_asset_config']:
            after['snapshot']['data_sha256']['eps.candidate_asset_config']='b'*64
        return after

    def test_default_readonly_and_exact_sql_guards(self):
        self.assertEqual(activation.arguments(['--receipt','2026-proof.json']),('dry-run','2026-proof.json'))
        with self.assertRaises(ValueError):activation.arguments(['--force','--receipt','2026-proof.json'])
        expected=activation.versions()
        for file in (activation.INSPECT,activation.ENABLE):
            source=(self.root/file).read_text()
            self.assertEqual(re.findall(r"'(2026[0-9]{10})'",source),expected)
        sql=(self.root/activation.ENABLE).read_text()
        self.assertEqual(len(re.findall(r'(?im)^\s*update\s+',sql)),1)
        self.assertFalse(re.search(r'(?im)^\s*(create|alter|grant|revoke|drop|delete|insert)\s+',sql))

    def test_current19_history_is_not_accepted_by_fixed17_activation(self):
        install_current19_fixture(self.root)
        with self.assertRaises(ValueError):activation.versions()
        self.cli.assert_not_called()

    def test_frozen_migration_byte_drift_is_rejected_before_activation(self):
        manifest=json.loads((self.root/'development/local-db/reviewed.json').read_bytes())
        source=self.root/manifest['migrations'][0]['path']
        source.write_bytes(source.read_bytes()+b'\n-- synthetic offline drift\n')
        with self.assertRaises(ValueError):activation.versions()
        self.cli.assert_not_called()

    def test_only_exact_config_change_is_allowed(self):
        before=self.state();after=self.changed(before)
        result={'before':activation.PRISTINE,'after':activation.ENABLED,'changed_rows':1}
        activation.compare_activation(before,after,result)
        for kind in ('business','runtime','catalog','models'):
            changed=copy.deepcopy(after)
            if kind=='business':changed['snapshot']['data_sha256']['public.projects']='changed'
            elif kind=='runtime':changed['snapshot']['runtime']['execute'].append('forged()')
            elif kind=='catalog':changed['snapshot']['catalog']['functions'][0]['source_sha256']='changed'
            else:changed['configuration']['configuration']['extraction_model']='unreviewed-model'
            with self.assertRaises(ValueError):activation.compare_activation(before,changed,result)

    def test_pending_work_or_nonpristine_config_refuses_enablement(self):
        for key in ('active_candidate_jobs','active_candidate_uploads'):
            value=self.state();value['configuration'][key]=1
            with self.assertRaises(ValueError):activation.require_pristine(value)
        value=self.state();value['configuration']['configuration']=activation.ENABLED
        with self.assertRaises(ValueError):activation.require_pristine(value)

    def test_reconciliation_requires_target_exact17_and_no_authority_mutation(self):
        expected=activation.versions()
        proof={'result':'passed','target':activation.TARGET,'migration':activation.MIGRATION,'migration_sha256':activation.MIGRATION_SHA,
          'application_verified_by_readback':True,'candidate_configuration_disabled_verified':True,'exact_runtime_function_operations':11,
          'cloud_write_attempted':False,'migration_retry_attempted':False,'flags_changed':False,'original_failed_receipt_preserved':True,
          'readback':{'versions':expected},'at_apply_reconciliation':{'business_rows_preserved':True,'old_catalog_preserved_except_reviewed_delta':True,
          'runtime_authority_unchanged':True,'cloud_grants_changed':False,'derived_boolean_count':9,'managed_public_predicates':[1,2,3]}}
        proof['reconciliation']={'deployment_catalog_runtime_config_unchanged_since_apply':True,'fresh_whole_business_unchanged':False,
          'post_release_business_drift':[{'table':table,'at_apply_count':10,'current_count':10+delta,'fingerprint_changed':True}
            for table,delta in [('eps.workspaces',0),('eps.workspace_candidates',1),('eps.audit_events',2),('eps.idempotency_records',2)]],
          'root_attested_ui_operations':{'workspace_id':'e470aefd-e0f7-480c-bf0d-170cb2cb7069','candidate_id':'b7341092-50c4-49b4-ad5f-a0ceedddebf1',
            'workspace_candidate_id':'ebe0ce53-5f42-4daa-9c46-4519ab18f383'}}
        activation.validate_reconciliation(proof,expected)
        for field,value in [('target','other'),('migration_sha256','changed'),('flags_changed',True),('exact_runtime_function_operations',12)]:
            changed=copy.deepcopy(proof);changed[field]=value
            with self.assertRaises(ValueError):activation.validate_reconciliation(changed,expected)
        changed=copy.deepcopy(proof);changed['reconciliation']['post_release_business_drift'][0]['table']='public.projects'
        with self.assertRaises(ValueError):activation.validate_reconciliation(changed,expected)

    def test_local_flag_parser_accepts_only_fixed_disabled_models_image_and_destination(self):
        values={'EPS_CANDIDATE_MEDIA_ENABLED':'false','EPS_MEDIA_IMAGE_ID':local_activation.IMAGE,
          'OPENAI_TRANSCRIPTION_MODEL':'gpt-transcribe','N8N_CANDIDATE_DISPATCH_URL':'https://synthetic.example.invalid/webhook/eps-wf02-candidate-stage-v1',
          'N8N_CANDIDATE_DISPATCH_SECRET':'a'*64}
        encode=lambda value:''.join(key+'='+entry+'\n' for key,entry in value.items()).encode()
        self.assertEqual(local_activation.checked_config(encode(values)),values)
        for field,value in [('EPS_CANDIDATE_MEDIA_ENABLED','true'),('OPENAI_TRANSCRIPTION_MODEL','other'),
          ('EPS_MEDIA_IMAGE_ID','sha256:'+'b'*64),('N8N_CANDIDATE_DISPATCH_URL','https://user:secret@untrusted.invalid/route')]:
            changed={**values,field:value}
            with self.assertRaises(ValueError):local_activation.checked_config(encode(changed))
        with self.assertRaises(ValueError):local_activation.checked_config(encode(values)+b'OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe\n')


if __name__=='__main__':unittest.main()
