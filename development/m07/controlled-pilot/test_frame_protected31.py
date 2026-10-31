"""Pure synthetic protected-M02 continuation tests; no live operations."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest import mock
from types import SimpleNamespace

HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('frame_protected31',HERE/'future-frame-protected31.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NEW='sha256:'+'a'*64 # Synthetic test target only, never an operator plan.

def state(pin=None):
    metadata={key:{'count':2,'sha256':'b'*64}for key in m.FINGERPRINTS}
    metadata['protected_job_projection']={'count':1,'sha256':m.PROTECTED_JOB_SHA256}
    metadata['protected_m02']=copy.deepcopy(m.PROTECTED_METADATA)
    return {'context':{'database':'postgres','operator':'postgres','history':list(m.forward.common.VERSIONS),
      'configuration_count':1,'unexpected_config_triggers':0,'total_active_jobs':1,'other_active_jobs':0,'protected_waiting_jobs':1,
      'leased_outbox':0,'ack_body_sha256':m.forward.common.guard.ACK_BODY,'hook_body_sha256':m.forward.common.guard.HOOK_BODY},
      'frame_config':{'id':True,'enabled':True,'native_image_id':pin or m.OLD_PIN,'implementation_version':'frame-extraction.v1'},'protected_metadata':metadata}

class IO:
    def __init__(self,late=False,changed=False,unknown=False):self.reads=0;self.dispatches=0;self.late=late;self.changed=changed;self.unknown=unknown
    def readback(self):
        self.reads+=1;value=state(NEW if self.dispatches else None)
        if self.late and self.reads==2:value['context']['other_active_jobs']=1;value['context']['total_active_jobs']=2
        if self.changed and self.dispatches:value['protected_metadata']['jobs']['sha256']='c'*64
        return value
    def verify_sources(self):pass
    def claim(self,value):self.claimed=copy.deepcopy(value)
    def dispatch(self,on_return):
        self.dispatches+=1
        if self.unknown:raise m.CommandProcessUnconfirmed()
        on_return();return {'expected_project':m.origin.TARGET,'old_native_image_id':m.OLD_PIN,'new_native_image_id':NEW,
          'other_config_columns_preserved':True,'protected_metadata_preserved':True,'protected_metadata':state()['protected_metadata']}

class ProtectedFrameTests(unittest.TestCase):
    def test_new_private_folder_is_only_verified_without_acl_or_directory_mutation(self):
        class Directory:
            def resolve(self):return self
            def is_dir(self):return True
            def is_symlink(self):return False
            def __str__(self):return 'D:/synthetic-owner-prepared'
        directory=Directory()
        observation={'current_sid':'S-1-5-21-1000','owner_sid':'S-1-5-21-1000','protected':True,
          'rules':[{'sid':sid,'rights':0x1f01ff,'inheritance_flags':3,'propagation_flags':0,'inherited':False,'type':0}for sid in('S-1-5-21-1000','S-1-5-18')]}
        with mock.patch.object(m,'PRIVATE',directory),mock.patch.object(m.os,'name','nt'),\
             mock.patch.object(m.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps(observation),stderr=''))as run:
            m.verify_private();script=run.call_args.args[0][-1]
            self.assertIn('Get-Acl',script);self.assertNotIn('Set-Acl',script);self.assertNotIn('DirectorySecurity',script);self.assertNotIn('-Audit',script)

    def test_only_exact_historical_waiting_projection_and_spec_are_admitted(self):
        m.validate_state(state(),NEW,require_old=True)
        changes=[lambda x:x['context'].update(other_active_jobs=1,total_active_jobs=2),lambda x:x['context'].update(protected_waiting_jobs=0),
          lambda x:x['context'].update(total_active_jobs=0),lambda x:x['context'].update(leased_outbox=1),
          lambda x:x['protected_metadata']['protected_m02'].update(status='running'),lambda x:x['protected_metadata']['protected_m02'].update(row_version=8),
          lambda x:x['protected_metadata']['protected_m02'].update(spec_sha256='a'*64),lambda x:x['protected_metadata']['protected_job_projection'].update(sha256='b'*64)]
        for mutate in changes:
            value=state();mutate(value)
            with self.assertRaises(ValueError):m.validate_state(value,NEW,require_old=True)

    def test_single_frame_update_preserves_whole_job_settings_ready_and_protected_fingerprints(self):
        io=IO();result=m.apply_once(io,NEW)
        self.assertEqual(result['result'],'passed');self.assertEqual(io.dispatches,1);self.assertEqual(io.reads,4)
        self.assertEqual(result['before']['protected_metadata'],result['after']['protected_metadata'])
        for options in({'changed':True},{'unknown':True}):
            io=IO(**options);result=m.apply_once(io,NEW)
            self.assertEqual(result['result'],'unconfirmed');self.assertEqual(io.dispatches,1)

    def test_other_late_waiting_job_prevents_dispatch(self):
        io=IO(late=True)
        with self.assertRaises(ValueError):m.apply_once(io,NEW)
        self.assertEqual(io.dispatches,0)

    def test_new_claim_and_sql_paths_do_not_reuse_old_frame31_artifacts(self):
        self.assertNotEqual(m.PRIVATE,m.ROOT/'.local/m07-pilot/future-frame-forward31')
        self.assertTrue(str(m.query_command('update')[m.query_command('update').index('--file')+1]).endswith('update.sql'))
        self.assertIn('FUTURE_FRAME_PROTECTED31_READBACK.sql',str(m.query_command('readback')))

    def test_actual_baseline_receipt_is_source_pinned_and_read_only(self):
        value=json.loads((m.ROOT/m.BASELINE_RECEIPT).read_bytes());m.validate_baseline(value)
        for change in({'read_only':False},{'query_sha256':'a'*64}):
            with self.assertRaises(ValueError):m.validate_baseline({**value,**change})
        changed=copy.deepcopy(value);changed['value']['job_projection_sha256']='a'*64
        with self.assertRaises(ValueError):m.validate_baseline(changed)

    def test_sql_exemption_is_digest_spec_bound_and_all_other_work_remains_forbidden(self):
        sql=(HERE/'FUTURE_FRAME_PROTECTED31.sql').read_text()
        self.assertIn(m.PROTECTED_JOB_SHA256,sql);self.assertIn(m.PROTECTED_METADATA['spec_sha256'],sql)
        self.assertEqual(sql.lower().count('update eps.frame_extraction_config set native_image_id=expected'),1)
        self.assertNotIn('update eps.jobs',sql.lower());self.assertNotIn('grant ',sql.lower())
        read=(HERE/'FUTURE_FRAME_PROTECTED31_READBACK.sql').read_text()
        for field in('total_active_jobs','other_active_jobs','protected_waiting_jobs','protected_job_projection'):self.assertIn("'"+field+"'",read)

if __name__=='__main__':unittest.main()
