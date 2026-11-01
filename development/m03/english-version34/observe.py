"""One exact new Ready-version English capture observation. No payload output.

Root supplies a protected private plan only after actual app generation. SQL is
read-only; only IDs, statuses, hashes, lengths and fixed booleans leave SQL.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, re, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
PRIVATE=ROOT/'.local/m03-english-component';PLAN=PRIVATE/'english-version-plan.json'
HELPER=ROOT/'development/m03/english-preservation34/observe.py'
HELPER_SHA='aec15bd2e651c1ae3b499718bd5b356ad84cb4e8c756fc6c79ec98d484ce3377'
MIGRATION=ROOT/'supabase/migrations/20261031143711_m03_english_transcript_projection.sql'
MIGRATION_SHA='0705f1940abbc5c4afc65a49e85d9ef2ce6a6489178b6dd82c3acb33cf976472'
SOURCE_SHA='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
TARGET='pyibofyctwnqpvktepse';VERSION='20261031143711'
UUID=re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$');DIGEST=re.compile(r'^[a-f0-9]{64}$')
PLAN_KEYS={'version_id','job_id','candidate_media_id','source_asset_id','source_sha256'}
CHECKS={
 'ready_english_version','succeeded_flagged_source_job','source_video_hash_matches','job_result_media_source_bound',
 'frozen_candidate_video_pin_bound','frozen_slide_source_candidate_bound','raw_and_english_companions_bound',
 'source_media_revision_matches_capture','capture_times_match_version','raw_status_available','english_status_available',
 'english_companion_hash_valid','english_text_equals_media','english_hash_equals_media_text_hash',
 'english_source_hash_equals_raw','raw_text_equals_media','raw_hash_valid','english_input_hash_matches_job',
 'v2_stage_schema','english_text_equals_validated_stage','raw_text_equals_validated_stage',
 'english_companion_immutable_trigger','raw_companion_immutable_trigger','version_immutable_trigger',
}

def need(value):
 if not value:raise ValueError('ENGLISH_VERSION34_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def helper():
 need(sha(HELPER.read_bytes())==HELPER_SHA)
 spec=importlib.util.spec_from_file_location('version34_preservation_guards',HELPER);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def plan_value(value):
 exact(value,PLAN_KEYS)
 need(all(type(value[key])is str and UUID.fullmatch(value[key])for key in PLAN_KEYS-{'source_sha256'}))
 need(value['source_sha256']==SOURCE_SHA and value['job_id']!='9a5ddb61-6a9a-4157-b6be-8653cf2eadef'and value['candidate_media_id']!='f5dff77f-092f-4777-9f56-3bbce4dee57c')
 return dict(value)
def sources():
 need(sha(MIGRATION.read_bytes())==MIGRATION_SHA and sha(HELPER.read_bytes())==HELPER_SHA)
 files=[Path(__file__),HERE/'test_observe.py',HERE/'README.md',HERE/'visible-region-proof.mjs',MIGRATION,HELPER]
 return {p.relative_to(ROOT).as_posix():sha(p.read_bytes())for p in files}
def hash_sql(text):return "encode(sha256(convert_to("+text+",'UTF8')),'hex')"
def immutable(table,name,function):
 return "exists(select 1 from pg_trigger where tgrelid='eps."+table+"'::regclass and tgname='"+name+"'and not tgisinternal and tgenabled in('O','A')and tgtype=27 and tgfoid='eps."+function+"()'::regprocedure)"

def observation_sql(plan):
 p=plan_value(plan)
 checks={
  'ready_english_version':"v.status='ready'and v.english_transcript_version='1.0'",
  'succeeded_flagged_source_job':"j.kind='candidate_scan'and j.status='succeeded'and j.input#>>'{configuration,english_transcript_version}'='1.0'",
  'source_video_hash_matches':"a.sha256='"+SOURCE_SHA+"'and a.status in('ready','archived')",
  'job_result_media_source_bound':"j.result->>'candidate_media_id'=m.id::text and j.result->>'source_asset_id'=a.id::text",
  'frozen_candidate_video_pin_bound':"pin.asset_kind='candidate_video'and pin.asset_id=a.id and pin.sha256=a.sha256 and pin.mime_type=a.mime_type and pin.byte_size=a.size_bytes and pin.bucket=a.bucket and pin.object_key=a.object_key",
  'frozen_slide_source_candidate_bound':"exists(select 1 from eps.version_slides s where s.version_id=v.id and s.kind='candidate'and s.snapshot->>'candidate_media_id'=m.id::text and s.snapshot->>'video_asset_id'=a.id::text and s.snapshot->>'candidate_id'=m.candidate_id::text)",
  'raw_and_english_companions_bound':'t.candidate_media_id=m.id and et.candidate_media_id=m.id and t.video_asset_id=a.id and et.video_asset_id=a.id and et.version_id=v.id and t.version_id=v.id',
  'source_media_revision_matches_capture':'et.source_media_row_version=t.source_media_row_version and t.source_media_row_version=m.row_version',
  'capture_times_match_version':'et.captured_at=v.created_at and t.captured_at=v.created_at',
  'raw_status_available':"t.status='available'",
  'english_status_available':"et.status='available'and m.english_transcript_status='available'",
  'english_companion_hash_valid':'et.english_sha256='+hash_sql('et.english_text'),
  'english_text_equals_media':'et.english_text=m.english_transcript',
  'english_hash_equals_media_text_hash':'et.english_sha256='+hash_sql('m.english_transcript'),
  'english_source_hash_equals_raw':'et.source_sha256=t.source_sha256 and et.source_sha256=m.english_transcript_source_sha256',
  'raw_text_equals_media':'t.original_text=m.original_transcript',
  'raw_hash_valid':'t.source_sha256='+hash_sql('t.original_text'),
  'english_input_hash_matches_job':'m.english_transcript_input_hash=j.input_hash',
  'v2_stage_schema':"e.result_schema='candidate-extraction-stage.v2'",
  'english_text_equals_validated_stage':"et.english_text=e.payload#>>'{english_transcript,text}'and et.status=e.payload#>>'{english_transcript,status}'and et.source_sha256=e.payload#>>'{english_transcript,source_sha256}'",
  'raw_text_equals_validated_stage':"t.original_text=tr.payload#>>'{original_transcript,original_text}'",
  'english_companion_immutable_trigger':immutable('presentation_video_english_transcripts','presentation_video_english_immutable','presentation_immutable_row'),
  'raw_companion_immutable_trigger':immutable('presentation_video_transcripts','presentation_video_transcript_immutable','presentation_immutable_row'),
  'version_immutable_trigger':immutable('presentation_versions','presentation_version_immutable','presentation_immutable_version'),
 }
 need(set(checks)==CHECKS)
 pairs=','.join("'"+key+"',coalesce(("+value+"),false)"for key,value in checks.items())
 return "begin read only;\nset local search_path='';set local statement_timeout='10s';\nwith matched as(\n"+\
  "select v.id as version_id,v.series_id,v.workspace_id,v.project_id,v.version_number,v.status as version_status,v.english_transcript_version,v.generation_job_id,v.pdf_asset_id,\n"+\
  "j.id as source_job_id,m.id as candidate_media_id,m.candidate_id,a.id as video_asset_id,a.sha256 as source_video_sha256,m.row_version as current_media_row_version,t.source_media_row_version,et.status as english_status,et.english_sha256,\n"+\
  "length(et.english_text)as english_characters,octet_length(et.english_text)as english_utf8_bytes,\n"+\
  "(select count(*)from eps.version_slides s where s.version_id=v.id and s.kind='candidate'and s.snapshot->>'candidate_media_id'=m.id::text and s.snapshot->>'video_asset_id'=a.id::text and s.snapshot->>'candidate_id'=m.candidate_id::text)as matching_candidate_slide_count,\n"+\
  "jsonb_build_object("+pairs+")as checks\n"+\
  "from eps.presentation_versions v join eps.presentation_version_assets pin on pin.version_id=v.id and pin.asset_id='"+p['source_asset_id']+"'\n"+\
  "join eps.media_assets a on a.id=pin.asset_id join eps.candidate_media m on m.source_asset_id=a.id and m.id='"+p['candidate_media_id']+"'\n"+\
  "join eps.jobs j on j.id=m.source_job_id and j.input_asset_id=a.id and j.id='"+p['job_id']+"'\n"+\
  "join eps.presentation_video_transcripts t on t.version_id=v.id and t.video_asset_id=a.id\n"+\
  "join eps.presentation_video_english_transcripts et on et.version_id=t.version_id and et.video_asset_id=t.video_asset_id\n"+\
  "join eps.candidate_stage_payloads e on e.job_id=j.id and e.input_hash=j.input_hash and e.stage='extract_candidate'\n"+\
  "join eps.candidate_stage_payloads tr on tr.job_id=j.id and tr.input_hash=j.input_hash and tr.stage='transcribe_candidate'\n"+\
  "where v.id='"+p['version_id']+"')select jsonb_build_object('database',current_database(),'operator',current_user,\n"+\
  "'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),'match_count',(select count(*)from matched),'capture',(select to_jsonb(m)from matched m))as english_version_capture;\nrollback;\n"

def parse(payload,plan,history):
 p=plan_value(plan);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1);exact(rows[0],['english_version_capture']);value=rows[0]['english_version_capture']
 exact(value,['database','operator','history','match_count','capture']);need(value['database']=='postgres'and value['operator']=='postgres'and value['history']==history+[VERSION]and value['match_count']==1)
 c=value['capture'];ids=['version_id','series_id','workspace_id','project_id','generation_job_id','pdf_asset_id','source_job_id','candidate_media_id','candidate_id','video_asset_id']
 exact(c,ids+['version_number','version_status','english_transcript_version','source_video_sha256','current_media_row_version','source_media_row_version','english_status','english_sha256','english_characters','english_utf8_bytes','matching_candidate_slide_count','checks'])
 need(all(type(c[key])is str and UUID.fullmatch(c[key])for key in ids))
 need(c['version_id']==p['version_id']and c['source_job_id']==p['job_id']and c['candidate_media_id']==p['candidate_media_id']and c['video_asset_id']==p['source_asset_id']and c['source_video_sha256']==SOURCE_SHA)
 need(c['version_status']=='ready'and c['english_transcript_version']=='1.0'and c['english_status']=='available'and type(c['english_sha256'])is str and DIGEST.fullmatch(c['english_sha256']))
 need(all(type(c[key])is int and 1<=c[key]<=9007199254740991 for key in['version_number','current_media_row_version','source_media_row_version']))
 need(type(c['english_characters'])is int and 1<=c['english_characters']<=200000 and type(c['english_utf8_bytes'])is int and c['english_characters']<=c['english_utf8_bytes']<=800000)
 need(type(c['matching_candidate_slide_count'])is int and 1<=c['matching_candidate_slide_count']<=1000)
 exact(c['checks'],CHECKS);need(all(v is True for v in c['checks'].values()))
 return c

def main():
 need(len(sys.argv)==1);pins=sources();common=helper();guard=common.security();client=common.module()
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 guard.verify(PLAN)
 with PLAN.open('rb')as stream:guard.verify_open(stream);plan_bytes=stream.read(8193);guard.verify_open(stream)
 need(len(plan_bytes)<=8192);p=plan_value(json.loads(plan_bytes))
 baseline=PRIVATE/'preservation34/baseline.json';guard.verify(baseline)
 with baseline.open('rb')as stream:guard.verify_open(stream);old=json.load(stream);guard.verify_open(stream)
 need(p['version_id']not in{v['key']for v in old['observation']['groups']['versions']})
 sql=observation_sql(p).encode('utf8');need(sql.startswith(b'begin read only;')and sql.rstrip().endswith(b'rollback;')and not re.search(rb'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b',sql))
 run=str(uuid.uuid4());observed=datetime.datetime.now(datetime.timezone.utc).isoformat();private=PRIVATE/('version34-'+run);private.mkdir();need(private.resolve()==private and not private.is_symlink())
 common.protected_write(guard,PRIVATE/('version34-'+p['version_id']+'.claim.json'),json.dumps({'run_id':run,'observed_at':observed,'purpose':'exact-new-version-English-capture','plan':p,'source_pins':pins,'automatic_retry':False}).encode('utf8'))
 snapshot=private/'read.sql';common.protected_write(guard,snapshot,sql);client.snapshot_ok(snapshot,sha(sql))
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(snapshot),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,_stderr=client.bounded(command);client.snapshot_ok(snapshot,sha(sql))
 receipt={'schema_version':'1.0','evidence_kind':'actual_exact_new_ready_version_english_capture','observed_at':observed,'run_id':run,'target':TARGET,'read_only_rollback':True,'automatic_retry':False,'result':'unconfirmed','source_pins':pins,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'raw_cli_or_payload_values_persisted':False,'guest_token_or_url_recorded':False,'provider_or_media_fetch_performed':False,'old_cohort_preservation_or_semantic_accuracy_or_app_guest_acceptance':False}
 try:
  need(code==0 and not timeout and not overflow);capture=parse(json.loads(stdout),p,common.preflight()['history'])
  guard.verify(PLAN);need(PLAN.read_bytes()==plan_bytes);receipt['capture']=capture;receipt['expected_visible_english_sha256']=capture['english_sha256'];receipt['result']='passed'
 except Exception:receipt['safe_error_code']='ENGLISH_VERSION34_UNCONFIRMED'
 out=ROOT/'tracking/evidence/m03/english-version34';out.mkdir(parents=True,exist_ok=True);file=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+run+'-capture.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(ROOT).as_posix(),'payload_values_returned':False}));need(receipt['result']=='passed')

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH_VERSION34_UNCONFIRMED');sys.exit(1)
