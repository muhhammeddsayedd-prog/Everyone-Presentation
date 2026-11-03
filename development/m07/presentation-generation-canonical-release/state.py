"""Seven exact body targets over the accepted41 collector; no transport."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET = 'pyibofyctwnqpvktepse'
MAXIMUM = 16 * 1024**2
VERSION = '20261103104337'
MIGRATION = 'supabase/migrations/20261103104337_m07_generation_data_reuse.sql'
MIGRATION_SHA = '685010d2130a83cf4fcd8f11184b4faf1384d1ddc34436d33d458d8987744b78'
REMAINING_PROOF_REF = {'path': 'tracking/evidence/m07/presentation-generation-setup-meta-remaining-proof/2026-11-03T10-35-09.104Z-ec5bc4fe.json', 'sha256': '95d78e1c73e228427754dec10fec0dacb56d2c0c1fce39d53497e44f75740b9d'}
REMAINING_AUDIT_REF = {'path': 'tracking/evidence/m07/presentation-generation-setup-meta-remaining-proof/Root-ec5bc4fe-postrun-audit.json', 'sha256': 'd6f4c2daf70cd9f7430758121907c4c00e96d5f3ffa0cf52498361bd547c9445'}
READY = True
MIGRATION_NAME = 'm07_generation_data_reuse'
CANONICAL41_VERSION = '20261103031200'
METADATA = MAIN / '.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'
METADATA_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
PARENT = 'development/m07/logo-info-canonical-alias-release/state.py'
PARENT_SHA = '9fdb81c5816536438cf1489db3c782c02c6edec21b1bebdf84d3809a9f0a3133'
PURE_PINS = {
    'presentation-generation-data-reuse/build.py': 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd',
    'presentation-generation-data-reuse/source.py': '029c2dac690c61a7944b73633971ab037e05b8060e7c8a6cd3adbd45dd7406cb',
    'presentation-generation-data-reuse/review.py': '793c6dfa782e844d0e762ca14e79afbac587364d8c13b71baabcba4a1d3339fa',
    'presentation-generation-data-reuse/capture.py': '656123b39e84b6d880436a7e678197a707d9c7f38e34802995c0ad825a7db305',
    'presentation-generation-assignment-reuse/candidate.py': '0e62792bce8230a9b98bc11f387cf781ddf4095afaa09b37798331809d11c864',
}
# Production preimages are canonical definitions, never local comparison280.
TARGETS = (
    ('eps.presentation_lock_sources(uuid,text,text)', '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7', 'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3', 'presentation-lock-acquisition-reuse/candidate-body.sql'),
    ('eps.review_snapshot_data(uuid,uuid,text)', '4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7', '0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd', None),
    ('eps.review_snapshot(uuid,uuid,text)', 'f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb', 'c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10', None),
    ('public.eps_generate_version(uuid,jsonb,text)', 'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08', 'af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198', 'presentation-slide-insert-batch/candidate-body.sql'),
    ('eps.capture_presentation_video_transcripts(uuid)', 'ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187', 'f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5', 'presentation-raw-companion-batch/candidate-body.sql'),
    ('eps.capture_presentation_video_english_transcripts(uuid)', 'c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb', 'b763cd502ed70c49f7d9d07106397bd6c774a6c00d87322f7e0954f25f1ac4ad', 'presentation-english-companion-batch/candidate-body.sql'),
    ('eps.mcp_token_permits_capability(text)', '5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc', '8455eeb4094d74a11e487627711f237192c9b591fdf61d1b54b9114bedd487ab', 'presentation-mcp-scalar-capability/candidate-body.sql'),
)
FIXED = {
    'eps.logo_storage_read_allowed(text,text)': 'c6d72b2aded23a18ea47d6bea419163aca204293b5265ec3e08514463e1d76dd',
    'public.eps_validate_own_oauth_session(text)': '9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6',
}


def need(ok):
    if not ok:
        raise ValueError('GENERATION42_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load(file):
    file = Path(file)
    stat = file.lstat()
    need(file.is_file() and not file.is_symlink() and file.resolve() == file and stat.st_nlink == 1 and 0 < stat.st_size <= MAXIMUM)
    return file.read_bytes()


def module(name, file, expected=None):
    raw = load(file)
    if expected is not None:
        need(sha(raw) == expected)
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def json_sql(value):
    return literal(json.dumps(value, separators=(',', ':'), ensure_ascii=False)) + '::jsonb'


def digest(sql):
    return "encode(sha256(convert_to((" + sql + ")::text,'UTF8')),'hex')"


def parts(definition):
    match = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', definition, re.S)
    need(match is not None)
    return match


def manifest():
    raw = load(METADATA)
    need(sha(raw) == METADATA_SHA)
    text = raw.decode('utf8').replace('\r\n', '\n')
    for relative, expected in PURE_PINS.items():
        need(sha(load(MAIN / 'development/m07' / relative)) == expected)
    data = module('generation42_four_source', MAIN / 'development/m07/presentation-generation-data-reuse/build.py', PURE_PINS['presentation-generation-data-reuse/build.py']).build()
    assignment = module('generation42_assignment_source', MAIN / 'development/m07/presentation-generation-assignment-reuse/candidate.py', PURE_PINS['presentation-generation-assignment-reuse/candidate.py']).build()
    result = {}
    for signature, before_sha, after_sha, relative in TARGETS:
        name = signature.split('(')[0]
        matches = list(re.finditer(r'CREATE FUNCTION ' + re.escape(name) + r'\([^\n]*\) RETURNS [^\n]+\n.*? AS (\$[a-zA-Z0-9_]*\$).*?\1;', text, re.S))
        need(len(matches) == 1)
        before = matches[0][0].replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION', 1)
        match = parts(before)
        old_body = match[2]
        if relative:
            body = load(MAIN / 'development/m07' / relative).decode('utf8')
        elif name == 'eps.review_snapshot_data':
            body = parts(assignment['after'])[2]
        else:
            body = parts(next(row['after'] for row in data if row['name'] == name))[2]
        need(sha(old_body.encode()) == before_sha and sha(body.encode()) == after_sha)
        after = before[:match.start(2)] + body + before[match.end(2):]
        need(after[:match.start(2)] == before[:match.start(2)] and after.replace(body, old_body, 1) == before)
        result[signature] = {'before_sha256': before_sha, 'after_sha256': after_sha, 'before_body': old_body, 'after_body': body, 'definition': after}
    need(len(result) == 7 and not (set(result) & set(FIXED)))
    return result


class Context:
    def __init__(self, root=MAIN, source=SOURCE):
        self.root, self.source = Path(root).resolve(), Path(source).resolve()
        self.library = module('generation42_accepted_alias_state', self.root / PARENT, PARENT_SHA)
        self.current = self.library.Context(root=self.root, source=self.root)
        self.b, self.tables = self.current.b, self.current.tables
        self.history = self.current.history + [CANONICAL41_VERSION]
        need(len(self.tables) == 76 and len(self.history) == 41)
        self.targets = manifest()
        self.original_catalogue = self.current.original_catalogue

    def require_ready(self):
        need(READY and isinstance(VERSION, str) and re.fullmatch('[0-9]{14}', VERSION) and VERSION not in self.history)
        need(isinstance(MIGRATION, str) and isinstance(MIGRATION_SHA, str) and re.fullmatch('[a-f0-9]{64}', MIGRATION_SHA))
        need(type(REMAINING_PROOF_REF) is dict and set(REMAINING_PROOF_REF) == {'path', 'sha256'})
        need(type(REMAINING_AUDIT_REF) is dict and set(REMAINING_AUDIT_REF) == {'path', 'sha256'})
        migration = load(self.source / MIGRATION)
        need(sha(migration) == MIGRATION_SHA and migration.decode('utf8') == self.definitions_sql())
        return migration

    def definitions_sql(self):
        return '\n\n'.join(row['definition'] for row in self.targets.values()) + '\n'

    def normalized(self, text):
        typed_cases = ' '.join('when ' + literal(name) + '::regprocedure then ' + literal(row['before_body']) + '::text' for name, row in self.targets.items())
        typed = '(case p.oid ' + typed_cases + ' else p.prosrc end)'
        oid = "(to_jsonb(p)->>'oid')::oid"
        values = ','.join(literal(name) + '::regprocedure' for name in self.targets)
        body = '(case ' + oid + ' ' + typed_cases + " else to_jsonb(p)->>'prosrc' end)"
        row = "(case when to_jsonb(p)?'prosrc' and " + oid + ' in(' + values + ")then jsonb_set(to_jsonb(p),'{prosrc}',to_jsonb(" + body + '))else to_jsonb(p)end)'
        need(text.count('to_jsonb(p)') > 0)
        result = text.replace('p.prosrc', typed).replace('to_jsonb(p)', row)
        need(result.replace(row, 'to_jsonb(p)').replace(typed, 'p.prosrc') == text)
        return result

    def version(self):
        need(isinstance(VERSION, str) and re.fullmatch('[0-9]{14}', VERSION) and VERSION not in self.history)
        return VERSION

    def compatibility_sql(self):
        original = self.current.state_sql()
        normalized = self.normalized(original)
        count = normalized.count('from supabase_migrations.schema_migrations')
        need(count > 0)
        value = normalized.replace('from supabase_migrations.schema_migrations', 'from generation42_history41')
        need(value.replace('from generation42_history41', 'from supabase_migrations.schema_migrations') == normalized)
        return value

    def function_rows_sql(self, normalized=False):
        sql = self.current.function_rows_sql(False)
        return self.normalized(sql) if normalized else sql

    def identities_sql(self, sources):
        return 'jsonb_build_object(' + ','.join(literal(name) + ",(select jsonb_build_object('identity',to_jsonb(p)-'prosrc','source_sha256'," + digest('p.prosrc') + ')from pg_proc p where p.oid=' + literal(name) + '::regprocedure)' for name in sources) + ')'

    def state_sql(self):
        version = self.version()
        cte = 'with generation42_history41 as materialized(select * from supabase_migrations.schema_migrations where version<>' + literal(version) + ') '
        catalog = '(select catalog from(' + self.original_catalogue + ')generation_catalogue)'
        for name, row in self.targets.items():
            catalog = 'jsonb_set(' + catalog + ',array[' + literal('functions|' + name + '|source_sha256') + '],to_jsonb(' + literal(row['before_sha256']) + '::text))'
        history = "jsonb_build_object('versions',(select array_agg(version order by version)from supabase_migrations.schema_migrations),'old_rows_sha256'," + digest("(select coalesce(jsonb_agg(to_jsonb(m)order by version),'[]'::jsonb)from generation42_history41 m)") + ",'new_entry_valid',exists(select 1 from supabase_migrations.schema_migrations m where m.version=" + literal(version) + ' and to_jsonb(m)=' + json_sql({'version': version, 'statements': [], 'name': MIGRATION_NAME}) + '))'
        full = "jsonb_build_object('function_count',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public','auth','storage','extensions')),'functions_normalized_sha256'," + digest('(' + self.function_rows_sql(True) + ')') + ",'catalogue_normalized_sha256'," + digest(catalog) + ",'dependencies_sha256'," + digest("(select coalesce(jsonb_agg(to_jsonb(d)order by to_jsonb(d)::text),'[]'::jsonb)from pg_depend d)") + ",'audit_attributes_sha256'," + digest("(select coalesce(jsonb_agg(to_jsonb(a)order by attnum),'[]'::jsonb)from pg_attribute a where a.attrelid='eps.audit_events'::regclass)") + ')'
        return cte + "select jsonb_build_object('canonical41',(" + self.compatibility_sql() + "),'history'," + history + ",'targets'," + self.identities_sql(self.targets) + ",'fixed_functions'," + self.identities_sql(FIXED) + ",'full_scope'," + full + ')'

    def check(self, value, installed):
        need(type(value) is dict and set(value) == {'canonical41', 'history', 'targets', 'fixed_functions', 'full_scope'})
        self.current.check(value['canonical41'], True)
        h = value['history']
        need(set(h) == {'versions', 'old_rows_sha256', 'new_entry_valid'} and h['versions'] == self.history + ([self.version()] if installed else []) and h['new_entry_valid'] is installed and re.fullmatch('[a-f0-9]{64}', h['old_rows_sha256']))
        need(set(value['targets']) == set(self.targets) and set(value['fixed_functions']) == set(FIXED))
        for name, row in {**self.targets, **FIXED}.items():
            target = value['targets'][name] if name in self.targets else value['fixed_functions'][name]
            expected = row['after_sha256' if installed else 'before_sha256'] if name in self.targets else row
            need(set(target) == {'identity', 'source_sha256'} and target['source_sha256'] == expected and type(target['identity']) is dict and 'prosrc' not in target['identity'])
            need(all(key in target['identity'] for key in ('oid', 'proowner', 'proacl', 'prosecdef', 'provolatile', 'proconfig')))
        full = value['full_scope']
        need(set(full) == {'function_count', 'functions_normalized_sha256', 'catalogue_normalized_sha256', 'dependencies_sha256', 'audit_attributes_sha256'} and type(full['function_count']) is int and full['function_count'] > 0)
        need(all(re.fullmatch('[a-f0-9]{64}', item) for key, item in full.items() if key != 'function_count'))
        return value

    def expected(self, before):
        self.check(before, False)
        after = copy.deepcopy(before)
        after['history']['versions'].append(self.version())
        after['history']['new_entry_valid'] = True
        for name, row in self.targets.items():
            after['targets'][name]['source_sha256'] = row['after_sha256']
        return after

    def transition(self, before, after):
        self.check(after, True)
        need(after == self.expected(before))
        return {'all76_full_rows_including_reason_unchanged': True, 'all_function_metadata_OIDs_ACLs_policies_roles_dependencies_unchanged': True, 'only_exact_seven_prosrc_and_one_history_row_changed': True}

    def checkpoint_sql(self):
        prior = self.current.checkpoint_sql()
        marker = "'state',(" + self.current.state_sql() + ')'
        need(prior.count(marker) == 1)
        return prior.replace(marker, "'state',(" + self.state_sql() + ')', 1)

    def checkpoint_check(self, value, installed):
        need(type(value) is dict and set(value) == {'state', 'application_tables', 'catalogue', 'function_rows', 'history_rows'})
        self.check(value['state'], installed)
        need(set(value['application_tables']) == set(self.tables) and type(value['function_rows']) is list and len(value['function_rows']) == value['state']['full_scope']['function_count'])
        need(type(value['history_rows']) is list and len(value['history_rows']) == 41 + int(installed))
        for table, rows in value['application_tables'].items():
            current = value['state']['canonical41']['compatibility']['schema40']
            count = current['intents']['count'] if table == 'project_creation_intents' else current['canonical']['base']['trace_rows']['count'] if table == 'job_stage_attempts' else current['canonical']['base']['data'][table]['count']
            need(type(rows) is list and len(rows) == count)
        return value

    def render(self, before, marker):
        migration = self.require_ready()
        need(str(uuid.UUID(marker)) == marker)
        after = self.expected(before)
        tables = ','.join(name if name.startswith('public.') else 'eps.' + name for name in self.tables)
        prefix = "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='60s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table " + tables + ' in share mode;\n'
        prefix += "do $generation42target$begin if current_database()<>'postgres'or current_user<>'postgres'then raise exception'GENERATION42_EXACT_TARGET_REQUIRED';end if;end$generation42target$;\n"
        def assertion(expected, tag):
            return 'do $generation42$declare observed jsonb;begin ' + self.state_sql() + ' into observed;if observed is distinct from ' + json_sql(expected) + " then raise exception'" + tag + "';end if;end$generation42$;\n"
        return prefix + assertion(before, 'GENERATION42_PREIMAGE_CHANGED') + migration.decode('utf8') + "insert into supabase_migrations.schema_migrations(version,statements,name)values(" + literal(self.version()) + ',array[]::text[],' + literal(MIGRATION_NAME) + ');\n' + assertion(after, 'GENERATION42_POSTIMAGE_CHANGED') + "commit;select jsonb_build_object('version'," + literal(self.version()) + ",'marker'," + literal(marker) + ",'migration_sha256'," + literal(MIGRATION_SHA) + ')as reason40_release;'

    def source_pins(self):
        pins = self.current.source_pins()
        pins[str(METADATA)] = METADATA_SHA
        for relative, expected in PURE_PINS.items():
            file = MAIN / 'development/m07' / relative
            need(sha(load(file)) == expected)
            pins[str(file)] = expected
        for _, _, expected, relative in TARGETS:
            if relative:
                file = MAIN / 'development/m07' / relative
                need(sha(load(file)) == expected)
                pins[str(file)] = expected
        for file in sorted(HERE.iterdir()):
            if file.is_file():
                pins[str(file)] = sha(load(file))
        if MIGRATION:
            pins[str(self.source / MIGRATION)] = sha(load(self.source / MIGRATION))
        for reference in (REMAINING_PROOF_REF, REMAINING_AUDIT_REF):
            if reference:
                file = self.root / reference['path']
                need(sha(load(file)) == reference['sha256'])
                pins[str(file)] = reference['sha256']
        return dict(sorted(pins.items()))

    def admission(self):
        self.require_ready()
        relative = Path(REMAINING_PROOF_REF['path'])
        need(not relative.is_absolute() and '..' not in relative.parts)
        raw = load(self.root / relative)
        need(sha(raw) == REMAINING_PROOF_REF['sha256'])
        proof = json.loads(raw)
        audit_path = Path(REMAINING_AUDIT_REF['path'])
        need(not audit_path.is_absolute() and '..' not in audit_path.parts)
        audit_raw = load(self.root / audit_path)
        need(sha(audit_raw) == REMAINING_AUDIT_REF['sha256'])
        audit = json.loads(audit_raw)
        need(proof['result'] == 'passed' and proof['cloud_called'] is False and proof['provider_called'] is False)
        need(all(proof[key] is True for key in ('all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released')))
        g = proof['combined_generation']
        need(g['matching_graph_whole_generation_and_data_equalities_complete_with_dated48ed_prefix'] is True and g['original4107_and_all_six_old_bodies_restored'] is True)
        self.helper_records(proof, audit)
        need(proof['remaining_scope_continuation']['references']['raw']['sha256'] == '599527b663a20a5a4e1e66c34a89c41078ca5b87c0998f96f89c546bbc48e721')
        need(all(proof['raw_authority_cases'][variant]['completed'] is True for variant in ('old', 'candidate')) and proof['pin_batch_cases']['candidate']['completed'] is True)
        installs = proof['data_reuse_body_installations']
        need(installs and all(item['normal_return'] is True and item['public_validator_unchanged'] is True for item in installs))
        names = {signature.split('(')[0]: row for signature, row in self.targets.items() if not signature.startswith('eps.presentation_lock_sources(')}
        candidate_seen = False
        for item in installs:
            expected = {row['name']: row['source'] for row in item['expected']}
            need(set(expected) == set(names))
            candidate_seen |= all(expected[name] == row['after_sha256'] for name, row in names.items())
            for name, source in expected.items():
                need(source in (names[name]['before_sha256'], names[name]['after_sha256']) and item['actual'][name]['source'] == source)
                need(item['actual'][name]['authority'] == installs[0]['actual'][name]['authority'])
            need(item['actual']['public.eps_validate_own_oauth_session'] == installs[0]['actual']['public.eps_validate_own_oauth_session'])
        need(candidate_seen and all(installs[-1]['actual'][name]['source'] == row['before_sha256'] for name, row in names.items()))
        return {'target': TARGET, 'version': VERSION, 'migration_sha256': MIGRATION_SHA, 'local_proof': REMAINING_PROOF_REF, 'local_proof_postrun_audit': REMAINING_AUDIT_REF, 'full_reason_preservation': True, 'production_acceptance_claimed': False}

    def helper_records(self, proof, audit):
        helper = self.targets['eps.presentation_lock_sources(uuid,text,text)']
        records = proof['combined_generation']['helper_installations']
        need(records == [
            {'variant': 'old', 'source_sha256': '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4', 'authority_unchanged': True},
            {'variant': 'candidate', 'source_sha256': helper['after_sha256'], 'authority_unchanged': True},
        ])
        need(helper['before_sha256'] == '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7')
        need(proof['combined_generation']['original4107_and_all_six_old_bodies_restored'] is True)
        need(proof['combined_generation']['full_data_reason_Ready_catalogue_authority_preserved'] is True)
        need(audit['actual_receipt'] == REMAINING_PROOF_REF and audit['run_id'] == proof['run_id'] and audit['normal_process_exit'] == 0)
        need(audit['runtime_source_seals_verified'] == len(proof['source_seals']))
        need(all(audit[key] is True for key in (
            'actual_and_private_executed_source_hashes_equal',
            'helper_old280_candidateAA_full_installation_records_verified',
            'final_original4107_and_six_source_config_full_clone_restoration_completed',
            'independent_successful_daemon_label_inventories_empty', 'fresh_shared_lock_absent', 'original_target_preserved')))
        return True
