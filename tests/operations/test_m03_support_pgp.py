import copy,sys,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import m03_support_pgp as p
from test_m03_remaining_activation import state,KEY

class SupportPgpTests(unittest.TestCase):
    def test_sql_contains_only_public_recipient_nonce_and_history(self):
        template=(p.a.ROOT/p.BOOTSTRAP).read_text();bundle={'public_key':'-----BEGIN PGP PUBLIC KEY BLOCK-----\nPUBLIC\n-----END PGP PUBLIC KEY BLOCK-----\n','nonce':'a'*32,'constraints_sha256':'c'*64,'private_key':'PRIVATE_SENTINEL_NOT_SQL','unused_key':'71'*32}
        versions=[f'20261028{i:06d}'for i in range(19)];sql=p.compile_sql(template,bundle,versions)
        self.assertNotIn('PRIVATE_SENTINEL_NOT_SQL',sql);self.assertNotIn('71'*32,sql);self.assertIn('extensions.gen_random_bytes(32)',sql)
        for changed in [{'nonce':"';select1"},{'public_key':bundle['public_key'].replace('PUBLIC KEY BLOCK','PRIVATE KEY BLOCK')},{'constraints_sha256':"';select1"}]:
            with self.assertRaises(p.a.ActivationError):p.compile_sql(template,{**bundle,**changed},versions)
        with self.assertRaises(p.a.ActivationError):p.compile_sql(template,bundle,[*versions[:-1],"';select1"])
    def test_bootstrap_preserves_already_enabled_frames_and_nonempty_old_business(self):
        before=state();before['remaining']['frame_config']=dict(p.a.FRAME_ENABLED);after=copy.deepcopy(before);after['remaining']['support_verification_keys']=[KEY];after['counts']['eps.support_verification_keys']=1;after['data_sha256'][p.a.KEY_META]='9'*64
        p.compare_key_delta(before,after,KEY)
        bad=copy.deepcopy(after);bad['remaining']['frame_config']['enabled']=False
        with self.assertRaises(p.a.ActivationError):p.compare_key_delta(before,bad,KEY)
    def test_recovery_is_read_only_reencryption_without_insert_or_rotation(self):
        template=(p.a.ROOT/p.RECOVER).read_text().lower();self.assertIn('begin read only;',template);self.assertIn('rollback;',template)
        for word in ['insert into','update eps.','delete from']:self.assertNotIn(word,template)
        self.assertIn('pgp_pub_encrypt_bytea(secret',template)
    def test_private_child_failures_never_become_raw_diagnostics(self):
        with patch.object(p.subprocess,'run',return_value=SimpleNamespace(returncode=1,stdout='PRIVATE_SENTINEL',stderr='PRIVATE_SENTINEL')):
            with self.assertRaises(p.a.ActivationError)as caught:p.crypto({'action':'decrypt','payload':{'private_key':'PRIVATE_SENTINEL'}},p.sources())
            self.assertNotIn('PRIVATE_SENTINEL',str(caught.exception))
    def test_recovery_receipt_cannot_escape_fixed_evidence_directory(self):
        path='tracking/evidence/m03/support-pgp-bootstrap/2026-10-29T14-48-00-197Z-c221e77f-attempt.json'
        self.assertEqual(p.attempt_path(path),p.a.ROOT/path)
        for value in['../'+path,path.replace('support-pgp-bootstrap','other'),path.replace('-attempt.json','-provision.json'),'C:/private/2026-10-29T14-48-00-197Z-c221e77f-attempt.json']:
            with self.assertRaises(p.a.ActivationError):p.attempt_path(value)
    def test_changed_source_after_claim_stops_dispatch_and_unused_key_replacement(self):
        seals={'reviewed':'a'*64};report={'cloud_write_attempted':False}
        with patch.object(p,'sources',return_value={'reviewed':'b'*64}),patch.object(p.a,'call_sql')as dispatch,patch.object(p,'write_unused_configuration')as write:
            with self.assertRaises(p.a.ActivationError):p.dispatch_bootstrap(Path('claimed-public.sql'),seals,report,True)
            with self.assertRaises(p.a.ActivationError):p.replace_unused(None,b'old','71'*32,seals)
            dispatch.assert_not_called();write.assert_not_called();self.assertFalse(report['cloud_write_attempted'])
    def test_crypto_source_change_blocks_generate_and_private_decrypt_ipc(self):
        seals={'reviewed':'a'*64}
        with patch.object(p,'sources',return_value={'reviewed':'b'*64}),patch.object(p.subprocess,'run')as child:
            for payload in[{'action':'generate'},{'action':'decrypt','payload':{'private_key':'PRIVATE_SENTINEL'}}]:
                with self.assertRaises(p.a.ActivationError):p.crypto(payload,seals)
            child.assert_not_called()

if __name__=='__main__':unittest.main()
