"""Root-authorized fixed read-only cloud role/settings projection. No key/table read."""
import datetime,hashlib,json,sys,uuid
from release_foundation import ROOT,TARGET,call
SQL='tools/sql/m03-admin-settings-readonly.sql'
SHA='f07400f1576d7acbf0e298fb940c251bfb62c86e87309dca86d47b377eeb3d2d'
def main():
    if sys.argv[1:]!=['--read-only']or(ROOT/'supabase/.temp/project-ref').read_text().strip()!=TARGET or hashlib.sha256((ROOT/SQL).read_bytes()).hexdigest()!=SHA:raise ValueError('Fixed scope required')
    report={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'target':TARGET,'result':'failed','sql':SQL,'sql_sha256':SHA,'cloud_write_attempted':False,'read_only':True,'application_tables_read':False,'private_configuration_read':False,'key_query_submitted':False}
    try:
        result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/SQL),'--output-format','json'])
        if result.returncode!=0:raise ValueError('Read-only query unconfirmed')
        rows=json.loads(result.stdout)['rows']
        if len(rows)!=1 or set(rows[0])!={'m03_admin_settings'}:raise ValueError('Metadata response invalid')
        value=rows[0]['m03_admin_settings']
        if value['query_role']!='postgres'or value['database']!='postgres':raise ValueError('Fixed postgres role required')
        report['metadata']=value;report['all_required_settings_present']=len(value['set_privileges'])==10
        report['all_required_set_privileges']=len(value['set_privileges'])==10 and all(value['set_privileges'].values());report['result']='passed'
    finally:
        report['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();directory=ROOT/'tracking/evidence/m03/remaining-activation';directory.mkdir(parents=True,exist_ok=True)
        path=directory/(report['finished_at'].replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8]+'-cloud-admin-settings.json');path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
        print(json.dumps({'result':report['result'],'receipt':path.relative_to(ROOT).as_posix(),'all_required_set_privileges':report.get('all_required_set_privileges'),'cloud_write_attempted':False,'key_query_submitted':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Read-only administrative metadata unconfirmed; raw diagnostics suppressed.\n');sys.exit(1)
