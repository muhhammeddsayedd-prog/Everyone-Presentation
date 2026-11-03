import { type Envelope, type Workspace } from './api';
import { logoTransferDestination } from '../lib/logo-transfer';

type Request = { key: string; body: string };
type Stage = 'reserving' | 'uploading' | 'verifying' | 'selecting' | 'closed';
export type LogoUploadIntent = {
  version: 1; actorId: string; workspaceId: string; projectId: string; workspaceVersion: number; previousLogo: string | null;
  file: { name: string; type: string; size: number; sha256: string };
  reserve: Request; complete: Request; patch: Request | null;
  session: { id: string; assetId: string } | null; transferAttempted: boolean; readyAssetId: string | null; stage: Stage;
};
type Session = { id: string; asset_id: string; status: 'open' | 'completed' | 'cancelled' | 'expired'; expires_at: string; upload_url: string | null; upload_headers: Record<string, string> };
export class LogoSelectionConflict extends Error {
  constructor() { super('Saved branding changed while this logo was being checked. Reload it, then choose whether to use this verified logo.'); }
}
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,200}$/u.test(v);
const positive = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) > 0;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: unknown, fields: string[]) => record(v) && Object.keys(v).sort().join(',') === [...fields].sort().join(',');
function fail(): never { throw new Error('The saved logo upload could not be confirmed. No new upload was sent.'); }
export function logoRecoveryKey(actorId: string, workspaceId: string) {
  if (!id(actorId) || !id(workspaceId)) fail();
  return `eps.logo-upload.v1:${actorId}:${workspaceId}`;
}
export async function captureLogoUpload(actorId: string, workspace: Workspace, file: File): Promise<LogoUploadIntent> {
  logoRecoveryKey(actorId, workspace.id);
  if (!positive(workspace.row_version) || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || !positive(file.size) || file.size > 5 * 1024 * 1024) fail();
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), x => x.toString(16).padStart(2, '0')).join('');
  return { version: 1, actorId, workspaceId: workspace.id, projectId: workspace.project_id, workspaceVersion: workspace.row_version, previousLogo: workspace.logo_asset_id,
    file: { name: file.name, type: file.type, size: file.size, sha256 },
    reserve: { key: crypto.randomUUID(), body: JSON.stringify({ workspace_id: workspace.id, purpose: 'client_logo', filename: file.name, mime_type: file.type, size_bytes: file.size, sha256 }) },
    complete: { key: crypto.randomUUID(), body: JSON.stringify({ actual_size_bytes: file.size, start_processing: false, sha256 }) },
    patch: null, session: null, transferAttempted: false, readyAssetId: null, stage: 'reserving' };
}
/** Tab-local recovery holds no file bytes, bearer, signed URL or Storage headers. */
export function parseLogoUpload(raw: string | null, actorId: string, workspaceId: string): LogoUploadIntent | null {
  if (raw === null) return null;
  try {
    if (raw.length > 16_384) fail();
    const v: unknown = JSON.parse(raw);
    if (!exact(v, ['version','actorId','workspaceId','projectId','workspaceVersion','previousLogo','file','reserve','complete','patch','session','transferAttempted','readyAssetId','stage']) || !record(v)) fail();
    if (v.version !== 1 || v.actorId !== actorId || v.workspaceId !== workspaceId || !id(v.projectId) || !positive(v.workspaceVersion)
      || !(v.previousLogo === null || id(v.previousLogo)) || typeof v.transferAttempted !== 'boolean' || !(v.readyAssetId === null || id(v.readyAssetId))
      || !['reserving','uploading','verifying','selecting','closed'].includes(String(v.stage)) || !exact(v.file, ['name','type','size','sha256']) || !record(v.file)) fail();
    const f = v.file;
    if (typeof f.name !== 'string' || !f.name || f.name.length > 255 || /[\p{C}/\\]/u.test(f.name) || !['image/png','image/jpeg','image/webp'].includes(String(f.type)) || !positive(f.size) || f.size > 5 * 1024 * 1024 || typeof f.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(f.sha256)) fail();
    for (const request of [v.reserve, v.complete, ...(v.patch === null ? [] : [v.patch])]) if (!exact(request, ['key','body']) || !record(request) || !id(request.key) || typeof request.body !== 'string') fail();
    const intent = v as unknown as LogoUploadIntent;
    if (intent.reserve.body !== JSON.stringify({ workspace_id: workspaceId, purpose: 'client_logo', filename: f.name, mime_type: f.type, size_bytes: f.size, sha256: f.sha256 })
      || intent.complete.body !== JSON.stringify({ actual_size_bytes: f.size, start_processing: false, sha256: f.sha256 })) fail();
    if (intent.session !== null && (!exact(intent.session, ['id','assetId']) || !id(intent.session.id) || !id(intent.session.assetId))) fail();
    if ((intent.transferAttempted || intent.readyAssetId !== null) && !intent.session || intent.readyAssetId !== null && intent.readyAssetId !== intent.session?.assetId) fail();
    if (intent.patch) {
      const body: unknown = JSON.parse(intent.patch.body);
      if (!exact(body, ['row_version','logo_asset_id']) || !record(body) || !positive(body.row_version) || body.logo_asset_id !== intent.readyAssetId || !intent.readyAssetId) fail();
    }
    return intent;
  } catch { return fail(); }
}
export interface LogoUploadPorts {
  json: (path: string, init?: RequestInit) => Promise<Envelope<unknown>>; put: typeof fetch; origin: string;
  checkpoint: (intent: LogoUploadIntent) => void; active: () => boolean; stage?: (stage: Stage) => void;
}
export async function finishLogoUpload(intent: LogoUploadIntent, ports: LogoUploadPorts, file?: File, acceptedBranding?: Workspace): Promise<Workspace> {
  const move = (stage: Stage) => { intent.stage = stage; ports.checkpoint(intent); ports.stage?.(stage); };
  const active = () => { if (!ports.active()) throw new Error('The stored logo is kept. Return to branding to finish it.'); };
  const send = async (path: string, request: Request, method = 'POST') => {
    active(); ports.checkpoint(intent);
    return (await ports.json(path, { method, headers: { 'Idempotency-Key': request.key }, body: request.body })).data;
  };
  const readSession = (v: unknown): Session => {
    if (!record(v) || !id(v.id) || !id(v.asset_id) || !['open','completed','cancelled','expired'].includes(String(v.status)) || typeof v.expires_at !== 'string' || !Number.isFinite(Date.parse(v.expires_at))
      || intent.session && (v.id !== intent.session.id || v.asset_id !== intent.session.assetId) || !(v.upload_url === null || typeof v.upload_url === 'string') || !record(v.upload_headers) || Object.values(v.upload_headers).some(x => typeof x !== 'string')) fail();
    return v as unknown as Session;
  };
  active();
  const session = readSession(intent.session ? (await ports.json(`/api/v1/uploads/${encodeURIComponent(intent.session.id)}`)).data : await send('/api/v1/uploads', intent.reserve));
  intent.session = { id: session.id, assetId: session.asset_id }; ports.checkpoint(intent);
  if (session.status === 'cancelled' || session.status === 'expired' || session.status === 'open' && Date.parse(session.expires_at) <= Date.now()) {
    move('closed'); throw new Error('This upload is cancelled or expired. Its original is kept; choose another logo to start again.');
  }
  if (!intent.readyAssetId) {
    if (!intent.transferAttempted && session.status === 'open') {
      if (!file) throw new Error('Select the same original logo to continue this stored upload.');
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), x => x.toString(16).padStart(2, '0')).join('');
      if (hash !== intent.file.sha256 || file.size !== intent.file.size || file.type !== intent.file.type || file.name !== intent.file.name) throw new Error('Choose the same original logo. This upload is reserved for that file.');
      const target = logoTransferDestination(session.upload_url ?? '', ports.origin, session.id);
      active(); intent.transferAttempted = true; move('uploading');
      const response = await ports.put(target.url, { method: 'PUT', credentials: target.credentials, redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer', headers: { ...session.upload_headers, 'Content-Type': intent.file.type }, body: file });
      void response.body?.cancel().catch(() => undefined);
      if (!response.ok) throw new Error('The transfer could not be confirmed. Check this upload to finish checking any stored file.');
    }
    // An open session cannot prove an uncertain immutable PUT did not store bytes.
    // Recheck completion with the same intent; never automatically retransmit.
    move('verifying');
    const result = await send(`/api/v1/uploads/${encodeURIComponent(session.id)}/complete`, intent.complete);
    if (!record(result) || result.status !== 'ready' || result.processing_job_id !== null || !record(result.asset) || result.asset.id !== session.asset_id || result.asset.status !== 'ready' || result.asset.purpose !== 'client_logo') fail();
    intent.readyAssetId = session.asset_id; move('selecting');
  } else if (session.status !== 'completed') fail();
  active();
  const path = `/api/v1/workspaces/${encodeURIComponent(intent.workspaceId)}`;
  const current = (await ports.json(path)).data;
  if (!record(current) || current.id !== intent.workspaceId || current.project_id !== intent.projectId || !positive(current.row_version) || !(current.logo_asset_id === null || id(current.logo_asset_id))) fail();
  if (current.logo_asset_id === intent.readyAssetId) return current as unknown as Workspace;
  if (acceptedBranding) {
    if (acceptedBranding.id !== intent.workspaceId || acceptedBranding.project_id !== intent.projectId || acceptedBranding.row_version !== current.row_version || acceptedBranding.logo_asset_id !== current.logo_asset_id) throw new LogoSelectionConflict();
    intent.workspaceVersion = current.row_version; intent.previousLogo = current.logo_asset_id; intent.patch = null;
  }
  if (current.row_version !== intent.workspaceVersion || current.logo_asset_id !== intent.previousLogo) throw new LogoSelectionConflict();
  intent.patch ??= { key: crypto.randomUUID(), body: JSON.stringify({ row_version: intent.workspaceVersion, logo_asset_id: intent.readyAssetId }) };
  move('selecting');
  const saved = await send(path, intent.patch, 'PATCH');
  if (!record(saved) || saved.id !== intent.workspaceId || saved.project_id !== intent.projectId || saved.logo_asset_id !== intent.readyAssetId || !positive(saved.row_version) || saved.row_version <= intent.workspaceVersion) fail();
  return saved as unknown as Workspace;
}
