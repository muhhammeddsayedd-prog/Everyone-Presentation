"""Root-executed hosted public-client operator. Importing is inert.

Pinned CLI default API-key listing -> one retained legacy service_role JWT in
memory -> fixed central Auth Admin list/create only. No --reveal, key minting,
auth-file reading, credential arguments/files/logs/digests, or browser/client
configuration. Unknown create outcomes only read back. Root runs after core.
"""
from pathlib import Path
import base64
import copy
import datetime
import hashlib
import json
import os
import re
import ssl
import subprocess
import sys
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
TARGET = 'pyibofyctwnqpvktepse'
ORIGIN = 'https://everyone-presentation-pilot.vercel.app'
RESOURCE = ORIGIN + '/mcp'
ISSUER = 'https://' + TARGET + '.supabase.co/auth/v1'
ADMIN = ISSUER + '/admin/oauth/clients'
CALLBACK = 'http://localhost:3118/callback'
CLIENT_NAME = 'Everyone Presentation Studio Hosted Pilot — Claude Code'
DIRECTORY = ROOT / '.local/m07-pilot/hosted-oauth-client'
CLAIM = DIRECTORY / 'create.claim.json'
PIN_LINK = 'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5'
PIN_CONFIG = '0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2'
FORBIDDEN_ENV = {'SUPABASE_PROJECT_ID','SUPABASE_PROJECT_REF','SUPABASE_API_URL','SUPABASE_WORKDIR','SUPABASE_DB_URL',
                 'PGHOST','PGHOSTADDR','PGPORT','PGDATABASE','PGUSER','PGPASSWORD','PGPASSFILE','PGSERVICE','PGSERVICEFILE',
                 'PGOPTIONS','PGSSLMODE','PGSSLROOTCERT','PGSSLCERT','PGSSLKEY','PGSSLNEGOTIATION','DATABASE_URL','NODE_OPTIONS',
                 'NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS','SSL_CERT_FILE','SSL_CERT_DIR','REQUESTS_CA_BUNDLE','CURL_CA_BUNDLE'}
CLIENT_FIELDS = {'client_id','client_type','redirect_uris','token_endpoint_auth_method','grant_types','response_types',
                 'client_name','client_uri','logo_uri','registration_type','created_at','updated_at'}
SELECTED_FIELDS = ('client_id','client_name','client_type','token_endpoint_auth_method','redirect_uris','grant_types','response_types','registration_type')


def require(value):
    if not value: raise ValueError('HOSTED_OAUTH_CLIENT_UNCONFIRMED')


def exact(value, fields):
    require(type(value) is dict and set(value) == set(fields))


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha(value):
    return hashlib.sha256(value).hexdigest()


def key_command():
    return ['npx.cmd','--yes','supabase@2.122.0','projects','api-keys','--project-ref',TARGET,'--output','json']


def decode_segment(value):
    require(type(value) is str and 1 <= len(value) <= 8192 and re.fullmatch('[A-Za-z0-9_-]+',value))
    try:
        raw = base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))
        require(base64.urlsafe_b64encode(raw).decode().rstrip('=') == value)
        return json.loads(raw.decode('utf-8'))
    except Exception:
        raise ValueError('HOSTED_OAUTH_CLIENT_UNCONFIRMED') from None


def select_legacy_service_key(rows, now=None):
    require(type(rows) is list and 1 <= len(rows) <= 100 and all(type(row) is dict for row in rows))
    selected = [row for row in rows if row.get('name') == 'service_role']
    require(len(selected) == 1)
    row = selected[0]; key = row.get('api_key')
    require(row.get('id') == 'service_role' and row.get('type') == 'legacy' and type(key) is str and len(key) <= 16384)
    parts = key.split('.'); require(len(parts) == 3 and re.fullmatch('[A-Za-z0-9_-]{43}',parts[2]))
    header, payload = decode_segment(parts[0]), decode_segment(parts[1])
    exact(header, ('alg','typ')); exact(payload, ('iss','ref','role','iat','exp'))
    now = int(time.time()) if now is None else now
    require(header == {'alg':'HS256','typ':'JWT'} and payload['iss'] == 'supabase' and payload['ref'] == TARGET and payload['role'] == 'service_role')
    require(type(payload['iat']) is int and type(payload['exp']) is int and payload['iat'] <= now < payload['exp'] and payload['exp'] > now + 60)
    # Shape and project checks are not independent cryptographic verification.
    # Credential provenance is the successful pinned CLI fixed-project HTTPS read.
    return key


def canonical_uuid(value):
    try: require(type(value) is str and str(uuid.UUID(value)) == value and uuid.UUID(value).int != 0)
    except Exception: raise ValueError('HOSTED_OAUTH_CLIENT_UNCONFIRMED') from None


def registration_payload():
    return {'client_name':CLIENT_NAME,'client_type':'public','token_endpoint_auth_method':'none',
            'redirect_uris':[CALLBACK],'grant_types':['authorization_code','refresh_token']}


def parse_client(value):
    require(type(value) is dict and set(value) <= CLIENT_FIELDS and set(SELECTED_FIELDS) <= set(value))
    canonical_uuid(value['client_id'])
    require(value['client_type'] in ('public','confidential') and value['token_endpoint_auth_method'] in ('none','client_secret_basic','client_secret_post'))
    for key in ('redirect_uris','grant_types','response_types'):
        require(type(value[key]) is list and 0 < len(value[key]) <= 10
                and all(type(item) is str and 0 < len(item) <= 2048 for item in value[key]) and len(set(value[key])) == len(value[key]))
    require(set(value['grant_types']) <= {'authorization_code','refresh_token'} and value['response_types'] == ['code'])
    require(value['registration_type'] in ('manual','dynamic') and type(value['client_name']) is str and len(value['client_name']) <= 1024)
    for key in ('client_uri','logo_uri','created_at','updated_at'):
        if key in value: require(type(value[key]) is str and len(value[key]) <= 2048)
    return copy.deepcopy(value)


def parse_clients(value):
    require(type(value) is dict and set(value) <= {'clients'})
    rows = value.get('clients',[])
    require(type(rows) is list and len(rows) <= 500)
    clients = [parse_client(row) for row in rows]
    require(len({row['client_id'] for row in clients}) == len(clients))
    return sorted(clients,key=lambda row:row['client_id'])


def matching(clients):
    expected = registration_payload()
    matches = [row for row in clients if all(row.get(key) == value for key,value in expected.items())
               and row.get('response_types') == ['code'] and row.get('registration_type') == 'manual']
    require(len(matches) <= 1)
    # A conflicting remembered same-name registration requires review, not a duplicate.
    require(all(row['client_name'] != CLIENT_NAME or row in matches for row in clients))
    return matches


def source_pins():
    for relative, expected in [('supabase/.temp/project-ref',PIN_LINK),('supabase/config.toml',PIN_CONFIG)]:
        file = ROOT / relative
        require(file.is_file() and not file.is_symlink() and file.stat().st_size <= 256 * 1024 and sha(file.read_bytes()) == expected)
    selected = {'helper_sha256':Path(__file__).resolve(),'plan_sha256':HERE/'hosted-oauth-plan.mjs'}
    result = {}
    for key,file in selected.items():
        require(file.is_file() and not file.is_symlink() and file.resolve() == file and file.stat().st_size <= 256 * 1024)
        result[key] = sha(file.read_bytes())
    return result


def operate(mode, pull, post, acquire_claim, verify_sources, observation_kind='synthetic'):
    require(mode in ('inspect','create','readback') and observation_kind in ('synthetic','actual_provider_observation'))
    pins = verify_sources()
    exact(pins,('helper_sha256','plan_sha256')); require(all(type(v) is str and re.fullmatch('[a-f0-9]{64}',v) for v in pins.values()))
    report = {'schema_version':'1.0','evidence_kind':observation_kind,'target':TARGET,'origin':ORIGIN,'resource':RESOURCE,'issuer':ISSUER,
              'action':mode,'observed_at':stamp(),'finished_at':None,'result':'unconfirmed','client':None,'matching_client_count':0,
              'provider_client_observed':False,'independent_readback_equal':False,'client_secret_observed':False,
              'original_client_baseline_available':False,'other_existing_clients_equal':False,'creation_dispatched':False,
              'post_outcome':'not_attempted','repeat_create_prevented':False,'automatic_post_retry':False,
              'application_resource_binding_observed':False,'provider_configuration_observed':False,
              'credentials_logged_or_persisted':False,'service_role_sent_outside_fixed_auth_admin':False,
              'claude_configuration_login_or_model_call':False,'configuration_or_database_mutations':False,'source_pins':pins}
    before = pull(); require(type(before) is list); candidates = matching(before)
    need_create = mode == 'create' and not candidates
    created_id = None
    if need_create:
        try:
            acquire_claim({'schema_version':'1.0','target':TARGET,'action':'create_public_hosted_client','registration':registration_payload(),
                           'source_pins':pins,'dispatch_may_have_occurred':True})
        except FileExistsError:
            need_create = False; report['repeat_create_prevented'] = True
        if need_create:
            require(pull() == before and verify_sources() == pins)
            report.update(creation_dispatched=True,original_client_baseline_available=True,post_outcome='unknown')
            try:
                created = post(registration_payload())
            except Exception:
                pass  # Transport/HTTP failure may follow a commit. Never repeat POST.
            else:
                report['client_secret_observed'] = type(created) is dict and 'client_secret' in created
                try:
                    require(matching([parse_client(created)]))
                    created_id = created['client_id']
                    report['post_outcome'] = 'response_validated'
                except Exception:
                    report['post_outcome'] = 'invalid_response'
    observations = []
    for _ in range(2):
        try: observations.append(pull())
        except Exception: observations.append(None)
    try:
        after, independent = observations
        require(type(after) is list and type(independent) is list)
        report['independent_readback_equal'] = after == independent
        selected = matching(independent)
        report['matching_client_count'] = len(selected)
        require(verify_sources() == pins)
        if selected:
            client = selected[0]
            report['client'] = {key:copy.deepcopy(client[key]) for key in SELECTED_FIELDS}
            report['provider_client_observed'] = observation_kind == 'actual_provider_observation'
            if report['original_client_baseline_available']:
                report['other_existing_clients_equal'] = before == [row for row in after if row['client_id'] != client['client_id']] == [row for row in independent if row['client_id'] != client['client_id']]
            if after == independent and report['post_outcome'] != 'invalid_response' and (created_id is None or created_id == client['client_id']) and (not report['creation_dispatched'] or report['other_existing_clients_equal']):
                report['result'] = 'passed'
    except Exception:
        pass
    report['finished_at'] = stamp()
    return report


RECEIPT_FIELDS = {'schema_version','evidence_kind','target','origin','resource','issuer','action','observed_at','finished_at','result','client',
                  'matching_client_count','provider_client_observed','independent_readback_equal','client_secret_observed',
                  'original_client_baseline_available','other_existing_clients_equal','creation_dispatched','post_outcome','repeat_create_prevented',
                  'automatic_post_retry','application_resource_binding_observed','provider_configuration_observed','credentials_logged_or_persisted',
                  'service_role_sent_outside_fixed_auth_admin','claude_configuration_login_or_model_call','configuration_or_database_mutations','source_pins'}


def validate_public_receipt(value, require_actual=False):
    exact(value,RECEIPT_FIELDS)
    require(value['schema_version'] == '1.0' and value['target'] == TARGET and value['origin'] == ORIGIN and value['resource'] == RESOURCE and value['issuer'] == ISSUER)
    require(value['action'] in ('inspect','create','readback') and value['evidence_kind'] in ('synthetic','actual_provider_observation') and value['result'] in ('passed','unconfirmed'))
    for key,item in value.items():
        if key not in {'schema_version','evidence_kind','target','origin','resource','issuer','action','observed_at','finished_at','result','client','matching_client_count','post_outcome','source_pins'}:
            require(type(item) is bool)
    for key in ('observed_at','finished_at'):
        require(type(value[key]) is str and value[key].endswith('+00:00') and datetime.datetime.fromisoformat(value[key]).utcoffset() == datetime.timedelta(0))
    require(datetime.datetime.fromisoformat(value['finished_at']) >= datetime.datetime.fromisoformat(value['observed_at']))
    require(type(value['matching_client_count']) is int and value['matching_client_count'] in (0,1) and value['post_outcome'] in ('not_attempted','unknown','response_validated','invalid_response'))
    exact(value['source_pins'],('helper_sha256','plan_sha256')); require(all(type(x) is str and re.fullmatch('[a-f0-9]{64}',x) for x in value['source_pins'].values()))
    require(not any(value[key] for key in ('automatic_post_retry','application_resource_binding_observed','provider_configuration_observed',
                                         'credentials_logged_or_persisted','service_role_sent_outside_fixed_auth_admin','claude_configuration_login_or_model_call','configuration_or_database_mutations')))
    if value['client'] is not None:
        exact(value['client'],SELECTED_FIELDS); require(matching([parse_client(value['client'])]))
    if value['result'] == 'passed':
        require(value['matching_client_count'] == 1 and value['client'] is not None and value['independent_readback_equal'] is True and value['post_outcome'] != 'invalid_response' and value['client_secret_observed'] is False)
    if require_actual: require(value['evidence_kind'] == 'actual_provider_observation' and value['provider_client_observed'] is True and value['result'] == 'passed')


def acquire_claim(value):
    DIRECTORY.mkdir(parents=True,exist_ok=True)
    require(not DIRECTORY.is_symlink() and DIRECTORY.resolve() == DIRECTORY)
    with CLAIM.open('x',encoding='utf-8',newline='\n') as file:
        file.write(json.dumps(value,separators=(',',':'))+'\n'); file.flush(); os.fsync(file.fileno())


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError('HOSTED_OAUTH_CLIENT_UNCONFIRMED')


def request_admin(method, key, payload=None):
    require(method in ('GET','POST'))
    request = urllib.request.Request(ADMIN,method=method,data=None if payload is None else json.dumps(payload,separators=(',',':')).encode(),
                                     headers={'Authorization':'Bearer '+key,'apikey':key,'Accept':'application/json','Content-Type':'application/json'})
    opener = urllib.request.build_opener(NoRedirect(),urllib.request.HTTPSHandler(context=ssl.create_default_context()))
    with opener.open(request,timeout=10) as response:
        require(response.geturl() == ADMIN and response.status == (201 if method == 'POST' else 200) and response.headers.get_content_type() == 'application/json')
        body = response.read(512*1024+1); require(len(body) <= 512*1024)
        return json.loads(body.decode('utf-8'))


def load_key():
    # Never surface subprocess stdout/stderr or exception payloads: stdout is private.
    version = subprocess.run(['npx.cmd','--yes','supabase@2.122.0','--version'],cwd=ROOT,capture_output=True,timeout=30,stdin=subprocess.DEVNULL)
    require(version.returncode == 0 and version.stdout.strip() == b'2.122.0')
    result = subprocess.run(key_command(),cwd=ROOT,capture_output=True,timeout=45,stdin=subprocess.DEVNULL)
    require(result.returncode == 0 and len(result.stdout) <= 1024*1024)
    return select_legacy_service_key(json.loads(result.stdout.decode('utf-8')))


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect','create','readback'))
    require(not any(os.environ.get(key) for key in FORBIDDEN_ENV))
    pins = source_pins()
    key = load_key()
    try:
        require(source_pins() == pins)
        report = operate(sys.argv[1],lambda:parse_clients(request_admin('GET',key)),lambda payload:request_admin('POST',key,payload),
                         acquire_claim,source_pins,observation_kind='actual_provider_observation')
    finally:
        del key  # Drop references, not a claim of immutable-string memory erasure.
    validate_public_receipt(report)
    area = ROOT/'tracking/evidence/m07/controlled-pilot'; area.mkdir(parents=True,exist_ok=True)
    filename = datetime.datetime.now(datetime.timezone.utc).isoformat().replace(':','-').replace('.','-')+'-'+uuid.uuid4().hex[:8]+'-hosted-oauth-client-'+sys.argv[1]+'.json'
    destination = area/filename
    with destination.open('x',encoding='utf-8',newline='\n') as file: file.write(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'result':report['result'],'action':report['action'],'receipt':str(destination.relative_to(ROOT)).replace('\\','/'),
                      'client_id':report['client']['client_id'] if report['client'] is not None else None}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception:
        print('HOSTED_OAUTH_CLIENT_UNCONFIRMED',file=sys.stderr); sys.exit(1)
