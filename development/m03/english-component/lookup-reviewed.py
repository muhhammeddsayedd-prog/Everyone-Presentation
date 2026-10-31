"""Exact retained Reviewed-proof source binding; no arbitrary duplicate choice."""
from pathlib import Path
import datetime,importlib.util,json,sys,uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_component_lookup',HERE/'lookup.py');lookup=importlib.util.module_from_spec(spec);spec.loader.exec_module(lookup)
SQL=HERE/'inspect-reviewed-source.sql'
SQL_SHA='c18fc648a50c59d4966ce82eed39a89afe299ec31ce7bfcbf83cfb9a39e3c81f'
PROOF=lookup.ROOT/'tracking/evidence/m03/reviewed-source-readback/2026-10-29T20-17-30-125263Z-6afa02e0.json'
PROOF_SHA='51b39670ff6493aa1e6efb1f357484e1083681d38a41e421b3f79e19d7b39a76'
EXPECTED={'candidate_id':'25a3c924-7b6c-48e3-88ce-c72e72b99c6d','candidate_media_id':'f5dff77f-092f-4777-9f56-3bbce4dee57c',
 'source_asset_id':'5f8a6d53-0da0-4064-aacf-aea6b9c47c81','job_id':'9a5ddb61-6a9a-4157-b6be-8653cf2eadef','source_sha256':lookup.SOURCE_SHA}

def safe_summary(payload):
 rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 if type(rows)is not list or len(rows)!=1 or type(rows[0])is not dict:return {'shape_valid':False}
 value=rows[0].get('english_component_source')
 if type(value)is not dict:return {'shape_valid':False}
 source=value.get('source')
 return {'shape_valid':True,'operator_expected':value.get('operator')=='postgres','database_expected':value.get('database')=='postgres',
  'history_count':value.get('history_count')if type(value.get('history_count'))is int and 0<=value['history_count']<=100 else None,
  'match_count':value.get('match_count')if type(value.get('match_count'))is int and 0<=value['match_count']<=1000 else None,
  'source_object_present':type(source)is dict,'transcript_asset_is_null':type(source)is dict and source.get('transcript_asset_id')is None,
  'scan_job_is_null':type(source)is dict and source.get('source_job_id')is None,'raw_string_present':type(source)is dict and type(source.get('original_text'))is str}

def main():
 lookup.need(len(sys.argv)==1 and(lookup.ROOT/'supabase/.temp/project-ref').read_text().strip()==lookup.TARGET)
 proof_bytes=PROOF.read_bytes();lookup.need(lookup.sha(proof_bytes)==PROOF_SHA);proof=json.loads(proof_bytes)
 confirmation=proof.get('confirmation');lookup.need(type(confirmation)is dict and confirmation.get('effective_reviewed')is True)
 lookup.need(all(confirmation.get(key)==value for key,value in EXPECTED.items()))
 prepared=json.loads((lookup.ROOT/'.local/m03-media-private/authorized-video-1.json').read_text(encoding='utf8'))
 lookup.need(prepared['original_filename']=='IMG_2850.MP4'and prepared['result']['source_sha256']==lookup.SOURCE_SHA)
 lookup.need(lookup.sha(Path('C:/Users/iway/Downloads/Videos/IMG_2850.MP4').read_bytes())==lookup.SOURCE_SHA)
 raw=SQL.read_bytes();lookup.need(lookup.sha(raw)==SQL_SHA and raw.startswith(b'begin read only;')and raw.rstrip().endswith(b'rollback;'))
 with(lookup.PRIVATE/'reviewed-source-lookup.claim.json').open('x',encoding='utf8')as stream:json.dump({'claimed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sql_sha256':SQL_SHA,'reviewed_proof_sha256':PROOF_SHA,'automatic_retry':False},stream)
 directory=lookup.PRIVATE/str(uuid.uuid4());directory.mkdir();snapshot=(directory/'reviewed-source.sql').resolve()
 with snapshot.open('xb')as stream:stream.write(raw)
 lookup.snapshot_ok(snapshot,SQL_SHA)
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',lookup.TARGET,'--file',str(snapshot),'--output-format','json','--workdir',str(lookup.ROOT)]
 code,timeout,overflow,stdout,stderr=lookup.bounded(command);lookup.snapshot_ok(snapshot,SQL_SHA)
 receipt={'evidence_kind':'reviewed_evidence_pinned_exact_source_read_only_lookup','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'case_alias':'permitted-arabic-introduction-01','target':lookup.TARGET,'sql_sha256':SQL_SHA,'reviewed_proof_sha256':PROOF_SHA,'read_only_rollback':True,'automatic_retry':False,'raw_cli_persisted':False,'exit_code':code,'timed_out':timeout,'output_limit_exceeded':overflow,'source_confirmed':False,'stage':'cli_execution'}
 try:
  lookup.need(code==0 and not timeout and not overflow);receipt['stage']='cli_output_json';payload=json.loads(stdout);receipt['safe_summary']=safe_summary(payload)
  receipt['stage']='exact_source_binding';source=lookup.parse_source(payload)
  lookup.need(source['candidate_media_id']==EXPECTED['candidate_media_id']and source['source_asset_id']==EXPECTED['source_asset_id']and source['source_job_id']==EXPECTED['job_id'])
  receipt['stage']='private_source_persist'
  with(lookup.PRIVATE/'source-binding.json').open('x',encoding='utf8',newline='\n')as stream:json.dump(source,stream,ensure_ascii=False)
  receipt['source_confirmed']=True;receipt['stage']='verified'
 except Exception:pass
 out=lookup.ROOT/'tracking/evidence/m03/english-component';out.mkdir(parents=True,exist_ok=True)
 path=out/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-reviewed-source-read.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(receipt,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'source_confirmed':receipt['source_confirmed'],'stage':receipt['stage'],'safe_summary':receipt.get('safe_summary'),'receipt':path.relative_to(lookup.ROOT).as_posix(),'provider_called':False}))
 lookup.need(receipt['source_confirmed'])

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH_COMPONENT_REVIEWED_SOURCE_UNCONFIRMED');sys.exit(1)
