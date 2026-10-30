"""Current27 admission over the unchanged metadata-only M06 query/parser."""
import copy
import datetime
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import uuid
from release_foundation import ROOT,TARGET
import release_m06_storage27 as release

spec=importlib.util.spec_from_file_location('m06_27_metadata_parser',ROOT/'tools/capture-m06-app.py')
legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
parse26=legacy.validate
MANIFEST='development/local-db/reviewed.json'
BASELINE26='development/m06/baseline26-reviewed.json'
BASELINE26_SHA='d478c64785b7086113d1af3dc773df04ecdf407ec23a7066350ec13b71ea0abe'
FORWARD_SHA='9e3ab85655c2fa0490aba07118fe730dae2c6193f651c3ba086910d82b7eb171'
SQL=legacy.SQL;SQL_SHA=legacy.SQL_SHA;BASELINE=legacy.BASELINE;WORKSPACE=legacy.WORKSPACE
require=legacy.require;sha=legacy.sha
SOURCES=[*legacy.SOURCES,BASELINE26,'tools/capture-m06-app27.py','tools/release_m06_storage27.py','tests/operations/test_m06_current27_observers.py']

def inputs():
    release.validate_process_scope(os.environ);require(TARGET=='pyibofyctwnqpvktepse'and(ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
    require(sha((ROOT/SQL).read_bytes())==SQL_SHA and sha((ROOT/BASELINE).read_bytes())==legacy.BASELINE_SHA)
    require(sha((ROOT/BASELINE26).read_bytes())==BASELINE26_SHA)
    baseline26=json.loads((ROOT/BASELINE26).read_bytes());manifest=json.loads((ROOT/MANIFEST).read_bytes())
    require(len(baseline26['migrations'])==26 and len(manifest['migrations'])==27 and manifest['migrations'][:-1]==baseline26['migrations'])
    last=manifest['migrations'][-1];require(re.fullmatch(r'supabase/migrations/[0-9]{14}_m06_guest_storage_policy_composition\.sql',last['path'])and last['sha256']==FORWARD_SHA)
    names=[];versions=[]
    for item in manifest['migrations']:
        name=item['path'];require(re.fullmatch(r'supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql',name));require(sha((ROOT/name).read_bytes())==item['sha256'])
        names.append(name);versions.append(Path(name).name[:14])
    require(versions==sorted(set(versions)))
    baseline=json.loads((ROOT/BASELINE).read_bytes());require(baseline['result']=='captured'and baseline['target']==TARGET and baseline['read_only']is True and baseline['state']['migration_versions']==versions[:24])
    return versions,{name:sha((ROOT/name).read_bytes())for name in sorted(set(SOURCES+names))},baseline['state']

def validate(state,versions,baseline):
    require(type(versions)is list and len(versions)==27 and versions[-2]=='20261030004643'and versions==sorted(set(versions))and re.fullmatch(r'[0-9]{14}',versions[-1]))
    require(type(state)is dict and state.get('migration_versions')==versions)
    # Only the parser's historical admission count is adapted. The real27
    # history remains in the captured state and is checked above/against manifest.
    projected=copy.deepcopy(state);projected['migration_versions']=versions[:-1]
    return parse26(projected,versions[:-1],baseline)

def retain(report):
    directory=ROOT/'tracking/evidence/m06/app-capture27';directory.mkdir(parents=True,exist_ok=True)
    file=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
    with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
    return file.relative_to(ROOT).as_posix()

legacy.inputs=inputs;legacy.validate=validate;legacy.retain=retain;legacy.cli_call=release.call
main=legacy.main
if __name__=='__main__':sys.exit(main())
