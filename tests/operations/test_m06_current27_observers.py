"""Current27 adapters preserve26 sources and all existing privacy checks."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest import mock
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'));sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_m06_private_snapshot_export import ready
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
c=module('m06_current27_test','tools/capture-m06-app27.py');p=module('m06_private27_test','tools/export-m06-private-snapshot27.py')

class Current27ObserverTests(unittest.TestCase):
    def fixture(self):
        original=Path.read_bytes;manifest=ROOT/'development/local-db/reviewed.json'
        def historical(path):return original(ROOT/'development/m06/baseline26-reviewed.json')if path==manifest else original(path)
        # This new adapter test explicitly uses immutable26 fixture history;
        # the production27 inputs still require the actual27 reviewed manifest.
        with mock.patch.object(Path,'read_bytes',historical):receipt,versions,seals,baseline,version,snapshot,response=ready()
        versions=[*versions,'20261030020000'];receipt['state']['migration_versions']=versions
        return receipt,versions,seals,baseline,version,snapshot,response
    def test_27_history_adapts_only_old_parser_admission(self):
        receipt,versions,_,baseline,_,_,_=self.fixture();original=copy.deepcopy(receipt['state'])
        self.assertEqual(c.validate(receipt['state'],versions,baseline),receipt['checks']);self.assertEqual(original,receipt['state'])
    def test_26_missing_or_extra_history_denied(self):
        receipt,versions,_,baseline,_,_,_=self.fixture()
        for changed in(versions[:-1],[*versions,'20261030020001'],[*versions[:-2],'20261030004644',versions[-1]]):
            state=copy.deepcopy(receipt['state']);state['migration_versions']=changed
            with self.assertRaises(ValueError):c.validate(state,changed,baseline)
    def test_existing_private_data_rejection_is_preserved(self):
        receipt,versions,_,baseline,_,_,_=self.fixture();receipt['state']['sessions'][0]['session_token_digest']='a'*64
        with self.assertRaises(ValueError):c.validate(receipt['state'],versions,baseline)
    def test_ready_private_snapshot27_stays_hash_and_scope_bound(self):
        receipt,versions,seals,baseline,version,snapshot,response=self.fixture()
        selected=p.validate_receipt(receipt,versions,seals,baseline,version['id']);self.assertEqual(p.legacy.validate_response(response,selected),p.legacy.canonical(snapshot))
        receipt['state']['versions'][-1]['series_id']=receipt['state']['series'][0]['id']
        with self.assertRaises(ValueError):p.validate_receipt(receipt,versions,seals,baseline,version['id'])
    def test_new_export_accepts_only_new_capture_directory(self):
        with mock.patch.object(p.legacy,'cli_call',side_effect=AssertionError('Offline only'))as cli:
            with self.assertRaises(ValueError):p.export('tracking/evidence/m06/app-capture/old26.json','00000000-0000-4000-8000-000000000002')
            cli.assert_not_called()

if __name__=='__main__':unittest.main()
