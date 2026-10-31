"""Synthetic parser/privacy boundaries only; no database or provider calls."""
from pathlib import Path
import copy,importlib.util,json,unittest

spec=importlib.util.spec_from_file_location('english_component_lookup',Path(__file__).with_name('lookup.py'))
lookup=importlib.util.module_from_spec(spec);spec.loader.exec_module(lookup)

def fixture():
 source={key:'00000000-0000-4000-8000-000000000001'for key in('source_asset_id','candidate_media_id','transcript_asset_id','source_job_id')}
 source.update(source_sha256=lookup.SOURCE_SHA,input_hash='a'*64,original_text='Synthetic original text.')
 return [{'english_component_source':{'database':'postgres','operator':'postgres','history_count':33,'match_count':1,'source':source}}]

class LookupTests(unittest.TestCase):
 def test_reviewed_diagnostic_summary_has_counts_stages_and_no_source_payload(self):
  spec=importlib.util.spec_from_file_location('reviewed_lookup',Path(__file__).with_name('lookup-reviewed.py'));reviewed=importlib.util.module_from_spec(spec);spec.loader.exec_module(reviewed)
  rows=fixture();rows[0]['english_component_source']['source']['original_text']='SYNTHETIC_PRIVATE'
  summary=reviewed.safe_summary(rows)
  self.assertEqual(summary['match_count'],1);self.assertEqual(summary['history_count'],33)
  self.assertNotIn('SYNTHETIC_PRIVATE',json.dumps(summary))
  self.assertEqual(lookup.sha(reviewed.SQL.read_bytes()),reviewed.SQL_SHA)
  self.assertEqual(lookup.sha(reviewed.PROOF.read_bytes()),reviewed.PROOF_SHA)

 def test_raw_and_wrapped_rows_bind_exact_original_without_changing_it(self):
  for wrapped in(False,True):
   rows=fixture();source=lookup.parse_source({'rows':rows}if wrapped else rows)
   self.assertEqual(source['original_text'],'Synthetic original text.')
   self.assertEqual(source['original_sha256'],lookup.sha(b'Synthetic original text.'))

 def test_ambiguous_missing_wrong_target_and_unknown_fields_are_rejected(self):
  for mutation in('ambiguous','missing','target','private','history','uuid','hash'):
   rows=copy.deepcopy(fixture());value=rows[0]['english_component_source']
   if mutation=='ambiguous':value['match_count']=2
   elif mutation=='missing':value['source']=None
   elif mutation=='target':value['source']['source_sha256']='b'*64
   elif mutation=='private':value['source']['private']='SYNTHETIC_PRIVATE'
   elif mutation=='history':value['history_count']=32
   elif mutation=='uuid':value['source']['source_asset_id']='SYNTHETIC_PRIVATE'
   else:value['source']['input_hash']='bad'
   with self.assertRaisesRegex(ValueError,'^ENGLISH_COMPONENT_SOURCE_UNCONFIRMED$'):lookup.parse_source(rows)

 def test_query_is_pinned_read_only_and_selects_one_exact_source_hash(self):
  raw=lookup.SQL.read_bytes();self.assertEqual(lookup.sha(raw),lookup.SQL_SHA)
  self.assertTrue(raw.startswith(b'begin read only;'));self.assertTrue(raw.rstrip().endswith(b'rollback;'))
  self.assertEqual(raw.count(lookup.SOURCE_SHA.encode()),1)
  for word in(b'commit;',b'update ',b'insert ',b'delete ',b'create ',b'grant '):self.assertNotIn(word,raw.lower())

if __name__=='__main__':unittest.main()
