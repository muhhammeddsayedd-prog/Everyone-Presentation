"""Offline source/catalog/one-shot release guards. No CLI/DB/provider calls."""
import copy,json,sys,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import release_m04_casting as release

SOURCE_ROOT=Path(__file__).resolve().parents[2]

class CastingReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.proof=release.read_json(release.PROOF)
        cls.temporary=tempfile.TemporaryDirectory();cls.addClassCleanup(cls.temporary.cleanup)
        cls.fixture=Path(cls.temporary.name).resolve()
        paths={release.BASELINE,release.PROOF,release.PROMOTION,release.RACE,release.READBACK,*release.DEPENDENCIES,
          'supabase/config.toml','tools/test-m04-casting-migration-local.mjs','tools/promote-m04-casting-local.mjs'}
        paths.update(cls.proof['source_seals'])
        manifest=json.loads((SOURCE_ROOT/'tracking/evidence/m04/migration-preparation/reviewed20-manifest.json').read_bytes())
        paths.update(row['path']for row in manifest['migrations'])
        for relative in paths:
            destination=cls.fixture/relative;destination.parent.mkdir(parents=True,exist_ok=True)
            destination.write_bytes((SOURCE_ROOT/relative).read_bytes())
        (cls.fixture/'development/local-db/reviewed.json').write_bytes((SOURCE_ROOT/'tracking/evidence/m04/migration-preparation/reviewed20-manifest.json').read_bytes())
        link=cls.fixture/'supabase/.temp/project-ref';link.parent.mkdir(exist_ok=True);link.write_text(release.TARGET,encoding='utf8')
    def setUp(self):
        self.enterContext(patch.object(release,'ROOT',self.fixture))
        self.cli=self.enterContext(patch.object(release,'cli_call',side_effect=AssertionError('Offline test must never reach the CLI.')))
    def states(self):
        before=copy.deepcopy(self.proof['before']);after=copy.deepcopy(self.proof['expected'])
        roles={r['name']:r for r in after['catalog']['roles']};owner=roles['eps_casting_owner'];guard=roles['eps_casting_guard_owner']
        defaults={schema:{'public_usage':guard['schema_usage'][schema]if schema!='eps'else False,'public_create':False,
          'authenticated_usage':owner['schema_usage'][schema]and not guard['schema_usage'][schema], 'authenticated_create':False}
          for schema in('eps','public','auth','storage','extensions')}
        for state in(before,after):state.update(schema_defaults=copy.deepcopy(defaults),managed_auth={'policies':[],'owner':'synthetic auth owner'})
        return before,after
    def test_pinned_portable_sources_proof_and_promotion_pass_without_cli(self):
        result=release.current_release_inputs();self.assertEqual(len(result['versions']),20);self.cli.assert_not_called()
    def test_manifest_drift_stops_before_cli(self):
        file=self.fixture/'development/local-db/reviewed.json';original=file.read_bytes()
        try:
            manifest=json.loads(original);manifest['migrations'].append(copy.deepcopy(manifest['migrations'][-1]));file.write_text(json.dumps(manifest),encoding='utf8')
            with self.assertRaises(ValueError):release.current_release_inputs()
        finally:file.write_bytes(original)
        self.cli.assert_not_called()
    def test_sealed_query_drift_stops_before_cli(self):
        file=self.fixture/release.READBACK;original=file.read_bytes()
        try:
            file.write_bytes(original+b'\n-- synthetic offline change\n')
            with self.assertRaises(ValueError):release.current_release_inputs()
        finally:file.write_bytes(original)
        self.cli.assert_not_called()
    def test_exact_local_reference_and_metadata_snapshot_pass(self):
        before,after=self.states();result=release.compare_states(before,after,self.proof['before'],self.proof['expected'])
        self.assertTrue(result['business_rows_preserved']);self.assertTrue(result['managed_auth_and_schema_defaults_preserved'])
    def test_old_facts_runtime_configs_auth_and_unreviewed_acl_changes_are_denied(self):
        for change in('fact','count','runtime','config','auth','schema','acl'):
            with self.subTest(change=change):
                before,after=self.states()
                if change=='fact':after['data_sha256']['eps.jobs']='0'*64
                elif change=='count':after['counts']['eps.jobs']+=1
                elif change=='runtime':after['runtime']={'unreviewed':True}
                elif change=='config':after['source_config']={'unreviewed':True}
                elif change=='auth':after['managed_auth']['policies'].append({'unreviewed':True})
                elif change=='schema':after['schema_defaults']['public']['public_create']=True
                else:after['catalog']['functions'][0]['execute']['authenticated']=not after['catalog']['functions'][0]['execute']['authenticated']
                with self.assertRaises(ValueError):release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_new_tables_must_remain_empty_and_exactly_the_reviewed_set(self):
        for change in('fixture','missing','extra'):
            before,after=self.states()
            if change=='fixture':after['counts']['eps.assignments']=1
            elif change=='missing':del after['data_sha256']['eps.assignments']
            else:after['counts']['eps.unreviewed']=0
            with self.assertRaises(ValueError):release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_casting_owners_cannot_inherit_create_or_be_login_bypass_roles(self):
        for change in('public_create','authenticated_create','login','bypass_rls'):
            before,after=self.states()
            if change in('public_create','authenticated_create'):before['schema_defaults']['public'][change]=True;after['schema_defaults']['public'][change]=True
            else:next(r for r in after['catalog']['roles']if r['name']=='eps_casting_owner')[change]=True
            with self.assertRaises(ValueError):release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_managed_public_predicate_flags_derive_only_observed_inheritance(self):
        for public,authenticated in((True,False),(False,True),(False,False)):
            before,after=self.states()
            a=next(r for r in before['catalog']['functions']if r['name']=='storage.operation')
            b=next(r for r in after['catalog']['functions']if r['name']=='storage.operation')
            for row in(a,b):row['public_execute']=public;row['execute']['authenticated']=authenticated
            b['execute']['eps_casting_owner']=public or authenticated;b['execute']['eps_casting_guard_owner']=public
            release.compare_states(before,after,self.proof['before'],self.proof['expected'])
    def test_only_exact_pending_migration_and_explicit_no_seed_vault_target_command_pass(self):
        release.validate_pending('Applying migration '+release.MIGRATION)
        for text in('',release.MIGRATION+'\n20261029999999_unreviewed.sql','20261029999999_unreviewed.sql'):
            with self.assertRaises(ValueError):release.validate_pending(text)
        command=release.push_command(True);self.assertIn('--dry-run',command);self.assertIn('--skip-vault',command);self.assertNotIn('--include-seed',command)
        self.assertEqual(command[command.index('--project-ref')+1],release.TARGET)
    def test_existing_intent_or_attempt_prevents_repeat_apply(self):
        with tempfile.TemporaryDirectory()as folder:
            private=Path(folder)/'private';evidence=Path(folder)/'evidence';private.mkdir();evidence.mkdir()
            with patch.object(release,'CLAIM',private/'apply.claim.json'),patch.object(release,'EVIDENCE',evidence):
                release.refuse_repeat_apply();release.CLAIM.write_text('{}')
                with self.assertRaises(ValueError):release.refuse_repeat_apply()
                release.CLAIM.unlink();(evidence/'retained-apply-attempt.json').write_text('{}')
                with self.assertRaises(ValueError):release.refuse_repeat_apply()

if __name__=='__main__':unittest.main()
