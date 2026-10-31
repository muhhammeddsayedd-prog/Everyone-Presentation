"""Compact full-state comparison SQL. Pure rendering; no execution or IO."""
import base64
import datetime
import json
import re
import uuid

VERSION='20261031010000'
ACK='functions|eps.specs_submit_ack(uuid,uuid,uuid)|source_sha256'
NEW='e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'
START="begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';"
TAIL=')as specs_ack31_state from flat;'

def need(value):
    if not value:raise ValueError('ACK31_COMPACT_SQL_UNCONFIRMED')

def cutoff_value(value):
    need(type(value)is str and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}\+00:00',value))
    need(datetime.datetime.fromisoformat(value).tzinfo==datetime.timezone.utc);return value

def normalized_hash(identifier):
    need(type(identifier)is str and re.fullmatch('[a-z_][a-z_0-9]*',identifier))
    value="jsonb_set("+identifier+",'{context,all_roles}',(select jsonb_agg(case when r->>'name'='cli_login_postgres' then jsonb_set(r,'{valid_until}','\"qualified_cli_login_expiry\"'::jsonb)else r end order by ordinal)from jsonb_array_elements("+identifier+"#>'{context,all_roles}')with ordinality e(r,ordinal)))"
    return "encode(sha256(convert_to(("+value+")::text,'UTF8')),'hex')"

def activity_expression(cutoff):
    cutoff_value(cutoff)
    return "jsonb_build_object('track_activities',current_setting('track_activities')::boolean,'unrestricted_visibility',(select rolsuper or pg_has_role(current_user,'pg_read_all_stats','USAGE')from pg_roles where rolname=current_user),'older_client_transactions',(select count(*)from pg_stat_activity where datname=current_database()and backend_type='client backend'and pid<>pg_backend_pid()and xact_start is not null and xact_start<='"+cutoff+"'::timestamptz))"

def query_body(query):
    need(type(query)is str and query.count(START)==1 and query.rstrip().endswith('rollback;')and query.count(TAIL)==1)
    return query.replace(START,'',1).rstrip().removesuffix('rollback;')

def read_query(query,cutoff):
    body=query_body(query);anchor="select jsonb_build_object('catalog'"
    need(body.count(anchor)==1);head,selected=body.split(anchor)
    selected=(anchor+selected).replace(TAIL,')as state from flat)')
    return START+head+",selected as("+selected+"select jsonb_build_object('state',state,'normalized_state_sha256',"+normalized_hash('state')+",'activity_fence',"+activity_expression(cutoff)+")as specs_ack31_envelope from selected;rollback;\n"

def capture(query):
    body=query_body(query);anchor='with nested as';need(body.count(anchor)==1)
    first,selected=body.split(anchor);selected=(anchor+selected).replace(TAIL,')into actual_state from flat;')
    return first+"do $ack31_capture$declare actual_state jsonb;begin\n"+selected+"\nperform set_config('eps.ack31.capture',actual_state::text,true);end$ack31_capture$;\n"

def fence(cutoff):
    return "do $ack31_fence$declare f jsonb:="+activity_expression(cutoff)+";begin if f->'track_activities'is distinct from'true'::jsonb or f->'unrestricted_visibility'is distinct from'true'::jsonb then raise exception'ACK31_MONITORING_REQUIRED';end if;if(f->>'older_client_transactions')::bigint<>0 then raise exception'ACK31_OLD_CLIENT_TRANSACTION_PRESENT';end if;end$ack31_fence$;\n"

QUALIFY="""
 if(select count(*)from jsonb_array_elements(actual#>'{context,all_roles}')r where r->>'name'='cli_login_postgres')<>1
 then raise exception'ACK31_EXACT_CLI_ROLE_IDENTITY_REQUIRED';end if;
 select r,ordinality::integer-1 into new_cli,position from jsonb_array_elements(actual#>'{context,all_roles}')with ordinality e(r,ordinality)where r->>'name'='cli_login_postgres';
 if old_cli-'valid_until'is distinct from new_cli-'valid_until'then raise exception'ACK31_EXISTING_ROLE_CHANGED';end if;
 if old_cli->'valid_until'is distinct from new_cli->'valid_until'then
  new_end:=(new_cli->>'valid_until')::timestamptz;old_end:=(old_cli->>'valid_until')::timestamptz;
  if new_end is null or new_end<clock_timestamp()or new_end>clock_timestamp()+interval'10 minutes'
  or(old_end is not null and new_end<old_end)then raise exception'ACK31_UNEXPECTED_LOGIN_EXPIRY_CHANGE';end if;
  actual:=jsonb_set(actual,array['context','all_roles',position::text,'valid_until'],old_cli->'valid_until');
 end if;
"""

def render(query,candidate,before,preflight_hash,marker,cutoff):
    need(type(marker)is str and str(uuid.UUID(marker))==marker);cutoff_value(cutoff)
    need(type(preflight_hash)is str and re.fullmatch('[a-f0-9]{64}',preflight_hash))
    tables=set(before['protected_data']['counts'])|{'eps.app_settings','eps.mcp_oauth_resources'}
    need(1<=len(tables)<=100 and all(type(name)is str and re.fullmatch(r'(?:eps|public|storage)\.[a-z_][a-z_0-9]*',name)for name in tables))
    roles=[r for r in before['context']['all_roles']if r['name']=='cli_login_postgres'];need(len(roles)==1)
    encoded=base64.b64encode(json.dumps(roles[0],separators=(',',':')).encode()).decode();need(len(encoded)<4096)
    locks=', '.join('"'+name.replace('.','"."')+'"'for name in sorted(tables))
    header="/* eps-ack31-continuation:"+marker+" */\nbegin isolation level repeatable read;\nset local application_name='eps-ack31c-"+marker+"';\nset local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';\nlock table supabase_migrations.schema_migrations in share row exclusive mode;\nlock table "+locks+" in share mode;\n"
    before_check="""do $ack31_before$
declare actual jsonb:=current_setting('eps.ack31.capture')::jsonb;
 old_cli jsonb:=convert_from(decode('"""+encoded+"""','base64'),'UTF8')::jsonb;
 new_cli jsonb;position integer;old_end timestamptz;new_end timestamptz;
begin
"""+QUALIFY+"""
 if """+normalized_hash('actual')+""" is distinct from '"""+preflight_hash+"""'then raise exception'ACK31_FULL_SELECTED_STATE_CHANGED';end if;
 perform set_config('eps.ack31.before',current_setting('eps.ack31.capture'),true);
end$ack31_before$;
"""
    after_check="""do $ack31_after$
declare actual jsonb:=current_setting('eps.ack31.capture')::jsonb;
 expected jsonb:=current_setting('eps.ack31.before')::jsonb;
 old_cli jsonb;new_cli jsonb;position integer;old_end timestamptz;new_end timestamptz;
begin
 expected:=jsonb_set(expected,array['catalog','"""+ACK+"""'],to_jsonb('"""+NEW+"""'::text));
 expected:=jsonb_set(expected,'{context,migration_versions}',(expected#>'{context,migration_versions}')||jsonb_build_array('"""+VERSION+"""'));
 expected:=jsonb_set(expected,'{protected_data,versions}',(expected#>'{protected_data,versions}')||jsonb_build_array('"""+VERSION+"""'));
 select r into old_cli from jsonb_array_elements(expected#>'{context,all_roles}')r where r->>'name'='cli_login_postgres';
"""+QUALIFY+"""
 if actual is distinct from expected then raise exception'ACK31_FULL_SELECTED_STATE_CHANGED';end if;
end$ack31_after$;
"""
    value=header+fence(cutoff)+capture(query)+before_check+candidate+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_specs_submit_ack_projection');\n"+capture(query)+after_check+fence(cutoff)+"commit;\nselect jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','ack_body_sha256','"+NEW+"')as specs_ack31_commit;\n"
    need(len(value.encode())<64000);return value
