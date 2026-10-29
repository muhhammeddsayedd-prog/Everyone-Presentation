"""Offline reconciliation of actual before/fresh read-only11 proof; no SQL."""
from pathlib import Path
import datetime
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
INPUTS={
 'before':('tracking/evidence/m02/specs-assets-promotion/2026-10-29T00-34-38-469Z-7b25a4a8.json','65e9cf148610a8bb8ab9487e82764cc3a3b23ed3813cdc9ed53bac85e172b8d4'),
 'fresh':('tracking/evidence/cloud-specs-assets/2026-10-29T00-35-48-622Z-1849538f-local-contract.json','4a6751237eb489cc367a1af665c1660eb908d345e034d1ecbb8ed0ddfd944420')}

def main():
    values={}
    for key,(relative,seal) in INPUTS.items():
        data=(ROOT/relative).read_bytes(); assert hashlib.sha256(data).hexdigest()==seal
        values[key]=json.loads(data)
    attempt=values['before']; before=attempt['before']; fresh=values['fresh']; after=fresh['readback']
    assert attempt['result']=='unconfirmed' and attempt['promotion']['result']=='applied'
    assert fresh['read_only'] is True and fresh['cloud_called'] is False
    assert fresh['system_identifier']=='7701520506262638626' and len(after['versions'])==11 and after['versions'][-1]=='20261029001520'
    assert all(after['counts'][name]==(amount+2 if name=='storage.buckets' else amount) for name,amount in before['counts'].items())
    assert all(after['data_sha256'][name]==value for name,value in before['data_sha256'].items())
    assert after['release_additions_pristine'] is True and after['source_config']==before['source_config']
    assert after['assets']=={'keys':0,'config':{'id':1,'uploads_enabled':False,'capabilities_enabled':False,'file_pipeline_enabled':False},'grants':0,'uploads':0,'preparations':0}
    result={'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'result':'passed','scope':'Read-only/offline reconciliation of committed local11 promotion; no reapply or receipt rewriting',
      'inputs':{key:{'path':relative,'sha256':seal} for key,(relative,seal) in INPUTS.items()},'versions':after['versions'],
      'old_business_rows_and_hashes_preserved':True,'only_new_two_buckets_and_disabled_config_added':True,'new_fields_pristine':True,
      'earlier_attempt_result':'unconfirmed','schema_mutation_performed':False,'cloud_called':False}
    directory=ROOT/'tracking/evidence/m02/specs-assets-reconciliation'; directory.mkdir(parents=True,exist_ok=True)
    path=directory/(result['observed_at'].replace(':','-')+'.json'); path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'result':'passed','receipt':path.relative_to(ROOT).as_posix(),'old_business_rows_and_hashes_preserved':True,'schema_mutation_performed':False}))
if __name__=='__main__':main()
