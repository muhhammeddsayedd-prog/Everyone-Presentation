"""Offline source/binary/public evidence inspection. No provider/CLI call."""
from pathlib import Path
import datetime,importlib.util,json
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
p=module('completion39_offline_provider_inspection',HERE/'provider.py');c=module('completion39_offline_controller_inspection',HERE/'controller.py')
p.need(c.ROLLOUT_ENABLED is False and p.s.sha(p.s.load(p.REGISTRY))==p.REGISTRY_SHA)
state=p.s.State();registry=module('completion39_read_only_transport_pins',p.REGISTRY)
pins={**state.source_pins(),**registry.sources()}
for file,digest in[(p.RUNTIME,p.RUNTIME_SHA),(p.EMITTER,p.EMITTER_SHA)]:p.need(p.s.sha(p.s.load(file))==digest);pins[str(file)]=digest
for name,digest in p.CLI_PINS.items():
 file=registry.CLI.parent/name;p.need(p.s.sha(p.s.load(file))==digest);pins[str(file)]=digest
references={}
for key,(relative,digest)in p.REFS.items():
 file=p.s.ROOT/'tracking/evidence/m07'/relative;raw=p.s.load(file);p.need(p.s.sha(raw)==digest);references[key]={'path':file.relative_to(p.s.ROOT).as_posix(),'sha256':digest}
inputs=json.loads(p.s.load(HERE/'inputs.json'));pending=[]
if inputs['startup_observer_sha256']is None:pending.append('reviewed_armed_startup_observer_sha256')
if inputs['native_concurrency']is None:pending.append('passed_actual_schema39_SQL_concurrency_reference')
value={'schema_version':'1.0','observed_at':registry.b.stamp(),'result':'passed_disabled_source_checks_pending_runtime_inputs','rollout_enabled':False,'run':p.RUN,
 **p.bindings(),'sql_contract_sha256':state.sql_contract_sha256(),'source_pins':pins,'references':references,'pending':pending,
 'protected_metadata_projection_read':True,'private_runtime_credentials_opened':False,'CLI_or_provider_called':False,'cloud_mutations':False,'actual_rollout_or_recovery_acceptance':False}
file=p.s.ROOT/'tracking/evidence/m07/completion-worker'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-rollout39-source-inspection.json')
registry.b.exclusive(file,value)
print(json.dumps({'result':value['result'],'receipt':file.relative_to(p.s.ROOT).as_posix(),'pending':pending,'provider_called':False}))
