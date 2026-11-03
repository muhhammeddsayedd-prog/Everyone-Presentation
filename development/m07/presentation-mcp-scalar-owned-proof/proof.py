"""Render only a synthetic owned rollback transaction; no database transport."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE=Path(__file__).resolve().parent
CANDIDATE=HERE.parent/'presentation-mcp-scalar-capability/candidate.py'
CANDIDATE_SHA='58f7764c9fbf783bd62a2b2fff8f3130894e0217e7306b241c3cf2fc3e5630ee'
RESOURCE='http://127.0.0.1:3000/mcp'


def sha(raw):return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:raise ValueError('MCP_SCALAR_OWNED_PROOF_SOURCE_UNCONFIRMED')


def candidate():
    info=CANDIDATE.lstat();need(CANDIDATE.is_file()and not CANDIDATE.is_symlink()and info.st_nlink==1 and sha(CANDIDATE.read_bytes())==CANDIDATE_SHA)
    spec=importlib.util.spec_from_file_location('scalar_owned_candidate',CANDIDATE);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


def literal(value):return "'"+value.replace("'","''")+"'"


def cases():
    base='pg_temp.scalar_base()'
    change=lambda key,value:'jsonb_set('+base+','+literal('{'+key+'}')+','+literal(json.dumps(value,separators=(',',':')))+'::jsonb)'
    rows=[('valid-workspaces',base,'workspaces.read','true'),('valid-settings',base,'settings.manage','true'),
          ('requested-uppercase',base,'WORKSPACES.READ','false'),('requested-leading-space',base,' workspaces.read','false'),
          ('requested-trailing-space',base,'workspaces.read ','false'),('requested-Unicode-lookalike',base,'workspaces.re\u0430d','false'),
          ('ungranted-delegated',base,'cast.read','false'),('valid-NULL',base,None,'null'),
          ('public-DTO-unchanged',base,None,'dto'),
          ('browser-bypass',base+"-'eps_delegation'-'client_id'-'session_id'",'settings.manage','true'),
          ('browser-NULL',base+"-'eps_delegation'-'client_id'-'session_id'",None,'true'),
          ('unrelated-oauth-bypass',"jsonb_set("+base+"-'eps_delegation','{client_id}',to_jsonb(pg_temp.scalar_uid('unregistered-client')::text))",'settings.manage','true'),
          ('registered-without-delegation',base+"-'eps_delegation'",'settings.manage','false'),
          ('missing-principal',base+"-'sub'",'settings.manage','false'),
          ('missing-session',base+"-'session_id'",'settings.manage','false'),
          ('malformed-session',change('session_id','malformed'),'settings.manage','false'),
          ('wrong-session-user',"jsonb_set("+base+",'{session_id}',to_jsonb(pg_temp.scalar_uid('other-session')::text))",'settings.manage','false'),
          ('missing-client',base+"-'client_id'",'settings.manage','false'),
          ('wrong-role',change('role','service_role'),'settings.manage','false'),
          ('missing-anonymous',base+"-'is_anonymous'",'settings.manage','false'),
          ('anonymous',change('is_anonymous',True),'settings.manage','false'),
          ('aud-array',change('aud',[RESOURCE]),'settings.manage','false'),
          ('foreign-aud',change('aud','https://foreign.invalid/mcp'),'settings.manage','false'),
          ('expiry-string',change('exp','4000000000'),'settings.manage','false'),
          ('expiry-past',change('exp',1),'settings.manage','false'),
          ('expiry-inactive-NULL',change('exp',1),None,'false'),
          ('iat-type',change('iat',True),'settings.manage','false'),
          ('future-iat',"jsonb_set("+base+",'{iat}',to_jsonb(floor(extract(epoch from clock_timestamp()))+1000))",'settings.manage','false'),
          ('nbf-type',change('nbf',True),'settings.manage','false'),
          ('future-nbf',"jsonb_set("+base+",'{nbf}',to_jsonb(floor(extract(epoch from clock_timestamp()))+1000))",'settings.manage','false'),
          ('missing-openid',change('scope','profile'),'settings.manage','false'),
          ('delegation-null',change('eps_delegation',None),'settings.manage','false'),
          ('delegation-extra-key',"jsonb_set("+base+",'{eps_delegation,extra}','true')",'settings.manage','false'),
          ('delegation-version',change('eps_delegation,v',2),'settings.manage','false'),
          ('delegation-resource',change('eps_delegation,resource','https://foreign.invalid/mcp'),'settings.manage','false'),
          ('delegation-client',change('eps_delegation,client_id','00000000-0000-4000-8000-000000000001'),'settings.manage','false'),
          ('capabilities-object',change('eps_delegation,capabilities',{}),'settings.manage','false'),
          ('capabilities-empty',change('eps_delegation,capabilities',[]),'settings.manage','false'),
          ('capabilities-over32',change('eps_delegation,capabilities',['workspaces.read']*33),'settings.manage','false'),
          ('capabilities-bad-item',change('eps_delegation,capabilities',['workspaces.read','settings.manage',42]),'settings.manage','false'),
          ('capabilities-unknown-item',change('eps_delegation,capabilities',['workspaces.read','settings.manage','service_role']),'settings.manage','false'),
          ('requested-outside-delegation',change('eps_delegation,capabilities',['workspaces.read']),'settings.manage','false')]
    return rows


def variant_sql(variant):
    lines=[]
    for name,claims,cap,wanted in cases():
        lines.append('select pg_temp.scalar_case('+','.join([literal(variant),literal(name),claims,'null'if cap is None else literal(cap),literal(wanted)])+');')
    # Authority changes are made only inside this rollback transaction.
    # Each following call is a new SQL statement, preserving STABLE semantics.
    mutations=[
        ('resource-disabled',"update eps.mcp_oauth_resources set enabled=false where resource="+literal(RESOURCE)+" and client_id=pg_temp.scalar_uid('client');",'false',"update eps.mcp_oauth_resources set enabled=true where resource="+literal(RESOURCE)+" and client_id=pg_temp.scalar_uid('client');"),
        ('session-expired',"update auth.sessions set not_after=clock_timestamp()-interval'1 second'where id=pg_temp.scalar_uid('session');",'false',"update auth.sessions set not_after=null where id=pg_temp.scalar_uid('session');"),
        ('session-wrong-client',"update auth.sessions set oauth_client_id=pg_temp.scalar_uid('wrong-client')where id=pg_temp.scalar_uid('session');",'false',"update auth.sessions set oauth_client_id=pg_temp.scalar_uid('client')where id=pg_temp.scalar_uid('session');"),
        ('session-no-openid',"update auth.sessions set scopes='profile'where id=pg_temp.scalar_uid('session');",'false',"update auth.sessions set scopes='openid profile'where id=pg_temp.scalar_uid('session');"),
        ('grant-inactive',"update public.app_capability_grants set active=false where principal_id=pg_temp.scalar_uid('actor')and capability='settings.manage';",'false',"update public.app_capability_grants set active=true where principal_id=pg_temp.scalar_uid('actor')and capability='settings.manage';"),
        ('grant-deleted',"delete from public.app_capability_grants where principal_id=pg_temp.scalar_uid('actor')and capability='settings.manage';",'false',"insert into public.app_capability_grants(principal_id,capability)values(pg_temp.scalar_uid('actor'),'settings.manage');"),
        ('session-deleted',"delete from auth.sessions where id=pg_temp.scalar_uid('session');",'false',"insert into auth.sessions(id,user_id,oauth_client_id,not_after,scopes)values(pg_temp.scalar_uid('session'),pg_temp.scalar_uid('actor'),pg_temp.scalar_uid('client'),null,'openid profile');")]
    for name,mutation,wanted,restore in mutations:
        lines.extend(['reset role;',mutation,'set local role authenticated;',
                      'select pg_temp.scalar_case('+','.join([literal(variant),literal(name),'pg_temp.scalar_base()',literal('settings.manage'),literal(wanted)])+');',
                      'reset role;',restore,'set local role authenticated;',
                      'select pg_temp.scalar_case('+','.join([literal(variant),literal(name+'-restored'),'pg_temp.scalar_base()',literal('settings.manage'),literal('true')])+');'])
    lines.extend(["reset role;do $timed$declare deadline numeric:=floor(extract(epoch from clock_timestamp()))+2;begin perform set_config('eps.scalar.deadline',deadline::text,true);perform set_config('eps.scalar.timed_claims',jsonb_set(pg_temp.scalar_base(),'{exp}',to_jsonb(deadline))::text,true);update auth.sessions set not_after=to_timestamp(deadline)where id=pg_temp.scalar_uid('session');end$timed$;",
                  'set local role authenticated;',
                  'select pg_temp.scalar_case('+','.join([literal(variant),literal('clock-before'),"current_setting('eps.scalar.timed_claims')::jsonb",literal('settings.manage'),literal('true')])+');',
                  "do $wait$declare deadline numeric:=current_setting('eps.scalar.deadline')::numeric;remaining double precision:=deadline-extract(epoch from clock_timestamp());begin perform pg_temp.scalar_assert(remaining<=2.1,'bounded DB clock wait');perform pg_sleep(greatest(0,remaining)+0.025);perform pg_temp.scalar_assert(extract(epoch from clock_timestamp())>deadline,'actual DB clock passed expiry');end$wait$;",
                  'select pg_temp.scalar_case('+','.join([literal(variant),literal('clock-after'),"current_setting('eps.scalar.timed_claims')::jsonb",literal('settings.manage'),literal('false')])+');',
                  "reset role;update auth.sessions set not_after=null where id=pg_temp.scalar_uid('session');set local role authenticated;",
                  'select pg_temp.scalar_case('+','.join([literal(variant),literal('native-invalid-principal'),'pg_temp.scalar_base()',literal('settings.manage'),literal('native22P02'),literal('invalid-principal')])+');',
                  'select pg_temp.scalar_case('+','.join([literal(variant),literal('native-invalid-claims'),'pg_temp.scalar_base()',literal('settings.manage'),literal('native22P02'),literal('invalid-claims')])+');',
                  'reset role;set local role anon;',
                  'select pg_temp.scalar_case('+','.join([literal(variant),literal('anon-execute-denied'),'pg_temp.scalar_base()',literal('settings.manage'),literal('native42501')])+');',
                  'reset role;'])
    return '\n'.join(lines)


def proof(run):
    need(str(uuid.UUID(run))==run and uuid.UUID(run).version==4)
    c=candidate();row=c.build();template=(HERE/'proof.sql').read_bytes().decode('utf8')
    values={'__RUN__':run,'__BEFORE_SHA__':row['before_body_sha256'],'__AFTER_SHA__':row['after_body_sha256'],
            '__VALIDATOR_SHA__':row['unchanged_public_validator_body_sha256'],
            '__BEFORE_DEFINITION__':"do $restore$declare original text;begin select definition into strict original from scalar_target_before;execute original;end$restore$;",
            '__AFTER_DEFINITION__':row['after'],'__RESTORED_SHA__':row['before_body_sha256'],'__OLD_CASES__':variant_sql('old'),'__NEW_CASES__':variant_sql('candidate')}
    for key,value in values.items():need(template.count(key)==1);template=template.replace(key,value,1)
    need(not re.search(r'__[A-Z_]+__',template.replace('__OWNED_SYSTEM__','').replace('__ORIGINAL_SYSTEM__','')))
    return template
