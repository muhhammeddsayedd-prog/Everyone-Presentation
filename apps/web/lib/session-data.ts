import { currentActor } from './session';
import { getStudio } from './studio';
import { readRuntimeConfig } from './config';

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
  return { mode, actor: { id: actor.principal_id, name, capabilities: capabilities.capabilities,
    upload_purposes: capabilities.upload_policy.available_purposes }, actors };
}
