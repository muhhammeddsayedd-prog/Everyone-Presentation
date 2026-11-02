"""Finite nonsecret config fixture for the exact verified synthetic38 clone."""
from pathlib import Path
import hashlib,json,re
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
METADATA=MAIN/'.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'
METADATA_SHA='12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4'
ROWS={
 'candidate_asset_config':{'copy_sha256':'9996fba453fc8a1ea965dfb219dae14c9af82a6bfa76ba8694b06b27cb5d0390','changes':{'enabled':True,'transcription_model':'synthetic-transcription','extraction_model':'synthetic-model'},'constraints':{'candidate_asset_config_check':'not enabled OR transcription_model/extraction_model both nonnull with lengths1..200'},'source':'supabase/migrations/20261029100500_m03_candidate_pipeline.sql'},
 'frame_extraction_config':{'copy_sha256':'f03bae4e1c0089554541197a34e650d55dfa106458a7b715910975787b55f15a','changes':{'enabled':True,'native_image_id':NATIVE},'constraints':{'frame_extraction_config_check':'not enabled OR native_image_id nonnull','frame_extraction_config_native_image_id_check':'native_image_id matches ^sha256:[a-f0-9]{64}$','frame_extraction_config_implementation_version_check':'retained implementation_version=frame-extraction.v1'},'source':'supabase/migrations/20261029133455_m03_remaining_media_library.sql'},
 'presentation_processing_config':{'copy_sha256':'76150896aaf715db72a1d0f0890a75634c215717a3705764c6a6ab9fc070d63e','changes':{'enabled':True},'constraints':{'presentation_processing_config_renderer_version_check':'retained everyone-casting-pdf-v1','presentation_processing_config_application_origin_check':'retained http://127.0.0.1:3000','presentation_processing_config_max_manifest_bytes_check':'retained8388608','presentation_processing_config_max_pdf_bytes_check':'retained67108864','presentation_processing_config_max_pages_check':'retained1000'},'source':'supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql'},
 'review_processing_config':{'copy_sha256':'6edd27ef70ceeb706e9f674406bc1584ba3eae10de687095b5919aa83da8f33b','changes':{'enabled':True},'constraints':{'review_processing_config_model_check':'retained gpt-6.1-sol matches ^[A-Za-z0-9._-]{1,200}$','not_null':'retained prompt contextual_suggestion_v1 and renderer everyone-casting-fit-v1'},'source':'supabase/migrations/20261029202629_m04_review_series_processing.sql'},
 'specs_pipeline_config':{'copy_sha256':'b429cfea7b10d2d2ea1628414a6747c55c1adf9b63f7a50dfc6c92445bfc5c8f','changes':{'enabled':True,'document_preparation_version':'document-preparation.v1','model_version':'synthetic-model','prompt_version':'specs-v1','result_schema_version':'1.0'},'constraints':{'specs_pipeline_config_check':'not enabled OR all4 version fields nonnull','version_text_checks':'each nonnull version is trimmed, length1..200'},'source':'supabase/migrations/20261028222030_m02_specs_pipeline.sql'}
}
def need(value):
 if not value:raise ValueError('REASON40_SYNTHETIC_CONFIG_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def literal(value):return"'"+value.replace("'","''")+"'"
def json_sql(value):return literal(json.dumps(value,sort_keys=True,separators=(',',':')))+'::jsonb'
def expression(value):return'true'if value is True else'false'if value is False else'null'if value is None else str(value)if type(value)is int else literal(value)
def configuration():
 raw=METADATA.read_bytes();need(sha(raw)==METADATA_SHA);text=raw.decode();records={}
 for table,item in ROWS.items():
  match=re.search(r'^COPY eps\.'+table+r' \(([^\n]+)\) FROM stdin;\n(.*?)\n\\\.',text,re.M|re.S);need(match is not None);lines=match[2].splitlines();need(len(lines)==1 and sha(lines[0].encode())==item['copy_sha256']);columns=match[1].split(', ')
  def decode(column,value):return None if value=='\\N'else value=='t'if column in('id','enabled')and value in('t','f')else int(value)if column in('id','max_manifest_bytes','max_pdf_bytes','max_pages')else value
  before={key:decode(key,value)for key,value in zip(columns,lines[0].split('\t'))};need(len(before)==len(columns)and set(item['changes'])<=set(before));after={**before,**item['changes']}
  definition=re.search(r'CREATE TABLE eps\.'+table+r' \(\n(.*?)\n\);',text,re.S);need(definition is not None)
  constraints={match[1]:match[2].removesuffix(',')for match in re.finditer(r'^\s*CONSTRAINT ([a-z_]+) CHECK (.+)$',definition[1],re.M)};need(len(constraints)>=2)
  records[table]={**item,'before':before,'after':after,'actual_changed_fields':sorted(key for key in before if before[key]!=after[key]),'exact_backup_constraints':constraints,'source_sha256':sha((ROOT/item['source']).read_bytes())}
 text="set local role postgres;do $reason40_config$declare observed jsonb;changed integer;begin if current_user<>'postgres'or current_database()<>'project39'or(pg_control_system()).system_identifier::text is distinct from __REASON40_FIXTURE_SYSTEM_SQL__ or current_setting('eps.reason40fixture.run',true)is distinct from __REASON40_FIXTURE_RUN_SQL__ or(select count(*)from supabase_migrations.schema_migrations)<>39 then raise exception'REASON40_CONFIG_OWNED_TARGET_REQUIRED';end if;\n"
 for table,item in records.items():
  text+='select to_jsonb(t)into strict observed from eps.'+table+' t;if observed is distinct from '+json_sql(item['before'])+" then raise exception'REASON40_EXACT_CONFIG_PREIMAGE_REQUIRED';end if;\n"
  text+='update eps.'+table+' set '+','.join(key+'='+expression(value)for key,value in item['changes'].items())+' where id='+expression(item['before']['id'])+";get diagnostics changed=row_count;if changed<>1 then raise exception'REASON40_ONE_CONFIG_ROW_REQUIRED';end if;\n"
  text+='select to_jsonb(t)into strict observed from eps.'+table+' t;if observed is distinct from '+json_sql(item['after'])+" then raise exception'REASON40_ONLY_DECLARED_CONFIG_FIELDS_CHANGED';end if;\n"
 text+='end$reason40_config$;\n';return text,records
