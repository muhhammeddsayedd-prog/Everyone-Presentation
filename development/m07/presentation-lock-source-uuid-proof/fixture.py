"""Pure finite binding of raw-MD5 fixture IDs and the actual public input guard."""
from pathlib import Path
import hashlib
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
METADATA = MAIN / '.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'
UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('FIXTURE_PUBLIC_UUID_SOURCE_UNCONFIRMED')


def definition(text, name):
    match = re.search(r'(CREATE FUNCTION ' + re.escape(name) + r'\([^;]*? AS (\$[a-zA-Z0-9_]*\$))(.*?)\2;', text, re.S)
    need(match is not None)
    return match[0], match[3]


def build():
    scale_file = ROOT / 'development/m07/presentation-lock-source-proof/scale.sql'
    cases_file = ROOT / 'development/m07/presentation-lock-source-pool-proof/cases.mjs'
    fixture_file = ROOT / 'development/m07/presentation-lock-source-proof/fixture.sql'
    scale = scale_file.read_bytes();cases = cases_file.read_bytes();fixture = fixture_file.read_bytes();meta = METADATA.read_bytes()
    need(sha(scale) == '0a74ce47ff97339b4e63cf8df3aa3801321e2099588ed22367e5fe4317acaa7f')
    need(sha(cases) == '2832ee76211ed1a2494adad26b1d17fc90adae6e600b943232b6bc170a4e9dc5')
    need(sha(fixture) == 'aa976e76fa2a69fd7ea2b8f6f90609c28f734b889b20c15fe8de8d50dc29d22d')
    need(sha(meta) == '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c')
    scale = scale.decode();cases = cases.decode();fixture = fixture.decode();meta = meta.decode()
    # These exact finite fragments bind active domains and assignment exclusion.
    fragments = [
        "for i in 1..case when n=1 then 1 else 563 end loop",
        "case when n=2 and i>16 then clock_timestamp()end",
        "for i in 1..case when n=1 then 1 else 15 end loop",
        "case when n=2 and i>11 then clock_timestamp()end",
        "for i in 1..case when n=1 then 1 else 20 end loop",
        "case when n=1 then 1 when i<=19 then((i-1)%16)+1 else 17 end",
        "case when n=1 then 1 when i<=19 then((i-1)%11)+1 else 12 end",
        "case when n=2 and i=20 then clock_timestamp()end",
        "locksource41_proof.uid('slot-'||n||'-'||i)",
        "locksource41_proof.uid('pool-'||n||'-'||i)",
    ]
    for fragment in fragments:
        need(scale.count(fragment) == 1)
    need("md5(current_setting('eps.locksource41.run')||':'||label)::uuid" in fixture)
    begin = cases.index(' const pair=await ctx.value(')
    end = cases.index('\n let pending;', begin)
    query = cases[begin:end]
    exact = "select jsonb_build_object('slot',s.id,'pool',c.id,'slot_revision',s.row_version)from eps.slots s cross join eps.workspace_candidates c where s.workspace_id=${literal(p.workspace)}::uuid and c.workspace_id=s.workspace_id and s.archived_at is null and c.archived_at is null and not exists(select 1 from eps.assignments a where a.slot_id=s.id and a.workspace_candidate_id=c.id and a.archived_at is null)order by s.id,c.id limit 1;"
    need(exact in query)
    guard_def, guard = definition(meta, 'eps.casting_uuid')
    need(UUID_PATTERN in guard)
    _, assignment = definition(meta, 'public.eps_create_assignment')
    need(assignment.index("eps.casting_uuid(p_input->'workspace_candidate_id')") < assignment.index('eps.casting_lock_workspaces'))
    _, generate = definition(meta, 'public.eps_generate_version')
    need("array['expected_workspace_row_version','expected_draft_revision','expected_input_fingerprint','generation_note']" in generate)
    need('eps.casting_uuid' not in generate and 'eps.review_uuid' not in generate)
    return {
        'active_slots': 16, 'active_pools': 11, 'active_assignments': 19,
        'assignment_slot_modulus': 16, 'assignment_pool_modulus': 11,
        'domain_uuid_pattern': UUID_PATTERN,
        'source_scale_sha256': sha(scale_file.read_bytes()),
        'source_fixture_sha256': sha(fixture_file.read_bytes()),
        'source_cases_sha256': sha(cases_file.read_bytes()),
        'exact_first_pair_query_sha256': sha(exact.encode()),
        'domain_UUID_guard_definition_sha256': sha(guard_def.encode()),
        'metadata_sha256': sha(METADATA.read_bytes()),
        'first_pair_formula': 'UUID byte-order slots16 x pools11, excluding active19 modulo16/modulo11; first pair only',
        'raw_MD5_fixture_SQL_unchanged': True,
        'actual_RC_functions_unchanged': True,
        'public_JSON_input_audit': {
            'create_project': 'No JSON UUID field in this fixture call.',
            'create_workspace': 'project_id comes from the normal successful create_project RPC; server generated canonical ID.',
            'create_presentation_series': 'workspace_id comes from normal create_workspace RPC; audience_preset_id is the same frozen seed chosen by the already successful393/278 prefix.',
            'create_assignment': 'Only positive public JSON raw-MD5 UUID inputs: slot_id and workspace_candidate_id. Qualify the exact first pair before any DB/claim.',
            'generate_version': 'Series argument comes from normal create_series RPC. Closed JSON input has revisions/fingerprint/optional note, no UUID input key.',
            'review_and_snapshot': 'Workspace/series arguments come from normal RPCs, not raw-MD5 JSON inputs.',
            'internal_capture_association_cases': 'Raw media/asset/slide/version IDs are trusted owned fixture rows consumed by unchanged PostgreSQL UUID casts, not casting_uuid. Malformed strings are explicit negative tests.',
            'wrong_MCP_session_negative': 'Absent raw-MD5 session claim is an intentional authorization denial, not a positive public JSON ID.',
            'actor_client_session_constants': 'Existing fixed controlled positive identities already match the canonical guard; no identity or authority change.',
        },
        'no_extra_grants_rows_production_changes_or_outcome_timing_selection': True,
    }
