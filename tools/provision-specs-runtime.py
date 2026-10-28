"""Fixed cloud machine credential provisioning; never prints raw CLI output.

Creates protected owner/SYSTEM files before dispatch. An interrupted/unknown
outcome leaves a journal and blocks reruns. No provider or acting-user identity.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import uuid
from release_foundation import ROOT, TARGET, call
from provision_logo_verifier import WindowsPrivateFiles

SQL = 'tools/sql/provision-specs-runtime.sql'
SQL_SHA256 = '3bafab7043c6230d3b3f96dc64a672ea75552edca71f6676e6372728a16df4b2'
# Filled from the actual fixed10 release, never selected by wildcard or status.
CLOUD_PROOF = 'tracking/evidence/cloud-specs-pipeline/2026-10-28T23-48-48-579255Z-06621ead-readback.json'
CLOUD_PROOF_SHA256 = '24ca991887de11abef0807f1850c350bf582811acd2faf60dab7f84f2eb4d11d'
DIRECTORY = ROOT / '.local/specs-runtime'
JOURNAL = DIRECTORY / 'db-provision.json'
SECRET = DIRECTORY / 'database.json'
EVIDENCE = ROOT / 'tracking/evidence/m02/specs-runtime'

def require(condition):
    if not condition:
        raise ValueError('SPECS_RUNTIME_PROVISIONING_UNCONFIRMED')

def main():
    require(sys.argv[1:] == ['provision'])
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    require(not JOURNAL.exists() and not SECRET.exists())
    # Root supplies the exact cloud10 readback proof before running this tool.
    sql_hash = hashlib.sha256((ROOT / SQL).read_bytes()).hexdigest()
    require(sql_hash == SQL_SHA256 and CLOUD_PROOF and CLOUD_PROOF_SHA256)
    proof_bytes = (ROOT / CLOUD_PROOF).read_bytes()
    require(hashlib.sha256(proof_bytes).hexdigest() == CLOUD_PROOF_SHA256)
    proof = json.loads(proof_bytes)
    require(proof.get('target') == TARGET and proof.get('result') == 'passed')
    require(proof.get('action') == 'readback' and proof.get('application_verified_by_readback') is True
      and proof['readback']['base']['versions'][-1] == '20261028222030'
      and len(proof['readback']['base']['versions']) == 10
      and proof['inputs']['migrations']['20261028222030_m02_specs_pipeline.sql'] == '1e5319bb81be1f12896f7efb5a2cb7706653b79eb440a4dc1aaaca4ed9556895')
    security = WindowsPrivateFiles(); DIRECTORY.mkdir(exist_ok=True, parents=True)
    state = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET,
             'sql_sha256': sql_hash, 'status': 'prepared', 'automatic_retry': False}
    with security.create(JOURNAL) as journal, security.create(SECRET) as secret:
        def save_state():
            journal.seek(0); journal.write((json.dumps(state) + '\n').encode()); journal.truncate(); journal.flush(); os.fsync(journal.fileno())
        save_state(); state['status'] = 'dispatching'; save_state()
        try:
            result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT / SQL),'--output-format','json'])
            require(result.returncode == 0)
            payload = json.loads(result.stdout)
            require(len(payload['rows']) == 1 and set(payload['rows'][0]) == {'provisioned'})
            value = payload['rows'][0]['provisioned']
            require(set(value) == {'role','password','expires_at','memberships','settings'})
            require(value['role'] == 'eps_specs_runtime' and isinstance(value['password'], str) and re.fullmatch('[a-f0-9]{96}', value['password']))
            expected_settings = {'log_statement=none','log_parameter_max_length=0','log_parameter_max_length_on_error=0',
              'log_min_error_statement=panic','log_min_duration_statement=-1','auto_explain.log_min_duration=-1',
              'auto_explain.log_parameter_max_length=0','auto_explain.log_nested_statements=false','pg_stat_statements.track=none'}
            require(isinstance(value['settings'],list) and len(value['settings']) == 9 and set(value['settings']) == expected_settings)
            expires = datetime.datetime.fromisoformat(value['expires_at'].replace('Z','+00:00'))
            require(datetime.timedelta(days=29) < expires-datetime.datetime.now(datetime.timezone.utc) < datetime.timedelta(days=31))
            memberships = value['memberships']; require(isinstance(memberships,list) and len(memberships) in (2,3))
            require(all(isinstance(m,dict) and set(m)=={'parent','member','grantor','admin','inherit','set'}
              and all(type(m[k]) is bool for k in ('admin','inherit','set')) for m in memberships))
            outgoing = [m for m in memberships if m['member']=='eps_specs_runtime']
            require(len(outgoing)==2 and {m['parent'] for m in outgoing}=={'eps_jobs_executor','eps_jobs_dispatcher'}
              and all(m['grantor']=='postgres' and m['inherit'] and not m['set'] and not m['admin'] for m in outgoing))
            incoming = [m for m in memberships if m['parent']=='eps_specs_runtime']
            require(len(outgoing)+len(incoming)==len(memberships))
            require(not incoming or len(incoming)==1 and incoming[0]['member']=='postgres' and incoming[0]['grantor']=='supabase_admin' and incoming[0]['admin']
              and not incoming[0]['inherit'] and not incoming[0]['set'])
            secret.write((json.dumps({'password': value.pop('password'), 'expires_at': value['expires_at']}) + '\n').encode())
            secret.flush(); os.fsync(secret.fileno()); security.verify_open(secret)
            state['status'] = 'completed'; save_state()
            metadata = {key: value[key] for key in ('role','expires_at','memberships','settings')}
            report = {**state, 'result': 'passed', 'role_metadata': metadata, 'secret_recorded': False,
                      'private_file_acl_verified': True, 'global_settings_modified': False}
        except Exception:
            state['status'] = 'unconfirmed'; save_state()
            report = {**state, 'result': 'unconfirmed', 'raw_diagnostics_suppressed': True}
            EVIDENCE.mkdir(exist_ok=True, parents=True)
            (EVIDENCE / (state['observed_at'].replace(':','-') + '-provision-failed.json')).write_text(json.dumps(report, indent=2)+'\n')
            print(json.dumps(report)); return 1
    EVIDENCE.mkdir(exist_ok=True, parents=True)
    (EVIDENCE / (state['observed_at'].replace(':','-') + '-provision.json')).write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report)); return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print(json.dumps({'result':'blocked','code':'SPECS_RUNTIME_PROVISIONING_UNCONFIRMED','raw_diagnostics_suppressed':True})); sys.exit(1)
