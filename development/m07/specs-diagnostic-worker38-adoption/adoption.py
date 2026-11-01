"""Disabled per-phase once-claim operator. Tests never invoke normal CLI."""
from pathlib import Path
import datetime
import json
import os
import re
import sys
import uuid
import importlib.util

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('worker38_adoption_state', HERE/'state.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
ROOT = s.ROOT
APPLY_ENABLED = True
PRIVATE = ROOT/'.local/m07-specs-diagnostic-worker38-adoption'
ADMISSION = HERE/'admission.json'


def need(value):
 s.need(value)


def reference(ref):
 need(type(ref) is dict and set(ref) == {'path', 'sha256'} and type(ref['path']) is str
      and ref['path'].startswith('tracking/evidence/') and re.fullmatch('[A-Za-z0-9._/-]+\\.json', ref['path'])
      and '..' not in Path(ref['path']).parts and type(ref['sha256']) is str and re.fullmatch('[a-f0-9]{64}', ref['sha256']))
 raw = s.load(ROOT/ref['path'])
 need(s.sha(raw) == ref['sha256'])
 return json.loads(raw)


def admission(phase):
 need(phase in ('pause', 'manifest', 'pin', 'resume'))
 value = json.loads(s.load(ADMISSION))
 template = json.loads(s.load(HERE/'admission.template.json'))
 need(set(value) == set(template) and value['schema_version'] == '1.0' and value['target'] == s.TARGET
      and value['old_native_image_id'] == s.OLD_IMAGE and value['old_manifest_sha256'] == s.OLD_MANIFEST
      and value['manifest_environment_id'] == s.ENVIRONMENT_ID)
 for key in ('source_sha256', 'new_manifest_sha256'):
  need(type(value[key]) is str and re.fullmatch('[a-f0-9]{64}', value[key]))
 for key in ('new_native_image_id', 'new_daemon_image_id'):
  need(type(value[key]) is str and re.fullmatch('sha256:[a-f0-9]{64}', value[key]))
 need(value['new_native_image_id'] != s.OLD_IMAGE and value['source_file_count'] == 164)
 refs = value['references']
 need(type(refs) is dict and set(refs) == set(template['references']))
 ready, native, daemon, concurrent = (reference(refs[key]) for key in ('registry_ready', 'native_probe', 'daemon_import', 'native_concurrency'))
 need(ready['read_only'] is True and ready['provider_mutations'] is False and ready['team_id'] == s.TEAM
      and ready['repository']['project_id'] == s.PROJECT and ready['repository']['public'] is False)
 need(any(row.get('manifest_digest') == value['new_native_image_id'] and row.get('status') == 'ready'
          and row.get('architecture') == 'amd64' and row.get('platform') == 'linux' for row in ready['images']['images']))
 need(daemon['result'] == 'ready_image_and_import_gate_observed' and daemon['source_sha256'] == value['source_sha256']
      and daemon['native_runtime_digest'] == value['new_native_image_id'] and daemon['daemon_runtime_digest'] == value['new_daemon_image_id']
      and daemon['baked_manifest_sha256'] == value['new_manifest_sha256'] and daemon['production_import_gate']['completed'] is True
      and daemon['production_import_gate']['build_exit_code'] == 0 and daemon['production_import_gate']['user'] == '1000:1000'
      and daemon['production_import_gate']['network'] == 'none')
 need(native['result'] == 'passed' and native['source_sha256'] == value['source_sha256'] and native['project_id'] == s.PROJECT
      and native['team_id'] == s.TEAM and native['image'] == 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+value['new_native_image_id']
      and native['cleanup_confirmed'] is True and native['initial_current_cleanup_sessions_equal'] is True and native['lock_released'] is True
      and native['private_media_used'] is False and native['db_jobs_or_openai_n8n_calls'] is False
      and native['worker_polling'] is False and native['token_persisted'] is False
      and native['probe_release']['file_count'] == 164 and native['probe_release']['source_sha256'] == value['source_sha256']
      and native['probe_release']['native_uid'] == 65432)
 resources = native['resources']
 need(type(resources) is list and len(resources) == 10 and all(type(row) is dict and row.get('session_consistency_failed') is False
      and all(row.get(key) is True for key in ('identity_observed', 'initial_current_cleanup_session_equal', 'absence_verified', 'snapshot_absence_verified')) for row in resources))
 need(len({row.get('name') for row in resources}) == 10)
 for row in resources:
  need(row.get('attempted') is True and type(row.get('name')) is str and re.fullmatch('[A-Za-z0-9_-]{1,200}', row['name'])
       and type(row.get('session_id')) is str and re.fullmatch('[A-Za-z0-9_-]{1,200}', row['session_id'])
       and row['session_id'] == row.get('initial_session_id') == row.get('current_session_id') == row.get('cleanup_session_id'))
 phases = native['phases']
 need(type(phases) is list and len(phases) == 13 and all(row.get('result') == 'passed' for row in phases)
      and [row.get('phase') for row in phases] == ['image_source_seal', 'boundary', 'image_control_user', 'network_denial',
          'smoke_document', 'smoke_document', 'smoke_pdf_raster', 'smoke_video', 'smoke_review_fit', 'smoke_presentation_render',
          'smoke_presentation_validate', 'smoke_presentation_export_render', 'smoke_presentation_export_validate'])
 by_phase = {row['phase']: row for row in phases}
 need(by_phase['image_source_seal']['source_sha256'] == value['source_sha256'] and by_phase['image_control_user']['uid'] == 0)
 boundary = by_phase['boundary']['proof']
 need(boundary['protocol'] == 'eps-native-boundary-v1' and boundary['uid'] == boundary['gid'] == 65432
      and boundary['capabilities_empty'] is True and boundary['no_new_privileges'] is True
      and boundary['known_write_denials'] == 10 and boundary['writable_outside_tmp'] == 0)
 network = by_phase['network_denial']['proof']
 need(network['protocol'] == 'eps-native-network-v1' and network['dns_denied'] is True and network['ip_denied'] is True)
 checks = native['presentation_checks']
 need(type(checks) is list and len(checks) == 4 and {row['task'] for row in checks} ==
      {'presentation_render', 'presentation_validate', 'presentation_export_render', 'presentation_export_validate'})
 for row in checks:
  need(row['page_count'] == 5 and row['video_links'] == 4 and type(row['pdf_bytes']) is int and 5 <= row['pdf_bytes'] <= 64*1024*1024)
  if row['task'].endswith('render'):
   need(row['rendered_candidate_fields'] == 40 and row['rendered_frame_draws'] == 6 and row['rendered_logo_draws'] == 5)
  else:
   need(row['validated_image_draws'] == 11)
 need(concurrent['result'] == 'passed' and concurrent['actual_native_sql_concurrency'] is True
      and concurrent['sql_contract_sha256'] == s.sql_contract_sha256())
 need(all(concurrent[key] is True for key in ('cached_intake_waited_before_snapshot', 'fresh_intake_denied_after_pause',
      'retry_lifecycle_not_hidden_by_pause', 'all_resources_cleaned', 'original_state_preserved')))
 if phase in ('pin', 'resume'):
  adopted = reference(refs['manifest_adoption'])
  need(adopted['result'] == 'passed' and adopted['target'] == s.TARGET and adopted['project_id'] == s.PROJECT
       and adopted['new_manifest_sha256'] == value['new_manifest_sha256'] and adopted['same_environment_id_preserved'] is True
       and adopted['other_environment_metadata_preserved'] is True and adopted['normal_return_observed'] is True
       and adopted['two_readbacks_equal'] is True)
 if phase == 'resume':
  worker = reference(refs['worker_ready'])
  need(worker['result'] == 'passed' and worker['project_id'] == s.PROJECT and worker['team_id'] == s.TEAM
       and worker['source_sha256'] == value['source_sha256'] and worker['native_image_id'] == value['new_native_image_id']
       and worker['daemon_image_id'] == value['new_daemon_image_id'] and worker['new_deployment_ready'] is True
       and worker['old_instances_absent'] is True and worker['native_cleanup_confirmed'] is True
       and worker['ready_alive_instances'] == 1 and worker['memory_mib'] == 2048 and worker['region'] == 'dub1')
 return value


def private_write(path, value):
 PRIVATE.mkdir(parents=True, exist_ok=True)
 guard = s.s.b.security()
 with guard.create(path) as stream:
  guard.verify_open(stream)
  stream.write((json.dumps(value, sort_keys=True)+'\n').encode())
  stream.flush()
  os.fsync(stream.fileno())
  guard.verify_open(stream)


def private_read(path):
 s.s.b.security().verify(path)
 return json.loads(s.load(path))


def query(sql):
 need((ROOT/'supabase/.temp/project-ref').read_text().strip() == s.TARGET)
 reader = s.module('worker38_normal_bounded_cli', ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
 need(not any(os.environ.get(key) for key in ('SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD')))
 path = PRIVATE/(str(uuid.uuid4())+'.sql')
 PRIVATE.mkdir(parents=True, exist_ok=True)
 guard = s.s.b.security()
 with guard.create(path) as stream:
  stream.write(sql.encode())
  stream.flush()
  os.fsync(stream.fileno())
  guard.verify_open(stream)
 command = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', s.TARGET,
            '--file', str(path), '--output-format', 'json', '--workdir', str(ROOT)]
 code, timeout, overflow, stdout, _stderr = reader.bounded(command, reader.environment())
 need(code == 0 and not timeout and not overflow)
 payload = json.loads(stdout)
 rows = payload if type(payload) is list else payload.get('rows') if type(payload) is dict else None
 need(type(rows) is list and len(rows) == 1 and type(rows[0]) is dict and set(rows[0]) == {'worker38_adoption'})
 return rows[0]['worker38_adoption']


def read_snapshot():
 return s.check(query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+s.snapshot_sql()+" as worker38_adoption;rollback;"))


def source_pins():
 pins = s.sources()
 pins[ADMISSION.relative_to(ROOT).as_posix()] = s.sha(s.load(ADMISSION))
 return pins


def prior_phase(phase, current, accepted):
 """Keep the entire paused-window DB baseline; fresh plans cannot waive drift."""
 if phase == 'pause':
  return
 predecessor = 'pause' if phase in ('manifest', 'pin') else 'pin'
 claim_path = PRIVATE/(predecessor+'.claim.json')
 previous = private_read(claim_path)
 returned = private_read(PRIVATE/(predecessor+'.returned.json'))
 need(returned == {'claim_sha256': s.sha(s.load(claim_path)), 'normal_return_marker_observed': True})
 old_admission = previous['admission']
 need({k: v for k, v in old_admission.items() if k != 'references'} == {k: v for k, v in accepted.items() if k != 'references'})
 need(all(old_admission['references'][key] == accepted['references'][key] for key in ('registry_ready', 'native_probe', 'daemon_import', 'native_concurrency')))
 need(s.transition(previous['before'], current, predecessor, accepted['new_native_image_id']))
 if predecessor == 'pin':
  prior_phase('pin', previous['before'], accepted)


def apply_phase(phase, plan):
 need(APPLY_ENABLED and phase in ('pause', 'pin', 'resume'))
 claim_path, returned_path = PRIVATE/(phase+'.claim.json'), PRIVATE/(phase+'.returned.json')
 need(not claim_path.exists() and not returned_path.exists())
 accepted, pins = admission(phase), source_pins()
 need(plan['phase'] == phase and plan['source_pins'] == pins and plan['admission'] == accepted)
 before = plan['before']
 s.phase_before(before, phase, accepted['new_native_image_id'])
 prior_phase(phase, before, accepted)
 need(read_snapshot() == before)
 marker = str(uuid.uuid4())
 private_write(claim_path, {**plan, 'marker': marker, 'dispatch_may_have_occurred': True, 'automatic_retry': False})
 result = {'result': 'unconfirmed', 'normal_return_marker_observed': False, 'independent_readback_verified': False,
           'phase': phase, 'claim_retained': True, 'source_pins': pins}
 try:
  need(source_pins() == pins and admission(phase) == accepted and read_snapshot() == before)
  prior_phase(phase, before, accepted)
  returned = query(s.render(phase, before, accepted['new_native_image_id'], marker))
  need(returned == {'phase': phase, 'marker': marker})
  private_write(returned_path, {'claim_sha256': s.sha(s.load(claim_path)), 'normal_return_marker_observed': True})
  result['normal_return_marker_observed'] = True
 except Exception:
  result['safe_error'] = 'WORKER38_ADOPTION_DISPATCH_UNCONFIRMED'
 try:
  first, second = read_snapshot(), read_snapshot()
  need(first == second and s.transition(before, first, phase, accepted['new_native_image_id']))
  result.update(first=first, second=second, independent_readback_verified=True)
 except Exception:
  result['readback_error'] = 'WORKER38_ADOPTION_STATE_UNCONFIRMED'
 if result['normal_return_marker_observed'] and result['independent_readback_verified']:
  result['result'] = 'passed'
 return result


def save(value):
 path = ROOT/'tracking/evidence/m07/specs-diagnostic-worker38-adoption'
 path.mkdir(parents=True, exist_ok=True)
 stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')
 with (path/(stamp+'-'+value['phase']+'.json')).open('x', encoding='utf8', newline='\n') as stream:
  json.dump({'target': s.TARGET, 'provider_called': False, 'business_content_mutated': False, **value}, stream, sort_keys=True, indent=2)
  stream.write('\n')
 return value


def main():
 need(APPLY_ENABLED and len(sys.argv) == 3 and sys.argv[1] in ('inspect', 'apply', 'readback') and sys.argv[2] in ('pause', 'pin', 'resume'))
 action, phase = sys.argv[1:]
 accepted, pins = admission(phase), source_pins()
 plan_path = PRIVATE/(phase+'.plan.json')
 if action == 'inspect':
  need(not plan_path.exists() and not (PRIVATE/(phase+'.claim.json')).exists())
  before = read_snapshot()
  s.phase_before(before, phase, accepted['new_native_image_id'])
  prior_phase(phase, before, accepted)
  private_write(plan_path, {'phase': phase, 'before': before, 'admission': accepted, 'source_pins': pins})
  return save({'result': 'prepared', 'phase': phase, 'before': before, 'source_pins': pins})
 if action == 'apply':
  return save(apply_phase(phase, private_read(plan_path)))
 claim_path = PRIVATE/(phase+'.claim.json')
 claim = private_read(claim_path)
 need(claim['source_pins'] == pins and claim['admission'] == accepted and claim['phase'] == phase)
 first, second = read_snapshot(), read_snapshot()
 need(first == second and s.transition(claim['before'], first, phase, accepted['new_native_image_id']))
 return save({'result': 'observed_applied', 'phase': phase, 'first': first, 'second': second, 'claim_retained': True,
              'normal_return_not_inferred': True, 'source_pins': pins})


if __name__ == '__main__':
 try:
  print(json.dumps(main()))
 except Exception:
  print('WORKER38_ADOPTION_UNCONFIRMED')
  sys.exit(1)
