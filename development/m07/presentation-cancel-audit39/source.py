"""Read catalog source privately; publish only code hashes and aggregate counts."""
from pathlib import Path
import datetime,importlib.util,json,os,sys,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('cancel_audit_existing_pure_helpers',HERE/'audit.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
def main():
 b.need(len(sys.argv)==1 and(b.MAIN/'supabase/.temp/project-ref').read_text().strip()==b.TARGET)
 for file,pin in b.PINS.items():b.need(b.sha(file.read_bytes())==pin)
 raw=(HERE/'source.sql').read_bytes();text=raw.decode();import pglast
 b.need([type(n.stmt).__name__ for n in pglast.parse_sql(text)]==['TransactionStmt','VariableSetStmt','VariableSetStmt','VariableSetStmt','SelectStmt','TransactionStmt'])
 b.need(text.startswith('begin isolation level repeatable read read only;')and text.rstrip().endswith('rollback;'))
 reader=b.module('cancel_source_normal_reader',b.READER);sys.path.insert(0,str(b.ROOT/'tools'));security=b.module('cancel_source_guard',b.GUARD);b.need(security.ROOT==b.ROOT)
 directory=b.ROOT/'.local/presentation-cancel-source39'/str(uuid.uuid4());directory.mkdir(parents=True,exist_ok=False);guard=security.WindowsPrivateFiles();file=directory/'source.sql'
 with guard.create(file)as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',b.TARGET,'--file',str(file),'--output-format','json','--workdir',str(b.MAIN)]
 code,timeout,overflow,out,_=reader.bounded(args,reader.environment());b.need(code==0 and not timeout and not overflow)
 payload=json.loads(out);rows=payload if type(payload)is list else payload.get('rows');b.need(type(rows)is list and len(rows)==1 and set(rows[0])=={'cancellation_source'});value=rows[0]['cancellation_source']
 b.need(value['database']==value['operator']=='postgres'and value['read_only']is True and value['history_count']==39 and len(value['workspaces'])==2 and 4<=len(value['functions'])<=10)
 original=json.dumps(value,sort_keys=True,separators=(',',':')).encode()
 with guard.create(directory/'catalog-source.json')as stream:stream.write(original);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 for function in value['functions']:
  definition=function.pop('definition');b.need(type(definition)is str and len(definition)<100000)
  function['definition_sha256']=b.sha(definition.encode())
 receipt={'schema_version':'1.0','scope':'read_only_catalog_source_and_active_vs_archived_counts','result':'observed','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'read_only_rollback':True,'generation_or_role_simulation_or_explain_or_mutation':False,'raw_function_source_published':False,'source_sha256':b.sha(Path(__file__).read_bytes()),'sql_sha256':b.sha(raw),'private_source_path':(directory/'catalog-source.json').relative_to(b.ROOT).as_posix(),'private_source_sha256':b.sha(original),'metadata':value}
 folder=b.ROOT/'tracking/evidence/m07/presentation-cancel-audit39';folder.mkdir(parents=True,exist_ok=True);output=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-active-source-metadata.json')
 with output.open('x',encoding='utf8',newline='\n')as stream:json.dump(receipt,stream,sort_keys=True,indent=2);stream.write('\n')
 print(json.dumps({'result':'observed','receipt':output.relative_to(b.ROOT).as_posix(),'metadata':value}))
if __name__=='__main__':
 try:main()
 except Exception:print('PRESENTATION_CANCEL_SOURCE_UNCONFIRMED');sys.exit(1)
