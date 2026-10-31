"""Synthetic source-admission seam; no private files or child processes."""
from pathlib import Path
import importlib.util
import hashlib
import json
import os
from types import SimpleNamespace
import unittest
from unittest import mock

spec=importlib.util.spec_from_file_location('canonical_release',Path(__file__).with_name('canonical-release.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class Admission(unittest.TestCase):
    def test_existing_owner_only_directory_is_verified_without_rewriting_acl(self):
        class Directory:
            def mkdir(self,**options):
                if not options.get('exist_ok',False):raise FileExistsError()
            def resolve(self):return self
            def is_symlink(self):return False
            def is_dir(self):return True
            def __str__(self):return 'D:/synthetic-owner-only'
        scripts=[]
        observation={'current_sid':'S-1-5-21-1000','owner_sid':'S-1-5-21-1000','protected':True,
          'rules':[{'sid':sid,'rights':0x1f01ff,'inheritance_flags':3,'propagation_flags':0,'inherited':False,'type':0}
                   for sid in('S-1-5-21-1000','S-1-5-18')]}
        def run(arguments,**_):
            script=arguments[-1];scripts.append(script)
            if 'Set-Acl'in script:return SimpleNamespace(returncode=1,stdout='',stderr='SYNTHETIC_PRIVILEGE_NOT_HELD')
            return SimpleNamespace(returncode=0,stdout=json.dumps(observation),stderr='')
        with mock.patch.object(m,'PRIVATE',Directory()),mock.patch.dict(os.environ,{},clear=True),\
             mock.patch.object(m.os,'name','nt'),mock.patch.object(m.subprocess,'run',side_effect=run):
            m.protect()
        self.assertEqual(len(scripts),1);self.assertNotIn('Set-Acl',scripts[0])

    def test_known_tls_overrides_are_case_insensitively_denied_before_io_without_value_leak(self):
        for variable in('NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'):
            with mock.patch.dict(os.environ,{variable.lower():'SYNTHETIC_TLS_OVERRIDE_PRIVATE'},clear=True),\
                 mock.patch.object(m,'read',return_value=b'unused-public-source')as read,mock.patch.object(m.subprocess,'run')as run:
                with self.assertRaises(ValueError)as error:m.load_inputs()
                self.assertNotIn('SYNTHETIC_TLS_OVERRIDE_PRIVATE',str(error.exception))
                read.assert_not_called();run.assert_not_called()

    def test_missing_actual_local_proof_is_rejected_before_cli_or_private_io(self):
        plan={'schema_version':'1.0','status':'pending_actual_local_proof','target':m.TARGET,'version':m.VERSION,'local_proof':None,
          'source_plan_sha256':'a'*64,'query_sha256':'b'*64,'predecessor_query_sha256':'c'*64}
        raw=json.dumps(plan).encode()
        with mock.patch.dict(os.environ,{},clear=True),mock.patch.object(m,'PLAN_SHA',hashlib.sha256(raw).hexdigest()),\
             mock.patch.object(m,'read',return_value=raw)as read,mock.patch.object(m.subprocess,'run')as run:
            with self.assertRaises(ValueError):m.load_inputs()
            read.assert_called_once_with(m.HERE/'canonical-plan.json');run.assert_not_called()


if __name__=='__main__':unittest.main()
