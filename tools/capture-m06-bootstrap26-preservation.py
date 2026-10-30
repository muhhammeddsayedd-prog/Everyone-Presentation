"""Read-only whole-system comparison around the separately claimed key bootstrap."""
from pathlib import Path
from datetime import datetime, timezone
import copy
import hashlib
import importlib.util
import json
import sys
import uuid
import release_m06_forward26 as release
from provision_logo_verifier import WindowsPrivateFiles

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.local/m06-guest-bootstrap26/full-before.json'
spec = importlib.util.spec_from_file_location('m06_guest26', ROOT / 'tools/provision-m06-guest26.py')
bootstrap = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bootstrap)

def require(value):
    if not value: raise ValueError('M06_BOOTSTRAP_PRESERVATION_UNCONFIRMED')

def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('before', 'after'))
    mode = sys.argv[1]; security = WindowsPrivateFiles()
    inputs = release.current_release_inputs(); state = release.inspect_state(inputs)
    require(state['old_data']['versions'] == inputs['versions'])
    source = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    if mode == 'before':
        require(state['new_state']['config'] == {'enabled': False, 'key_present': False, 'key_bytes': None, 'replay_ttl_seconds': 86400, 'session_ttl_seconds': 3600})
        bootstrap.private_write(security, PRIVATE, json.dumps({'inputs': inputs, 'state': state, 'helper_sha256': source}).encode())
        report = {'result': 'captured', 'phase': mode, 'read_only': True, 'helper_sha256': source, 'source_inputs': inputs, 'state': state}
    else:
        before = json.loads(bootstrap.private_read(security, PRIVATE, 2 * 1024 * 1024))
        require(before['inputs'] == inputs and before['helper_sha256'] == source)
        expected = copy.deepcopy(before['state']); expected['new_state']['config'].update(key_present=True, key_bytes=32)
        require(expected == state)
        report = {'result': 'passed', 'phase': mode, 'read_only': True, 'helper_sha256': source, 'source_inputs': inputs,
            'before': before['state'], 'after': state, 'only_expected_gateway_key_presence_changed': True,
            'all_old_noncredential_data_catalog_storage_runtime_and_managed_auth_metadata_counts_preserved': True,
            'raw_key_or_key_digest_read_or_recorded': False}
    require(release.current_release_inputs() == inputs and hashlib.sha256(Path(__file__).read_bytes()).hexdigest() == source)
    report.update(observed_at=datetime.now(timezone.utc).isoformat(), hosting_deferred=True)
    directory = ROOT / 'tracking/evidence/m06/guest-bootstrap26'; directory.mkdir(parents=True, exist_ok=True)
    file = directory / (datetime.now(timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-full-' + mode + '.json')
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
    print(json.dumps({'result': report['result'], 'receipt': file.relative_to(ROOT).as_posix(), 'read_only': True, 'raw_credentials_recorded': False}))

if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('M06 bootstrap preservation was not confirmed. No write was attempted; private diagnostics suppressed.\n'); sys.exit(1)
