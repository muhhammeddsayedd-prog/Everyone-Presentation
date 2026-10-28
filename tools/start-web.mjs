// Fail before starting a production server while central authentication is unimplemented.
if ((process.env.CENTRAL_ADAPTER_MODE ?? 'local_fixture') === 'local_fixture') {
  throw new Error('Production start denied: the development fixture adapter cannot serve production. Complete central integration first.');
}
throw new Error('Production start denied: central schema/auth integration and release evidence remain unverified.');
