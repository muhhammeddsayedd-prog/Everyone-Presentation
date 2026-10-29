"""Fixed coordinated13->14 release. No credential provisioning, seed or cloud retry."""
from pathlib import Path
import copy, datetime, hashlib, json, os, re, sys, tomllib, uuid
from release_foundation import ROOT,TARGET,call as cli_call
from release_specs_read_operation import validate_runtime
MIGRATION='20261029090500_m02_service_claim_replay.sql'
SEAL='705d7432ab8cbe04fa5a94e090e1ce55e36c622590c09e0ce922ac5a59c6baf2'
READBACK='tools/sql/specs-read-operation-readback.sql'
READBACK_SEAL='8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f'
PROOF='tracking/evidence/m02/service-claim-replay/2026-10-29T08-55-09-367Z-06d070d5-rollback.json'
PROMOTION='tracking/evidence/m02/service-claim-promotion/2026-10-29T08-58-11-028Z-05d059f3.json'
TABLE='eps.job_stage_claim_replays'
FUNCTION='eps.claim_job_stage_replay'
EVIDENCE=ROOT/'tracking/evidence/cloud-service-claim'
EXTRA_OPERATION='eps.claim_job_stage_replay(jsonb, text, text, text)'
def require(value):
    if not value: raise ValueError('SERVICE_CLAIM_RELEASE_UNCONFIRMED')
def sha(value): return hashlib.sha256(value).hexdigest()
def canonical(value): return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def read_json(file): return json.loads((ROOT/file).read_bytes())
def additions(catalog):
    return {key:[row for row in rows if row.get('table')==TABLE or row.get('name') in (TABLE,FUNCTION)] for key,rows in catalog.items()}
def normalize_additions(catalog,roles):
    value=copy.deepcopy(additions(catalog))
    for key,rows in value.items():
        if key in ('table_acls','column_acls'): value[key]=[row for row in rows if row['role'] in roles]
        if key=='functions':
            for row in rows: row['execute']={k:v for k,v in row['execute'].items() if k in roles}
    return value
def compare(before,after,expected):
    require(after['versions']==before['versions']+[MIGRATION[:14]])
    for key in ('source_config','assets','buckets','release_additions_pristine','query_role','database','unrestricted_visibility'): require(after[key]==before[key])
    for key in ('counts','data_sha256'):
        adjusted=dict(after[key]); adjusted.pop(TABLE,None); require(adjusted==before[key])
    require(after['counts'][TABLE]==0)
    adjusted=copy.deepcopy(after['catalog'])
    for key,rows in adjusted.items(): adjusted[key]=[row for row in rows if row.get('table')!=TABLE and row.get('name') not in (TABLE,FUNCTION)]
    require(adjusted==before['catalog'])
    roles={row['name'] for row in before['catalog']['roles']}|{'anon','authenticated','service_role'}
    require(normalize_additions(after['catalog'],roles)==normalize_additions(expected['catalog'],roles))
    runtime=copy.deepcopy(after['runtime']); require(runtime['execute'].count(EXTRA_OPERATION)==1);runtime['execute'].remove(EXTRA_OPERATION)
    require(runtime==before['runtime']);validate_runtime(runtime)
def prerequisites():
    require((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    config=tomllib.loads((ROOT/'supabase/config.toml').read_text());require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False)
    manifest=read_json('development/local-db/reviewed.json'); require(len(manifest['migrations'])==14)
    names=sorted(p.name for p in (ROOT/'supabase/migrations').glob('*.sql'));require(names==[Path(row['path']).name for row in manifest['migrations']])
    for row in manifest['migrations']: require(sha((ROOT/row['path']).read_bytes())==row['sha256'])
    require(names[-1]==MIGRATION and sha((ROOT/'supabase/migrations'/MIGRATION).read_bytes())==SEAL)
    require(sha((ROOT/READBACK).read_bytes())==READBACK_SEAL)
    proof=read_json(PROOF);promotion=read_json(PROMOTION)
    require(proof['result']=='passed' and proof['rollback_verified'] and proof['source_seals']['candidate']==SEAL and proof['cloud_called'] is False)
    require(promotion['result']=='passed' and promotion['business_and_old_catalog_preserved'] and promotion['migration_sha256']==SEAL and promotion['cloud_called'] is False)
    return {'migration_sha256':SEAL,'proof_sha256':sha((ROOT/PROOF).read_bytes()),'promotion_sha256':sha((ROOT/PROMOTION).read_bytes()),'manifest_sha256':sha((ROOT/'development/local-db/reviewed.json').read_bytes())},[name[:14] for name in names[:-1]],promotion['after']
def call(arguments):
    result=cli_call(arguments);directory=ROOT/'.local/cloud-service-claim';directory.mkdir(parents=True,exist_ok=True)
    label=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%f')+'-'+uuid.uuid4().hex[:8]
    for stream in ('stdout','stderr'): (directory/(label+'.'+stream)).write_text(getattr(result,stream),encoding='utf8')
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
    inputs,versions,expected=prerequisites();receipt={'action':action,'target':TARGET,'inputs':inputs,'result':'failed','dispatch_attempted':False,'automatic_retry':False,'provider_called':False,'identity_provisioned':False,'seeds':False}
    try:
        before=inspect();receipt['before']=before;require(before['versions'] in (versions,versions+[MIGRATION[:14]]))
        if action=='readback':
            baseline=read_json('tracking/evidence/cloud-service-claim/dry-run.json')['before'];compare(baseline,before,expected);receipt['application_verified_by_readback']=True
        else:
            require(before['versions']==versions);validate_runtime(before['runtime'])
            if action=='apply':
                dry=read_json('tracking/evidence/cloud-service-claim/dry-run.json');age=(datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result']=='passed' and canonical(dry['inputs'])==canonical(inputs) and dry['before']==before and 0<=age<=3600)
            receipt['attempt_receipt']=retain(receipt,action+'-attempt');command=['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']
            if action=='dry-run':command.append('--dry-run')
            receipt['dispatch_attempted']=action=='apply'
            result=call(command);receipt['exit_code']=result.returncode;pending=sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)));receipt['pending_migrations']=pending
            after=inspect();receipt['readback']=after
            if action=='apply':compare(before,after,expected);receipt['application_verified_by_readback']=True
            else:require(before==after)
            require(result.returncode==0 and pending==[MIGRATION])
        receipt['result']='passed'
    except Exception:
        receipt['reason']='Fixed14 release unconfirmed. Inspect retained readback and history before any retry.'
        raise
    finally:
        receipt['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat();file=retain(receipt,action)
        if action=='dry-run' and receipt['result']=='passed':
            temporary=EVIDENCE/('dry-'+uuid.uuid4().hex+'.tmp');temporary.write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf8');os.replace(temporary,EVIDENCE/'dry-run.json')
        print(json.dumps({'result':receipt['result'],'receipt':file,'application_verified_by_readback':receipt.get('application_verified_by_readback',False),'automatic_retry':False}))
if __name__=='__main__':
    try:main()
    except Exception:sys.stderr.write('Fixed service-claim release stopped; raw diagnostics remain private.\n');sys.exit(1)
