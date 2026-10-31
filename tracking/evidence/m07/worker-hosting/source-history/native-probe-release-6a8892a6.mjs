/** Fixed current probe release; no runtime/context/configuration writes or I/O. */
export const NATIVE_PROBE_RELEASE = Object.freeze({
  source_sha256: 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735',
  context_relative: '.local/worker-hosting/7b5324c8-f3a1-4a61-996f-8d69c93a7180/context',
  file_count: 152,
  native_uid: 65432,
  native_gid: 65432,
  native_identity_sha256: 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0',
  native_task_limits_sha256: '6e68287b3005059d9a0ce860dc90f46342bb24819cd8e7bf6bff7cbecf7215e4',
  diagnostic_modes_enabled: false,
});
export function nativeProbePrivilegeArguments() {
  return [`--reuid=${NATIVE_PROBE_RELEASE.native_uid}`, `--regid=${NATIVE_PROBE_RELEASE.native_gid}`, '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs'];
}
