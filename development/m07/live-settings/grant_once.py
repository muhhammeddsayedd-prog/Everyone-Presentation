"""One reviewed absent-only capability dispatch; uncertainty requires discovery only."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[3]
TARGET='pyibofyctwnqpvktepse'
SQL_SHA='0c5796e86ee9aea7f4a2b78fcde380885c42d4c0fa9c75ca144a2ff60c4b19d2'
DISCOVERY=ROOT/'tracking/evidence/m07/live-settings-oauth/2026-10-30T14-32-17-466387Z-canonical-settings-discovery.json'
DISCOVERY_SHA='2f5c9e5fcf8ed28eef8f94c0694a9593770387c51b4b08fa7181bcc9ab21dd4d'

def main():
    source=Path(__file__).with_name('grant-absent.sql')
    if sys.argv[1:]!=['apply'] or (ROOT/'supabase/.temp/project-ref').read_text().strip()!=TARGET:
        raise ValueError('Fixed target/action required')
    if hashlib.sha256(source.read_bytes()).hexdigest()!=SQL_SHA or hashlib.sha256(DISCOVERY.read_bytes()).hexdigest()!=DISCOVERY_SHA:
        raise ValueError('Reviewed bytes required')
    private=ROOT/'.local/m07-settings-completion'
    private.mkdir(parents=True,exist_ok=True)
    now=datetime.datetime.now(datetime.timezone.utc)
    # Exclusive durable claim is never removed, including timeout/unknown commit.
    with (private/'dispatch-claim.json').open('x',encoding='utf8') as f:
        f.write(json.dumps({'claimed_at':now.isoformat(),'target':TARGET,'sql_sha256':SQL_SHA})+'\n')
    receipt={'observed_at':now.isoformat(),'target':TARGET,'sql_sha256':SQL_SHA,'discovery_sha256':DISCOVERY_SHA,'source_review':'independent m07_security_review, same hash, no unresolved material finding','result':'unverified','dispatch_claim_retained':True,'raw_diagnostics_suppressed':True}
    try:
        result=subprocess.run(['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(source),'--output-format','json','--workdir',str(ROOT)],cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60)
        receipt['exit_code']=result.returncode
        if result.returncode:raise ValueError('Outcome unconfirmed')
        rows=json.loads(result.stdout)['rows']
        if len(rows)!=1 or set(rows[0])!={'completion'}:raise ValueError('Outcome unconfirmed')
        completion=rows[0]['completion']
        expected={'principal_id':'0a79a703-caba-47e5-93d4-42e32197037a','capability':'settings.manage','inserted_rows':1,'existing_grants_preserved':True,'auth_users_created':0,'revoked_grants_reactivated':0,'operator':'postgres'}
        if completion!=expected:raise ValueError('Outcome unconfirmed')
        receipt.update(result='passed',completion=completion)
    finally:
        output=ROOT/'tracking/evidence/m07/live-settings-oauth'/f'{now.strftime("%Y-%m-%dT%H-%M-%S-%fZ")}-settings-capability-completion.json'
        output.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8')
        print(json.dumps({'result':receipt['result'],'evidence':str(output.relative_to(ROOT)),'readback_required':True}))

if __name__=='__main__':
    try:main()
    except Exception:
        print(json.dumps({'result':'unverified','next_action':'fixed read-only discovery; never repeat dispatch','raw_diagnostics_suppressed':True}))
        sys.exit(1)
