/** Hosted runtime has no local dotenv loader and no ambient credential fallback.
 * Deployment environment is scoped to this daemon-only project by the owner. */
const flags = ['EPS_SPECS_FILES_ENABLED', 'EPS_CANDIDATE_MEDIA_ENABLED', 'EPS_FRAME_EXTRACTION_ENABLED', 'EPS_PDF_VISION_ENABLED', 'EPS_REVIEW_ENABLED', 'EPS_PRESENTATION_ENABLED', 'EPS_GUEST_EXPORTS_ENABLED'];
const fields = ['VERCEL', 'VERCEL_ENV', 'VERCEL_REGION', 'VERCEL_PROJECT_ID', 'VERCEL_TEAM_ID', 'VERCEL_OIDC_TOKEN_FILE', 'EPS_RELEASE_MODE', 'APP_ENV', 'EPS_PILOT_OWNER_CONTROLLED', 'EPS_PILOT_EXPIRES_AT', 'EPS_NATIVE_TRANSPORT', 'EPS_NATIVE_MANIFEST_SHA256', 'EPS_DAEMON_SOURCE_SHA256', 'EPS_NATIVE_COMPATIBILITY_SHA256',
  'OPENAI_API_KEY', 'OPENAI_EXTRACTION_MODEL', 'OPENAI_TRANSCRIPTION_MODEL', 'EPS_SPECS_PG_HOST', 'EPS_SPECS_PG_PASSWORD', 'EPS_SPECS_PG_CA_BASE64',
  'N8N_DISPATCH_URL', 'N8N_DISPATCH_SECRET', 'N8N_CANDIDATE_DISPATCH_URL', 'N8N_CANDIDATE_DISPATCH_SECRET', 'N8N_REVIEW_DISPATCH_URL', 'N8N_REVIEW_DISPATCH_SECRET', 'N8N_PRESENTATION_DISPATCH_URL', 'N8N_PRESENTATION_DISPATCH_SECRET',
  'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', ...flags];
function fail(): never { throw new Error('HOSTED_WORKER_CONFIGURATION_INVALID'); }
export function hostedWorkerEnvironment(environment: Readonly<Record<string, string | undefined>>, now = Date.now()): Record<string, string> {
  const production = environment.EPS_RELEASE_MODE === 'production';
  if (environment.VERCEL !== '1' || environment.VERCEL_ENV !== 'production' || environment.NODE_ENV !== 'production'
    || (production ? environment.APP_ENV !== 'production' : environment.EPS_RELEASE_MODE !== 'controlled_pilot') || environment.EPS_NATIVE_TRANSPORT !== 'vercel_sandbox'
    || environment.VERCEL_OIDC_TOKEN_FILE !== '/var/run/secrets/vercel.com/token'
    || ['EPS_NATIVE_MANIFEST_SHA256', 'EPS_DAEMON_SOURCE_SHA256', 'EPS_NATIVE_COMPATIBILITY_SHA256'].some(key => !/^[a-f0-9]{64}$/u.test(environment[key] ?? '')) || flags.some(key => environment[key] !== 'true')
    || ['VERCEL_TOKEN', 'VERCEL_ACCESS_TOKEN', 'N8N_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'DATABASE_URL', 'PGPASSWORD', 'OPENAI_CUSTOM_HEADERS', 'NODE_OPTIONS'].some(key => environment[key])) fail();
  const ownerControlled = environment.EPS_PILOT_OWNER_CONTROLLED; const expiry = environment.EPS_PILOT_EXPIRES_AT;
  if (![undefined, 'false', 'true'].includes(ownerControlled) || !Number.isFinite(now)) fail();
  if (production) {
    if (expiry !== undefined && expiry !== '' || environment.SUPABASE_URL !== 'https://pyibofyctwnqpvktepse.supabase.co'
      || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(environment.SUPABASE_PUBLISHABLE_KEY ?? '')
      || (environment.SUPABASE_PUBLISHABLE_KEY?.length ?? 0) > 4096) fail();
  }
  else if (ownerControlled === 'true') { if (expiry !== undefined && expiry !== '') fail(); }
  else {
    const deadline = Date.parse(expiry ?? '');
    if (!expiry || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(expiry) || !Number.isFinite(deadline) || deadline <= now) fail();
    const canonical = new Date(deadline).toISOString(); if (expiry !== canonical && expiry !== canonical.replace('.000Z', 'Z')) fail();
  }
  const result: Record<string, string> = { NODE_ENV: 'production', PATH: '', LANG: 'C', LC_ALL: 'C', HOME: '/home/node' };
  for (const key of fields) if (typeof environment[key] === 'string') result[key] = environment[key];
  return result;
}
/** Keep an unconfirmed cleanup from triggering a fresh Daemon poller through
 * automatic process restart. No job/provider loop remains active while held. */
export function holdHostedWorker(signal: AbortSignal, events: Pick<NodeJS.EventEmitter, 'once' | 'removeListener'> = process): Promise<void> {
  return new Promise(resolve => {
    // In owner-controlled mode this handle keeps the paused process alive.
    const keepAlive = setInterval(() => {}, 60_000);
    const stop = () => { clearInterval(keepAlive); signal.removeEventListener('abort', stop); events.removeListener('SIGTERM', stop); events.removeListener('SIGINT', stop); resolve(); };
    signal.addEventListener('abort', stop, { once: true }); events.once('SIGTERM', stop); events.once('SIGINT', stop); if (signal.aborted) stop();
  });
}
