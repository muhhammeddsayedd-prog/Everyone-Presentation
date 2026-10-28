import { randomUUID } from 'node:crypto';
import { DomainError } from '@eps/domain';
import { clearSession, setSession } from '../../../../lib/session';
import { getSessionData } from '../../../../lib/session-data';
import { failure, json, readJson, requireSameOrigin } from '../../../../lib/http';
import { readRuntimeConfig } from '../../../../lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function sessionData() {
  if (readRuntimeConfig().adapterMode !== 'local_fixture') throw new DomainError('ACCESS_DENIED', 'Development sign-in is disabled in central mode.', 403);
  return getSessionData();
}
export async function GET() { try { return json(await sessionData()); } catch (e) { return failure(e); } }
export async function POST(request: Request) {
  const id = randomUUID();
  try {
    requireSameOrigin(request);
    const input = await readJson(request);
    if (!input || typeof input.actor_id !== 'string' || Object.keys(input).length !== 1) throw new DomainError('VALIDATION_FAILED', 'Choose one development identity.', 400);
    await setSession(input.actor_id);
    return json(await sessionData(), id);
  } catch (e) { return failure(e, id); }
}
export async function DELETE(request: Request) {
  try { requireSameOrigin(request); if (readRuntimeConfig().adapterMode !== 'local_fixture') throw new DomainError('ACCESS_DENIED', 'Development sign-in is disabled in central mode.', 403); await clearSession(); return json({ signed_out: true }); }
  catch (e) { return failure(e); }
}
