"""Offline exact21 release guards; never calls CLI, database or provider."""
import copy,json,sys,tempfile,unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import release_m03_frame_vision as release

SOURCE_ROOT=Path(__file__).resolve().parents[2]
RUNTIME_RECEIPT='tracking/evidence/cloud-m04-casting/2026-10-29T18-06-32-278912Z-2e383297-readback.json'

class FrameVisionReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proof=release.read_json(release.PROOF);cls.runtime_state=json.loads((SOURCE_ROOT/RUNTIME_RECEIPT).read_bytes())['readback']
        cls.temporary=tempfile.TemporaryDirectory();cls.addClassCleanup(cls.temporary.cleanup);cls.fixture=Path(cls.temporary.name).resolve()
        paths={release.BASELINE,release.PROOF,release.PROMOTION,release.READBACK,*release.DEPENDENCIES,
          'supabase/config.toml','tools/test-m03-frame-vision-local.mjs','tools/promote-m03-frame-vision-local.mjs'}
        paths.update(cls.proof['source_seals'])
        manifest=json.loads((SOURCE_ROOT/'tracking/evidence/m03/frame-vision-preparation/reviewed21-manifest.json').read_bytes())
        paths.update(row['path']for row in manifest['migrations'])
        for relative in paths:
            destination=cls.fixture/relative;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes((SOURCE_ROOT/relative).read_bytes())
        (cls.fixture/'development/local-db/reviewed.json').write_bytes((SOURCE_ROOT/'tracking/evidence/m03/frame-vision-preparation/reviewed21-manifest.json').read_bytes())
        link=cls.fixture/'supabase/.temp/project-ref';link.parent.mkdir(exist_ok=True);link.write_text(release.TARGET,encoding='utf8')
    def setUp(self):
        self.enterContext(patch.object(release,'ROOT',self.fixture))
        self.cli=self.enterContext(patch.object(release,'cli_call',side_effect=AssertionError('Offline guard must not invoke CLI.')))
    def states(self):return copy.deepcopy(self.proof['before']),copy.deepcopy(self.proof['expected'])
    def test_portable_exact21_sources_proof_and_promotion_pass_without_cli(self):
        inputs=release.current_release_inputs();self.assertEqual(len(inputs['versions']),21);self.cli.assert_not_called()
    def test_current_manifest_drift_stops_before_cli(self):
        file=self.fixture/'development/local-db/reviewed.json';original=file.read_bytes()
        try:
            manifest=json.loads(original);manifest['migrations'].append(copy.deepcopy(manifest['migrations'][-1]));file.write_text(json.dumps(manifest),encoding='utf8')
            with self.assertRaises(ValueError):release.current_release_inputs()
        finally:file.write_bytes(original)
        self.cli.assert_not_called()
    def test_sealed_readback_drift_stops_before_cli(self):
        file=self.fixture/release.READBACK;original=file.read_bytes()
        try:
            file.write_bytes(original+b'\n-- synthetic offline drift\n')
            with self.assertRaises(ValueError):release.current_release_inputs()
        finally:file.write_bytes(original)
        self.cli.assert_not_called()
    def test_exact_three_bodies_and_one_safe_constraint_pass(self):
        before,after=self.states();result=release.compare_states(before,after,self.proof['before'],self.proof['expected'])
        self.assertTrue(result['only_three_function_bodies_and_one_check_changed']);self.assertEqual(len(result['changed_functions']),3)
    def test_old_facts_pins_casting_auth_configuration_or_runtime_drift_are_denied(self):
        for change in('facts','pins','casting','auth','schema','config','runtime'):
            with self.subTest(change=change):
                before,after=self.states()
                if change=='facts':after['data_sha256']['eps.candidates']='0'*64
                elif change=='pins':after['data_sha256']['eps.workspace_candidates']='0'*64
                elif change=='casting':after['counts']['eps.assignments']+=1
                elif change=='auth':after['managed_auth']['rls']=not after['managed_auth']['rls']
                elif change=='schema':after['schema_defaults']['public']['public_create']=True
                elif change=='config':after['source_config']={'unreviewed':True}
                else:after['runtime']={'unreviewed':True}
                with self.assertRaises(ValueError):release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_extra_function_changes_or_authority_are_denied(self):
        for change in('fourth_source','acl','owner','native_source'):
            before,after=self.states()
            if change=='fourth_source':next(r for r in after['catalog']['functions']if r['signature']not in release.FUNCTIONS)['source_sha256']='0'*64
            elif change=='native_source':after['data_sha256']['eps.candidate_asset_config']='0'*64
            else:
                row=next(r for r in after['catalog']['functions']if r['signature']==release.FUNCTIONS[0])
                if change=='acl':row['execute']['authenticated']=True
                else:row['owner']='postgres'
            with self.assertRaises(ValueError):release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_check_cannot_be_loosened_or_silently_left_at_four_codes(self):
        for definition in('CHECK (true)',self.proof['changed_constraint']['before_definition'],self.proof['changed_constraint']['after_definition'].replace('<= 5','<= 6')):
            before,after=self.states();next(r for r in after['catalog']['constraints']if r['table']=='eps.candidate_media'and r['name']=='candidate_media_processing_issues_check')['definition']=definition
            with self.assertRaises(ValueError):release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_readonly_decoder_checks_actual_observed_eleven_operation_shape(self):
        state=copy.deepcopy(self.runtime_state)
        response=SimpleNamespace(returncode=0,stdout=json.dumps({'rows':[{'m04_casting_release':state}]}))
        with patch.object(release,'call',return_value=response):self.assertEqual(len(release.inspect_state()['runtime']['execute']),11)
        for change in('hidden','table','extra_operation','protected'):
            altered=copy.deepcopy(state)
            if change=='hidden':altered['unrestricted_visibility']=False
            elif change=='table':altered['runtime']['table_authority']=True
            elif change=='extra_operation':altered['runtime']['execute'].append('eps.candidate_upload_scope(uuid)')
            else:altered['protected_m02']['manual_note_retained']=False
            response=SimpleNamespace(returncode=0,stdout=json.dumps({'rows':[{'m04_casting_release':altered}]}))
            with patch.object(release,'call',return_value=response),self.assertRaises(ValueError):release.inspect_state()
        self.cli.assert_not_called()
    def test_exact_pending_target_no_seed_and_no_vault_sync(self):
        release.validate_pending('Applying migration '+release.MIGRATION)
        for text in('',release.MIGRATION+'\n20261029999999_unreviewed.sql','20261029999999_unreviewed.sql'):
            with self.assertRaises(ValueError):release.validate_pending(text)
        command=release.push_command(True);self.assertIn('--dry-run',command);self.assertIn('--skip-vault',command);self.assertNotIn('--include-seed',command)
        self.assertEqual(command[command.index('--project-ref')+1],release.TARGET)
    def test_durable_claim_or_retained_attempt_prevents_repeat_apply(self):
        with tempfile.TemporaryDirectory()as directory:
            folder=Path(directory);claim=folder/'apply.claim.json';evidence=folder/'evidence';evidence.mkdir()
            with patch.object(release,'CLAIM',claim),patch.object(release,'EVIDENCE',evidence):
                release.refuse_repeat_apply();claim.write_text('{}')
                with self.assertRaises(ValueError):release.refuse_repeat_apply()
                claim.unlink();(evidence/'retained-apply-attempt.json').write_text('{}')
                with self.assertRaises(ValueError):release.refuse_repeat_apply()

if __name__=='__main__':unittest.main()
