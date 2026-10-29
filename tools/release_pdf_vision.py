"""Fixed15->16 helper compatibility release. No seed, flag, credential or retry."""
import copy,datetime,hashlib,json,os,re,sys,tomllib,uuid
from pathlib import Path
from release_foundation import ROOT,TARGET,call as cli_call
MIGRATION='20261029094600_m02_pdf_vision.sql'
SEAL='5b7ad204f6dddde82ae829577ea1130fd426a3998797460871baad20d789cb50'
READBACK='tools/sql/specs-read-operation-readback.sql'
READBACK_SEAL='8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f'
PROOF='tracking/evidence/m02/pdf-vision-local/2026-10-29T09-44-04-388Z-c6863e17.json'
PROMOTION='tracking/evidence/m02/pdf-vision-promotion/2026-10-29T09-48-08-711Z-b98dc225.json'
FUNCTIONS={'eps.specs_validate_file_preparation','eps.store_specs_preparation'}
EVIDENCE=ROOT/'tracking/evidence/cloud-pdf-vision'
def require(value):
    if not value:raise ValueError('PDF_VISION_RELEASE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def canonical(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def read_json(file):return json.loads((ROOT/file).read_bytes())
def compare(before,after,expected):
    require(after['versions']==before['versions']+[MIGRATION[:14]])
    require({k:v for k,v in after.items() if k not in ('catalog','versions')}=={k:v for k,v in before.items() if k not in ('catalog','versions')})
    catalog=copy.deepcopy(after['catalog']);changes=[]
    for name in FUNCTIONS:
        old=next(row for row in before['catalog']['functions'] if row['name']==name)
        current=next(row for row in catalog['functions'] if row['name']==name)
        require(old['source_sha256']==expected[name]['before'] and current['source_sha256']==expected[name]['after'])
        changes.append({'name':name,'before':old['source_sha256'],'after':current['source_sha256']})
        current['source_sha256']=old['source_sha256']
    require(catalog==before['catalog']);return sorted(changes,key=lambda value:value['name'])
def prerequisites():
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False)
    manifest=read_json('development/local-db/reviewed.json');require(len(manifest['migrations'])==16)
    names=sorted(p.name for p in (ROOT/'supabase/migrations').glob('*.sql'));require(names==[Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']:require(sha((ROOT/row['path']).read_bytes())==row['sha256'])
    require(names[-1]==MIGRATION and sha((ROOT/'supabase/migrations'/MIGRATION).read_bytes())==SEAL)
    require(sha((ROOT/READBACK).read_bytes())==READBACK_SEAL)
    proof=read_json(PROOF);promotion=read_json(PROMOTION)
    require(proof['result']=='passed' and proof['rollback_verified'] and proof['sources_stable'] and proof['red_rejected_before_patch'] and proof['green_private_paged_preparation_and_callback'])
    require(proof['source_seals']['development/m02/pdf-vision-compatibility-candidate.sql']==SEAL and proof['cloud_called'] is False and proof['provider_called'] is False)
    require(promotion['result']=='passed' and promotion['only_two_helper_bodies_changed'] and promotion['business_and_all_other_catalog_preserved'] and promotion['cloud_called'] is False)
    changes={row['name']:row for row in promotion['changed_functions']};require(set(changes)==FUNCTIONS);compare(promotion['before'],promotion['after'],changes)
    return {'migration_sha256':SEAL,'proof_sha256':sha((ROOT/PROOF).read_bytes()),'promotion_sha256':sha((ROOT/PROMOTION).read_bytes()),'manifest_sha256':sha((ROOT/'development/local-db/reviewed.json').read_bytes())},[name[:14] for name in names[:-1]],changes
def call(arguments):
    result=cli_call(arguments);directory=ROOT/'.local/cloud-pdf-vision';directory.mkdir(parents=True,exist_ok=True)
    label=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    for stream in ('stdout','stderr'):(directory/(label+'.'+stream)).write_text(getattr(result,stream),encoding='utf8')
    return result
def inspect():
    result=call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT/READBACK),'--output-format','json']);require(result.returncode==0)
    rows=json.loads(result.stdout)['rows'];require(len(rows)==1 and set(rows[0])=={'specs_read_operation_release'})
    state=rows[0]['specs_read_operation_release'];require(state['query_role']=='postgres' and state['database']=='postgres' and state['unrestricted_visibility'] is True);return state
def retain(receipt,suffix):
    EVIDENCE.mkdir(parents=True,exist_ok=True);file=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'-'+suffix+'.json')
    file.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');return file.relative_to(ROOT).as_posix()
def main():
    action=sys.argv[1] if len(sys.argv)==2 else '';require(action in ('dry-run','apply','readback'))
    inputs,versions,expected=prerequisites();receipt={'action':action,'target':TARGET,'inputs':inputs,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'native_ocr_tested':False,'identity_provisioned':False,'flags_changed':False,'seeds':False}
    try:
        before=inspect();receipt['before']=before;require(before['versions'] in (versions,versions+[MIGRATION[:14]]))
        if action=='readback':
            baseline=read_json('tracking/evidence/cloud-pdf-vision/dry-run.json')['before'];receipt['changed_functions']=compare(baseline,before,expected);receipt['application_verified_by_readback']=True
        else:
            require(before['versions']==versions)
            if action=='apply':
                dry=read_json('tracking/evidence/cloud-pdf-vision/dry-run.json');age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result']=='passed' and canonical(dry['inputs'])==canonical(inputs) and dry['before']==before and 0<=age<=3600)
            receipt['attempt_receipt']=retain(receipt,action+'-attempt');command=['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']
            if action=='dry-run':command.append('--dry-run')
            receipt['dispatch_attempted']=action=='apply';result=call(command);receipt['exit_code']=result.returncode
            pending=sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)));receipt['pending_migrations']=pending
            after=inspect();receipt['readback']=after
            if action=='apply':receipt['changed_functions']=compare(before,after,expected);receipt['application_verified_by_readback']=True
            else:require(before==after)
            require(result.returncode==0 and pending==[MIGRATION])
        receipt['result']='passed'
    except Exception:
        receipt['reason']='Fixed PDF method release unconfirmed. Inspect readback/history before any repeat mutator.';raise
    finally:
        receipt['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();file=retain(receipt,action)
        if action=='dry-run' and receipt['result']=='passed':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed PDF vision compatibility release stopped; diagnostics remain private.\n');sys.exit(1)
