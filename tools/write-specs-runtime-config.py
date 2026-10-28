"""Prepare only the fixed protected local daemon environment, no network/SQL."""
import base64
import datetime
import hashlib
import json
import re
from release_foundation import ROOT
from provision_logo_verifier import WindowsPrivateFiles

def main():
    directory=ROOT/'.local/specs-runtime'
    database=json.loads((directory/'database.json').read_text())
    webhook=json.loads((directory/'n8n-bootstrap.json').read_text())
    journal=json.loads((directory/'wf01-release.json').read_text())
    assert journal['status']=='published' and journal['workflow_id']=='Nu4bvU634yTLnRy1'
    assert webhook['status']=='created' and webhook['credential_id']=='DgZ83IpyrbinQ9gW'
    assert re.fullmatch('[a-f0-9]{96}',database['password'])
    assert re.fullmatch('[A-Za-z0-9_-]{64}',webhook['secret'])
    assert re.fullmatch(r'https://[a-z0-9-]+(?:\.app)?\.n8n\.cloud/webhook/eps-wf01-specs-stage-v1',webhook['dispatch_url'])
    assert datetime.datetime.fromisoformat(database['expires_at'])>datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(hours=24)
    ca=(directory/'prod-ca-2021.crt').read_bytes()
    assert hashlib.sha256(ca).hexdigest()=='700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7'
    values={'EPS_SPECS_PG_HOST':'aws-0-eu-west-1.pooler.supabase.com','EPS_SPECS_PG_PASSWORD':database['password'],
            'EPS_SPECS_PG_CA_BASE64':base64.b64encode(ca).decode(),'N8N_DISPATCH_URL':webhook['dispatch_url'],'N8N_DISPATCH_SECRET':webhook['secret']}
    assert all(not any(c in value for c in '\r\n\0') for value in values.values())
    security=WindowsPrivateFiles(); target=ROOT/'.env.worker-runtime.local'
    with security.create(target) as handle:
        handle.write(('\n'.join(key+'='+value for key,value in values.items())+'\n').encode()); handle.flush(); security.verify_open(handle)
    security.verify(target)
    print(json.dumps({'result':'passed','path':'.env.worker-runtime.local','protected_owner_system_acl_verified':True,'fields':len(values),'values_recorded':False}))
if __name__=='__main__':
    try: main()
    except Exception: print('{"result":"unconfirmed","code":"RUNTIME_CONFIGURATION_UNCONFIRMED","private_diagnostics_suppressed":true}'); raise SystemExit(1)
