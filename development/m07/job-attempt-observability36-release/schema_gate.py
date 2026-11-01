"""Read-only, closed metadata admission for the frozen attempt-trace candidate.

No connection, environment, process, configuration or mutation is performed here.
The atomic SQL gate requires a separately pinned, locally observed template that
has already passed the semantic checker. Catalogue OID joins remain internal.
"""
import copy
import hashlib
import json
import re
from pathlib import Path

import pglast
from pglast import ast, parse_sql

ROOT = Path(__file__).resolve().parents[3]
CANDIDATE = ROOT / 'development/m07/job-attempt-observability36/candidate.sql'
CANDIDATE_SHA256 = 'dc4eec586a3ae0fc9722a70ca6229742971eb21279916c32ab47cea4a802ed3b'
EXPECTED_FUNCTION_SHA256 = 'a1de1739a8c0005e5b8a09e2e87bfb1094c38839631a813f06635e339afb9228'
ROLE = 'eps_job_trace_owner'
TABLE = 'eps.job_stage_attempts'
FUNCTION = 'eps.capture_job_stage_attempt'
PROOF_EXPECTED_EXPR = "current_setting('eps.attempt36_schema_gate.expected',true)::jsonb"
PROOF_MARKER_EXPR = "current_setting('eps.attempt36_schema_gate.mode',true)='owned-local-rollback-v1'"
COLS = [('schema_version', 'text'), ('job_id', 'uuid'), ('attempt_id', 'uuid'),
        ('kind', 'text'), ('stage', 'text'), ('attempt', 'int4'), ('stage_attempt', 'int4'),
        ('dispatch_generation', 'int8'), ('correlation_id', 'text'), ('input_hash', 'text'),
        ('workflow_execution_id', 'text'), ('workflow_execution_ref_state', 'text'),
        ('claimed_at', 'timestamptz'), ('job_row_version', 'int8')]
EMPTY_SCHEMA = {'table': None, 'columns': [], 'constraints': [], 'indexes': [],
                'policies': [], 'function': None, 'function_name_count': 0,
                'triggers': [], 'role': None, 'memberships': [], 'schema_acl': [],
                'table_acl': [], 'column_acl': [], 'function_acl': [], 'database_acl': [],
                'role_settings': [], 'owned_objects': [], 'inbound_foreign_keys': []}


def need(value):
    if not value:
        raise ValueError('ATTEMPT36_SCHEMA_UNCONFIRMED')


def _source():
    need(pglast.__version__ == 'v7.21')
    raw = CANDIDATE.read_bytes()
    need(hashlib.sha256(raw).hexdigest() == CANDIDATE_SHA256)
    return raw.decode('utf-8')


def _normal(node):
    """Only PostgreSQL's literal casts and IN->ANY cooking are equivalent here."""
    if isinstance(node, (tuple, list)):
        return [_normal(item) for item in node]
    if not isinstance(node, dict):
        return node
    tag = node.get('@')
    if tag == 'A_Expr' and node['kind']['name'] == 'AEXPR_BETWEEN':
        lower, upper = node['rexpr']
        def comparison(operator, right):
            return {'@': 'A_Expr', 'kind': {'#': 'A_Expr_Kind', 'name': 'AEXPR_OP', 'value': 0},
                    'name': ({'@': 'String', 'sval': operator},), 'lexpr': node['lexpr'], 'rexpr': right}
        return _normal({'@': 'BoolExpr', 'boolop': {'#': 'BoolExprType', 'name': 'AND_EXPR', 'value': 0},
                        'args': (comparison('>=', lower), comparison('<=', upper))})
    if tag == 'TypeCast':
        names = [v['sval'] for v in node['typeName']['names']]
        if names[:1] == ['pg_catalog']:
            names = names[1:]
        arg = node['arg']
        if arg.get('@') == 'A_Const' and not arg.get('isnull'):
            val = arg['val']
            if names == ['text'] and val.get('@') == 'String':
                return _normal(arg)
            if names in [['int4'], ['int8'], ['integer'], ['bigint']]:
                number = val.get('sval', val.get('fval', val.get('ival')))
                if re.fullmatch(r'-?[0-9]+', str(number)):
                    return {'@': 'A_Const', 'isnull': False,
                            'val': {'@': 'Integer', 'ival': int(number)}}
    if tag == 'A_Const' and node.get('val', {}).get('@') == 'Float':
        number = node['val']['fval']
        if re.fullmatch(r'-?[0-9]+', number):
            return {'@': 'A_Const', 'isnull': False,
                    'val': {'@': 'Integer', 'ival': int(number)}}
    if tag == 'A_Expr' and node['kind']['name'] in ('AEXPR_IN', 'AEXPR_OP_ANY'):
        if node['name'] == ({'@': 'String', 'sval': '='},):
            values = node['rexpr']
            if node['kind']['name'] == 'AEXPR_OP_ANY':
                if not isinstance(values, dict) or values.get('@') != 'A_ArrayExpr':
                    return {k: _normal(v) for k, v in node.items() if k != 'location'}
                values = values['elements']
            return {'@': 'literal_membership', 'left': _normal(node['lexpr']),
                    'values': _normal(values)}
    out = {k: _normal(v) for k, v in node.items() if k != 'location'}
    if tag == 'FuncCall' and out.get('funcname', [])[:1] == [{'@': 'String', 'sval': 'pg_catalog'}]:
        out['funcname'] = out['funcname'][1:]
    return out


def expression(value):
    need(type(value) is str and len(value) <= 12000)
    try:
        parsed = parse_sql('select (' + value + ')')
        need(len(parsed) == 1 and isinstance(parsed[0].stmt, ast.SelectStmt))
        statement = parsed[0].stmt
        need(len(statement.targetList) == 1 and statement.fromClause is None
             and statement.whereClause is None and statement.sortClause is None
             and statement.limitCount is None and statement.withClause is None)
        return _normal(statement.targetList[0].val())
    except Exception:
        raise ValueError('ATTEMPT36_SCHEMA_UNCONFIRMED') from None


def _checks():
    create = next(row.stmt for row in parse_sql(_source()) if isinstance(row.stmt, ast.CreateStmt))
    checks = []
    for item in create.tableElts:
        values = item.constraints or () if isinstance(item, ast.ColumnDef) else (item,)
        for constraint in values:
            if isinstance(constraint, ast.Constraint) and constraint.contype.name == 'CONSTR_CHECK':
                checks.append(_normal(constraint.raw_expr()))
    need(len(checks) == 12)
    return checks


def _check_identity():
    """PG17 heap.c names checks by one distinct referenced column, else table."""
    out = {}
    def refs(value):
        if isinstance(value, list):
            return set().union(*(refs(item) for item in value))
        if isinstance(value, dict):
            if value.get('@') == 'ColumnRef':
                return {value['fields'][-1]['sval']}
            return set().union(*(refs(item) for item in value.values()))
        return set()
    for check in _checks():
        columns = refs(check)
        base = 'job_stage_attempts_' + (next(iter(columns)) + '_' if len(columns) == 1 else '') + 'check'
        name = base
        counter = 0
        while name in out:
            counter += 1
            name = base + str(counter)
        out[name] = (check, columns)
    return out


def membership_variants():
    explicit = {'role': ROLE, 'member': 'postgres', 'grantor': 'postgres',
                'admin': False, 'inherit': True, 'set': True}
    bootstrap = {'role': ROLE, 'member': 'postgres', 'grantor': 'supabase_admin',
                 'admin': True, 'inherit': False, 'set': False}
    return [[explicit], [explicit, bootstrap]]


def check_schema_before(value):
    _source()
    need(type(value) is dict and value == EMPTY_SCHEMA)


def check_schema_after(value, trigger_enabled='O'):
    _source()
    need(trigger_enabled in ('O', 'D') and type(value) is dict
         and set(value) == set(EMPTY_SCHEMA))
    need(value['table'] == {'schema': 'eps', 'name': 'job_stage_attempts', 'owner': 'postgres',
         'kind': 'r', 'persistence': 'p', 'rls': True, 'force_rls': True,
         'partition': False, 'options': None, 'nonowner_acl': []})
    expected_columns = [{'name': name, 'number': i, 'type_schema': 'pg_catalog', 'type': typ,
                         'not_null': name != 'workflow_execution_id', 'identity': '', 'generated': '',
                         'collation': 'pg_catalog.default' if typ == 'text' else None,
                         'default': "'1.0'::text" if i == 1 else None}
                        for i, (name, typ) in enumerate(COLS, 1)]
    columns = copy.deepcopy(value['columns'])
    need(type(columns) is list and len(columns) == 14)
    need(expression(columns[0]['default']) == expression("'1.0'"))
    columns[0]['default'] = expected_columns[0]['default']
    need(columns == expected_columns)
    constraints = value['constraints']
    need(type(constraints) is list and len(constraints) == 15)
    checks = {}
    expected_checks = _check_identity()
    other = {}
    for row in constraints:
        need(type(row) is dict and set(row) == {'name', 'kind', 'columns', 'expr', 'reference',
             'reference_columns', 'update', 'delete', 'match', 'deferrable', 'deferred', 'validated', 'no_inherit'})
        need(row['deferrable'] is False and row['deferred'] is False and row['validated'] is True)
        if row['kind'] == 'c':
            need(row['no_inherit'] is False and row['reference'] is None
                 and row['reference_columns'] == [] and row['update'] is None
                 and row['delete'] is None and row['match'] is None)
            need(row['name'] in expected_checks and row['name'] not in checks)
            check, columns = expected_checks[row['name']]
            need(type(row['columns']) is list and len(row['columns']) == len(columns)
                 and set(row['columns']) == columns and expression(row['expr']) == check)
            checks[row['name']] = check
        else:
            need(row['kind'] in ('p', 'u', 'f') and row['kind'] not in other
                 and row['expr'] is None and row['no_inherit'] is None)
            other[row['kind']] = row
    need(set(checks) == set(expected_checks))
    need(len({row['name'] for row in constraints}) == 15)
    for kind, name, cols in [('p', 'job_stage_attempts_pkey', ['job_id', 'attempt_id']),
                             ('u', 'job_stage_attempts_job_id_attempt_key', ['job_id', 'attempt']),
                             ('f', 'job_stage_attempts_job_id_fkey', ['job_id'])]:
        row = other[kind]
        need(row['name'] == name and row['columns'] == cols)
        need(row['reference'] == ('eps.jobs' if kind == 'f' else None)
             and row['reference_columns'] == (['id'] if kind == 'f' else []))
        need((row['update'], row['delete'], row['match']) == (('a', 'r', 's') if kind == 'f' else (None, None, None)))
    indexes = []
    for name, cols, classes, primary in [('job_stage_attempts_job_id_attempt_key', ['job_id', 'attempt'], ['uuid_ops', 'int4_ops'], False),
                                          ('job_stage_attempts_pkey', ['job_id', 'attempt_id'], ['uuid_ops', 'uuid_ops'], True)]:
        indexes.append({'name': name, 'owner': 'postgres', 'method': 'btree', 'columns': cols,
                        'opclasses': ['pg_catalog.' + item for item in classes], 'options': [0, 0],
                        'unique': True, 'primary': primary, 'valid': True, 'ready': True,
                        'exclusion': False, 'nulls_not_distinct': False, 'attributes': 2, 'keys': 2,
                        'predicate': None, 'expressions': None})
    need(value['indexes'] == indexes)
    policies = value['policies']
    need(type(policies) is list and len(policies) == 1)
    policy = copy.deepcopy(policies[0]);need(expression(policy.pop('check')) == expression('pg_catalog.pg_trigger_depth()>0'))
    need(policy == {'name': 'job_stage_attempts_capture', 'command': 'a', 'permissive': True,
                    'roles': [ROLE], 'using': None})
    need(value['function_name_count'] == 1)
    need(value['function'] == {'schema': 'eps', 'name': 'capture_job_stage_attempt', 'owner': ROLE,
         'language': 'plpgsql', 'kind': 'f', 'security_definer': True, 'volatility': 'v',
         'strict': False, 'leakproof': False, 'parallel': 'u', 'returns_set': False,
         'result': 'pg_catalog.trigger', 'arguments': 0, 'argument_defaults': 0,
         'config': ['search_path=""'], 'source_sha256': EXPECTED_FUNCTION_SHA256, 'nonowner_acl': []})
    expected_triggers = [('eps.jobs', 'capture_job_stage_attempt', FUNCTION, 17, False, None, None),
                         ('eps.jobs', 'RI_ConstraintTrigger_a_<oid>', 'pg_catalog.RI_FKey_noaction_upd', 17, True, TABLE, 'job_stage_attempts_job_id_fkey'),
                         ('eps.jobs', 'RI_ConstraintTrigger_a_<oid>', 'pg_catalog.RI_FKey_restrict_del', 9, True, TABLE, 'job_stage_attempts_job_id_fkey'),
                         (TABLE, 'RI_ConstraintTrigger_c_<oid>', 'pg_catalog.RI_FKey_check_ins', 5, True, 'eps.jobs', 'job_stage_attempts_job_id_fkey'),
                         (TABLE, 'RI_ConstraintTrigger_c_<oid>', 'pg_catalog.RI_FKey_check_upd', 17, True, 'eps.jobs', 'job_stage_attempts_job_id_fkey')]
    triggers = value['triggers'];need(type(triggers) is list and len(triggers) == 5)
    actual = []
    for row in triggers:
        need(type(row) is dict and set(row) == {'table', 'name', 'function', 'type', 'internal', 'reference',
             'constraint', 'enabled', 'deferrable', 'deferred', 'columns', 'args_bytes', 'old_table', 'new_table',
             'name_matches_oid', 'definition', 'constraint_index_table', 'constraint_index_columns'})
        internal = row['internal']
        need(type(internal) is bool and row['enabled'] == ('O' if internal else trigger_enabled)
             and row['deferrable'] is False and row['deferred'] is False and row['args_bytes'] == 0
             and row['old_table'] is None and row['new_table'] is None and row['name_matches_oid'] is True)
        need(row['columns'] == ([] if internal else ['current_attempt_id']))
        need(row['constraint_index_table'] == ('eps.jobs' if internal else None)
             and row['constraint_index_columns'] == (['id'] if internal else []))
        if internal:
            need(row['definition'] is None)
        else:
            try:
                parsed = parse_sql(row['definition']);need(len(parsed) == 1 and isinstance(parsed[0].stmt, ast.CreateTrigStmt))
                trigger = parsed[0].stmt
                need(_normal(trigger.whenClause()) == expression('new.current_attempt_id is not null and new.current_attempt_id is distinct from old.current_attempt_id'))
            except Exception:
                raise ValueError('ATTEMPT36_SCHEMA_UNCONFIRMED') from None
        actual.append(tuple(row[key] for key in ['table', 'name', 'function', 'type', 'internal', 'reference', 'constraint']))
    need(sorted(actual, key=repr) == sorted(expected_triggers, key=repr))
    need(value['role'] == {'name': ROLE, 'superuser': False, 'inherit': False, 'create_role': False,
         'create_db': False, 'login': False, 'replication': False, 'bypass_rls': False,
         'connection_limit': -1, 'valid_until': None, 'config': None})
    need(value['memberships'] in membership_variants())
    need(value['schema_acl'] == [{'object': 'eps', 'privilege': 'USAGE', 'grantor': 'postgres', 'grantable': False}])
    need(value['column_acl'] == [{'object': TABLE, 'column': name, 'privilege': 'INSERT', 'grantor': 'postgres', 'grantable': False}
                                  for name, _ in sorted(COLS)])
    for key in ['table_acl', 'function_acl', 'database_acl', 'role_settings', 'inbound_foreign_keys']:
        need(value[key] == [])
    need(value['owned_objects'] == [{'kind': 'function', 'object': FUNCTION + '()'}])


def _literal(value):
    return "'" + json.dumps(value, sort_keys=True, separators=(',', ':')).replace("'", "''") + "'::jsonb"


def _comparison_sql(expected_expression):
    variants = ','.join(_literal(value) for value in membership_variants())
    return "(select (actual.value-'memberships')=(expected.value-'memberships') and actual.value->'memberships' in(" + variants + ') from(' + new_schema_sql() + ') actual(value) cross join (select ' + expected_expression + ' as value)expected)'


def gate_sql(expected_validated_metadata, trigger_enabled='O'):
    """Atomic gate against a pinned actual local template; no execution occurs."""
    need(trigger_enabled in ('O', 'D'))
    expected = copy.deepcopy(expected_validated_metadata)
    user = [row for row in expected['triggers'] if not row['internal']]
    need(len(user) == 1 and user[0]['enabled'] in ('O', 'D'))
    check_schema_after(expected, user[0]['enabled'])
    user[0]['enabled'] = trigger_enabled
    check_schema_after(expected, trigger_enabled)
    expected.pop('memberships')
    return _comparison_sql(_literal(expected))


def gate_sql_from_expression(fixed_expression, trigger_enabled='O'):
    """Owned-rollback proof seam only; production must use admitted gate_sql.

    The one exact GUC expression/marker are intentional. This is not a general
    SQL/template input. Root's protected proof validates its actual normal
    metadata with check_schema_after after SQL returns, and rolls back all DDL.
    """
    need(type(fixed_expression) is str and fixed_expression == PROOF_EXPECTED_EXPR
         and trigger_enabled in ('O', 'D'))
    enabled = _literal(trigger_enabled)
    adjusted = """(select jsonb_set(template,'{triggers}',
      (select coalesce(jsonb_agg(case when item->>'table'='eps.jobs'
       and item->>'name'='capture_job_stage_attempt'and item->'internal'='false'::jsonb
       then jsonb_set(item,'{enabled}',""" + enabled + """,false)else item end order by ord),'[]'::jsonb)
       from jsonb_array_elements(template->'triggers')with ordinality entries(item,ord)),false)
      from(select """ + fixed_expression + " as template)proof_template)"
    return '(' + PROOF_MARKER_EXPR + ' and ' + _comparison_sql(adjusted) + ')'


def new_schema_sql():
    """One read-only SELECT, safe before every new object is absent. No row data."""
    _source()
    acl = "jsonb_build_object('object',object,'privilege',privilege_type,'grantor',pg_get_userbyid(grantor),'grantable',is_grantable)"
    return r"""with ids as(select to_regclass('eps.job_stage_attempts') as tab,to_regclass('eps.jobs') as jobs,
 (select oid from pg_roles where rolname='eps_job_trace_owner') as role,
 to_regprocedure('eps.capture_job_stage_attempt()') as fn),
 acl_rows as(
 select 'schema' kind,n.nspname::text object,null::text col,a.* from pg_namespace n cross join lateral aclexplode(n.nspacl)a,ids where a.grantee=ids.role
 union all select 'table',n.nspname||'.'||c.relname,null,a.* from pg_class c join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(c.relacl)a,ids where a.grantee=ids.role
 union all select 'column',n.nspname||'.'||c.relname,at.attname,a.* from pg_attribute at join pg_class c on c.oid=at.attrelid join pg_namespace n on n.oid=c.relnamespace cross join lateral aclexplode(at.attacl)a,ids where a.grantee=ids.role
 union all select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',null,a.* from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl)a,ids where a.grantee=ids.role and p.proowner<>ids.role
 union all select 'database',d.datname,null,a.* from pg_database d cross join lateral aclexplode(d.datacl)a,ids where a.grantee=ids.role),
 trace_constraints as(select c.* from pg_constraint c,ids where c.conrelid=ids.tab),
 trace_triggers as(select t.* from pg_trigger t,ids where t.tgrelid=ids.tab or(t.tgrelid=ids.jobs and t.tgname='capture_job_stage_attempt')or t.tgfoid=ids.fn or t.tgconstraint in(select oid from trace_constraints where contype='f'))
 select jsonb_build_object(
 'table',(select jsonb_build_object('schema',n.nspname,'name',c.relname,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'partition',c.relispartition,'options',c.reloptions,'nonowner_acl',coalesce((select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(a.grantee),'privilege',a.privilege_type,'grantable',a.is_grantable)order by a.grantee,a.privilege_type)from aclexplode(c.relacl)a where a.grantee<>c.relowner),'[]'::jsonb))from pg_class c join pg_namespace n on n.oid=c.relnamespace,ids where c.oid=ids.tab),
 'columns',coalesce((select jsonb_agg(jsonb_build_object('name',a.attname,'number',a.attnum,'type_schema',n.nspname,'type',t.typname,'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'collation',case when a.attcollation<>0 then(select ns.nspname||'.'||co.collname from pg_collation co join pg_namespace ns on ns.oid=co.collnamespace where co.oid=a.attcollation)end,'default',pg_get_expr(d.adbin,d.adrelid))order by a.attnum)from pg_attribute a join pg_type t on t.oid=a.atttypid join pg_namespace n on n.oid=t.typnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum,ids where a.attrelid=ids.tab and a.attnum>0 and not a.attisdropped),'[]'::jsonb),
 'constraints',coalesce((select jsonb_agg(jsonb_build_object('name',c.conname,'kind',c.contype,'columns',coalesce((select jsonb_agg(a.attname order by ord)from unnest(c.conkey)with ordinality k(num,ord)join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.num),'[]'::jsonb),'expr',pg_get_expr(c.conbin,c.conrelid),'reference',case when c.contype='f'then c.confrelid::regclass::text end,'reference_columns',coalesce((select jsonb_agg(a.attname order by ord)from unnest(c.confkey)with ordinality k(num,ord)join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.num),'[]'::jsonb),'update',case when c.contype='f'then c.confupdtype end,'delete',case when c.contype='f'then c.confdeltype end,'match',case when c.contype='f'then c.confmatchtype end,'deferrable',c.condeferrable,'deferred',c.condeferred,'validated',c.convalidated,'no_inherit',case when c.contype='c'then c.connoinherit end)order by c.conname)from trace_constraints c),'[]'::jsonb),
 'indexes',coalesce((select jsonb_agg(jsonb_build_object('name',c.relname,'owner',pg_get_userbyid(c.relowner),'method',am.amname,'columns',(select jsonb_agg(a.attname order by ord)from unnest(i.indkey)with ordinality k(num,ord)join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.num),'opclasses',(select jsonb_agg(n.nspname||'.'||o.opcname order by ord)from unnest(i.indclass)with ordinality k(num,ord)join pg_opclass o on o.oid=k.num join pg_namespace n on n.oid=o.opcnamespace),'options',to_jsonb(i.indoption::smallint[]),'unique',i.indisunique,'primary',i.indisprimary,'valid',i.indisvalid,'ready',i.indisready,'exclusion',i.indisexclusion,'nulls_not_distinct',i.indnullsnotdistinct,'attributes',i.indnatts,'keys',i.indnkeyatts,'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid))order by c.relname)from pg_index i join pg_class c on c.oid=i.indexrelid join pg_am am on am.oid=c.relam,ids where i.indrelid=ids.tab),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(select jsonb_agg(pg_get_userbyid(v)order by pg_get_userbyid(v))from unnest(p.polroles)v),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polname)from pg_policy p,ids where p.polrelid=ids.tab),'[]'::jsonb),
 'function_name_count',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.proname='capture_job_stage_attempt'),
 'function',(select jsonb_build_object('schema',n.nspname,'name',p.proname,'owner',pg_get_userbyid(p.proowner),'language',l.lanname,'kind',p.prokind,'security_definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'returns_set',p.proretset,'result',tn.nspname||'.'||ty.typname,'arguments',p.pronargs,'argument_defaults',p.pronargdefaults,'config',p.proconfig,'source_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'nonowner_acl',coalesce((select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(a.grantee),'privilege',a.privilege_type,'grantable',a.is_grantable)order by a.grantee,a.privilege_type)from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a where a.grantee<>p.proowner),'[]'::jsonb))from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang join pg_type ty on ty.oid=p.prorettype join pg_namespace tn on tn.oid=ty.typnamespace,ids where p.oid=ids.fn),
 'triggers',coalesce((select jsonb_agg(jsonb_build_object('table',t.tgrelid::regclass::text,'name',case when t.tgisinternal then regexp_replace(t.tgname,'[0-9]+$','<oid>')else t.tgname end,'function',n.nspname||'.'||p.proname,'type',t.tgtype,'internal',t.tgisinternal,'reference',case when t.tgconstrrelid<>0 then t.tgconstrrelid::regclass::text end,'constraint',(select conname from pg_constraint where oid=t.tgconstraint),'enabled',t.tgenabled,'deferrable',t.tgdeferrable,'deferred',t.tginitdeferred,'columns',coalesce((select jsonb_agg(a.attname order by ord)from unnest(t.tgattr)with ordinality k(num,ord)join pg_attribute a on a.attrelid=t.tgrelid and a.attnum=k.num),'[]'::jsonb),'args_bytes',octet_length(t.tgargs),'old_table',t.tgoldtable,'new_table',t.tgnewtable,'name_matches_oid',not t.tgisinternal or t.tgname like '%_'||t.oid::text,'definition',case when not t.tgisinternal then pg_get_triggerdef(t.oid,true)end,'constraint_index_table',(select i.indrelid::regclass::text from pg_index i where i.indexrelid=t.tgconstrindid),'constraint_index_columns',coalesce((select jsonb_agg(a.attname order by ord)from pg_index i cross join lateral unnest(i.indkey)with ordinality k(num,ord)join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.num where i.indexrelid=t.tgconstrindid),'[]'::jsonb))order by t.tgrelid::regclass::text,n.nspname,p.proname)from trace_triggers t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace),'[]'::jsonb),
 'role',(select jsonb_build_object('name',r.rolname,'superuser',r.rolsuper,'inherit',r.rolinherit,'create_role',r.rolcreaterole,'create_db',r.rolcreatedb,'login',r.rolcanlogin,'replication',r.rolreplication,'bypass_rls',r.rolbypassrls,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,'config',r.rolconfig)from pg_roles r,ids where r.oid=ids.role),
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('role',pg_get_userbyid(m.roleid),'member',pg_get_userbyid(m.member),'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)order by pg_get_userbyid(m.grantor))from pg_auth_members m,ids where m.roleid=ids.role or m.member=ids.role or m.grantor=ids.role),'[]'::jsonb),
 'role_settings',coalesce((select jsonb_agg(jsonb_build_object('database',s.setdatabase,'config',s.setconfig)order by s.setdatabase)from pg_db_role_setting s,ids where s.setrole=ids.role),'[]'::jsonb),
 'owned_objects',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'object',object)order by kind,object)from(
 select 'function'kind,n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')'object from pg_proc p join pg_namespace n on n.oid=p.pronamespace,ids where p.proowner=ids.role
 union all select 'relation',n.nspname||'.'||c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace,ids where c.relowner=ids.role
 union all select 'schema',n.nspname from pg_namespace n,ids where n.nspowner=ids.role
 union all select 'database',d.datname from pg_database d,ids where d.datdba=ids.role
 union all select 'type',n.nspname||'.'||t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace,ids where t.typowner=ids.role)owned),'[]'::jsonb),
 'inbound_foreign_keys',coalesce((select jsonb_agg(c.conname order by c.conname)from pg_constraint c,ids where c.confrelid=ids.tab),'[]'::jsonb),
 __ACL_FIELDS__)
""".replace('__ACL_FIELDS__', ',\n'.join(
        "'" + kind + "_acl',coalesce((select jsonb_agg(" +
        (acl if kind != 'column' else acl[:-1] + ",'column',col)") +
        "order by object,col,privilege_type,grantor)from acl_rows where kind='" + kind + "'),'[]'::jsonb)"
        for kind in ['schema', 'table', 'column', 'function', 'database']))
