"""Production worker rollout for template 1.2.0 (native + daemon). Importing is inert.

Follows the established worker rollout (development/m07/completion-worker-rollout39):
pause the five processing configurations with every queue/retry/outbox counter at
zero (the one protected M02 job excepted), patch the three public seal hashes, deploy
the prebuilt daemon, require a ready instance, pin future frame work to the new
native image, resume. Each action writes evidence to tracking/evidence/m08/worker-release.

  python worker_rollout.py state                read-only DB + project/env/deployment state
  python worker_rollout.py pause|resume         one SQL transaction (flags only)
  python worker_rollout.py env                  PATCH the three seal hashes (value-only)
  python worker_rollout.py deploy               vercel deploy --prebuilt --prod (no wait)
  python worker_rollout.py ready                daemon inspect: new deployment ready, old absent
  python worker_rollout.py pin                  frame_extraction_config.native_image_id only

Inputs: .local/editorial-release/worker/plan.json (run, digests, hashes, output dir),
written by the local build steps. No secret is read, printed or stored.
"""
import datetime
import json
import re
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TARGET = 'pyibofyctwnqpvktepse'
TEAM = 'team_gboXPxTevpCOZuaA8eY9PmR1'
SLUG = 'muhammed-abdelrahman'
PROJECT = 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6'
GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
PROTECTED_JOB = 'b3f90268-147d-41d4-8875-2a6435df1496'
CONFIGS = ['candidate_asset_config', 'frame_extraction_config', 'presentation_processing_config', 'review_processing_config', 'specs_pipeline_config']
ENV_KEYS = ['EPS_DAEMON_SOURCE_SHA256', 'EPS_NATIVE_COMPATIBILITY_SHA256', 'EPS_NATIVE_MANIFEST_SHA256']
PLAN = ROOT / '.local/editorial-release/worker/plan.json'
EVIDENCE = ROOT / 'tracking/evidence/m08/worker-release'
WORK = ROOT / '.local/editorial-release/worker'
SUPABASE = ['npx.cmd', '--yes', 'supabase@2.122.0', 'db', 'query', '--linked', '--project-ref', TARGET, '--output-format', 'json', '--workdir', str(ROOT)]
VERCEL = ['node', 'C:/Users/iway/AppData/Roaming/npm/node_modules/vercel/dist/vc.js', '--scope', SLUG, '--global-config', GLOBAL]

ORDINARY_RETRY = ("kind not in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null "
                  "and coalesce((error->>'retryable')::boolean,false)and coalesce((stage_attempts->>stage)::integer,0)<3")
PRESENTATION_RETRY = "kind in('presentation_render','presentation_export')and status='failed'and cancel_requested_at is null and error->>'code'is distinct from'JOB_CANCELLED'"
STATE = ("select jsonb_build_object('history',(select count(*)from supabase_migrations.schema_migrations),"
         "'config',jsonb_build_object(" + ','.join(f"'{t}',(select jsonb_build_object('enabled',enabled{',' + chr(39) + 'native_image_id' + chr(39) + ',native_image_id' if t == 'frame_extraction_config' else ''})from eps.{t})" for t in CONFIGS) + "),"
         "'counters',jsonb_build_object("
         + ','.join(f"'{s}',(select count(*)from eps.jobs where id<>'{PROTECTED_JOB}'and status='{s}')" for s in ('queued', 'running', 'waiting_for_input'))
         + f",'generic_retry',(select count(*)from eps.jobs where id<>'{PROTECTED_JOB}'and {ORDINARY_RETRY})"
         + f",'presentation_retry',(select count(*)from eps.jobs where id<>'{PROTECTED_JOB}'and {PRESENTATION_RETRY})"
         + ",'pending_outbox',(select count(*)from eps.outbox_events where status='pending'),'leased_outbox',(select count(*)from eps.outbox_events where status='leased')),"
         + "'versions',(select encode(sha256(convert_to(coalesce(string_agg(id::text||':'||snapshot_sha256||':'||status,','order by id),''),'UTF8')),'hex')from eps.presentation_versions))")


def need(value, code='WORKER_ROLLOUT_UNCONFIRMED'):
    if not value:
        raise SystemExit(code)


def run(args, timeout=180):
    done = subprocess.run(args, capture_output=True, timeout=timeout)
    if done.returncode:
        raise SystemExit(f'command failed ({args[0]} {args[1] if len(args) > 1 else ""}): ' + done.stderr.decode('utf-8', 'replace')[-800:])
    return done.stdout.decode('utf-8')


def sql(text, label):
    WORK.mkdir(parents=True, exist_ok=True)
    path = WORK / f'{label}-{uuid.uuid4()}.sql'
    path.write_bytes(text.encode('utf-8'))
    data = json.loads(run(SUPABASE + ['--file', str(path)]))
    return data[0] if isinstance(data, list) else data['rows'][0]


def db_state():
    row = sql(f"begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='30s';\n{STATE} as state;\nrollback;\n", 'state')
    value = row['state']
    return json.loads(value) if isinstance(value, str) else value


def api(endpoint, method='GET', body=None):
    args = VERCEL + ['api', endpoint, '--method', method, '--raw']
    if body is not None:
        args += ['--input', '-']
        done = subprocess.run(args, input=json.dumps(body).encode(), capture_output=True, timeout=120)
        need(done.returncode == 0, 'VERCEL_API_FAILED')
        return json.loads(done.stdout.decode('utf-8'))
    return json.loads(run(args))


def env_rows():
    rows = api(f'/v10/projects/{PROJECT}/env?teamId={TEAM}&decrypt=false')['envs']
    out = {}
    for key in ENV_KEYS:
        match = [r for r in rows if r['key'] == key and 'production' in r.get('target', [])]
        need(len(match) == 1, 'ENV_ROW_AMBIGUOUS')
        out[key] = match[0]
    return out


def env_values():
    """Public seal hashes only (plain/non-secret rows), decrypted one row at a time."""
    return {key: api(f'/v1/projects/{PROJECT}/env/{row["id"]}?teamId={TEAM}')['value'] for key, row in env_rows().items()}


def deployments():
    value = api(f'/v7/deployments?projectId={PROJECT}&target=production&limit=5&teamId={TEAM}')
    return [{'id': d['uid'], 'state': d.get('readyState') or d.get('state'), 'created': d.get('created'), 'meta_run': d.get('meta', {}).get('epsRun')} for d in value['deployments']]


def record(action, payload):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc)
    path = EVIDENCE / f"{stamp.strftime('%Y-%m-%dT%H-%M-%S')}Z-{action}.json"
    path.write_text(json.dumps({'schema_version': 'eps-m08-worker-rollout.v1', 'action': action, 'recorded_at': stamp.isoformat(), **payload}, indent=1, sort_keys=True) + '\n', encoding='utf-8')
    print(json.dumps({'action': action, 'receipt': str(path), **{k: v for k, v in payload.items() if k in ('result', 'deployment', 'digest')}}))


def flags(enabled):
    before = db_state()
    need(all(c['enabled'] is (not enabled) for c in before['config'].values()), 'CONFIG_STATE_UNEXPECTED')
    if not enabled:
        need(all(v == 0 for v in before['counters'].values()), 'WORK_NOT_DRAINED')
    statements = ''.join(f"do $f$declare n integer;begin update eps.{t} set enabled={str(enabled).lower()};get diagnostics n=row_count;if n<>1 then raise exception'ONE_CONFIG_REQUIRED';end if;end$f$;\n" for t in CONFIGS)
    marker = str(uuid.uuid4())
    sql(f"begin;set local search_path='';set local lock_timeout='5s';set local statement_timeout='30s';\n{statements}commit;\nselect '{marker}' as marker;\n", 'resume' if enabled else 'pause')
    after = db_state()
    need(all(c['enabled'] is enabled for c in after['config'].values()) and after['versions'] == before['versions'], 'POSTCONDITION_FAILED')
    record('resume' if enabled else 'pause', {'result': 'passed', 'before': before, 'after': after, 'marker': marker})


def main(argv):
    action = argv[0]
    plan = json.loads(PLAN.read_text(encoding='utf-8')) if PLAN.exists() else None
    if action == 'state':
        record('state', {'result': 'observed', 'db': db_state(), 'deployments': deployments(), 'env': env_values()})
    elif action in ('pause', 'resume'):
        flags(action == 'resume')
    elif action == 'env':
        need(plan and db_state()['config']['frame_extraction_config']['enabled'] is False, 'PAUSE_REQUIRED')
        rows = env_rows(); before = env_values()
        for key in ENV_KEYS:
            need(re.fullmatch('[a-f0-9]{64}', plan['env'][key]) is not None)
            if before[key] != plan['env'][key]:
                api(f'/v10/projects/{PROJECT}/env/{rows[key]["id"]}?teamId={TEAM}', 'PATCH', {'value': plan['env'][key]})
        after = env_values(); need(after == plan['env'], 'ENV_POSTCONDITION_FAILED')
        record('env', {'result': 'passed', 'before': before, 'after': after})
    elif action == 'deploy':
        need(plan and env_values() == plan['env'], 'ENV_REQUIRED')
        before = deployments()
        out = run(VERCEL + ['deploy', plan['output'], '--prebuilt', '--prod', '--yes', '--no-wait', '--project', PROJECT, '--meta', f'epsRun={plan["run"]}'], 300)
        urls = sorted(set(re.findall(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app', out)))
        need(len(urls) == 1, 'DEPLOY_URL_UNCONFIRMED')
        record('deploy', {'result': 'submitted', 'before': before, 'url': urls[0], 'after': deployments()})
    elif action == 'ready':
        current = deployments(); new = [d for d in current if d['meta_run'] == plan['run']]
        need(len(new) == 1, 'NEW_DEPLOYMENT_UNCONFIRMED')
        inspect = json.loads(run(VERCEL + ['daemons', 'inspect', 'worker', '--project', PROJECT, '--json']))
        record('ready', {'result': 'observed', 'deployment': new[0], 'daemon': inspect})
    elif action == 'pin':
        before = db_state(); need(before['config']['frame_extraction_config']['enabled'] is False, 'PAUSE_REQUIRED')
        digest = plan['native_digest']; need(re.fullmatch('sha256:[a-f0-9]{64}', digest) is not None)
        marker = str(uuid.uuid4())
        sql(f"begin;set local search_path='';set local lock_timeout='5s';\ndo $p$declare n integer;begin update eps.frame_extraction_config set native_image_id='{digest}';get diagnostics n=row_count;if n<>1 then raise exception'ONE_CONFIG_REQUIRED';end if;end$p$;\ncommit;\nselect '{marker}' as marker;\n", 'pin')
        after = db_state(); need(after['config']['frame_extraction_config']['native_image_id'] == digest, 'PIN_POSTCONDITION_FAILED')
        record('pin', {'result': 'passed', 'before': before, 'after': after, 'digest': digest})
    else:
        raise SystemExit('usage: worker_rollout.py state|pause|env|deploy|ready|pin|resume')


if __name__ == '__main__':
    main(sys.argv[1:])
