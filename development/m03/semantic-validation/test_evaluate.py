"""Synthetic-only offline evaluation regressions; no media/provider/DB access."""
import copy,hashlib,importlib.util,json,subprocess,sys,tempfile,unittest
from pathlib import Path

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('m03_semantic_evaluation',HERE/'evaluate.py')
evaluate=importlib.util.module_from_spec(spec);spec.loader.exec_module(evaluate)

def fixture(language='egyptian_arabic'):
 fields={key:{'status':'unclear','acceptable_values':[]}for key in evaluate.FIELD_PATHS}
 fields['facts.name']={'status':'supplied','acceptable_values':['SYNTHETIC ALPHA']}
 fields['facts.age_or_range']={'status':'supplied','acceptable_values':['37']}
 fields['facts.height_measurements']={'status':'not_supplied','acceptable_values':[]}
 fields['facts.languages']={'status':'supplied','acceptable_values':[['Arabic','English']]}
 identity={'case_alias':'case_1','source_sha256':'a'*64,'source_asset_id':'00000000-0000-4000-8000-000000000001','job_id':'00000000-0000-4000-8000-000000000002'}
 labels={'schema_version':'1.0','samples':[{**identity,'spoken_language':language,'label_basis':'independent_human_listening','independent_of_ai':True,'fields':fields}]}
 values={key:([]if key in evaluate.LIST_FIELDS else None)for key in evaluate.FIELD_PATHS}
 values.update({'facts.name':'Synthetic Alpha','facts.age_or_range':'37','facts.languages':['English','Arabic']})
 stage=lambda model,prompt:{'requested_model':model,'resolved_model':model,'sdk_version':'7.45.1','prompt_version':prompt}
 observations={'schema_version':'1.0','samples':[{**identity,'snapshot_kind':'original_completed_extraction','values':values,'reviewed_values':None,'configuration':{'provider':'openai','transcription':stage('gpt-4o-transcribe','transcription-original-language.v1'),'extraction':stage('gpt-6.1-sol','candidate_extract_v1')}}]}
 return labels,observations

class SemanticEvaluation(unittest.TestCase):
 def test_incomplete_language_and_label_coverage_remains_explicit(self):
  labels,observations=fixture();result=evaluate.compare(labels,observations)
  self.assertEqual(result['result'],'incomplete')
  self.assertEqual(result['coverage']['missing_spoken_languages'],['english','mixed_arabic_english'])
  self.assertEqual(result['totals']['scored_fields'],4)
  self.assertEqual(result['totals']['unclear_fields'],8)
  self.assertEqual(result['totals']['correct_supplied'],3)
  self.assertEqual(result['totals']['correct_missing'],1)
  self.assertEqual(result['field_error_rate'],{'numerator':0,'denominator':4,'value':0.0})
  self.assertEqual(result['connection_or_milestone_acceptance'],'not_determined_by_this_utility')

 def test_missing_wrong_and_unsupported_have_distinct_denominators(self):
  labels,observations=fixture();values=observations['samples'][0]['values']
  values['facts.name']='SYNTHETIC WRONG';values['facts.age_or_range']=None;values['facts.height_measurements']='180 cm'
  result=evaluate.compare(labels,observations)
  self.assertEqual(result['totals']['incorrect_supplied'],1)
  self.assertEqual(result['totals']['missed_supplied'],1)
  self.assertEqual(result['totals']['unsupported_personal_facts'],1)
  self.assertEqual(result['field_error_rate'],{'numerator':3,'denominator':4,'value':0.75})
  self.assertFalse(result['zero_unsupported_personal_facts_on_scored_fields'])

 def test_wrong_populated_value_cannot_claim_zero_unsupported_facts(self):
  labels,observations=fixture();observations['samples'][0]['values']['facts.name']='SYNTHETIC WRONG'
  result=evaluate.compare(labels,observations)
  self.assertFalse(result['zero_unsupported_personal_facts_on_scored_fields'])

 def test_no_labels_do_not_become_zero_error_perfect_result(self):
  labels,observations=fixture()
  for label in labels['samples'][0]['fields'].values():label.update(status='unclear',acceptable_values=[])
  result=evaluate.compare(labels,observations)
  self.assertEqual(result['field_error_rate'],{'numerator':0,'denominator':0,'value':None})
  self.assertIsNone(result['zero_unsupported_personal_facts_on_scored_fields'])

 def test_only_explicit_aliases_allow_transliteration_or_units(self):
  labels,observations=fixture();observations['samples'][0]['values']['facts.age_or_range']='37 years'
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],1)
  labels['samples'][0]['fields']['facts.age_or_range']['acceptable_values'].append('37 years')
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],0)
  observations['samples'][0]['values']['facts.name']='Synthetic-Alpha'
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],1)

 def test_list_order_is_irrelevant_but_extra_language_is_not(self):
  labels,observations=fixture()
  self.assertEqual(evaluate.compare(labels,observations)['totals']['correct_supplied'],3)
  observations['samples'][0]['values']['facts.languages'].append('French')
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],1)

 def test_matching_full_source_job_and_asset_is_required(self):
  for field,value in [('source_sha256','b'*64),('job_id','00000000-0000-4000-8000-000000000003'),('source_asset_id','00000000-0000-4000-8000-000000000004')]:
   labels,observations=fixture();observations['samples'][0][field]=value
   with self.subTest(field=field),self.assertRaises(evaluate.EvaluationInputError):evaluate.compare(labels,observations)

 def test_duplicate_sources_or_extra_observations_cannot_inflate_corpus(self):
  labels,observations=fixture();duplicate=copy.deepcopy(labels['samples'][0]);duplicate['case_alias']='case_2';labels['samples'].append(duplicate)
  with self.assertRaises(evaluate.EvaluationInputError):evaluate.compare(labels,observations)
  labels,observations=fixture();extra=copy.deepcopy(observations['samples'][0]);extra['case_alias']='case_2';extra['source_sha256']='b'*64;extra['job_id']='00000000-0000-4000-8000-000000000003';extra['source_asset_id']='00000000-0000-4000-8000-000000000004';observations['samples'].append(extra)
  with self.assertRaises(evaluate.EvaluationInputError):evaluate.compare(labels,observations)

 def test_ai_ground_truth_current_profile_and_missing_config_are_rejected(self):
  for mutation in ('ai_basis','not_independent','current_profile','missing_model','unlabelled_field','extra_key','personal_alias'):
   labels,observations=fixture()
   if mutation=='ai_basis':labels['samples'][0]['label_basis']='ai_output'
   elif mutation=='not_independent':labels['samples'][0]['independent_of_ai']=False
   elif mutation=='current_profile':observations['samples'][0]['snapshot_kind']='current_profile'
   elif mutation=='missing_model':observations['samples'][0]['configuration']['extraction']['requested_model']=None
   elif mutation=='unlabelled_field':del labels['samples'][0]['fields']['facts.city']
   elif mutation=='extra_key':labels['samples'][0]['command']='SYNTHETIC SECRET'
   else:labels['samples'][0]['case_alias']='SYNTHETIC PERSONAL NAME'
   with self.subTest(mutation=mutation),self.assertRaises(evaluate.EvaluationInputError):evaluate.compare(labels,observations)

 def test_review_snapshot_change_rate_is_separate_from_error_rate(self):
  labels,observations=fixture();sample=observations['samples'][0];sample['reviewed_values']=copy.deepcopy(sample['values']);sample['values']['facts.name']='SYNTHETIC WRONG'
  result=evaluate.compare(labels,observations)
  self.assertEqual(result['field_error_rate']['numerator'],1)
  self.assertEqual(result['observed_correction_rate'],{'numerator':1,'denominator':4,'value':0.25})
  self.assertEqual(result['totals']['remaining_errors_after_review'],0)
  self.assertEqual(result['totals']['review_snapshot_scored_fields'],4)
  self.assertEqual(result['post_review_field_error_rate'],{'numerator':0,'denominator':4,'value':0.0})

 def test_complete_counts_do_not_manufacture_a_release_pass(self):
  labels,observations=fixture();all_labels=[];all_observations=[]
  for index,language in enumerate(('english','egyptian_arabic','mixed_arabic_english'),1):
   left=copy.deepcopy(labels['samples'][0]);right=copy.deepcopy(observations['samples'][0])
   for item in(left,right):item.update(case_alias=f'case_{index}',source_sha256=str(index)*64,source_asset_id=f'00000000-0000-4000-8000-{index:012d}',job_id=f'00000000-0000-4000-9000-{index:012d}')
   left['spoken_language']=language
   for label in left['fields'].values():
    if label['status']=='unclear':label.update(status='not_supplied',acceptable_values=[])
   all_labels.append(left);all_observations.append(right)
  result=evaluate.compare({'schema_version':'1.0','samples':all_labels},{'schema_version':'1.0','samples':all_observations})
  self.assertEqual(result['coverage']['missing_spoken_languages'],[])
  self.assertEqual(result['result'],'comparison_complete_manual_acceptance_pending')
  self.assertEqual(result['connection_or_milestone_acceptance'],'not_determined_by_this_utility')

 def test_receipt_excludes_values_scalar_hashes_and_private_source_identifiers(self):
  labels,observations=fixture();result=evaluate.compare(labels,observations);serialized=json.dumps(result,ensure_ascii=False)
  for value in('SYNTHETIC ALPHA','Synthetic Alpha','Arabic','English','37','a'*64,labels['samples'][0]['source_asset_id'],labels['samples'][0]['job_id'],hashlib.sha256(b'37').hexdigest()):
   self.assertNotIn(json.dumps(value,ensure_ascii=False),serialized)
  self.assertFalse(result['provider_called']);self.assertFalse(result['cloud_called']);self.assertFalse(result['sql_executed'])

 def test_closed_input_and_duplicate_json_keys_fail_without_echoing_payload(self):
  with self.assertRaises(evaluate.EvaluationInputError):evaluate.strict_json('{"schema_version":"1.0","schema_version":"PRIVATE SENTINEL"}')
  process=subprocess.run([sys.executable,'-B',str(HERE/'evaluate.py'),'--labels','PRIVATE SENTINEL','--observations','PRIVATE SENTINEL'],capture_output=True,text=True)
  self.assertEqual(process.returncode,1);self.assertNotIn('PRIVATE SENTINEL',process.stdout+process.stderr)
  self.assertIn('EVALUATION_INPUT_INVALID',process.stdout)

 def test_field_names_cover_current_extraction_contract_without_changing_it(self):
  schema=json.loads((HERE.parents[2]/'contracts/json-schema/candidate-extraction.schema.json').read_text())
  self.assertEqual(set(evaluate.FIELD_PATHS),{'facts.'+field for field in schema['$defs']['CandidateFacts']['required']}|{'project_availability_statement'})

 def test_templates_cannot_be_treated_as_an_independent_real_dataset(self):
  labels=json.loads((HERE/'labels.template.json').read_text());observations=json.loads((HERE/'observations.template.json').read_text())
  with self.assertRaises(evaluate.EvaluationInputError):evaluate.compare(labels,observations)
  self.assertFalse(labels['samples'][0]['independent_of_ai'])
  self.assertTrue(all(field['status']=='unclear'for field in labels['samples'][0]['fields'].values()))

 def test_real_existing_file_outside_ignored_private_root_is_rejected(self):
  with tempfile.TemporaryDirectory(prefix='eps-semantic-synthetic-')as directory:
   path=Path(directory).resolve()/'synthetic-labels.json';path.write_text(json.dumps(fixture()[0]),encoding='utf8')
   self.assertTrue(path.is_file());self.assertFalse(path.is_relative_to(evaluate.PRIVATE_ROOT))
   with self.assertRaises(evaluate.EvaluationInputError):evaluate.private_document(path)

 def test_comparison_preserves_negation_and_stated_ranges(self):
  labels,observations=fixture();labels['samples'][0]['fields']['facts.skills_experience']={'status':'supplied','acceptable_values':['I have not acted in commercials']};observations['samples'][0]['values']['facts.skills_experience']='I have acted in commercials'
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],1)
  labels['samples'][0]['fields']['facts.age_or_range']['acceptable_values']=['35-40'];observations['samples'][0]['values']['facts.age_or_range']='37'
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],2)

 def test_unicode_normalization_never_translates_or_infers_spoken_language(self):
  labels,observations=fixture(language='unclear');labels['samples'][0]['fields']['facts.name']['acceptable_values']=['SYNTHETIC Cafe\u0301'];observations['samples'][0]['values']['facts.name']='synthetic caf\u00e9'
  result=evaluate.compare(labels,observations);self.assertEqual(result['totals']['correct_supplied'],3)
  self.assertEqual(result['coverage']['unclear_language_case_count'],1)
  self.assertEqual(result['coverage']['missing_spoken_languages'],['english','arabic','mixed_arabic_english'])
  labels['samples'][0]['fields']['facts.name']['acceptable_values']=['اسم تجريبي'];observations['samples'][0]['values']['facts.name']='Synthetic Test Name'
  self.assertEqual(evaluate.compare(labels,observations)['totals']['incorrect_supplied'],1)

 def test_invalid_unicode_scalar_is_rejected_without_exposure(self):
  labels,observations=fixture();observations['samples'][0]['values']['facts.name']='PRIVATE\ud800SENTINEL'
  with self.assertRaises(evaluate.EvaluationInputError):evaluate.compare(labels,observations)

if __name__=='__main__':unittest.main()
