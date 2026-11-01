"""Source-only SQL/privilege regression. Parses SQL; never starts a database or CLI."""
import re
import unittest
from pathlib import Path
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SQL = (HERE / 'candidate.sql').read_text(encoding='utf-8')
FIXTURE = (HERE / 'fixture.sql').read_text(encoding='utf-8')
QUERY = (HERE / 'operator-query.sql').read_text(encoding='utf-8')

class SourceTests(unittest.TestCase):
    def test_actual_sql_and_trigger_body_parse(self):
        self.assertEqual(len(parse_sql(SQL)), 20)
        self.assertEqual(len(parse_sql(QUERY)), 1)
        self.assertGreater(len(parse_sql(FIXTURE)), 25)
        function = 'create function eps.capture_job_stage_attempt()' + SQL.split(
            'create function eps.capture_job_stage_attempt()', 1)[1].split('grant create on schema', 1)[0]
        self.assertEqual(len(parse_plpgsql(function)), 1)
        # Parse every actual anonymous block too, including the invalid-claim rollback test.
        for source in [SQL, FIXTURE]:
            for block in re.findall(r'do \$\$.*?\$\$;', source, re.S | re.I):
                self.assertEqual(len(parse_plpgsql(block)), 1)

    def test_exact_history_and_owned_marker_fail_closed_before_ddl(self):
        expected = sorted(path.name.split('_', 1)[0] for path in (ROOT / 'supabase/migrations').glob('*.sql'))
        guard = SQL.split('end$$;', 1)[0]
        self.assertEqual(re.findall(r"'(2026\d{10})'", guard), expected)
        self.assertEqual(len(expected), 35)
        for check in ["current_user<>'postgres'", "current_database()<>'postgres'",
                      "'eps.job_attempt_trace_candidate'", "'owned-local-source-only-v1'",
                      "to_regclass('eps.job_stage_attempts') is not null",
                      "to_regprocedure('eps.capture_job_stage_attempt()') is not null",
                      "rolname='eps_job_trace_owner'", "tgname='capture_job_stage_attempt'"]:
            self.assertIn(check, guard)
        self.assertLess(SQL.index('M07_ATTEMPT_TRACE_OWNED_LOCAL35_REQUIRED'), SQL.index('create role'))
        self.assertFalse(any(path.name.endswith('attempt_observability.sql') for path in (ROOT/'supabase/migrations').glob('*')))

    def test_table_is_only_closed_typed_correlation_metadata(self):
        table = next(node.stmt for node in parse_sql(SQL) if node.stmt.__class__.__name__ == 'CreateStmt')
        columns = {item.colname for item in table.tableElts if item.__class__.__name__ == 'ColumnDef'}
        expected = {'schema_version','job_id','attempt_id','kind','stage','attempt','stage_attempt',
                    'dispatch_generation','correlation_id','input_hash','workflow_execution_id',
                    'workflow_execution_ref_state','claimed_at','job_row_version'}
        self.assertEqual(columns, expected)
        self.assertIn('primary key(job_id,attempt_id)', SQL)
        self.assertIn('unique(job_id,attempt)', SQL)
        self.assertNotIn('unique(job_id,stage,stage_attempt)', SQL)
        self.assertIn("workflow_execution_ref_state='recorded')=(workflow_execution_id is not null)", SQL)
        self.assertNotRegex(SQL, r'(?i)\b(?:jsonb|bytea|encrypted_response)\b')

    def test_new_owner_is_insert_only_and_never_an_api_or_service_login(self):
        self.assertIn('create role eps_job_trace_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;', SQL)
        self.assertIn('enable row level security;', SQL)
        self.assertIn('force row level security;', SQL)
        self.assertIn('revoke all on eps.job_stage_attempts from public,anon,authenticated,service_role;', SQL)
        self.assertIn('for insert to eps_job_trace_owner', SQL)
        self.assertIn('with check(pg_catalog.pg_trigger_depth()>0)', SQL)
        self.assertIn('revoke all on function eps.capture_job_stage_attempt() from public,anon,authenticated,service_role;', SQL)
        self.assertIn('alter function eps.capture_job_stage_attempt() owner to eps_job_trace_owner;', SQL)
        self.assertIn('revoke create on schema eps from eps_job_trace_owner;', SQL)
        for statement in parse_sql(SQL):
            text = statement.stmt.__class__.__name__
            self.assertNotIn(text, ['DropStmt', 'AlterRoleStmt', 'ViewStmt', 'AlterPolicyStmt'])
        self.assertNotRegex(SQL, r'(?i)grant\s+(?:select|update|delete|all|execute)\b')

    def test_only_new_committed_attempts_insert_and_existing_routines_are_unchanged(self):
        self.assertEqual(SQL.count('create function '), 1)
        self.assertNotIn('create or replace', SQL.lower())
        self.assertIn('after update of current_attempt_id on eps.jobs', SQL)
        self.assertIn('new.current_attempt_id is distinct from old.current_attempt_id', SQL)
        for guard in ["tg_relid<>'eps.jobs'::regclass", "tg_op<>'UPDATE'", "tg_level<>'ROW'", "tg_when<>'AFTER'",
                      "new.status is distinct from 'running'", 'new.attempt<>old.attempt+1',
                      'new.row_version<>old.row_version+1', 'old.stage_attempts->>new.stage',
                      'new.input_hash<>old.input_hash', 'new.correlation_id<>old.correlation_id']:
            self.assertIn(guard, SQL)
        self.assertEqual(SQL.count('insert into eps.job_stage_attempts('), 1)
        self.assertNotIn('on conflict', SQL.lower())
        # No backfill/selecting old jobs, triggers on callback tables, or job mutation.
        self.assertNotRegex(SQL, r'(?i)\b(?:update|delete\s+from|insert\s+into)\s+eps\.jobs\b')
        self.assertNotRegex(SQL, r'(?i)from\s+eps\.(?:jobs|job_events|outbox_events)\b')
        self.assertNotIn('exception when others', SQL.lower())

    def test_operator_query_is_parameterized_bounded_payload_free_and_attempt_exact(self):
        for parameter in ['$1::uuid', '$2::integer', '$3::integer']:
            self.assertIn(parameter, QUERY)
        self.assertIn('$3::integer between 1 and 100', QUERY)
        self.assertIn('limit 101', QUERY)
        self.assertIn('order by sequence desc limit 101', QUERY)
        self.assertIn('ordinal<=100', QUERY)
        self.assertIn('count(*)>100', QUERY)
        self.assertIn('e.job_id=a.job_id and e.attempt_id=a.attempt_id', QUERY)
        executable = '\n'.join(line for line in QUERY.splitlines() if not line.startswith('--'))
        self.assertNotRegex(executable, r'(?i)\b(?:input|result|error|receipt|event_id|lease_token|session_id|requested_by)\b')
        self.assertNotIn('select *', executable.lower())

    def test_unexecuted_fixture_exercises_duplicate_retry_rollback_and_privilege_boundaries(self):
        for label in ['no historical backfill','enqueue is not claim','same-ID duplicate',
                      'prior execution survives stage advancement','retry/unknown ref explicit','unsafe free text omitted',
                      'rolled-back claim absent','invalid claim rolled back','success/failure metadata joins exact attempts','least privilege',
                      'forced RLS and safe owner','ATTEMPT_TRACE_USER_READ_WAS_ACCEPTED',
                      'ATTEMPT_TRACE_PUBLIC_FUNCTION_WAS_ACCEPTED','ATTEMPT_TRACE_OUTSIDE_TRIGGER_INSERT_WAS_ACCEPTED']:
            self.assertIn(label, FIXTURE)
        self.assertIn('savepoint trace_claim_rollback;', FIXTURE)
        self.assertIn('rollback to savepoint trace_claim_rollback;', FIXTURE)
        self.assertNotRegex('\n'.join(line for line in FIXTURE.splitlines() if not line.startswith('--')), r'(?i)\bcommit\b')
        # Future root must execute this actual SQL; pure parsing alone proves no DB behavior.
        self.assertIn('UNEXECUTED', FIXTURE)

    def test_existing_manual_retry_stage_budget_reset_can_repeat_metadata_counter(self):
        m05 = (ROOT/'supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql').read_text(encoding='utf-8')
        m06 = (ROOT/'supabase/migrations/20261030004643_m06_credential_admission_guest_retry.sql').read_text(encoding='utf-8')
        self.assertIn("stage_attempts=case when kind=''presentation_render''then stage_attempts-stage else stage_attempts end", m05)
        self.assertIn("stage_attempts=stage_attempts-'render_export'", m06)
        self.assertNotRegex(SQL, r'unique\s*\(\s*job_id\s*,\s*stage\s*,\s*stage_attempt\s*\)')
        self.assertIn('stage_attempts=stage_attempts-stage', FIXTURE)
        self.assertIn('array_agg(stage_attempt order by attempt)=array[1,1]', FIXTURE)
        self.assertIn('manual presentation reset/reclaim preserves both attempts', FIXTURE)

if __name__ == '__main__':
    unittest.main()
