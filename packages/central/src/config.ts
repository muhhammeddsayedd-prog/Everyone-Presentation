import { DomainError } from '@eps/domain';

export interface CentralConfig { url: string; publishableKey: string }

export function checkedCentralConfig(config: CentralConfig): CentralConfig {
  let url: URL;
  try { url = new URL(config.url); } catch { throw configurationError(); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw configurationError();
  if (typeof config.publishableKey !== 'string' || !/^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(config.publishableKey) || config.publishableKey.length > 4096) throw configurationError();
  return Object.freeze({ url: url.origin, publishableKey: config.publishableKey });
}
function configurationError() {
  return new DomainError('CENTRAL_CONFIGURATION_REQUIRED', 'Configure SUPABASE_URL and a publishable SUPABASE_PUBLISHABLE_KEY. Privileged secret/service-role keys are not accepted.', 503);
}
export function readCentralConfig(environment: Readonly<Record<string, string | undefined>> = process.env): CentralConfig {
  return checkedCentralConfig({ url: environment.SUPABASE_URL?.trim() ?? '', publishableKey: environment.SUPABASE_PUBLISHABLE_KEY?.trim() ?? '' });
}
