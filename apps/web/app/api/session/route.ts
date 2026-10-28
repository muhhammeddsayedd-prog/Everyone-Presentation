import { failure, json, requireSameOrigin } from '../../../lib/http';
import { getSessionData } from '../../../lib/session-data';
import { clearSession } from '../../../lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() { try { return json(await getSessionData()); } catch (e) { return failure(e); } }
export async function DELETE(request: Request) {
  try { requireSameOrigin(request); await clearSession(); return json({ signed_out: true }); }
  catch (e) { return failure(e); }
}
