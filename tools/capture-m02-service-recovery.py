import datetime,json,sys
from release_foundation import ROOT,TARGET,call
def main():
    if sys.argv[1:]:raise ValueError()
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/'tools/sql/m02-service-recovered-readback.sql'),'--output-format','json'])
    if result.returncode:raise ValueError()
    proof=json.loads(result.stdout)['rows'][0]['proof']
    if proof['target_count']!=1 or proof['job']['status']!='succeeded' or proof['http_attempt_events']!={'heartbeats':1,'deliberate_failures':1} or not all(proof['protected_source'].values()):raise ValueError()
    folder=ROOT/'tracking/evidence/m02/service-http-probe';name=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%SZ')+'-real-recovery.json'
    (folder/name).write_text(json.dumps({'result':'passed','target':TARGET,'scope':'Real isolated HTTP recovery through worker, n8n and OpenAI; metadata and synthetic-case booleans only','proof':proof},indent=2)+'\n',encoding='utf8')
    print(json.dumps({'result':'passed','receipt':str((folder/name).relative_to(ROOT)),'provider':proof['provider'],'draft':proof['draft'],'protected_source':proof['protected_source']}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Scoped M02 recovery readback unconfirmed. Private diagnostics suppressed.\n');sys.exit(1)
