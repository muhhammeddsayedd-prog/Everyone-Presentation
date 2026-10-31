import type { NextConfig } from 'next';
import path from 'node:path';
import { assertHostedPilotConfig } from './lib/hosting-pilot';

// Vercel serves Next functions without invoking the ordinary production-start
// refusal. Admit only the explicit bounded pilot before creating those artifacts.
if (process.env.VERCEL === '1' || process.env.EPS_RELEASE_MODE !== undefined) assertHostedPilotConfig(process.env);

const config: NextConfig = {
  distDir: process.env.EPS_TEST_SERVER === 'true' ? '.next-e2e' : '.next',
  agentRules: false,
  // OAuth callback codes and future share credentials must never enter URL logs.
  logging: { incomingRequests: false, fetches: { fullUrl: false } },
  // The fixture repository reads private runtime files. Keep those dynamic paths
  // out of Turbopack's source dependency graph (Node 24 loads the typed workspace).
  serverExternalPackages: ['@eps/domain'],
  transpilePackages: ['@eps/central'],
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
  turbopack: { root: path.resolve(__dirname, '../..') },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
    ] }];
  }
};
export default config;
