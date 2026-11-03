"""Pure one-guard candidate and owned-local proof rendering. No transport."""
from pathlib import Path
import hashlib,re

EXECUTION_ENABLED=False
ROOT=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
MIGRATION='supabase/migrations/20261028024205_m01_private_logo_boundary.sql'
MIGRATION_SHA='b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d'
BASE_BODY_SHA='1f3f2a1440bf97400b7042bafd4b49ac98f7960cce8cd815f973ca5a7d166e87'
OLD="not storage.allow_only_operation('object.get_authenticated')"
NEW="not(storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info'))"
HEADER="create or replace function eps.logo_storage_read_allowed(p_bucket text,p_key text) returns boolean\nlanguage plpgsql stable security definer set search_path='' as $logo_info$"

def need(ok):
 if not ok:raise ValueError('LOGO_INFO_SOURCE_UNCONFIRMED')

def sha(raw):return hashlib.sha256(raw).hexdigest()

def baseline():
 raw=(ROOT/MIGRATION).read_bytes();need(sha(raw)==MIGRATION_SHA)
 match=re.search(r"create function eps\.logo_storage_read_allowed\(p_bucket text,p_key text\) returns boolean\s+language plpgsql stable security definer set search_path='' as \$\$(.*?)\$\$;",raw.decode().replace('\r\n','\n'),re.S)
 need(match is not None and sha(match[1].encode())==BASE_BODY_SHA);return match[1]

def patch_body(body):
 need(type(body)is str and sha(body.encode())==BASE_BODY_SHA and body.count(OLD)==1 and NEW not in body)
 value=body.replace(OLD,NEW);need(value.count(NEW)==1 and value.replace(NEW,OLD)==body);return value

def candidate():return HEADER+patch_body(baseline())+'$logo_info$;'

def proof(run):
 need(type(run)is str and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}',run)is not None)
 text=(Path(__file__).parent/'proof.sql').read_text(encoding='utf8')
 for old,new in [('__RUN__',run),('__BASE_BODY_SHA__',BASE_BODY_SHA),('__CANDIDATE_BODY_SHA__',sha(patch_body(baseline()).encode())),('-- __CANDIDATE_DEFINITION__',candidate())]:
  need(text.count(old)==1);text=text.replace(old,new)
 need('__CANDIDATE_'not in text and '__BASE_'not in text and '__RUN__'not in text);return text
