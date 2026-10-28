import { getCentralClient } from '../../../../lib/central-client';
import { readRuntimeConfig } from '../../../../lib/config';
import { NO_STORE } from '../../../../lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const config = readRuntimeConfig();
  const code = new URL(request.url).searchParams.get('code');
  let destination = '/projects?auth=failed';
  if (config.adapterMode === 'supabase' && code && code.length <= 2048) {
    try { const { error } = await (await getCentralClient(false)).auth.exchangeCodeForSession(code); if (!error) destination = '/projects'; }
    catch { /* Generic sign-in recovery; never expose the callback code/provider body. */ }
  }
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: `${config.baseUrl}${destination}` } });
}
