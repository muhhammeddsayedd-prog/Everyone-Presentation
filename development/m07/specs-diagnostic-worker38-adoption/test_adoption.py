"""Inert public-source/AST/fake-dispatch tests. No SQL/CLI/provider/private IO."""
from pathlib import Path
import copy
import importlib.util
import json
import re
import sys
import unittest
import uuid
from unittest.mock import Mock, patch
from pglast import ast, parse_sql, parse_plpgsql
from pglast.stream import RawStream

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('worker38_adoption_tests', HERE/'adoption.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
s = a.s
manifest = s.module('worker38_manifest_tests', HERE/'manifest.py')
IMAGE = 'sha256:'+'a'*64


def fixture():
 public = json.loads(s.load(s.ROOT/'tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-00-388406Z-apply.json'))
 full = copy.deepcopy(public['first'])
 configs = {}
 for table, (_, fields) in s.CONFIG.items():
  row = {'id': 1 if table == 'specs_pipeline_config' else True, 'enabled': True}
  if table == 'candidate_asset_config':
   row['english_transcript_version'] = '1.0'
  if table == 'frame_extraction_config':
   row.update(native_image_id=s.OLD_IMAGE, implementation_version='frame-extraction.v1')
  assert set(row) == set(fields.split())
  configs[table] = {'public': row, 'shape_valid': True, 'fixed_sha256': 'f'*64, 'table_hash': full['data'][table]['sha256']}
 return {'state': full, 'config': configs, 'lifecycle': dict.fromkeys(s.COUNTERS, 0)}


def after(before, phase):
 value = copy.deepcopy(before)
 if phase == 'pin':
  value['config']['frame_extraction_config']['public']['native_image_id'] = IMAGE
 else:
  for row in value['config'].values():
   row['public']['enabled'] = phase == 'resume'
 for table in s.CONFIG:
  value['config'][table]['table_hash'] = 'e'*64
  value['state']['data'][table]['sha256'] = 'e'*64
 return value


class Tests(unittest.TestCase):
 def test_disabled_gates_refuse_before_private_inputs_or_dispatch(self):
  for subject, gate in [(a, 'APPLY_ENABLED'), (manifest, 'PATCH_ENABLED')]:
   self.assertIs(getattr(subject, gate), False)
   with patch.object(sys, 'argv', ['operator', 'apply', 'pause']), patch.object(a, 'admission') as admitted, patch.object(a, 'query') as query, patch.object(manifest, 'command') as command:
    with self.assertRaises(ValueError):
     subject.main()
    admitted.assert_not_called()
    query.assert_not_called()
    command.assert_not_called()

 def test_null_evidence_cannot_admit_and_resume_ready_is_phase_specific(self):
  raw = s.load(HERE/'admission.template.json')
  with patch.object(s, 'load', side_effect=lambda path: raw):
   for phase in ('pause', 'manifest', 'pin', 'resume'):
    with self.assertRaises(ValueError):
     a.admission(phase)
  source = (HERE/'adoption.py').read_text()
  self.assertLess(source.index("if phase == 'resume':"), source.index("worker = reference(refs['worker_ready'])"))

 def test_config_and_lifecycle_projection_parse_without_raw_config_outputs(self):
  parse_sql(s.snapshot_sql())
  parse_sql(s.comparable_sql())
  self.assertNotIn("'public',to_jsonb", s.config_sql())
  self.assertIn("'fixed_sha256'", s.config_sql())
  self.assertIn("'shape_valid'", s.config_sql())
  lifecycle = s.lifecycle_sql()
  self.assertNotIn('enabled', lifecycle)
  self.assertNotIn('has_capability', lifecycle)
  self.assertIn("kind in('presentation_render','presentation_export')", lifecycle)
  self.assertIn("error->>'code'is distinct from'JOB_CANCELLED'", lifecycle)

 def test_pause_locks_config_before_every_snapshot_and_no_provider_inside_sql(self):
  before = fixture()
  sql = s.render('pause', before, IMAGE, str(uuid.uuid4()))
  self.assertLess(sql.index('in access exclusive mode;'), sql.index('select'))
  self.assertLess(sql.index('WORKER38_ADOPTION_PREFLIGHT_CHANGED'), sql.index('do $worker38_update$'))
  self.assertLess(sql.index('WORKER38_ADOPTION_POSTCONDITION_FAILED'), sql.index('commit;'))
  self.assertNotIn('english_transcript_version=', sql)
  self.assertNotIn('supabase_migrations.schema_migrations(', sql)
  for node in parse_sql(sql):
   if isinstance(node.stmt, ast.DoStmt):
    parse_plpgsql(RawStream()(node.stmt))
  for phase, previous in [('pin', after(before, 'pause')), ('resume', after(after(before, 'pause'), 'pin'))]:
   for node in parse_sql(s.render(phase, previous, IMAGE, str(uuid.uuid4()))):
    if isinstance(node.stmt, ast.DoStmt):
     parse_plpgsql(RawStream()(node.stmt))

 def test_exact_phases_preserve_English_and_only_known_boolean_pin_deltas(self):
  active = fixture()
  paused = after(active, 'pause')
  pinned = after(paused, 'pin')
  resumed = after(pinned, 'resume')
  self.assertTrue(s.transition(active, paused, 'pause', IMAGE))
  self.assertTrue(s.transition(paused, pinned, 'pin', IMAGE))
  self.assertTrue(s.transition(pinned, resumed, 'resume', IMAGE))
  self.assertEqual(resumed['config']['candidate_asset_config']['public']['english_transcript_version'], '1.0')
  for value in [paused, pinned, resumed]:
   for mutate in [lambda v: v['state']['data']['jobs'].update(sha256='0'*64),
                  lambda v: v['state']['trace_rows'].update(count=v['state']['trace_rows']['count']+1),
                  lambda v: v['config']['candidate_asset_config'].update(fixed_sha256='0'*64),
                  lambda v: v['config']['candidate_asset_config']['public'].update(english_transcript_version=None),
                  lambda v: v['config']['candidate_asset_config'].update(shape_valid=False),
                  lambda v: v['lifecycle'].update(presentation_retry_lifecycle=1)]:
    bad = copy.deepcopy(value)
    mutate(bad)
    with self.assertRaises(ValueError):
     s.transition(active, bad, 'pause', IMAGE)

 def test_manual_retries_and_upload_reservation_drift_are_not_waived(self):
  before = fixture()
  for counter in s.COUNTERS:
   value = after(before, 'pause')
   value['lifecycle'][counter] = 1
   with self.assertRaises(ValueError):
    s.check(value)
  changed = after(before, 'pause')
  changed['state']['data']['specs_upload_sessions']['sha256'] = '0'*64
  with self.assertRaises(ValueError):
   s.transition(before, changed, 'pause', IMAGE)

 def test_unknown_dispatch_retains_claim_and_cannot_be_replayed_as_pass(self):
  before, pins, admitted = fixture(), {'synthetic': 'a'*64}, {'new_native_image_id': IMAGE}
  after_value = after(before, 'pause')
  plan = {'phase': 'pause', 'before': before, 'source_pins': pins, 'admission': admitted}
  with patch.object(a, 'APPLY_ENABLED', True), patch.object(a, 'PRIVATE', Mock(__truediv__=lambda self, other: Mock(exists=lambda: False))), patch.object(a, 'admission', return_value=admitted), patch.object(a, 'source_pins', return_value=pins), patch.object(a, 'read_snapshot', side_effect=[before, before, after_value, after_value]), patch.object(a, 'private_write') as writes, patch.object(a, 'query', side_effect=TimeoutError('PRIVATE_PROVIDER')) as dispatch:
   result = a.apply_phase('pause', plan)
  self.assertEqual(result['result'], 'unconfirmed')
  self.assertFalse(result['normal_return_marker_observed'])
  self.assertTrue(result['independent_readback_verified'])
  self.assertEqual(dispatch.call_count, 1)
  self.assertEqual(writes.call_count, 1)
  self.assertNotIn('PRIVATE', json.dumps(result))

 def test_normal_return_needs_two_equal_reads_and_permanent_claim_blocks_replay(self):
  class MemoryPath:
   def __init__(self, key, store):
    self.key, self.store = key, store
   def __truediv__(self, name):
    return MemoryPath(self.key+'/'+name, self.store)
   def exists(self):
    return self.key in self.store
  store = {}
  before, pins, admitted = fixture(), {'synthetic': 'a'*64}, {'new_native_image_id': IMAGE}
  after_value = after(before, 'pause')
  plan = {'phase': 'pause', 'before': before, 'source_pins': pins, 'admission': admitted}
  original_load = s.load
  def load(path, maximum=8*1024*1024):
   return store[path.key] if isinstance(path, MemoryPath) else original_load(path, maximum)
  def write(path, value):
   self.assertFalse(path.exists())
   store[path.key] = json.dumps(value, sort_keys=True).encode()
  def dispatch(sql):
   marker = re.search("jsonb_build_object\\('phase','pause','marker','([^']+)'", sql).group(1)
   return {'phase': 'pause', 'marker': marker}
  with patch.object(a, 'APPLY_ENABLED', True), patch.object(a, 'PRIVATE', MemoryPath('synthetic', store)), patch.object(a, 'admission', return_value=admitted), patch.object(a, 'source_pins', return_value=pins), patch.object(a, 'read_snapshot', side_effect=[before, before, after_value, after_value]), patch.object(a, 'private_write', side_effect=write), patch.object(a, 'query', side_effect=dispatch) as called, patch.object(s, 'load', side_effect=load):
   result = a.apply_phase('pause', plan)
   self.assertEqual(result['result'], 'passed')
   self.assertTrue(result['normal_return_marker_observed'])
   self.assertTrue(result['independent_readback_verified'])
   with self.assertRaises(ValueError):
    a.apply_phase('pause', plan)
   self.assertEqual(called.call_count, 1)
   self.assertEqual(len(store), 2)

 def test_actual_prerequisites_are_phase_specific_without_circular_worker_ready(self):
  template = json.loads(s.load(HERE/'admission.template.json'))
  value = copy.deepcopy(template)
  value.update(source_sha256='a'*64, new_native_image_id=IMAGE, new_daemon_image_id='sha256:'+'b'*64, new_manifest_sha256='c'*64)
  refs = {key: {'path': 'tracking/evidence/synthetic/'+key+'.json', 'sha256': 'd'*64} for key in value['references']}
  for key in ('registry_ready', 'native_probe', 'daemon_import', 'native_concurrency'):
   value['references'][key] = refs[key]
  phase_names = ['image_source_seal', 'boundary', 'image_control_user', 'network_denial', 'smoke_document', 'smoke_document',
                 'smoke_pdf_raster', 'smoke_video', 'smoke_review_fit', 'smoke_presentation_render', 'smoke_presentation_validate',
                 'smoke_presentation_export_render', 'smoke_presentation_export_validate']
  phases = [{'phase': key, 'result': 'passed'} for key in phase_names]
  for row in phases:
   if row['phase'] == 'image_source_seal':
    row['source_sha256'] = 'a'*64
   if row['phase'] == 'image_control_user':
    row['uid'] = 0
   if row['phase'] == 'boundary':
    row['proof'] = {'protocol': 'eps-native-boundary-v1', 'uid': 65432, 'gid': 65432, 'capabilities_empty': True,
                    'no_new_privileges': True, 'known_write_denials': 10, 'writable_outside_tmp': 0}
   if row['phase'] == 'network_denial':
    row['proof'] = {'protocol': 'eps-native-network-v1', 'dns_denied': True, 'ip_denied': True}
  resources = []
  for n in range(10):
   row = dict.fromkeys(('attempted', 'identity_observed', 'initial_current_cleanup_session_equal', 'absence_verified', 'snapshot_absence_verified'), True)
   row.update(name='synthetic-'+str(n), session_consistency_failed=False)
   row.update(dict.fromkeys(('session_id', 'initial_session_id', 'current_session_id', 'cleanup_session_id'), 'session-'+str(n)))
   resources.append(row)
  checks = []
  for task in ('presentation_render', 'presentation_validate', 'presentation_export_render', 'presentation_export_validate'):
   row = {'task': task, 'page_count': 5, 'video_links': 4, 'pdf_bytes': 100}
   row.update({'rendered_candidate_fields': 40, 'rendered_frame_draws': 6, 'rendered_logo_draws': 5} if task.endswith('render') else {'validated_image_draws': 11})
   checks.append(row)
  docs = {
   'registry_ready': {'read_only': True, 'provider_mutations': False, 'team_id': s.TEAM, 'repository': {'project_id': s.PROJECT, 'public': False},
                      'images': {'images': [{'manifest_digest': IMAGE, 'status': 'ready', 'architecture': 'amd64', 'platform': 'linux'}]}},
   'daemon_import': {'result': 'ready_image_and_import_gate_observed', 'source_sha256': 'a'*64, 'native_runtime_digest': IMAGE,
                     'daemon_runtime_digest': value['new_daemon_image_id'], 'baked_manifest_sha256': 'c'*64,
                     'production_import_gate': {'completed': True, 'build_exit_code': 0, 'user': '1000:1000', 'network': 'none'}},
   'native_probe': {'result': 'passed', 'source_sha256': 'a'*64, 'project_id': s.PROJECT, 'team_id': s.TEAM,
                    'image': 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+IMAGE,
                    'cleanup_confirmed': True, 'initial_current_cleanup_sessions_equal': True, 'lock_released': True,
                    'private_media_used': False, 'db_jobs_or_openai_n8n_calls': False, 'worker_polling': False, 'token_persisted': False,
                    'probe_release': {'file_count': 164, 'source_sha256': 'a'*64, 'native_uid': 65432},
                    'resources': resources, 'phases': phases, 'presentation_checks': checks},
   'native_concurrency': {'result': 'passed', 'actual_native_sql_concurrency': True, 'sql_contract_sha256': s.sql_contract_sha256(),
                          **dict.fromkeys(('cached_intake_waited_before_snapshot', 'fresh_intake_denied_after_pause',
                             'retry_lifecycle_not_hidden_by_pause', 'all_resources_cleaned', 'original_state_preserved'), True)},
   'manifest_adoption': {'result': 'passed', 'target': s.TARGET, 'project_id': s.PROJECT, 'new_manifest_sha256': 'c'*64,
                         'same_environment_id_preserved': True, 'other_environment_metadata_preserved': True, 'normal_return_observed': True, 'two_readbacks_equal': True},
   'worker_ready': {'result': 'passed', 'project_id': s.PROJECT, 'team_id': s.TEAM, 'source_sha256': 'a'*64,
                     'native_image_id': IMAGE, 'daemon_image_id': value['new_daemon_image_id'], 'new_deployment_ready': True,
                     'old_instances_absent': True, 'native_cleanup_confirmed': True, 'ready_alive_instances': 1, 'memory_mib': 2048, 'region': 'dub1'},
  }
  original_load = s.load
  def read(path, maximum=8*1024*1024):
   return json.dumps(value).encode() if path == a.ADMISSION else original_load(path, maximum)
  def ref(row):
   self.assertIsNotNone(row)
   return docs[Path(row['path']).stem]
  with patch.object(s, 'load', side_effect=read), patch.object(a, 'reference', side_effect=ref):
   self.assertEqual(a.admission('pause'), value)
   self.assertEqual(a.admission('manifest'), value)
   with self.assertRaises(AssertionError):
    a.admission('pin')
   value['references']['manifest_adoption'] = refs['manifest_adoption']
   self.assertEqual(a.admission('pin'), value)
   with self.assertRaises(AssertionError):
    a.admission('resume')
   value['references']['worker_ready'] = refs['worker_ready']
   self.assertEqual(a.admission('resume'), value)
   docs['native_probe']['presentation_checks'][0]['rendered_candidate_fields'] = 0
   with self.assertRaises(ValueError):
    a.admission('pause')

 def test_manifest_preserves_every_other_metadata_entry(self):
  rows = [{'id': 'public-id', 'key': manifest.KEY, 'type': 'plain', 'target': ['production'], 'updatedAt': 1},
          {'id': 'other-id', 'key': 'OTHER_ENV', 'type': 'sensitive', 'target': ['production'], 'updatedAt': 1}]
  before = {'metadata': rows, 'environment_id': 'public-id', 'manifest_sha256': 'a'*64}
  current = copy.deepcopy(before)
  current['manifest_sha256'] = 'b'*64
  current['metadata'][0]['updatedAt'] = 2
  self.assertTrue(manifest.preserved(before, current))
  current['metadata'][1]['updatedAt'] = 2
  with self.assertRaises(ValueError):
   manifest.preserved(before, current)

 def test_pin_and_resume_cannot_rebaseline_intervening_business_changes(self):
  active = fixture()
  paused = after(active, 'pause')
  pinned = after(paused, 'pin')
  accepted = {'new_native_image_id': IMAGE, 'source_sha256': 'a'*64,
              'references': dict.fromkeys(('registry_ready', 'native_probe', 'daemon_import', 'native_concurrency'), None)}
  claims = {'pause': {'before': active, 'admission': accepted}, 'pin': {'before': paused, 'admission': accepted}}
  def read(path):
   phase = path.name.split('.')[0]
   return {'claim_sha256': 'f'*64, 'normal_return_marker_observed': True} if '.returned.' in path.name else claims[phase]
  with patch.object(a, 'private_read', side_effect=read), patch.object(s, 'load', return_value=b'synthetic'), patch.object(s, 'sha', return_value='f'*64):
   a.prior_phase('pin', paused, accepted)
   a.prior_phase('resume', pinned, accepted)
   changed = copy.deepcopy(paused)
   changed['state']['data']['specs_upload_sessions']['sha256'] = '0'*64
   with self.assertRaises(ValueError):
    a.prior_phase('pin', changed, accepted)

 def test_manifest_command_cannot_address_another_environment_or_secret_value(self):
  with patch.object(manifest.subprocess, 'run') as run:
   for endpoint, body in [('/v1/projects/'+s.PROJECT+'/env/another-sensitive-id?teamId='+s.TEAM, None),
                          ('/v9/projects/'+s.PROJECT+'/env/another-id?teamId='+s.TEAM, {'value': 'a'*64})]:
    with self.assertRaises(ValueError):
     manifest.command(endpoint, body)
   run.assert_not_called()

 def test_projection_omits_only_the_five_expected_hashes(self):
  value = fixture()
  comparable = s.comparable(value)
  self.assertEqual(set(value['state']['data'])-set(comparable['state']['data']), set(s.CONFIG))
  for table in s.CONFIG:
   self.assertEqual(set(value['config'][table])-set(comparable['config'][table]), {'table_hash'})
  self.assertEqual(value['state']['trace_rows'], comparable['state']['trace_rows'])


if __name__ == '__main__':
 unittest.main()
