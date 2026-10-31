"""One public worker manifest-hash update; imports are inert.

Root executes after actual staged image/manifest pins replace the admission seal.
No private environment loaders, bulk decryption, secret writes or deployment.
"""
from pathlib import Path
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
import uuid

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('forward_origin',HERE/'future-origin.py')
origin=importlib.util.module_from_spec(spec);spec.loader.exec_module(origin)
ROOT=origin.ROOT
common_spec=importlib.util.spec_from_file_location('native_forward31_common',HERE/'native-forward31-common.py')
common=importlib.util.module_from_spec(common_spec);common_spec.loader.exec_module(common)
COMMON_SHA256='90eedd6159335934b0fe0e268c71f37b7fafee8ee9b974cba2073b17cebb3a76'
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
KEY='EPS_NATIVE_MANIFEST_SHA256'
OLD_SOURCE='3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3'
OLD_IMAGE='sha256:5e2500470a76caff11fa4b82a0d328dec423090ce8ba2d6417663283bacfff06'
OLD_MANIFEST='ea963472650fa839076ab0c68c951f839f4820e4e04f55ae5c9c476e3c457ac0'
# Actual root-proven staged image, full native smoke and final-UID import receipts.
PLAN_SHA256=''
PLAN=HERE/'WORKER_FORWARD31_PLAN.json'
PRIVATE=ROOT/'.local/m07-pilot/worker-forward31'
CLAIM=PRIVATE/'manifest-env.claim.json'
PROCESS_PROOF=PRIVATE/'manifest-env.process-returned.json'
CLI=ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
NODE=Path('C:/Program Files/nodejs/node.exe')
NODE_SHA256='9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de'
HISTORY={'tracking/evidence/m07/controlled-pilot/2026-10-31T00-58-09-486017Z-00df1934-worker-forward-readback.json': '20e4228a2a5a7dccb5d166e337476a49816ed50f71e0ed4d3b1462661e203575', 'tracking/evidence/m07/controlled-pilot/2026-10-31T00-59-53-689390Z-7e23d3dc-future-frame-forward-readback.json': 'aba5929f20d73256f6cebe9ba810e57456476f9b845176390954547c1d9fa102', 'development/m07/controlled-pilot/future-origin.py': '7d15c917bd781fd89a75e3efe36c561d9933ba64e3309b583c04b7ba5accee44'}

CLI_PINS={
 'vc.js':'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',
 'chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
 'chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a'}
PROOF_REFERENCES={'native_smoke':None,'daemon_import':None}

SENSITIVE=('OPENAI_API_KEY','EPS_SPECS_PG_HOST','EPS_SPECS_PG_PASSWORD','EPS_SPECS_PG_CA_BASE64',
 'N8N_DISPATCH_URL','N8N_DISPATCH_SECRET','N8N_CANDIDATE_DISPATCH_URL','N8N_CANDIDATE_DISPATCH_SECRET',
 'N8N_REVIEW_DISPATCH_URL','N8N_REVIEW_DISPATCH_SECRET','N8N_PRESENTATION_DISPATCH_URL','N8N_PRESENTATION_DISPATCH_SECRET')
PLAIN=('OPENAI_EXTRACTION_MODEL','OPENAI_TRANSCRIPTION_MODEL','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY',
 'EPS_SPECS_FILES_ENABLED','EPS_CANDIDATE_MEDIA_ENABLED','EPS_FRAME_EXTRACTION_ENABLED','EPS_PDF_VISION_ENABLED','EPS_REVIEW_ENABLED',
 'EPS_PRESENTATION_ENABLED','EPS_GUEST_EXPORTS_ENABLED','NODE_ENV','EPS_RELEASE_MODE','EPS_NATIVE_TRANSPORT','EPS_PILOT_OWNER_CONTROLLED',KEY)
EXPECTED=sorted([{'key':key,'type':'sensitive' if key in SENSITIVE else 'plain','target':['production']} for key in (*SENSITIVE,*PLAIN)],key=lambda row:row['key'])
FORBIDDEN_ENV=set(origin.FORBIDDEN_ENV)|{'SUPABASE_DEBUG','NPM_CONFIG_NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS',
 'NODE_DEBUG','NODE_DEBUG_NATIVE','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}


def require(value):
    if not value: raise ValueError('WORKER_FORWARD_UNCONFIRMED')


class CommandProcessUnconfirmed(Exception): pass


def digest(value): return hashlib.sha256(value).hexdigest()
def exact(value,keys):require(type(value) is dict and set(value)==set(keys))
def sha(value):require(type(value) is str and re.fullmatch('[a-f0-9]{64}',value));return value


def validate_environment(environment):
    require(not any(value for key,value in environment.items() if key.upper() in FORBIDDEN_ENV))


def validate_plan(value):
    exact(value,('schema_version','status','current','next','admission','canonical_release'))
    require(value['schema_version']=='1.0' and value['status']=='actual_staged_and_baked_canonical31')
    require(value['admission']==PROOF_REFERENCES and value['canonical_release']==common.CANONICAL_REFERENCES)
    for reference in value['admission'].values():
        common.native_proof_reference(reference)
    require(value['current']=={'source_sha256':OLD_SOURCE,'native_image_id':OLD_IMAGE,'manifest_sha256':OLD_MANIFEST})
    new=value['next'];exact(new,('context','source_sha256','manifest_sha256','native_image_id','owner_sha256','source_seal_sha256','file_count'))
    require(type(new['context']) is str and re.fullmatch(r'\.local/worker-hosting/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}/context',new['context']))
    for key in ('source_sha256','manifest_sha256','owner_sha256','source_seal_sha256'):sha(new[key])
    require(type(new['native_image_id']) is str and re.fullmatch('sha256:[a-f0-9]{64}',new['native_image_id']) and new['native_image_id']!=OLD_IMAGE)
    require(new['source_sha256']!=OLD_SOURCE and new['manifest_sha256']!=OLD_MANIFEST and type(new['file_count']) is int and new['file_count']==156)
    return copy.deepcopy(value)


def validate_admission(native,daemon,new):
    common.validate_strong_presentation(native)
    require(type(native) is dict and native.get('result')=='passed' and native.get('project_id')==PROJECT and native.get('team_id')==TEAM
      and native.get('source_sha256')==new['source_sha256'] and native.get('image')=='muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+new['native_image_id']
      and native.get('cleanup_confirmed') is True and native.get('lock_released') is True and native.get('initial_current_cleanup_sessions_equal') is True
      and native.get('private_media_used') is False and native.get('worker_polling') is False and native.get('db_jobs_or_openai_n8n_calls') is False and native.get('token_persisted') is False)
    require(native.get('plan',{}).get('mode')=='smoke' and native.get('probe_release',{}).get('context_relative')==new['context']
      and native['probe_release'].get('file_count')==156 and native['probe_release'].get('native_uid')==65432)
    phases=native.get('phases');expected=['image_source_seal','boundary','image_control_user','network_denial','smoke_document','smoke_document','smoke_pdf_raster','smoke_video',
      'smoke_review_fit','smoke_presentation_render','smoke_presentation_validate','smoke_presentation_export_render','smoke_presentation_export_validate']
    require(type(phases) is list and [row.get('phase') for row in phases]==expected and all(row.get('result')=='passed' for row in phases))
    resources=native.get('resources');require(type(resources) is list and len(resources)==10)
    require(all(type(row) is dict and all(row.get(key) is True for key in ('identity_observed','initial_current_cleanup_session_equal','absence_verified','snapshot_absence_verified'))
      and row.get('session_consistency_failed') is False for row in resources))
    common.validate_daemon_image(daemon,new)



def validate_source_metadata(source,expected,count):
    exact(source,('source_sha256','files'));sha(expected)
    require(source['source_sha256']==expected and type(source['files']) is list and type(count) is int and 0<count<=1000 and len(source['files'])==count)
    require(digest(json.dumps(source['files'],separators=(',',':'),ensure_ascii=False).encode())==expected)
    pattern=r'(?:package(?:-lock)?\.json|apps/(?:web|worker)/package\.json|apps/worker/Dockerfile\.(?:daemon|native-sandbox)|packages/(?:domain|jobs|integrations|central)/package\.json|(?:apps/worker/src|packages/(?:domain|jobs|integrations|central)/src|packages/templates/(?:src|versions))/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|contracts/json-schema/(?:specs-extraction|candidate-extraction|frame-selection|slide-wording)\.schema\.json|packages/templates/registry\.json|apps/web/public/fonts/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps/web/public/brand/everyone-logotype(?:-white)?\.svg)'
    previous=''
    for row in source['files']:
        exact(row,('path','sha256','bytes'));relative=row['path'];sha(row['sha256'])
        require(type(relative) is str and len(relative)<=240 and re.fullmatch(pattern,relative) and '..' not in relative and relative>previous
                and type(row['bytes']) is int and 0<row['bytes']<=16*1024*1024);previous=relative


def public_release():
    sha(PLAN_SHA256);sha(COMMON_SHA256);require(digest(origin.public_bytes(HERE/'native-forward31-common.py'))==COMMON_SHA256)
    canonical_pins=common.static_sources()
    data=origin.public_bytes(PLAN);require(digest(data)==PLAN_SHA256);plan=validate_plan(json.loads(data));new=plan['next']
    context=ROOT/new['context'];require(context.resolve()==context and context.is_dir() and not context.is_symlink())
    owner_bytes=origin.public_bytes(context.parent/'owner.json');require(digest(owner_bytes)==new['owner_sha256']);owner=json.loads(owner_bytes)
    exact(owner,('owner','run','source_sha256'));require(owner=={'owner':'eps-worker-hosting-build','run':context.parent.name,'source_sha256':new['source_sha256']})
    source_bytes=origin.public_bytes(context/'apps/worker/native-source.json');require(digest(source_bytes)==new['source_seal_sha256']);source=json.loads(source_bytes)
    # Validate the complete public list before opening any listed path.
    validate_source_metadata(source,new['source_sha256'],new['file_count'])
    for row in source['files']:
        file=context/row['path'];require(file.resolve().is_relative_to(context));content=origin.public_bytes(file,16*1024*1024)
        require(len(content)==row['bytes'] and digest(content)==row['sha256'])
    raw=origin.public_bytes(context/'apps/worker/native-sandbox-manifest.json',4096);require(digest(raw)==new['manifest_sha256']);manifest=json.loads(raw)
    exact(manifest,('schema_version','transport','protocol','image','region','source_sha256'))
    require(manifest=={'schema_version':'1.0','transport':'vercel_sandbox','protocol':'eps-native-files-v1',
      'image':'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+new['native_image_id'],'region':'dub1','source_sha256':new['source_sha256']})
    pins={**canonical_pins,str(PLAN.relative_to(ROOT)).replace('\\','/'):PLAN_SHA256}
    for relative,expected in HISTORY.items():
        require(digest(origin.public_bytes(ROOT/relative))==expected);pins[relative]=expected
    proofs={}
    for name,reference in PROOF_REFERENCES.items():
        raw_proof=origin.public_bytes(ROOT/reference['receipt']);require(digest(raw_proof)==reference['sha256'])
        proofs[name]=json.loads(raw_proof);pins[reference['receipt']]=reference['sha256']
    validate_admission(proofs['native_smoke'],proofs['daemon_import'],new)
    for relative,expected in CLI_PINS.items():require(digest(origin.public_bytes(CLI.parent/relative,2*1024*1024))==expected)
    env=json.loads(origin.public_bytes(ROOT/list(HISTORY)[0]));require(env['result']=='passed' and env['write_process_returned'] is True and env['independent_readback_equal'] is True
      and env['new_public_manifest_hash_observed'] is True and env['metadata_and_all_28_ids_preserved'] is True
      and env['after']['manifest_sha256']==env['independent_readback']['manifest_sha256']==OLD_MANIFEST
      and env['plan']['next']['source_sha256']==OLD_SOURCE and env['plan']['next']['native_image_id']==OLD_IMAGE)
    prior_frame=json.loads(origin.public_bytes(ROOT/list(HISTORY)[1]));require(prior_frame['result']=='passed' and prior_frame['write_process_returned'] is True
      and prior_frame['application_verified_by_readback'] is True and prior_frame['protected_before_after_equal'] is True
      and prior_frame['manifest']['native_image_id']==OLD_IMAGE and prior_frame['manifest']['manifest_sha256']==OLD_MANIFEST)
    pins['development/m07/controlled-pilot/worker-forward31.py']=digest(origin.public_bytes(Path(__file__).resolve()))
    return plan,pins


def project_metadata(response):
    require(type(response) is dict and type(response.get('envs')) is list and len(response['envs'])==28)
    require(response.get('pagination') is None or type(response['pagination']) is dict and response['pagination'].get('next') is None)
    rows=[];ids=set()
    for row in response['envs']:
        require(type(row) is dict and row.get('gitBranch') is None and row.get('customEnvironmentIds',[])==[])
        require(row.get('visibility') in (None,'secret' if row.get('type')=='sensitive' else 'config'))
        identifier=row.get('id');require(type(identifier) is str and re.fullmatch('[A-Za-z0-9_-]{1,128}',identifier) and identifier not in ids);ids.add(identifier)
        require(type(row.get('createdAt'))is int and row['createdAt']>=0 and type(row.get('updatedAt'))is int and row['updatedAt']>=row['createdAt'])
        rows.append({'id':identifier,'key':row.get('key'),'type':row.get('type'),'target':row.get('target'),'createdAt':row['createdAt'],'updatedAt':row['updatedAt']})
    rows.sort(key=lambda row:row['key'] if type(row['key']) is str else '')
    require([{key:row[key] for key in ('key','type','target')} for row in rows]==EXPECTED)
    return rows


def project_public_value(response,expected):
    require(type(response) is dict and expected['key']==KEY and expected['type']=='plain')
    require(response.get('visibility') in (None,'config'))
    require({key:response.get(key) for key in ('id','key','type','target','createdAt','updatedAt')}==expected)
    require(response.get('gitBranch') is None and response.get('customEnvironmentIds',[])==[])
    return sha(response.get('value'))


def validate_observation(value):
    exact(value,('metadata','manifest_sha256'));sha(value['manifest_sha256'])
    require(project_metadata({'envs':value['metadata']})==value['metadata']);return copy.deepcopy(value)


def preserved_metadata(before,after):
    current=copy.deepcopy(after)
    if len(before)!=28 or len(current)!=28:return False
    old=next((row for row in before if row['key']==KEY),None);new=next((row for row in current if row['key']==KEY),None)
    if old is None or new is None or type(new['updatedAt'])is not int or new['updatedAt']<old['updatedAt']:return False
    new['updatedAt']=old['updatedAt'];return before==current


def readback_result(before,after,independent,new_hash,process_confirmed=False):
    sha(new_hash);equal=after is not None and independent is not None and after==independent
    observed=equal and after['manifest_sha256']==new_hash
    preserved=before is not None and equal and preserved_metadata(before['metadata'],after['metadata'])
    require(type(process_confirmed) is bool);passed=observed and preserved and process_confirmed
    return {'result':'passed' if passed else 'unconfirmed','application_verified_by_readback':passed,'original_baseline_available':before is not None,
      'metadata_and_all_28_ids_preserved':preserved,'independent_readback_equal':equal,'new_public_manifest_hash_observed':observed,
      'write_process_returned':process_confirmed,
      'after':after,'independent_readback':independent,'private_values_or_digests_recorded':False,'helper_write_retry':False,
      'cli_network_5xx_retries_maximum':3,'cli_retry_scope':'Same-ID same-value PATCH; CLI may retry, including DPoP/authentication maintenance. No exact wire-count claim.'}


def read_pair(io):
    values=[]
    for _ in range(2):
        try:values.append(validate_observation(io.observe()))
        except Exception:values.append(None)
    return values


def apply_once(io,new_hash):
    sha(new_hash);require(new_hash!=OLD_MANIFEST);before=validate_observation(io.observe());require(before['manifest_sha256']==OLD_MANIFEST);io.verify_sources()
    io.claim({'before':before,'new_manifest_sha256':new_hash,'dispatch_may_have_occurred':True,'claimed_at':origin.stamp()})
    require(validate_observation(io.observe())==before);io.verify_sources()
    identifier=next(row['id'] for row in before['metadata'] if row['key']==KEY);outcome='unconfirmed';returned=False
    def normal_return():
        nonlocal returned
        returned=True
    try:io.patch(identifier,{'value':new_hash},normal_return);outcome='command_succeeded'
    except Exception:pass
    after,independent=read_pair(io);result=readback_result(before,after,independent,new_hash,process_confirmed=returned)
    try:io.verify_sources()
    except Exception:result['result']='unconfirmed';result['application_verified_by_readback']=False
    if getattr(io,'process_unconfirmed',False):result['result']='unconfirmed';result['application_verified_by_readback']=False
    return {**result,'before':before,'dispatch_attempted':True,'dispatch_outcome':outcome,'claim_retained':True,
      'command_process_unconfirmed':getattr(io,'process_unconfirmed',False)}


def exclusive_json(file,value):
    require(file.parent==PRIVATE and PRIVATE.resolve()==PRIVATE and PRIVATE.is_dir() and not PRIVATE.is_symlink())
    fd=os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w',encoding='utf8',newline='\n') as handle:handle.write(json.dumps(value,sort_keys=True)+'\n');handle.flush();os.fsync(handle.fileno())


def validate_process_proof(value,claim_hash,identifier,new_hash):
    exact(value,('schema_version','action','project_id','team_id','claim_sha256','environment_id','new_manifest_sha256','process_returned_at'))
    require(value['schema_version']=='1.0' and value['action']=='worker-manifest-forward31' and value['project_id']==PROJECT and value['team_id']==TEAM
        and value['claim_sha256']==sha(claim_hash) and value['environment_id']==identifier and value['new_manifest_sha256']==sha(new_hash))
    stamp=value['process_returned_at'];require(type(stamp) is str and stamp.endswith('+00:00') and datetime.datetime.fromisoformat(stamp).utcoffset()==datetime.timedelta(0))
    return True


class OperatorIO:
    def __init__(self,plan,pins,node):self.plan,self.pins,self.node=plan,pins,node;self.process_unconfirmed=False;self.deadline=time.monotonic()+180;self.commands=0
    def verify_sources(self):
        require(public_release()==(self.plan,self.pins));common.fresh_gate((OLD_IMAGE,),self.deadline)
    def api(self,endpoint,body=None,on_return=None):
        validate_environment(os.environ);remaining=self.deadline-time.monotonic();require(remaining>0 and self.commands<12);self.commands+=1
        args=[str(self.node),str(CLI),'api',endpoint,'--scope','muhammed-abdelrahman','--raw','--global-config',GLOBAL]
        if body is not None:args+=['--method','PATCH','--input','-']
        environment={key:os.environ[key] for key in ('SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG') if key in os.environ}
        environment.update({'PATH':'','NODE_ENV':'production','CI':'1','VERCEL_TELEMETRY_DISABLED':'1','VERCEL_CLI_USE_NATIVE_BINARY':'0'})
        try:r=subprocess.run(args,cwd=ROOT,env=environment,input=None if body is None else json.dumps(body),capture_output=True,text=True,encoding='utf8',errors='replace',
                              timeout=min(30,remaining),stdin=subprocess.DEVNULL if body is None else None)
        except subprocess.TimeoutExpired:self.process_unconfirmed=True;raise CommandProcessUnconfirmed() from None
        # Actual process return, including nonzero exit/lost response, precedes parsing.
        if on_return is not None:on_return()
        require(r.returncode==0 and len(r.stdout.encode())<=2*1024*1024 and len(r.stderr.encode())<=1024*1024);return json.loads(r.stdout)
    def observe(self):
        rows=project_metadata(self.api(f'/v10/projects/{PROJECT}/env?teamId={TEAM}&decrypt=false'))
        row=next(row for row in rows if row['key']==KEY)
        value=project_public_value(self.api(f'/v1/projects/{PROJECT}/env/{row["id"]}?teamId={TEAM}'),row)
        prior=json.loads(origin.public_bytes(ROOT/list(HISTORY)[0]))['after']['metadata']
        require([{key:row[key]for key in('id','key','type','target')}for row in rows]==prior)
        return {'metadata':rows,'manifest_sha256':value}
    def patch(self,identifier,body,on_return):
        require(body=={'value':self.plan['next']['manifest_sha256']} and re.fullmatch('[A-Za-z0-9_-]{1,128}',identifier))
        claim_hash=digest(origin.public_bytes(CLAIM))
        def normal_return():
            require(digest(origin.public_bytes(CLAIM))==claim_hash)
            exclusive_json(PROCESS_PROOF,{'schema_version':'1.0','action':'worker-manifest-forward31','project_id':PROJECT,'team_id':TEAM,'claim_sha256':claim_hash,
                'environment_id':identifier,'new_manifest_sha256':body['value'],'process_returned_at':origin.stamp()})
            on_return()
        self.api(f'/v9/projects/{PROJECT}/env/{identifier}?teamId={TEAM}',body,on_return=normal_return)
    def claim(self,value):
        PRIVATE.mkdir(parents=True,exist_ok=True);exclusive_json(CLAIM,{**value,'project_id':PROJECT,'team_id':TEAM,'sources':self.pins,'plan':self.plan})


def main():
    require(len(sys.argv)==2 and sys.argv[1] in ('inspect','apply','readback') and sys.platform=='win32');validate_environment(os.environ)
    plan,pins=public_release();require(json.loads(origin.public_bytes(CLI.parent.parent/'package.json',65536))['version']=='65.8.0')
    require(NODE.is_file() and not NODE.is_symlink() and NODE.resolve()==NODE and digest(NODE.read_bytes())==NODE_SHA256)
    io=OperatorIO(plan,pins,NODE);common.fresh_gate((OLD_IMAGE,),io.deadline)
    project=io.api(f'/v9/projects/{PROJECT}?teamId={TEAM}')
    require(project.get('id')==PROJECT and project.get('accountId')==TEAM and project.get('name')=='everyone-presentation-worker-pilot'
            and project.get('nodeVersion')=='24.x' and project.get('rootDirectory') is None and project.get('oidcTokenConfig',{}).get('enabled') is True)
    action=sys.argv[1];new_hash=plan['next']['manifest_sha256']
    if action=='apply':result=apply_once(io,new_hash)
    elif action=='inspect':result={'result':'observed','dispatch_attempted':False,'inspection':validate_observation(io.observe())}
    else:
        before=None;confirmed=False
        if CLAIM.exists():
            claim=json.loads(origin.public_bytes(CLAIM));exact(claim,('before','new_manifest_sha256','dispatch_may_have_occurred','claimed_at','project_id','team_id','sources','plan'))
            require(claim['project_id']==PROJECT and claim['team_id']==TEAM and claim['new_manifest_sha256']==new_hash and claim['dispatch_may_have_occurred'] is True
                    and claim['sources']==pins and claim['plan']==plan);before=validate_observation(claim['before']);require(before['manifest_sha256']==OLD_MANIFEST)
            if PROCESS_PROOF.exists():
                identifier=next(row['id'] for row in before['metadata'] if row['key']==KEY)
                confirmed=validate_process_proof(json.loads(origin.public_bytes(PROCESS_PROOF)),digest(origin.public_bytes(CLAIM)),identifier,new_hash)
        result={**readback_result(before,*read_pair(io),new_hash,process_confirmed=confirmed),'dispatch_attempted':False}
    io.verify_sources();report={'schema_version':'1.0','observed_at':origin.stamp(),'action':action,'project_id':PROJECT,'team_id':TEAM,'sources':pins,'plan':plan,**result,
      'vercel_cli_commands_attempted':io.commands,'maximum_vercel_cli_commands':12,'canonical_readonly_cli_attempts':common.READONLY_ATTEMPTS,'maximum_canonical_readonly_cli_attempts':24,'maximum_operator_io_seconds':180,'secrets_transferred':False,'deployment_performed':False,'runtime_acceptance':False}
    file=ROOT/'tracking/evidence/m07/controlled-pilot'/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-worker-forward31-{action}.json"
    with file.open('x',encoding='utf8',newline='\n') as handle:handle.write(json.dumps(report,indent=2)+'\n');handle.flush();os.fsync(handle.fileno())
    print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'raw_diagnostics_suppressed':True}));return 0 if report['result'] in ('passed','observed') else 1


if __name__=='__main__':
    try:sys.exit(main())
    except Exception:print(json.dumps({'result':'unconfirmed','raw_diagnostics_suppressed':True,'next_action':'readback only after any unknown dispatch; do not replay'}));sys.exit(1)
