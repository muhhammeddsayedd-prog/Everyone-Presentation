import importlib.util
import inspect
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('m06_guest26_bootstrap', ROOT / 'tools/provision-m06-guest26.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)

class GuestBootstrapProtocolTests(unittest.TestCase):
    def test_public_only_compiler_rejects_untrusted_substitutions(self):
        recipient = {'public_key': '-----BEGIN PGP PUBLIC KEY BLOCK-----\nSYNTHETIC PUBLIC RECIPIENT\n-----END PGP PUBLIC KEY BLOCK-----\n',
                     'private_key': 'SYNTHETIC PRIVATE RECIPIENT', 'nonce': 'a' * 32}
        state = {'versions': [str(20261028010000 + i) for i in range(26)], 'constraints_sha256': 'b' * 64}
        template = (ROOT / bootstrap.BOOTSTRAP).read_text(encoding='utf8')
        sql = bootstrap.compile_sql(template, recipient, state)
        self.assertNotIn(recipient['private_key'], sql)
        self.assertNotIn('__', sql)
        self.assertIn('extensions.gen_random_bytes(32)', sql)
        self.assertIn('backend_key is null', sql)
        for bad in [dict(recipient, nonce="'; select 1;--"), dict(recipient, public_key=recipient['private_key']), dict(recipient, public_key=recipient['public_key'] + 'PRIVATE KEY')]:
            with self.assertRaises(ValueError): bootstrap.compile_sql(template, bad, state)
        with self.assertRaises(ValueError): bootstrap.compile_sql(template, recipient, dict(state, versions=state['versions'][::-1]))
    def test_live_admission_requires_current_actual_local_crypto_proof(self):
        seals = {'public-file': 'c' * 64}
        proof = {'result': 'passed', 'rollback_verified': True, 'actual_pgcrypto_openpgp_round_trip': True,
                 'plaintext_absent_from_statement_statistics_and_error_output': True, 'sources_stable': True,
                 'compiler_sha256': bootstrap.sha(inspect.getsource(bootstrap.compile_sql).encode()),
                 'source_seals': seals, 'cloud_called': False, 'activation_private_configuration_read': False}
        bootstrap.validate_local_proof(proof, seals)
        for key in ('rollback_verified', 'actual_pgcrypto_openpgp_round_trip', 'sources_stable'):
            with self.assertRaises(ValueError): bootstrap.validate_local_proof(dict(proof, **{key: False}), seals)
        with self.assertRaises(ValueError): bootstrap.validate_local_proof(dict(proof, source_seals={}), seals)
        with self.assertRaises(ValueError): bootstrap.validate_local_proof(dict(proof, cloud_called=True), seals)
    def test_recovery_is_read_only_and_does_not_generate_or_enable_keys(self):
        sql = (ROOT / bootstrap.RECOVER).read_text(encoding='utf8').lower()
        for forbidden in ('update eps.', 'insert into', 'gen_random_bytes', 'set enabled'):
            self.assertNotIn(forbidden, sql)
        self.assertIn('not enabled', sql)
        self.assertIn('octet_length(backend_key)=32', sql)

if __name__ == '__main__': unittest.main()
