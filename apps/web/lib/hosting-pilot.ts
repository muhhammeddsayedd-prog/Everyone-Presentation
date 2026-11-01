import { isIP } from 'node:net';

type Environment = Readonly<Record<string, string | undefined>>;
const CENTRAL_ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
function denied(): never { throw new Error('PILOT_CONFIGURATION_REQUIRED: configure the canonical central deployment mode, origin and credentials.'); }

/** Deployment admission only. Acting-user authentication and domain permissions
 * remain mandatory. No origin, identity or credentials are inferred from a request. */
export function assertHostedDeploymentConfig(env: Environment, now: number = Date.now()): void {
  const production = env.EPS_RELEASE_MODE === 'production';
  if ((production ? env.APP_ENV !== 'production' : env.EPS_RELEASE_MODE !== 'controlled_pilot' || env.APP_ENV !== 'staging') || env.NODE_ENV !== 'production'
    || env.CENTRAL_ADAPTER_MODE !== 'supabase' || env.EPS_TEST_SERVER === 'true' || !Number.isFinite(now)) denied();
  let origin: URL;
  try { origin = new URL(env.APP_BASE_URL ?? ''); } catch { return denied(); }
  const host = origin.hostname.replace(/\.$/u, '');
  if (origin.protocol !== 'https:' || origin.origin !== env.APP_BASE_URL || origin.username || origin.password
    || host === 'localhost' || host.endsWith('.localhost') || isIP(host) || host.startsWith('[')) denied();
  // Keep build admission free of app aliases/SDK imports: Next loads this before
  // its normal workspace transpilation. Runtime config also calls readCentralConfig.
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY ?? '';
  if (env.SUPABASE_URL !== CENTRAL_ORIGIN || publishableKey.length > 4096
    || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(publishableKey)) denied();
  // Production has no pilot deadline. Reject a stale nonempty deadline.
  if (production) { if (env.EPS_PILOT_EXPIRES_AT) denied(); return; }
  const ownerControlled = env.EPS_PILOT_OWNER_CONTROLLED;
  if (ownerControlled !== undefined && ownerControlled !== 'true' && ownerControlled !== 'false') denied();
  const expiry = env.EPS_PILOT_EXPIRES_AT;
  // The owner's explicit keep-running choice has no clock deadline. Reject a
  // contradictory nonempty deadline instead of silently choosing one mode.
  if (ownerControlled === 'true') { if (expiry !== undefined && expiry !== '') denied(); return; }
  if (!expiry || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(expiry)) denied();
  const deadline = Date.parse(expiry);
  if (!Number.isFinite(deadline) || deadline <= now) denied();
  const canonical = new Date(deadline).toISOString();
  if (expiry !== canonical && expiry !== canonical.replace('.000Z', 'Z')) denied();
}

/** Retain the dedicated pilot contract for its existing launchers/operators. */
export function assertHostedPilotConfig(env: Environment, now: number = Date.now()): void {
  if (env.EPS_RELEASE_MODE !== 'controlled_pilot') denied();
  assertHostedDeploymentConfig(env, now);
}
