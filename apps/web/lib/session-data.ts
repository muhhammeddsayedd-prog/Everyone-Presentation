import { currentActor } from './session';
import { getStudio } from './studio';
import { readRuntimeConfig } from './config';
import { readCentralConfig, type CentralCapabilities } from '@eps/central';
import { studioTimeZone } from './studio-time-zone';

export function projectSessionIdentity(principalId: string, name: string, capabilities: CentralCapabilities) {
  return { timezone: studioTimeZone(capabilities.timezone), actor: { id: principalId, name, capabilities: capabilities.capabilities,
    upload_purposes: capabilities.upload_policy.available_purposes, upload_maximum_bytes: capabilities.upload_policy.maximum_file_bytes } };
}

export async function getSessionData() {
  const mode = readRuntimeConfig().adapterMode;
  const actor = await currentActor(false);
  if (mode === 'supabase' && !actor) return { mode, actor: null, actors: [] };
  const studio = await getStudio();
  const actors = mode === 'local_fixture' ? studio.fixtureActors().map(item => ({ id: item.id, name: item.display_name, description: item.role })) : [];
  if (!actor) return { mode, actor: null, actors };
  const capabilities = await studio.getCapabilities(actor);
  const name = mode === 'local_fixture' ? actors.find(item => item.id === actor.principal_id)?.name ?? 'Development user'
    : ('verifiedIdentity' in studio ? studio.verifiedIdentity.email : null) ?? 'Everyone user';
  return { mode, ...projectSessionIdentity(actor.principal_id, name, capabilities), actors,
    ...(mode === 'supabase' ? { storage_origin: readCentralConfig(process.env).url } : {}) };
}
