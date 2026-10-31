"""Fixed canonical30 future-origin runner. Importing is inert; root executes.

No credential loader/file is read here: the pinned Supabase CLI reuses its
existing protected management access. Raw CLI output stays in memory. A durable
exclusive claim precedes the sole update; unknown outcomes only read back.
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
OLD = 'http://127.0.0.1:3000'
HOST = 'https://everyone-presentation-pilot.vercel.app'
PROTECTED_JOB = 'b3f90268-147d-41d4-8875-2a6435df1496'
PRIVATE = ROOT / '.local/m07-pilot/future-origin'
CLAIM = PRIVATE / 'apply.claim.json'
VERSIONS = ('20261028010943','20261028013324','20261028013655','20261028024205','20261028072515',
            '20261028162702','20261028162800','20261028172320','20261028184145','20261028222030',
            '20261029001520','20261029003941','20261029070038','20261029090500','20261029090724',
            '20261029094600','20261029100500','20261029133455','20261029135318','20261029174841',
            '20261029180953','20261029202629','20261029203953','20261029215218','20261030002634',
            '20261030004643','20261030013832','20261030030717','20261030111549','20261030154824')
PINS = {'supabase/.temp/project-ref':'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5',
        'supabase/config.toml':'0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2',
        'development/m07/controlled-pilot/FUTURE_VERSION_ORIGIN.sql':'4dbea9c15d467feb8b969f7a13ccf5bfd5ae16c4859d727022b40447712fec15',
        'development/m07/controlled-pilot/FUTURE_VERSION_ORIGIN_READBACK.sql':'956698a0b9a671aed02f3a68ef6a5c47a4d261026c16a15e6a06e14cc3a752d7'}
FORBIDDEN_ENV = {'SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
                 'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE',
                 'PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION','DATABASE_URL','NODE_OPTIONS'}
UPDATE_SCOPE = 'Future captures only; no snapshots, PDF bytes, jobs, Auth, client/resource bindings or credentials changed.'
PREFLIGHT_SQL = """begin isolation level repeatable read read only;
set local search_path='';set local statement_timeout='30s';
select jsonb_build_object('database',current_database(),'operator',current_user,
'history',(select array_agg(version order by version)from supabase_migrations.schema_migrations),
'configuration_count',(select count(*)from eps.presentation_processing_config),
'application_origin',(select application_origin from eps.presentation_processing_config where id),
'active_presentation_jobs',(select count(*)from eps.jobs where kind in('presentation_render','presentation_export')and status in('queued','running','waiting_for_input')),
'unexpected_config_triggers',(select count(*)from pg_trigger where tgrelid='eps.presentation_processing_config'::regclass and not tgisinternal))as pilot_origin_preflight;
rollback;
"""


def require(value):
    if not value:
        raise ValueError('FUTURE_ORIGIN_OPERATION_UNCONFIRMED')


def digest(value):
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
        raise ValueError('FUTURE_ORIGIN_OPERATION_UNCONFIRMED') from None


def validate_environment(environment):
    require(not any(environment.get(key) for key in FORBIDDEN_ENV))


def validate_preflight(value, require_old=True):
    exact(value, ('database','operator','history','configuration_count','application_origin','active_presentation_jobs','unexpected_config_triggers'))
    require(value['database'] == value['operator'] == 'postgres' and value['history'] == list(VERSIONS))
    require(type(value['configuration_count']) is int and value['configuration_count'] == 1)
    require(type(value['active_presentation_jobs']) is int and value['active_presentation_jobs'] == 0)
    require(type(value['unexpected_config_triggers']) is int and value['unexpected_config_triggers'] == 0)
    require(value['application_origin'] == OLD if require_old else value['application_origin'] in (OLD, HOST))
    return copy.deepcopy(value)


def validate_metadata(value):
    exact(value, ('versions','slides','pins','ready_asset_metadata','protected_m02'))
    for key in ('versions','slides','pins','ready_asset_metadata'):
        item = value[key]; exact(item, ('count','sha256')); integer(item['count'])
        require(type(item['sha256']) is str and re.fullmatch('[a-f0-9]{64}',item['sha256']))
    job = value['protected_m02']
    exact(job, ('id','status','stage','attempt','row_version','resource_id','manual_note_retained','spec_sha256'))
    require(job['id'] == PROTECTED_JOB and job['status'] in ('queued','running','waiting_for_input','failed','succeeded','cancelled'))
    require(job['stage'] is None or type(job['stage']) is str and re.fullmatch('[a-z_]{1,100}',job['stage']))
    integer(job['attempt']); integer(job['row_version'],1); canonical_uuid(job['resource_id'])
    require(job['manual_note_retained'] is True and type(job['spec_sha256']) is str and re.fullmatch('[a-f0-9]{64}',job['spec_sha256']))


def validate_readback(value):
    exact(value, ('expected_project','configuration','pilot_origin_configured','captured_pilot_origin_versions','captured_loopback_origin_versions','protected_metadata'))
    require(value['expected_project'] == TARGET)
    config = value['configuration']
    exact(config, ('application_origin','enabled','renderer_version','max_manifest_bytes','max_pdf_bytes','max_pages'))
    require(config['application_origin'] in (OLD,HOST) and type(config['enabled']) is bool)
    require(type(config['renderer_version']) is str and re.fullmatch('[a-zA-Z0-9_.-]{1,200}',config['renderer_version']))
    for key in ('max_manifest_bytes','max_pdf_bytes','max_pages'):
        integer(config[key],1)
    require(type(value['pilot_origin_configured']) is bool and value['pilot_origin_configured'] == (config['application_origin'] == HOST))
    integer(value['captured_pilot_origin_versions']); integer(value['captured_loopback_origin_versions'])
    validate_metadata(value['protected_metadata'])
    return copy.deepcopy(value)


def validate_update(value):
    exact(value, ('expected_project','old_origin','new_origin','configuration_other_columns_preserved',
                  'snapshots_slides_pins_ready_metadata_and_m02_preserved','protected_metadata','scope'))
    require(value['expected_project'] == TARGET and value['old_origin'] == OLD and value['new_origin'] == HOST)
    require(value['configuration_other_columns_preserved'] is True and value['snapshots_slides_pins_ready_metadata_and_m02_preserved'] is True)
    require(value['scope'] == UPDATE_SCOPE); validate_metadata(value['protected_metadata'])
    return copy.deepcopy(value)


def preserved(before, after):
    if before is None or after is None:
        return False
    expected = copy.deepcopy(before); expected['configuration']['application_origin'] = HOST; expected['pilot_origin_configured'] = True
    return expected == after


def read_pair(io):
    values = []
    for _ in range(2):
        try:
            values.append(validate_readback(io.readback()))
        except Exception:
            values.append(None)
    return values


def readback_result(before, after, independent):
    equal = after is not None and independent is not None and after == independent
    configured = equal and after['pilot_origin_configured'] is True
    intact = preserved(before,after) and preserved(before,independent) if before else None
    verified = configured and before is not None and intact is True
    return {'result':'passed' if verified else 'unconfirmed','dispatch_attempted':False,
            'readback':after,'independent_readback':independent,'independent_readback_equal':equal,
            'original_baseline_available':before is not None,'protected_before_after_equal':intact,
            'origin_configured':configured,'application_verified_by_readback':verified,'automatic_dispatch_retry':False}


def apply_once(io):
    validate_preflight(io.preflight())
    before = validate_readback(io.readback()); require(before['configuration']['application_origin'] == OLD)
    io.verify_sources()
    io.claim({'target':TARGET,'old_origin':OLD,'new_origin':HOST,'before':before,
              'claimed_at':stamp(),'dispatch_may_have_occurred':True})
    # Latest read and transaction-level guard both refuse active presentation jobs.
    validate_preflight(io.preflight()); io.verify_sources()
    outcome = 'unconfirmed'; update = None
    try:
        update = validate_update(io.dispatch()); outcome = 'command_succeeded'
    except Exception:
        pass  # A lost reply can follow COMMIT. Never issue a second update.
    after, independent = read_pair(io)
    sources_unchanged = True
    try:
        io.verify_sources()
    except Exception:
        sources_unchanged = False
    equal = after is not None and independent is not None and after == independent
    intact = preserved(before,after) and preserved(before,independent)
    update_equal = update is None or update['protected_metadata'] == before['protected_metadata']
    passed = equal and intact and update_equal and sources_unchanged
    return {'result':'passed' if passed else 'unconfirmed','dispatch_attempted':True,'dispatch_outcome':outcome,
            'automatic_dispatch_retry':False,'application_verified_by_readback':passed,'independent_readback_equal':equal,
            'protected_before_after_equal':intact,'update_result_verified':update is not None,'sources_unchanged':sources_unchanged,
            'before':before,'after':after,'independent_readback':independent,'claim_retained':True,
            'scope':UPDATE_SCOPE,'raw_diagnostics_or_credentials_persisted':False}


def public_bytes(file, maximum=256*1024):
    require(file.is_file() and not file.is_symlink() and file.resolve() == file and file.is_relative_to(ROOT))
    before = file.stat(); require(before.st_size <= maximum)
    require(not getattr(file.lstat(),'st_file_attributes',0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)
    data = file.read_bytes(); after = file.stat()
    require((before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns) ==
            (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns) and len(data) == before.st_size)
    return data


def source_pins():
    result = {}
    for relative, expected in PINS.items():
        actual = digest(public_bytes(ROOT/relative)); require(actual == expected); result[relative] = actual
    require(public_bytes(ROOT/'supabase/.temp/project-ref').decode().strip() == TARGET)
    require(tuple(sorted(file.name[:14] for file in (ROOT/'supabase/migrations').glob('*.sql'))) == VERSIONS)
    result['development/m07/controlled-pilot/future-origin.py'] = digest(public_bytes(Path(__file__).resolve()))
    result['preflight_sql_sha256'] = digest(PREFLIGHT_SQL.encode())
    return result


def query_command(mode):
    files = {'preflight':PRIVATE/'preflight.sql','update':HERE/'FUTURE_VERSION_ORIGIN.sql','readback':HERE/'FUTURE_VERSION_ORIGIN_READBACK.sql'}
    require(mode in files)
    return ['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,
            '--file',str(files[mode]),'--output-format','json','--workdir',str(ROOT)]


def query(mode):
    # stdout/stderr may contain private diagnostics and are never persisted.
    result = subprocess.run(query_command(mode),cwd=ROOT,capture_output=True,text=True,
                            encoding='utf8',errors='replace',timeout=90,stdin=subprocess.DEVNULL)
    require(result.returncode == 0 and len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
    value = json.loads(result.stdout); key = {'preflight':'pilot_origin_preflight','update':'pilot_origin_update','readback':'pilot_origin_readback'}[mode]
    require(type(value) is dict and type(value.get('rows')) is list and len(value['rows']) == 1)
    exact(value['rows'][0], (key,)); return value['rows'][0][key]


def exclusive_json(file, value):
    require(file.parent.resolve() == PRIVATE and file.parent.is_dir())
    descriptor = os.open(file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(descriptor,'w',encoding='utf8',newline='\n') as handle:
        handle.write(json.dumps(value,sort_keys=True)+'\n'); handle.flush(); os.fsync(handle.fileno())


class OperatorIO:
    def __init__(self, pins):
        self.pins = pins

    def verify_sources(self):
        require(source_pins() == self.pins)

    def preflight(self):
        return query('preflight')

    def readback(self):
        return query('readback')

    def dispatch(self):
        self.verify_sources(); return query('update')

    def claim(self, value):
        exclusive_json(CLAIM,{**value,'sources':self.pins})


def prepare_public_preflight():
    PRIVATE.mkdir(parents=True,exist_ok=True); require(PRIVATE.resolve() == PRIVATE and not PRIVATE.is_symlink())
    file = PRIVATE/'preflight.sql'
    if file.exists():
        require(public_bytes(file) == PREFLIGHT_SQL.encode())
    else:
        with file.open('xb') as handle:
            handle.write(PREFLIGHT_SQL.encode()); handle.flush(); os.fsync(handle.fileno())


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect','apply','readback'))
    action = sys.argv[1]; validate_environment(os.environ); pins = source_pins(); prepare_public_preflight(); io = OperatorIO(pins)
    if action == 'apply':
        result = apply_once(io)
    elif action == 'inspect':
        result = {'result':'passed','dispatch_attempted':False,'preflight':validate_preflight(io.preflight(),False),
                  'readback':validate_readback(io.readback()),'scope':'Read-only current configuration and protected metadata; no application performed'}
    else:
        after, independent = read_pair(io); before = None
        if CLAIM.exists():
            claim = json.loads(public_bytes(CLAIM)); exact(claim, ('target','old_origin','new_origin','before','claimed_at','dispatch_may_have_occurred','sources'))
            require(claim['target'] == TARGET and claim['old_origin'] == OLD and claim['new_origin'] == HOST
                    and claim['sources'] == pins and claim['dispatch_may_have_occurred'] is True)
            before = validate_readback(claim['before']); require(before['configuration']['application_origin'] == OLD)
        result = readback_result(before,after,independent)
    io.verify_sources()
    report = {'schema_version':'1.0','observed_at':stamp(),'target':TARGET,'action':action,'sources':pins,**result,
              'credentials_or_raw_cli_diagnostics_persisted':False,'current_pdf_bytes_or_job_inputs_rewritten':False}
    directory = ROOT/'tracking/evidence/m07/controlled-pilot'; directory.mkdir(parents=True,exist_ok=True)
    file = directory/f"{datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')}-{uuid.uuid4().hex[:8]}-future-origin-{action}.json"
    with file.open('x',encoding='utf8',newline='\n') as handle:
        handle.write(json.dumps(report,indent=2)+'\n'); handle.flush(); os.fsync(handle.fileno())
    print(json.dumps({'result':report['result'],'receipt':file.relative_to(ROOT).as_posix(),'dispatch_attempted':report['dispatch_attempted'],
                      'automatic_dispatch_retry':False,'raw_diagnostics_suppressed':True}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print(json.dumps({'result':'unconfirmed','raw_diagnostics_suppressed':True,'next_action':'readback only; never repeat an unknown update'}))
        sys.exit(1)
