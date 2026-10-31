"""Pure canonical31 admission, preservation and once-only state machine."""
import copy
import datetime
import hashlib
import json
import re

VERSION='20261031010000'
ACK='functions|eps.specs_submit_ack(uuid,uuid,uuid)|source_sha256'
OLD='3a164335af33462b20dff3e1dffdcd26bec1c57d39e9028ef999adbf29eb89a4'
NEW='e0a7c7be311e6b2139faf08238121f4687d379844a26dd602ff8331b54231481'
HOOK='b6e422c7df5cb146e9d0c0aaaad6dfa7fc5373a36179d82284438cf599fd218c'
NATIVE='sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06'
ORIGIN='https://everyone-presentation-pilot.vercel.app'
RUNTIME=['eps.claim_job_outbox(integer)','eps.claim_job_stage_replay(jsonb,text,text,text)','eps.claim_job_stage(jsonb)',
 'eps.complete_job_output(jsonb)','eps.finish_job_outbox(uuid,text,boolean)','eps.get_job_asset_access(jsonb)',
 'eps.get_specs_stage_input(uuid,uuid,text)','eps.mint_review_media_grant(jsonb)','eps.record_job_event(jsonb)',
 'eps.recover_job_stages(integer)','eps.reserve_job_output(jsonb)','eps.store_specs_preparation(jsonb)']
FLAGS=('login','super','inherit','bypassrls','create_role','create_db','replication')


def need(value):
    if not value:raise ValueError('ACK31_CANONICAL_UNCONFIRMED')


def exact(value,keys):need(type(value)is dict and set(value)==set(keys))
def canonical(value):return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def timestamp(value):
    try:result=datetime.datetime.fromisoformat(value)if type(value)is str else value
    except ValueError:result=None
    need(isinstance(result,datetime.datetime)and result.tzinfo is not None and result.utcoffset()is not None);return result


def shape(state):
    exact(state,('catalog','context','admission','protected_data'));need(all(type(v)is dict for v in state.values()))
    context=state['context'];exact(context,('database','operator','unrestricted_visibility','migration_versions','issuer_role_exists','issuer_function_count','issuer_policy_count','all_roles','all_memberships','settings','registry_count','effective_privileges'))
    exact(state['admission'],('query_role','database','unrestricted_visibility','runtime','protected_m02','active_jobs','leased_outbox','frame_native_image_id','application_origin','settings_row_sha256'))
    exact(state['protected_data'],('counts','hashes','managed_auth','versions'))
    need(type(context['all_roles'])is list and 1<=len(context['all_roles'])<=256 and type(context['all_memberships'])is list)
    seen=set();oids=set()
    for role in context['all_roles']:
        exact(role,('name','oid',*FLAGS,'connection_limit','valid_until'))
        need(type(role['name'])is str and role['name']not in seen and str(role['oid']).isdigit()and 0<int(role['oid'])<=4294967295 and int(role['oid'])not in oids)
        need(all(type(role[k])is bool for k in FLAGS)and type(role['connection_limit'])is int)
        seen.add(role['name']);oids.add(int(role['oid']))
    need(len(state['catalog'])<=40000 and all(type(k)is str and 1<=len(k)<=4096 for k in state['catalog']))
    return state


def validate_local_proof(value,pins):
    need(type(value)is dict and value.get('schema_version')=='1.0'and value.get('result')=='passed'and value.get('checkpoint')=='complete')
    need(value.get('planned_canonical_migration')=='supabase/migrations/20261031010000_m07_specs_submit_ack_projection.sql'
      and value.get('unconfirmed_child_processes')==[])
    readback=value.get('owned31_ack_readback');need(type(readback)is dict and readback.get('body_sha256')==NEW)
    need(all(readback.get(k)is True for k in('private_invoker','whole_job_select_still_denied','public_callers_denied','existing_projection_columns_granted')))
    for key in('cloud_called','provider_called','original_database_writes','existing_role_ddl','historical_controllers_invoked','command_process_unconfirmed','automatic_retry'):
        need(value.get(key)is False)
    for key in('private_acl_verified','local31_only','sources_stable','clone29_full_catalogue_data_exact','only_ack_source_and_history_changed','all_fixture_writes_rolled_back',
               'after_ddl_rollback_exact','after_history_rollback_exact','issuer30_surface_restored_except_exact_ack31_and_history',
               'actual_owned_database_absent','actual_new_role_absent','original29_full_catalogue_data_settings_roles_oids_memberships_exact','shared_lock_released'):
        need(value.get(key)is True)
    need(value.get('source_seals')is not None and all(value['source_seals'].get(path)==sha for path,sha in pins.items()))
    for phase in('red','green'):
        proof=value.get(phase);exact(proof,('phase','expected_failure_observed','sqlstate','permission_object','checks'))
        need(proof['phase']==phase and proof['expected_failure_observed']is(phase=='red'))
        need(proof['sqlstate']==('42501'if phase=='red'else None)and proof['permission_object']==('jobs'if phase=='red'else None))
        exact(proof['checks'],('ack','idempotency','stale','denial','invalid_relations'))
        need(all(flag is(phase=='green')for flag in proof['checks'].values()))


def validate_before(state,versions,trust):
    shape(state);c=state['context'];a=state['admission'];catalog=state['catalog']
    need(c['database']==c['operator']==a['database']==a['query_role']=='postgres'and c['unrestricted_visibility']is True and a['unrestricted_visibility']is True)
    need(c['migration_versions']==list(versions)and state['protected_data']['versions']==list(versions))
    need(c['issuer_role_exists']is True and c['issuer_function_count']==1 and c['issuer_policy_count']==2 and c['registry_count']==0)
    need(a['active_jobs']==a['leased_outbox']==0 and type(a['active_jobs'])is int and type(a['leased_outbox'])is int)
    need(a['frame_native_image_id']==NATIVE and a['application_origin']==ORIGIN and re.fullmatch('[a-f0-9]{64}',a['settings_row_sha256']))
    need(a['protected_m02']=={'exists':True,'manual_note_retained':True})
    r=a['runtime'];need(type(r)is dict and r.get('name')=='eps_specs_runtime'and r.get('execute')==RUNTIME and r.get('login')is True and r.get('inherit')is False)
    need(r.get('connection_limit')==4 and all(r.get(k)is False for k in('superuser','bypass_rls','create_db','create_role','replication')))
    need(r.get('parents')==[{'name':name,'admin':False,'inherit':True,'set':False}for name in('eps_jobs_dispatcher','eps_jobs_executor','eps_specs_assets_executor')])
    need(timestamp(r.get('valid_until'))>datetime.datetime.now(datetime.timezone.utc))
    need(len(trust['functions'])==49)
    for entry in trust['functions']:
        matches=[key for key in catalog if key.startswith('functions|'+entry['name']+'(')and key.endswith('|source_sha256')]
        need(len(matches)==1);prefix=matches[0].removesuffix('source_sha256')
        need(catalog[matches[0]]==entry['sha256'])
        for key,expected in [('language',entry['language']),('definer',entry['security_definer']),('volatility',entry['volatility']),('config',['search_path=""'])]:need(catalog[prefix+key]==expected)
    prefix='functions|eps.specs_submit_ack(uuid,uuid,uuid)|'
    need(catalog[ACK]==OLD and catalog[prefix+'owner']=='eps_specs_submit_owner'and catalog[prefix+'acl']=='{eps_specs_submit_owner=X/eps_specs_submit_owner}')
    for key,value in [('returns','jsonb'),('identity_arguments','p_job uuid, p_spec uuid, p_workspace uuid'),('argument_defaults',None),
                      ('strict',False),('parallel','u'),('leakproof',False),('kind','f'),('support',None)]:need(catalog[prefix+key]==value)
    hook='eps.mcp_custom_access_token_hook(jsonb)';prefix='functions|'+hook+'|'
    need(catalog[prefix+'source_sha256']==HOOK and catalog[prefix+'owner']=='eps_mcp_issuer_owner'and catalog[prefix+'definer']is True
      and catalog[prefix+'acl']=='{eps_mcp_issuer_owner=X/eps_mcp_issuer_owner,supabase_auth_admin=X/eps_mcp_issuer_owner}')
    need(c['effective_privileges']['supabase_auth_admin']['functions'][hook]=={'execute':True,'schema_usage':True})
    need(all(c['effective_privileges'][role]['functions'][hook]['execute']is False for role in('anon','authenticated','service_role')))
    return state


def normalize_expiry(before,after,observed):
    result=copy.deepcopy(after);old=[r for r in before['context']['all_roles']if r['name']=='cli_login_postgres'];new=[r for r in result['context']['all_roles']if r['name']=='cli_login_postgres']
    need(len(old)==len(new)==1);a,b=old[0],new[0];qualifications=[]
    if a['valid_until']!=b['valid_until']:
        end=timestamp(b['valid_until']);now=timestamp(observed)
        need(now<=end<=now+datetime.timedelta(minutes=10))
        if a['valid_until']is not None:need(end>=timestamp(a['valid_until']))
        qualifications.append({'name':'cli_login_postgres','field':'valid_until','before':a['valid_until'],'after':b['valid_until']})
        b['valid_until']=a['valid_until']
    return result,qualifications


def compare_after(before,after,observed):
    shape(before);shape(after);expected=copy.deepcopy(before)
    need(expected['catalog'][ACK]==OLD and VERSION not in expected['context']['migration_versions'])
    expected['catalog'][ACK]=NEW;expected['context']['migration_versions'].append(VERSION);expected['protected_data']['versions'].append(VERSION)
    normalized,qualifications=normalize_expiry(before,after,observed);need(normalized==expected)
    return qualifications


def summary(state):
    c=state['context'];a=state['admission'];catalog=copy.deepcopy(state['catalog']);catalog.pop(ACK)
    data=copy.deepcopy(state['protected_data']);data.pop('versions')
    roles=copy.deepcopy(c['all_roles'])
    for role in roles:
        if role['name']=='cli_login_postgres':role['valid_until']='qualified_cli_login_expiry'
    return {'history':c['migration_versions'],'ack_body_sha256':state['catalog'][ACK],
      'hook_body_sha256':state['catalog']['functions|eps.mcp_custom_access_token_hook(jsonb)|source_sha256'],
      'catalogue_field_count':len(state['catalog']),'catalogue_without_ack_sha256':canonical(catalog),
      'business_data_sha256':canonical(data),'settings_sha256':a['settings_row_sha256'],
      'roles_sha256':canonical(roles),'memberships_sha256':canonical(c['all_memberships']),
      'effective_privileges_sha256':canonical(c['effective_privileges']),'runtime_sha256':canonical(a['runtime']),
      'runtime_operation_count':len(a['runtime']['execute']),'application_origin':a['application_origin'],'frame_native_image_id':a['frame_native_image_id'],
      'registry_count':c['registry_count'],'active_jobs':a['active_jobs'],'leased_outbox':a['leased_outbox'],'protected_m02':a['protected_m02']}


def observe(io,before):
    reads=[];qualifications=[]
    for _ in range(2):
        try:state=io.read();qualifications.extend(compare_after(before,state,io.now()));reads.append(state)
        except Exception:reads.append(None)
    equal=all(reads)and summary(reads[0])==summary(reads[1])
    return {'after_summary':summary(reads[0])if reads[0]else None,'independent_summary':summary(reads[1])if reads[1]else None,
      'independent_readback_equal':bool(equal),'protected_before_after_equal':bool(equal),
      'application_verified_by_readback':bool(equal),'cli_short_login_expiry_qualifications':qualifications}


def apply_once(io):
    before=io.preflight();io.claim(before);returned=False;marker=False
    try:marker=io.dispatch(before);returned=True
    except Exception:pass
    result=observe(io,before)
    return {'result':'passed'if result['application_verified_by_readback']else'unconfirmed','before_summary':summary(before),
      'dispatch_attempted':True,'dispatch_process_returned':returned,'normal_return_marker_observed':returned and marker is True,**result}
