import { randomUUID } from 'node:crypto';
import { DomainError, type ProjectPatch, type WorkspaceCreate, type WorkspacePatch,
  type UploadSessionCreate, type CompleteUpload, type AudiencePresetCreate, type AudiencePresetPatch } from '@eps/domain';
import { currentActor } from '../../../../lib/session';
import { getStudio } from '../../../../lib/studio';
import { failure, json, NO_STORE, readJson, requireSameOrigin } from '../../../../lib/http';
import { validateContract } from '../../../../lib/validation';
import { handleJobRequest } from '../../../../lib/job-http';
import { getJobs } from '../../../../lib/jobs';
import { handleSpecsRequest, isManualSpecsRoute } from '../../../../lib/specs-http';
import { getSpecsService } from '../../../../lib/specs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ segments: string[] }> };

async function handle(request: Request, context: Context) {
  const requestId = randomUUID();
  try {
    const method = request.method;
    if (method !== 'GET') requireSameOrigin(request, true);
    const actor = (await currentActor())!;
    const { segments: s } = await context.params;
    const mutation = { idempotencyKey: request.headers.get('Idempotency-Key') ?? undefined, requestId,
      clientType: request.headers.has('authorization') ? 'api' as const : 'browser' as const };
    if (s[0] === 'jobs') return await handleJobRequest(request, s, actor, await getJobs(), mutation);
    if (isManualSpecsRoute(s)) return await handleSpecsRequest(request, s, actor, await getSpecsService(), mutation);
    const studio = await getStudio();
    const url = new URL(request.url);
    const list = { q: url.searchParams.get('q') ?? undefined, cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.has('limit') ? Number(url.searchParams.get('limit')) : undefined };
    const body = async <T,>(schema: string) => validateContract<T>(schema, await readJson(request));
    const paged = (result: { data: unknown; page: { next_cursor: string | null } }) =>
      Response.json({ request_id: requestId, ...result }, { headers: NO_STORE });
    if (s.length === 1 && s[0] === 'capabilities' && method === 'GET') return json(await studio.getCapabilities(actor), requestId);
    if (s[0] === 'projects') {
      if (s.length === 1 && method === 'GET') return paged(await studio.listProjects(actor, list));
      if (s.length === 2 && method === 'GET') return json(await studio.getProject(actor, s[1]), requestId);
      if (s.length === 2 && method === 'PATCH') return json(await studio.updateProject(actor, s[1], await body<ProjectPatch>('ProjectPatch'), mutation), requestId);
    }
    if (s[0] === 'workspaces') {
      if (s.length === 1 && method === 'GET') return paged(await studio.listWorkspaces(actor, list));
      if (s.length === 1 && method === 'POST') return json(await studio.createWorkspace(actor, await body<WorkspaceCreate>('WorkspaceCreate'), mutation), requestId, 201);
      if (s.length === 2 && method === 'GET') return json(await studio.getWorkspace(actor, s[1]), requestId);
      if (s.length === 2 && method === 'PATCH') return json(await studio.updateWorkspace(actor, s[1], await body<WorkspacePatch>('WorkspacePatch'), mutation), requestId);
    }
    if (s[0] === 'uploads') {
      if (s.length === 1 && method === 'POST') return json(await studio.createUploadSession(actor, await body<UploadSessionCreate>('UploadSessionCreate'), mutation), requestId, 201);
      if (s.length === 2 && method === 'GET') return json(await studio.getUploadSession(actor, s[1]), requestId);
      if (s.length === 3 && s[2] === 'complete' && method === 'POST') return json(await studio.completeUpload(actor, s[1], await body<CompleteUpload>('CompleteUpload'), mutation), requestId);
      if (s.length === 3 && s[2] === 'cancel' && method === 'POST') {
        return json(await studio.cancelUpload(actor, s[1], mutation), requestId);
      }
    }
    if (s[0] === 'media') {
      if (s.length === 2 && method === 'GET') return json(await studio.getMedia(actor, s[1]), requestId);
      if (s.length === 3 && s[2] === 'content' && method === 'GET') {
        const media = await studio.getMediaContent(actor, s[1]);
        return new Response(new Uint8Array(media.bytes), { headers: { ...NO_STORE, 'Content-Type': media.mimeType } });
      }
    }
    if (s[0] === 'audience-presets') {
      if (s.length === 1 && method === 'GET') return paged(await studio.listAudiencePresets(actor, list));
      if (s.length === 1 && method === 'POST') return json(await studio.createAudiencePreset(actor, await body<AudiencePresetCreate>('AudiencePresetCreate'), mutation), requestId, 201);
      if (s.length === 2 && method === 'PATCH') return json(await studio.updateAudiencePreset(actor, s[1], await body<AudiencePresetPatch>('AudiencePresetPatch'), mutation), requestId);
      if (s.length === 3 && s[2] === 'archive' && method === 'POST') return json(await studio.archiveAudiencePreset(actor, s[1], await body<{ row_version: number }>('ArchiveRequest'), mutation), requestId);
    }
    throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'This operation is pending its implementation milestone.', 503);
  } catch (e) { return failure(e, requestId); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
