"""Synthetic ACL projections only. No filesystem or PowerShell execution."""
import copy
import importlib.util
from pathlib import Path
import unittest
spec=importlib.util.spec_from_file_location('acl',Path(__file__).with_name('canonical_acl.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


def valid():
    return {'current_sid':'S-1-5-21-1000','owner_sid':'S-1-5-21-1000','protected':True,
      'rules':[{'sid':sid,'rights':0x1f01ff,'inheritance_flags':3,'propagation_flags':0,'inherited':False,'type':0}
        for sid in('S-1-5-21-1000','S-1-5-18')]}


class AclTests(unittest.TestCase):
    def test_exact_owner_system_fullcontrol_and_child_inheritance_are_required(self):
        value=valid();saved=copy.deepcopy(value);m.validate(value);self.assertEqual(value,saved)
        for patch in({'rights':0x120089},{'inheritance_flags':0},{'propagation_flags':8},{'inherited':True},{'type':1},{'sid':'S-1-1-0'},{'extra':True}):
            value=valid();value['rules'][0].update(patch)
            with self.assertRaises(ValueError):m.validate(value)
        for mutate in(lambda v:v.update(protected=False),lambda v:v.update(owner_sid='S-1-5-21-9999'),
                      lambda v:v['rules'].append(v['rules'][0]),lambda v:v['rules'].__setitem__(1,v['rules'][0])):
            value=valid();mutate(value)
            with self.assertRaises(ValueError):m.validate(value)

    def test_existing_directory_program_has_no_acl_write_or_audit_request(self):
        existing=m.program(False);self.assertNotIn('Set-Acl',existing);self.assertNotIn('-Audit',existing)
        self.assertIn('Get-Acl',existing);self.assertIn('owner_sid=',existing)
        self.assertEqual(m.program(True).count('Set-Acl'),1)


if __name__=='__main__':unittest.main()
