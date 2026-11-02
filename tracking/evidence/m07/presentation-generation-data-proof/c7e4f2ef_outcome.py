"""Closed actual-run projection plus independent read-only local absence check."""
from pathlib import Path
from datetime import datetime, timezone
import hashlib
import json
import re
import subprocess

ROOT = Path(__file__).resolve().parents[4]
RUN = 'c7e4f2ef-ef40-47ef-b25c-971775716c72'
RECEIPT = ROOT / 'tracking/evidence/m07/presentation-generation-data-proof/2026-11-02T16-08-03.781Z-c7e4f2ef.json'
FAILURE = ROOT / '.local/presentation-generation-data-proof' / RUN / 'failure.json'
ENGINE = 'npipe:////./pipe/dockerDesktopLinuxEngine'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def inventory(kind):
    args = ['docker', '--host', ENGINE, kind, 'ls', '-aq' if kind == 'container' else '-q', '--filter', 'label=eps.generationdata.run=' + RUN]
    result = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, timeout=30, check=False)
    rows = result.stdout.split()
    assert result.returncode == 0 and not rows, 'DATA_REUSE_POSTRETURN_ABSENCE_UNCONFIRMED'
    return {'kind': kind, 'engine': ENGINE, 'exit_code': result.returncode, 'matching_rows': len(rows)}


def main():
    raw = RECEIPT.read_bytes()
    receipt = json.loads(raw)
    assert receipt['result'] == 'failed' and receipt['checkpoint'] == 'locksource41-old-cohorts'
    failure_raw = FAILURE.read_bytes()
    failure = json.loads(failure_raw)
    message = failure.get('message', '')
    assert re.fullmatch(r'[A-Z][A-Z0-9_]{0,160}', message)
    assert not failure.get('diagnostic')
    cleanup_fields = ['all_owned_resources_absent', 'independent_successful_daemon_label_inventories_empty', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released']
    assert all(receipt.get(name) is True for name in cleanup_fields)
    lock = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/local-postgres/test-db.lock')
    assert not lock.exists()
    result = {
        'schema_version': 'generation-data-reuse-actual-outcome.v1', 'run_id': RUN,
        'observed_at': datetime.now(timezone.utc).isoformat(), 'result': 'failed',
        'normal_process_exit_code': 1, 'normal_outcome_returned': True,
        'receipt': RECEIPT.relative_to(ROOT).as_posix(), 'receipt_sha256': sha(raw),
        'observed_at_in_receipt': receipt['observed_at'], 'finished_at': receipt['finished_at'], 'elapsed_ms': receipt['elapsed_ms'],
        'checkpoint': receipt['checkpoint'], 'failure_code': receipt['failure_code'],
        'private_failure_sha256': sha(failure_raw), 'final_closed_error': message,
        'first_owned_request_error': receipt.get('first_owned_request_error'),
        'native_primary_SQLSTATE_or_stderr': 'unavailable: final cleanup assertion masked the initial session error and no primary diagnostic was persisted',
        'candidate_four_bodies_installed_or_executed': False,
        'candidate_equality_performance_security_or_fallback_accepted': False,
        'baseline_full_clone_final_preservation_gate_reached': False,
        'baseline_samples': receipt['performance']['results']['old'],
        'baseline_focused_cases': receipt['data_reuse_cases']['old'],
        'baseline_security': receipt['performance']['security']['old'],
        'unreached': ['candidate body installation and all candidate measurements', 'completed lock cohorts', 'edge probes', 'changed-source and authority races', 'final old/new equality and full clone preservation'],
        'cleanup': {name: receipt[name] for name in cleanup_fields},
        'fresh_shared_lock_exists': lock.exists(), 'independent_postreturn_inventories': [inventory('container'), inventory('volume')],
        'scope': 'one owned local synthetic PG17 proof; no canonical/provider/production retry; no automatic replay',
    }
    output = RECEIPT.parent / 'c7e4f2ef-outcome.json'
    with output.open('x', encoding='utf8', newline='\n') as stream:
        json.dump(result, stream, indent=2)
        stream.write('\n')
    print(json.dumps({'outcome': output.relative_to(ROOT).as_posix(), 'sha256': sha(output.read_bytes()), 'result': 'failed', 'cleanup_verified': True}))


if __name__ == '__main__':
    main()
