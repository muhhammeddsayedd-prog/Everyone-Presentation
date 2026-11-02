"""Explicit three-row synthetic clone qualification; no SQL executes here."""
from pathlib import Path
import hashlib,re
METADATA='12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
ROWS=[{'table':'eps.jobs','id':'eb636d22-f702-4463-9a4d-63307ae6a835','copy_sha256':'7bb0d1ebfa8680d1e28ff2aaf8d68fb380d2746e7fb5b7ef2b19cf7de5ceea39','old_status':'running','terminal_status':'cancelled','mutable_fields':['status','lease_token_digest','lease_expires_at']},
 {'table':'eps.outbox_events','id':'0f489b6b-911d-4bbe-8462-088896a31bcd','copy_sha256':'fbe853813633e003a979c089ad173428845a589dcbe91978cde1ac3f76a95e7d','old_status':'leased','terminal_status':'dead','mutable_fields':['status','lease_token_digest','lease_expires_at']},
 {'table':'eps.presentation_versions','id':'a5a0feec-b60e-46a0-82c1-ed380331b23a','copy_sha256':'bc990999ffdff03c65acfc57d238ae73aca292099b86e78261907b6c616fe72b','old_status':'rendering','terminal_status':'failed','mutable_fields':['status','failure_code','row_version','updated_at'],'trigger_only':True}]
def need(value):
 if not value:raise ValueError('WORKER39_SYNTHETIC_QUALIFICATION_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def literal(text):return"'"+text.replace("'","''")+"'"
def copy_expression(columns):
 values=[]
 for column in columns:
  need(re.fullmatch('[a-z_][a-z0-9_]*',column)is not None);value='t."'+column+'"::text'
  # COPY text uses the same PostgreSQL type output as ::text. These three rows
  # have no boolean/bytea/array columns; exact header/fingerprint is pinned.
  value="replace("+value+",chr(92),chr(92)||chr(92))"
  for code,label in[(8,'b'),(9,'t'),(10,'n'),(11,'v'),(12,'f'),(13,'r')]:value='replace('+value+',chr('+str(code)+'),chr(92)||'+literal(label)+')'
  values.append("coalesce("+value+",chr(92)||'N')")
 return "encode(sha256(convert_to(concat_ws(chr(9),"+','.join(values)+"),'UTF8')),'hex')"
def source_rows(metadata):
 need(sha(metadata)==METADATA);text=metadata.decode();result=[]
 for expected in ROWS:
  match=re.search(r'^COPY '+re.escape(expected['table'])+r' \(([^\n]+)\) FROM stdin;\n(.*?)\n\\\.',text,re.M|re.S);need(match is not None)
  columns=[name.strip(' "')for name in match[1].split(',')];lines=[line for line in match[2].splitlines()if line.split('\t')[0]==expected['id']];need(len(lines)==1 and sha(lines[0].encode())==expected['copy_sha256']);record=dict(zip(columns,lines[0].split('\t')))
  need(record['status']==expected['old_status'])
  if expected.get('trigger_only'):need(record['generation_job_id']==ROWS[0]['id']and record['row_version']=='2'and record['failure_code']=='\\N'and record['status']!='ready')
  else:need(len(record['lease_token_digest'])==64 and record['lease_expires_at']!='\\N')
  if expected['table']=='eps.outbox_events':need(record['job_id']==ROWS[0]['id'])
  result.append({**expected,'columns':columns,'fingerprint_sql':copy_expression(columns)})
 return result
def sql(metadata,lifecycle_sql,counters):
 records=source_rows(metadata);before={name:(1 if name in('running','leased_outbox')else 0)for name in counters};zero={name:0 for name in counters}
 import json
 jsonsql=lambda value:literal(json.dumps(value,sort_keys=True))+"::jsonb"
 text="set local timezone='UTC';set local datestyle='ISO,YMD';create table project39_proof.qualified_rows(table_name text not null,row_id uuid not null,original_row_hash text not null,invariant_row_hash text not null,prior_controls jsonb not null,primary key(table_name,row_id));\n"
 text+="do $fixture_zero$declare changed integer;begin if current_database()<>'project39'or(pg_control_system()).system_identifier::text is distinct from __WORKER39_OWNED_SYSTEM_SQL__ or current_setting('eps.worker39.run',true)is distinct from __WORKER39_OWNED_RUN_SQL__ or(select count(*)from supabase_migrations.schema_migrations)<>39 or("+lifecycle_sql+")is distinct from "+jsonsql(before)+" then raise exception'WORKER39_EXACT_SYNTHETIC_BUSY_COHORT_REQUIRED';end if;\n"
 for row in records:
  key=literal(row['id']);table=row['table'];finger=row['fingerprint_sql']
  text+="if(select count(*)from "+table+" t where t.id="+key+"::uuid and t.status="+literal(row['old_status'])+' and '+finger+'='+literal(row['copy_sha256'])+")<>1 then raise exception'WORKER39_SYNTHETIC_ROW_FINGERPRINT_REQUIRED';end if;\n"
  masked='(to_jsonb(t)-array['+','.join(literal(field)for field in row['mutable_fields'])+']::text[])'
  text+="insert into project39_proof.qualified_rows select "+literal(table)+",t.id,encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),encode(sha256(convert_to("+masked+"::text,'UTF8')),'hex'),jsonb_build_object('row_version',to_jsonb(t)->'row_version','updated_at',to_jsonb(t)->'updated_at')from "+table+" t where t.id="+key+"::uuid;\n"
 # Capture the linked version's complete preimage BEFORE the normal job trigger.
 for row in records:
  if row.get('trigger_only'):continue
  key=literal(row['id']);table=row['table']
  text+='update '+table+' set status='+literal(row['terminal_status'])+',lease_token_digest=null,lease_expires_at=null where id='+key+'::uuid;get diagnostics changed=row_count;'
  text+="if changed<>1 then raise exception'WORKER39_ONLY_ONE_SYNTHETIC_ROW_REQUIRED';end if;\n"
 for row in records:
  table=row['table'];masked='(to_jsonb(t)-array['+','.join(literal(field)for field in row['mutable_fields'])+']::text[])'
  conditions='t.status='+literal(row['terminal_status'])
  if row.get('trigger_only'):
   conditions+="and t.generation_job_id="+literal(ROWS[0]['id'])+"::uuid and t.failure_code='JOB_CANCELLED'and t.row_version=3 and t.row_version=(q.prior_controls->>'row_version')::bigint+1 and t.updated_at>(q.prior_controls->>'updated_at')::timestamptz"
  else:conditions+='and t.lease_token_digest is null and t.lease_expires_at is null'
  text+="if(select count(*)from "+table+" t join project39_proof.qualified_rows q on q.table_name="+literal(table)+" and q.row_id=t.id where t.id="+literal(row['id'])+'::uuid and '+conditions+" and encode(sha256(convert_to("+masked+"::text,'UTF8')),'hex')=q.invariant_row_hash)<>1 then raise exception'WORKER39_ONLY_DECLARED_FIXTURE_CONTROL_FIELDS_CHANGED';end if;\n"
 text+="if(select count(*)from project39_proof.qualified_rows)<>3 or("+lifecycle_sql+")is distinct from "+jsonsql(zero)+" then raise exception'WORKER39_GENUINE_ZERO_LIFECYCLE_REQUIRED';end if;end$fixture_zero$;\n"
 return text,[{key:value for key,value in row.items()if key not in('columns','fingerprint_sql')}for row in records]
