import copy,sys,unittest
from unittest.mock import patch
from types import SimpleNamespace
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import m03_remaining_activation as a

def state():
    return {'query_role':'postgres','database':'postgres','unrestricted_visibility':True,'versions':['20261029133455'],
      'counts':{'eps.support_verification_keys':0,'eps.candidates':8},
      'data_sha256':{'eps.support_verification_keys:metadata':'a'*64,'eps.frame_extraction_config':'b'*64,'eps.candidate_support_config':'c'*64,'eps.candidates':'d'*64},
      'remaining':{'frame_config':dict(a.FRAME_DISABLED),'support_config':dict(a.SUPPORT_DISABLED),'support_verification_keys':[]},
      'protected_m02':{'job_id':a.PROTECTED,'job_exists':True,'job_sha256':'e'*64,'specs_id':'10000000-0000-4000-8000-000000000001','specs_sha256':'f'*64,'manual_note_retained':True,'source_inputs_sha256':'1'*64},'runtime':{'known_operations':11}}
KEY={'key_id':a.KEY_ID,'purpose':'candidate_support','not_before':'2026-10-29T00:00:00+00:00','not_after':None,'revoked_at':None,'created_at':'2026-10-29T00:00:00+00:00'}
class ActivationTests(unittest.TestCase):
    def test_private_configs_are_exact_and_separate(self):
        data=f'CENTRAL_CANDIDATE_SUPPORT_UPLOADS_ENABLED=false\nEPS_SUPPORT_VERIFIER_KEY_ID={a.KEY_ID}\nEPS_SUPPORT_VERIFIER_KEY_HEX={"71"*32}\n'.encode()
        self.assertEqual(a.parse_support(data),'71'*32)
        for bad in [data+b'EXTRA=1\n',data.replace(b'false',b'true'),data.replace(b'candidate-support',b'logo-support'),data.replace(b'\n',b'\r\n')]:
            with self.assertRaises(a.ActivationError):a.parse_support(bad)
        self.assertEqual(a.parse_frame(f'EPS_FRAME_EXTRACTION_ENABLED=false\nEPS_FRAME_IMAGE_ID={a.IMAGE}\n'.encode()),a.IMAGE)
    def test_provision_allows_only_one_key_lifecycle_delta(self):
        before=state();after=copy.deepcopy(before);after['remaining']['support_verification_keys']=[KEY];after['counts']['eps.support_verification_keys']=1;after['data_sha256']['eps.support_verification_keys:metadata']='2'*64
        a.compare_key_provision(before,after,KEY)
        for section,key,value in [('counts','eps.candidates',9),('data_sha256','eps.candidates','3'*64),('runtime','known_operations',12)]:
            bad=copy.deepcopy(after);bad[section][key]=value
            with self.assertRaises(a.ActivationError):a.compare_key_provision(before,bad,KEY)
    def test_activation_preserves_nonempty_business_models_catalog_and_key(self):
        before=state();before['remaining']['support_verification_keys']=[KEY];before['counts']['eps.support_verification_keys']=1;after=copy.deepcopy(before);after['remaining']['frame_config']=dict(a.FRAME_ENABLED);after['remaining']['support_config']=dict(a.SUPPORT_ENABLED);after['data_sha256']['eps.frame_extraction_config']='4'*64;after['data_sha256']['eps.candidate_support_config']='5'*64
        a.compare_activation(before,after)
        for mutate in [lambda v:v['counts'].__setitem__('eps.candidates',9),lambda v:v['protected_m02'].__setitem__('manual_note_retained',False),lambda v:v['remaining']['frame_config'].__setitem__('native_image_id','sha256:'+'0'*64)]:
            bad=copy.deepcopy(after);mutate(bad)
            with self.assertRaises(a.ActivationError):a.compare_activation(before,bad)
    def test_independent_frame_activation_requires_no_key_and_preserves_support(self):
        before=state();after=copy.deepcopy(before);after['remaining']['frame_config']=dict(a.FRAME_ENABLED);after['data_sha256']['eps.frame_extraction_config']='2'*64
        a.compare_frame_activation(before,after)
        for mutate in [lambda v:v['remaining']['support_config'].__setitem__('uploads_enabled',True),lambda v:v['remaining']['support_verification_keys'].append(KEY),lambda v:v['counts'].__setitem__('eps.candidates',9)]:
            bad=copy.deepcopy(after);mutate(bad)
            with self.assertRaises(a.ActivationError):a.compare_frame_activation(before,bad)
    def test_scope_and_template_inputs_cannot_inject_sql(self):
        with self.assertRaises(a.ActivationError):a.render_sql('hello __KEY_HEX__',"';select1",['20261029133455'],'inspect')
        with self.assertRaises(a.ActivationError):a.validate_protected({**state(),'unrestricted_visibility':False})
    def test_rendered_inspection_is_read_only_and_key_never_appears_in_command_arguments(self):
        template=(Path(__file__).resolve().parents[2]/'tools/sql/m03-remaining-key-template.sql').read_text()
        versions=[f'20261028{i:06d}'for i in range(19)]
        sql=a.render_sql(template,'71'*32,versions,'inspect');self.assertIn('begin read only;',sql);self.assertNotIn('__KEY_HEX__',sql)
        self.assertIn("decode('"+'71'*32+"','hex')",sql)
        for action in('provision','enable'):self.assertIn('\nbegin;',a.render_sql(template,'71'*32,versions,action))
        with patch('release_foundation.call',return_value=SimpleNamespace(returncode=0,stdout='{"rows":[{"fixed":{"ok":true}}]}'))as transport:
            self.assertEqual(a.call_sql(Path('synthetic-private.sql'),'fixed'),{'ok':True})
            self.assertNotIn('71'*32,str(transport.call_args));self.assertIn('--file',transport.call_args.args[0]);self.assertNotIn('--query',transport.call_args.args[0])
    def test_missing_canary_proof_prevents_private_sql_creation_or_submission(self):
        with patch.object(a,'local_template_proof',side_effect=a.ActivationError()),patch.object(a,'protected_write')as write,patch.object(a,'call_sql')as query:
            with self.assertRaises(a.ActivationError):a.private_key_query(None,'71'*32,[f'20261028{i:06d}'for i in range(19)],'provision')
            write.assert_not_called();query.assert_not_called()
    def test_logging_or_key_privacy_preflight_fails_before_literal_key_query(self):
        good={'query_role':'postgres','database':'postgres','unrestricted_visibility':True,'literal_key_logging_safe':True,'key_privacy_verified':True}
        with patch.object(a,'call_sql',return_value=good):self.assertEqual(a.admin_guard(),good)
        for key,value in [('query_role','authenticated'),('unrestricted_visibility',False),('literal_key_logging_safe',False),('key_privacy_verified',False)]:
            with patch.object(a,'call_sql',return_value={**good,key:value}):
                with self.assertRaises(a.ActivationError):a.admin_guard()
    def test_existing_unrelated_key_metadata_is_preserved(self):
        before=state();other={**KEY,'key_id':'another-existing-key','revoked_at':'2026-01-01T00:00:00Z'};before['remaining']['support_verification_keys']=[other];before['counts']['eps.support_verification_keys']=1
        after=copy.deepcopy(before);after['remaining']['support_verification_keys']=copy.deepcopy(sorted([other,KEY],key=lambda v:v['key_id']));after['counts']['eps.support_verification_keys']=2;after['data_sha256'][a.KEY_META]='2'*64;a.compare_key_provision(before,after,KEY)
        after['remaining']['support_verification_keys'][0]['revoked_at']=None
        with self.assertRaises(a.ActivationError):a.compare_key_provision(before,after,KEY)

if __name__=='__main__':unittest.main()
