"""Pure fixture/SQL-parse tests. No private reads, SQL or provider dispatch."""
from pathlib import Path
import copy
import datetime
import importlib.util
import json
import unittest
import uuid
from unittest.mock import patch
from pglast import ast, parse_sql, parse_plpgsql
from pglast.stream import RawStream

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('worker38_availability_test', HERE/'availability.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
fixtures = a.s.module('worker38_existing_pure_test_fixtures', a.s.HERE/'test_adoption.py')
NOW = datetime.datetime(2026, 11, 1, 19, tzinfo=datetime.timezone.utc)
STAMP = '2026-11-01T18:59:50+00:00'


def fixture():
 active = fixtures.fixture()
 paused = fixtures.after(active, 'pause')
 admitted = {'new_native_image_id': fixtures.IMAGE, 'target': a.s.TARGET, 'new_manifest_sha256': 'a'*64}
 claim = {'phase': 'pause', 'before': active, 'admission': admitted, 'source_pins': a.s.sources(),
          'marker': str(uuid.uuid4()), 'dispatch_may_have_occurred': True, 'automatic_retry': False}
 raw = (json.dumps(claim, sort_keys=True)+'\n').encode()
 instance = {'id': 'dmni_synthetic', 'alive': True, 'image': {'digest': a.OLD_DAEMON}, 'region': 'dub1',
             'memory_mib': 2048, 'started_at_ms': int((NOW-datetime.timedelta(hours=1)).timestamp()*1000),
             'last_checked_at_ms': int((NOW-datetime.timedelta(seconds=10)).timestamp()*1000), 'stopped_at_ms': None}
 worker = {'observed_at': STAMP, 'project_id': a.s.PROJECT, 'team_id': a.s.TEAM,
           'active_production_deployment_id': a.OLD_DEPLOYMENT,
           'worker': {'project_id': a.s.PROJECT, 'team_id': a.s.TEAM, 'daemon': 'worker', 'environment': 'production',
                      'deployment_id': a.OLD_DEPLOYMENT, 'status': 'ready', 'requested_image': {'digest': a.OLD_DAEMON},
                      'resolved_image': {'digest': a.OLD_DAEMON}, 'configured_instances': {'dub1': 1},
                      'configured_override': None, 'memory_mib': 2048, 'termination_grace_seconds': 300,
                      'desired': 1, 'ready': 1, 'total': 1, 'instances': [instance]}}
 row = {'id': a.s.ENVIRONMENT_ID, 'key': 'EPS_NATIVE_MANIFEST_SHA256', 'type': 'plain', 'target': ['production'],
        'gitBranch': None, 'createdAt': 1, 'updatedAt': 1}
 other = {**row, 'id': 'other', 'key': 'SYNTHETIC_SENSITIVE_KEY', 'type': 'sensitive'}
 baseline = {'metadata': [row, other], 'environment_id': a.s.ENVIRONMENT_ID, 'manifest_sha256': a.s.OLD_MANIFEST}
 current = copy.deepcopy(baseline)
 current['manifest_sha256'] = 'a'*64
 current['metadata'][0]['updatedAt'] = 2
 environment = {'observed_at': STAMP, 'project_id': a.s.PROJECT, 'team_id': a.s.TEAM, 'current': current}
 evidence = {'pause_claim_bytes': raw, 'pause_returned': {'claim_sha256': a.s.sha(raw), 'normal_return_marker_observed': True},
             'old_worker': [worker, copy.deepcopy(worker)], 'environment_before': baseline,
             'environment': [environment, copy.deepcopy(environment)], 'new_manifest_sha256': 'a'*64,
             'new_deployment_dispatch_claim_absent': True}
 return paused, evidence, active


class Tests(unittest.TestCase):
 def test_default_false_refuses_even_pure_render(self):
  self.assertIs(a.RENDER_ENABLED, False)
  paused, evidence, _ = fixture()
  with self.assertRaises(ValueError):
   a.render(paused, evidence, str(uuid.uuid4()), NOW)

 def test_exact_old_worker_allows_only_five_flag_restoration(self):
  paused, evidence, active = fixture()
  expected = a.expected(paused, evidence, NOW)
  self.assertEqual(expected, a.s.comparable(active))
  after = copy.deepcopy(paused)
  for table in a.s.CONFIG:
   after['config'][table]['public']['enabled'] = True
  self.assertTrue(a.transition(paused, after, evidence, NOW))
  with patch.object(a, 'RENDER_ENABLED', True):
   sql = a.render(paused, evidence, str(uuid.uuid4()), NOW)
  self.assertEqual(sql.count(' set enabled=true;'), 5)
  self.assertNotIn('native_image_id=', sql)
  self.assertLess(sql.index('in access exclusive mode;'), sql.index('select'))
  self.assertIn('WORKER38_OLD_FLAGS_PREFLIGHT_CHANGED', sql)
  for statement in parse_sql(sql):
   if isinstance(statement.stmt, ast.DoStmt):
    parse_plpgsql(RawStream()(statement.stmt))

 def test_new_or_unknown_deployment_and_dispatch_refused(self):
  for mutate in [lambda e: e.update(new_deployment_dispatch_claim_absent=False),
                 lambda e: e['old_worker'][0].update(active_production_deployment_id='dpl_new'),
                 lambda e: e['old_worker'][0]['worker'].update(deployment_id='dpl_new'),
                 lambda e: e['old_worker'][0]['worker'].update(status='starting'),
                 lambda e: e['old_worker'][0]['worker'].update(configured_override={'dub1': 1}),
                 lambda e: e['old_worker'][0]['worker']['instances'][0].update(alive=False),
                 lambda e: e['old_worker'][0]['worker']['resolved_image'].update(digest='sha256:'+'1'*64)]:
   paused, evidence, _ = fixture()
   mutate(evidence)
   with self.assertRaises(ValueError):
    a.expected(paused, evidence, NOW)

 def test_provider_observations_must_be_fresh_independent_and_equal(self):
  for mutate in [lambda e: e['old_worker'][0].update(observed_at='2026-11-01T18:00:00+00:00'),
                 lambda e: e['old_worker'][0]['worker']['instances'][0].update(last_checked_at_ms=0),
                 lambda e: e.update(old_worker=e['old_worker'][:1]),
                 lambda e: e['old_worker'][1]['worker']['instances'][0].update(id='dmni_other'),
                 lambda e: e['environment'][1]['current'].update(manifest_sha256='b'*64),
                 lambda e: e['environment'][0].update(team_id='team_other')]:
   paused, evidence, _ = fixture()
   mutate(evidence)
   with self.assertRaises(ValueError):
    a.expected(paused, evidence, NOW)

 def test_other_environment_metadata_and_public_id_preserved(self):
  for mutate in [lambda e: e['environment'][0]['current']['metadata'][1].update(updatedAt=2),
                 lambda e: e['environment'][0]['current'].update(environment_id='other'),
                 lambda e: e['environment'][0]['current'].update(manifest_sha256='c'*64),
                 lambda e: e['environment'][0]['current']['metadata'][0].update(type='sensitive')]:
   paused, evidence, _ = fixture()
   mutate(evidence)
   with self.assertRaises(ValueError):
    a.expected(paused, evidence, NOW)

 def test_claim_drift_pin_and_any_lifecycle_refused(self):
  for mutate in [lambda p, e: p['config']['frame_extraction_config']['public'].update(native_image_id=fixtures.IMAGE),
                 lambda p, e: p['state']['data']['jobs'].update(sha256='0'*64),
                 lambda p, e: p['state']['data']['specs_upload_sessions'].update(sha256='0'*64),
                 lambda p, e: p['config']['candidate_asset_config']['public'].update(english_transcript_version=None),
                 lambda p, e: e['pause_returned'].update(claim_sha256='0'*64),
                 lambda p, e: e['pause_returned'].update(normal_return_marker_observed=False)]:
   paused, evidence, _ = fixture()
   mutate(paused, evidence)
   with self.assertRaises(ValueError):
    a.expected(paused, evidence, NOW)
  for key in a.s.COUNTERS:
   paused, evidence, _ = fixture()
   paused['lifecycle'][key] = 1
   with self.assertRaises(ValueError):
    a.expected(paused, evidence, NOW)

 def test_transition_cannot_change_any_other_fact_or_pin(self):
  paused, evidence, active = fixture()
  active['state']['trace_rows']['sha256'] = '0'*64
  with self.assertRaises(ValueError):
   a.transition(paused, active, evidence, NOW)


if __name__ == '__main__':
 unittest.main()
