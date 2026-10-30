"""New28 offline release boundary, actual immutable local rollback fixture; no CLI/config."""
import contextlib
import copy
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest import mock
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'))
spec=importlib.util.spec_from_file_location('m06_transcript28_release',ROOT/'tools/release_m06_transcript28.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
PROOF='tracking/evidence/m06/transcript28-release-local/2026-10-30T03-04-42-477Z-e9e0b59b.json'

class Transcript28ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.cli=self.enterContext(mock.patch.object(m,'cli_call',side_effect=AssertionError('Offline only')))
        self.enterContext(mock.patch.object(m,'MIGRATION','20261030040000_m06_frozen_video_source_transcripts.sql'))
        self.delta=json.loads((ROOT/m.DELTA).read_bytes());proof=json.loads((ROOT/PROOF).read_bytes())
        self.before=proof['readback_before'];self.after=proof['readback_expected']
        self.after['old_data']['versions'].append(m.MIGRATION[:14])
        for value in(self.before,self.after):
            value['new_state']['config']={'enabled':True,'key_present':True,'key_bytes':32,'replay_ttl_seconds':86400,'session_ttl_seconds':3600}
            value['runtime']={'execute':sorted(m.OLD_OPERATIONS),'login':True,'inherit':False,'superuser':False,'parents':[]}
            value['protected_m02']={'exists':True,'manual_note_retained':True}
    def test_exact_157_additions_three_source_ports_empty_table_and_preservation(self):
        self.assertEqual(len(m.validate_delta(self.delta)),160);m.validate_before_state(self.before,self.delta);self.assertTrue(all(m.compare_states(self.before,self.after,self.delta).values()))
    def test_unexpected_added_deleted_or_missing_catalog_field_denied(self):
        for kind in('created','deleted','missing','extra_changed'):
            value=copy.deepcopy(self.delta)
            if kind in('created','deleted'):value[kind]['functions|unsafe()|owner']='broad'
            elif kind=='missing':value['created'].pop(next(iter(value['created'])))
            else:value['changed']['functions|unsafe()|source_sha256']={'before':'a'*64,'after':'b'*64}
            with self.subTest(kind=kind),self.assertRaises(m.Blocked):m.validate_delta(value)
    def test_table_forced_rls_and_narrow_acl_required(self):
        for field,value in(('rls',False),('force_rls',False),('owner','authenticated'),('acl','{authenticated=arwdDxt/postgres}')):
            delta=copy.deepcopy(self.delta);delta['created']['tables|eps.presentation_video_transcripts|'+field]=value
            with self.assertRaises(m.Blocked):m.validate_delta(delta)
    def test_private_helpers_cannot_become_definer_broad_acl_or_search_path(self):
        for function in m.NEW_FUNCTIONS:
            for field,value in(('owner','authenticated'),('definer',True),('config',None),('acl','{=X/postgres}')):
                delta=copy.deepcopy(self.delta);delta['created']['functions|'+function+'|'+field]=value
                with self.subTest(function=function,field=field),self.assertRaises(m.Blocked):m.validate_delta(delta)
    def test_policy_roles_and_command_fixed(self):
        for policy in('presentation_video_transcript_internal_read','presentation_video_transcript_guest_read','presentation_video_transcript_capture'):
            for field,value in(('roles',['anon']),('cmd','ALL')):
                delta=copy.deepcopy(self.delta);delta['created']['policies|eps.presentation_video_transcripts.'+policy+'|'+field]=value
                with self.assertRaises(m.Blocked):m.validate_delta(delta)
    def test_no_backfill_table_must_start_empty(self):
        delta=copy.deepcopy(self.delta);delta['new_state']['tables']['presentation_video_transcripts']={'count':1}
        with self.assertRaises(m.Blocked):m.validate_delta(delta)
        self.after['new_state']['tables']['presentation_video_transcripts']={'count':1}
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_cloud_preflight_requires_enabled_32byte_key_metadata_only(self):
        for field,value in(('enabled',False),('key_present',False),('key_bytes',31),('session_ttl_seconds',60)):
            before=copy.deepcopy(self.before);before['new_state']['config'][field]=value
            with self.assertRaises(m.Blocked):m.validate_before_state(before,self.delta)
    def test_exact27_history_and_absent_companion_required(self):
        for versions in(self.before['old_data']['versions'][:-1],self.after['old_data']['versions'],['0']*27):
            before=copy.deepcopy(self.before);before['old_data']['versions']=versions
            with self.assertRaises(m.Blocked):m.validate_before_state(before,self.delta)
        self.before['new_state']['tables']['presentation_video_transcripts']={'count':0}
        with self.assertRaises(m.Blocked):m.validate_before_state(self.before,self.delta)
    def test_existing_source_port_hash_must_match(self):
        self.before['catalog_delta_values'][next(iter(m.CHANGED_KEYS))]='0'*64
        with self.assertRaises(m.Blocked):m.validate_before_state(self.before,self.delta)
    def test_noncredential_business_storage_and_old_version_rows_preserved(self):
        for table in('eps.jobs','storage.objects','eps.presentation_versions','eps.presentation_version_assets','eps.version_slides'):
            after=copy.deepcopy(self.after);after['old_data']['hashes'][table]='0'*64
            with self.subTest(table=table),self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_managed_auth_count_metadata_preserved(self):
        after=copy.deepcopy(self.after);after['old_data']['managed_auth']['user_count']+=1
        with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_other_catalog_owners_acls_defaults_storage_preserved(self):
        self.after['catalog_protected_sha256']='0'*64
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_exact_catalog_count_and_old_hashes_required(self):
        self.after['catalog_count']+=1
        with self.assertRaises(m.Blocked):m.compare_states(self.before,self.after,self.delta)
    def test_key_metadata_flags_and_existing_counts_preserved(self):
        for mutate in(lambda v:v['new_state']['config'].update(enabled=False),lambda v:v['new_state']['config'].update(key_bytes=16),lambda v:v['new_state']['tables']['review_links'].update(count=1)):
            after=copy.deepcopy(self.after);mutate(after)
            with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_exact_history_append_and_source_delta_required(self):
        for mutate in(lambda v:v['old_data']['versions'].append('20261030040001'),lambda v:v['catalog_delta_values'].pop(next(iter(m.CHANGED_KEYS)))):
            after=copy.deepcopy(self.after);mutate(after)
            with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_runtime12_and_protected_m02_preserved(self):
        for mutate in(lambda v:v['runtime']['execute'].append('eps.unsafe()'),lambda v:v['runtime'].update(superuser=True),lambda v:v['protected_m02'].update(manual_note_retained=False)):
            after=copy.deepcopy(self.after);mutate(after)
            with self.assertRaises(m.Blocked):m.compare_states(self.before,after,self.delta)
    def test_exact_pending_and_connection_environment(self):
        m.validate_pending(m.MIGRATION)
        for value in('',m.MIGRATION+'\n20261030040001_unsafe.sql'):
            with self.assertRaises(m.Blocked):m.validate_pending(value)
        for key in('PGHOST','PGOPTIONS','PGPASSWORD','SUPABASE_DB_URL','SUPABASE_WORKDIR'):
            with self.assertRaises(m.Blocked):m.validate_process_scope({key:'override'})
    def test_pin_refusal_precedes_cli_and_old_claim_blocks_repeat(self):
        with mock.patch.object(m,'CONFIG_SHA',''):
            with self.assertRaises(m.Blocked):m.current_release_inputs()
        for claimed,attempts in((True,[]),(False,['old'])):
            claim=mock.Mock();claim.exists.return_value=claimed;evidence=mock.Mock();evidence.glob.return_value=attempts
            with mock.patch.object(m,'CLAIM',claim),mock.patch.object(m,'EVIDENCE',evidence),self.assertRaises(m.Blocked):m.refuse_repeat_apply()
        self.cli.assert_not_called()
    def test_apply_exclusive_claim_precedes_only_one_dispatch(self):
        inputs={'versions':self.after['old_data']['versions'],'input':'synthetic'};events=[]
        dry={'result':'passed','inputs':inputs,'before':self.before,'pending_migrations':[m.MIGRATION],'finished_at':m.stamp()}
        def read(file):
            if file==m.DELTA:return self.delta
            if file.endswith('/dry-run.json'):return dry
            raise AssertionError('Unexpected read')
        def call(command):
            self.assertIn('claim',events);events.append('dispatch');return subprocess.CompletedProcess(command,0,m.MIGRATION,'')
        with mock.patch.object(m,'current_release_inputs',return_value=inputs),mock.patch.object(m,'inspect_state',side_effect=[self.before,self.after]),mock.patch.object(m,'read_json',side_effect=read),mock.patch.object(m,'refuse_repeat_apply'),mock.patch.object(m,'retain',return_value='tracking/evidence/cloud-m06-transcript28/synthetic-apply-attempt.json'),mock.patch.object(m,'private_write',side_effect=lambda *args:events.append('claim')),mock.patch.object(m,'call',side_effect=call),contextlib.redirect_stdout(io.StringIO()):m.main(['apply'])
        self.assertEqual(events,['claim','dispatch'])

if __name__=='__main__':unittest.main()
