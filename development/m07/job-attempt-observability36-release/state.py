"""Pure canonical36 state/query and transition gates; no SQL dispatch or writes."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
VERSION='20261101012057'
MIGRATION='supabase/migrations/20261101012057_m07_job_attempt_observability.sql'
PORTS=('eps.claim_job_stage(jsonb)','eps.claim_candidate_job_stage(jsonb)','eps.claim_review_job_stage(jsonb)',
 'eps.claim_presentation_job_stage(jsonb)','eps.claim_export_job_stage(jsonb)','eps.claim_job_stage_replay(jsonb,text,text,text)',
 'eps.record_job_event(jsonb)','public.eps_retry_job(uuid,jsonb,text)','eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)')
def need(value):
 if not value:raise ValueError('ATTEMPT36_STATE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name):
 need(name in('proposal','schema_gate','catalogue_delta'))
 path=HERE/(name+'.py');need(path.is_file()and not path.is_symlink()and path.resolve()==path)
 spec=importlib.util.spec_from_file_location('attempt36_state_'+name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def base():return module('proposal').load_base()
def sources():
 p=module('proposal');b=p.load_base();pins=b.sources()
 proof_raw=(ROOT/p.PROOF).read_bytes();p.validate_proof(proof_raw);prior=json.loads(proof_raw)
 for file,digest in prior['source_seals'].items():
  target=ROOT/file;need(target.is_file()and not target.is_symlink()and target.resolve()==target and sha(target.read_bytes())==digest)
  pins[file]=digest
 pins[p.PROOF]=p.PROOF_SHA
 for file in [MIGRATION,*[(HERE/name).relative_to(ROOT).as_posix()for name in('state.py','proposal.py','schema_gate.py','catalogue_delta.py')]]:
  target=ROOT/file;need(target.is_file()and not target.is_symlink()and target.resolve()==target);pins[file]=sha(target.read_bytes())
 p.assert_functional_promotion((ROOT/MIGRATION).read_bytes(),(ROOT/p.CANDIDATE).read_bytes());return dict(sorted(pins.items()))
def legacy_sql():
 # Counts only; invalid private values never leave PostgreSQL. Same source-stage
 # budget text cast as existing claim functions, before their bounded increment.
 kinds="(kind='specs_extract'and stage in('prepare_document','extract_specs','apply_specs'))or(kind='candidate_scan'and stage in('prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate'))or(kind='frame_extract'and stage in('extract_frames','apply_frames'))or(kind='ai_suggestion'and stage in('prepare_suggestion','generate_suggestion','validate_suggestion'))or(kind='review_fit'and stage='measure_review_fit')or(kind='presentation_render'and stage in('prepare_presentation','render_presentation','validate_presentation','publish_presentation'))or(kind='presentation_export'and stage='render_export')"
 unsafe="correlation_id!~'^[A-Za-z0-9._:-]{1,128}$'or input_hash!~'^[a-f0-9]{64}$'or not("+kinds+")or attempt not between 0 and 2147483646 or row_version not between 1 and 9007199254740990 or case when stage_attempts->>stage is null then false when stage_attempts->>stage~'^[0-9]{1,10}$'then(stage_attempts->>stage)::numeric>2147483646 else true end"
 return "(select jsonb_build_object('unsupported_metadata_count',count(*)filter(where "+unsafe+"),'job_count',count(*),'kinds',(select coalesce(jsonb_object_agg(kind,n),'{}'::jsonb)from(select kind,count(*)n from eps.jobs group by kind)k))from eps.jobs)"
def ports_sql(b):
 values=','.join('('+b.literal(signature)+')'for signature in PORTS)
 return "(select jsonb_object_agg(s.signature,jsonb_build_object('exists',p.oid is not null,'owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'config',p.proconfig,'body_sha256',"+b.digest_sql("replace(p.prosrc,E'\\r\\n',E'\\n')")+",'acl',"+b.acl_sql('p')+"))from(values"+values+")s(signature)left join pg_proc p on p.oid=to_regprocedure(s.signature))"
def state_sql(phase='before',local=False):
 need(phase in('before','after','disabled')and type(local)is bool)
 b=base();d=module('catalogue_delta');g=module('schema_gate');normal=d.normalized_catalogue_sql(b.catalogue_sql())
 trace="null::jsonb"if phase=='before'else"(select jsonb_build_object('count',count(*),'sha256',"+b.digest_sql("coalesce(string_agg(h,E'\\n'order by h),'')")+")from(select "+b.digest_sql('to_jsonb(t)')+"h from eps.job_stage_attempts t)hashed)"
 return "select(select (b.value-'static_schema')||jsonb_build_object('catalogue',"+normal+",'schema',( "+g.new_schema_sql()+"),'delta_metadata',"+d.delta_metadata_sql()+",'legacy',"+legacy_sql()+",'claim_ports',"+ports_sql(b)+",'session_user',session_user,'trace_rows',"+trace+")from("+b.state_sql()+"as value)b)"
def check_before(value,local=False,expected_ports=None):
 b=base();g=module('schema_gate');need(type(local)is bool and type(value)is dict)
 need(set(value)=={'database','operator','cli_role_safe','history','protected_m02','protected_m02_integrity','drain','english','oauth','oauth_static_sha256',
  'catalogue','data','eps_tables','owner_no_public_create','review_owner_safe','cast','summary','schema','delta_metadata','legacy','claim_ports','session_user','trace_rows'})
 need(value['database']=='postgres'if not local else type(value['database'])is str and value['database'].startswith('eps_m07_r33_source_'))
 need(value['operator']=='postgres'and value['history']==b.HISTORY+[b.VERSION]and value['summary']==b.SUMMARY)
 need(value['owner_no_public_create']is True and value['review_owner_safe']is True and value['eps_tables']==b.EPS_TABLES)
 need(set(value['data'])==set(b.TABLES)and len(value['data'])==74 and value['oauth']['coordinator_auth_usage']is False)
 for row in [value['catalogue'],*value['data'].values()]:need(type(row)is dict and set(row)=={'count','sha256'}and type(row['count'])is int and row['count']>=0 and type(row['sha256'])is str and re.fullmatch('[a-f0-9]{64}',row['sha256']))
 legacy=value['legacy'];need(type(legacy)is dict and set(legacy)=={'unsupported_metadata_count','job_count','kinds'}and type(legacy['unsupported_metadata_count'])is int and legacy['unsupported_metadata_count']==0)
 need(type(legacy['job_count'])is int and legacy['job_count']>=0 and type(legacy['kinds'])is dict and set(legacy['kinds'])<=set(['specs_extract','candidate_scan','frame_extract','ai_suggestion','review_fit','presentation_render','presentation_export']))
 need(all(type(n)is int and n>=0 for n in legacy['kinds'].values())and sum(legacy['kinds'].values())==legacy['job_count'])
 need(set(value['claim_ports'])==set(PORTS))
 for row in value['claim_ports'].values():need(type(row)is dict and set(row)=={'exists','owner','definer','config','body_sha256','acl'}and row['exists']is True and type(row['body_sha256'])is str and re.fullmatch('[a-f0-9]{64}',row['body_sha256'])and row['definer']is True and row['config']==['search_path=""']and type(row['owner'])is str and type(row['acl'])is list)
 need(value['cast']['owner']=='eps_cast_owner'and value['cast']['source_sha256']==b.CAST_BODY_SHA and type(value['cast']['acl'])is list)
 if expected_ports is not None:need(value['claim_ports']==expected_ports)
 if not local:
  need(value['session_user']=='postgres'and value['cli_role_safe']is True)
  need(value['protected_m02']==b.old.PROTECTED_M02 and value['protected_m02_integrity']is True)
  need(value['drain']=={'other_active_jobs':0,'leased_outbox':0}and value['english']=={'flags':['1.0'],'security':True})
 g.check_schema_before(value['schema']);module('catalogue_delta').metadata_shape(value['delta_metadata']);need(value['trace_rows']is None)
def check_transition(before,after,local=False,migration_version=None,trigger_enabled='O'):
 check_before(before,local=local);need(trigger_enabled in('O','D'))
 module('schema_gate').check_schema_after(after['schema'],trigger_enabled=trigger_enabled)
 module('catalogue_delta').validate_delta(before['delta_metadata'],after['delta_metadata'])
 changed={'history','schema','delta_metadata','eps_tables','trace_rows'}
 need({k:v for k,v in before.items()if k not in changed}=={k:v for k,v in after.items()if k not in changed})
 need(after['history']==before['history']+([migration_version]if migration_version is not None else[]))
 need(after['eps_tables']==sorted(before['eps_tables']+['job_stage_attempts']))
 need(after['trace_rows']=={'count':0,'sha256':sha(b'')})
 return {'normalized_old_catalogue_unchanged':True,'all74_old_table_hashes_unchanged':True,'oauth_english_protected_m02_unchanged':True,
  'new_schema_gate_passed':True,'new_trace_empty':True,'legacy_metadata_supported':True}
def check_disable_transition(before,after,local=False):
 need(type(local)is bool)
 g=module('schema_gate');g.check_schema_after(before['schema'],trigger_enabled='O');g.check_schema_after(after['schema'],trigger_enabled='D')
 need({k:v for k,v in before.items()if k!='schema'}=={k:v for k,v in after.items()if k!='schema'})
 return {'only_named_user_trigger_disabled':True,'all_old_data_oauth_and_metadata_unchanged':True,'foreign_key_ri_triggers_enabled':True}
def _atomic_parts(before,expected_schema,local,trigger_enabled,installed=False):
 need(type(local)is bool and trigger_enabled in('O','D'));b=base();g=module('schema_gate')
 if local:
  need(before is None and expected_schema is None)
  key='eps.attempt36_state.expected_installed'if installed else'eps.attempt36_state.expected_before'
  prior="current_setting('"+key+"',true)::jsonb";gate=g.gate_sql_from_expression(g.PROOF_EXPECTED_EXPR,trigger_enabled=trigger_enabled)
 else:
  need(type(before)is dict and type(expected_schema)is dict);prior=b.json_sql(before);gate=g.gate_sql(expected_schema,trigger_enabled=trigger_enabled)
 return b,prior,gate
def postcondition_sql(before=None,expected_schema=None,local=False,migration_version=None,trigger_enabled='O'):
 """Scalar PG-side postcondition. Local mode is fixed-GUC/owned-marker only."""
 need(migration_version in(None,VERSION));b,prior,gate=_atomic_parts(before,expected_schema,local,trigger_enabled)
 changed="array['history','schema','delta_metadata','eps_tables','trace_rows']::text[]"
 history="p.value->'history'"+("||"+b.json_sql([migration_version])if migration_version else'')
 tables="(select jsonb_agg(k order by k)from jsonb_array_elements_text((p.value->'eps_tables')||'[\"job_stage_attempts\"]'::jsonb)t(k))"
 delta="jsonb_set(jsonb_set(p.value->'delta_metadata','{trace_schema_acl}',"+b.json_sql({'count':1,'rows':[{'schema':'eps','grantor':'postgres','privilege':'USAGE','grantable':False}]})+"),'{jobs_has_triggers}','true'::jsonb)"
 trace=b.json_sql({'count':0,'sha256':sha(b'')})
 return "(select (o.value-"+changed+")=(p.value-"+changed+")and o.value->'history'=("+history+")and o.value->'eps_tables'="+tables+"and o.value->'delta_metadata'="+delta+"and o.value->'trace_rows'="+trace+"and("+gate+")is true from("+state_sql('after',local=local)+"as value)o cross join(select "+prior+"as value)p)"
def disable_postcondition_sql(before=None,expected_schema=None,local=False):
 b,prior,gate=_atomic_parts(before,expected_schema,local,'D',installed=True)
 return "(select(o.value-'schema')=(p.value-'schema')and("+gate+")is true from("+state_sql('disabled',local=local)+"as value)o cross join(select "+prior+"as value)p)"
def static_schema(value):
 b=base();return {**{key:copy.deepcopy(value[key])for key in b.STATIC_KEYS},'control_plane':{name:copy.deepcopy(value['data'][name])for name in b.CONTROL_TABLES},
  'schema':copy.deepcopy(value['schema']),'delta_metadata':copy.deepcopy(value['delta_metadata']),'claim_ports':copy.deepcopy(value['claim_ports'])}
