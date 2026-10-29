import copy,importlib.util,sys,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
spec=importlib.util.spec_from_file_location('support_activation',Path(__file__).resolve().parents[2]/'tools/configure-m03-support.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
from test_m03_remaining_activation import state,KEY

class SupportActivationTests(unittest.TestCase):
    def test_only_support_config_changes_with_ready_frames_and_nonempty_business(self):
        before=state();before['remaining']['frame_config']=dict(p.a.FRAME_ENABLED);before['remaining']['support_verification_keys']=[KEY]
        after=copy.deepcopy(before);after['remaining']['support_config']=dict(p.a.SUPPORT_ENABLED);after['data_sha256']['eps.candidate_support_config']='9'*64
        p.compare_support_activation(before,after)
        for mutate in [lambda v:v['remaining']['frame_config'].__setitem__('enabled',False),lambda v:v['counts'].__setitem__('eps.candidates',9),lambda v:v['remaining']['support_verification_keys'].clear(),lambda v:v['protected_m02'].__setitem__('manual_note_retained',False)]:
            bad=copy.deepcopy(after);mutate(bad)
            with self.assertRaises(p.a.ActivationError):p.compare_support_activation(before,bad)
    def test_public_only_challenge_render_rejects_injection(self):
        versions=[f'20261028{i:06d}'for i in range(19)];template=(p.a.ROOT/p.ENABLE).read_text()
        sql=p.render(template,versions,'a'*32,'b'*64);self.assertNotIn('__',sql);self.assertNotIn('decode(',sql);self.assertNotIn('EPS_SUPPORT_VERIFIER_KEY_HEX',sql)
        for nonce,expected in[("';select1",'b'*64),('a'*32,"';select1")]:
            with self.assertRaises(p.a.ActivationError):p.render(template,versions,nonce,expected)
        with self.assertRaises(p.a.ActivationError):p.render(template,[*versions[:-1],"';select1"],'a'*32,'b'*64)
    def test_challenge_keeps_key_out_of_sql_and_rejects_wrong_response(self):
        value={**state(),'versions':[f'20261028{i:06d}'for i in range(19)]};value['remaining']['support_verification_keys']=[KEY]
        captured=[];nonce='a'*32;key='71'*32;expected=p.hmac.new(bytes.fromhex(key),nonce.encode(),p.hashlib.sha256).hexdigest()
        response={'query_role':'postgres','database':'postgres','key_metadata':KEY,'nonce_hmac':expected}
        with patch.object(p.secrets,'token_hex',return_value=nonce),patch.object(p.a,'protected_write',side_effect=lambda s,f,b:captured.append(b)),patch.object(p.a,'call_sql',return_value=response):
            self.assertEqual(p.challenge(None,value,key),(nonce,expected));self.assertNotIn(key.encode(),captured[0])
        with patch.object(p.secrets,'token_hex',return_value=nonce),patch.object(p.a,'protected_write'),patch.object(p.a,'call_sql',return_value={**response,'nonce_hmac':'0'*64}):
            with self.assertRaises(p.a.ActivationError):p.challenge(None,value,key)
    def test_bootstrap_and_local_proof_are_required_before_mutation(self):
        with patch.object(p.a,'public_json',return_value={'result':'failed'}):
            with self.assertRaises(p.a.ActivationError):p.local_template_proof()
        template=(p.a.ROOT/p.CHALLENGE).read_text().lower();self.assertIn('begin read only;',template)
        for text in('insert into','update eps.','delete from'):self.assertNotIn(text,template)
    def test_source_change_after_claim_blocks_admin_dispatch_and_private_flag_write(self):
        seals={'reviewed':'a'*64};report={'cloud_write_attempted':False}
        with patch.object(p,'sources',return_value={'reviewed':'b'*64}),patch.object(p.a,'call_sql')as dispatch,patch.object(p.a,'protected_write')as writer:
            with self.assertRaises(p.a.ActivationError):p.dispatch_enable(Path('claimed-public.sql'),seals,report)
            with self.assertRaises(p.a.ActivationError):p.replace_flag(None,Path('disabled.env'),b'old',writer,seals)
            dispatch.assert_not_called();writer.assert_not_called();self.assertFalse(report['cloud_write_attempted'])

if __name__=='__main__':unittest.main()
