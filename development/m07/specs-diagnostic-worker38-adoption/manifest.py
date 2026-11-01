"""Disabled same-ID public-manifest PATCH; separate from database transactions."""
from pathlib import Path
import importlib.util
import json
import os
import re
import subprocess
import sys

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('worker38_manifest_adoption', HERE/'adoption.py')
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)
s = a.s
PATCH_ENABLED = False
KEY = 'EPS_NATIVE_MANIFEST_SHA256'
CLI = s.ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
NODE = Path('C:/Program Files/nodejs/node.exe')
GLOBAL = 'C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
CLAIM = a.PRIVATE/'manifest.claim.json'
RETURNED = a.PRIVATE/'manifest.returned.json'
CLI_PINS = {
 'vc.js': '5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',
 'chunks/chunk-YIOT5B5Z.js': '36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
 'chunks/chunk-QZEZCUUZ.js': 'd81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a',
}


def need(value):
 s.need(value)


def command(endpoint, body=None):
 get_metadata = '/v10/projects/'+s.PROJECT+'/env?teamId='+s.TEAM+'&decrypt=false'
 get_value = '/v1/projects/'+s.PROJECT+'/env/'+s.ENVIRONMENT_ID+'?teamId='+s.TEAM
 patch_value = '/v9/projects/'+s.PROJECT+'/env/'+s.ENVIRONMENT_ID+'?teamId='+s.TEAM
 need(endpoint in ((get_metadata, get_value) if body is None else (patch_value,)))
 need(s.sha(s.load(NODE, 128*1024*1024)) == '9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de')
 for relative, digest in CLI_PINS.items():
  need(s.sha(s.load(CLI.parent/relative)) == digest)
 env = {key: os.environ[key] for key in ('SystemRoot', 'WINDIR', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'LANG') if key in os.environ}
 env.update(PATH='', NODE_ENV='production', CI='1', VERCEL_TELEMETRY_DISABLED='1', VERCEL_CLI_USE_NATIVE_BINARY='0')
 args = [str(NODE), str(CLI), 'api', endpoint, '--scope', 'muhammed-abdelrahman', '--raw', '--global-config', GLOBAL]
 if body is not None:
  need(set(body) == {'value'} and type(body['value']) is str and re.fullmatch('[a-f0-9]{64}', body['value']))
  args += ['--method', 'PATCH', '--input', '-']
 result = subprocess.run(args, cwd=s.ROOT, env=env, input=None if body is None else json.dumps(body), capture_output=True,
                         text=True, encoding='utf8', errors='replace', timeout=30, stdin=subprocess.DEVNULL if body is None else None)
 need(result.returncode == 0 and len(result.stdout.encode()) <= 2*1024*1024 and len(result.stderr.encode()) <= 1024*1024)
 return json.loads(result.stdout)


def observe():
 response = command('/v10/projects/'+s.PROJECT+'/env?teamId='+s.TEAM+'&decrypt=false')
 rows = response['envs']
 need(type(rows) is list and len(rows) <= 100 and all(type(row) is dict for row in rows)
      and (response.get('pagination') is None or type(response['pagination']) is dict and response['pagination'].get('next') is None))
 # Values of every other entry are discarded before producing the projection.
 metadata = []
 for row in rows:
  projected = {key: row.get(key) for key in ('id', 'key', 'type', 'target', 'gitBranch', 'createdAt', 'updatedAt')}
  need(type(projected['id']) is str and re.fullmatch('[A-Za-z0-9_-]{1,128}', projected['id'])
       and type(projected['key']) is str and re.fullmatch('[A-Z][A-Z0-9_]{0,99}', projected['key'])
       and projected['type'] in ('encrypted', 'sensitive', 'plain', 'system', 'secret')
       and projected['gitBranch'] is None and type(projected['createdAt']) is int and type(projected['updatedAt']) is int
       and type(projected['target']) is list and all(item in ('production', 'preview', 'development') for item in projected['target']))
  metadata.append(projected)
 need(len({row['id'] for row in metadata}) == len(metadata))
 matches = [row for row in metadata if row['key'] == KEY]
 need(len(matches) == 1 and matches[0]['id'] == s.ENVIRONMENT_ID and matches[0]['type'] == 'plain' and matches[0]['target'] == ['production'])
 selected = matches[0]
 item = command('/v1/projects/'+s.PROJECT+'/env/'+selected['id']+'?teamId='+s.TEAM)
 need(item.get('id') == selected['id'] and item.get('key') == KEY and type(item.get('value')) is str and re.fullmatch('[a-f0-9]{64}', item['value']))
 return {'metadata': sorted(metadata, key=lambda row: row['id']), 'environment_id': selected['id'], 'manifest_sha256': item['value']}


def preserved(before, after):
 need(before['environment_id'] == after['environment_id'])
 old = {row['id']: row for row in before['metadata']}
 new = {row['id']: row for row in after['metadata']}
 need(old.keys() == new.keys())
 for identity in old:
  need(({k: v for k, v in old[identity].items() if k != 'updatedAt'} == {k: v for k, v in new[identity].items() if k != 'updatedAt'})
       if identity == before['environment_id'] else old[identity] == new[identity])
 return True


def apply(before):
 need(PATCH_ENABLED and not CLAIM.exists() and not RETURNED.exists())
 accepted, pins = a.admission('manifest'), a.source_pins()
 first = a.read_snapshot()
 a.prior_phase('manifest', first, accepted)
 need(observe() == before and before['environment_id'] == s.ENVIRONMENT_ID and before['manifest_sha256'] == s.OLD_MANIFEST)
 a.private_write(CLAIM, {'before': before, 'paused': first, 'admission': accepted, 'source_pins': pins,
                         'dispatch_may_have_occurred': True, 'automatic_retry': False})
 returned = False
 try:
  need(a.source_pins() == pins and a.admission('manifest') == accepted and a.read_snapshot() == first and observe() == before)
  command('/v9/projects/'+s.PROJECT+'/env/'+before['environment_id']+'?teamId='+s.TEAM, {'value': accepted['new_manifest_sha256']})
  a.private_write(RETURNED, {'claim_sha256': s.sha(s.load(CLAIM)), 'normal_return_observed': True})
  returned = True
 except Exception:
  pass
 return reconcile({'before': before, 'paused': first, 'admission': accepted, 'source_pins': pins}, returned)


def reconcile(claim, returned):
 accepted = a.admission('manifest')
 need(claim['admission'] == accepted and claim['source_pins'] == a.source_pins())
 try:
  one, two = observe(), observe()
  need(one == two and preserved(claim['before'], one) and one['manifest_sha256'] == accepted['new_manifest_sha256']
       and a.read_snapshot() == claim['paused'])
 except Exception:
  return {'result': 'unconfirmed', 'phase': 'manifest', 'normal_return_observed': returned, 'claim_retained': True}
 return {'result': 'passed' if returned else 'unconfirmed', 'phase': 'manifest', 'target': s.TARGET, 'project_id': s.PROJECT,
         'new_manifest_sha256': accepted['new_manifest_sha256'], 'same_environment_id_preserved': True,
         'other_environment_metadata_preserved': True, 'normal_return_observed': returned, 'two_readbacks_equal': True,
         'claim_retained': True, 'cli_internal_same_value_patch_retries_possible': True}


def main():
 need(PATCH_ENABLED and len(sys.argv) == 2 and sys.argv[1] in ('inspect', 'apply', 'readback'))
 if sys.argv[1] == 'inspect':
  a.admission('manifest')
  observed = observe()
  need(observed['manifest_sha256'] == s.OLD_MANIFEST)
  return {'result': 'observed', 'phase': 'manifest', 'before': observed}
 if sys.argv[1] == 'readback':
  claim = a.private_read(CLAIM)
  returned = False
  if RETURNED.exists():
   returned = a.private_read(RETURNED) == {'claim_sha256': s.sha(s.load(CLAIM)), 'normal_return_observed': True}
  return reconcile(claim, returned)
 return apply(observe())


if __name__ == '__main__':
 try:
  result = main()
  a.save({**result, 'provider_called': True, 'worker_deployment_performed': False})
  print(json.dumps(result))
 except Exception:
  print('WORKER38_MANIFEST_UNCONFIRMED')
  sys.exit(1)
