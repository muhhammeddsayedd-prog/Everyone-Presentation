"""Synthetic process/ACL seams only; no real CLI or private filesystem IO."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
from types import SimpleNamespace
import unittest
from unittest import mock

spec=importlib.util.spec_from_file_location('canonical_continuation',Path(__file__).with_name('canonical-continuation.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class ControllerTests(unittest.TestCase):
    def test_tls_preload_environment_is_refused_before_private_or_cli_actions(self):
        for key in('node_tls_reject_unauthorized','npm_config_node_options','ssl_cert_file'):
            with mock.patch.dict(os.environ,{key:'SYNTHETIC_PRIVATE_OVERRIDE'},clear=True),\
                 mock.patch.object(m.m,'read')as read,mock.patch.object(m.subprocess,'run')as run:
                with self.assertRaises(ValueError)as error:m.load_inputs()
                self.assertNotIn('SYNTHETIC_PRIVATE_OVERRIDE',str(error.exception))
                read.assert_not_called();run.assert_not_called()

    def test_actual_nonzero_command_shape_has_closed_http_diagnostic_and_no_internal_retry(self):
        io=m.IO({}, {}, 'a'*64);io.stable=lambda:None
        result=SimpleNamespace(returncode=1,stdout='',stderr='unexpected status 413: RequestEntityTooLarge SYNTHETIC_PRIVATE')
        with mock.patch.object(m.subprocess,'run',return_value=result)as run:
            with self.assertRaises(ValueError):io.command(['synthetic'],'apply_compact')
            self.assertEqual(run.call_count,1)
        self.assertEqual(io.calls,1);self.assertEqual(io.diagnostics[0]['http_status'],413)
        self.assertFalse(io.diagnostics[0]['response_envelope_valid'])
        self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(io.diagnostics))

    def test_timeout_is_distinct_from_nonzero_and_contains_no_captured_payload(self):
        io=m.IO({}, {}, 'a'*64);io.stable=lambda:None
        with mock.patch.object(m.subprocess,'run',side_effect=subprocess.TimeoutExpired('synthetic',60,output='SYNTHETIC_PRIVATE',stderr='HTTP 504'))as run:
            with self.assertRaises(ValueError):io.command(['synthetic'],'apply_compact')
            self.assertEqual(run.call_count,1)
        self.assertIsNone(io.diagnostics[0]['exit_code']);self.assertTrue(io.diagnostics[0]['timed_out'])
        self.assertEqual(io.diagnostics[0]['http_status'],504)
        self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(io.diagnostics))

    def test_existing_continuation_directory_reuses_exact_acl_without_set_acl(self):
        class Directory:
            def mkdir(self,**_):raise FileExistsError()
            def resolve(self):return self
            def is_dir(self):return True
            def is_symlink(self):return False
            def __str__(self):return 'D:/synthetic-continuation'
        observation={'current_sid':'S-1-5-21-1000','owner_sid':'S-1-5-21-1000','protected':True,
          'rules':[{'sid':sid,'rights':0x1f01ff,'inheritance_flags':3,'propagation_flags':0,'inherited':False,'type':0}
                   for sid in('S-1-5-21-1000','S-1-5-18')]}
        with mock.patch.object(m,'PRIVATE',Directory()),mock.patch.object(m.os,'name','nt'),\
             mock.patch.dict(os.environ,{},clear=True),mock.patch.object(m.subprocess,'run',return_value=SimpleNamespace(returncode=0,stdout=json.dumps(observation),stderr=''))as run:
            m.protect_new()
            self.assertNotIn('Set-Acl',run.call_args.args[0][-1]);self.assertNotIn('-Audit',run.call_args.args[0][-1])

if __name__=='__main__':unittest.main()
