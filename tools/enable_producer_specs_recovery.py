"""One fixed M02 capability completion; never reactivates an existing grant."""
import datetime
import hashlib
import json
import os
import sys
from release_foundation import ROOT, TARGET, call

SQL = 'tools/sql/enable-producer-specs-recovery.sql'
SQL_HASH = 'fccb2ac10c80f1cded687f5389f0adac433590a534d49e5443222ce43c737362'
PROOF = 'tracking/evidence/m02/specs-operations/2026-10-29T01-00-38.242908+00-00-inspection.json'
PROOF_HASH = '646ed563b6b0e09fe83450e4cdc194e6904f5557ed1df0a5a1c2e40f3e3d129a'

def require(condition):
    if not condition: raise ValueError('FIXED_PRODUCER_RECOVERY_UNCONFIRMED')

def main():
    require(len(sys.argv) == 1)
    require((ROOT/'supabase/.temp/project-ref').read_text().strip() == TARGET)
    require(hashlib.sha256((ROOT/SQL).read_bytes()).hexdigest() == SQL_HASH)
    require(hashlib.sha256((ROOT/PROOF).read_bytes()).hexdigest() == PROOF_HASH)
    proof = json.loads((ROOT/PROOF).read_text())
    require(proof['result'] == 'passed' and proof['target'] == TARGET and proof['action'] == 'operations-inspect'
        and proof['read_only'] is True and proof['data']['capability_status']['operations.retry'] == 'absent')
    directory = ROOT/'tracking/evidence/m02/specs-operations'
    attempt = directory/'initial-producer-recovery-attempt.json'
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'target': TARGET, 'action':'complete_initial_producer_m02_recovery',
        'result':'unconfirmed', 'sql_sha256':SQL_HASH, 'proof_sha256':PROOF_HASH,
        'secret_or_identity_recorded':False, 'automatic_retry':False}
    # Exists blocks every later invocation, including an unknown DB/IO boundary.
    with attempt.open('x',encoding='utf-8') as file:
        json.dump(report,file,indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
    try:
        result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
        require(result.returncode == 0)
        observed = json.loads(result.stdout)['rows'][0]['recovery']
        require(observed == {'capability':'operations.retry','active':True,'new_grants':1,
            'auth_identity_created':False,'existing_memberships_changed':False,'inactive_grants_reactivated':False})
        report.update(result='passed',observed=observed)
    finally:
        report['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        with (directory/'initial-producer-recovery-result.json').open('x',encoding='utf-8') as file:
            json.dump(report,file,indent=2); file.write('\n')
        print(json.dumps({'result':report['result'],'action':report['action'],'raw_diagnostics_suppressed':True}))
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","code":"FIXED_PRODUCER_RECOVERY_UNCONFIRMED","raw_diagnostics_suppressed":true}')
        sys.exit(1)
