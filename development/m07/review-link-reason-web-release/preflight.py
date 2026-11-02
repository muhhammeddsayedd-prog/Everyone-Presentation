"""Fresh read-only approved40/41 web-only preflight. No provider/DB mutation."""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, subprocess, sys, uuid

ROOT=Path(__file__).resolve().parents[3]
TARGET='pyibofyctwnqpvktepse'
NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4'
PROTECTED='b3f90268-147d-41d4-8875-2a6435df1496'
READER=ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'

def need(value):
 if not value: raise ValueError('REVIEW_LINK_REASON_CANONICAL_PREFLIGHT_UNCONFIRMED')

def digest(file):
 need(file.is_file() and not file.is_symlink() and not file.is_junction())
 h=hashlib.sha256()
 with file.open('rb') as source:
  for chunk in iter(lambda:source.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()

def query_sql():
 flags={'specs':'specs_pipeline_config','candidates':'candidate_asset_config','support':'review_processing_config','frames':'frame_extraction_config','presentations':'presentation_processing_config'}
 gates=','.join("'"+key+"',(select case when count(*)=1 then bool_and(enabled) else false end from eps."+table+')' for key,table in flags.items())
 counters={key:"status='"+key+"'" for key in ('queued','running','waiting_for_input')}
 counters['generic_retry_lifecycle']="kind not in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null and coalesce((error->>'retryable')::boolean,false)and coalesce((stage_attempts->>stage)::integer,0)<3"
 counters['presentation_retry_lifecycle']="kind in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null and error->>'code'is distinct from'JOB_CANCELLED'"
 lifecycle=','.join("'"+key+"',(select count(*)from eps.jobs where id<>'"+PROTECTED+"'and "+predicate+')' for key,predicate in counters.items())
 for key,status in [('pending_outbox','pending'),('leased_outbox','leased')]:lifecycle+=",'"+key+"',(select count(*)from eps.outbox_events where status='"+status+"')"
 projection="jsonb_build_object('history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),'gates',jsonb_build_object("+gates+"),'native_image_id',(select native_image_id from eps.frame_extraction_config),'english_transcript_version',(select english_transcript_version from eps.candidate_asset_config),'lifecycle',jsonb_build_object("+lifecycle+'))'
 return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='20s';select jsonb_build_object('database',current_database(),'operator',current_user,'session_user',session_user,'projection',"+projection+")as review_link_reason_preflight;rollback;"

def main():
 spec=importlib.util.spec_from_file_location('review_link_reason_preflight_own_purpose',Path(__file__).resolve().parent/'release.py');release=importlib.util.module_from_spec(spec);spec.loader.exec_module(release)
 need(release.RELEASE_ENABLED and len(sys.argv)==4)
 run,commit,manifest=sys.argv[1:]
 need(str(uuid.UUID(run))==run and re.fullmatch('[a-f0-9]{40}',commit) and re.fullmatch('[a-f0-9]{64}',manifest))
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 need(not any(os.environ.get(key)for key in ('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
 operator=release.Operator(run);need(ROOT.resolve()==operator.root);plan=operator.read(operator.plan);operator.verify(plan);operator.built(plan);need(plan['gates']['source_commit']==commit and plan['gates']['source_sha256']==manifest)
 canonical=plan['gates']['canonical'];need(canonical['key'] in ('schema40','schema41'));ref=canonical['ref'];checkpoint=canonical['checkpoint'];expected=canonical['history']
 need(digest(ROOT/ref['path'])==ref['sha256'] and digest(ROOT/checkpoint['path'])==checkpoint['sha256'])
 need(digest(READER)==READER_SHA)
 spec=importlib.util.spec_from_file_location('review_link_reason_normal_bounded_sql_reader',READER);reader=importlib.util.module_from_spec(spec);spec.loader.exec_module(reader)
 sql=query_sql();need(sql.endswith('rollback;') and 'read only;'in sql)
 directory=operator.private/('canonical-preflight-'+str(uuid.uuid4()));directory.mkdir(parents=True,exist_ok=False)
 sqlfile=directory/'preflight.sql';sqlfile.write_text(sql,encoding='utf8')
 observations=[]
 for _ in range(2):
  args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(sqlfile),'--output-format','json','--workdir',str(ROOT)]
  code,timeout,overflow,stdout,_stderr=reader.bounded(args,reader.environment());need(code==0 and not timeout and not overflow)
  parsed=json.loads(stdout);rows=parsed if type(parsed)is list else parsed.get('rows')if type(parsed)is dict else None
  need(type(rows)is list and len(rows)==1 and set(rows[0])=={'review_link_reason_preflight'})
  value=rows[0]['review_link_reason_preflight'];need(set(value)=={'database','operator','session_user','projection'} and all(value[k]=='postgres'for k in ('database','operator','session_user')))
  value=value['projection'];need(set(value)=={'history','gates','native_image_id','english_transcript_version','lifecycle'})
  need(value['history']==expected and value['gates']==dict.fromkeys(['specs','candidates','support','frames','presentations'],True) and all(type(v)is bool for v in value['gates'].values()))
  need(value['native_image_id']==NATIVE and value['english_transcript_version']=='1.0')
  need(set(value['lifecycle'])=={'queued','running','waiting_for_input','generic_retry_lifecycle','presentation_retry_lifecycle','pending_outbox','leased_outbox'} and all(type(v)is int and v==0 for v in value['lifecycle'].values()))
  observations.append(value)
 need(observations[0]==observations[1])
 observed=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
 result={'schema_version':'1.0','purpose':'review_link_reason_web_canonical_preflight','result':'passed','run_id':run,'source_commit':commit,'source_manifest_sha256':manifest,'observed_at':observed,'target':TARGET,'canonical_receipt':ref,'recovery_checkpoint_sha256':checkpoint['sha256'],'first':observations[0],'second':observations[1],'two_independent_readbacks_equal':True,'cloud_mutations':False}
 out=ROOT/'tracking/evidence/m07/review-link-reason-web-release';out.mkdir(parents=True,exist_ok=True);file=out/(observed.replace(':','-')+'-'+run[:8]+'-canonical-preflight.json')
 with file.open('x',encoding='utf8')as handle:json.dump(result,handle,indent=2);handle.write('\n')
 print(json.dumps({'receipt':file.relative_to(ROOT).as_posix(),'sha256':digest(file),'result':'passed','read_only_queries':2}))

if __name__=='__main__':
 try:main()
 except Exception:print('REVIEW_LINK_REASON_CANONICAL_PREFLIGHT_UNCONFIRMED; private CLI diagnostics suppressed.',file=sys.stderr);sys.exit(1)
