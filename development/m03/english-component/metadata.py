"""Separate count/binding diagnosis only. No transcript, provider or mutation."""
from pathlib import Path
import datetime,importlib.util,json,re,sys,uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_component_lookup',HERE/'lookup.py');lookup=importlib.util.module_from_spec(spec);spec.loader.exec_module(lookup)
SQL=HERE/'inspect-source-metadata.sql'
SQL_SHA='37c32beecc0a7dc348a6883bf1c54522d2107e1ace4043e707cf7de1e24b11ea'

def main():
 lookup.need(len(sys.argv)==1 and(lookup.ROOT/'supabase/.temp/project-ref').read_text().strip()==lookup.TARGET)
 raw=SQL.read_bytes();lookup.need(lookup.sha(raw)==SQL_SHA and raw.startswith(b'begin read only;')and raw.rstrip().endswith(b'rollback;'))
 directory=lookup.PRIVATE/str(uuid.uuid4());directory.mkdir();snapshot=(directory/'metadata.sql').resolve()
 with snapshot.open('xb')as stream:stream.write(raw)
 lookup.snapshot_ok(snapshot,SQL_SHA)
 with(lookup.PRIVATE/'source-metadata.claim.json').open('x',encoding='utf8')as stream:json.dump({'claimed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sql_sha256':SQL_SHA,'automatic_retry':False},stream)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',lookup.TARGET,'--file',str(snapshot),'--output-format','json','--workdir',str(lookup.ROOT)]
 code,timeout,overflow,stdout,stderr=lookup.bounded(command);lookup.snapshot_ok(snapshot,SQL_SHA)
 lookup.need(code==0 and not timeout and not overflow)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 lookup.need(type(rows)is list and len(rows)==1 and type(rows[0])is dict and set(rows[0])=={'english_component_metadata'})
 value=rows[0]['english_component_metadata']
 lookup.need(type(value)is dict and set(value)=={'database','operator','history_count','total','rows'})
 lookup.need(value['database']=='postgres'and value['operator']=='postgres'and type(value['history_count'])is int and 33<=value['history_count']<=34)
 lookup.need(type(value['total'])is int and 0<=value['total']<=1000 and type(value['rows'])is list and len(value['rows'])==min(value['total'],20))
 ids={'candidate_media_id','candidate_id','source_asset_id','transcript_asset_id','source_job_id'};flags={'raw_present','raw_within_legacy_bound','scan_job_source_matches'}
 for row in value['rows']:
  lookup.need(type(row)is dict and set(row)==ids|flags)
  for key in ids:lookup.need(row[key]is None and key in('transcript_asset_id','source_job_id')or type(row[key])is str and lookup.UUID.fullmatch(row[key]))
  lookup.need(all(type(row[key])is bool for key in flags))
 receipt={'evidence_kind':'exact_source_binding_metadata_diagnosis','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sql_sha256':SQL_SHA,'read_only_rollback':True,'automatic_retry':False,'raw_cli_persisted':False,'provider_called':False,'metadata':value}
 directory=lookup.ROOT/'tracking/evidence/m03/english-component';directory.mkdir(parents=True,exist_ok=True)
 path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-source-metadata.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'receipt':path.relative_to(lookup.ROOT).as_posix(),'metadata':value,'provider_called':False}))

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH_COMPONENT_SOURCE_METADATA_UNCONFIRMED');sys.exit(1)
