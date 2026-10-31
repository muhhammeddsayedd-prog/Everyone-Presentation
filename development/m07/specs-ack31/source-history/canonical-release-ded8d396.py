"""Root-only, once-claimed canonical31 release. Imports perform no private IO.

No reset/seed, provider configuration, credentials loader or historical release
entrypoint. Missing actual local proof blocks before any CLI/private operation.
"""
from pathlib import Path,PurePosixPath
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import tomllib
import uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]


def module(name,file):
    spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value


g=module('ack31_guards',HERE/'canonical_guards.py')
sql=module('ack31_sql',HERE/'canonical_sql.py')
origin=module('ack31_public_files',ROOT/'development/m07/controlled-pilot/future-origin.py')
TARGET='pyibofyctwnqpvktepse';VERSION=g.VERSION
PRIVATE=ROOT/'.local/m07-specs-ack31-canonical';CLAIM=PRIVATE/'apply.claim.json';RETURN=PRIVATE/'process-returned.json'
AREA=ROOT/'tracking/evidence/m07/specs-ack31'
PLAN_SHA='02e8aa20b645cd807f0f948514fcc00e23fa3f7a80e56dbc9aefbf49191ab172'
MODULE_PINS={'canonical_guards.py':'2c9e35c5114dc0ef6ed5cb9617d83ba12860a7d2d2a7ccc252d47bbb81516b3e','canonical_sql.py':'2d92e91e00f87fc3153a1867d0172d6f26b925bf8780ea2be56504d89dd353b3'}
PINS={
 'supabase/.temp/project-ref':'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5',
 'supabase/config.toml':'0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2',
 'development/local-db/reviewed.json':'9722f25317f783123ec462227e94aecf65ea1cb27a9b59cf0d6bc07420f5d671',
 'development/m07/controlled-pilot/future-origin.py':'7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44',
 'development/m07/controlled-pilot/SPECS_SUBMIT_TRUST.json':'a12a8649fd5ce571eec4562c9455de1360e193ac8b886c4d878a8249bd82b434',
 'development/m07/issuer-release30-executable/discover.sql':'5a30e3bf2bb17f32c932dad9bfac71f8162ff552ae9f12ef05ec6e03aef10f6f',
 'development/m07/specs-ack31/canonical-query.sql':'ae21e130635ef5b5b7a8b19914d774eac5c24667ab29924b651b127d240ef9e5',
 'development/m07/specs-ack31/release-plan.json':'9b00e05aa70647f28d2e3bbf9553f871721dd79a37a3ad16c3e8b9729e09d70a'}


def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(data):return hashlib.sha256(data).hexdigest()
def need(value):g.need(value)
def exact(value,keys):g.exact(value,keys)
def read(file,maximum=16*1024*1024):return origin.public_bytes(file,maximum)
def hash_value(value):need(type(value)is str and re.fullmatch('[a-f0-9]{64}',value));return value


def exclusive(file,value):
    descriptor=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'wb')as stream:stream.write(value);stream.flush();os.fsync(stream.fileno())


def load_inputs():
    blocked=set(origin.FORBIDDEN_ENV)|{'NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','SUPABASE_DEBUG'}
    need(not any(value for key,value in os.environ.items()if key.upper()in blocked))
    hash_value(PLAN_SHA);raw=read(HERE/'canonical-plan.json');need(digest(raw)==PLAN_SHA);plan=json.loads(raw)
    exact(plan,('schema_version','status','target','version','local_proof','source_plan_sha256','query_sha256','predecessor_query_sha256'))
    need(plan['schema_version']=='1.0'and plan['status']=='actual_local_proof_passed'and plan['target']==TARGET and plan['version']==VERSION)
    proof_ref=plan['local_proof'];exact(proof_ref,('receipt','sha256'))
    need(type(proof_ref['receipt'])is str and re.fullmatch(r'tracking/evidence/m07/specs-ack31/[A-Za-z0-9_.-]+-local-proof\.json',proof_ref['receipt']))
    hash_value(proof_ref['sha256']);proof_raw=read(ROOT/proof_ref['receipt']);need(digest(proof_raw)==proof_ref['sha256']);proof=json.loads(proof_raw)
    pins={}
    for relative,expected in PINS.items():
        need(digest(read(ROOT/relative))==expected);pins[relative]=expected
    for name,expected in MODULE_PINS.items():
        hash_value(expected);need(digest(read(HERE/name))==expected);pins['development/m07/specs-ack31/'+name]=expected
    need(read(ROOT/'supabase/.temp/project-ref').decode().strip()==TARGET)
    config=tomllib.loads(read(ROOT/'supabase/config.toml').decode());need(config['db']['migrations']['enabled']is True and config['db']['seed']['enabled']is False)
    source_plan=json.loads(read(HERE/'release-plan.json'))
    need(plan['source_plan_sha256']==PINS['development/m07/specs-ack31/release-plan.json']and plan['query_sha256']==PINS['development/m07/specs-ack31/canonical-query.sql']
      and plan['predecessor_query_sha256']==PINS['development/m07/issuer-release30-executable/discover.sql'])
    for path,key in [('candidate_path','candidate_sha256'),('readback_path','readback_sha256'),('tests_path','tests_sha256')]:
        relative=source_plan[path];need(type(relative)is str and relative.startswith('development/m07/specs-ack31/')and'..'not in PurePosixPath(relative).parts)
        expected=hash_value(source_plan[key]);need(digest(read(ROOT/relative))==expected);pins[relative]=expected
    migration=source_plan['migration_path'];need(migration==f'supabase/migrations/{VERSION}_m07_specs_submit_ack_projection.sql')
    candidate=read(ROOT/source_plan['candidate_path']);need(read(ROOT/migration)==candidate);pins[migration]=digest(candidate)
    manifest=json.loads(read(ROOT/'development/local-db/reviewed.json'));need(len(manifest['migrations'])==29)
    expected_names=[]
    for item in manifest['migrations']:
        relative=item['path'];need(re.fullmatch(r'supabase/migrations/[0-9]{14}_[a-z0-9_]+\.sql',relative))
        need(digest(read(ROOT/relative))==item['sha256']);pins[relative]=item['sha256'];expected_names.append(Path(relative).name)
    thirty='supabase/migrations/20261030154824_m07_native_oauth_issuer.sql';need(digest(read(ROOT/thirty))=='e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785')
    pins[thirty]='e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785';expected_names.extend([Path(thirty).name,Path(migration).name])
    need(sorted(file.name for file in(ROOT/'supabase/migrations').glob('*.sql'))==sorted(expected_names))
    required_proof_pins={}
    for relative,expected in proof.get('source_seals',{}).items():
        need(type(relative)is str and'..'not in relative and'\\'not in relative and':'not in relative
          and re.fullmatch(r'(?:tools|development/(?:local-db|m07)|supabase/migrations)/[A-Za-z0-9_./-]+\.(?:mjs|sql|json)',relative))
        hash_value(expected);need(digest(read(ROOT/relative))==expected);required_proof_pins[relative]=expected
    need(len(required_proof_pins)>=20 and required_proof_pins.get(migration)==pins[migration]
      and required_proof_pins.get('development/m07/specs-ack31/candidate.sql')==pins[migration])
    need(all('development/m07/specs-ack31/'+name in required_proof_pins for name in
      ('run-local.mjs','local-command.mjs','local-proof.mjs','tests.sql','readback.sql','release-plan.json')))
    g.validate_local_proof(proof,required_proof_pins)
    need(g.timestamp(proof['finished_at'])<=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=30))
    pins.update(required_proof_pins);pins[proof_ref['receipt']]=proof_ref['sha256'];pins['development/m07/specs-ack31/canonical-plan.json']=PLAN_SHA
    pins['development/m07/specs-ack31/canonical-release.py']=digest(read(Path(__file__)))
    return {'plan':plan,'source_plan':source_plan,'pins':pins,'candidate':candidate.decode(),'query':read(HERE/'canonical-query.sql').decode(),
            'trust':json.loads(read(ROOT/'development/m07/controlled-pilot/SPECS_SUBMIT_TRUST.json'))}


def protect():
    PRIVATE.mkdir(parents=True,exist_ok=True);need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink())
    if os.name=='nt':
        script="$ErrorActionPreference='Stop';$p=$env:EPS_ACK31_RELEASE_PRIVATE;$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$a=New-Object System.Security.AccessControl.DirectorySecurity;$a.SetAccessRuleProtection($true,$false);foreach($s in @($sid,[System.Security.Principal.SecurityIdentifier]'S-1-5-18')){$r=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$a.AddAccessRule($r)};Set-Acl -LiteralPath $p -AclObject $a;$v=Get-Acl -LiteralPath $p;if(-not $v.AreAccessRulesProtected){throw 'ACK31_ACL'};foreach($r in $v.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -notin @($sid.Value,'S-1-5-18')){throw 'ACK31_ACL'}};Write-Output 'VERIFIED'"
        env=dict(os.environ);env['EPS_ACK31_RELEASE_PRIVATE']=str(PRIVATE)
        r=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',script],capture_output=True,text=True,timeout=15,env=env,stdin=subprocess.DEVNULL)
        need(r.returncode==0 and r.stdout.strip()=='VERIFIED')
    else:os.chmod(PRIVATE,0o700)


class IO:
    def __init__(self,inputs):self.inputs=inputs;self.calls=0;self.marker=str(uuid.uuid4());self.before=None;self.read_observed=False
    def now(self):return stamp()
    def stable(self):need(load_inputs()['pins']==self.inputs['pins'])
    def command(self,args):
        need(self.calls<4);self.calls+=1;self.stable()
        return subprocess.run(['npx.cmd','--yes','supabase@2.122.0',*args],cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=60,stdin=subprocess.DEVNULL)
    def query(self,text,key):
        file=PRIVATE/(uuid.uuid4().hex+'.sql');exclusive(file,text.encode())
        result=self.command(['db','query','--linked','--project-ref',TARGET,'--file',str(file),'--output-format','json','--workdir',str(ROOT)])
        need(result.returncode==0 and len(result.stdout.encode())<=16*1024*1024 and len(result.stderr.encode())<=1024*1024)
        value=json.loads(result.stdout);need(type(value)is dict and type(value.get('rows'))is list and len(value['rows'])==1)
        exact(value['rows'][0],(key,));return value['rows'][0][key]
    def read(self):
        state=g.shape(self.query(self.inputs['query'],'specs_ack31_state'));self.read_observed=True;return state
    def preflight(self):return g.validate_before(self.read(),origin.VERSIONS,self.inputs['trust'])
    def claim(self,before):
        self.before=before;exclusive(CLAIM,(json.dumps({'schema_version':'1.0','target':TARGET,'version':VERSION,'marker':self.marker,
          'claimed_at':stamp(),'dispatch_may_have_occurred':True,'before':before,'source_pins':self.inputs['pins']})+'\n').encode())
    def dispatch(self,before):
        rendered=sql.render(self.inputs['query'],self.inputs['candidate'],before,self.marker)
        marker=self.query(rendered,'specs_ack31_commit')
        need(marker=={'version':VERSION,'marker':self.marker,'ack_body_sha256':g.NEW})
        exclusive(RETURN,(json.dumps({'marker':self.marker,'source_pins':self.inputs['pins'],'normal_return_marker_observed':True})+'\n').encode());return True


def main():
    need(len(sys.argv)==2 and sys.argv[1]in('inspect','dry-run','apply','readback'));action=sys.argv[1]
    io=None
    report={'schema_version':'1.0','evidence_kind':'operator_source_admission','observed_at':stamp(),'target':TARGET,'action':action,'version':VERSION,
      'result':'unconfirmed','phase':'source_admission','migration_path':f'supabase/migrations/{VERSION}_m07_specs_submit_ack_projection.sql',
      'migration_sha256':None,'source_pins':{},'local_proof':None,'before_summary':None,'after_summary':None,'independent_summary':None,
      'dispatch_attempted':False,'dispatch_process_returned':False,'normal_return_marker_observed':False,
      'application_verified_by_readback':False,'independent_readback_equal':False,'protected_before_after_equal':False,
      'claim_retained':False,'helper_dispatch_retry':False,'cli_internal_retries_not_characterized':True,'cli_commands_attempted':0,
      'raw_source_credentials_or_cli_diagnostics_persisted':False,'cli_short_login_expiry_qualifications':[]}
    try:
        inputs=load_inputs();report.update(source_pins=inputs['pins'],local_proof=inputs['plan']['local_proof'],migration_sha256=inputs['source_plan']['candidate_sha256'])
        protect();io=IO(inputs);report['phase']=action
        if action=='apply':report.update(g.apply_once(io))
        elif action=='readback':
            need(CLAIM.exists());claim=json.loads(read(CLAIM));exact(claim,('schema_version','target','version','marker','claimed_at','dispatch_may_have_occurred','before','source_pins'))
            need(claim['schema_version']=='1.0'and claim['target']==TARGET and claim['version']==VERSION and claim['dispatch_may_have_occurred']is True and claim['source_pins']==inputs['pins'])
            before=g.validate_before(claim['before'],origin.VERSIONS,inputs['trust']);report['before_summary']=g.summary(before)
            if RETURN.exists():
                returned=json.loads(read(RETURN));need(returned=={'marker':claim['marker'],'source_pins':inputs['pins'],'normal_return_marker_observed':True})
                report['dispatch_process_returned']=report['normal_return_marker_observed']=True
            result=g.observe(io,before);report.update(result);report['result']='passed'if result['application_verified_by_readback']else'unconfirmed'
        else:
            before=io.preflight();report['before_summary']=g.summary(before)
            if action=='dry-run':
                result=io.command(['db','push','--linked','--dry-run','--workdir',str(ROOT)])
                need(result.returncode==0 and len(result.stdout.encode())+len(result.stderr.encode())<=1024*1024)
                found=re.findall(r'[0-9]{14}_[a-z0-9_]+\.sql',result.stdout+'\n'+result.stderr)
                need(found and set(found)=={Path(report['migration_path']).name})
                report['cli_dry_run_only_expected_migration']=True
            report['result']='observed'
        io.stable();report['cli_commands_attempted']=io.calls;report['phase']='complete'
    except Exception:pass
    if io:
        report['cli_commands_attempted']=io.calls
        if io.read_observed:report['evidence_kind']='actual_canonical_observation'
    report['claim_retained']=CLAIM.exists();report['finished_at']=stamp();report['helper_sha256']=digest(read(Path(__file__)))
    AREA.mkdir(parents=True,exist_ok=True);file=AREA/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-canonical31-{action}.json"
    exclusive(file,(json.dumps(report,indent=2)+'\n').encode());print(json.dumps({'receipt':file.relative_to(ROOT).as_posix(),'result':report['result'],'phase':report['phase'],'dispatch_attempted':report['dispatch_attempted'],'helper_dispatch_retry':False}))
    return 0 if report['result']in('observed','passed')else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:
        print('{"result":"unconfirmed","raw_diagnostics_suppressed":true,"helper_dispatch_retry":false}');sys.exit(1)
