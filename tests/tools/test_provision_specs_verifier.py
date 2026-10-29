"""Offline synthetic boundaries only: no CLI, cloud, real key or Windows ACL proof."""
import base64
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'tools'))
import provision_specs_verifier as tool

ENCODED = base64.urlsafe_b64encode(bytes([79]) * 32).decode().rstrip('=')
VALUE = {'key_id': tool.KEY_ID, 'purpose': 'specs', 'key_bytes': 32, 'secret_base64url': ENCODED,
         'uploads_enabled': False, 'capabilities_enabled': False, 'file_pipeline_enabled': False}


class SyntheticFiles:
    def create(self, path):
        return path.open('x+b')

    def verify_open(self, handle):
        if handle.closed:
            raise RuntimeError('synthetic handle closed')


class ProvisionSpecsVerifierTests(unittest.TestCase):
    def test_unsealed_cloud_proof_blocks_before_any_file_or_cli_operation(self):
        with patch.object(tool, 'CLOUD_PROOF', None), patch.object(tool, 'call') as cli, patch.object(tool, 'WindowsPrivateFiles') as security:
            with self.assertRaises(tool.ProvisionBlocked):
                tool.prerequisites()
            cli.assert_not_called()
            security.assert_not_called()

    def test_response_projection_rejects_enabled_flags_foreign_scope_extra_or_malformed_secret(self):
        self.assertEqual(tool.verified_secret(VALUE), {'SPECS_VERIFICATION_KEY_ID': tool.KEY_ID, 'SPECS_VERIFICATION_KEY_BASE64URL': ENCODED})
        for change in ({'key_id': 'foreign'}, {'purpose': 'client_logo'}, {'uploads_enabled': True}, {'key_bytes': True},
                       {'secret_base64url': 'private-canary'}, {'extra': 'private-canary'}):
            with self.assertRaises(tool.ProvisionBlocked) as error:
                tool.verified_secret({**VALUE, **change})
            self.assertNotIn(ENCODED, str(error.exception))
            self.assertNotIn('private-canary', str(error.exception))

    def test_compact_cloud12_receipt_requires_exact_history_and_unprovisioned_disabled_asset_state(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'supabase/.temp').mkdir(parents=True)
            (root / 'supabase/.temp/project-ref').write_text(tool.TARGET)
            (root / 'supabase/migrations').mkdir()
            migrations = {}
            for version in [*tool.VERSIONS_10, tool.MIGRATION_11_VERSION, tool.MIGRATION_12_VERSION]:
                suffix = '_m02_specs_assets.sql' if version == tool.MIGRATION_11_VERSION else '_m02_specs_mime_guard.sql' if version == tool.MIGRATION_12_VERSION else '_synthetic.sql'
                name = version + suffix
                data = ('synthetic migration ' + version).encode()
                (root / 'supabase/migrations' / name).write_bytes(data)
                migrations[name] = tool.digest(data)
            sql = root / tool.SQL
            sql.parent.mkdir(parents=True)
            sql.write_bytes(b'synthetic sealed query')
            proof = {'target': tool.TARGET, 'action': 'readback', 'result': 'passed', 'application_verified_by_readback': True,
                     'application_status': 'verified_applied', 'inputs': {'migrations': migrations}, 'readback': {
                         'versions': [*tool.VERSIONS_10, tool.MIGRATION_11_VERSION, tool.MIGRATION_12_VERSION], 'catalog_sha256': 'a' * 64, 'assets': {
                             'config': {'id': 1, 'uploads_enabled': False, 'capabilities_enabled': False, 'file_pipeline_enabled': False},
                             'keys': 0, 'uploads': 0, 'grants': 0, 'preparations': 0}}}
            public_proof = root / 'synthetic-proof.json'
            with patch.multiple(tool, ROOT=root, SQL_SHA256=tool.digest(sql.read_bytes()), CLOUD_PROOF='synthetic-proof.json',
                                MIGRATION_11_SHA256=migrations['20261029001520_m02_specs_assets.sql'],
                                MIGRATION_12_SHA256=migrations['20261029003941_m02_specs_mime_guard.sql'],
                                PHASE_FILE=root / 'no-phase', SECRET_FILE=root / 'no-secret'), patch.object(tool, 'call') as cli:
                for changed in (None, 'enabled', 'existing-key', 'old-layout', 'only-eleven', 'wrong-mime-guard'):
                    value = json.loads(json.dumps(proof))
                    if changed == 'enabled':
                        value['readback']['assets']['config']['uploads_enabled'] = True
                    elif changed == 'existing-key':
                        value['readback']['assets']['keys'] = 1
                    elif changed == 'old-layout':
                        value['readback']['base'] = {'versions': value['readback'].pop('versions')}
                    elif changed == 'only-eleven':
                        value['readback']['versions'].pop()
                    elif changed == 'wrong-mime-guard':
                        value['inputs']['migrations']['20261029003941_m02_specs_mime_guard.sql'] = 'b' * 64
                    data = json.dumps(value).encode()
                    public_proof.write_bytes(data)
                    with patch.object(tool, 'CLOUD_PROOF_SHA256', tool.digest(data)):
                        if changed is None:
                            tool.prerequisites()
                        else:
                            with self.assertRaises(tool.ProvisionBlocked):
                                tool.prerequisites()
                cli.assert_not_called()

    def test_duplicate_json_fields_and_changed_phase_claim_are_rejected(self):
        with self.assertRaises(tool.ProvisionBlocked):
            tool.strict_json(b'{"key":1,"key":2}', 64)
        phase = {'version': 1, 'target': tool.TARGET, 'key_id': tool.KEY_ID, 'phase': 'prepared',
                 'claim_id': '70000000-0000-4000-8000-000000000001', 'secret_file': tool.SECRET_RELATIVE,
                 'created_at': '2026-10-29T00:00:00Z', 'completed_at': None, 'contains_secret': False}
        for completed in (None, '2026-10-28T23:59:59Z'):
            with self.assertRaises(tool.ProvisionBlocked):
                tool.phase_bytes({**phase, 'phase': 'completed', 'completed_at': completed})
        handle = io.BytesIO(tool.phase_bytes(phase))
        with patch.object(tool.os, 'fsync'):
            with self.assertRaises(tool.ProvisionBlocked):
                tool.write_phase(SyntheticFiles(), handle, {**phase, 'claim_id': '70000000-0000-4000-8000-000000000002'})

    def run_synthetic(self, root, result):
        private = root / 'synthetic-private'
        evidence = root / 'synthetic-evidence'
        sql = root / tool.SQL
        sql.parent.mkdir(parents=True)
        sql.write_bytes(b'synthetic fixed query')
        stack = contextlib.ExitStack()
        for name, value in {'ROOT': root, 'DIRECTORY': private, 'PHASE_FILE': private / 'phase.json', 'SECRET_FILE': private / 'verifier.json',
                            'EVIDENCE': evidence, 'SQL_SHA256': tool.digest(sql.read_bytes())}.items():
            stack.enter_context(patch.object(tool, name, value))
        stack.enter_context(patch.object(tool, 'prerequisites'))
        stack.enter_context(patch.object(tool, 'WindowsPrivateFiles', SyntheticFiles))
        stack.enter_context(patch.object(sys, 'argv', ['provision_specs_verifier.py', 'provision']))
        cli = stack.enter_context(patch.object(tool, 'call', return_value=result))
        output = io.StringIO()
        stack.enter_context(contextlib.redirect_stdout(output))
        return stack, private, evidence, cli, output

    def test_commit_response_loss_leaves_noncompleted_claim_no_secret_diagnostics_and_blocks_second_dispatch(self):
        with tempfile.TemporaryDirectory() as directory:
            result = types.SimpleNamespace(returncode=1, stdout='private-canary ' + ENCODED, stderr='private-canary ' + ENCODED)
            stack, private, evidence, cli, output = self.run_synthetic(Path(directory), result)
            with stack:
                self.assertEqual(tool.main(), 1)
                self.assertEqual(json.loads((private / 'phase.json').read_text())['phase'], 'unconfirmed')
                self.assertEqual((private / 'verifier.json').read_bytes(), b'')
                recorded = output.getvalue() + ''.join(path.read_text() for path in evidence.glob('*.json'))
                self.assertNotIn('private-canary', recorded)
                self.assertNotIn(ENCODED, recorded)
                with self.assertRaises(FileExistsError):
                    tool.main()
                self.assertEqual(cli.call_count, 1)

    def test_confirmed_result_writes_exact_loader_shapes_without_feature_flag_or_secret_in_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            result = types.SimpleNamespace(returncode=0, stdout=json.dumps({'rows': [{'provisioned': VALUE}]}), stderr='')
            stack, private, _evidence, cli, output = self.run_synthetic(Path(directory), result)
            with stack:
                self.assertEqual(tool.main(), 0)
                phase = json.loads((private / 'phase.json').read_text())
                self.assertEqual(set(phase), tool.PHASE_FIELDS)
                self.assertEqual(phase['phase'], 'completed')
                self.assertEqual(json.loads((private / 'verifier.json').read_text()), {
                    'SPECS_VERIFICATION_KEY_ID': tool.KEY_ID, 'SPECS_VERIFICATION_KEY_BASE64URL': ENCODED})
                self.assertNotIn(ENCODED, output.getvalue())
                self.assertNotIn('secret_base64url', output.getvalue())
                self.assertFalse(json.loads(output.getvalue())['runtime_enablement_requested'])
                self.assertEqual(cli.call_count, 1)


if __name__ == '__main__':
    unittest.main()
