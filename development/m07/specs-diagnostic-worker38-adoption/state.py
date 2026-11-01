"""Pure current38 adoption projection and SQL. Import performs no dispatch."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import re

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
TARGET = 'pyibofyctwnqpvktepse'
PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6'
TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1'
OLD_IMAGE = 'sha256:795f8f7736594fb51cc0c304d85bae9d29f31861e606eec0c2a83806fff5d3b9'
PROTECTED = 'b3f90268-147d-41d4-8875-2a6435df1496'
BASE = 'development/m07/job-batch-filter38-release/state.py'
BASE_SHA = '7bc47bf8589a6a211497073d25d7621688c0126f195fd40e382324e72ce5d06f'
BASELINE = 'tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-42-546410Z-readback.json'
BASELINE_SHA = '1950fd161e98e4fdb37fe039a753230b73764c8a6721f1ce6f03f55896371a53'
INVENTORY = 'tracking/evidence/m07/specs-diagnostic-worker38/2026-11-01T17-55-03-096505Z-drain-inventory.json'
INVENTORY_SHA = 'b603395ad914e920e88907d85439b2f701a9f52f42cbea4707d15b4d018012d7'
ENV_BASELINE = 'tracking/evidence/m03/english-release34/2026-10-31T17-42-47-678456Z-native-manifest-readback.json'
ENV_BASELINE_SHA = 'e773a2c07b7e5af428275019c4b29c860fd3790f0c4b96e76baa36c1c229740c'
OLD_MANIFEST = '0a24eadb8d256bcededdb4d46100b1557db1c6777eaaeed4bc67df431d40b000'
ENVIRONMENT_ID = 'O1l5qVwaJ6VYRhm9'
CONFIG = {
 'specs_pipeline_config': ('id enabled document_preparation_version model_version prompt_version result_schema_version', 'id enabled'),
 'candidate_asset_config': ('id enabled transcription_model extraction_model prompt_version schema_version media_implementation_version english_transcript_version', 'id enabled english_transcript_version'),
 'frame_extraction_config': ('id enabled native_image_id implementation_version', 'id enabled native_image_id implementation_version'),
 'review_processing_config': ('id enabled model prompt_version renderer_version', 'id enabled'),
 'presentation_processing_config': ('id enabled renderer_version application_origin max_manifest_bytes max_pdf_bytes max_pages', 'id enabled'),
}
COUNTERS = ('queued', 'running', 'waiting_for_input', 'generic_retry_lifecycle', 'presentation_retry_lifecycle', 'pending_outbox', 'leased_outbox')


def need(value):
 if not value:
  raise ValueError('WORKER38_ADOPTION_UNCONFIRMED')


def sha(raw):
 return hashlib.sha256(raw).hexdigest()


def load(path, maximum=8*1024*1024):
 need(path.is_file() and not path.is_symlink() and not path.is_junction() and path.resolve() == path
      and path.stat().st_nlink == 1 and path.stat().st_size <= maximum)
 return path.read_bytes()


def module(name, path):
 spec = importlib.util.spec_from_file_location(name, path)
 value = importlib.util.module_from_spec(spec)
 spec.loader.exec_module(value)
 return value


need(sha(load(ROOT/BASE)) == BASE_SHA)
s = module('worker38_unchanged_pure_projection', ROOT/BASE)


def sources():
 # Finite SQL/Python projection only. Never call native376 or an old main().
 pins = s.projection_sources()
 need(pins[BASE] == BASE_SHA)
 for relative, expected in [(BASELINE, BASELINE_SHA), (INVENTORY, INVENTORY_SHA), (ENV_BASELINE, ENV_BASELINE_SHA)]:
  need(sha(load(ROOT/relative)) == expected)
  pins[relative] = expected
 for name in ['state.py', 'adoption.py', 'manifest.py', 'test_adoption.py', 'README.md', 'admission.template.json']:
  relative = (HERE/name).relative_to(ROOT).as_posix()
  pins[relative] = sha(load(HERE/name))
 return dict(sorted(pins.items()))


def lifecycle_sql():
 # No enabled/capability predicate: pausing must never conceal a retry candidate.
 ordinary = "kind not in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null and coalesce((error->>'retryable')::boolean,false)and coalesce((stage_attempts->>stage)::integer,0)<3"
 presentation = "kind in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null and error->>'code'is distinct from'JOB_CANCELLED'"
 terms = []
 for name in ('queued', 'running', 'waiting_for_input'):
  terms += [s.b.literal(name), "(select count(*)from eps.jobs where id<>'"+PROTECTED+"'and status='"+name+"')"]
 for name, predicate in [('generic_retry_lifecycle', ordinary), ('presentation_retry_lifecycle', presentation)]:
  terms += [s.b.literal(name), "(select count(*)from eps.jobs where id<>'"+PROTECTED+"'and "+predicate+")"]
 for name, status in [('pending_outbox', 'pending'), ('leased_outbox', 'leased')]:
  terms += [s.b.literal(name), "(select count(*)from eps.outbox_events where status='"+status+"')"]
 return 'jsonb_build_object('+','.join(terms)+')'


def config_sql():
 terms = []
 for table, (all_fields, public_fields) in CONFIG.items():
  public = ','.join(s.b.literal(field)+',row_value.'+field for field in public_fields.split())
  keys = 'array['+','.join(s.b.literal(field) for field in sorted(all_fields.split()))+']::text[]'
  mutable = "array['enabled','native_image_id']::text[]" if table == 'frame_extraction_config' else "array['enabled']::text[]"
  # Only the explicit public object leaves SQL. Full/fixed row hashes stay opaque.
  row = "jsonb_build_object('public',jsonb_build_object("+public+"),'shape_valid',(select array_agg(k order by k)from jsonb_object_keys(to_jsonb(row_value))k)="+keys+",'fixed_sha256',"+s.b.digest_sql('to_jsonb(row_value)-'+mutable)+",'table_hash',"+s.b.digest_sql(s.b.digest_sql('to_jsonb(row_value)'))+")"
  terms += [s.b.literal(table), '(select case when count(*)=1 then jsonb_agg('+row+')->0 else null end from eps.'+table+' row_value)']
 return 'jsonb_build_object('+','.join(terms)+')'


def snapshot_sql():
 return "select(select jsonb_build_object('state',q.value,'config',"+config_sql()+",'lifecycle',"+lifecycle_sql()+")from("+s.state_sql(False)+' as value)q)'


def comparable(value):
 value = copy.deepcopy(value)
 for table in CONFIG:
  del value['state']['data'][table]
  del value['config'][table]['table_hash']
 return value


def comparable_sql():
 result = 'q.value'
 for table in CONFIG:
  result += " #- '{state,data,"+table+"}' #- '{config,"+table+",table_hash}'"
 return 'select(select '+result+' from('+snapshot_sql()+' as value)q)'


def check(value):
 need(type(value) is dict and set(value) == {'state', 'config', 'lifecycle'})
 need(type(value['config']) is dict and set(value['config']) == set(CONFIG))
 need(type(value['lifecycle']) is dict and set(value['lifecycle']) == set(COUNTERS))
 need(all(type(value['lifecycle'][key]) is int and value['lifecycle'][key] == 0 for key in COUNTERS))
 full = value['state']
 need(full['database'] == full['operator'] == full['session_user'] == 'postgres' and full['cli_role_safe'] is True)
 need(len(full['history']) == 38 and full['history'][-1] == '20261101110939')
 need(full['protected_m02_integrity'] is True and full['english']['flags'] == ['1.0'])
 for table, (_, public_fields) in CONFIG.items():
  row = value['config'][table]
  need(type(row) is dict and set(row) == {'public', 'shape_valid', 'fixed_sha256', 'table_hash'} and row['shape_valid'] is True)
  need(type(row['public']) is dict and set(row['public']) == set(public_fields.split()) and type(row['public']['enabled']) is bool)
  need(type(row['public']['id']) is (int if table == 'specs_pipeline_config' else bool)
       and row['public']['id'] == (1 if table == 'specs_pipeline_config' else True))
  for key in ('fixed_sha256', 'table_hash'):
   need(type(row[key]) is str and re.fullmatch('[a-f0-9]{64}', row[key]))
  need(full['data'][table] == {'count': 1, 'sha256': row['table_hash']})
 need(value['config']['candidate_asset_config']['public']['english_transcript_version'] == '1.0')
 need(value['config']['frame_extraction_config']['public']['implementation_version'] == 'frame-extraction.v1')
 return value


def phase_before(value, phase, image):
 check(value)
 need(phase in ('pause', 'pin', 'resume') and re.fullmatch('sha256:[a-f0-9]{64}', image) and image != OLD_IMAGE)
 need(all(row['public']['enabled'] is (phase == 'pause') for row in value['config'].values()))
 need(value['config']['frame_extraction_config']['public']['native_image_id'] == (image if phase == 'resume' else OLD_IMAGE))
 if phase == 'pause':
  s.check_static(s.static_schema(value['state']))


def expected(value, phase, image):
 phase_before(value, phase, image)
 result = comparable(value)
 if phase in ('pause', 'resume'):
  for row in result['config'].values():
   row['public']['enabled'] = phase == 'resume'
 else:
  result['config']['frame_extraction_config']['public']['native_image_id'] = image
 return result


def transition(before, after, phase, image):
 check(after)
 need(comparable(after) == expected(before, phase, image))
 return True


def transaction_prefix():
 configs = ','.join('eps.'+table for table in sorted(CONFIG))
 other = sorted(set(s.b.TABLES)-set(CONFIG))
 tables = ','.join(table if table.startswith('public.') else 'eps.'+table for table in other)
 # LOCK precedes every data SELECT/snapshot. No provider call occurs in this SQL.
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table "+configs+" in access exclusive mode;lock table supabase_migrations.schema_migrations in share mode;lock table "+tables+",eps.job_stage_attempts in share mode;\n"


def render(phase, before, image, marker):
 import uuid
 need(str(uuid.UUID(marker)) == marker)
 after = expected(before, phase, image)
 sql = transaction_prefix()+s.b.old.assertion(snapshot_sql(), before, 'WORKER38_ADOPTION_PREFLIGHT_CHANGED')
 for table in sorted(CONFIG) if phase != 'pin' else ['frame_extraction_config']:
  assignment = "native_image_id="+s.b.literal(image) if phase == 'pin' else 'enabled='+str(phase == 'resume').lower()
  sql += "do $worker38_update$declare changed integer;begin update eps."+table+' set '+assignment+";get diagnostics changed=row_count;if changed<>1 then raise exception'WORKER38_ADOPTION_ONE_CONFIG_REQUIRED';end if;end$worker38_update$;\n"
 sql += s.b.old.assertion(comparable_sql(), after, 'WORKER38_ADOPTION_POSTCONDITION_FAILED')
 return sql+"commit;select jsonb_build_object('phase',"+s.b.literal(phase)+",'marker',"+s.b.literal(marker)+")as worker38_adoption;"


def sql_contract_sha256():
 return sha(load(Path(__file__).resolve()))
