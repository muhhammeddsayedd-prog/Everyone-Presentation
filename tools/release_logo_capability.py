"""Release the exact locally verified capability forward fix to the canonical DB.

No runtime flag, identity, fixture, secret, seed or arbitrary target/SQL input.
Dry-run is required before apply; post-push readback verifies source and ACLs.
"""
import datetime
import hashlib
import json
import re
import sys
import tomllib
import uuid
from release_foundation import ROOT, TARGET, call
from release_logo import MIGRATIONS as BASE

PENDING = '20261028072515_m01_logo_upload_capability.sql'
MIGRATIONS = dict(BASE, **{PENDING: '4dbd400092d7743b02dd0769ae511c208e6f4f349428fc0e7f0fb9c573ba4b24'})
PROOF = 'development/local-db/receipts/2026-10-28T07-37-24-591Z-test-db-summary-dc3c8a1d.json'
PROOF_HASH = 'e95b86cf57dcfdd90fb42691675f9e5fe14919e0a74efcf2c56a4291f4e64e4c'
READBACK = 'tools/sql/logo-capability-readback.sql'
READBACK_HASH = 'b8705c4e51db702c76ffcf990b84fcb88bc688ddaf26e8c10501dee504bb73b7'
EVIDENCE = ROOT / 'tracking/evidence/cloud-logo-capability'


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def source(name):
    text = (ROOT / 'supabase/migrations' / name).read_text(encoding='utf-8')
    found = re.search(r"create (?:or replace )?function public\.eps_get_capabilities\(\) returns jsonb\s+language plpgsql stable security definer set search_path\s*=\s*'' as \$\$([\s\S]*?)\$\$;", text)
    require(found is not None, 'Expected exact capability function source was not found.')
    return found.group(1)


def prerequisites():
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked target differs from the owner-selected project.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False, 'Require reviewed history with seeds disabled.')
    require(sorted(p.name for p in (ROOT / 'supabase/migrations').glob('*.sql')) == list(MIGRATIONS), 'Unexpected migration set; reconcile without resetting history.')
    reviewed = json.loads((ROOT / 'development/local-db/reviewed.json').read_text())
    for name, expected in MIGRATIONS.items():
        relative = 'supabase/migrations/' + name
        require(digest(relative) == expected and any(item['path'] == relative and item['sha256'] == expected for item in reviewed['migrations']), 'Reviewed migration bytes changed.')
    require(digest(PROOF) == PROOF_HASH and digest(READBACK) == READBACK_HASH, 'Fixed proof or readback SQL changed.')
    proof = json.loads((ROOT / PROOF).read_text())
    require(proof['result'] == 'passed' and len(proof['stages']) == 21 and proof['cleanup']['result'] == 'passed' and proof['logo_cleanup']['result'] == 'passed', 'Exact full local DB proof and cleanups are required.')
    for name, expected in MIGRATIONS.items():
        require(any(s['path'] == 'supabase/migrations/' + name and s['sha256'] == expected and s['result'] in ('applied', 'already_applied') for s in proof['stages']), 'Exact migration replay proof is missing.')
    require(all(s['result'] in ('passed', 'applied', 'already_applied') for s in proof['stages']), 'A local stage failed.')
    return {'migration_hashes': MIGRATIONS, 'local_proof': PROOF, 'local_proof_sha256': PROOF_HASH, 'readback_sha256': READBACK_HASH}


def inspect():
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0, 'Fixed read-only cloud capability inspection failed; raw diagnostics suppressed.')
    payload = json.loads(result.stdout)
    state = payload['rows'][0]['capability_release']
    require(state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['unrestricted_visibility'] is True, 'Cloud administration context could not be verified.')
    rpc = state['capability_rpc']
    require(rpc['owner'] == 'eps_api_owner' and rpc['definer'] is True and rpc['config'] == ['search_path=""']
            and rpc['anon_execute'] is False and rpc['service_execute'] is False and rpc['authenticated_execute'] is True, 'Capability owner/ACL boundary differs from reviewed foundation.')
    if state['versions'] == [name[:14] for name in BASE] and rpc['source'].replace('\r\n', '\n') == source(list(BASE)[0]):
        mode = 'pending'
    elif state['versions'] == [name[:14] for name in MIGRATIONS] and rpc['source'].replace('\r\n', '\n') == source(PENDING):
        mode = 'applied'
    else:
        raise ValueError('Cloud source or migration history differs from the exact before/after states; preserve and reconcile.')
    del rpc['source']
    return mode, state


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('dry-run', 'apply', 'readback'), 'Use dry-run, apply or readback without target overrides.')
    inputs = prerequisites()
    mode, before = inspect()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET, 'action': action,
               'inputs': inputs, 'before_mode': mode, 'before': before, 'runtime_flag_changed': False, 'seeds': False, 'vault_sync': False,
               'result': 'failed', 'application_verified_by_readback': False, 'raw_diagnostics_recorded': False}
    receipt['application_status'] = 'not_attempted' if mode == 'pending' else 'verified_existing'
    try:
        if action != 'readback':
            require(mode == 'pending', 'This forward release is already applied; use readback without replaying a push.')
            if action == 'apply':
                prior = json.loads((EVIDENCE / 'dry-run.json').read_text())
                require(prior['result'] == 'passed' and prior['inputs'] == inputs and prior['pending_migrations'] == [PENDING], 'Exact successful dry-run is required.')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run':
                command.append('--dry-run')
            # Persist the before-state before a request that might commit.
            receipt['application_status'] = 'unknown_until_readback' if action == 'apply' else 'not_attempted'
            attempt = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + action + '.json')
            attempt.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
            result = call(command)
            pending = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            receipt.update(exit_code=result.returncode, pending_migrations=pending)
            require(result.returncode == 0 and pending == [PENDING], 'Cloud push outcome could not be confirmed; inspect readback before retrying.')
        after_mode, after = inspect()
        receipt.update(after_mode=after_mode, readback=after, application_verified_by_readback=after_mode == 'applied',
                       application_status='verified_applied' if after_mode == 'applied' else 'verified_pending')
        require(after_mode == ('pending' if action == 'dry-run' else 'applied'), 'Cloud after-state does not match this operation.')
        require(after['counts'] == before['counts'], 'Business/media counts changed during this metadata release; reconcile concurrent actions.')
        receipt['result'] = 'passed'
    except ValueError as error:
        receipt['reason'] = str(error)
        raise
    except Exception:
        receipt['reason'] = 'Fixed release outcome could not be confirmed. Use readback; raw diagnostics suppressed.'
        raise
    finally:
        receipt['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        name = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + action + '.json'
        (EVIDENCE / name).write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
        if receipt['result'] == 'passed' and action == 'dry-run':
            (EVIDENCE / 'dry-run.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    try:
        main()
    except ValueError as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_diagnostics_recorded': False})); sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Fixed cloud release could not be confirmed; inspect existing history before retrying.', 'raw_diagnostics_recorded': False})); sys.exit(1)
