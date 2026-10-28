import { currentActor } from '../../../../../../lib/session';
import { getStudio } from '../../../../../../lib/studio';
import { failure, json, readBoundedBody, requireSameOrigin } from '../../../../../../lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(request: Request, context: { params: Promise<{ upload_id: string }> }) {
  try {
    requireSameOrigin(request);
    const actor = (await currentActor())!;
    const { upload_id } = await context.params;
    const studio = await getStudio();
    await studio.getUploadSession(actor, upload_id);
    const bytes = await readBoundedBody(request, 5 * 1024 * 1024);
    return json(await studio.storeUploadedLogo(actor, upload_id, bytes));
  } catch (e) { return failure(e); }
}
