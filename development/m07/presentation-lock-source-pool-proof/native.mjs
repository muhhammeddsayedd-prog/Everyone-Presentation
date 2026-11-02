/** Only verbose psql ERROR provenance; never classify Node EPIPE as PostgreSQL. */
const APPLICATION=new Set(['RESOURCE_NOT_FOUND','CAPABILITY_REQUIRED','AUTH_REQUIRED','INPUT_CHANGED','IMMUTABLE_VERSION','STALE_RESOURCE_VERSION']);
export function nativeError(error){
 const stderr=typeof error?.diagnostic?.stderr==='string'?error.diagnostic.stderr:'';
 const first=stderr.split(/\r?\n/u).find(line=>/^(?:psql:[^\r\n]*:[0-9]+:\s*)?ERROR:/u.test(line));
 const match=typeof first==='string'?/^(?:psql:[^\r\n]*:[0-9]+:\s*)?ERROR:\s+([0-9A-Z]{5}):\s*(.*)$/u.exec(first):null;
 return {sqlstate:match?.[1]??null,provenance:match?'first_verbose_psql_ERROR_line':null,application_code:match&&APPLICATION.has(match[2].trim())?match[2].trim():null};
}
