"""Emit public exact checkpoint SQL for owned-local validation; never dispatch."""
from pathlib import Path
import importlib.util,json
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion39_checkpoint_factory',HERE/'provider.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
value=p.Provider.__new__(p.Provider);value.s=p.s.State();text=value.checkpoint_sql();output=HERE/'checkpoint-query.sql'
with output.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
print(json.dumps({'query':str(output),'sha256':p.s.sha(text.encode()),'bytes':len(text.encode()),'sql_contract_sha256':value.s.sql_contract_sha256(),'SQL_or_provider_called':False}))
