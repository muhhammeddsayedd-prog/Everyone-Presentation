"""Synthetic-only parser and old-cohort preservation regressions; no SQL."""
from pathlib import Path
import copy,importlib.util,json,re,unittest
spec=importlib.util.spec_from_file_location('preservation',Path(__file__).with_name('observe.py'));observe=importlib.util.module_from_spec(spec);spec.loader.exec_module(observe)
def identifier(index):return 'a3400000-0000-4000-8000-'+str(index).zfill(12)
def row(index,version=None):return {'key':identifier(index),'version_id':version,'sha256':str(index%10)*64}
def sample(after=False):
 before=observe.preflight();ports=copy.deepcopy(before['ports'])
 if after:
  for item in json.loads(observe.PATCHES.read_text())['ports']:ports[item['signature']]['source_sha256']=item['after_sha256']
 version=identifier(1);groups={name:[row(index+1,version if name in('versions','slides','asset_pins','raw_companions','ready_exports')else None)]for index,name in enumerate(observe.GROUPS)}
 groups['versions'][0]['key']=version;groups['reviewed_candidates'][0]['key']=observe.REVIEWED_CANDIDATE;groups['reviewed_media'][0]['key']=observe.REVIEWED_MEDIA
 return {'database':'postgres','operator':'postgres','history':before['history']+([observe.VERSION]if after else[]),
  'legacy_column_rls_hashes':{name:'f'*64 for name in observe.TABLES},'ports':ports,'groups':groups,'reviewed_effective':True,
  'english_versioned_ready_ids':[],'english_companion_version_ids':[]}
def wrapped(value):return [{'preservation_observation':value}]

class PreservationTests(unittest.TestCase):
 def test_baseline_and_committed34_parser_accept_only_expected_history_and_ports(self):
  self.assertEqual(observe.parsed(wrapped(sample()),False)['history'],observe.preflight()['history'])
  self.assertEqual(len(observe.parsed(wrapped(sample(True)),True)['history']),34)
  for change in[lambda v:v.update(database='wrong'),lambda v:v['history'].pop(),lambda v:v['ports'].pop(next(iter(v['ports']))),lambda v:v.update(reviewed_effective=False)]:
   value=sample();change(value)
   with self.assertRaises(ValueError):observe.parsed(wrapped(value),False)
 def test_additional_versions_assets_exports_and_new_companions_are_allowed(self):
  before=sample();after=sample(True);new=identifier(90)
  for name in observe.GROUPS[:6]:after['groups'][name].append(row(90+list(observe.GROUPS).index(name),new if name in('versions','slides','asset_pins','raw_companions','ready_exports')else None))
  after['groups']['versions'][-1]['key']=new;after['english_versioned_ready_ids']=[new];after['english_companion_version_ids']=[new]
  result=observe.compare(before,after);self.assertTrue(result['old_cohort_rows_unchanged']);self.assertEqual(result['new_rows_allowed_counts']['versions'],1)
 def test_each_old_row_must_remain_with_exact_hash_and_identity(self):
  for name in observe.GROUPS:
   after=sample(True);after['groups'][name][0]['sha256']='a'*64
   with self.assertRaises(ValueError):observe.compare(sample(),after)
   after=sample(True);after['groups'][name]=[]
   with self.assertRaises(ValueError):observe.compare(sample(),after)
 def test_no_extra_slides_pins_or_raw_companions_on_old_versions(self):
  for name in observe.EXACT_OLD_VERSION_GROUPS:
   after=sample(True);after['groups'][name].append(row(80,identifier(1)))
   with self.assertRaises(ValueError):observe.compare(sample(),after)
 def test_no_english_backfill_on_old_versions_but_new_access_export_allowed(self):
  for name in['english_versioned_ready_ids','english_companion_version_ids']:
   after=sample(True);after[name]=[identifier(1)]
   with self.assertRaises(ValueError):observe.compare(sample(),after)
  after=sample(True);after['groups']['ready_exports'].append(row(91,identifier(1)))
  self.assertEqual(observe.compare(sample(),after)['new_rows_allowed_counts']['ready_exports'],1)
 def test_schema_change_or_changed_reviewed_state_refused(self):
  after=sample(True);after['legacy_column_rls_hashes']['candidate_media']='e'*64
  with self.assertRaises(ValueError):observe.compare(sample(),after)
  after=sample(True);after['reviewed_effective']=False
  with self.assertRaises(ValueError):observe.compare(sample(),after)
 def test_private_payload_extras_or_wrong_reviewed_record_are_rejected(self):
  value=sample();value['groups']['raw_companions'][0]['original_text']='SYNTHETIC PRIVATE DO NOT PUBLISH'
  with self.assertRaises(ValueError):observe.parsed(wrapped(value),False)
  value=sample();value['groups']['reviewed_candidates'][0]['key']=identifier(99)
  with self.assertRaises(ValueError):observe.parsed(wrapped(value),False)
 def test_query_is_read_only_fixed_scope_with_only_hashes_and_ids_projected(self):
  before=observe.observation_sql(False);after=observe.observation_sql(True)
  for sql in[before,after]:
   self.assertTrue(sql.startswith('begin read only;'));self.assertTrue(sql.rstrip().endswith('rollback;'))
   self.assertNotRegex(sql,r'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b')
   self.assertIn('set local statement_timeout=\'12s\'',sql)
   self.assertIn("replace(p.prosrc,E'\\r\\n',E'\\n')",sql)
   self.assertNotIn("'original_text'",sql);self.assertNotIn("'snapshot'",sql);self.assertNotIn("'facts'",sql);self.assertNotIn("'object_key'",sql)
  self.assertNotIn('from eps.presentation_video_english_transcripts',before)
  self.assertIn('from eps.presentation_video_english_transcripts',after)
 def test_comparison_is_pure_and_result_has_counts_without_identifiers_or_hashes(self):
  before=sample();after=sample(True);original=copy.deepcopy((before,after));result=observe.compare(before,after)
  self.assertEqual((before,after),original);self.assertNotIn(identifier(1),json.dumps(result));self.assertNotIn('f'*64,json.dumps(result))

if __name__=='__main__':unittest.main()
