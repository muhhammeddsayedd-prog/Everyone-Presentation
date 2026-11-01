/** New synthetic-only source target. Imports perform no I/O or provider work. */
export const NATIVE_PROBE_RELEASE = Object.freeze({
  source_sha256: '0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730',
  context_relative: '.local/worker-hosting/8b559ebe-1b6c-4741-b371-9498c5855976/context',
  file_count: 165,
  context_proof: Object.freeze({
    path: 'tracking/evidence/m07/completion-worker/2026-11-01T23-41-02-214Z-native-context-audit.json',
    sha256: 'ca1b54499479a02f096405b14b128dabe01243f7a7c74bff5e1a30825ddfb85c',
  }),
  native_uid: 65432,
  native_gid: 65432,
  native_identity_sha256: 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0',
  native_task_limits_sha256: 'f648ae3a0c82c7d8cdc5d8c553d34014f8b20319ce7ff569eea8ae04185a9df0',
  native_launcher_sha256: '3efb0a965fb23dc5d8a07dae7b8a590238a7172ca7606aadf3b8c40f2baaac23',
  seal_validator_sha256: 'ce7b9c4fa9c0d557d0d28784f6caca7b6752379dcfd218e4d9d526cf4ee94cc6',
  runtime_contract_sha256: Object.freeze({
    'contracts/json-schema/candidate-extraction.schema.json': '693f12f8d6a7c19627a453a142a9f4a77847c494b428c33b3888d4305046af64',
    'contracts/json-schema/frame-selection.schema.json': '200555c60381f36a37b9628046f0059d004adc0b2fe020e167dfbda165af1b8c',
    'contracts/json-schema/slide-wording.schema.json': 'c7a6681aa341d9ac217c12888486b422010bbf1893ad4790de7a24b74408bf56',
    'contracts/json-schema/specs-extraction.schema.json': 'c55e758da1b71119a3a8d7cc408340e502088c8ab88a89c81da7effb85a8809d',
  }),
  diagnostic_modes_enabled: false,
});
export function nativeProbePrivilegeArguments() {
  return [`--reuid=${NATIVE_PROBE_RELEASE.native_uid}`, `--regid=${NATIVE_PROBE_RELEASE.native_gid}`, '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs'];
}
