"""Default-off pure pre-dispatch availability contract. No CLI/SQL/provider IO."""
from pathlib import Path
import copy
import datetime
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
STATE = ROOT/'development/m07/specs-diagnostic-worker38-adoption/state.py'
STATE_SHA = '690ae972ab0481026c139af5bcbf42017aa2fe63144f2981bd035dd139bbe8ff'
if hashlib.sha256(STATE.read_bytes()).hexdigest() != STATE_SHA:
 raise ValueError('WORKER38_AVAILABILITY_SOURCE_CHANGED')
spec = importlib.util.spec_from_file_location('worker38_frozen_availability_state', STATE)
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
RENDER_ENABLED = False
OLD_DEPLOYMENT = 'dpl_2uASsbYobSDwWjMptPjGLcVEdCg3'
OLD_DAEMON = 'sha256:430d0992ef3280f13fb52ff206d0ae09eedb2fee0831583f868db77d4012f12f'
MAX_AGE = datetime.timedelta(seconds=30)


def need(value):
 if not value:
  raise ValueError('WORKER38_OLD_FLAGS_UNCONFIRMED')


def fresh(stamp, now):
 need(type(now) is datetime.datetime and now.utcoffset() == datetime.timedelta(0) and type(stamp) is str)
 observed = datetime.datetime.fromisoformat(stamp.replace('Z', '+00:00'))
 need(observed.utcoffset() == datetime.timedelta(0) and datetime.timedelta(0) <= now-observed <= MAX_AGE)


def worker(value, now):
 fresh(value['observed_at'], now)
 need(value['project_id'] == s.PROJECT and value['team_id'] == s.TEAM
      and value['active_production_deployment_id'] == OLD_DEPLOYMENT)
 row = value['worker']
 need(row['project_id'] == s.PROJECT and row['team_id'] == s.TEAM and row['daemon'] == 'worker'
      and row['environment'] == 'production' and row['deployment_id'] == OLD_DEPLOYMENT and row['status'] == 'ready'
      and row['requested_image']['digest'] == row['resolved_image']['digest'] == OLD_DAEMON
      and row['configured_instances'] == {'dub1': 1} and row['configured_override'] is None
      and row['memory_mib'] == 2048 and row['termination_grace_seconds'] == 300
      and all(type(row[key]) is int and row[key] == 1 for key in ('desired', 'ready', 'total'))
      and type(row['instances']) is list and len(row['instances']) == 1)
 instance = row['instances'][0]
 need(type(instance['id']) is str and re.fullmatch('dmni_[A-Za-z0-9_-]{1,128}', instance['id'])
      and instance['alive'] is True and instance['image']['digest'] == OLD_DAEMON
      and instance['region'] == 'dub1' and instance['memory_mib'] == 2048 and instance['stopped_at_ms'] is None)
 for key in ('started_at_ms', 'last_checked_at_ms'):
  need(type(instance[key]) is int and 0 < instance[key] <= int(now.timestamp()*1000))
 need(instance['started_at_ms'] <= instance['last_checked_at_ms'])
 need(datetime.timedelta(milliseconds=int(now.timestamp()*1000)-instance['last_checked_at_ms']) <= MAX_AGE)
 return {'deployment': OLD_DEPLOYMENT, 'image': OLD_DAEMON, 'instance': instance['id'], 'started_at_ms': instance['started_at_ms']}


def environment(value):
 need(type(value) is dict and set(value) == {'metadata', 'environment_id', 'manifest_sha256'}
      and value['environment_id'] == s.ENVIRONMENT_ID and type(value['manifest_sha256']) is str
      and re.fullmatch('[a-f0-9]{64}', value['manifest_sha256']) and type(value['metadata']) is list
      and 1 <= len(value['metadata']) <= 100)
 rows = {}
 for row in value['metadata']:
  need(type(row) is dict and set(row) == {'id', 'key', 'type', 'target', 'gitBranch', 'createdAt', 'updatedAt'}
       and type(row['id']) is str and re.fullmatch('[A-Za-z0-9_-]{1,128}', row['id']) and row['id'] not in rows
       and type(row['key']) is str and re.fullmatch('[A-Z][A-Z0-9_]{0,99}', row['key'])
       and row['type'] in ('encrypted', 'sensitive', 'plain', 'system', 'secret') and row['gitBranch'] is None
       and type(row['target']) is list and all(item in ('production', 'preview', 'development') for item in row['target'])
       and type(row['createdAt']) is int and type(row['updatedAt']) is int)
  rows[row['id']] = row
 selected = rows.get(s.ENVIRONMENT_ID)
 need(selected is not None and selected['key'] == 'EPS_NATIVE_MANIFEST_SHA256'
      and selected['type'] == 'plain' and selected['target'] == ['production']
      and sum(row['key'] == selected['key'] for row in rows.values()) == 1)
 return rows


def expected(paused, evidence, now):
 need(type(evidence) is dict and set(evidence) == {'pause_claim_bytes', 'pause_returned', 'old_worker',
      'environment_before', 'environment', 'new_manifest_sha256', 'new_deployment_dispatch_claim_absent'})
 # A pending/unknown deployment could later replace the old worker. This
 # contract is usable only before its exclusive dispatch claim is created.
 need(evidence['new_deployment_dispatch_claim_absent'] is True)
 raw = evidence['pause_claim_bytes']
 need(type(raw) is bytes and 0 < len(raw) <= 8*1024*1024)
 claim = json.loads(raw)
 need(type(claim) is dict and set(claim) == {'phase', 'before', 'admission', 'source_pins', 'marker',
      'dispatch_may_have_occurred', 'automatic_retry'} and claim['phase'] == 'pause'
      and claim['dispatch_may_have_occurred'] is True and claim['automatic_retry'] is False
      and str(uuid.UUID(claim['marker'])) == claim['marker'])
 need(evidence['pause_returned'] == {'claim_sha256': s.sha(raw), 'normal_return_marker_observed': True}
      and evidence['pause_returned']['normal_return_marker_observed'] is True)
 need(all(claim['source_pins'].get(key) == value for key, value in s.sources().items()))
 admitted = claim['admission']
 need(type(evidence['new_manifest_sha256']) is str and re.fullmatch('[a-f0-9]{64}', evidence['new_manifest_sha256'])
      and admitted['target'] == s.TARGET and admitted['new_manifest_sha256'] == evidence['new_manifest_sha256'])
 s.transition(claim['before'], paused, 'pause', admitted['new_native_image_id'])
 need(paused['config']['frame_extraction_config']['public']['native_image_id'] == s.OLD_IMAGE)
 workers, environments = evidence['old_worker'], evidence['environment']
 need(type(workers) is list and len(workers) == 2 and type(environments) is list and len(environments) == 2)
 need(worker(workers[0], now) == worker(workers[1], now))
 baseline = evidence['environment_before']
 old_rows = environment(baseline)
 need(baseline['manifest_sha256'] == s.OLD_MANIFEST)
 current = []
 for observation in environments:
  fresh(observation['observed_at'], now)
  need(observation['project_id'] == s.PROJECT and observation['team_id'] == s.TEAM)
  value = observation['current']
  rows = environment(value)
  need(value['manifest_sha256'] in (s.OLD_MANIFEST, evidence['new_manifest_sha256']) and rows.keys() == old_rows.keys())
  for identity in old_rows:
   ignore = {'updatedAt'} if identity == s.ENVIRONMENT_ID else set()
   need({k: v for k, v in old_rows[identity].items() if k not in ignore}
        == {k: v for k, v in rows[identity].items() if k not in ignore})
  current.append(value)
 need(current[0] == current[1])
 result = copy.deepcopy(s.comparable(paused))
 for row in result['config'].values():
  row['public']['enabled'] = True
 need(result == s.comparable(claim['before']))
 return result


def transition(paused, after, evidence, now):
 s.check(after)
 need(s.comparable(after) == expected(paused, evidence, now))
 return True


def render(paused, evidence, marker, now):
 need(RENDER_ENABLED and str(uuid.UUID(marker)) == marker)
 after = expected(paused, evidence, now)
 sql = s.transaction_prefix()+s.s.b.old.assertion(s.snapshot_sql(), paused, 'WORKER38_OLD_FLAGS_PREFLIGHT_CHANGED')
 for table in sorted(s.CONFIG):
  sql += "do $oldflags38$declare changed integer;begin update eps."+table+" set enabled=true;get diagnostics changed=row_count;if changed<>1 then raise exception'WORKER38_OLD_FLAGS_ONE_CONFIG_REQUIRED';end if;end$oldflags38$;\n"
 sql += s.s.b.old.assertion(s.comparable_sql(), after, 'WORKER38_OLD_FLAGS_POSTCONDITION_FAILED')
 return sql+"commit;select jsonb_build_object('phase','old_flags','marker',"+s.s.b.literal(marker)+")as worker38_availability;"
