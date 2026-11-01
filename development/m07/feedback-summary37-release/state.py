"""Pure canonical36->37 metadata projection; importing never dispatches SQL."""
from pathlib import Path
import copy, hashlib, importlib.util, json, re

HERE=Path(__file__).resolve().parent; ROOT=HERE.parents[2]
VERSION='20261101042702'; TARGET='pyibofyctwnqpvktepse'
MIGRATION='supabase/migrations/20261101042702_m07_feedback_summary.sql'
MIGRATION_SHA='14bb7f74e597b9a1a9b49df6fe047b16a788efa703e5d7a849ed254c3cbe98b3'
PROOF='tracking/evidence/m07/feedback-summary37-proof/2026-11-01T09-45-45-482Z-e109a4d1.json'
PROOF_SHA='3a98d0dabac723e8c599f200a30e6849596b41281c0828868a64a313d008b1b9'
BASELINE='tracking/evidence/m07/job-attempt-observability36-release/2026-11-01T02-20-17-194633Z-readback.json'
BASELINE_SHA='fcfd3972cc660d8a9fdded4fc24db72ceac7c3bdafe1d461671d03baa6045b10'
FROZEN={
 'state.py':'2240ad7b9ae85ebc7d1ab94857e9ed5a5c572f51b6ef7fb18c1fd72b9a0b13f9',
 'proposal.py':'26eec43740e63fee5c803f0baa8c9fa3ed5a11ca5e4ea48e16ff82c4e68f1003',
 'schema_gate.py':'4ac028d48e773f881cda74f4cd7a201b86cd7c6d0a5a275d09eae5fbd855ac13',
 'catalogue_delta.py':'bad16efbc12f045ea57bb03eedf5d44b05d8779a041d14fdbf3cbb0b069dd65c'}
GUEST='public.eps_guest_operation(text,jsonb,jsonb)'
HELPER='eps.feedback_summary(uuid,boolean)'; RPC='public.eps_get_feedback_summary(uuid)'
OLD_GUEST_SHA='f5a2a813cce9d990b972ef2e4006b15dce1a2c7b4f0d0e85cec82587fa97d53c'

def need(value):
 if not value: raise ValueError('FEEDBACK37_STATE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path,maximum=8*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=maximum);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
for name,digest in FROZEN.items():need(sha(load(ROOT/'development/m07/job-attempt-observability36-release'/name))==digest)
old=module('feedback37_pure_state36',ROOT/'development/m07/job-attempt-observability36-release/state.py');b=old.base()
builder=module('feedback37_proved_builder',ROOT/'development/m07/feedback-summary37/build_migration.py')
OLD_BODY,NEW_BODY=builder.guest_bodies();NEW_GUEST_SHA=sha(NEW_BODY.encode());need(sha(OLD_BODY.encode())==OLD_GUEST_SHA)
SOURCE=load(ROOT/MIGRATION);need(sha(SOURCE)==MIGRATION_SHA)

def function_body(name):
 import pglast
 from pglast import ast,parse_sql
 need(pglast.__version__=='v7.21')
 matches=[node.stmt for node in parse_sql(SOURCE.decode())if isinstance(node.stmt,ast.CreateFunctionStmt)and '.'.join(v.sval for v in node.stmt.funcname)==name]
 need(len(matches)==1);return next(o.arg[0].sval for o in matches[0].options if o.defname=='as')

def expected_function(name,definer,grantees):
 return {'owner':'eps_review_owner','definer':definer,'volatility':'s','config':['search_path=""'],'returns':'jsonb','language':'plpgsql','strict':False,
  'parallel':'u','leakproof':False,'retset':False,'defaults':0,'variadic':0,'support':0,'kind':'f','body_sha256':sha(function_body(name).encode()),
  'arguments':'p_version uuid, p_external boolean'if name=='eps.feedback_summary'else'p_version_id uuid','cost':100,'rows':0,'transforms':None,'binary':None,'sql_body_absent':True,
  'acl':[{'grantee':role,'grantor':'eps_review_owner','privilege':'EXECUTE','grantable':False}for role in sorted(grantees)]}
FUNCTIONS={HELPER:expected_function('eps.feedback_summary',False,['eps_review_owner','eps_guest_owner']),RPC:expected_function('public.eps_get_feedback_summary',True,['eps_review_owner','authenticated'])}

def catalogue_sql():
 """Retain every old catalogue row; admit only two identities and guest prosrc."""
 prior="(case when p.oid=to_regprocedure('"+b.CAST+"')then to_jsonb(p)-'proacl'else to_jsonb(p)end)"
 replacement="(case when p.oid=to_regprocedure('"+GUEST+"')then jsonb_set(to_jsonb(p),'{prosrc}',to_jsonb("+b.literal(OLD_BODY)+"::text))when p.oid=to_regprocedure('"+b.CAST+"')then to_jsonb(p)-'proacl'else to_jsonb(p)end)"
 anchor="and p.oid is distinct from to_regprocedure('"+b.SIGNATURE+"')"
 # The unchanged36 normalizer pins its exact35 input. Apply its finite changes
 # first, then substitute only the already-verified37 projection/filter strings.
 normal=old.module('catalogue_delta').normalized_catalogue_sql(b.catalogue_sql())
 need(normal.count(prior)==1 and normal.count(anchor)==1)
 return normal.replace(prior,replacement).replace(anchor,anchor+"and p.oid is distinct from to_regprocedure('"+HELPER+"')and p.oid is distinct from to_regprocedure('"+RPC+"')")

def feedback_sql():
 metadata="jsonb_build_object('owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'returns',format_type(p.prorettype,null),'language',(select lanname from pg_language where oid=p.prolang),'strict',p.proisstrict,'parallel',p.proparallel,'leakproof',p.proleakproof,'retset',p.proretset,'defaults',p.pronargdefaults,'variadic',p.provariadic::bigint,'support',p.prosupport::oid::bigint,'kind',p.prokind,'arguments',pg_get_function_arguments(p.oid),'cost',p.procost,'rows',p.prorows,'transforms',p.protrftypes,'binary',p.probin,'sql_body_absent',p.prosqlbody is null,'body_sha256',"+b.digest_sql("replace(p.prosrc,E'\\r\\n',E'\\n')")+",'acl',"+b.acl_sql('p')+")"
 funcs="(select jsonb_object_agg(v.signature,case when p.oid is null then null else "+metadata+"end)from(values("+b.literal(HELPER)+"),("+b.literal(RPC)+"))v(signature)left join pg_proc p on p.oid=to_regprocedure(v.signature))"
 counts="(select jsonb_object_agg(v.name,(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=v.schema and p.proname=v.name))from(values('eps','feedback_summary'),('public','eps_get_feedback_summary'))v(schema,name))"
 guest="(select jsonb_build_object('body_sha256',"+b.digest_sql("replace(p.prosrc,E'\\r\\n',E'\\n')")+",'metadata_sha256',"+b.digest_sql("to_jsonb(p)-'prosrc'")+")from pg_proc p where p.oid=to_regprocedure('"+GUEST+"'))"
 return "jsonb_build_object('functions',"+funcs+",'name_counts',"+counts+",'guest',"+guest+",'review_no_eps_create',not has_schema_privilege('eps_review_owner','eps','CREATE'))"

def state_sql(static_only=False):
 need(type(static_only)is bool)
 raw=old.state_sql('after');original=old.module('catalogue_delta').normalized_catalogue_sql(b.catalogue_sql())
 need(raw.count(original)==1);raw=raw.replace(original,catalogue_sql())
 if static_only:
  # Use the identical query schema but avoid reading ordinary business rows.
  static=b.state_sql(True)
  original_base=old.normalized_base_state_sql(b);need(raw.count(original_base)==1)
  static_base=static.replace(b.old.oauth_sql(),old.normalized_oauth_sql(b))
  # Its discarded inherited catalogue still uses the original expression.
  raw=raw.replace(original_base,static_base)
  raw=raw.replace("(select jsonb_build_object('count',count(*),'sha256',"+b.digest_sql("coalesce(string_agg(h,E'\\n'order by h),'')")+")from(select "+b.digest_sql('to_jsonb(t)')+"h from eps.job_stage_attempts t)hashed)",'null::jsonb')
  raw=raw.replace(old.legacy_sql(),"'{}'::jsonb")
 return "select(select q.value||jsonb_build_object('feedback37',"+feedback_sql()+")from("+raw+" as value)q)"

def static_schema(value):return {**old.static_schema(value),'feedback37':copy.deepcopy(value['feedback37'])}
def static_schema_sql():
 fields=list(b.STATIC_KEYS)+['schema','delta_metadata','claim_ports','feedback37']
 pairs=','.join(b.literal(key)+",q.value->"+b.literal(key)for key in fields)
 return "select(select case when q.value->'cli_role_safe'='true'::jsonb then jsonb_build_object("+pairs+",'control_plane',q.value->'data')else null end from("+state_sql(True)+" as value)q)"

def baseline():
 raw=load(ROOT/BASELINE);need(sha(raw)==BASELINE_SHA);v=json.loads(raw)
 need(v['action']=='readback'and v['result']=='observed_applied'and v['target']==TARGET and v['version']==old.VERSION)
 return v['static_schema_after']

def check_feedback(value,installed,before_guest=None):
 need(type(value)is dict and set(value)=={'functions','name_counts','guest','review_no_eps_create'}and value['review_no_eps_create']is True)
 need(value['functions']==(FUNCTIONS if installed else{HELPER:None,RPC:None}))
 need(value['name_counts']=={'feedback_summary':int(installed),'eps_get_feedback_summary':int(installed)})
 guest=value['guest'];need(type(guest)is dict and set(guest)=={'body_sha256','metadata_sha256'})
 need(guest['body_sha256']==(NEW_GUEST_SHA if installed else OLD_GUEST_SHA)and type(guest['metadata_sha256'])is str and re.fullmatch('[a-f0-9]{64}',guest['metadata_sha256']))
 if before_guest is not None:need(guest['metadata_sha256']==before_guest['metadata_sha256'])

def check_static(value,installed=True,expected=None):
 need(type(value)is dict and set(value)==set(b.STATIC_KEYS)|{'control_plane','schema','delta_metadata','claim_ports','feedback37'})
 check_feedback(value['feedback37'],installed)
 prior=baseline();actual={k:v for k,v in value.items()if k!='feedback37'}
 if installed:prior=copy.deepcopy(prior);prior['history']+=[VERSION]
 need(actual==prior)
 if expected is not None:need(value==expected)
 return value

def check_before(value):
 check_static(static_schema(value),installed=False)
 need(value['database']==value['operator']==value['session_user']=='postgres'and value['cli_role_safe']is True)
 need(value['drain']=={'other_active_jobs':0,'leased_outbox':0}and value['legacy']['unsupported_metadata_count']==0)
 need(set(value['data'])==set(b.TABLES)and value['oauth']['coordinator_auth_usage']is False)
 need(type(value['trace_rows'])is dict and set(value['trace_rows'])=={'count','sha256'})

def expected_after(before):
 check_before(before);v=copy.deepcopy(before);v['history']+=[VERSION];v['feedback37']['functions']=copy.deepcopy(FUNCTIONS)
 v['feedback37']['name_counts']={'feedback_summary':1,'eps_get_feedback_summary':1};v['feedback37']['guest']['body_sha256']=NEW_GUEST_SHA
 return v

def check_transition(before,after):
 need(after==expected_after(before));check_static(static_schema(after));check_feedback(after['feedback37'],True,before['feedback37']['guest'])
 return {'all74_business_table_hashes_unchanged':True,'trace_hash_unchanged':True,'old_catalogue_oauth_permissions_unchanged':True,'english_ready_reviewed_media_protected_m02_unchanged':True,'guest_metadata_unchanged':True,'only_history_two_functions_and_guest_body_changed':True}

def sources():
 raw=load(ROOT/PROOF);need(sha(raw)==PROOF_SHA);v=json.loads(raw)
 need(v['run_id']=='e109a4d1-b3e8-4caf-98d8-773251359e91')
 need(v['result']=='passed'and v['checkpoint']=='complete'and v.get('cleanup_unconfirmed')is not True and len(v['source_seals'])==217)
 for key in ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes']:need(v[key]is False)
 for key in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']:need(v[key]is True)
 suffix=v['run_id'].replace('-','');need(v['actual_disposable_database_absence']=={'eps_m07_r33_source_'+suffix:False,'eps_m07_r33_restore_'+suffix:False})
 proof=v['feedback37_sql'];need(proof['result']=='passed'and proof['actual37_sha256']==MIGRATION_SHA and proof['history34_to37_ephemeral']is True and proof['ddl_data_catalogue_roles_rolled_back']is True and proof['full_counts_internal_and_guest_authority_assertions']is True and proof['persistent_history_count']==33)
 pins=old.sources()
 for path,digest in v['source_seals'].items():
  need(type(path)is str and not Path(path).is_absolute()and '..'not in Path(path).parts and sha(load(ROOT/path))==digest);pins[path]=digest
 for path in [ROOT/PROOF,ROOT/BASELINE,ROOT/MIGRATION,HERE/'state.py']:
  pins[path.relative_to(ROOT).as_posix()]=sha(load(path))
 baseline();need(sha(load(ROOT/MIGRATION))==MIGRATION_SHA);return dict(sorted(pins.items()))
