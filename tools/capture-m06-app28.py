"""Current28 fixed-workspace metadata observer. No transcript or language text."""
import copy
import datetime
import importlib.util
import json
from pathlib import Path
import sys
import uuid
from release_foundation import ROOT,TARGET
import release_m06_transcript28 as release

spec=importlib.util.spec_from_file_location('m06_28_original_metadata',ROOT/'tools/capture-m06-app.py')
legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
parse26=legacy.validate
SQL='tools/sql/m06-app-capture28.sql'
SQL_SHA='970d1fe5eb83e881681d2e96534c65cf3099d326b0f6af1c7e35f1f00060f1c5'
BASELINE=legacy.BASELINE;WORKSPACE=legacy.WORKSPACE
BASELINE27='development/m06/baseline27-reviewed.json'
BASELINE27_SHA='07daca7c24ebbc774c5c7453cab5c2d2f63292b52533cae8b9e1a809c1b0bd78'
require=legacy.require;sha=legacy.sha
SOURCES=[*legacy.SOURCES,SQL,BASELINE27,'tools/capture-m06-app28.py','tools/release_m06_transcript28.py','tests/operations/test_m06_current28_observers.py','tools/export-m06-private-snapshot28.py','tools/export-m06-private-transcripts28.py','tests/operations/test_m06_private_transcripts28.py','tools/test-m06-app28-observer-local.mjs']

def inputs():
    admission=release.current_release_inputs()
    require(TARGET=='pyibofyctwnqpvktepse'and sha((ROOT/SQL).read_bytes())==SQL_SHA)
    require(sha((ROOT/BASELINE27).read_bytes())==BASELINE27_SHA)
    manifest=json.loads((ROOT/'development/local-db/reviewed.json').read_bytes())
    old=json.loads((ROOT/BASELINE27).read_bytes())
    require(len(manifest['migrations'])==28 and len(old['migrations'])==27 and manifest['migrations'][:-1]==old['migrations'])
    versions=admission['versions'];require(len(versions)==28 and versions[-2:]==['20261030013832','20261030030717'])
    baseline=json.loads((ROOT/BASELINE).read_bytes());require(sha((ROOT/BASELINE).read_bytes())==legacy.BASELINE_SHA)
    require(baseline['result']=='captured'and baseline['target']==TARGET and baseline['read_only']is True and baseline['state']['migration_versions']==versions[:24])
    names=[row['path']for row in manifest['migrations']]
    seals={name:sha((ROOT/name).read_bytes())for name in sorted(set(SOURCES+names+list(admission['source_seals'])+[release.CONFIG]))}
    return versions,seals,baseline['state']

def validate(state,versions,baseline):
    require(type(versions)is list and len(versions)==28 and versions[-3:]==['20261030004643','20261030013832','20261030030717']and versions==sorted(set(versions)))
    require(type(state)is dict and state.get('migration_versions')==versions and'video_transcripts'in state)
    projected=copy.deepcopy(state);items=projected.pop('video_transcripts');projected['migration_versions']=versions[:-2]
    checks=parse26(projected,versions[:-2],baseline)
    legacy.sequence(items,1000);pairs=set();fixed={v['id']:v for v in state['versions']};counts={}
    for item in items:
        legacy.row(item,{'version_id':legacy.identifier,'asset_id':legacy.identifier,'candidate_media_id':legacy.identifier,
          'source_media_row_version':lambda x:legacy.integer(x,1),'status':legacy.enum('available','not_provided'),'text_present':legacy.boolean,
          'text_codepoints':lambda x:legacy.integer(x,0,200000),'source_sha256':legacy.optional(legacy.digest),
          'languages_sha256':legacy.digest,'language_count':lambda x:legacy.integer(x,0,100),'captured_at':legacy.timestamp,'source_hash_matches':legacy.boolean,
          'source_contract_valid':legacy.boolean,'fixed_video_pin':legacy.boolean})
        pair=(item['version_id'],item['asset_id']);require(pair not in pairs and pair[0]in fixed);pairs.add(pair)
        require(all(item[k]is True for k in('source_hash_matches','source_contract_valid','fixed_video_pin')))
        require(any(p['asset_id']==pair[1]and p['asset_kind']=='candidate_video'for p in fixed[pair[0]]['pins']))
        if item['status']=='available':require(item['text_present']is True and item['text_codepoints']>0 and item['source_sha256']is not None)
        else:require(item['text_present']is False and item['text_codepoints']==0 and item['source_sha256']is None and item['language_count']==0)
        counts[pair[0]]=counts.get(pair[0],0)+1
    for version_id,count in counts.items():require(count==sum(p['asset_kind']=='candidate_video'for p in fixed[version_id]['pins']))
    return{**checks,'frozen_source_companion_metadata_valid':True,'transcript_payload_and_language_values_excluded':True}

def retain(report):
    directory=ROOT/'tracking/evidence/m06/app-capture28';directory.mkdir(parents=True,exist_ok=True)
    file=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+uuid.uuid4().hex[:8]+'.json')
    with file.open('x',encoding='utf8')as handle:json.dump(report,handle,indent=2);handle.write('\n')
    return file.relative_to(ROOT).as_posix()

legacy.SQL=SQL;legacy.SQL_SHA=SQL_SHA;legacy.inputs=inputs;legacy.validate=validate;legacy.retain=retain;legacy.cli_call=release.call
main=legacy.main
if __name__=='__main__':sys.exit(main())
