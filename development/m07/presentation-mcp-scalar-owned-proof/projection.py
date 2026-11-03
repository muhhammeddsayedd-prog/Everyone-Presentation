"""Finite entry projection over the frozen owned-only file/transport helpers."""
from pathlib import Path
import hashlib

HERE=Path(__file__).resolve().parent
OLD=HERE.parent/'logo-info-owned-proof/entry.mjs'
OLD_SHA='cc3c1cf2909ee8d3e9a88c0c0397a40f08ba63f3a945230ccb6f44903b97a3bc'


def need(ok):
    if not ok:raise ValueError('MCP_SCALAR_ENTRY_SOURCE_UNCONFIRMED')


def project_entry():
    raw=OLD.read_bytes();need(hashlib.sha256(raw).hexdigest()==OLD_SHA)
    before=raw.decode('utf8');source=before;edits=[]
    def replace(a,b):
        nonlocal source
        need(source.count(a)==1);source=source.replace(a,b,1);edits.append((a,b))
    replace('LOGO_INFO_OWNED_PROOF_DISABLED','MCP_SCALAR_OWNED_PROOF_DISABLED')
    replace("'.local/logo-info-owned-once'","'.local/mcp-scalar-owned-once'")
    replace("'label=eps.logoinfo.run='","'label=eps.scalarmcp.run='")
    start=source.index('export function renderProof(');stop=source.index('export function projectResults(',start)
    replace(source[start:stop],'''export function renderProof(cfg, runId, identity, originalSystem) {
  assert(uuid(runId));assert.equal(identity.database,'project39');
  const system=String(identity.system_identifier),original=String(originalSystem);
  assert(/^[0-9]{1,30}$/u.test(system)&&/^[0-9]{1,30}$/u.test(original));assert.notEqual(system,original);
  assert.equal(sha(cfg.proof_sql),cfg.proof_sql_sha256);
  assert.equal(cfg.proof_sql.split(cfg.template_run).length,2);
  let text=cfg.proof_sql.replace(cfg.template_run,runId);
  for(const[marker,value]of[['__OWNED_SYSTEM__',system],['__ORIGINAL_SYSTEM__',original]]){
    assert.equal(text.split(marker).length,2);text=text.replace(marker,value);
  }
  assert(!/__[A-Z_]+__/u.test(text));assert(text.trimEnd().endsWith('rollback;'));
  assert.equal(text.split('begin;').length,2);return text;
}

''')
    start=source.index('export function projectResults(');stop=source.index('export async function runProof(',start)
    replace(source[start:stop],'''export function projectResults(stdout, expectedCases) {
  const rows=stdout.split(/\\r?\\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
  const cases=rows.filter(row=>Object.hasOwn(row,'case'));
  assert(expectedCases.length>80);assert.deepEqual(cases.map(({variant,case:name})=>({variant,case:name})),expectedCases);
  for(const row of cases){
    assert.deepEqual(Object.keys(row).sort(),['case','dto_sha256','native_code','outcome','variant']);
    assert(['old','candidate'].includes(row.variant));
    assert(['true','false','null','dto','native22P02','native42501'].includes(row.outcome));
    assert.equal(row.native_code,row.outcome.startsWith('native')?row.outcome.slice(6):null);
    if(row.outcome==='dto')assert(/^[a-f0-9]{64}$/u.test(row.dto_sha256));else assert.equal(row.dto_sha256,null);
  }
  const old=cases.filter(row=>row.variant==='old'),candidate=cases.filter(row=>row.variant==='candidate');
  assert.equal(old.length,candidate.length);
  const contract=row=>({case:row.case,outcome:row.outcome,native_code:row.native_code,dto_sha256:row.dto_sha256});
  assert.deepEqual(old.map(contract),candidate.map(contract));
  const final=rows.filter(row=>row.result==='passed_local_scalar_parity');
  assert.deepEqual(final,[{result:'passed_local_scalar_parity',signed_OAuth_or_hosted_acceptance:false,rollback_required:true,target_function_restored_before_rollback:true,deterministic_collation_verified:true,one_target_prosrc_only:true,public_validator_unchanged:true}]);
  assert.equal(rows.length,cases.length+1);
  return{cases,case_count:cases.length,exact_old_new_case_parity:true,normal_rollback_required:true,
    target_function_restored_before_rollback:true,deterministic_collation_verified:true,
    one_target_prosrc_only:true,public_validator_unchanged:true,signed_OAuth_or_hosted_acceptance:false};
}

const authRowsSQL="select jsonb_build_object('users',jsonb_build_object('count',(select count(*)from auth.users),'sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t)order by id),'[]'::jsonb)::text,'UTF8')),'hex')from auth.users t)),'sessions',jsonb_build_object('count',(select count(*)from auth.sessions),'sha256',(select encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t)order by id),'[]'::jsonb)::text,'UTF8')),'hex')from auth.sessions t)));";

''')
    start=source.index('export async function runProof(');stop=source.index('export async function inventories(',start)
    replace(source[start:stop],'''export async function runProof(ctx, cfg) {
  const text=renderProof(cfg,ctx.runId,ctx.identity,ctx.originalSystem);
  const before=await ctx.baseline();
  const authSnapshot=async()=>{
    const raw=await ctx.sql("reset session authorization;begin read only;set local search_path='';"+authRowsSQL+'rollback;');
    const rows=raw.stdout.split(/\\r?\\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];
  };
  const authBefore=await authSnapshot();
  const input=path.join(ctx.privateRoot,'mcp-scalar-parity-proof.sql');
  await writeFile(input,text,{flag:'wx'});assert.equal(sha(await readFile(input)),sha(text));
  ctx.report.proof_input_sha256=sha(text);
  const result=await ctx.sql("reset session authorization;set eps.local_fixture_tests='eps-presentation-canonical-pg17-local';"+text);
  // Normal bounded psql return is necessary. Private stdout/stderr is kept
  // before any projection; no claims, Auth rows or arbitrary values are copied.
  const output=path.join(ctx.privateRoot,'mcp-scalar-proof-normal-output.json');
  const encoded=JSON.stringify({stdout:result.stdout,stderr:result.stderr});
  await writeFile(output,encoded,{flag:'wx'});assert.equal(sha(await readFile(output)),sha(encoded));
  assert.equal(result.code,0,'MCP_SCALAR_NORMAL_PSQL_EXIT_REQUIRED');
  const projected=projectResults(result.stdout,cfg.expected_cases);
  assert.deepEqual(await authSnapshot(),authBefore,'MCP_SCALAR_AUTH_ROWS_ROLLBACK_CHANGED');
  assert.deepEqual(await ctx.baseline(),before,'MCP_SCALAR_FULL_CLONE_ROLLBACK_CHANGED');
  ctx.report.mcp_scalar={...projected,normal_child_return:true,
    full_clone_rows_catalogue_roles_rollback_exact:true,auth_rows_rollback_exact:true,
    target_body_sha256:cfg.scalar_candidate.after_body_sha256,
    public_validator_body_sha256:cfg.scalar_candidate.unchanged_public_validator_body_sha256};
}

''')
    inverse=source
    for a,b in reversed(edits):need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse==before);return source


def admit_entry(raw):
    closed=project_entry();flag='export const EXECUTION_ENABLED = false;';need(closed.count(flag)==1)
    need(raw in[closed,closed.replace(flag,'export const EXECUTION_ENABLED = true;',1)])
