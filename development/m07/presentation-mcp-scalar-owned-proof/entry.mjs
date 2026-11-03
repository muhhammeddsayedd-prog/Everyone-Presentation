/** Fresh owned local proof only. No hosted Storage, cloud or provider ports. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, lstat, realpath } from 'node:fs/promises';
import path from 'node:path';

export const EXECUTION_ENABLED = false;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(value);

export async function admit(cfg, controller, root) {
  assert(EXECUTION_ENABLED, 'MCP_SCALAR_OWNED_PROOF_DISABLED');
  assert.equal(path.resolve(root), cfg.root);
  for (const [file, digest] of Object.entries(cfg.source_pins)) {
    const stat = await lstat(file);
    assert(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1);
    assert.equal(await realpath(file), file);
    assert.equal(sha(await readFile(file)), digest);
  }
  assert.equal(path.resolve(controller), cfg.controller);
  assert(uuid(cfg.compile_uuid));
}

export async function claim(ctx, cfg) {
  assert(uuid(ctx.runId));
  const directory = path.join(ctx.root, '.local/mcp-scalar-owned-once', cfg.compile_uuid);
  await mkdir(path.dirname(directory), { recursive: true });
  await ctx.protect(directory);
  await writeFile(path.join(directory, 'claim.json'), JSON.stringify({
    compile_uuid: cfg.compile_uuid, run_id: ctx.runId,
    controller_sha256: sha(await readFile(cfg.controller)), source_pins: cfg.source_pins,
    automatic_retry: false,
  }), { flag: 'wx' });
  ctx.report.dispatch_once_claim_created = true;
}

export function renderProof(cfg, runId, identity, originalSystem) {
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

export function projectResults(stdout, expectedCases) {
  const rows=stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
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

export async function runProof(ctx, cfg) {
  const text=renderProof(cfg,ctx.runId,ctx.identity,ctx.originalSystem);
  const before=await ctx.baseline();
  const authSnapshot=async()=>{
    const raw=await ctx.sql("reset session authorization;begin read only;set local search_path='';"+authRowsSQL+'rollback;');
    const rows=raw.stdout.split(/\r?\n/u).filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));assert.equal(rows.length,1);return rows[0];
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

export async function inventories(docker, runId) {
  assert(uuid(runId));
  const filter = 'label=eps.scalarmcp.run=' + runId;
  const containers = await docker(['ps', '-aq', '--filter', filter]);
  const volumes = await docker(['volume', 'ls', '-q', '--filter', filter]);
  assert.equal(containers.code, 0); assert.equal(volumes.code, 0);
  assert.equal(containers.stdout.trim(), ''); assert.equal(volumes.stdout.trim(), '');
  return { same_engine_container_inventory_empty: true, same_engine_volume_inventory_empty: true };
}
