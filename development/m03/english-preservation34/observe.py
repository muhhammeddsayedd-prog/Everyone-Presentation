"""Exact-target read-only old Ready/Reviewed baseline and subset preservation.

Only identifiers and whole-row/schema/function digests cross the SQL boundary.
Private baseline has no transcripts, snapshots, manifests, facts or object keys.
Public receipts contain counts and fixed checks. Importing performs no SQL.
"""
from pathlib import Path
import copy, datetime, hashlib, importlib.util, json, os, re, sys, uuid

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[2]
PRIVATE=ROOT/'.local/m03-english-component/preservation34'
PREFLIGHT=ROOT/'tracking/evidence/m03/english-release34/2026-10-31T16-47-24-856753Z-preflight.json'
PREFLIGHT_SHA='e050a4d904c33dfd9afff7f6a0b9bfa8b05ad780eba9f8dd04071881062a946e'
LOOKUP=ROOT/'development/m03/english-component/lookup.py'
LOOKUP_SHA='8ee70156cd9ecdd642813b7f2c08f6350fb27d20b6ed00e34eea79d965ba92e6'
PATCHES=ROOT/'development/m03/english-transcript34/port-patches.json'
PATCHES_SHA='12a675415e0970825903de616dae271911da6f01edd13d9dee62e0befecf813e'
TARGET='pyibofyctwnqpvktepse'; VERSION='20261031143711'
REVIEWED_CANDIDATE='25a3c924-7b6c-48e3-88ce-c72e72b99c6d'
REVIEWED_MEDIA='f5dff77f-092f-4777-9f56-3bbce4dee57c'
UUID=re.compile(r'^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$'); DIGEST=re.compile(r'^[a-f0-9]{64}$')
GROUPS=('versions','slides','asset_pins','raw_companions','ready_exports','media_assets','reviewed_candidates','reviewed_media','reviewed_frames')
EXACT_OLD_VERSION_GROUPS=('slides','asset_pins','raw_companions')
ENGLISH_MEDIA=['english_transcript','english_transcript_status','english_transcript_source_sha256','english_transcript_input_hash','english_transcript_metadata']
SECURITY_PINS={'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_logo.py':'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4'}
TABLES={'presentation_versions':['english_transcript_version'],'version_slides':[],'presentation_version_assets':[],
 'presentation_video_transcripts':[],'presentation_exports':[],'media_assets':[],'candidates':[],'candidate_media':ENGLISH_MEDIA,'candidate_media_frames':[]}

def need(value):
 if not value:raise ValueError('ENGLISH34_PRESERVATION_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def literal(value):return "'"+value.replace("'","''")+"'"
def source_pins():
 for file,digest in[(PREFLIGHT,PREFLIGHT_SHA),(LOOKUP,LOOKUP_SHA),(PATCHES,PATCHES_SHA)]:need(sha(file.read_bytes())==digest)
 for file,digest in SECURITY_PINS.items():need(sha((ROOT/file).read_bytes())==digest)
 return {**SECURITY_PINS,**{p.relative_to(ROOT).as_posix():sha(p.read_bytes())for p in[Path(__file__),HERE/'test_observe.py',HERE/'README.md',PREFLIGHT,LOOKUP,PATCHES]}}
def security():
 for file,digest in SECURITY_PINS.items():need(sha((ROOT/file).read_bytes())==digest)
 prior=list(sys.path)
 try:
  sys.path.insert(0,str(ROOT/'tools'));spec=importlib.util.spec_from_file_location('preservation_windows_files',ROOT/'tools/provision_logo_verifier.py');value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value)
 finally:sys.path[:]=prior
 return value.WindowsPrivateFiles()
def protected_write(guard,path,value):
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(value);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def preflight():
 need(sha(PREFLIGHT.read_bytes())==PREFLIGHT_SHA)
 value=json.loads(PREFLIGHT.read_text(encoding='utf8'));need(value['result']=='passed'and value['target']==TARGET and value['action']=='preflight')
 before=value['before'];need(before['database']=='postgres'and before['operator']=='postgres'and len(before['history'])==33 and before['english']['config_column']is False)
 return before
def module():
 need(sha(LOOKUP.read_bytes())==LOOKUP_SHA)
 spec=importlib.util.spec_from_file_location('preservation_bounded_cli',LOOKUP);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def digest_sql(value):return "encode(sha256(convert_to(("+value+")::text,'UTF8')),'hex')"
def rows_sql(query):return "coalesce((select jsonb_agg(q.row order by q.key collate \"C\")from("+query+")q),'[]'::jsonb)"
def group_query(table,alias,where,key,version='null',removed=None):
 body='to_jsonb('+alias+')'
 if removed:body+=' - array['+','.join(literal(k)for k in removed)+']::text[]'
 return "select "+key+" as key,jsonb_build_object('key',"+key+",'version_id',"+version+",'sha256',"+digest_sql(body)+")as row from eps."+table+' '+alias+' where '+where

def observation_sql(after):
 before=preflight(); ports=[]
 for signature in before['ports']:
  need(re.fullmatch(r'(?:eps|public)\.[a-z_]+\([a-z., ]*\)',signature))
  ports.extend([literal(signature),"(select jsonb_build_object('source_sha256',"+digest_sql("replace(p.prosrc,E'\\r\\n',E'\\n')")+",'attributes_sha256',"+digest_sql("to_jsonb(p)-'prosrc'")+")from pg_proc p where p.oid="+literal(signature)+'::regprocedure)'])
 schema=[]
 for table,removed in TABLES.items():
  removed_sql="and a.attname<>all(array["+','.join(literal(k)for k in removed)+']::text[])'if removed else''
  value="(select jsonb_build_object('rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(select jsonb_agg(jsonb_build_object('name',a.attname,'type',a.atttypid::regtype::text,'typmod',a.atttypmod,'notnull',a.attnotnull,'generated',a.attgenerated,'identity',a.attidentity,'acl',a.attacl)order by a.attnum)from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped "+removed_sql+"))from pg_class c where c.oid='eps."+table+"'::regclass)"
  schema.extend([literal(table),digest_sql(value)])
 old="(select id from ready)";where='v.status=\'ready\''
 groups={
  'versions':group_query('presentation_versions','v',where,'v.id::text','v.id',['english_transcript_version']),
  'slides':group_query('version_slides','s','s.version_id in'+old,'s.id::text','s.version_id'),
  'asset_pins':group_query('presentation_version_assets','a','a.version_id in'+old,"a.version_id::text||':'||a.asset_id::text",'a.version_id'),
  'raw_companions':group_query('presentation_video_transcripts','t','t.version_id in'+old,"t.version_id::text||':'||t.video_asset_id::text",'t.version_id'),
  'ready_exports':group_query('presentation_exports','e',"e.version_id in"+old+"and e.status='ready'",'e.id::text','e.version_id'),
  'media_assets':group_query('media_assets','a','a.id in(select id from assets)','a.id::text'),
  'reviewed_candidates':group_query('candidates','c',"c.id='"+REVIEWED_CANDIDATE+"'",'c.id::text'),
  'reviewed_media':group_query('candidate_media','m',"m.id='"+REVIEWED_MEDIA+"'and m.candidate_id='"+REVIEWED_CANDIDATE+"'",'m.id::text',removed=ENGLISH_MEDIA),
  'reviewed_frames':group_query('candidate_media_frames','f',"f.candidate_media_id='"+REVIEWED_MEDIA+"'","f.candidate_media_id::text||':'||f.asset_id::text"),
 }
 english="coalesce((select jsonb_agg(distinct version_id::text order by version_id::text)from eps.presentation_video_english_transcripts),'[]'::jsonb)"if after else"'[]'::jsonb"
 return "begin read only;\nset local search_path='';set local statement_timeout='12s';\nwith ready as(select id from eps.presentation_versions where status='ready'),assets as(\n"+\
  "select asset_id as id from eps.presentation_version_assets where version_id in(select id from ready)union select pdf_asset_id from eps.presentation_exports where version_id in(select id from ready)and status='ready'union select source_asset_id from eps.candidate_media where id='"+REVIEWED_MEDIA+"'union select transcript_asset_id from eps.candidate_media where id='"+REVIEWED_MEDIA+"'union select preview_asset_id from eps.candidate_media where id='"+REVIEWED_MEDIA+"'union select asset_id from eps.candidate_media_frames where candidate_media_id='"+REVIEWED_MEDIA+"')\n"+\
  "select jsonb_build_object('database',current_database(),'operator',current_user,'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),\n"+\
  "'legacy_column_rls_hashes',jsonb_build_object("+','.join(schema)+"),'ports',jsonb_build_object("+','.join(ports)+"),'groups',jsonb_build_object("+','.join(literal(k)+','+rows_sql(v)for k,v in groups.items())+"),\n"+\
  "'reviewed_effective',(select eps.cast_is_reviewed(c)from eps.candidates c where c.id='"+REVIEWED_CANDIDATE+"'),\n"+\
  "'english_versioned_ready_ids',coalesce((select jsonb_agg(id::text order by id::text)from eps.presentation_versions v where status='ready'and to_jsonb(v)->>'english_transcript_version'is not null),'[]'::jsonb),\n"+\
  "'english_companion_version_ids',"+english+")as preservation_observation;\nrollback;\n"

def parsed(payload,after):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None;need(type(rows)is list and len(rows)==1);exact(rows[0],['preservation_observation'])
 value=rows[0]['preservation_observation'];exact(value,['database','operator','history','legacy_column_rls_hashes','ports','groups','reviewed_effective','english_versioned_ready_ids','english_companion_version_ids'])
 before=preflight();need(value['database']=='postgres'and value['operator']=='postgres'and value['history']==before['history']+([VERSION]if after else[]))
 patches=json.loads(PATCHES.read_text())['ports'];expected=copy.deepcopy(before['ports'])
 if after:
  for item in patches:expected[item['signature']]['source_sha256']=item['after_sha256']
 need(value['ports']==expected);exact(value['legacy_column_rls_hashes'],TABLES)
 need(all(type(v)is str and DIGEST.fullmatch(v)for v in value['legacy_column_rls_hashes'].values()))
 exact(value['groups'],GROUPS)
 for name,group in value['groups'].items():
  need(type(group)is list and len(group)<=100000);keys=set()
  for row in group:
   exact(row,['key','version_id','sha256']);need(type(row['key'])is str and all(UUID.fullmatch(v)for v in row['key'].split(':'))and len(row['key'].split(':'))in(1,2))
   need(row['key']not in keys and type(row['sha256'])is str and DIGEST.fullmatch(row['sha256']));keys.add(row['key'])
   need(row['version_id']is None or type(row['version_id'])is str and UUID.fullmatch(row['version_id']))
 need(bool(value['groups']['versions'])and len(value['groups']['reviewed_candidates'])==1 and len(value['groups']['reviewed_media'])==1 and value['reviewed_effective']is True)
 need(value['groups']['reviewed_candidates'][0]['key']==REVIEWED_CANDIDATE and value['groups']['reviewed_media'][0]['key']==REVIEWED_MEDIA)
 for key in['english_versioned_ready_ids','english_companion_version_ids']:
  need(type(value[key])is list and all(type(v)is str and UUID.fullmatch(v)for v in value[key])and len(set(value[key]))==len(value[key]))
 if not after:need(value['english_versioned_ready_ids']==[]and value['english_companion_version_ids']==[])
 return value

def compare(before,after):
 need(before['legacy_column_rls_hashes']==after['legacy_column_rls_hashes'])
 old_versions={row['key']for row in before['groups']['versions']};checked={};added={}
 for name in GROUPS:
  initial={row['key']:row for row in before['groups'][name]};current={row['key']:row for row in after['groups'][name]}
  need(all(key in current and current[key]==row for key,row in initial.items()))
  if name in EXACT_OLD_VERSION_GROUPS:need({key:row for key,row in current.items()if row['version_id']in old_versions}==initial)
  checked[name]=len(initial);added[name]=len(set(current)-set(initial))
 need(not old_versions.intersection(after['english_versioned_ready_ids'])and not old_versions.intersection(after['english_companion_version_ids']))
 need(after['reviewed_effective']is True)
 return {'old_cohort_rows_unchanged':True,'no_old_companion_or_slide_asset_backfill':True,'legacy_column_rls_metadata_unchanged':True,'reviewed_state_preserved':True,'checked_counts':checked,'new_rows_allowed_counts':added}

def main():
 need(len(sys.argv)==2 and sys.argv[1]in('baseline','compare'));action=sys.argv[1];pins=source_pins();client=module();guard=security()
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 parent=PRIVATE.parent;need(parent.is_dir()and parent.resolve()==parent and not parent.is_symlink());PRIVATE.mkdir(exist_ok=True);need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink())
 baseline=PRIVATE/'baseline.json'
 if action=='compare':
  need(baseline.is_file()and not baseline.is_symlink());guard.verify(baseline)
  with baseline.open('rb')as stream:guard.verify_open(stream);before_document=json.loads(stream.read());guard.verify_open(stream)
  need(before_document['source_pins']==pins)
 else:need(not baseline.exists())
 sql=observation_sql(action=='compare').encode('utf8');need(sql.startswith(b'begin read only;')and sql.rstrip().endswith(b'rollback;'))
 need(not re.search(rb'(?im)^\s*(?:commit|insert|update|delete|create|alter|drop|grant|revoke)\b',sql))
 run=str(uuid.uuid4());observed=datetime.datetime.now(datetime.timezone.utc).isoformat()
 protected_write(guard,PRIVATE/(action+'.claim.json'),json.dumps({'run_id':run,'observed_at':observed,'target':TARGET,'sql_sha256':sha(sql),'source_pins':pins,'automatic_retry':False}).encode('utf8'))
 snapshot=PRIVATE/(run+'.sql')
 protected_write(guard,snapshot,sql)
 client.snapshot_ok(snapshot,sha(sql));command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(snapshot),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,_stderr=client.bounded(command);client.snapshot_ok(snapshot,sha(sql))
 receipt={'evidence_kind':'actual_old_ready_and_reviewed_read_only_'+action,'observed_at':observed,'target':TARGET,'action':action,'run_id':run,'result':'unconfirmed','read_only_rollback':True,'automatic_retry':False,'raw_cli_persisted':False,'private_payload_or_personal_fact_values_or_scalar_fact_hashes_captured':False,'provider_or_media_fetch_performed':False,'source_pins':pins,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow}
 try:
  need(code==0 and not timeout and not overflow);value=parsed(json.loads(stdout),action=='compare')
  if action=='baseline':
   protected_write(guard,baseline,json.dumps({'source_pins':pins,'observed_at':observed,'observation':value},sort_keys=True).encode('utf8'))
   receipt['baseline_counts']={k:len(v)for k,v in value['groups'].items()};receipt['private_baseline_sha256']=sha(baseline.read_bytes())
  else:receipt['checks']=compare(before_document['observation'],value);receipt['new_version_or_app_flow_acceptance']=False
  receipt['result']='passed'
 except Exception:receipt['safe_error_code']='ENGLISH34_PRESERVATION_UNCONFIRMED'
 out=ROOT/'tracking/evidence/m03/english-preservation34';out.mkdir(parents=True,exist_ok=True);file=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+run+'-'+action+'.json')
 with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':receipt['result'],'receipt':file.relative_to(ROOT).as_posix(),'read_only':True,'provider_or_media_fetch_performed':False}));need(receipt['result']=='passed')

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_PRESERVATION_UNCONFIRMED');sys.exit(1)
