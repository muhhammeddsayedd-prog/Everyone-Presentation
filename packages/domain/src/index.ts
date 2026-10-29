import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FixtureStore } from './store.ts';
import { DomainError } from './types.ts';
import type { Actor, AudiencePreset, AudiencePresetCreate, AudiencePresetPatch, CompleteUpload, ListOptions, MediaAsset, MutationContext, Project, ProjectPatch, StudioOptions, UploadCompletion, UploadSession, UploadSessionCreate, Workspace, WorkspaceCreate, WorkspacePatch } from './types.ts';
export * from './types.ts';
export * from './specs.ts';
export * from './role-order.ts';
export * from './candidates.ts';
export * from './candidate-filters.ts';
export * from './candidate-frame-extraction.ts';
export * from './candidate-support.ts';
export * from './casting-types.ts';
export * from './casting.ts';
export * from './review-types.ts';
export * from './review.ts';
export * from './presentation-types.ts';
export * from './presentation.ts';

export const FIXTURE_ACTORS = Object.freeze({ producer: '10000000-0000-4000-8000-000000000001', contributor: '10000000-0000-4000-8000-000000000002', library_viewer: '10000000-0000-4000-8000-000000000003', outsider: '10000000-0000-4000-8000-000000000004' });
export const FIXTURE_PROJECTS = Object.freeze({ first: '20000000-0000-4000-8000-000000000001', second: '20000000-0000-4000-8000-000000000002', other: '20000000-0000-4000-8000-000000000003', archived: '20000000-0000-4000-8000-000000000004' });
const clientId = '30000000-0000-4000-8000-000000000001';
const MIMES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const READ_CAPS = ['projects.read', 'workspaces.read', 'cast.read'];
const WRITE_CAPS = ['workspaces.write', 'cast.upload'];
const ACTORS: { id: string; display_name: string; role: string; capabilities: string[]; projects: string[] }[] = [
  { id: FIXTURE_ACTORS.producer, display_name: 'Synthetic Producer', role: 'producer', capabilities: [...READ_CAPS, ...WRITE_CAPS, 'projects.write', 'cast.write', 'cast.review', 'presentations.generate', 'review_links.manage', 'operations.read', 'operations.retry', 'settings.manage'], projects: [FIXTURE_PROJECTS.first, FIXTURE_PROJECTS.second, FIXTURE_PROJECTS.archived] },
  { id: FIXTURE_ACTORS.contributor, display_name: 'Synthetic Contributor', role: 'contributor', capabilities: [...READ_CAPS, ...WRITE_CAPS], projects: [FIXTURE_PROJECTS.first] },
  { id: FIXTURE_ACTORS.library_viewer, display_name: 'Synthetic Library Viewer', role: 'library_viewer', capabilities: ['cast.read', 'workspaces.read', 'projects.read'], projects: [] },
  { id: FIXTURE_ACTORS.outsider, display_name: 'Synthetic Other Project User', role: 'outsider', capabilities: [...READ_CAPS, ...WRITE_CAPS], projects: [FIXTURE_PROJECTS.other] },
];

interface CentralProject { id: string; name: string; client_id: string | null; row_version: number; archived: boolean }
interface CentralClient { id: string; name: string; logo_asset_id: string | null; row_version: number }
interface StoredWorkspace extends Omit<Workspace, 'title' | 'active_output'> { outputs: Record<string, 'selection' | 'shortlist'> }
interface StoredUpload { session: UploadSession; workspace_id: string; principal_id: string; expected_bytes: number; expected_sha256?: string; received: boolean }
interface StoredMedia { asset: MediaAsset; workspace_id: string }
interface State {
  format_version: 1; central: { projects: CentralProject[]; clients: CentralClient[] };
  workspaces: StoredWorkspace[]; presets: AudiencePreset[]; uploads: StoredUpload[]; media: StoredMedia[];
  idempotency: Record<string, { digest: string; result: unknown }>;
  audit: { operation: string; principal_id: string; request_id: string | null; client_type: string; at: string }[];
}
function initialState(): State {
  return {
    format_version: 1,
    central: { projects: [
      { id: FIXTURE_PROJECTS.first, name: 'Synthetic Campaign — Spring', client_id: clientId, row_version: 1, archived: false },
      { id: FIXTURE_PROJECTS.second, name: 'Synthetic Campaign — Autumn', client_id: clientId, row_version: 1, archived: false },
      { id: FIXTURE_PROJECTS.other, name: 'Synthetic Restricted Project', client_id: null, row_version: 1, archived: false },
      { id: FIXTURE_PROJECTS.archived, name: 'Synthetic Archived Project', client_id: clientId, row_version: 1, archived: true },
    ], clients: [{ id: clientId, name: 'Synthetic Client', logo_asset_id: null, row_version: 1 }] },
    workspaces: [], presets: [
      { id: '40000000-0000-4000-8000-000000000001', key: 'internal_production', label: 'Internal Production', scope: 'internal', settings: {}, archived: false, row_version: 1 },
      { id: '40000000-0000-4000-8000-000000000002', key: 'agency', label: 'Agency', scope: 'external', settings: {}, archived: false, row_version: 1 },
      { id: '40000000-0000-4000-8000-000000000003', key: 'client', label: 'Client', scope: 'external', settings: {}, archived: false, row_version: 1 },
    ], uploads: [], media: [], idempotency: {}, audit: [],
  };
}
function invalid(message: string): never { throw new DomainError('VALIDATION_FAILED', message); }
function checkObject(value: unknown, fields: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) invalid('Request fields do not match the operation contract.');
}
function text(value: unknown, field: string, max = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || [...value].some(character => {
    const code = character.charCodeAt(0);
    return code < 32 && code !== 9 && code !== 10 && code !== 13;
  })) invalid(`${field} must be nonempty text up to ${max} characters.`);
  return value.trim();
}
function version(value: unknown): asserts value is number { if (!Number.isSafeInteger(value) || Number(value) < 1) invalid('row_version must be a positive integer.'); }
function compareVersion(expected: number, actual: number) {
  version(expected);
  if (expected !== actual) throw new DomainError('STALE_RESOURCE_VERSION', 'This record changed. Reload it before saving again.', 409, { current_row_version: actual });
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function searchQuery(options: ListOptions) {
  if (options.q !== undefined && (typeof options.q !== 'string' || options.q.length > 500)) invalid('Search text is too long.');
  if (options.cursor !== undefined && typeof options.cursor !== 'string') invalid('Invalid pagination cursor.');
  return options.q?.trim().toLocaleLowerCase('en') ?? '';
}
function paginate<T extends { id: string }>(records: T[], options: ListOptions = {}) {
  const limit = options.limit ?? 25;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) invalid('limit must be between 1 and 100.');
  const q = searchQuery(options);
  let last = '';
  if (options.cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8')) as { last: string; q: string };
      if (typeof decoded.last !== 'string' || decoded.q !== q || options.cursor.length > 2000) invalid('Cursor does not match the current search.');
      last = decoded.last;
    } catch { invalid('Invalid pagination cursor.'); }
  }
  const sorted = records.filter(record => record.id > last).sort((a, b) => a.id.localeCompare(b.id));
  const data = sorted.slice(0, limit);
  return { data, page: { next_cursor: sorted.length > limit ? Buffer.from(JSON.stringify({ last: data[data.length - 1]!.id, q })).toString('base64url') : null } };
}

export function createStudio(options: StudioOptions) {
  if (options.environment !== 'development' && options.environment !== 'test' || process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging') {
    throw new DomainError('FIXTURE_MODE_FORBIDDEN', 'Synthetic auth and storage are available only in development and test.', 503);
  }
  if (options.adapterMode !== 'local_fixture') throw new DomainError('DEPENDENCY_UNAVAILABLE', 'The canonical central adapter has not yet been configured.', 503);
  const baseUrl = options.appBaseUrl ?? 'http://localhost:3000';
  const store = new FixtureStore<State>(options.dataDir, initialState);
  function principal(actor: Actor) {
    const found = ACTORS.find(item => item.id === actor?.principal_id);
    if (!found) throw new DomainError('AUTH_REQUIRED', 'Choose a development identity to continue.', 401);
    return found;
  }
  function requireCapability(actor: Actor, capability: string) {
    const found = principal(actor);
    if (!found.capabilities.includes(capability)) throw new DomainError('CAPABILITY_REQUIRED', 'Your identity does not have permission for this operation.', 403, { capability });
    return found;
  }
  function project(state: State, actor: Actor, id: string) {
    const found = state.central.projects.find(item => item.id === id && !item.archived);
    if (!found || !principal(actor).projects.includes(id)) throw new DomainError('RESOURCE_NOT_FOUND', 'Project not found in your accessible projects.', 404);
    return found;
  }
  function workspace(state: State, actor: Actor, id: string) {
    const found = state.workspaces.find(item => item.id === id);
    if (!found) throw new DomainError('RESOURCE_NOT_FOUND', 'Workspace not found.', 404);
    project(state, actor, found.project_id);
    return found;
  }
  function projectDto(state: State, actor: Actor, item: CentralProject): Project {
    const client = state.central.clients.find(row => row.id === item.client_id);
    return { id: item.id, name: item.name, client_id: item.client_id, client_name: client?.name ?? null, client_logo_asset_id: client?.logo_asset_id ?? null, row_version: item.row_version, client_row_version: client?.row_version ?? null, casting_workspace_id: state.workspaces.find(row => row.project_id === item.id)?.id ?? null, can_edit: principal(actor).capabilities.includes('projects.write') };
  }
  function workspaceDto(state: State, actor: Actor, item: StoredWorkspace): Workspace {
    const { outputs, ...rest } = item;
    return { ...rest, title: project(state, actor, item.project_id).name, active_output: outputs[actor.principal_id] ?? 'selection' };
  }
  async function mutate<R>(actor: Actor, operation: string, input: unknown, context: MutationContext | undefined, requiredKey: boolean, action: (state: State) => Promise<R> | R, authorize?: (state: State) => void): Promise<R> {
    principal(actor);
    const key = context?.idempotencyKey;
    if (requiredKey && !key || key !== undefined && (typeof key !== 'string' || !key.trim() || key.length > 200)) invalid('A valid Idempotency-Key is required for this operation.');
    const recordKey = key ? `${actor.principal_id}:${operation}:${key}` : null;
    const digest = createHash('sha256').update(canonical(input)).digest('hex');
    return store.transaction(true, async state => {
      if (state.format_version !== 1) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Unsupported local fixture format. Preserve data and inspect before upgrading.', 503);
      authorize?.(state);
      const previous = recordKey ? state.idempotency[recordKey] : undefined;
      if (previous) {
        if (previous.digest !== digest) throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was used with different input.', 409);
        return previous.result as R;
      }
      const result = await action(state);
      if (recordKey) state.idempotency[recordKey] = { digest, result: structuredClone(result) };
      state.audit.push({ operation, principal_id: actor.principal_id, request_id: context?.requestId ?? null, client_type: context?.clientType ?? 'api', at: new Date().toISOString() });
      return result;
    });
  }
  function media(state: State, actor: Actor, id: string) {
    const found = state.media.find(item => item.asset.id === id);
    if (!found) throw new DomainError('RESOURCE_NOT_FOUND', 'Media not found.', 404);
    workspace(state, actor, found.workspace_id);
    return found;
  }
  function permittedLogo(state: State, actor: Actor, id: string) {
    const found = media(state, actor, id);
    if (found.asset.status !== 'ready' || found.asset.purpose !== 'client_logo') invalid('Select a verified ready logo asset.');
    return found;
  }
  function upload(state: State, actor: Actor, id: string, write = false) {
    const found = state.uploads.find(item => item.session.id === id);
    if (!found) throw new DomainError('RESOURCE_NOT_FOUND', 'Upload session not found.', 404);
    workspace(state, actor, found.workspace_id);
    if (write && found.principal_id !== actor.principal_id) throw new DomainError('RESOURCE_NOT_FOUND', 'Upload session not found.', 404);
    return found;
  }
  function uploadOpen(found: StoredUpload) {
    if (new Date(found.session.expires_at).getTime() <= Date.now()) throw new DomainError('UPLOAD_EXPIRED', 'Upload expired. Start another upload session.', 409);
    if (found.session.status !== 'open') throw new DomainError('INVALID_TRANSITION', 'This upload is no longer open.', 409);
  }
  const api = {
    fixtureActors() { return ACTORS.map(({ id, display_name, role }) => ({ id, display_name, role })); },
    resolveFixtureActor(id: string): Actor { const actor = { principal_id: id }; principal(actor); return Object.freeze(actor); },
    async getCapabilities(actor: Actor) {
      const user = principal(actor);
      return { principal_id: user.id, capabilities: [...user.capabilities], timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: MIMES, maximum_file_bytes: MAX_LOGO_BYTES, recommended_batch_size: 200 as const, available_purposes: ['client_logo'] } };
    },
    async listProjects(actor: Actor, args: ListOptions = {}) {
      const user = requireCapability(actor, 'projects.read');
      return store.transaction(false, state => {
        const q = searchQuery(args);
        const records = state.central.projects.filter(item => !item.archived && user.projects.includes(item.id)).map(item => projectDto(state, actor, item)).filter(item => `${item.name} ${item.client_name ?? ''}`.toLocaleLowerCase('en').includes(q));
        return paginate(records, args);
      });
    },
    async getProject(actor: Actor, id: string) { requireCapability(actor, 'projects.read'); return store.transaction(false, state => projectDto(state, actor, project(state, actor, id))); },
    async updateProject(actor: Actor, id: string, input: ProjectPatch, context?: MutationContext) {
      requireCapability(actor, 'projects.write'); checkObject(input, ['row_version', 'name', 'client_name', 'client_logo_asset_id', 'expected_client_row_version']); version(input.row_version);
      if (input.name !== undefined) text(input.name, 'name');
      if (input.client_name !== undefined) text(input.client_name, 'client_name');
      return mutate(actor, 'update_project', { id, input }, context, false, state => {
        const found = project(state, actor, id); compareVersion(input.row_version, found.row_version);
        const changesClient = input.client_name !== undefined || input.client_logo_asset_id !== undefined;
        const client = state.central.clients.find(item => item.id === found.client_id);
        if (changesClient) {
          if (!client) invalid('This project has no canonical client to edit.');
          compareVersion(input.expected_client_row_version as number, client.row_version);
          if (input.client_logo_asset_id !== undefined && input.client_logo_asset_id !== null) permittedLogo(state, actor, input.client_logo_asset_id);
          if (input.client_name !== undefined) client.name = text(input.client_name, 'client_name');
          if (input.client_logo_asset_id !== undefined) client.logo_asset_id = input.client_logo_asset_id;
          client.row_version++;
        }
        if (input.name !== undefined) found.name = text(input.name, 'name');
        found.row_version++;
        for (const item of state.workspaces.filter(row => row.project_id === id || changesClient && state.central.projects.find(centralProject => centralProject.id === row.project_id)?.client_id === found.client_id)) {
          item.draft_revision++; item.row_version++; item.has_unpublished_changes = true; item.updated_at = new Date().toISOString();
        }
        return projectDto(state, actor, found);
      });
    },
    async listWorkspaces(actor: Actor, args: ListOptions & { project_id?: string } = {}) {
      const user = requireCapability(actor, 'workspaces.read');
      const q = searchQuery(args);
      return store.transaction(false, state => paginate(state.workspaces.filter(item => user.projects.includes(item.project_id) && state.central.projects.some(row => row.id === item.project_id && !row.archived) && (!args.project_id || item.project_id === args.project_id)).map(item => workspaceDto(state, actor, item)).filter(item => item.title.toLocaleLowerCase('en').includes(q)), args));
    },
    async createWorkspace(actor: Actor, input: WorkspaceCreate, context?: MutationContext) {
      requireCapability(actor, 'projects.read'); requireCapability(actor, 'workspaces.write'); checkObject(input, ['project_id', 'initial_output']); text(input.project_id, 'project_id');
      if (!['selection', 'shortlist'].includes(input.initial_output)) invalid('initial_output must be selection or shortlist.');
      return mutate(actor, 'create_workspace', input, context, true, state => {
        const central = project(state, actor, input.project_id);
        let found = state.workspaces.find(item => item.project_id === central.id);
        if (!found) {
          const now = new Date().toISOString();
          found = { id: randomUUID(), project_id: central.id, module: 'casting', logo_asset_id: null, logo_placement: 'cover', row_version: 1, draft_revision: 0, has_unpublished_changes: false, created_at: now, updated_at: now, outputs: {} };
          state.workspaces.push(found);
        }
        found.outputs[actor.principal_id] ??= input.initial_output;
        return workspaceDto(state, actor, found);
      });
    },
    async getWorkspace(actor: Actor, id: string) { requireCapability(actor, 'workspaces.read'); return store.transaction(false, state => workspaceDto(state, actor, workspace(state, actor, id))); },
    async updateWorkspace(actor: Actor, id: string, input: WorkspacePatch, context?: MutationContext) {
      requireCapability(actor, 'workspaces.write'); checkObject(input, ['row_version', 'logo_asset_id', 'logo_placement', 'active_output']); version(input.row_version);
      if (input.logo_placement !== undefined && !['cover', 'every_slide'].includes(input.logo_placement)) invalid('Unsupported logo placement.');
      if (input.active_output !== undefined && !['selection', 'shortlist'].includes(input.active_output)) invalid('Unsupported output.');
      return mutate(actor, 'update_workspace', { id, input }, context, false, state => {
        const found = workspace(state, actor, id); compareVersion(input.row_version, found.row_version);
        if (input.logo_asset_id !== undefined) {
          if (input.logo_asset_id !== null) permittedLogo(state, actor, input.logo_asset_id);
          found.logo_asset_id = input.logo_asset_id;
        }
        if (input.logo_placement !== undefined) found.logo_placement = input.logo_placement;
        if (input.active_output !== undefined) found.outputs[actor.principal_id] = input.active_output;
        if (input.logo_asset_id !== undefined || input.logo_placement !== undefined) { found.row_version++; found.draft_revision++; found.has_unpublished_changes = true; found.updated_at = new Date().toISOString(); }
        return workspaceDto(state, actor, found);
      });
    },
    async listAudiencePresets(actor: Actor, args: ListOptions = {}) { requireCapability(actor, 'workspaces.read'); const q = searchQuery(args); return store.transaction(false, state => paginate(state.presets.filter(item => !item.archived && `${item.label} ${item.key}`.toLocaleLowerCase('en').includes(q)), args)); },
    async createAudiencePreset(actor: Actor, input: AudiencePresetCreate, context?: MutationContext) {
      requireCapability(actor, 'settings.manage'); checkObject(input, ['key', 'label', 'scope', 'settings']); text(input.label, 'label'); checkObject(input.settings, []);
      if (!['internal', 'external'].includes(input.scope)) invalid('Unsupported audience scope.');
      return mutate(actor, 'create_audience_preset', input, context, true, state => {
        const key = input.key === undefined ? `custom_${randomUUID()}` : text(input.key, 'key', 100);
        if (state.presets.some(item => item.key === key)) throw new DomainError('AUDIENCE_PRESET_EXISTS', 'This preset key already exists.', 409);
        const preset: AudiencePreset = { id: randomUUID(), key, label: text(input.label, 'label'), scope: input.scope, settings: {}, archived: false, row_version: 1 }; state.presets.push(preset); return preset;
      });
    },
    async updateAudiencePreset(actor: Actor, id: string, input: AudiencePresetPatch, context?: MutationContext) {
      requireCapability(actor, 'settings.manage'); checkObject(input, ['row_version', 'label', 'settings']); version(input.row_version); if (input.label !== undefined) text(input.label, 'label'); if (input.settings !== undefined) checkObject(input.settings, []);
      return mutate(actor, 'update_audience_preset', { id, input }, context, false, state => { const found = state.presets.find(item => item.id === id && !item.archived); if (!found) throw new DomainError('RESOURCE_NOT_FOUND', 'Audience preset not found.', 404); compareVersion(input.row_version, found.row_version); if (input.label !== undefined) found.label = text(input.label, 'label'); found.row_version++; return found; });
    },
    async archiveAudiencePreset(actor: Actor, id: string, input: { row_version: number; reason?: string | null }, context?: MutationContext) {
      requireCapability(actor, 'settings.manage'); checkObject(input, ['row_version', 'reason']); version(input.row_version); if (input.reason !== undefined && input.reason !== null) text(input.reason, 'reason', 2000);
      return mutate(actor, 'archive_audience_preset', { id, input }, context, true, state => { const found = state.presets.find(item => item.id === id); if (!found) throw new DomainError('RESOURCE_NOT_FOUND', 'Audience preset not found.', 404); compareVersion(input.row_version, found.row_version); found.archived = true; found.row_version++; return { success: true as const, affected_ids: [id] }; });
    },
    async createUploadSession(actor: Actor, input: UploadSessionCreate, context?: MutationContext): Promise<UploadSession> {
      requireCapability(actor, 'workspaces.write'); checkObject(input, ['workspace_id', 'candidate_id', 'batch_id', 'purpose', 'filename', 'mime_type', 'size_bytes', 'sha256']);
      if (input.purpose !== 'client_logo') throw new DomainError('FEATURE_NOT_IMPLEMENTED', 'Only client-logo uploads are implemented in this development slice.', 503);
      if (!input.workspace_id) invalid('Select a workspace for the logo upload.');
      if (input.candidate_id !== undefined || input.batch_id !== undefined) invalid('Candidate and batch scope do not apply to a client logo.');
      const filename = text(input.filename, 'filename', 255); if (/[\\/]/u.test(filename)) invalid('filename must be a simple filename.');
      if (!MIMES.includes(input.mime_type) || !Number.isSafeInteger(input.size_bytes) || input.size_bytes < 1 || input.size_bytes > MAX_LOGO_BYTES) invalid('Logo must be PNG, JPEG or WebP up to 5 MiB.');
      if (input.sha256 !== undefined && !/^[a-f0-9]{64}$/u.test(input.sha256)) invalid('sha256 must be lowercase hexadecimal.');
      const created = await mutate(actor, 'create_upload_session', input, context, true, state => {
        workspace(state, actor, input.workspace_id!);
        const id = randomUUID(); const assetId = randomUUID(); const created = new Date().toISOString();
        const session: UploadSession = { id, asset_id: assetId, protocol: 'signed_put', upload_url: `${baseUrl}/api/dev/uploads/${id}/bytes`, upload_headers: { 'Content-Type': input.mime_type }, expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), status: 'open', maximum_bytes: MAX_LOGO_BYTES };
        state.uploads.push({ session, workspace_id: input.workspace_id!, principal_id: actor.principal_id, expected_bytes: input.size_bytes, expected_sha256: input.sha256, received: false });
        state.media.push({ workspace_id: input.workspace_id!, asset: { id: assetId, purpose: 'client_logo', filename, mime_type: input.mime_type, size_bytes: input.size_bytes, sha256: null, status: 'uploading', duration_ms: null, width: null, height: null, source_asset_id: null, source_timestamp_ms: null, created_at: created } });
        return session;
      }, state => { workspace(state, actor, input.workspace_id!); });
      // Replay identifies the original reservation, but its transfer capability
      // must reflect current state rather than the original open response.
      return api.getUploadSession(actor, created.id);
    },
    async getUploadSession(actor: Actor, id: string) {
      requireCapability(actor, 'workspaces.read');
      return store.transaction(false, state => {
        const result = { ...upload(state, actor, id).session };
        if (result.status === 'open' && new Date(result.expires_at).getTime() <= Date.now()) result.status = 'expired';
        if (result.status !== 'open') { result.upload_url = null; result.upload_headers = {}; }
        return result;
      });
    },
    /** Internal storage adapter entrypoint; actual image decoder is supplied by the web runtime. */
    async storeUploadedLogo(actor: Actor, id: string, bytes: Uint8Array) {
      requireCapability(actor, 'workspaces.write');
      if (bytes.byteLength < 1 || bytes.byteLength > MAX_LOGO_BYTES) invalid('Logo exceeds the allowed size.');
      await store.transaction(false, state => {
        const found = upload(state, actor, id, true); uploadOpen(found);
        if (found.expected_bytes !== bytes.byteLength) invalid('Uploaded bytes do not match the reserved size.');
      });
      if (!options.decodeLogo) throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Image verification is unavailable in this runtime.', 503);
      const decoded = await options.decodeLogo(bytes).catch(() => { throw new DomainError('SOURCE_UNREADABLE', 'This image could not be decoded. Upload a valid PNG, JPEG or WebP.'); });
      if (!MIMES.includes(decoded.mimeType) || !Number.isInteger(decoded.width) || decoded.width < 1 || !Number.isInteger(decoded.height) || decoded.height < 1 || decoded.width * decoded.height > 40_000_000) invalid('Unsupported image dimensions.');
      return mutate(actor, 'store_uploaded_logo', { id, sha256: createHash('sha256').update(bytes).digest('hex') }, undefined, false, async state => {
        const found = upload(state, actor, id, true); uploadOpen(found);
        const asset = media(state, actor, found.session.asset_id).asset;
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        if (bytes.byteLength !== found.expected_bytes || decoded.mimeType !== asset.mime_type || found.expected_sha256 && found.expected_sha256 !== sha256) invalid('Uploaded bytes do not match the reserved size, type or checksum.');
        const folder = join(store.root, 'assets'); await mkdir(folder, { recursive: true, mode: 0o700 });
        if (found.received && asset.sha256 !== sha256) throw new DomainError('UPLOAD_CONTENT_ALREADY_WRITTEN', 'This upload already contains different bytes. Start a new session.', 409);
        await store.atomicWrite(join(folder, `${asset.id}.bin`), bytes);
        asset.sha256 = sha256; asset.width = decoded.width; asset.height = decoded.height; found.received = true;
        return { size_bytes: bytes.byteLength, sha256 };
      });
    },
    async completeUpload(actor: Actor, id: string, input: CompleteUpload, context?: MutationContext): Promise<UploadCompletion> {
      requireCapability(actor, 'workspaces.write'); checkObject(input, ['sha256', 'actual_size_bytes', 'start_processing']);
      if (!Number.isSafeInteger(input.actual_size_bytes) || input.actual_size_bytes < 1 || typeof input.start_processing !== 'boolean') invalid('Completion requires actual_size_bytes and start_processing.');
      if (input.sha256 !== undefined && !/^[a-f0-9]{64}$/u.test(input.sha256)) invalid('Invalid SHA256 checksum.');
      return mutate(actor, 'complete_upload', { id, input }, context, true, async state => {
        const found = upload(state, actor, id, true);
        const asset = media(state, actor, found.session.asset_id).asset;
        if (found.session.status === 'completed') {
          if (input.actual_size_bytes !== asset.size_bytes || input.sha256 && input.sha256 !== asset.sha256) invalid('Completed upload does not match this completion request.');
          return { asset, processing_job_id: null, status: 'ready' as const };
        }
        uploadOpen(found);
        if (!found.received) throw new DomainError('UPLOAD_INCOMPLETE', 'Upload the file bytes before completing this session.', 409);
        let bytes: Buffer;
        try { bytes = await readFile(join(store.root, 'assets', `${asset.id}.bin`)); }
        catch { throw new DomainError('UPLOAD_INCOMPLETE', 'The stored upload bytes are unavailable.', 409); }
        const digest = createHash('sha256').update(bytes).digest('hex');
        if (input.actual_size_bytes !== bytes.byteLength || bytes.byteLength !== found.expected_bytes || digest !== asset.sha256 || input.sha256 && input.sha256 !== digest) invalid('Stored upload verification failed.');
        asset.status = 'ready'; asset.size_bytes = bytes.byteLength; found.session.status = 'completed';
        return { asset, processing_job_id: null, status: 'ready' as const };
      });
    },
    async cancelUpload(actor: Actor, id: string, context?: MutationContext) {
      requireCapability(actor, 'workspaces.write');
      return mutate(actor, 'cancel_upload', { id }, context, true, state => { const found = upload(state, actor, id, true); if (found.session.status === 'completed') throw new DomainError('INVALID_TRANSITION', 'Completed uploads cannot be cancelled.', 409); found.session.status = 'cancelled'; media(state, actor, found.session.asset_id).asset.status = 'failed'; return { success: true as const, affected_ids: [id, found.session.asset_id] }; });
    },
    async getMedia(actor: Actor, id: string) { requireCapability(actor, 'workspaces.read'); return store.transaction(false, state => media(state, actor, id).asset); },
    async getMediaContent(actor: Actor, id: string) {
      requireCapability(actor, 'workspaces.read');
      const asset = await store.transaction(false, state => { const found = media(state, actor, id).asset; if (found.status !== 'ready') throw new DomainError('RESOURCE_NOT_FOUND', 'Ready media not found.', 404); return found; });
      try { return { bytes: await readFile(join(store.root, 'assets', `${asset.id}.bin`)), mimeType: asset.mime_type }; }
      catch { throw new DomainError('DEPENDENCY_UNAVAILABLE', 'Stored media is unavailable.', 503); }
    },
  };
  return api;
}
export type Studio = ReturnType<typeof createStudio>;
