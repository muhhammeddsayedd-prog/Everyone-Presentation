"""Pure fixed-source transaction renderer. No execution or credential access."""
import base64
import json
import re
import uuid

VERSION='20261031010000'
ACK='functions|eps.specs_submit_ack(uuid,uuid,uuid)|source_sha256'
NEW='e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'


def need(value):
    if not value:raise ValueError('ACK31_SQL_RENDER_UNCONFIRMED')


def capture(query):
    start="begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='45s';"
    need(query.count(start)==1 and query.rstrip().endswith('rollback;'))
    body=query.replace(start,'',1).rstrip().removesuffix('rollback;')
    marker='with nested as';tail=')as specs_ack31_state from flat;'
    need(body.count(marker)==1 and body.count(tail)==1)
    before,selected=body.split(marker)
    selected=(marker+selected).replace(tail,')into actual_state from flat;')
    return before+"do $ack31_capture$declare actual_state jsonb;begin\n"+selected+"\nperform set_config('eps.ack31.capture',actual_state::text,true);end$ack31_capture$;\n"


def compare_block(before,after=False):
    encoded=base64.b64encode(json.dumps(before,separators=(',',':')).encode()).decode()
    changes="" if not after else """
 expected:=jsonb_set(expected,array['catalog','"""+ACK+"""'],to_jsonb('"""+NEW+"""'::text));
 expected:=jsonb_set(expected,'{context,migration_versions}',(expected#>'{context,migration_versions}')||jsonb_build_array('"""+VERSION+"""'));
 expected:=jsonb_set(expected,'{protected_data,versions}',(expected#>'{protected_data,versions}')||jsonb_build_array('"""+VERSION+"""'));
"""
    return """do $ack31_compare$
declare actual jsonb:=current_setting('eps.ack31.capture')::jsonb;
 expected jsonb:=convert_from(decode('"""+encoded+"""','base64'),'UTF8')::jsonb;
 old_cli jsonb;new_cli jsonb;position integer;old_end timestamptz;new_end timestamptz;
begin
"""+changes+"""
 if(select count(*)from jsonb_array_elements(expected#>'{context,all_roles}')r where r->>'name'='cli_login_postgres')<>1
 or(select count(*)from jsonb_array_elements(actual#>'{context,all_roles}')r where r->>'name'='cli_login_postgres')<>1
 then raise exception'ACK31_EXACT_CLI_ROLE_IDENTITY_REQUIRED';end if;
 select r into old_cli from jsonb_array_elements(expected#>'{context,all_roles}')r where r->>'name'='cli_login_postgres';
 select r,ordinality::integer-1 into new_cli,position from jsonb_array_elements(actual#>'{context,all_roles}')with ordinality e(r,ordinality)where r->>'name'='cli_login_postgres';
 if old_cli-'valid_until'is distinct from new_cli-'valid_until'then raise exception'ACK31_EXISTING_ROLE_CHANGED';end if;
 if old_cli->'valid_until'is distinct from new_cli->'valid_until'then
  new_end:=(new_cli->>'valid_until')::timestamptz;old_end:=(old_cli->>'valid_until')::timestamptz;
  if new_end is null or new_end<clock_timestamp()or new_end>clock_timestamp()+interval'10 minutes'
  or(old_end is not null and new_end<old_end)then raise exception'ACK31_UNEXPECTED_LOGIN_EXPIRY_CHANGE';end if;
  actual:=jsonb_set(actual,array['context','all_roles',position::text,'valid_until'],old_cli->'valid_until');
 end if;
 if actual is distinct from expected then raise exception'ACK31_FULL_SELECTED_STATE_CHANGED';end if;
end$ack31_compare$;
"""


def render(query,candidate,before,marker):
    need(type(marker)is str and str(uuid.UUID(marker))==marker)
    tables=set(before['protected_data']['counts'])|{'eps.app_settings','eps.mcp_oauth_resources'}
    need(1<=len(tables)<=100 and all(type(name)is str and re.fullmatch(r'(?:eps|public|storage)\.[a-z_][a-z_0-9]*',name)for name in tables))
    locks=', '.join('"'+name.replace('.','"."')+'"'for name in sorted(tables))
    return """begin isolation level repeatable read;
set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';
lock table supabase_migrations.schema_migrations in share row exclusive mode;
lock table """+locks+""" in share mode;
"""+capture(query)+compare_block(before)+candidate+"""
insert into supabase_migrations.schema_migrations(version,statements,name)
values('"""+VERSION+"""',array[]::text[],'m07_specs_submit_ack_projection');
"""+capture(query)+compare_block(before,True)+"""
commit;
select jsonb_build_object('version','"""+VERSION+"""','marker','"""+marker+"""','ack_body_sha256','"""+NEW+"""')as specs_ack31_commit;
"""
