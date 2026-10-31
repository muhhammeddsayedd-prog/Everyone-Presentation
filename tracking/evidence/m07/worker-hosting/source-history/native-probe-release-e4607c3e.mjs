/** Fixed current probe release; no runtime/context/configuration writes or I/O. */
export const NATIVE_PROBE_RELEASE = Object.freeze({
  source_sha256: '3790b2b327da7eca18b1aad3a0dfaae02892b0130647e4527a25dd24aa3d54a3',
  context_relative: '.local/worker-hosting/77e14c2e-5ae9-4aa6-aec0-636f789c4625/context',
  file_count: 156,
  native_uid: 65432,
  native_gid: 65432,
  native_identity_sha256: 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0',
  native_task_limits_sha256: '6e68287b3005059d9a0ce860dc90f46342bb24819cd8e7bf6bff7cbecf7215e4',
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
