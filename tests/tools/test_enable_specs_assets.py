"""Offline only: fixed query transport/Windows security are injected; no CLI."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('enable_specs_assets', ROOT / 'tools/enable_specs_assets.py')
tool = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tool)


def state(enabled):
    groups = ['eps_jobs_dispatcher','eps_jobs_executor'] + (['eps_specs_assets_executor'] if enabled else [])
    return {'query_role':'postgres','database':'postgres','versions':tool.VERSIONS,'configuration_rows':1,
            'configuration':{'id':1,'uploads_enabled':enabled,'capabilities_enabled':enabled,'file_pipeline_enabled':enabled},
            'verifier':{'count':1,'expected_active':True},'runtime':{'name':'eps_specs_runtime','login':True,'connection_limit':4,
            **{name:False for name in ('inherit','superuser','bypass_rls','create_db','create_role','replication','auth_schema_usage','schema_create','table_authority','owned_objects')},
            'valid_until':'2030-01-01T00:00:00Z','parents':[{'name':name,'grantor':'postgres','admin':False,'inherit':True,'set':False} for name in groups],
            'incoming':[],'settings':[{'database':'0','values':tool.SETTINGS,'unknown_setting':False}],
            'execute':tool.BASE_FUNCTIONS + (tool.FILE_FUNCTIONS if enabled else [])}}


ENABLED = {'role':'eps_specs_runtime','added_group':'eps_specs_assets_executor','inherit':True,'set':False,'admin':False,
           'configuration':{'id':1,'uploads_enabled':True,'capabilities_enabled':True,'file_pipeline_enabled':True},
           'key_id':tool.KEY_ID,'credentials_created':False,'business_facts_written':False}


class Files:
    def create(self, path):
        return path.open('x+b')

    def verify_open(self, handle):
        if handle.closed:
            raise RuntimeError('closed synthetic handle')


class ActivationTests(unittest.TestCase):
    def test_unsealed_sources_block_before_cli_or_private_phase(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory); (root / 'supabase/.temp').mkdir(parents=True)
            (root / 'supabase/.temp/project-ref').write_text(tool.TARGET)
            with patch.multiple(tool, ROOT=root, SOURCE_SHA256={}), patch.object(tool, 'call') as cli:
                with self.assertRaises(tool.ActivationBlocked):
                    tool.source_checks()
                cli.assert_not_called()

    def test_role_config_key_and_credential_scope_are_exact_before_activation(self):
        self.assertTrue(tool.validate_state(state(False), False))
        for changed in ('flags','key','table','auth','group','guc','expiry','functions'):
            value = state(False)
            if changed == 'flags': value['configuration']['uploads_enabled'] = True
            elif changed == 'key': value['verifier']['expected_active'] = False
            elif changed == 'table': value['runtime']['table_authority'] = True
            elif changed == 'auth': value['runtime']['auth_schema_usage'] = True
            elif changed == 'group': value['runtime']['parents'][0]['set'] = True
            elif changed == 'guc': value['runtime']['settings'][0]['unknown_setting'] = True
            elif changed == 'expiry': value['runtime']['valid_until'] = '2000-01-01T00:00:00Z'
            elif changed == 'functions': value['runtime']['execute'] += ['eps.private_key()']
            with self.assertRaises(tool.ActivationBlocked): tool.validate_state(value, False)

    def run_enable(self, failure=None):
        directory = tempfile.TemporaryDirectory(); self.addCleanup(directory.cleanup)
        root = Path(directory.name); calls=[]; inspections=0
        def query(file, field):
            nonlocal inspections
            calls.append((file, field))
            if file == tool.INSPECT:
                inspections += 1
                if inspections == 2 and failure == 'readback': return state(False)
                return state(inspections == 2)
            if file == tool.SQL:
                if failure == 'lost': raise RuntimeError('synthetic-private-transport-body')
                return copy.deepcopy(ENABLED)
            self.fail('Unexpected query source')
        out = io.StringIO()
        with patch.multiple(tool, JOURNAL=root / 'private/activation.json', EVIDENCE=root / 'receipts'), \
             patch.object(tool, 'source_checks'), patch.object(tool, 'prerequisites'), patch.object(tool, 'query', side_effect=query), \
             patch.object(tool, 'WindowsPrivateFiles', return_value=Files()), patch.object(sys, 'argv', ['tool','enable']), contextlib.redirect_stdout(out):
            code=tool.main()
        phase=json.loads((root / 'private/activation.json').read_text())
        report=json.loads(next((root / 'receipts').glob('*.json')).read_text())
        self.assertNotIn('synthetic-private', out.getvalue())
        return code,phase,report,calls

    def test_one_transition_then_fresh_metadata_readback_completes_without_worker_or_secret(self):
        code,phase,report,calls=self.run_enable()
        self.assertEqual(code,0); self.assertEqual(phase['phase'],'completed'); self.assertEqual(report['result'],'passed')
        self.assertEqual(calls,[(tool.INSPECT,'state'),(tool.SQL,'enabled'),(tool.INSPECT,'state')])
        self.assertFalse(report['worker_started']); self.assertFalse(report['credentials_created']); self.assertFalse(report['secret_recorded'])

    def test_lost_mutation_response_leaves_unconfirmed_journal_and_never_replays(self):
        code,phase,report,calls=self.run_enable('lost')
        self.assertEqual(code,1); self.assertEqual(phase['phase'],'unconfirmed'); self.assertEqual(report['application_status'],'unconfirmed')
        self.assertEqual(sum(file==tool.SQL for file,_ in calls),1); self.assertEqual(len(calls),2)

    def test_successful_dispatch_with_failed_readback_never_claims_success_or_undoes(self):
        code,phase,report,calls=self.run_enable('readback')
        self.assertEqual(code,1); self.assertEqual(phase['phase'],'unconfirmed'); self.assertEqual(report['result'],'unconfirmed')
        self.assertEqual(sum(file==tool.SQL for file,_ in calls),1); self.assertEqual(len(calls),3)


if __name__ == '__main__':
    unittest.main()
