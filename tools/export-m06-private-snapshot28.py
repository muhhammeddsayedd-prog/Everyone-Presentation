"""Current28 receipt admission; reuse the unchanged private writer/query boundary."""
import importlib.util
import re
import sys
from release_foundation import ROOT,TARGET

def module(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

legacy=module('m06_28_private_writer','tools/export-m06-private-snapshot.py')
capture=module('m06_28_private_capture','tools/capture-m06-app28.py')
CAPTURE=ROOT/'tools/capture-m06-app28.py'
APP_CAPTURE_SHA='f9d61aa76ede2aeba02432010339900cd9cfaae981da0726d3d90806ab87cd08'
WORKSPACE=legacy.WORKSPACE;SERIES=legacy.SERIES;require=legacy.require

def validate_receipt(receipt,versions,seals,baseline,version_id):
    require(type(version_id)is str and legacy.UUID.fullmatch(version_id))
    legacy.exact(receipt,['observed_at','result','target','read_only','provider_called_by_observer','browser_session_used',
        'private_payloads_names_urls_paths_credentials_or_credential_digests_published','hosting_deferred','state','checks','source_sha256','sources_stable'])
    require(receipt['result']=='captured'and receipt['target']==TARGET and receipt['read_only']is True and receipt['sources_stable']is True
        and receipt['provider_called_by_observer']is False and receipt['browser_session_used']is False
        and receipt['private_payloads_names_urls_paths_credentials_or_credential_digests_published']is False and receipt['hosting_deferred']is True and receipt['source_sha256']==seals)
    capture.legacy.timestamp(receipt['observed_at']);require(capture.validate(receipt['state'],versions,baseline)==receipt['checks'])
    found=[v for v in receipt['state']['versions']if v['id']==version_id];require(len(found)==1);version=found[0]
    require(version['workspace_id']==WORKSPACE and version['series_id']==SERIES and version['audience_scope']=='external'and version['status']=='ready')
    series=[s for s in receipt['state']['series']if s['id']==SERIES];require(len(series)==1 and series[0]['audience_scope']=='external'and series[0]['workspace_id']==WORKSPACE)
    return{**version,'output_type':series[0]['output_type']}

legacy.capture=capture;legacy.CAPTURE=CAPTURE;legacy.APP_CAPTURE_SHA=APP_CAPTURE_SHA
legacy.RECEIPT=re.compile(r'tracking/evidence/m06/app-capture28/[a-zA-Z0-9_.-]+\.json')
legacy.validate_receipt=validate_receipt
export=legacy.export;main=legacy.main
if __name__=='__main__':sys.exit(main())
