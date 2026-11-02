"""Only aggregate cardinalities and byte sizes; no facts or transcript values."""
from pathlib import Path
import datetime,importlib.util,json,os,sys,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cancel_background_pure',HERE/'audit.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
def main():
 b.need(len(sys.argv)==1 and(b.MAIN/'supabase/.temp/project-ref').read_text().strip()==b.TARGET)
 for file,pin in b.PINS.items():b.need(b.sha(file.read_bytes())==pin)
 raw=(HERE/'background.sql').read_bytes();text=raw.decode();import pglast
 b.need([type(n.stmt).__name__ for n in pglast.parse_sql(text)]==['TransactionStmt','VariableSetStmt','VariableSetStmt','VariableSetStmt','SelectStmt','TransactionStmt'])
 b.need(text.startswith('begin isolation level repeatable read read only;')and text.rstrip().endswith('rollback;'))
 reader=b.module('cancel_background_normal_reader',b.READER);sys.path.insert(0,str(b.ROOT/'tools'));security=b.module('cancel_background_guard',b.GUARD);b.need(security.ROOT==b.ROOT)
 directory=b.ROOT/'.local/presentation-cancel-background39'/str(uuid.uuid4());directory.mkdir(parents=True,exist_ok=False);guard=security.WindowsPrivateFiles();file=directory/'background.sql'
 with guard.create(file)as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',b.TARGET,'--file',str(file),'--output-format','json','--workdir',str(b.MAIN)]
 code,timeout,overflow,out,_=reader.bounded(args,reader.environment());b.need(code==0 and not timeout and not overflow)
 payload=json.loads(out);rows=payload if type(payload)is list else payload.get('rows');b.need(type(rows)is list and len(rows)==1 and set(rows[0])=={'background_metadata'});value=rows[0]['background_metadata']
 b.need(value['database']==value['operator']=='postgres'and value['read_only']is True and value['history_count']==39 and len(value['workspace_payload_sizes'])==2)
 receipt={'schema_version':'1.0','scope':'read_only_synthetic_scale_inputs_counts_and_byte_sizes_only','result':'observed','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only_rollback':True,'facts_transcript_values_or_personal_text_returned':False,'generation_role_or_database_mutation':False,'source_sha256':b.sha(Path(__file__).read_bytes()),'sql_sha256':b.sha(raw),'metadata':value}
 folder=b.ROOT/'tracking/evidence/m07/presentation-cancel-audit39';output=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-background-metadata.json')
 with output.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':'observed','receipt':output.relative_to(b.ROOT).as_posix(),'metadata':value}))
if __name__=='__main__':
 try:main()
 except Exception:print('PRESENTATION_CANCEL_BACKGROUND_UNCONFIRMED');sys.exit(1)
