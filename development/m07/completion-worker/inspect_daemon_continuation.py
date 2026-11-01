"""Read-only source/binary/public-reference checks; never opens credentials."""
from pathlib import Path
import importlib.util,json
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion_daemon_continuation_inspect',HERE/'daemon-continuation.py');d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
d.need(d.CONTINUATION_ENABLED is False)
pins=d.sources();references=d.references()
value={'schema_version':'1.0','observed_at':d.r.b.stamp(),'result':'passed_disabled_source_and_public_reference_inspection','continuation_enabled':False,'source_sha256':d.r.b.SOURCE,
 'native_runtime_digest':d.r.DIGESTS['native'],'daemon_runtime_digest':d.r.DIGESTS['daemon'],'target':d.r.b.target('daemon'),'source_pins':pins,'references':references,
 'CLI_or_process_query_called':False,'private_credentials_opened':False,'provider_called':False,'daemon_refresh_normal_return_claimed':False}
output=d.r.EVIDENCE/(value['observed_at'].replace(':','-').replace('.','-')+'-daemon-continuation-inspection.json')
d.r.b.exclusive(output,value)
print(json.dumps({'result':value['result'],'receipt':output.relative_to(d.r.ROOT).as_posix(),'provider_called':False}))
