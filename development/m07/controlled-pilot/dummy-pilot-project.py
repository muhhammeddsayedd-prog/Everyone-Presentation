"""Root-executed, explicitly owner-authorized creation of one central project.

Importing is inert. Pure seams never invoke the CLI. No Auth/client/capability/
casting/workspace changes; existing management login stays inside pinned CLI.
"""
from pathlib import Path
import copy
import datetime
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
TARGET = 'pyibofyctwnqpvktepse'
ACTOR = '0a79a703-caba-47e5-93d4-42e32197037a'
PROJECT_NAME = 'Dummy Pilot Test'
CLIENT_NAME = 'Dummy Client'
SOURCE_PROJECT_NAME = 'Dummy Reuse Test'
PROTECTED_JOB = 'b3f90268-147d-41d4-8875-2a6435df1496'
DIRECTORY = ROOT / '.local/m07-pilot/dummy-pilot-project'
CLAIM = DIRECTORY / 'create.claim.json'
COMMAND_COMPLETED = DIRECTORY / 'command-terminated.json'
VERSIONS = ('20261028010943','20261028013324','20261028013655','20261028024205','20261028072515',
            '20261028162702','20261028162800','20261028172320','20261028184145','20261028222030',
            '20261029001520','20261029003941','20261029070038','20261029090500','20261029090724',
            '20261029094600','20261029100500','20261029133455','20261029135318','20261029174841',
            '20261029180953','20261029202629','20261029203953','20261029215218','20261030002634',
            '20261030004643','20261030013832','20261030030717','20261030111549','20261030154824')
FINGERPRINT_KEYS = ('clients','old_projects','old_project_memberships','client_memberships','grants','settings',
    'workspaces','roles','slots','assignments','candidates','candidate_media','candidate_media_frames',
    'workspace_candidates','candidate_support','frame_extraction_requests','media_assets','specs',
    'versions','slides','pins','ready_asset_metadata')
FORBIDDEN_ENV = {'SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
    'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE',
    'PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION','DATABASE_URL','NODE_OPTIONS',
    'NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','SUPABASE_DEBUG','NODE_TLS_REJECT_UNAUTHORIZED',
    'NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}
PINS = {'supabase/.temp/project-ref': 'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5',
        'supabase/config.toml': '0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2',
        'tracking/evidence/m07/controlled-pilot/2026-10-30-hosted-core-reads.json': '9e1d1ed9b8ce5eee09eb6c9b99311adbd99caad68ef47a06436cf10919b76ac1'}
SQL_NAMES = ('DUMMY_PILOT_PROJECT_CREATE.sql','DUMMY_PILOT_PROJECT_READBACK.sql','DUMMY_PILOT_PROJECT_OBSERVE.sql')
# Exact SQL source hashes are added after authoring, before any operator use.
SQL_PINS = {'DUMMY_PILOT_PROJECT_CREATE.sql':'e5e82c198802d19d891762ddeb4b7cfb457340e6549553eeff9b726c62e2d416',
    'DUMMY_PILOT_PROJECT_READBACK.sql':'e310bcdc0015a9c9e3a474f7e255e846bf504106fc58a49107c0d2344223f23c',
    'DUMMY_PILOT_PROJECT_OBSERVE.sql':'02c8f7bf7cb2b0de3f9b6cf516aae5288ca7e501976727807f61c0d662863faa'}


def require(value):
    if not value:
        raise ValueError('DUMMY_PROJECT_UNCONFIRMED')


class CommandProcessUnconfirmed(ValueError):
    """Parent timeout is not proof of Windows descendant termination."""


def sha(value):
    return hashlib.sha256(value).hexdigest()


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def exact(value, keys):
    require(type(value) is dict and set(value) == set(keys))


def integer(value, minimum=0):
    require(type(value) is int and minimum <= value <= 9007199254740991)


def canonical_uuid(value):
    try:
        require(type(value) is str and str(uuid.UUID(value)) == value and uuid.UUID(value).int != 0)
    except (ValueError, TypeError, AttributeError):
        raise ValueError('DUMMY_PROJECT_UNCONFIRMED') from None


def validate_environment(environment):
    require(not any(value for key,value in environment.items() if key.upper() in FORBIDDEN_ENV))


def validate_metadata(value):
    exact(value, (*FINGERPRINT_KEYS, 'protected_m02'))
    for key in FINGERPRINT_KEYS:
        row = value[key]; exact(row, ('count','sha256')); integer(row['count'])
        require(type(row['sha256']) is str and re.fullmatch('[a-f0-9]{64}',row['sha256']))
    job = value['protected_m02']
    exact(job, ('id','status','stage','attempt','row_version','resource_id','manual_note_retained','spec_sha256'))
    require(job['id'] == PROTECTED_JOB and job['status'] in ('queued','running','waiting_for_input','failed','succeeded','cancelled'))
    require(job['stage'] is None or type(job['stage']) is str and re.fullmatch('[a-z_]{1,100}',job['stage']))
    integer(job['attempt']); integer(job['row_version'],1); canonical_uuid(job['resource_id'])
    require(job['manual_note_retained'] is True and type(job['spec_sha256']) is str and re.fullmatch('[a-f0-9]{64}',job['spec_sha256']))


def project_row(value, name, client_id):
    exact(value, ('id','client_id','name','archived','row_version'))
    canonical_uuid(value['id']); require(value['client_id'] == client_id and value['name'] == name)
    require(type(value['archived']) is bool); integer(value['row_version'],1)


def membership(value, project_id):
    exact(value, ('project_id','principal_id','active','can_write'))
    require(value['project_id'] == project_id); canonical_uuid(value['principal_id'])
    require(type(value['active']) is bool and type(value['can_write']) is bool)


def validate_observation(value, require_absent=False):
    exact(value, ('expected_project','acting_user_id','database','operator','history','client_matches','template_matches','target_matches',
        'client','template','template_membership','actor_eligible','target','target_memberships','target_workspace_count','protected_metadata'))
    require(value['expected_project'] == TARGET and value['acting_user_id'] == ACTOR
            and value['database'] == value['operator'] == 'postgres' and value['history'] == list(VERSIONS))
    for key in ('client_matches','template_matches'):
        require(type(value[key]) is int and value[key] == 1)
    require(type(value['target_matches']) is int and value['target_matches'] in (0,1))
    client = value['client']; exact(client, ('id','name','active','row_version')); canonical_uuid(client['id']); integer(client['row_version'],1)
    require(client['name'] == CLIENT_NAME and client['active'] is True)
    template = value['template']; project_row(template, SOURCE_PROJECT_NAME, client['id']); require(template['archived'] is False)
    owner = value['template_membership']; membership(owner, template['id'])
    require(owner['principal_id'] == ACTOR and owner['active'] is True and owner['can_write'] is True and value['actor_eligible'] is True)
    integer(value['target_workspace_count'])
    require(type(value['target_memberships']) is list and len(value['target_memberships']) <= 100)
    if value['target_matches'] == 0:
        require(value['target'] is None and value['target_memberships'] == [] and value['target_workspace_count'] == 0)
    else:
        project_row(value['target'],PROJECT_NAME,client['id'])
        require(value['target']['id'] != template['id'])
        seen = set()
        for row in value['target_memberships']:
            membership(row,value['target']['id']); require(row['principal_id'] not in seen); seen.add(row['principal_id'])
    if require_absent:
        require(value['target_matches'] == 0)
    validate_metadata(value['protected_metadata'])
    return copy.deepcopy(value)


def creation_preserved(before, after):
    try:
        validate_observation(before,True); validate_observation(after)
        target = after['target']
        expected = copy.deepcopy(before)
        expected.update(target_matches=1,target=target,target_memberships=after['target_memberships'])
        return (target is not None and target['archived'] is False and target['row_version'] == 1
            and after == expected and after['target_memberships'] == [{'project_id':target['id'],'principal_id':ACTOR,
                'active':before['template_membership']['active'],'can_write':before['template_membership']['can_write']}])
    except Exception:
        return False


def validate_update(value):
    exact(value, ('inserted_projects','inserted_memberships','protected_before_after_equal','observation'))
    require(type(value['inserted_projects']) is int and value['inserted_projects'] == 1
            and type(value['inserted_memberships']) is int and value['inserted_memberships'] == 1
            and value['protected_before_after_equal'] is True)
    validate_observation(value['observation']); return copy.deepcopy(value)


def read_pair(io):
    values = []
    for _ in range(2):
        try:
            values.append(validate_observation(io.readback()))
        except Exception:
            values.append(None)
    return values


def readback_result(before, after, independent, process_unconfirmed=False):
    equal = after is not None and independent is not None and after == independent
    observed = equal and after['target_matches'] == 1
    intact = creation_preserved(before,after) and creation_preserved(before,independent) if before is not None else None
    passed = observed and intact is True and not process_unconfirmed
    return {'result':'passed' if passed else 'unconfirmed','dispatch_attempted':False,'automatic_dispatch_retry':False,
        'project_observed':observed,'creation_verified':passed,'original_baseline_available':before is not None,
        'protected_before_after_equal':intact,'independent_readback_equal':equal,'after':after,'independent_readback':independent,
        'command_process_cleanup_unconfirmed':process_unconfirmed}


def apply_once(io):
    before = validate_observation(io.readback(),True); io.verify_sources()
    io.claim({'target':TARGET,'acting_user_id':ACTOR,'project_name':PROJECT_NAME,'before':before,'claimed_at':stamp(),
              'dispatch_may_have_occurred':True})
    require(validate_observation(io.readback(),True) == before); io.verify_sources()
    outcome = 'unconfirmed'; update = None; process_unconfirmed = False
    try:
        update = validate_update(io.dispatch(before)); outcome = 'command_succeeded'
    except CommandProcessUnconfirmed:
        process_unconfirmed = True
    except Exception:
        pass  # Lost COMMIT acknowledgement never causes another INSERT.
    after, independent = read_pair(io)
    stable = True
    try: io.verify_sources()
    except Exception: stable = False
    result = readback_result(before,after,independent,process_unconfirmed)
    if not stable or update is not None and update['observation'] != after:
        result.update(result='unconfirmed',creation_verified=False)
    return {**result,'dispatch_attempted':True,'dispatch_outcome':outcome,'before':before,
            'sources_unchanged':stable,'update_reply_validated':update is not None,'claim_retained':True}


def render_create(template, before):
    validate_observation(before,True); require(type(template) is str and template.count('__EXPECTED_BASELINE__') == 1)
    return template.replace('__EXPECTED_BASELINE__',json.dumps(before,sort_keys=True,separators=(',',':')).replace("'","''"))


def public_bytes(file, maximum=512*1024):
    require(file.is_file() and not file.is_symlink() and file.resolve() == file and file.is_relative_to(ROOT))
    before = file.stat(); require(0 < before.st_size <= maximum)
    require(not getattr(file.lstat(),'st_file_attributes',0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    data = file.read_bytes(); after = file.stat()
    require((before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns) ==
            (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns) and len(data) == before.st_size)
    return data


def source_pins():
    require(set(SQL_PINS) == set(SQL_NAMES))
    pins = {}
    for relative, expected in {**PINS,**{f'development/m07/controlled-pilot/{name}':value for name,value in SQL_PINS.items()}}.items():
        actual = sha(public_bytes(ROOT/relative)); require(actual == expected); pins[relative] = actual
    require(public_bytes(ROOT/'supabase/.temp/project-ref').decode().strip() == TARGET)
    require(tuple(sorted(file.name[:14] for file in (ROOT/'supabase/migrations').glob('*.sql'))) == VERSIONS)
    actor = json.loads(public_bytes(ROOT/'tracking/evidence/m07/controlled-pilot/2026-10-30-hosted-core-reads.json'))
    require(actor['acting_user_id'] == actor['session']['actor_id'] == ACTOR and actor['target'] == TARGET
        and actor['origin'] == 'https://everyone-presentation-pilot.vercel.app' and actor['session']['fixture_actor_count'] == 0
        and actor['session']['mode'] == 'supabase')
    pins['development/m07/controlled-pilot/dummy-pilot-project.py'] = sha(public_bytes(Path(__file__).resolve()))
    return pins


def sql_source(mode):
    require(mode in ('create','readback'))
    template = public_bytes(HERE/f'DUMMY_PILOT_PROJECT_{mode.upper()}.sql').decode('utf8')
    require(template.count('__OBSERVATION_SQL__') == 1)
    return template.replace('__OBSERVATION_SQL__',public_bytes(HERE/'DUMMY_PILOT_PROJECT_OBSERVE.sql').decode('utf8'))


def query_command(mode):
    require(mode in ('create','readback'))
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,
            '--file',str(DIRECTORY/f'{mode}.sql'),'--output-format','json','--workdir',str(ROOT)]


def run_cli(command, run=subprocess.run, on_returned=None):
    validate_environment(os.environ)
    try:
        result = run(command,cwd=ROOT,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=90,stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise CommandProcessUnconfirmed('DUMMY_PROJECT_PROCESS_UNCONFIRMED') from None
    if on_returned is not None:
        try: on_returned()
        except Exception:
            raise CommandProcessUnconfirmed('DUMMY_PROJECT_PROCESS_PROOF_UNCONFIRMED') from None
    require(result.returncode == 0 and len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    return json.loads(result.stdout)


def parse_query_result(value, mode):
    require(mode in ('create','readback')); key = f'dummy_project_{mode}'
    # CLI2.122 adds transport boundary/warning metadata. It conveys no domain
    # authority and is discarded, never published, hashed or used as a gate.
    require(type(value) is dict and type(value.get('rows')) is list and len(value['rows']) == 1)
    exact(value['rows'][0], (key,)); return value['rows'][0][key]


def query(mode, on_returned=None):
    return parse_query_result(run_cli(query_command(mode),on_returned=on_returned),mode)


def exclusive(file, data):
    require(file.parent == DIRECTORY and DIRECTORY.resolve() == DIRECTORY and DIRECTORY.is_dir())
    descriptor = os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'wb') as handle:
        handle.write(data); handle.flush(); os.fsync(handle.fileno())


def encoded(value):
    return (json.dumps(value,sort_keys=True)+'\n').encode('utf8')


class OperatorIO:
    def __init__(self,pins):
        self.pins = pins

    def verify_sources(self):
        require(source_pins() == self.pins)
        require(public_bytes(DIRECTORY/'readback.sql') == sql_source('readback').encode())

    def readback(self):
        self.verify_sources(); return query('readback')

    def claim(self,value):
        sql = render_create(sql_source('create'),value['before']).encode()
        exclusive(CLAIM,encoded({**value,'sources':self.pins,'rendered_sql_sha256':sha(sql)}))
        exclusive(DIRECTORY/'create.sql',sql)

    def dispatch(self,before):
        self.verify_sources(); require(public_bytes(DIRECTORY/'create.sql') == render_create(sql_source('create'),before).encode())
        def returned():
            exclusive(COMMAND_COMPLETED,encoded({'target':TARGET,'claim_sha256':sha(public_bytes(CLAIM)),
                'parent_returned_without_timeout':True,'automatic_retry':False}))
        return query('create',on_returned=returned)


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect','apply','readback'))
    validate_environment(os.environ); pins = source_pins(); action = sys.argv[1]
    DIRECTORY.mkdir(parents=True,exist_ok=True); require(DIRECTORY.resolve() == DIRECTORY and not DIRECTORY.is_symlink())
    readonly = sql_source('readback').encode()
    if (DIRECTORY/'readback.sql').exists(): require(public_bytes(DIRECTORY/'readback.sql') == readonly)
    else: exclusive(DIRECTORY/'readback.sql',readonly)
    io = OperatorIO(pins)
    if action == 'apply':
        require(not COMMAND_COMPLETED.exists()); result = apply_once(io)
    elif action == 'inspect':
        result = {'result':'observed','dispatch_attempted':False,'observation':validate_observation(io.readback()),'creation_verified':False}
    else:
        before = None
        if CLAIM.exists():
            claim = json.loads(public_bytes(CLAIM))
            exact(claim, ('target','acting_user_id','project_name','before','claimed_at','dispatch_may_have_occurred','sources','rendered_sql_sha256'))
            require(claim['target'] == TARGET and claim['acting_user_id'] == ACTOR and claim['project_name'] == PROJECT_NAME
                and claim['dispatch_may_have_occurred'] is True and claim['sources'] == pins)
            before = validate_observation(claim['before'],True)
            require(claim['rendered_sql_sha256'] == sha(render_create(sql_source('create'),before).encode()))
        process_unconfirmed = before is not None
        if before is not None and COMMAND_COMPLETED.exists():
            completed = json.loads(public_bytes(COMMAND_COMPLETED))
            exact(completed, ('target','claim_sha256','parent_returned_without_timeout','automatic_retry'))
            require(completed['target'] == TARGET and completed['claim_sha256'] == sha(public_bytes(CLAIM))
                and completed['parent_returned_without_timeout'] is True and completed['automatic_retry'] is False)
            process_unconfirmed = False
        after, independent = read_pair(io)
        result = readback_result(before,after,independent,process_unconfirmed)
    io.verify_sources()
    report = {'schema_version':'1.0','observed_at':stamp(),'target':TARGET,'action':action,'acting_user_id':ACTOR,
        'project_name':PROJECT_NAME,'client_name':CLIENT_NAME,'source_project_name':SOURCE_PROJECT_NAME,
        'sources':pins,**result,'credentials_raw_payloads_or_cli_diagnostics_persisted':False,
        'auth_client_capabilities_casting_or_workspace_mutations':False}
    output = ROOT/'tracking/evidence/m07/controlled-pilot'/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-dummy-project-{action}.json"
    with output.open('x',encoding='utf8',newline='\n') as handle:
        handle.write(json.dumps(report,indent=2)+'\n'); handle.flush(); os.fsync(handle.fileno())
    print(json.dumps({'result':report['result'],'receipt':output.relative_to(ROOT).as_posix(),
        'dispatch_attempted':report['dispatch_attempted'],'raw_diagnostics_suppressed':True}))
    return 0 if report['result'] in ('passed','observed') else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print(json.dumps({'result':'unconfirmed','raw_diagnostics_suppressed':True,'next_action':'inspect/readback only after unknown dispatch; reconcile any timed-out CLI process'}))
        sys.exit(1)
