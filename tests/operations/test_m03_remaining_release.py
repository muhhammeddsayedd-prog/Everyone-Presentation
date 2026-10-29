"""Offline metadata comparison and dispatch guards; no CLI/network/provider call."""
import copy
import contextlib
import datetime
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
import release_m03_remaining as release


class M03RemainingReleaseTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        proof=json.loads((release.ROOT/release.PROOF).read_bytes())
        cls.before=proof['before'];cls.after=proof['expected']

    def compare(self,before=None,after=None):
        return release.compare_states(before or self.before,after or self.after,self.before,self.after)

    def test_exact_reviewed_local_delta_passes(self):
        result=self.compare()
        self.assertIs(result['business_rows_preserved'],True)
        self.assertIs(result['runtime_authority_unchanged'],True)

    def test_exact_two_migration_batch_uses_final_reviewed_function_delta(self):
        final=copy.deepcopy(self.after)
        final['versions'].append('20261029135318')
        function=next(row for row in final['catalog']['functions'] if row['name']=='public.eps_extract_candidate_frames')
        function['source_sha256']='f'*64
        result=release.compare_states(self.before,final,self.before,final)
        self.assertIs(result['business_rows_preserved'],True)
        changed=copy.deepcopy(final)
        next(row for row in changed['catalog']['functions'] if row['name']=='public.eps_extract_candidate_frames')['source_sha256']='e'*64
        with self.assertRaises(ValueError):release.compare_states(self.before,changed,self.before,final)

    def test_pending_must_be_exact_eighteen_and_nineteen_batch(self):
        names=['20261029133455_m03_remaining_media_library.sql','20261029135318_m03_frame_request_resubmission.sql']
        release.validate_pending('\n'.join(names))
        for invalid in [names[0],names[1],'\n'.join(names+['20261029140000_unrelated.sql'])]:
            with self.subTest(invalid=invalid),self.assertRaises(ValueError):release.validate_pending(invalid)

    def test_real_nineteen_rollback_allows_only_function_body_and_preserves_old_rows(self):
        proof=release.read_json(release.RESUBMISSION_PROOF);original=release.read_json(release.PROOF)
        # Promotion is mocked here; current_release_inputs independently requires
        # the exact sealed actual promotion before the CLI can be reached.
        promotion={'result':'passed','cloud_called':False,'provider_called':False,
                   'migration_sha256':release.MIGRATION_SHA,'proof_sha256':release.RESUBMISSION_PROOF_SHA,
                   'readback_sha256':release.READBACK_SHA,'before':proof['before'],'after':proof['expected'],
                   'business_and_old_catalog_preserved':True,'only_reviewed_function_body_changed':True,
                   'managed_auth_preserved':True,'managed_auth_before':{'synthetic':True},'managed_auth_after':{'synthetic':True},
                   'harness_sha256':release.sha((release.ROOT/'tools/promote-m03-frame-resubmission-local.mjs').read_bytes()),
                   'comparison':{'business_rows_preserved':True,'only_one_reviewed_function_body_changed':True,'all_other_catalog_and_runtime_preserved':True}}
        release.validate_resubmission_evidence(proof,promotion,original)
        changed=copy.deepcopy(proof);changed['expected']['data_sha256']['eps.jobs']='0'*64
        with self.assertRaises(ValueError):release.validate_resubmission_evidence(changed,promotion,original)
        changed=copy.deepcopy(proof);changed['red_reproduced']=False
        with self.assertRaises(ValueError):release.validate_resubmission_evidence(changed,promotion,original)

    def test_enabled_config_and_nonempty_current_business_are_preserved(self):
        before=copy.deepcopy(self.before);after=copy.deepcopy(self.after)
        for state in (before,after):
            state['counts']['eps.candidates']=2
            state['data_sha256']['eps.candidates']='c'*64
            state['source_config']['enabled']=True
            state['candidate_processing_issues_pristine']=False
            state['runtime']={'synthetic_preserved_runtime':True}
        self.compare(before,after)
        after['data_sha256']['eps.candidates']='d'*64
        with self.assertRaises(ValueError):self.compare(before,after)

    def test_known_managed_public_storage_predicates_derive_new_role_flags(self):
        before=copy.deepcopy(self.before);after=copy.deepcopy(self.after)
        reference_before=copy.deepcopy(self.before);reference_after=copy.deepcopy(self.after)
        # Explicitly simulate the historical managed-local PUBLIC=false case,
        # even when the current local provider image itself now has PUBLIC=true.
        for state in (reference_before,reference_after):
            for row in state['catalog']['functions']:
                if row['name'] in release.MANAGED_PREDICATES:
                    row['public_execute']=False
                    row['execute']={role:False for role in row['execute']}
        for state in (before,after):
            for row in state['catalog']['functions']:
                if row['name'] in release.MANAGED_PREDICATES:
                    row['public_execute']=True
                    row['explicit_acl']=[{'grantor':row['owner'],'grantee':'PUBLIC','privilege':'EXECUTE','grantable':False}]
                    row['execute']={role:True for role in row['execute']}
        result=release.compare_states(before,after,reference_before,reference_after)
        self.assertEqual(result['managed_storage_derived_flags'],6)
        # This normalization never permits a real ACL or source mutation.
        next(row for row in after['catalog']['functions'] if row['name'] in release.MANAGED_PREDICATES)['source_sha256']='0'*64
        with self.assertRaises(ValueError):release.compare_states(before,after,reference_before,reference_after)

    def test_old_rows_catalog_runtime_and_new_data_tampering_fail(self):
        for kind in ['rows','runtime','private_execute','new_row','enabled','policy','history']:
            after=copy.deepcopy(self.after)
            if kind=='rows':after['data_sha256']['eps.jobs']='0'*64
            elif kind=='runtime':after['runtime']={'new_execute':'eps.anything()'}
            elif kind=='private_execute':next(row for row in after['catalog']['functions'] if row['name']=='eps.frame_user_outcome')['execute']['authenticated']=True
            elif kind=='new_row':after['counts']['eps.candidate_support']=1
            elif kind=='enabled':after['remaining']['frame_config']['enabled']=True
            elif kind=='policy':after['catalog']['policies'][0]['using']='true'
            else:after['versions'].append('20261029140000')
            with self.subTest(kind=kind),self.assertRaises(ValueError):self.compare(after=after)

    def test_extra_managed_storage_column_keeps_old_and_derived_new_role_acls(self):
        before=copy.deepcopy(self.before);after=copy.deepcopy(self.after)
        column={'table':'storage.objects','name':'synthetic_provider_column','position':999,'type':'text','not_null':False,
                'identity':'','generated':'','default':None,'explicit_acl':[]}
        for state in (before,after):
            state['catalog']['columns'].append(copy.deepcopy(column))
            for row in state['catalog']['table_acls']:
                if row['table']=='storage.objects':
                    state['catalog']['column_acls'].append({'table':row['table'],'column':column['name'],'role':row['role'],
                        **{key:row[key] for key in ['select','insert','update','references']}})
        self.compare(before,after)
        next(row for row in after['catalog']['column_acls'] if row['column']==column['name'] and row['role']=='authenticated')['select']=False
        with self.assertRaises(ValueError):self.compare(before,after)

    def managed_storage_variation(self):
        before=copy.deepcopy(self.before);after=copy.deepcopy(self.after)
        missing={'constraints':{('storage.buckets','buckets_name_key'),('storage.objects','objects_bucket_id_fkey'),('storage.objects','objects_bucket_id_name_key')},
                 'indexes':{('storage.buckets','buckets_name_key'),('storage.objects','objects_bucket_id_name_key')}}
        for state in (before,after):
            for kind,keys in missing.items():state['catalog'][kind]=[row for row in state['catalog'][kind] if (row['table'],row['name']) not in keys]
            state['catalog']['constraints'].append({'table':'storage.objects','name':'objects_bucketId_fkey','validated':True,
                'definition':'FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id)'})
            state['catalog']['indexes'].append({'table':'storage.buckets','name':'bname','ready':True,'valid':True,
                'definition':'CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name)'})
        return before,after

    def test_only_exact_unchanged_local_storage_rows_may_be_absent_in_cloud(self):
        before,after=self.managed_storage_variation()
        self.compare(before,after)
        # Every actual cloud row must still survive unchanged after the release.
        after['catalog']['constraints']=[row for row in after['catalog']['constraints'] if row['name']!='objects_bucketId_fkey']
        with self.assertRaises(ValueError):self.compare(before,after)

    def test_missing_application_or_reviewed_changed_managed_row_is_never_ignored(self):
        before,after=self.managed_storage_variation()
        row=next(row for row in before['catalog']['constraints'] if row['table']=='eps.jobs')
        before['catalog']['constraints'].remove(row)
        with self.assertRaises(ValueError):self.compare(before,after)
        before,after=self.managed_storage_variation();reference_after=copy.deepcopy(self.after)
        next(row for row in reference_after['catalog']['constraints'] if row['table']=='storage.buckets' and row['name']=='buckets_name_key')['validated']=False
        with self.assertRaises(ValueError):release.compare_states(before,after,self.before,reference_after)

    def test_apply_command_requires_exact_pending_migration_and_no_extra_output_name(self):
        pending='\n'.join(row['migration'] for row in release.MIGRATIONS)
        self.assertEqual(release.pending_migrations(pending),[row['migration'] for row in release.MIGRATIONS])
        with self.assertRaises(ValueError):release.validate_pending(pending+'\n20261029140000_unrelated.sql')
        self.assertEqual(release.push_command(True),['db','push','--linked','--project-ref',release.TARGET,'--skip-vault','--yes','--output-format','json','--dry-run'])

    def test_support_key_secret_never_enters_row_hash_and_known_lifecycle_is_selected(self):
        source=(release.ROOT/release.READBACK).read_text()
        self.assertIn("'support_verification_keys','specs_asset_grants'",source)
        self.assertIn('select key_id,purpose,not_before,not_after,revoked_at,created_at from eps.support_verification_keys',source)
        self.assertNotIn('select secret',source.lower())
        self.assertNotIn("to_jsonb(r)-'processing_issues'",source)

    def test_repeat_mutation_claim_is_rejected_without_calling_cli(self):
        with patch.object(release,'apply_claim_exists',return_value=True),patch.object(release,'call') as call:
            with self.assertRaises(ValueError):release.refuse_repeat_apply()
            call.assert_not_called()

    def final(self):
        final=copy.deepcopy(self.after);final['versions'].append(release.MIGRATION[:14])
        next(row for row in final['catalog']['functions'] if row['name']=='public.eps_extract_candidate_frames')['source_sha256']='f'*64
        return final

    @contextlib.contextmanager
    def sandbox(self):
        # Every service seam is replaced; only isolated synthetic metadata is written.
        with tempfile.TemporaryDirectory() as directory,contextlib.ExitStack() as stack:
            root=Path(directory);evidence=root/'tracking/evidence/cloud-m03-remaining';private=root/'.local/cloud-m03-remaining'
            evidence.mkdir(parents=True);private.mkdir(parents=True)
            final=self.final();inputs={'versions':final['versions'],'synthetic_inputs':True}
            for name,value in [('ROOT',root),('EVIDENCE',evidence),('PRIVATE',private),('CLAIM',private/'apply.claim.json')]:
                stack.enter_context(patch.object(release,name,value))
            stack.enter_context(patch.object(release,'current_release_inputs',return_value=inputs))
            stack.enter_context(patch.object(release,'final_reference',return_value=(self.before,final)))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            def write_private(path,data):
                with path.open('xb') as handle:handle.write(data)
            stack.enter_context(patch.object(release,'_private_write',side_effect=write_private))
            yield evidence,private,inputs,final

    def dry_receipt(self,evidence,inputs,*,before=None,age=0):
        receipt={'result':'passed','inputs':inputs,'before':before or self.before,
                 'pending_migrations':[row['migration'] for row in release.MIGRATIONS],
                 'finished_at':(datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=age)).isoformat()}
        (evidence/'dry-run.json').write_text(json.dumps(receipt))

    def test_unknown_dispatch_is_journalled_once_and_never_retried(self):
        with self.sandbox() as (evidence,private,inputs,_):
            self.dry_receipt(evidence,inputs)
            with patch.object(release,'inspect_state',return_value=self.before),patch.object(release,'call',side_effect=TimeoutError) as call:
                with self.assertRaises(TimeoutError):release.main(['apply'])
                self.assertTrue((private/'apply.claim.json').exists())
                claim=json.loads((private/'apply.claim.json').read_bytes())
                self.assertIs(claim['dispatch_may_have_occurred'],True)
                self.assertTrue((release.ROOT/claim['attempt_receipt']).exists())
                with self.assertRaises(ValueError):release.main(['apply'])
                self.assertEqual(call.call_count,1)
            failures=[json.loads(path.read_bytes()) for path in evidence.glob('*-apply.json')]
            self.assertEqual(len(failures),2)
            self.assertTrue(all(row['result']=='failed' for row in failures))

    def test_changed_source_after_claim_keeps_claim_without_reporting_a_dispatch(self):
        with self.sandbox() as (evidence,private,inputs,_):
            self.dry_receipt(evidence,inputs)
            with patch.object(release,'current_release_inputs',side_effect=[inputs,{**inputs,'changed':True}]),patch.object(release,'inspect_state',return_value=self.before),patch.object(release,'call') as call:
                with self.assertRaises(ValueError):release.main(['apply'])
                call.assert_not_called();self.assertTrue((private/'apply.claim.json').exists())
            receipt=json.loads(next(evidence.glob('*-apply.json')).read_bytes())
            self.assertIs(receipt['dispatch_attempted'],False)
            self.assertEqual(receipt['result'],'failed')

    def test_successful_batch_immediately_compares_and_readback_never_pushes(self):
        with self.sandbox() as (evidence,_,inputs,final):
            self.dry_receipt(evidence,inputs)
            result=type('CLIResult',(),{'returncode':0,'stdout':'\n'.join(row['migration'] for row in release.MIGRATIONS),'stderr':''})()
            with patch.object(release,'inspect_state',side_effect=[self.before,final]),patch.object(release,'call',return_value=result) as call:
                release.main(['apply']);self.assertEqual(call.call_count,1)
                self.assertEqual(call.call_args.args[0],release.push_command(False))
            with patch.object(release,'inspect_state',return_value=final),patch.object(release,'call') as call:
                release.main(['readback']);call.assert_not_called()
            rows=[json.loads(path.read_bytes()) for path in evidence.glob('*-readback.json')]
            self.assertEqual(len(rows),1);self.assertEqual(rows[0]['result'],'passed')
            self.assertIs(rows[0]['application_verified_by_readback'],True)
            self.assertEqual(rows[0]['runtime_execute_operations'],11)

    def test_stale_or_changed_dry_run_prevents_dispatch(self):
        for age,changed in [(901,False),(0,True)]:
            with self.subTest(age=age,changed=changed),self.sandbox() as (evidence,private,inputs,_):
                before=copy.deepcopy(self.before)
                if changed:before['data_sha256']['eps.jobs']='a'*64
                self.dry_receipt(evidence,inputs,before=before,age=age)
                with patch.object(release,'inspect_state',return_value=self.before),patch.object(release,'call') as call:
                    with self.assertRaises(ValueError):release.main(['apply'])
                    call.assert_not_called();self.assertFalse((private/'apply.claim.json').exists())

    def test_missing_sealed_prerequisite_stops_before_cloud_inspection(self):
        with self.sandbox(),patch.object(release,'current_release_inputs',side_effect=ValueError),patch.object(release,'inspect_state') as inspect,patch.object(release,'call') as call:
            with self.assertRaises(ValueError):release.main(['dry-run'])
            inspect.assert_not_called();call.assert_not_called()


if __name__=='__main__':unittest.main()
