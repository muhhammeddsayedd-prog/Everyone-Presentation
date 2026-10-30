import { DomainError, parseSettingsPatch, type Actor, type MutationContext, type SettingsOperations } from '@eps/domain';
import { failure, json, readJson } from './http';

export function isSettingsRoute(segments: string[]) { return segments.length === 1 && segments[0] === 'settings'; }
export async function handleSettingsRequest(request: Request, segments: string[], actor: Actor, settings: SettingsOperations, context: MutationContext) {
  try {
    if (!isSettingsRoute(segments)) throw new DomainError('RESOURCE_NOT_FOUND', 'Settings operation not found.', 404);
    if (new URL(request.url).searchParams.size) throw new DomainError('INVALID_REQUEST', 'Settings do not accept query parameters.', 400);
    if (request.method === 'GET') return json(await settings.getSettings(actor), context.requestId);
    if (request.method === 'PATCH') return json(await settings.updateSettings(actor, parseSettingsPatch(await readJson(request)), context), context.requestId);
    throw new DomainError('METHOD_NOT_ALLOWED', 'Use GET or PATCH for Studio settings.', 405);
  } catch (error) { return failure(error, context.requestId); }
}
