"""Pure synthetic/source-bound checks only. No CLI, provider, or private IO."""
import copy
import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest import mock
from types import SimpleNamespace

HERE=Path(__file__).parent
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,HERE/file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

common=load('native_forward31_common','native-forward31-common.py')
forward=load('worker_forward31','worker-forward31.py')
frame=load('future_frame_forward31','future-frame-forward31.py')

def strong():
    fixture={'page_count':5,'candidate_field_count':40,'frame_draw_count':6,'logo_draw_count':5,'expected_image_draws':11,'video_link_count':4,'unique_image_count':7}
    checks=[]
    for task in('presentation_render','presentation_validate','presentation_export_render','presentation_export_validate'):
        render=task.endswith('render')
        checks.append({'task':task,'page_count':5,'rendered_candidate_fields':40 if render else None,'rendered_frame_draws':6 if render else None,
          'rendered_logo_draws':5 if render else None,'validated_image_draws':None if render else 11,'video_links':4,'pdf_bytes':100})
    return {'presentation_fixture':fixture,'presentation_checks':checks}

NEW='sha256:'+'a'*64 # Explicitly synthetic, never an operator plan identity.
def frame_state(pin=None):
    metadata={key:{'count':2,'sha256':'b'*64}for key in frame.FINGERPRINTS}
    metadata['protected_m02']={'id':frame.origin.PROTECTED_JOB,'status':'failed','stage':'extract_specs','attempt':1,'row_version':3,
      'resource_id':'a0000000-0000-4000-8000-000000000001','manual_note_retained':True,'spec_sha256':'c'*64}
    return {'context':{'database':'postgres','operator':'postgres','history':list(common.VERSIONS),'configuration_count':1,'unexpected_config_triggers':0,
      'active_jobs':0,'leased_outbox':0,'ack_body_sha256':common.guard.ACK_BODY,'hook_body_sha256':common.guard.HOOK_BODY},
      'frame_config':{'id':True,'enabled':True,'native_image_id':pin or frame.OLD_PIN,'implementation_version':'frame-extraction.v1'},'protected_metadata':metadata}

class FrameIO:
    def __init__(self,late=False,changed=False,timeout=False):self.dispatches=0;self.reads=0;self.late=late;self.changed=changed;self.timeout=timeout
    def readback(self):
        self.reads+=1;value=frame_state(NEW if self.dispatches else None)
        if self.late and self.reads==2:value['context']['active_jobs']=1
        if self.changed and self.dispatches:value['protected_metadata']['settings']['sha256']='d'*64
        return value
    def verify_sources(self):pass
    def claim(self,value):self.claimed=copy.deepcopy(value)
    def dispatch(self,on_return):
        self.dispatches+=1
        if self.timeout:raise frame.CommandProcessUnconfirmed()
        on_return();return {'expected_project':frame.origin.TARGET,'old_native_image_id':frame.OLD_PIN,'new_native_image_id':NEW,
          'other_config_columns_preserved':True,'protected_metadata_preserved':True,'protected_metadata':frame_state()['protected_metadata']}

class Forward31Tests(unittest.TestCase):
    def test_private_directory_checks_existing_exact_acl_without_creating_or_rewriting_it(self):
        class Directory:
            def resolve(self):return self
            def is_dir(self):return True
            def is_symlink(self):return False
            def __str__(self):return 'D:/synthetic-owner-prepared'
        directory=Directory()
        observation={'current_sid':'S-1-5-21-1000','owner_sid':'S-1-5-21-1000','protected':True,
          'rules':[{'sid':sid,'rights':0x1f01ff,'inheritance_flags':3,'propagation_flags':0,'inherited':False,'type':0}
                   for sid in('S-1-5-21-1000','S-1-5-18')]}
        with mock.patch.object(common.os,'name','nt'),mock.patch.object(common,'PRIVATE_DIRECTORIES',(directory,)),mock.patch.dict(os.environ,{},clear=True),\
             mock.patch.object(common.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps(observation),stderr=''))as run:
            common.verify_private_directory(directory)
            script=run.call_args.args[0][-1]
            self.assertIn('Get-Acl',script);self.assertNotIn('Set-Acl',script);self.assertNotIn('DirectorySecurity',script);self.assertNotIn('-Audit',script)
        directory.is_dir=lambda:False
        with mock.patch.object(common,'PRIVATE_DIRECTORIES',(directory,)),mock.patch.object(common.subprocess,'run')as run:
            with self.assertRaises(ValueError):common.verify_private_directory(directory)
            run.assert_not_called()

    def test_actual_native_ready_requires_private_worker_repository_and_exact_ready_amd64_child(self):
        receipt=json.loads((common.ROOT/'tracking/evidence/m07/controlled-pilot/2026-10-31T02-07-50.664Z-03b11db9-runtime-state.json').read_bytes())
        identity={'native_image_id':'sha256:77eee0ee51159c6420fffefcdce39406a47350ddae682f4ec86891fe7ec08ed8'}
        common.validate_native_ready(receipt,identity)
        for mutate in(lambda x:x['repository'].update(public=True),lambda x:x.update(provider_mutations=True),
                      lambda x:next(r for r in x['images']['images']if r['manifest_digest']==identity['native_image_id']).update(status='pending')):
            value=copy.deepcopy(receipt);mutate(value)
            with self.assertRaises(ValueError):common.validate_native_ready(value,identity)

    def test_proof_references_admit_only_public_native_or_daemon_receipts(self):
        for path in('tracking/evidence/m07/worker-hosting/synthetic-native.json','tracking/evidence/m07/controlled-pilot/synthetic-import.json'):
            common.native_proof_reference({'receipt':path,'sha256':'a'*64})
        for path in('../private.json','tracking/evidence/m07/worker-hosting/../secret.json','D:/private.json','tracking/evidence/m07/other/synthetic.json'):
            with self.assertRaises(ValueError):common.native_proof_reference({'receipt':path,'sha256':'a'*64})

    def test_actual_canonical31_receipts_match_only_the_source_bound_completed_migration(self):
        pins=common.static_sources();self.assertIn(common.CANONICAL_REFERENCES['readback']['receipt'],pins)
        self.assertIn(common.CANONICAL_REFERENCES['apply']['receipt'],pins)
        receipt=json.loads((common.ROOT/common.CANONICAL_REFERENCES['readback']['receipt']).read_bytes())
        common.guard.validate_release(receipt,{'canonical_source_pins':common.canonical_source_pins()})
        for change in ({'phase':'readback'},{'result':'unconfirmed'},{'normal_return_marker_observed':False}):
            with self.assertRaises(ValueError):common.guard.validate_release({**receipt,**change},{'canonical_source_pins':common.canonical_source_pins()})

    def test_unsealed_image_plan_refuses_before_context_or_cli(self):
        with mock.patch.object(forward,'PLAN_SHA256',''),mock.patch.object(forward.subprocess,'run')as run, mock.patch.object(forward.origin,'public_bytes')as read:
            with self.assertRaises(ValueError):forward.public_release()
            run.assert_not_called();read.assert_not_called()
        with mock.patch.object(frame,'FORWARD_SHA256',''),mock.patch.object(frame.forward,'public_release')as release,mock.patch.object(frame.origin,'public_bytes')as read:
            with self.assertRaises(ValueError):frame.source_pins()
            release.assert_not_called();read.assert_not_called()

    def test_expired_readonly_deadline_refuses_before_any_cli(self):
        with mock.patch.dict(common.os.environ,{},clear=True),mock.patch.object(common.subprocess,'run')as run:
            with self.assertRaises(ValueError):common.query_readonly('snapshot',common.time.monotonic()-1)
            run.assert_not_called()

    def test_sealed_plan_shape_admits_only_new_actual_identity_and_closed_proof_references(self):
        references={'native_ready':{'receipt':'tracking/evidence/m07/controlled-pilot/synthetic-ready.json','sha256':'c'*64},
          'native_smoke':{'receipt':'tracking/evidence/m07/worker-hosting/synthetic-native.json','sha256':'a'*64},
          'daemon_import':{'receipt':'tracking/evidence/m07/controlled-pilot/synthetic-import.json','sha256':'b'*64}}
        plan={'schema_version':'1.0','status':'actual_staged_and_baked_canonical31','canonical_release':common.CANONICAL_REFERENCES,
          'current':{'source_sha256':forward.OLD_SOURCE,'native_image_id':forward.OLD_IMAGE,'manifest_sha256':forward.OLD_MANIFEST},'admission':references,
          'next':{'context':'.local/worker-hosting/00000000-0000-4000-8000-000000000000/context','source_sha256':'a'*64,'manifest_sha256':'b'*64,
            'native_image_id':NEW,'owner_sha256':'c'*64,'source_seal_sha256':'d'*64,'overlay_sha256':'e'*64,'file_count':156}}
        with mock.patch.object(forward,'PROOF_REFERENCES',references):
            forward.validate_plan(plan)
            for change in({'file_count':True},{'context':'../private'},{'native_image_id':forward.OLD_IMAGE}):
                value=copy.deepcopy(plan);value['next'].update(change)
                with self.assertRaises(ValueError):forward.validate_plan(value)

    def test_current_identity_is_the_last_actual_5e_adoption_not_the_old7846_claim(self):
        self.assertEqual(forward.OLD_IMAGE,'sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06')
        self.assertEqual(forward.OLD_MANIFEST,'ea963472650fa839076ab0c68c951f839f4820e4e04f55ae5c9c476e3c457ac0')
        self.assertEqual(frame.OLD_PIN,forward.OLD_IMAGE)
        self.assertNotEqual(forward.PRIVATE,forward.ROOT/'.local/m07-pilot/worker-forward')
        self.assertNotEqual(frame.PRIVATE,frame.ROOT/'.local/m07-pilot/future-frame-forward')

    def test_strong_smoke_counts_are_proof_fields_not_declared_fixture_only(self):
        common.validate_strong_presentation(strong())
        for mutate in (lambda x:x['presentation_checks'][1].update(validated_image_draws=0),
                       lambda x:x['presentation_checks'][2].update(rendered_frame_draws=0),
                       lambda x:x['presentation_checks'].pop(),lambda x:x['presentation_fixture'].update(expected_image_draws=0)):
            value=strong();mutate(value)
            with self.assertRaises(ValueError):common.validate_strong_presentation(value)

    def test_actual_ready_daemon_receipt_shape_requires_bound_source_manifest_and_uncached_uid1000_import(self):
        receipt=json.loads((common.ROOT/'tracking/evidence/m07/controlled-pilot/2026-10-31-file-limits-daemon-image.json').read_bytes())
        next_identity={'context':'.local/worker-hosting/'+receipt['run']+'/context','source_sha256':receipt['source_sha256'],
          'manifest_sha256':receipt['baked_manifest_sha256'],'native_image_id':receipt['native_runtime_digest']}
        common.validate_daemon_image(receipt,next_identity)
        for mutate in (lambda x:x.update(source_sha256='a'*64),lambda x:x.update(deployed=True),
                       lambda x:x['production_import_gate'].update(user='0:0'),lambda x:x['production_import_gate'].update(cached=True),
                       lambda x:x.update(architecture='arm64'),lambda x:x.update(registry_repository_private=False)):
            value=copy.deepcopy(receipt);mutate(value)
            with self.assertRaises(ValueError):common.validate_daemon_image(value,next_identity)

    def test_frame_source_only_updates_one_column_and_requires31_all_job_quiescence_and_settings_preservation(self):
        sql=(HERE/'FUTURE_FRAME_FORWARD31.sql').read_text()
        self.assertEqual(sql.lower().count('update eps.frame_extraction_config set native_image_id=expected'),1)
        self.assertIn("'20261031010000'",sql)
        self.assertIn(common.guard.ACK_BODY,sql);self.assertIn(common.guard.HOOK_BODY,sql)
        self.assertIn("'settings'",sql);self.assertIn("'jobs'",sql);self.assertIn("'outbox'",sql)
        self.assertNotIn("where kind in('candidate_scan','frame_extract')and status",sql)
        self.assertNotIn('grant ',sql.lower())

    def test_manifest_patch_preserves_all_metadata_and_never_replays_unknown_work(self):
        class IO:
            def __init__(self):self.state={'metadata':[{**r,'id':f'env_{i}','createdAt':1,'updatedAt':2}for i,r in enumerate(forward.EXPECTED)],'manifest_sha256':forward.OLD_MANIFEST};self.writes=0
            def observe(self):return copy.deepcopy(self.state)
            def verify_sources(self):pass
            def claim(self,value):self.claimed=value
            def patch(self,identifier,body,on_return):self.writes+=1;self.state['manifest_sha256']=body['value'];raise forward.CommandProcessUnconfirmed()
        io=IO();result=forward.apply_once(io,'b'*64)
        self.assertEqual(io.writes,1);self.assertEqual(result['result'],'unconfirmed')
        self.assertFalse(result['write_process_returned'])
        self.assertEqual(result['before']['metadata'],result['after']['metadata'])

    def test_environment_values_are_not_preserved_in_metadata(self):
        rows=[{**r,'id':f'env_{i}','createdAt':1,'updatedAt':2,'value':'SYNTHETIC_PRIVATE'}for i,r in enumerate(forward.EXPECTED)]
        result=forward.project_metadata({'envs':rows});self.assertNotIn('SYNTHETIC_PRIVATE',str(result))
        self.assertEqual(result[0]['updatedAt'],2)

    def test_only_selected_manifest_updatedAt_may_advance_all_other_metadata_is_exact(self):
        before=[{**r,'id':f'env_{i}','createdAt':1,'updatedAt':2}for i,r in enumerate(forward.EXPECTED)]
        after=copy.deepcopy(before);next(row for row in after if row['key']==forward.KEY)['updatedAt']=3
        self.assertTrue(forward.preserved_metadata(before,after))
        for key in('id','createdAt','target'):
            changed=copy.deepcopy(after);changed[0][key]='changed'
            self.assertFalse(forward.preserved_metadata(before,changed))
        changed=copy.deepcopy(after);next(row for row in changed if row['key']!=forward.KEY)['updatedAt']=3
        self.assertFalse(forward.preserved_metadata(before,changed))

    def test_frame31_one_dispatch_preserves_all_jobs_settings_and_original_claim_baseline(self):
        io=FrameIO();result=frame.apply_once(io,NEW)
        self.assertEqual(result['result'],'passed');self.assertEqual(io.dispatches,1);self.assertEqual(io.reads,4)
        self.assertTrue(result['protected_before_after_equal']);self.assertFalse(result['old_job_inputs_rewritten'])
        for options in({'changed':True},{'timeout':True}):
            io=FrameIO(**options);result=frame.apply_once(io,NEW)
            self.assertEqual(result['result'],'unconfirmed');self.assertEqual(io.dispatches,1)

    def test_late_job_or_wrong31_security_prevents_frame_dispatch_and_missing_baseline_cannot_pass(self):
        io=FrameIO(late=True)
        with self.assertRaises(ValueError):frame.apply_once(io,NEW)
        self.assertEqual(io.dispatches,0)
        for change in({'history':list(common.canonical.m.origin.VERSIONS)},{'ack_body_sha256':'a'*64},{'leased_outbox':1}):
            value=frame_state();value['context'].update(change)
            with self.assertRaises(ValueError):frame.validate_state(value,NEW,require_old=True)
        current=frame_state(NEW)
        self.assertEqual(frame.readback_result(None,current,current,NEW,process_confirmed=True)['result'],'unconfirmed')

if __name__=='__main__':unittest.main()
