"""Closed actual diagnostic result and independent read-only local absence."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import subprocess

ROOT = Path(__file__).resolve().parents[4]
RUN = '754fcf15-0c30-4659-bdcf-9b27c0e8c400'
RECEIPT = ROOT / 'tracking/evidence/m07/presentation-generation-data-diagnostics/2026-11-02T16-57-04.142Z-754fcf15.json'
PRIVATE = ROOT / '.local/presentation-generation-data-diagnostics' / RUN
ENGINE = 'npipe:////./pipe/dockerDesktopLinuxEngine'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def inventory(kind):
    result = subprocess.run(['docker', '--host', ENGINE, kind, 'ls', '-aq' if kind == 'container' else '-q', '--filter', 'label=eps.cohortdiagnostic.run=' + RUN], cwd=ROOT, capture_output=True, text=True, timeout=30, check=False)
    rows = result.stdout.split()
    assert result.returncode == 0 and not rows, 'COHORT_DIAGNOSTIC_POSTRETURN_ABSENCE_UNCONFIRMED'
    return {'kind': kind, 'engine': ENGINE, 'exit_code': result.returncode, 'matching_rows': len(rows)}


def main():
    raw = RECEIPT.read_bytes()
    value = json.loads(raw)
    assert sha(raw) == 'f37e01d08c4631f38bb4c3ee883eac125a0806cdcc80b10a4ea46dfeff4c25e4'
    assert value['result'] == 'failed' and value['checkpoint'] == 'cohort-diagnostic-lock-helper'
    private_raw = (PRIVATE / 'failure.json').read_bytes()
    failure = json.loads(private_raw)
    assert failure['message'].startswith('COHORT_DIAGNOSTIC_HELPER_DID_NOT_COMPLETE') and not failure.get('diagnostic')
    assert not (PRIVATE / 'first-owned-native-error.json').exists()
    diagnostic = value['cohort_diagnostic']
    measure = diagnostic['lock_measure']
    assert measure['ok'] is False and measure['code'] == '57014' and measure['operation'] == 'locks'
    assert diagnostic['candidate_four_bodies_installed_or_executed'] is False and diagnostic['cohort_result'] is None
    cleanup_fields = ['all_owned_resources_absent', 'independent_successful_daemon_label_inventories_empty', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released']
    assert all(value[name] is True for name in cleanup_fields)
    lock = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/local-postgres/test-db.lock')
    assert not lock.exists()
    output = {
        'schema_version': 'cohort-only-actual-outcome.v1', 'run_id': RUN, 'observed_at': datetime.now(timezone.utc).isoformat(),
        'result': 'failed', 'normal_process_exit_code': 1, 'normal_outcome_returned': True,
        'receipt': RECEIPT.relative_to(ROOT).as_posix(), 'receipt_sha256': sha(raw),
        'observed_at_in_receipt': value['observed_at'], 'finished_at': value['finished_at'], 'elapsed_ms': value['elapsed_ms'],
        'checkpoint': value['checkpoint'], 'safe_assertion_code': 'COHORT_DIAGNOSTIC_HELPER_DID_NOT_COMPLETE',
        'private_failure_sha256': sha(private_raw), 'actual_sql_handler_result': measure,
        'handler_code_provenance': 'original pg_temp.locksource41_measure WHEN query_canceled branch returned code57014 normally',
        'actual_verbose_psql_ERROR_observed': False, 'native_psql_SQLSTATE': None,
        'first_private_native_error_file_exists': False, 'reason': 'the SQL exception was handled and returned normally; no process request failed before the assertion',
        'c7e4f2ef_primary_native_cause_established': False,
        'original_12_relation_cohort_read_executed': False, 'candidate_four_bodies_executed': False,
        'benchmark_generation_association_cycles_replayed': False,
        'full_candidate_performance_equality_security_or_release_acceptance': False,
        'full_fresh_baseline_state_sha256': diagnostic['baseline_state_sha256'],
        'full_within_run_post_cohort_equality_gate_reached': False,
        'original_lock_restoration_in_owned_clone_reached': False,
        'cleanup': {name: value[name] for name in cleanup_fields}, 'fresh_shared_lock_exists': lock.exists(),
        'independent_postreturn_inventories': [inventory('container'), inventory('volume')],
        'scope': 'one owned local synthetic cohort-only attempt, original1ff8 and preceding4 bodies; no canonical/provider; failure stopped without automatic retry',
    }
    path = RECEIPT.parent / '754fcf15-outcome.json'
    with path.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(output, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'outcome': path.relative_to(ROOT).as_posix(), 'sha256': sha(path.read_bytes()), 'result': 'failed', 'cleanup_verified': True, 'handler_code': '57014', 'verbose_native_SQLSTATE': None}))


if __name__ == '__main__':
    main()
