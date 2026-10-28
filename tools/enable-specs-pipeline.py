"""Enable the reviewed nonsecret10 configuration once; no credential/data writes."""
import datetime
import hashlib
import json
import sys
from release_foundation import ROOT, TARGET, call
from provision_logo_verifier import WindowsPrivateFiles

SQL='tools/sql/enable-specs-pipeline.sql'
SEAL='026df9794f704ba84bc8a9aecb175b15c3a0bffe0ce41509fd614240c33587e8'

def main():
    assert sys.argv[1:]==['enable']
    assert (ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET
    assert hashlib.sha256((ROOT/SQL).read_bytes()).hexdigest()==SEAL
    WindowsPrivateFiles().verify(ROOT/'.env.worker-runtime.local')
    directory=ROOT/'tracking/evidence/m02/specs-runtime'; directory.mkdir(parents=True,exist_ok=True)
    journal=ROOT/'.local/specs-runtime/pipeline-enable.json'
    with journal.open('x',encoding='utf-8') as handle:
        json.dump({'status':'dispatching','automatic_retry':False},handle); handle.flush()
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'sql_sha256':SEAL,
            'result':'unconfirmed','automatic_retry':False,'credentials_recorded':False}
    if result.returncode==0:
        value=json.loads(result.stdout)['rows'][0]['enabled']
        assert set(value)=={'configuration','jobs','source_inputs','roles','slots'}
        expected={'id':1,'enabled':True,'document_preparation_version':'document-preparation.v1','model_version':'gpt-6.1-sol',
                  'prompt_version':'spec_extract_v1.0.0','result_schema_version':'1.0'}
        assert value['configuration']==expected and all(value[k]==0 for k in ('jobs','source_inputs','roles','slots'))
        report.update(result='passed',configuration=expected,business_facts_created=False)
    journal.write_text(json.dumps({'status':report['result'],'automatic_retry':False}),encoding='utf-8')
    (directory/(report['observed_at'].replace(':','-')+'-pipeline-enable.json')).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report)); return 0 if report['result']=='passed' else 1
if __name__=='__main__':
    try: sys.exit(main())
    except Exception: print('{"result":"unconfirmed","code":"PIPELINE_ENABLE_UNCONFIRMED","automatic_retry":false}'); sys.exit(1)
