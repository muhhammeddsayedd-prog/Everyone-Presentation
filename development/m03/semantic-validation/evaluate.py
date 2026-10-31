"""Offline, deterministic comparison against separately prepared human labels.

No provider, database, network, media processing or app mutation is performed.
Private facts and identifiers are consumed in RAM; receipts contain counts only.
This utility cannot establish that an asserted answer key is independent or that
a supplied job snapshot is authentic. It never grants M03/release acceptance.
"""
from pathlib import Path
import argparse,datetime,json,re,sys,unicodedata

ROOT=Path(__file__).resolve().parents[3]
PRIVATE_ROOT=ROOT/'.local/m03-semantic-validation'
FACT_FIELDS=('name','casting_id','age_or_range','stated_gender','height_measurements','languages','accents','skills_experience','city','previous_projects_roles','classification')
FIELD_PATHS=tuple('facts.'+field for field in FACT_FIELDS)+('project_availability_statement',)
LIST_FIELDS=frozenset(('facts.languages','facts.accents'))
LANGUAGES=('english','egyptian_arabic','arabic_other_or_unconfirmed_dialect','mixed_arabic_english','unclear')
REQUIRED_LANGUAGES=('english','arabic','mixed_arabic_english')
UUID=re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$')
MODEL=re.compile(r'^(?:gpt-|chatgpt-|whisper-|o[1-9](?:-|$))[A-Za-z0-9_.-]*$')
IDENTITY_KEYS={'case_alias','source_sha256','source_asset_id','job_id'}
COUNT_KEYS=('scored_fields','unclear_fields','correct_supplied','correct_missing','incorrect_supplied','missed_supplied','unsupported_personal_facts','review_snapshot_scored_fields','changed_scored_fields','remaining_errors_after_review')

class EvaluationInputError(ValueError):pass

def need(ok):
 if not ok:raise EvaluationInputError('EVALUATION_INPUT_INVALID')

def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def counts():return dict.fromkeys(COUNT_KEYS,0)
def normalized(value):
 if type(value)is list:return tuple(sorted(normalized(item)for item in value))
 return None if value is None else ' '.join(unicodedata.normalize('NFC',value).casefold().split())

def text(value,maximum=4096):
 need(type(value)is str and 0<len(value)<=maximum and bool(value.strip())and not any(unicodedata.category(char)=='Cs'or unicodedata.category(char)=='Cc'and char not in'\n\r\t'for char in value))
 return value

def field_value(value,path,populated=False):
 if path in LIST_FIELDS:
  need(type(value)is list and len(value)<=64)
  for item in value:text(item,200)
  need(len({normalized(item)for item in value})==len(value))
  if populated:need(bool(value))
 else:
  need(value is None or type(value)is str)
  if value is not None:text(value)
  if populated:need(value is not None)

def identity(row):
 need(type(row['case_alias'])is str and re.fullmatch(r'case_[1-9][0-9]{0,3}',row['case_alias']))
 need(type(row['source_sha256'])is str and re.fullmatch(r'[a-f0-9]{64}',row['source_sha256']))
 need(all(type(row[key])is str and UUID.fullmatch(row[key])for key in('source_asset_id','job_id')))

def values(value):
 exact(value,FIELD_PATHS)
 for path,item in value.items():field_value(item,path)

def configuration(value):
 exact(value,{'provider','transcription','extraction'});need(value['provider']=='openai')
 for stage,prompt in(('transcription','transcription-original-language.v1'),('extraction','candidate_extract_v1')):
  item=value[stage];exact(item,{'requested_model','resolved_model','sdk_version','prompt_version'})
  need(type(item['requested_model'])is str and 1<=len(item['requested_model'])<=120 and MODEL.fullmatch(item['requested_model']))
  need(item['resolved_model']is None or type(item['resolved_model'])is str and len(item['resolved_model'])<=120 and MODEL.fullmatch(item['resolved_model']))
  need(type(item['sdk_version'])is str and re.fullmatch(r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}',item['sdk_version'])and item['prompt_version']==prompt)

def index_samples(document,kind):
 exact(document,{'schema_version','samples'});need(document['schema_version']=='1.0'and type(document['samples'])is list and 1<=len(document['samples'])<=200)
 indexed={};seen={key:set()for key in('source_sha256','source_asset_id','job_id')}
 for row in document['samples']:
  if kind=='labels':
   exact(row,IDENTITY_KEYS|{'spoken_language','label_basis','independent_of_ai','fields'})
   need(row['spoken_language']in LANGUAGES and row['label_basis']in('independent_human_listening','owner_answer_key')and row['independent_of_ai']is True)
   exact(row['fields'],FIELD_PATHS)
   for path,label in row['fields'].items():
    exact(label,{'status','acceptable_values'});need(label['status']in('supplied','not_supplied','unclear')and type(label['acceptable_values'])is list and len(label['acceptable_values'])<=20)
    if label['status']=='supplied':
     need(bool(label['acceptable_values']))
     for acceptable in label['acceptable_values']:field_value(acceptable,path,populated=True)
     need(len({normalized(item)for item in label['acceptable_values']})==len(label['acceptable_values']))
    else:need(label['acceptable_values']==[])
  else:
   exact(row,IDENTITY_KEYS|{'snapshot_kind','values','reviewed_values','configuration'})
   need(row['snapshot_kind']=='original_completed_extraction');values(row['values']);configuration(row['configuration'])
   if row['reviewed_values']is not None:values(row['reviewed_values'])
  identity(row);need(row['case_alias']not in indexed)
  for key,seen_values in seen.items():need(row[key]not in seen_values);seen_values.add(row[key])
  indexed[row['case_alias']]=row
 return indexed

def outcome(value,label):
 if label['status']=='unclear':return 'unclear_fields'
 missing=value is None or value==[]
 if label['status']=='not_supplied':return 'correct_missing'if missing else 'unsupported_personal_facts'
 if missing:return 'missed_supplied'
 return 'correct_supplied'if normalized(value)in{normalized(acceptable)for acceptable in label['acceptable_values']}else'incorrect_supplied'

def rate(numerator,denominator):return {'numerator':numerator,'denominator':denominator,'value':numerator/denominator if denominator else None}
def errors(value):return value['incorrect_supplied']+value['missed_supplied']+value['unsupported_personal_facts']

def compare(labels_document,observations_document):
 labels=index_samples(labels_document,'labels');observations=index_samples(observations_document,'observations');need(set(labels)==set(observations))
 total=counts();per_field={path:counts()for path in FIELD_PATHS};per_language={language:counts()for language in LANGUAGES};cases=[];language_counts=dict.fromkeys(LANGUAGES,0);configurations={}
 for alias in sorted(labels,key=lambda value:int(value.split('_')[1])):
  label=labels[alias];observation=observations[alias]
  need(all(label[key]==observation[key]for key in IDENTITY_KEYS));language=label['spoken_language'];language_counts[language]+=1;case_counts=counts()
  for path in FIELD_PATHS:
   expected=label['fields'][path];actual=observation['values'][path];kind=outcome(actual,expected)
   groups=(total,per_field[path],per_language[language],case_counts)
   for group in groups:
    group[kind]+=1
    if kind!='unclear_fields':group['scored_fields']+=1
   if kind!='unclear_fields'and observation['reviewed_values']is not None:
    reviewed=observation['reviewed_values'][path];after_kind=outcome(reviewed,expected)
    for group in groups:
     group['review_snapshot_scored_fields']+=1
     group['changed_scored_fields']+=int(normalized(actual)!=normalized(reviewed))
     group['remaining_errors_after_review']+=int(after_kind in('incorrect_supplied','missed_supplied','unsupported_personal_facts'))
  # Only synthetic-format aliases and fixed classifications leave private inputs.
  cases.append({'case_alias':alias,'spoken_language':language,**case_counts})
  serialized=json.dumps(observation['configuration'],sort_keys=True);configurations[serialized]=configurations.get(serialized,0)+1
 confirmed={'english':language_counts['english'],'arabic':language_counts['egyptian_arabic']+language_counts['arabic_other_or_unconfirmed_dialect'],'mixed_arabic_english':language_counts['mixed_arabic_english']}
 missing=[language for language in REQUIRED_LANGUAGES if not confirmed[language]]
 incomplete=bool(missing or language_counts['unclear']or total['unclear_fields']or not language_counts['egyptian_arabic'])
 return {'schema_version':'1.0','evidence_kind':'offline_human_label_comparison','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'result':'incomplete'if incomplete else'comparison_complete_manual_acceptance_pending','sample_count':len(labels),'source_bindings_matched':True,
  'coverage':{'confirmed_spoken_language_counts':confirmed,'missing_spoken_languages':missing,'egyptian_arabic_case_count':language_counts['egyptian_arabic'],'unclear_language_case_count':language_counts['unclear']},
  'totals':total,'field_error_rate':rate(errors(total),total['scored_fields']),
  'observed_correction_rate':rate(total['changed_scored_fields'],total['review_snapshot_scored_fields']),
  'post_review_field_error_rate':rate(total['remaining_errors_after_review'],total['review_snapshot_scored_fields']),
  'zero_unsupported_personal_facts_on_scored_fields':total['unsupported_personal_facts']+total['incorrect_supplied']==0 if total['scored_fields']else None,
  'per_field':per_field,'per_spoken_language':per_language,'cases':cases,
  'model_configurations':[{'configuration':json.loads(key),'sample_count':count}for key,count in sorted(configurations.items())],
  'ground_truth_independence':'asserted_by_input_not_verified_by_this_utility','snapshot_authenticity':'caller_supplied_archived_job_metadata_not_fetched',
  'connection_or_milestone_acceptance':'not_determined_by_this_utility','representativeness_and_semantic_equivalence':'requires_independent_human_assessment',
  'transcript_word_accuracy_measured':False,'source_evidence_pointers_measured':False,'frame_quality_measured':False,'provider_called':False,'cloud_called':False,'sql_executed':False,
  'private_values_or_scalar_hashes_emitted':False}

def strict_json(raw):
 def pairs(items):
  value={}
  for key,item in items:need(key not in value);value[key]=item
  return value
 try:return json.loads(raw,object_pairs_hook=pairs,parse_constant=lambda _:(_ for _ in()).throw(EvaluationInputError('EVALUATION_INPUT_INVALID')))
 except (ValueError,TypeError,RecursionError):raise EvaluationInputError('EVALUATION_INPUT_INVALID')from None

def private_document(path):
 resolved=Path(path).resolve(strict=True);need(resolved.is_relative_to(PRIVATE_ROOT)and resolved.is_file()and 0<resolved.stat().st_size<=8*1024*1024)
 raw=resolved.read_bytes();need(len(raw)<=8*1024*1024)
 try:return strict_json(raw.decode('utf-8-sig'))
 except UnicodeError:raise EvaluationInputError('EVALUATION_INPUT_INVALID')from None

class PrivateArgumentParser(argparse.ArgumentParser):
 def error(self,message):raise EvaluationInputError('EVALUATION_INPUT_INVALID')

def main():
 parser=PrivateArgumentParser(description='Compare private, independently prepared M03 labels and archived original extraction snapshots. Emits metadata only; never grants release acceptance.')
 parser.add_argument('--labels',required=True);parser.add_argument('--observations',required=True);arguments=parser.parse_args()
 result=compare(private_document(arguments.labels),private_document(arguments.observations));print(json.dumps(result,ensure_ascii=True,sort_keys=True))

if __name__=='__main__':
 try:main()
 except Exception:print('{"error":"EVALUATION_INPUT_INVALID"}');sys.exit(1)
