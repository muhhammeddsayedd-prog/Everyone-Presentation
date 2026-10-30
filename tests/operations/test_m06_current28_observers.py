"""Current28 metadata/privacy adapters, offline only; historical helpers unchanged."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest import mock
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tools'));sys.path.insert(0,str(Path(__file__).resolve().parent))
from test_m06_private_snapshot_export import ready
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
c=module('m06_current28_test','tools/capture-m06-app28.py');p=module('m06_private28_test','tools/export-m06-private-snapshot28.py')
def fixture():
    receipt,versions,seals,baseline,version,snapshot,response=ready()
    versions=[*versions,'20261030013832','20261030030717'];receipt['state']['migration_versions']=versions
    video=next(pin['asset_id']for pin in version['pins']if pin['asset_kind']=='candidate_video')
    receipt['state']['video_transcripts']=[{'version_id':version['id'],'asset_id':video,'candidate_media_id':'00000000-0000-4000-8000-000000000099',
      'source_media_row_version':2,'status':'available','text_present':True,'text_codepoints':12,'source_sha256':'a'*64,'languages_sha256':'b'*64,'language_count':2,
      'captured_at':'2026-10-30T03:00:00Z','source_hash_matches':True,'source_contract_valid':True,'fixed_video_pin':True}]
    receipt['checks']=c.validate(receipt['state'],versions,baseline)
    return receipt,versions,seals,baseline,version,snapshot,response
class Current28ObserverTests(unittest.TestCase):
    def test_current_inputs_are_read_only_and_all34_release_seals_admitted(self):
        with mock.patch.object(c.release,'call',side_effect=AssertionError('No cloud')):
            versions,seals,_=c.inputs()
        self.assertEqual(len(versions),28);self.assertIn(c.SQL,seals)
    def test_safe_companion_metadata_and_unchanged_legacy_parser(self):
        r,v,_,b,*_=fixture();before=copy.deepcopy(r['state']);self.assertTrue(all(c.validate(r['state'],v,b).values()));self.assertEqual(before,r['state'])
    def test_actual_history27_or_extra_history_is_denied(self):
        r,v,_,b,*_=fixture()
        for changed in(v[:-1],[*v,'20261030040000']):
            state=copy.deepcopy(r['state']);state['migration_versions']=changed
            with self.assertRaises(ValueError):c.validate(state,changed,b)
    def test_raw_text_languages_private_extra_or_digest_fields_denied(self):
        for key,value in(('original_text','PRIVATE'),('languages',['Arabic']),('session_token_digest','a'*64)):
            r,v,_,b,*_=fixture();r['state']['video_transcripts'][0][key]=value
            with self.assertRaises(ValueError):c.validate(r['state'],v,b)
    def test_scope_hash_duplicate_and_missing_video_pin_denied(self):
        for change in({'version_id':'00000000-0000-4000-8000-000000009999'},{'source_hash_matches':False},{'fixed_video_pin':False},{'source_contract_valid':False},{'status':'not_captured'}):
            r,v,_,b,*_=fixture();r['state']['video_transcripts'][0].update(change)
            with self.assertRaises(ValueError):c.validate(r['state'],v,b)
        r,v,_,b,*_=fixture();r['state']['video_transcripts']*=2
        with self.assertRaises(ValueError):c.validate(r['state'],v,b)
    def test_captured_absence_is_distinct_from_old_no_row(self):
        r,v,_,b,*_=fixture();r['state']['video_transcripts'][0].update(status='not_provided',text_present=False,text_codepoints=0,source_sha256=None,language_count=0)
        self.assertTrue(c.validate(r['state'],v,b)['frozen_source_companion_metadata_valid'])
        r['state']['video_transcripts']=[];self.assertTrue(c.validate(r['state'],v,b)['frozen_source_companion_metadata_valid'])
    def test_private_snapshot_receipt_stays_current_hash_and_scope_bound(self):
        r,v,s,b,version,snapshot,response=fixture();selected=p.validate_receipt(r,v,s,b,version['id'])
        self.assertEqual(p.legacy.validate_response(response,selected),p.legacy.canonical(snapshot))
        r['state']['video_transcripts'][0]['original_text']='PRIVATE'
        with self.assertRaises(ValueError):p.validate_receipt(r,v,s,b,version['id'])
    def test_old_private_receipt_directory_denied_without_cli(self):
        with mock.patch.object(p.legacy,'cli_call',side_effect=AssertionError('No cloud'))as cli:
            with self.assertRaises(ValueError):p.export('tracking/evidence/m06/app-capture27/old.json','00000000-0000-4000-8000-000000000002')
            cli.assert_not_called()
if __name__=='__main__':unittest.main()
