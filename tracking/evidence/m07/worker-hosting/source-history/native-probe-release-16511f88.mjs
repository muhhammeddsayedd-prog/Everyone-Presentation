/** Fixed current probe release; no runtime/context/configuration writes or I/O. */
export const NATIVE_PROBE_RELEASE = Object.freeze({
  source_sha256: '5f9114a20cfa195282b53a89b3e3614e706f16fb1e4ed986d477e451086c5558',
  context_relative: '.local/worker-hosting/49a1a0f8-c1b6-4704-8c27-fb84adad4cab/context',
  file_count: 151,
  native_uid: 65432,
  native_gid: 65432,
  native_identity_sha256: 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0',
});
export function nativeProbePrivilegeArguments() {
  return [`--reuid=${NATIVE_PROBE_RELEASE.native_uid}`, `--regid=${NATIVE_PROBE_RELEASE.native_gid}`, '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs'];
}
