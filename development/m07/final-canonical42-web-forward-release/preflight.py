"""Two normal bounded read-only SQL observations and two Fxd metadata GETs."""
from pathlib import Path
import datetime
import importlib.util
import json
import os
import re
import sys
import uuid

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('final42_preflight_release', HERE / 'release.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
g, p = r.g, r._projection
READER = p.MAIN / 'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA = '1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'


def query_sql(c):
    # The frozen seven lifecycle predicates/protected M02 exclusion are reused
    # verbatim, rather than substituting a new interpretation of idle.
    namespace = {'__file__': str(HERE / 'preflight.py'), '__name__': 'final42_inert_idle_query', '_projection': p.previous}
    exec(compile(p.previous.project('preflight.py'), 'frozen-preflight-query', 'exec'), namespace)
    original = namespace['query_sql']()
    marker = "'projection',"
    p.need(original.count(marker) == 1 and original.endswith('rollback;') and 'read only;' in original)
    sql = original.replace(marker, "'canonical42',(" + c.state_sql() + ")," + marker, 1)
    p.need(sql.replace("'canonical42',(" + c.state_sql() + "),", '', 1) == original)
    return sql


def private_bytes(operator, file, raw):
    g.need(file.is_relative_to(operator.private) and file.resolve() == file)
    file.parent.mkdir(parents=True, exist_ok=True)
    with operator.guard.create(file) as stream:
        operator.guard.verify_open(stream)
        stream.write(raw)
        stream.flush()
        os.fsync(stream.fileno())
        operator.guard.verify_open(stream)
    operator.guard.verify(file)
    g.need(file.read_bytes() == raw)


def project_row(value, c, canonical):
    g.need(type(value) is dict and set(value) == {'database', 'operator', 'session_user', 'projection', 'canonical42'} and all(value[k] == 'postgres' for k in ('database', 'operator', 'session_user')))
    state = p.snapshot_projection(g, c, value['canonical42'], canonical)
    value = value['projection']
    g.need(type(value) is dict and set(value) == {'history', 'gates', 'native_image_id', 'english_transcript_version', 'lifecycle'})
    g.need(value['history'] == canonical['history'] and value['gates'] == dict.fromkeys(['specs', 'candidates', 'support', 'frames', 'presentations'], True) and all(type(x) is bool for x in value['gates'].values()))
    g.need(value['native_image_id'] == p.NATIVE and value['english_transcript_version'] == '1.0')
    g.need(set(value['lifecycle']) == {'queued', 'running', 'waiting_for_input', 'generic_retry_lifecycle', 'presentation_retry_lifecycle', 'pending_outbox', 'leased_outbox'} and all(type(x) is int and x == 0 for x in value['lifecycle'].values()))
    return {**value, 'canonical42': state}


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    g.need(r.RELEASE_ENABLED)
    p.ready()
    g.need(len(args) == 3)
    run, commit, manifest = args
    g.run_id(run)
    g.need(commit == p.TESTED and re.fullmatch('[a-f0-9]{64}', manifest))
    operator = r.Operator(run)
    g.need((operator.root / 'supabase/.temp/project-ref').read_text().strip() == g.TARGET)
    g.need(not any(os.environ.get(key) for key in ('SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD')))
    plan = operator.read(operator.plan)
    operator.verify(plan)
    operator.built(plan)
    g.need(plan['gates']['source_commit'] == commit and plan['gates']['source_sha256'] == manifest)
    canonical = plan['gates']['canonical']
    g.need(canonical == g.canonical(operator.root, canonical['key'], canonical['ref'], operator.guard.verify))
    c = p.context()
    g.need(g.sha(g.load(READER)) == READER_SHA)
    spec = importlib.util.spec_from_file_location('final42_existing_normal_bounded_reader', READER)
    reader = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(reader)
    sql = query_sql(c)
    directory = operator.private / ('canonical-preflight-' + str(uuid.uuid4()))
    sqlfile = directory / 'preflight.sql'
    private_bytes(operator, sqlfile, sql.encode())
    observations = []
    p.worker_anchor()
    for index in range(2):
        command = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', g.TARGET, '--file', str(sqlfile), '--output-format', 'json', '--workdir', str(operator.root)]
        code, timeout, overflow, stdout, stderr = reader.bounded(command, reader.environment())
        # Bounded transport bytes are protected BEFORE JSON/schema projection.
        raw = stdout.encode() if type(stdout) is str else stdout
        error = stderr.encode() if type(stderr) is str else stderr
        private_bytes(operator, directory / ('stdout-' + str(index) + '.json'), raw)
        if error:
            private_bytes(operator, directory / ('stderr-' + str(index) + '.txt'), error)
        operator.write(directory / ('process-' + str(index) + '.json'), {'exit_code': code, 'timed_out': timeout, 'overflow': overflow, 'stdout_sha256': g.sha(raw), 'stderr_sha256': g.sha(error)})
        g.need(code == 0 and not timeout and not overflow)
        parsed = json.loads(raw)
        rows = parsed if type(parsed) is list else parsed.get('rows') if type(parsed) is dict else None
        g.need(type(rows) is list and len(rows) == 1 and set(rows[0]) == {'review_link_reason_preflight'})
        value = project_row(rows[0]['review_link_reason_preflight'], c, canonical)
        value['worker'] = p.worker_projection(operator.api('/v13/deployments/' + p.WORKER['deployment_id'] + '?teamId=' + p.WORKER['team_id']))
        observations.append(value)
    g.need(observations[0] == observations[1] and operator.pins() == plan['source_pins'])
    observed = datetime.datetime.now(datetime.timezone.utc).isoformat()
    result = {'schema_version': '1.0', 'purpose': 'final_canonical42_web_forward_canonical_preflight', 'result': 'passed', 'run_id': run, 'source_commit': commit, 'source_manifest_sha256': manifest, 'observed_at': observed, 'target': g.TARGET, 'canonical_receipt': canonical['ref'], 'recovery_checkpoint_sha256': canonical['checkpoint']['sha256'], 'first': observations[0], 'second': observations[1], 'two_independent_readbacks_equal': True, 'cloud_mutations': False}
    folder = operator.root / 'tracking/evidence/m07' / p.NAMESPACE
    folder.mkdir(parents=True, exist_ok=True)
    file = folder / (observed.replace(':', '-') + '-' + run + '-canonical-preflight.json')
    with file.open('x', encoding='utf8', newline='\n') as handle:
        handle.write(json.dumps(result, sort_keys=True, indent=2) + '\n')
    print(json.dumps({'receipt': file.relative_to(operator.root).as_posix(), 'sha256': g.sha(g.load(file)), 'result': 'passed', 'read_only_queries': 2}))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('FINAL_CANONICAL42_WEB_PREFLIGHT_UNCONFIRMED', file=sys.stderr)
        sys.exit(1)
