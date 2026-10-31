"""Root-only read-only reconciliation of the one retained canonical31 claim.

Never dispatches the migration or removes/changes the claim. Full selected state
stays in RAM; only fixed hashes/counts and exact-comparison results are recorded.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import sys
import uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('ack31_frozen_release',HERE/'canonical-release.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


def main():
    m.need(len(sys.argv)==1)
    inputs=m.load_inputs();m.protect()
    claim=json.loads(m.read(m.CLAIM))
    m.need(claim['target']==m.TARGET and claim['version']==m.VERSION and claim['source_pins']==inputs['pins'])
    marker=claim['marker'];m.need(str(uuid.UUID(marker))==marker)
    m.need(not m.RETURN.exists())
    before=m.g.validate_before(claim['before'],m.origin.VERSIONS,inputs['trust'])
    io=m.IO(inputs);observed=[];qualifications=[]
    for _ in range(2):
        actual=io.read();m.g.validate_before(actual,m.origin.VERSIONS,inputs['trust'])
        normalized,qualified=m.g.normalize_expiry(before,actual,m.stamp())
        m.need(normalized==before);observed.append(m.g.summary(actual));qualifications.extend(qualified)
    m.need(observed[0]==observed[1])
    activity=io.query("begin read only;set local statement_timeout='10s';select count(*)as matching_active_backends from pg_stat_activity where pid<>pg_backend_pid()and state='active'and position('"+marker+"'in query)>0;rollback;",'matching_active_backends')
    m.need(type(activity)is int and activity==0)
    io.stable()
    report={'schema_version':'1.0','observed_at':m.stamp(),'target':m.TARGET,'result':'predecessor_exactly_observed',
      'original_apply_receipt':'tracking/evidence/m07/specs-ack31/2026-10-31T01-37-38-328593Z-ea8a5943-canonical31-apply.json',
      'claim_sha256':hashlib.sha256(m.read(m.CLAIM)).hexdigest(),'claim_retained':True,
      'dispatch_attempted':False,'database_mutations':False,'migration_applied':False,
      'two_predecessor_reads_equal':True,'full_selected_predecessor_state_equal':True,
      'matching_active_backends':activity,'normal_return_marker_exists':False,
      'summaries':observed,'cli_short_login_expiry_qualifications':qualifications,
      'helper_sha256':hashlib.sha256(m.read(Path(__file__))).hexdigest()}
    file=m.AREA/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-canonical31-predecessor-reconciliation.json')
    m.exclusive(file,(json.dumps(report,indent=2)+'\n').encode())
    print(json.dumps({'result':report['result'],'receipt':file.relative_to(m.ROOT).as_posix(),'database_mutations':False,'claim_retained':True}))


if __name__=='__main__':
    try:main()
    except Exception:
        print('{"result":"unconfirmed","database_mutations":false,"claim_retained":true,"raw_diagnostics_suppressed":true}')
        sys.exit(1)
