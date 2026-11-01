"""Pure38 state/projection. Read-only postmerge gates never validate old TS files."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';VERSION='20261101110939'
PROOF='tracking/evidence/m07/job-batch-filter-proof/2026-11-01T17-23-47-142Z-bb9cf2bf.json'
PROOF_SHA='c2020d123b7d54c27a6440b4bf6ede7c9dd1c751ec13b1613f7ad2c1bf62b2c4'
APPLY37='tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-00-079274Z-apply.json'
APPLY37_SHA='776ddc9e16af407c613d9203b6c07918826160ae0b3f48af7437b88409bed4f6'
BASELINE='tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-27-793801Z-readback.json'
BASELINE_SHA='cc0936d60ab10c9f2bdabcd6c7b26dc07655abc9126de692cfe519a589e2c8c2'
# Filled with the finite SQL/Python projector closure only. No TS/contracts.
PURE_PINS={'development/m03/english-release34/release.py': 'cfb1de71b308d6bfe7b9115980a67d84341b014f06babf1fac84aa3c9806364a',
 'development/m03/english-transcript34/port-patches.json': '12a675415e0970825903de616dae271911da6f01edd13d9dee62e0befecf813e',
 'development/m07/feedback-summary37-release/state.py': 'a2b59a9f09a4d82897370dd3d187af04d6268210eed16d585e530ae5f1081abc',
 'development/m07/feedback-summary37/build_migration.py': 'c63159bca248b397d3cc3ceb820424555aecbfb788820eb637c0ff7276aaf880',
 'development/m07/job-attempt-observability36-release/catalogue_delta.py': 'bad16efbc12f045ea57bb03eedf5d44b05d8779a041d14fdbf3cbb0b069dd65c',
 'development/m07/job-attempt-observability36-release/proposal.py': '26eec43740e63fee5c803f0baa8c9fa3ed5a11ca5e4ea48e16ff82c4e68f1003',
 'development/m07/job-attempt-observability36-release/schema_gate.py': '4ac028d48e773f881cda74f4cd7a201b86cd7c6d0a5a275d09eae5fbd855ac13',
 'development/m07/job-attempt-observability36-release/state.py': '2240ad7b9ae85ebc7d1ab94857e9ed5a5c572f51b6ef7fb18c1fd72b9a0b13f9',
 'development/m07/job-attempt-observability36/candidate.sql': 'dc4eec586a3ae0fc9722a70ca6229742971eb21279916c32ab47cea4a802ed3b',
 'development/m07/oauth-attempt-trace/inspect-attempt.py': '1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',
 'development/m07/oauth-consent-fix/discover.py': '6ce739dc9394d67ba98a851651455dfb2ffaf553602f8312b1626130f2a125e9',
 'development/m07/oauth-consent-fix/discovery.sql': '0d19f8e10a12a4cd71c10cc476fea4654ce7d7591ee73b40ff02903bfb63809c',
 'development/m07/oauth-consent-fix/release_v3.py': 'bec36223e8b22217ab5c9e1a2c557ff9aa0bd4dabbeae1361469fdc9079a1c77',
 'development/m07/workspace-summary35-release/release.py': '33e64f3c9a3d2b5d394a6a7a1468968974ef05765802c03748db70ef3890510f',
 'supabase/migrations/20261028010943_m01_canonical_foundation.sql': '8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9',
 'supabase/migrations/20261028013324_m01_identity_role_inheritance.sql': '5382efe9fbdf9c194010257e0ac0024dcb447207522036560056d5d1a4e20e30',
 'supabase/migrations/20261028013655_m01_workspace_scope_alias.sql': '67ddb2cff9fed9c42d34657e833c613aec4afd2769543a991bbac84da355db64',
 'supabase/migrations/20261028024205_m01_private_logo_boundary.sql': 'b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d',
 'supabase/migrations/20261028072515_m01_logo_upload_capability.sql': '4dbd400092d7743b02dd0769ae511c208e6f4f349428fc0e7f0fb9c573ba4b24',
 'supabase/migrations/20261028162702_m01_replay_scope_refresh.sql': '82a4f2ec03efc0787aa58e5f1e68ab626e5dddb5e4c645444103456757bf4251',
 'supabase/migrations/20261028162800_m02_jobs_outbox.sql': 'f619b3dfb9d964ab5902d04941b8cd59b44e9da36f1ab3f7b10bd45298ff4013',
 'supabase/migrations/20261028172320_m02_manual_specs_draft.sql': '8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c',
 'supabase/migrations/20261028184145_m02_role_order.sql': '14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa',
 'supabase/migrations/20261028222030_m02_specs_pipeline.sql': '1e5319bb81be1f12896f7efb5a2cb7706653b79eb440a4dc1aaaca4ed9556895',
 'supabase/migrations/20261029001520_m02_specs_assets.sql': '9b35e8efdfc5184252ab4ecfe1a50861c8991dadf2b20544d481b51b3b7fb288',
 'supabase/migrations/20261029003941_m02_specs_mime_guard.sql': '5a4439e9dd5262cae7e6f813997c4c9506db3eb74fe4ea95d2a352726effb549',
 'supabase/migrations/20261029070038_m02_specs_read_operation.sql': '040151ec89b461be2dc0c1d4ab8446652062488aac5f63822129d497ecf1702e',
 'supabase/migrations/20261029090500_m02_service_claim_replay.sql': '705d7432ab8cbe04fa5a94e090e1ce55e36c622590c09e0ce922ac5a59c6baf2',
 'supabase/migrations/20261029090724_m03_candidate_library.sql': '2a84e240fa1ed3a283a483775e797e7ef1bafeea36d2d11ace17e06b857d8b8d',
 'supabase/migrations/20261029094600_m02_pdf_vision.sql': '5b7ad204f6dddde82ae829577ea1130fd426a3998797460871baad20d789cb50',
 'supabase/migrations/20261029100500_m03_candidate_pipeline.sql': '4af04b4a3fb050e39aa23958c3f82e304cc7d7a1f450a5d93f7f50bc001bd836',
 'supabase/migrations/20261029133455_m03_remaining_media_library.sql': '2e190e001b2bda044d9c90da4287f54e5839b0af7ffec84d4c93083909c944fb',
 'supabase/migrations/20261029135318_m03_frame_request_resubmission.sql': 'e816ad6b491626ace489efd256b56c322d25d9101de94e5fb8b24d2d4b745048',
 'supabase/migrations/20261029174841_m04_casting_assignments_lifecycle.sql': '2825681bf529f1b32db2473749180901f0961b025e8da847b38ad49c06f4b900',
 'supabase/migrations/20261029180953_m03_frame_vision_selection.sql': 'bcd12794eccfa590e5d160f62dfd67838c8186376cddda1952f291c50d03bec8',
 'supabase/migrations/20261029202629_m04_review_series_processing.sql': '3f1543b9d4b525d486287f2f00711270ed1fbdc30911dac3aea725aee50679e4',
 'supabase/migrations/20261029203953_m04_ai_apply_source_guard.sql': '1bf897c3c6dcae03c96f0d434ba61edfc89b01d2c700dc4e8c11ce17e285832c',
 'supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql': '09d78c225ca02d436a8b1c2bcc6e55f273dfea116976807af4a8b228b99de5f4',
 'supabase/migrations/20261030002634_m06_guest_review_feedback_exports.sql': '2c72507216efdcd3e9dcea3f9b94270b19e1275ebcd2fcf91dad9253ddde8d2a',
 'supabase/migrations/20261030004643_m06_credential_admission_guest_retry.sql': 'a0fb9dfec8cdae2718719d455ed11b4f25dd9b79e8fc9de19bd53c229b64089e',
 'supabase/migrations/20261030013832_m06_guest_storage_policy_composition.sql': '9e3ab85655c2fa0490aba07118fe730dae2c6193f651c3ba086910d82b7eb171',
 'supabase/migrations/20261030030717_m06_frozen_video_source_transcripts.sql': '6334ea62a49966963e675c61e6a73d2acb5981d35f261cf2dff519d097905178',
 'supabase/migrations/20261030111549_m07_settings_delegated_session.sql': '6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4',
 'supabase/migrations/20261030154824_m07_native_oauth_issuer.sql': 'e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785',
 'supabase/migrations/20261031010000_m07_specs_submit_ack_projection.sql': 'c1c4cb41460df067d726e4058cc24eacbcf55e5cc73e6a18365394e2c2fbc5e5',
 'supabase/migrations/20261031104603_m07_oauth_consent_binding_and_claims.sql': '0d7b7a7577ffe1ff4b24eba202ce6ac7e87c616ca8039397800e607c651908a5',
 'supabase/migrations/20261031130207_m07_oauth_consent_browser_context.sql': '9923e7a1cb52e160041aacea053a21cb9c25c1fc468db99eb7b7ea77e15dcb81',
 'supabase/migrations/20261031143711_m03_english_transcript_projection.sql': '0705f1940abbc5c4afc65a49e85d9ef2ce6a6489178b6dd82c3acb33cf976472',
 'supabase/migrations/20261031182038_m07_workspace_summary.sql': 'cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0',
 'supabase/migrations/20261101012057_m07_job_attempt_observability.sql': '4209e16b7d67cfb793375d24dfd22f9fee72f3516e3dde16be1d2b0d633b7267',
 'supabase/migrations/20261101042702_m07_feedback_summary.sql': '14bb7f74e597b9a1a9b49df6fe047b16a788efa703e5d7a849ed254c3cbe98b3',
 'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_logo.py': 'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4',
 'tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-00-079274Z-apply.json': '776ddc9e16af407c613d9203b6c07918826160ae0b3f48af7437b88409bed4f6',
 'tracking/evidence/m07/feedback-summary37-release/2026-11-01T10-02-27-793801Z-readback.json': 'cc0936d60ab10c9f2bdabcd6c7b26dc07655abc9126de692cfe519a589e2c8c2',
 'tracking/evidence/m07/oauth-consent-fix/2026-10-31T10-55-03-058615Z-catalogue.json': 'cea1b708a9c43f5c1436797651094b3041f3ce3365cf44690782f027c709ea80'}

def need(v):
 if not v:raise ValueError('BATCH38_STATE_UNCONFIRMED')

def sha(raw):return hashlib.sha256(raw).hexdigest()

def load(path,maximum=8*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=maximum);return path.read_bytes()

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m

for file,digest in PURE_PINS.items():need(sha(load(ROOT/file))==digest)
prior=module('batch38_pure37',ROOT/'development/m07/feedback-summary37-release/state.py');b=prior.b
builder=module('batch38_source_builder',HERE/'build_migration.py')
MIGRATION=builder.MIGRATION;SOURCE=builder.render();MIGRATION_SHA=sha(SOURCE)
OLD=builder.OLD;NEW=builder.NEW
FUNCTION={'owner':'eps_jobs_owner','definer':True,'volatility':'v','config':['search_path=""'],'returns':'jsonb','language':'plpgsql','strict':False,
 'parallel':'u','leakproof':False,'retset':False,'defaults':0,'variadic':0,'support':0,'kind':'f','body_sha256':builder.NEW_BODY_SHA,
 'arguments':'p_workspace_id uuid, p_status text, p_cursor uuid, p_limit integer, p_batch_id uuid','cost':100,'rows':0,'transforms':None,'binary':None,'sql_body_absent':True,
 'acl':[{'grantee':r,'grantor':'eps_jobs_owner','privilege':'EXECUTE','grantable':False}for r in('authenticated','eps_jobs_owner')]}

def baseline():
 raw=load(ROOT/BASELINE);need(sha(raw)==BASELINE_SHA);v=json.loads(raw)
 need(v['action']=='readback'and v['result']=='observed_applied'and v['version']=='20261101042702'and v['target']==TARGET)
 a=load(ROOT/APPLY37);need(sha(a)==APPLY37_SHA);a=json.loads(a)
 need(a['result']=='passed'and a['normal_return_marker_observed']is True and a['independent_readback_verified']is True and a['first']==a['second'])
 need(a['static_schema_after']==v['static_schema_after']);return copy.deepcopy(v['static_schema_after'])

def catalogue_sql():
 old=prior.catalogue_sql();anchor="and p.oid is distinct from to_regprocedure('"+prior.RPC+"')";need(old.count(anchor)==1)
 return old.replace(anchor,anchor+"and p.oid is distinct from to_regprocedure('"+NEW+"')")

def batch_sql():
 metadata="jsonb_build_object('owner',pg_get_userbyid(proc.proowner),'definer',proc.prosecdef,'volatility',proc.provolatile,'config',proc.proconfig,'returns',format_type(proc.prorettype,null),'language',(select lanname from pg_language where oid=proc.prolang),'strict',proc.proisstrict,'parallel',proc.proparallel,'leakproof',proc.proleakproof,'retset',proc.proretset,'defaults',proc.pronargdefaults,'variadic',proc.provariadic::bigint,'support',proc.prosupport::oid::bigint,'kind',proc.prokind,'arguments',pg_get_function_arguments(proc.oid),'cost',proc.procost,'rows',proc.prorows,'transforms',proc.protrftypes,'binary',proc.probin,'sql_body_absent',proc.prosqlbody is null,'body_sha256',"+b.digest_sql("replace(proc.prosrc,E'\\r\\n',E'\\n')")+",'acl',"+b.acl_sql('proc')+")"
 new="(select "+metadata+"from pg_proc proc where proc.oid=to_regprocedure('"+NEW+"'))"
 old="(select jsonb_build_object('owner',pg_get_userbyid(retained.proowner),'body_sha256',"+b.digest_sql("replace(retained.prosrc,E'\\r\\n',E'\\n')")+",'metadata_sha256',"+b.digest_sql('to_jsonb(retained)')+",'defaults',retained.pronargdefaults,'definer',retained.prosecdef,'config',retained.proconfig)from pg_proc retained where retained.oid=to_regprocedure('"+OLD+"'))"
 count="(select count(*)from pg_proc prospective join pg_namespace namespace on namespace.oid=prospective.pronamespace where namespace.nspname='public'and prospective.proname='eps_list_jobs_by_batch')"
 safe="exists(select 1 from pg_roles where rolname='eps_jobs_owner'and not rolcanlogin and not rolsuper and not rolinherit and not rolbypassrls and not rolcreaterole and not rolcreatedb and not rolreplication)"
 return "jsonb_build_object('function',"+new+",'name_count',"+count+",'old_port',"+old+",'owner_safe',"+safe+",'owner_no_public_create',not has_schema_privilege('eps_jobs_owner','public','CREATE'))"

def state_sql(static_only=False):
 need(type(static_only)is bool);raw=prior.state_sql(static_only);old=prior.catalogue_sql();need(raw.count(old)==1)
 raw=raw.replace(old,catalogue_sql())
 return "select(select q.value||jsonb_build_object('batch38',"+batch_sql()+")from("+raw+" as value)q)"

def static_schema(value):return {**prior.static_schema(value),'batch38':copy.deepcopy(value['batch38'])}

def static_schema_sql():
 fields=list(b.STATIC_KEYS)+['schema','delta_metadata','claim_ports','feedback37','batch38']
 pairs=','.join(b.literal(k)+",q.value->"+b.literal(k)for k in fields)
 return "select(select case when q.value->'cli_role_safe'='true'::jsonb then jsonb_build_object("+pairs+",'control_plane',q.value->'data')else null end from("+state_sql(True)+" as value)q)"

def check_batch(value,installed):
 need(type(value)is dict and set(value)=={'function','name_count','old_port','owner_safe','owner_no_public_create'})
 need(value['function']==(FUNCTION if installed else None)and type(value['name_count'])is int and value['name_count']==int(installed)and value['owner_safe']is True and value['owner_no_public_create']is True)
 if installed:
  function=value['function']
  need(all(type(function[k])is bool for k in('definer','strict','leakproof','retset','sql_body_absent')))
  need(all(type(function[k])is int for k in('defaults','variadic','support')))
  need(all(type(function[k])in(int,float)for k in('cost','rows')))
  need(all(type(item['grantable'])is bool for item in function['acl']))
 old=value['old_port'];need(type(old)is dict and set(old)=={'owner','body_sha256','metadata_sha256','defaults','definer','config'})
 need(old['owner']=='eps_jobs_owner'and old['body_sha256']==builder.OLD_BODY_SHA and old['defaults']==4 and old['definer']is True and old['config']==['search_path=""'])
 need(type(old['metadata_sha256'])is str and re.fullmatch('[a-f0-9]{64}',old['metadata_sha256']))

def check_static(value,installed=True,expected=None):
 reference=baseline();need(type(value)is dict and set(value)==set(reference)|{'batch38'})
 check_batch(value['batch38'],installed);old={k:copy.deepcopy(v)for k,v in value.items()if k!='batch38'}
 if installed:need(old['history']==reference['history']+[VERSION]);old['history']=old['history'][:-1]
 need(old==reference);prior.check_static(old,True,reference)
 if expected is not None:need(value==expected)
 return value

def check_before(value):
 raw=load(ROOT/APPLY37);reference=json.loads(raw)['first'];need(type(value)is dict and set(value)==set(reference)|{'batch38'})
 check_static(static_schema(value),False)
 need(value['database']==value['operator']==value['session_user']=='postgres'and value['cli_role_safe']is True)
 need(value['drain']=={'other_active_jobs':0,'leased_outbox':0}and value['legacy']['unsupported_metadata_count']==0)
 need(set(value['data'])==set(b.TABLES)and len(value['data'])==74 and value['oauth']['coordinator_auth_usage']is False)
 for item in [value['trace_rows'],*value['data'].values()]:need(type(item)is dict and set(item)=={'count','sha256'}and type(item['count'])is int and item['count']>=0 and type(item['sha256'])is str and re.fullmatch('[a-f0-9]{64}',item['sha256']))

def expected_after(before):
 check_before(before);v=copy.deepcopy(before);v['history']+=[VERSION];v['batch38']['function']=copy.deepcopy(FUNCTION);v['batch38']['name_count']=1;return v

def check_transition(before,after):
 need(after==expected_after(before));check_static(static_schema(after),True)
 return {'all74_business_hashes_unchanged':True,'trace_hash_unchanged':True,'old4_full_pg_proc_unchanged':True,'only_history_and_one_new_function_changed':True,
 'English_Ready_Reviewed_media_protectedM02_preserved':True,'old_catalogue_OAuth_RLS_grants_owners_preserved':True}

def projection_sources():
 # This is the postmerge path. Deliberately never calls native_admission_sources,
 # prior.sources, old full-source admission, or any TypeScript/catalog reader.
 pins=dict(PURE_PINS)
 for f,h in pins.items():need(sha(load(ROOT/f))==h)
 for f in [ROOT/BASELINE,ROOT/APPLY37,ROOT/builder.CANDIDATE,HERE/'build_migration.py',HERE/'state.py']:
  pins[f.relative_to(ROOT).as_posix()]=sha(load(f))
 need(sha(load(ROOT/BASELINE))==BASELINE_SHA and sha(load(ROOT/APPLY37))==APPLY37_SHA)
 need(load(ROOT/MIGRATION)==SOURCE);pins[MIGRATION]=MIGRATION_SHA
 baseline();return dict(sorted(pins.items()))

def native_admission_sources():
 raw=load(ROOT/PROOF);need(sha(raw)==PROOF_SHA);v=json.loads(raw)
 need(v['run_id']=='bb9cf2bf-f3b9-4d7a-beff-47df65dfe76b'and v['result']=='passed'and v['checkpoint']=='complete')
 need(len(v['source_seals'])==376 and v.get('cleanup_unconfirmed')is not True)
 suffix=v['run_id'].replace('-','');need(v['actual_disposable_database_absence']=={'eps_m07_r33_source_'+suffix:False,'eps_m07_r33_restore_'+suffix:False})
 for k in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']:need(v[k]is True)
 for k in ['cloud_called','provider_called','runtime_configuration_loaded','canonical_business_writes']:need(v[k]is False)
 proof=v['batch_filter_sql'];need(proof['result']=='passed'and proof['candidate_sha256']==builder.CANDIDATE_SHA and proof['fixture_sha256']=='82b087a1873facc5dacbb783d00cb0ccd0d5fd9b058731926fba291ebbdb6a84')
 for k in ['actual34_to37_functional_DDL','nested37_full_state_and_session_identity_restored','old37_fixture_executed','outer_rollback_to33','synthetic_delegated_claims_SQL_enforced']:need(proof[k]is True)
 for k in ['JWT_signature_verified','real_OAuth_session_or_revocation_tested','native_media_executed','HTTP_tested','MCP_tested','cloud_called','provider_called','hosted_acceptance','restore_acceptance']:need(proof[k]is False)
 pins=projection_sources()
 for f,h in v['source_seals'].items():need(sha(load(ROOT/f))==h);pins[f]=h
 pins[PROOF]=PROOF_SHA;return dict(sorted(pins.items()))
