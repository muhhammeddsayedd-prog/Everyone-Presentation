"""Explicit new once-claimed compact continuation; original unknown claim remains.

Import is inert. Only root dispatches after source review. All original proof,
target, 30-state, ACL and candidate guards remain authoritative. No wire outcome
is inferred for the original request from a synthetic HTTP413 observation.
"""
from pathlib import Path
import datetime
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

m=module('ack31_original_frozen',HERE/'canonical-release.py')
c=module('ack31_continuation_guards',HERE/'continuation_guards.py')
s=module('ack31_continuation_sql',HERE/'continuation_sql.py')
PRIVATE=ROOT/'.local/m07-specs-ack31-continuation'
CLAIM=PRIVATE/'apply.claim.json';RETURN=PRIVATE/'process-returned.json'
PLAN_SHA='f29ba5dd1512cf8d51c117ac17b56089e74f50e7cf373916b973a3f69f30d211'
MODULE_PINS={'continuation_guards.py': '422ca39e46affde781faee940d8156b62a4800daf2e09e3c51ab0b83fa285556', 'continuation_sql.py': '6dd53354d78b91ed9680d4c7bd8f34aea7c1ab507b9a4e5d160a0b62607bede3', 'test_continuation.py': 'a25c04a28ce18effb6db7513bc08edc60e08f0e89bad474b0aaf0961299c1215', 'test_continuation_controller.py': '93b72ad144c730e9c2ccf3047a8a632f9fb3365adef41bbda197a11305eb5afb'}
ORIGINAL_SHA='88493c6dc8d68a83964eadc22de9d22408c6fe5006a2027e98507e23734e516c'
PLAN_FIELDS=('schema_version','target','version','status','original_controller_sha256','original_apply_receipt','original_apply_receipt_sha256',
 'old_transaction_cutoff','read_only_size_diagnostic','read_only_size_diagnostic_sha256','candidate_sha256')

def load_inputs():
    # The reviewed original loader checks all known environment blockers before
    # public source reads and cannot invoke CLI, credentials, or private paths.
    inputs=m.load_inputs();m.need(m.digest(m.read(HERE/'canonical-release.py'))==ORIGINAL_SHA)
    raw=m.read(HERE/'canonical-continuation-plan.json');m.need(m.digest(raw)==PLAN_SHA);plan=json.loads(raw);m.exact(plan,PLAN_FIELDS)
    m.need(plan['schema_version']=='1.0'and plan['target']==m.TARGET and plan['version']==m.VERSION
      and plan['status']=='prepared_separate_continuation_original_transport_unknown'and plan['original_controller_sha256']==ORIGINAL_SHA
      and plan['candidate_sha256']==inputs['source_plan']['candidate_sha256'])
    s.cutoff_value(plan['old_transaction_cutoff'])
    pins=dict(inputs['pins'])
    for name,expected in MODULE_PINS.items():
        m.hash_value(expected);m.need(m.digest(m.read(HERE/name))==expected);pins['development/m07/specs-ack31/'+name]=expected
    for field in('original_apply_receipt','read_only_size_diagnostic'):
        relative=plan[field];m.need(type(relative)is str and re.fullmatch(r'tracking/evidence/m07/specs-ack31/[A-Za-z0-9_.-]+\.json',relative))
        raw=m.read(ROOT/relative);m.need(m.digest(raw)==plan[field+'_sha256']);pins[relative]=plan[field+'_sha256']
        value=json.loads(raw)
        if field=='original_apply_receipt':
            m.need(value['target']==m.TARGET and value['action']=='apply'and value['version']==m.VERSION and value['result']=='unconfirmed'
              and value['dispatch_attempted']is True and value['normal_return_marker_observed']is False
              and value['claim_retained']is True and value['finished_at']==plan['old_transaction_cutoff']
              and value['source_pins']==inputs['pins']and value['helper_sha256']==ORIGINAL_SHA)
            inputs['original_receipt']=value
        else:
            m.need(value['schema_version']=='1.0'and value['target']==m.TARGET and value['read_only']is True
              and value['query_bytes']==6999662 and value['same_sql_byte_count_as_original_apply']is True
              and value['private_or_business_data_in_query']is False and value['database_mutations']is False
              and value['http_413_observed']is True and value['request_entity_too_large_observed']is True
              and value['raw_diagnostics_persisted']is False)
    pins['development/m07/specs-ack31/canonical-continuation-plan.json']=PLAN_SHA
    pins['development/m07/specs-ack31/canonical-continuation.py']=m.digest(m.read(Path(__file__)))
    return {**inputs,'original_pins':inputs['pins'],'pins':pins,'continuation_plan':plan,
      'compact_query':s.read_query(inputs['query'],plan['old_transaction_cutoff'])}

def protect_new():
    try:PRIVATE.mkdir(parents=True,mode=0o700);created=True
    except FileExistsError:created=False
    m.need(PRIVATE.resolve()==PRIVATE and PRIVATE.is_dir()and not PRIVATE.is_symlink())
    if os.name=='nt':
        env=dict(os.environ);env['EPS_ACK31_RELEASE_PRIVATE']=str(PRIVATE)
        result=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',m.acl.program(created)],capture_output=True,text=True,timeout=15,env=env,stdin=subprocess.DEVNULL)
        m.need(result.returncode==0 and len(result.stdout.encode())<=16384 and len(result.stderr.encode())<=16384);m.acl.validate(json.loads(result.stdout))
    else:m.need(PRIVATE.stat().st_mode&0o777==0o700)

def original_claim(inputs):
    m.protect() # Existing original directory: exact ACL read-only verification.
    raw=m.read(m.CLAIM);claim=json.loads(raw)
    m.exact(claim,('schema_version','target','version','marker','claimed_at','dispatch_may_have_occurred','before','source_pins'))
    m.need(claim['schema_version']=='1.0'and claim['target']==m.TARGET and claim['version']==m.VERSION
      and claim['dispatch_may_have_occurred']is True and claim['source_pins']==inputs['original_pins']and not m.RETURN.exists())
    m.need(str(uuid.UUID(claim['marker']))==claim['marker'])
    before=m.g.validate_before(claim['before'],m.origin.VERSIONS,inputs['trust'])
    m.need(m.g.summary(before)==inputs['original_receipt']['before_summary'])
    return claim,m.digest(raw)

class IO:
    def __init__(self,inputs,old,old_sha):
        self.inputs=inputs;self.old=old;self.old_sha=old_sha;self.calls=0;self.marker=str(uuid.uuid4())
        self.read_observed=False;self.normalized_hash=None;self.before=None;self.diagnostics=[];self.expiry=[]
    def now(self):return m.stamp()
    def stable(self):
        m.need(load_inputs()['pins']==self.inputs['pins'])
        m.need(m.digest(m.read(m.CLAIM))==self.old_sha and not m.RETURN.exists())
    def command(self,args,operation):
        m.need(self.calls<6 and operation in('read_state','apply_compact','dry_run'));self.stable();self.calls+=1
        try:result=subprocess.run(['npx.cmd','--yes','supabase@2.122.0',*args],cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60,stdin=subprocess.DEVNULL)
        except subprocess.TimeoutExpired as error:
            self.diagnostics.append({'sequence':self.calls,'operation':operation,**c.diagnostic(None,error.stdout,error.stderr,True),'response_envelope_valid':False})
            raise ValueError('ACK31_CLI_TIMEOUT_UNCONFIRMED')from None
        self.diagnostics.append({'sequence':self.calls,'operation':operation,**c.diagnostic(result.returncode,result.stdout,result.stderr),'response_envelope_valid':False})
        m.need(c.command_returned_successfully(self.diagnostics[-1])and len(result.stdout.encode())<=16*1024*1024 and len(result.stderr.encode())<=1024*1024)
        return result
    def query(self,text,key,operation):
        m.need(type(text)is str and len(text.encode())<64000)
        file=PRIVATE/(uuid.uuid4().hex+'.sql');m.exclusive(file,text.encode())
        result=self.command(['db','query','--linked','--project-ref',m.TARGET,'--file',str(file),'--output-format','json','--workdir',str(ROOT)],operation)
        value=json.loads(result.stdout);m.need(type(value)is dict and type(value.get('rows'))is list and len(value['rows'])==1)
        m.exact(value['rows'][0],(key,));self.diagnostics[-1]['response_envelope_valid']=True
        return value['rows'][0][key]
    def read(self):
        envelope=self.query(self.inputs['compact_query'],'specs_ack31_envelope','read_state')
        m.exact(envelope,('state','normalized_state_sha256','activity_fence'));c.validate_fence(envelope['activity_fence'])
        state=m.g.shape(envelope['state']);m.hash_value(envelope['normalized_state_sha256'])
        self.normalized_hash=envelope['normalized_state_sha256'];self.read_observed=True;return state
    def preflight(self):
        before=m.g.validate_before(self.read(),m.origin.VERSIONS,self.inputs['trust'])
        self.expiry=c.predecessor_equal(self.old['before'],before,m.stamp(),m.g);return before
    def claim(self,before):
        self.stable();self.before=before
        m.exclusive(CLAIM,(json.dumps({'schema_version':'1.0','target':m.TARGET,'version':m.VERSION,'marker':self.marker,
          'claimed_at':m.stamp(),'dispatch_may_have_occurred':True,'before':before,'normalized_before_sha256':self.normalized_hash,
          'source_pins':self.inputs['pins'],'original_claim_sha256':self.old_sha,'cutoff':self.inputs['continuation_plan']['old_transaction_cutoff']})+'\n').encode())
    def dispatch(self,before):
        text=s.render(self.inputs['query'],self.inputs['candidate'],before,self.normalized_hash,self.marker,self.inputs['continuation_plan']['old_transaction_cutoff'])
        value=self.query(text,'specs_ack31_commit','apply_compact')
        m.need(value=={'version':m.VERSION,'marker':self.marker,'ack_body_sha256':m.g.NEW})
        m.exclusive(RETURN,(json.dumps({'marker':self.marker,'source_pins':self.inputs['pins'],'normal_return_marker_observed':True})+'\n').encode());return True

def main():
    m.need(len(sys.argv)==2 and sys.argv[1]in('inspect','dry-run','apply','readback'));action=sys.argv[1];io=None
    report={'schema_version':'1.0','evidence_kind':'operator_source_admission','observed_at':m.stamp(),'target':m.TARGET,'action':action,'version':m.VERSION,
      'result':'unconfirmed','phase':'source_admission','migration_path':f'supabase/migrations/{m.VERSION}_m07_specs_submit_ack_projection.sql',
      'migration_sha256':None,'source_pins':{},'local_proof':None,'before_summary':None,'after_summary':None,'independent_summary':None,
      'dispatch_attempted':False,'dispatch_process_returned':False,'normal_return_marker_observed':False,'application_verified_by_readback':False,
      'independent_readback_equal':False,'protected_before_after_equal':False,'claim_retained':False,'original_claim_retained':True,
      'original_transport_outcome':'unknown_retained','old_transaction_cutoff':None,'activity_fence_required':True,
      'helper_dispatch_retry':False,'cli_internal_retries_not_characterized':True,'cli_commands_attempted':0,'command_diagnostics':[],
      'raw_source_credentials_or_cli_diagnostics_persisted':False,'cli_short_login_expiry_qualifications':[]}
    try:
        inputs=load_inputs();report.update(source_pins=inputs['pins'],local_proof=inputs['plan']['local_proof'],migration_sha256=inputs['source_plan']['candidate_sha256'],old_transaction_cutoff=inputs['continuation_plan']['old_transaction_cutoff'])
        report['phase']='private_acl_verification';old,old_sha=original_claim(inputs);protect_new();io=IO(inputs,old,old_sha);report['phase']=action
        if action=='apply':report.update(m.g.apply_once(io))
        elif action=='readback':
            claim=json.loads(m.read(CLAIM));m.exact(claim,('schema_version','target','version','marker','claimed_at','dispatch_may_have_occurred','before','normalized_before_sha256','source_pins','original_claim_sha256','cutoff'))
            m.need(claim['schema_version']=='1.0'and claim['target']==m.TARGET and claim['version']==m.VERSION and claim['dispatch_may_have_occurred']is True
              and claim['source_pins']==inputs['pins']and claim['original_claim_sha256']==old_sha and claim['cutoff']==inputs['continuation_plan']['old_transaction_cutoff'])
            m.need(str(uuid.UUID(claim['marker']))==claim['marker']);m.hash_value(claim['normalized_before_sha256'])
            before=m.g.validate_before(claim['before'],m.origin.VERSIONS,inputs['trust']);c.predecessor_equal(old['before'],before,claim['claimed_at'],m.g)
            report['before_summary']=m.g.summary(before)
            if RETURN.exists():
                returned=json.loads(m.read(RETURN));m.need(returned=={'marker':claim['marker'],'source_pins':inputs['pins'],'normal_return_marker_observed':True})
                report['dispatch_process_returned']=report['normal_return_marker_observed']=True
            result=m.g.observe(io,before);report.update(result);report['result']=m.g.result_status(result['application_verified_by_readback'],report['dispatch_process_returned'],report['normal_return_marker_observed'])
        else:
            before=io.preflight();report['before_summary']=m.g.summary(before)
            if action=='dry-run':
                result=io.command(['db','push','--linked','--dry-run','--workdir',str(ROOT)],'dry_run')
                m.need(len(result.stdout.encode())+len(result.stderr.encode())<=1024*1024)
                names=re.findall(r'[0-9]{14}_[a-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)
                m.need(names and set(names)=={Path(report['migration_path']).name});report['cli_dry_run_only_expected_migration']=True
            report['result']='observed'
        io.stable();report['phase']='complete'
    except Exception:pass
    if io:
        report['cli_commands_attempted']=io.calls;report['command_diagnostics']=io.diagnostics
        if io.read_observed:report['evidence_kind']='actual_canonical_observation'
    report['claim_retained']=CLAIM.exists();report['finished_at']=m.stamp();report['helper_sha256']=m.digest(m.read(Path(__file__)))
    m.AREA.mkdir(parents=True,exist_ok=True);file=m.AREA/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-canonical31-continuation-{action}.json"
    m.exclusive(file,(json.dumps(report,indent=2)+'\n').encode());print(json.dumps({'receipt':file.relative_to(ROOT).as_posix(),'result':report['result'],'phase':report['phase'],'dispatch_attempted':report['dispatch_attempted'],'helper_dispatch_retry':False}))
    return 0 if report['result']in('observed','passed')else 1

if __name__=='__main__':
    try:sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","raw_diagnostics_suppressed":true,"helper_dispatch_retry":false}');sys.exit(1)
