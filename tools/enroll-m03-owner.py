"""Execute the fixed explicit owner-requested test-project/capability enrollment."""
from pathlib import Path
import datetime, hashlib, json, sys
from release_foundation import ROOT, TARGET, call

def main():
    if sys.argv[1:] != ['apply'] or (ROOT/'supabase/.temp/project-ref').read_text().strip()!=TARGET:
        raise ValueError('Fixed linked owner enrollment required.')
    source=ROOT/'tools/sql/m03-owner-enrollment.sql'
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(source),'--output-format','json'])
    private=ROOT/'.local/m03-owner-enrollment';private.mkdir(parents=True,exist_ok=True)
    (private/'last-response.txt').write_text(result.stdout+'\n'+result.stderr,encoding='utf8')
    if result.returncode: raise ValueError('Enrollment unconfirmed; inspect fixed readback before retry.')
    rows=json.loads(result.stdout)['rows']
    if len(rows)!=1 or rows[0]['enrollment']['auth_users_created']!=0: raise ValueError('Enrollment response unconfirmed.')
    evidence={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'sql_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
              'result':'passed','enrollment':rows[0]['enrollment'],'hosting_changed':False}
    folder=ROOT/'tracking/evidence/m03';folder.mkdir(parents=True,exist_ok=True)
    (folder/'owner-enrollment.json').write_text(json.dumps(evidence,indent=2)+'\n',encoding='utf8')
    print(json.dumps(evidence))

if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Owner enrollment stopped; private diagnostics suppressed.\n');sys.exit(1)
