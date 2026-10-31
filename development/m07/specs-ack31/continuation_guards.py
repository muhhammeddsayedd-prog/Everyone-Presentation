"""Pure continuation guards and closed transport diagnostics. No IO."""
import re

TOKENS=('ACK31_EXACT_CLI_ROLE_IDENTITY_REQUIRED','ACK31_EXISTING_ROLE_CHANGED','ACK31_UNEXPECTED_LOGIN_EXPIRY_CHANGE',
 'ACK31_FULL_SELECTED_STATE_CHANGED','ACK31_OLD_CLIENT_TRANSACTION_PRESENT','ACK31_MONITORING_REQUIRED',
 'M07_ACK31_EXACT_CANONICAL30_REQUIRED','M07_ACK31_EXACT_PRIVATE_PREDECESSOR_REQUIRED','M07_ACK31_PROJECTION_OR_METADATA_NOT_PRESERVED')
SQLSTATES={'42501','42601','42703','42702','42P01','42883','25006','55P03','57014','23505','P0001','XX000'}
HTTP={400,401,403,404,408,409,413,422,429,500,502,503,504}

def need(value):
    if not value:raise ValueError('ACK31_CONTINUATION_UNCONFIRMED')

def validate_fence(value):
    need(type(value)is dict and set(value)=={'track_activities','unrestricted_visibility','older_client_transactions'})
    need(value['track_activities']is True and value['unrestricted_visibility']is True)
    need(type(value['older_client_transactions'])is int and value['older_client_transactions']==0)

def predecessor_equal(original,fresh,observed,guards):
    normalized,qualified=guards.normalize_expiry(original,fresh,observed)
    need(normalized==original);return qualified

def diagnostic(exit_code,stdout,stderr,timed_out=False):
    need(exit_code is None or type(exit_code)is int and -65536<=exit_code<=65536)
    need(type(timed_out)is bool)
    # Never preserve arbitrary error fragments, response bodies, filenames, or hashes.
    chunks=[]
    for value in(stdout,stderr):
        if isinstance(value,bytes):value=value.decode('utf8','replace')
        chunks.append(value[:1024*1024]if type(value)is str else'')
    text='\n'.join(chunks)
    statuses=[int(value)for value in re.findall(r'(?i)(?:HTTP(?:/\d(?:\.\d)?)?\s*[:=]?\s*|status(?:\s+code)?\s*[:=]?\s*)([1-5]\d\d)\b',text)]
    if re.search(r'(?i)requestentitytoolarge|request entity too large|payload too large',text):statuses.append(413)
    codes=re.findall(r'(?i)(?:SQLSTATE|["\']?code["\']?\s*[:=])\s*["\']?([A-Z0-9]{5})\b',text)
    allowed_http=set(statuses)&HTTP;allowed_codes={value.upper()for value in codes}&SQLSTATES
    return {'exit_code':exit_code,'timed_out':timed_out,'http_status':next(iter(allowed_http))if len(allowed_http)==1 else None,
      'sqlstate':next(iter(allowed_codes))if len(allowed_codes)==1 else None,
      'request_entity_too_large':413 in allowed_http,'fixed_error_tokens':[value for value in TOKENS if value in text]}

def command_returned_successfully(value):
    return value['exit_code']==0 and value['timed_out']is False
