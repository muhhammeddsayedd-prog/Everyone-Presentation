"""Pure synthetic manifest/state fixtures; no CLI, database or private files."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('future_frame_pin', Path(__file__).with_name('future-frame-pin.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
NEW = 'sha256:' + 'a' * 64  # Synthetic digest, never an operator target.


def manifest():
    return json.dumps({'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1',
                       'image':'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+NEW,
                       'region':'dub1','source_sha256':module.SOURCE}).encode()


def state(pin=None):
    metadata = {key:{'count':2,'sha256':'b'*64} for key in module.FINGERPRINTS}
    metadata['protected_m02'] = {'id':module.origin.PROTECTED_JOB,'status':'failed','stage':'extract_specs','attempt':1,'row_version':3,
                               'resource_id':'a0000000-0000-4000-8000-000000000001','manual_note_retained':True,'spec_sha256':'c'*64}
    return {'context':{'database':'postgres','operator':'postgres','history':list(module.origin.VERSIONS),
                       'configuration_count':1,'unexpected_config_triggers':0,'active_native_jobs':0,'leased_native_dispatches':0},
            'frame_config':{'id':True,'enabled':True,'native_image_id':pin or module.OLD_PIN,'implementation_version':'frame-extraction.v1'},
            'protected_metadata':metadata}


class FakeIO:
    def __init__(self, unknown=False, applied=True, collision=False, changed=False, late_job=False):
        self.unknown,self.applied,self.collision,self.changed,self.late_job=unknown,applied,collision,changed,late_job
        self.dispatches,self.reads,self.claims=0,0,[]

    def readback(self):
        self.reads+=1
        value=state(NEW if self.dispatches and self.applied else module.OLD_PIN)
        if self.changed and self.dispatches:value['protected_metadata']['native_jobs']['sha256']='d'*64
        if self.late_job and self.reads==2:value['context']['active_native_jobs']=1
        return value

    def verify_sources(self): pass

    def claim(self,value):
        if self.collision:raise ValueError('SYNTHETIC_CLAIM_EXISTS')
        self.claims.append(copy.deepcopy(value))

    def dispatch(self):
        self.dispatches+=1
        if self.unknown:raise TimeoutError('SYNTHETIC_PRIVATE_ERROR')
        return {'expected_project':module.origin.TARGET,'old_native_image_id':module.OLD_PIN,'new_native_image_id':NEW,
                'other_config_columns_preserved':True,'protected_metadata_preserved':True,'protected_metadata':state()['protected_metadata']}


class FramePinTests(unittest.TestCase):
    def test_manifest_closed_actual_project_source_and_digest_only(self):
        result=module.manifest_pin(manifest());self.assertEqual(result['native_image_id'],NEW)
        for change in [{'source_sha256':'e'*64},{'image':'other/project/native@'+NEW},{'region':'iad1'},
                       {'extra':True},{'image':'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+module.OLD_PIN}]:
            value=json.loads(manifest());value.update(change)
            with self.assertRaises(ValueError):module.manifest_pin(json.dumps(value).encode())
        with self.assertRaises(ValueError):module.manifest_pin(None)

    def test_state_requires_exact30_quiescent_enabled_old_pin_and_frozen_job_input_fingerprints(self):
        module.validate_state(state(),NEW,require_old=True)
        for field,value in [('active_native_jobs',1),('leased_native_dispatches',1),('configuration_count',2),('operator','other')]:
            invalid=state();invalid['context'][field]=value
            with self.assertRaises(ValueError):module.validate_state(invalid,NEW,require_old=True)
        invalid=state();invalid['context']['history'][0]='20261028000000'
        with self.assertRaises(ValueError):module.validate_state(invalid,NEW,require_old=True)
        invalid=state();invalid['frame_config']['enabled']=False
        with self.assertRaises(ValueError):module.validate_state(invalid,NEW,require_old=True)
        invalid=state();invalid['protected_metadata']['native_jobs']['count']=True
        with self.assertRaises(ValueError):module.validate_state(invalid,NEW,require_old=True)

    def test_apply_one_dispatch_four_reads_only_pin_changes_and_claim_is_retained(self):
        io=FakeIO();result=module.apply_once(io,NEW)
        self.assertEqual(result['result'],'passed');self.assertEqual(io.dispatches,1);self.assertEqual(io.reads,4)
        self.assertEqual(len(io.claims),1);self.assertFalse(result['old_job_inputs_rewritten']);self.assertFalse(result['automatic_dispatch_retry'])

    def test_unknown_commit_uses_readback_only_and_unapplied_or_changed_jobs_do_not_pass(self):
        io=FakeIO(unknown=True);result=module.apply_once(io,NEW)
        self.assertEqual(result['result'],'passed');self.assertEqual(io.dispatches,1);self.assertEqual(result['dispatch_outcome'],'unconfirmed')
        self.assertNotIn('SYNTHETIC_PRIVATE',str(result))
        for options in [{'unknown':True,'applied':False},{'changed':True}]:
            io=FakeIO(**options);self.assertEqual(module.apply_once(io,NEW)['result'],'unconfirmed');self.assertEqual(io.dispatches,1)

    def test_claim_collision_late_job_or_already_rotated_pin_prevents_dispatch(self):
        for options in [{'collision':True},{'late_job':True}]:
            io=FakeIO(**options)
            with self.assertRaises(ValueError):module.apply_once(io,NEW)
            self.assertEqual(io.dispatches,0)
        io=FakeIO();io.readback=lambda:state(NEW)
        with self.assertRaises(ValueError):module.apply_once(io,NEW)
        self.assertEqual(io.dispatches,0)

    def test_standalone_readback_without_claim_baseline_does_not_credit_application(self):
        current=state(NEW)
        result=module.readback_result(None,current,copy.deepcopy(current),NEW)
        self.assertEqual(result['result'],'unconfirmed');self.assertTrue(result['new_pin_observed']);self.assertFalse(result['application_verified_by_readback'])
        self.assertEqual(module.readback_result(state(),current,copy.deepcopy(current),NEW)['result'],'passed')

    def test_rendered_update_accepts_no_arbitrary_digest_or_query_mode(self):
        rendered=module.render_update("expected:='__HOSTED_NATIVE_IMAGE_ID__';",NEW)
        self.assertEqual(rendered,"expected:='"+NEW+"';")
        with self.assertRaises(ValueError):module.render_update('__HOSTED_NATIVE_IMAGE_ID__ __HOSTED_NATIVE_IMAGE_ID__',NEW)
        with self.assertRaises(ValueError):module.render_update('__HOSTED_NATIVE_IMAGE_ID__',"sha256:';drop")
        args=module.query_command('readback');self.assertIn('--linked',args);self.assertNotIn('--db-url',args)
        with self.assertRaises(ValueError):module.query_command('arbitrary')

    def test_sql_fingerprints_project_frozen_inputs_and_public_outbox_state_without_credentials(self):
        for name in ['FUTURE_FRAME_PIN.sql','FUTURE_FRAME_PIN_READBACK.sql']:
            text=Path(__file__).with_name(name).read_text(encoding='utf8')
            self.assertNotIn('to_jsonb(j)',text)
            self.assertNotIn('to_jsonb(o)',text)
            self.assertIn("'input',j.input",text)
            self.assertIn("'input_hash',o.input_hash",text)
            self.assertNotIn('lease_token_digest',text)


if __name__=='__main__':unittest.main()
