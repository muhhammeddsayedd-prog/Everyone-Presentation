import { createHash, randomUUID } from 'node:crypto';
import { open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyCentralUser, type CentralStudio } from '@eps/central';
import { DomainError, type UploadSession } from '@eps/domain';

export const LOGO_PROBE_PROJECT = '4b70c8ce-18bd-4a8c-b5a9-bc1156c06463';
const ORIGIN = 'https://pyibofyctwnqpvktepse.supabase.co';
const BUCKET = 'eps-brand-assets';
const APPROVED_SHA256 = '9c751250590cd298ca52c1e9a4717e38d17cce297ff50b1c36d01c844fb74e27';
// Fixed valid 20px test raster, used only for attempted overwrites of this run's
// disposable asset. The presented/initial approved brand image is never edited.
const OVERWRITE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAJklEQVQ4jWO4LFj4n5qYYdTA/6Nh+H802fwfzSn/RwuH/yOwPAQAiVKjbkdfq4gAAAAASUVORK5CYII=', 'base64');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
type Environment = Readonly<Record<string, string | undefined>>;
type ProbeStudio = Pick<CentralStudio, 'verifiedIdentity' | 'getWorkspace' | 'getProject' | 'getCapabilities' |
  'createUploadSession' | 'completeUpload' | 'cancelUpload' | 'getUploadSession' | 'getMediaContent'>;
type Outcome = { http_status: number | null; provider_status: number | null; accepted: boolean };
export interface LogoProbeCheck extends Outcome { case: string; passed: boolean; unsafe_response: boolean; no_effect: boolean }
export interface LogoProbeReport {
  schema_version: '1.0'; observed_at: string; request_id: string; project_id: string; workspace_id: string;
  upload_id: string | null; asset_id: string | null; result: 'passed' | 'failed'; stop_code: string | null;
  cancellation_upload_id: string | null; cancellation_asset_id: string | null;
  checks: LogoProbeCheck[]; image: { sha256: string; size_bytes: number; width: number; height: number } | null;
  ready_bytes_unchanged: boolean | null; reservation_cancelled: boolean | null;
  shared_record_mutations_requested: false; existing_assets_targeted: false;
  normal_ui_flow_tested: false; cross_actor_tested: false; actual_expiry_tested: false; issued_token_instant_revocation_tested: false;
}
function denied(): never { throw new DomainError('RESOURCE_NOT_FOUND', 'This development check is unavailable.', 404); }
export function requireCentralLogoProbe(env: Environment = process.env) {
  if (env.NODE_ENV !== 'development' || env.APP_ENV !== 'development' || env.CENTRAL_ADAPTER_MODE !== 'supabase'
    || env.EPS_CENTRAL_LOGO_PROBE_ENABLED !== 'true' || env.SUPABASE_URL !== ORIGIN) denied();
}
export function probeWorkspaceInput(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1
    || !Object.hasOwn(value, 'workspace_id') || typeof (value as { workspace_id?: unknown }).workspace_id !== 'string'
    || !UUID.test((value as { workspace_id: string }).workspace_id)) {
    throw new DomainError('INVALID_REQUEST', 'Provide only the test workspace identifier.', 400);
  }
  return (value as { workspace_id: string }).workspace_id;
}
/** Fixed reviewed repository asset only; no caller path, upload or generated image. */
export async function readApprovedProbeLogo(): Promise<Buffer> {
  let root = process.cwd();
  while (!existsSync(path.join(root, 'CONTRACT_BASELINE.md'))) {
    const parent = path.dirname(root); if (parent === root) denied(); root = parent;
  }
  const handle = await open(path.join(root, 'Design Elements/assets/brand/everyone-wordmark-on-black.png'), 'r');
  try {
    const bytes = Buffer.alloc(65_537); let length = 0;
    while (length < bytes.length) {
      const next = await handle.read(bytes, length, bytes.length - length, null);
      if (!next.bytesRead) break; length += next.bytesRead;
    }
    const result = bytes.subarray(0, length);
    if (length === 0 || length > 65_536 || digest(result) !== APPROVED_SHA256) denied();
    return result;
  } finally { await handle.close(); }
}
function digest(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex'); }
function status(value: unknown): number | null {
  return (typeof value === 'number' || typeof value === 'string') && /^\d{3}$/u.test(String(value))
    && Number(value) >= 100 && Number(value) <= 599 ? Number(value) : null;
}
function sdkOutcome(value: { data: unknown; error: unknown }): Outcome {
  const error = value.error && typeof value.error === 'object' ? value.error as { status?: unknown; statusCode?: unknown } : {};
  return { accepted: !value.error || value.data !== null && value.data !== undefined, http_status: status(error.status), provider_status: status(error.statusCode) };
}
function hasStatus(value: Outcome, expected: number) {
  // Storage's legacy envelope can wrap a numeric denial in HTTP 400. Unknown
  // transport errors and 5xx must never qualify just because a body names 403.
  return !value.accepted && (value.http_status === expected || value.http_status === 400 && value.provider_status === expected);
}
function isForbidden(value: Outcome) { return hasStatus(value, 403); }
class ProbeStop extends Error { constructor(readonly code: string) { super(code); } }
function transfer(session: UploadSession) {
  if (!UUID.test(session.id) || !UUID.test(session.asset_id) || session.status !== 'open' || !session.upload_url) throw new ProbeStop('SESSION_INVALID');
  let target: URL;
  try { target = new URL(session.upload_url); } catch { throw new ProbeStop('SESSION_INVALID'); }
  const key = `assets/${session.asset_id}/original.png`;
  if (target.origin !== ORIGIN || target.pathname !== `/storage/v1/object/upload/sign/${BUCKET}/${key}` || target.username || target.password || target.hash
    || [...target.searchParams.keys()].some(name => name !== 'token') || target.searchParams.getAll('token').length !== 1
    || !target.searchParams.get('token') || target.href.length > 16_384) throw new ProbeStop('SESSION_INVALID');
  return { url: target.href, key };
}
async function transferOutcome(response: Response): Promise<Outcome> {
  let provider: number | null = null;
  if (!response.ok && response.body) {
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) {
        const next = await reader.read(); if (next.done) break; size += next.value.byteLength;
        if (size > 4096) break; chunks.push(next.value);
      }
      if (size <= 4096) { try { provider = status(JSON.parse(Buffer.concat(chunks).toString('utf8'))?.statusCode); } catch { /* No raw body escapes. */ } }
    } finally { void reader.cancel().catch(() => undefined); reader.releaseLock(); }
  } else { void response.body?.cancel().catch(() => undefined); }
  return { accepted: response.ok, http_status: response.status, provider_status: provider };
}
/** No shared-record writes; every dangerous attempt names this request's new asset. */
export async function runCentralLogoProbe(options: { client: SupabaseClient; studio: ProbeStudio; workspaceId: string;
  logoBytes: Uint8Array; requestId: string; env?: Environment; transferFetch?: typeof fetch }): Promise<LogoProbeReport> {
  requireCentralLogoProbe(options.env);
  const workspaceId = probeWorkspaceInput({ workspace_id: options.workspaceId });
  if (digest(options.logoBytes) !== APPROVED_SHA256 || options.logoBytes.byteLength > 65_536) denied();
  const identity = await verifyCentralUser(options.client);
  if (identity.principal_id !== options.studio.verifiedIdentity.principal_id) denied();
  const actor = { principal_id: identity.principal_id };
  const workspace = await options.studio.getWorkspace(actor, workspaceId);
  if (workspace.project_id !== LOGO_PROBE_PROJECT) denied();
  const project = await options.studio.getProject(actor, LOGO_PROBE_PROJECT);
  const capability = await options.studio.getCapabilities(actor);
  if (project.id !== LOGO_PROBE_PROJECT || !capability.capabilities.includes('workspaces.write')
    || !capability.upload_policy.available_purposes.includes('client_logo')) denied();
  const report: LogoProbeReport = { schema_version: '1.0', observed_at: new Date().toISOString(), request_id: options.requestId,
    project_id: LOGO_PROBE_PROJECT, workspace_id: workspaceId, upload_id: null, asset_id: null, cancellation_upload_id: null, cancellation_asset_id: null,
    result: 'failed', stop_code: null, checks: [], image: null, ready_bytes_unchanged: null, reservation_cancelled: null,
    shared_record_mutations_requested: false, existing_assets_targeted: false,
    normal_ui_flow_tested: false, cross_actor_tested: false, actual_expiry_tested: false, issued_token_instant_revocation_tested: false };
  const deadline = Date.now() + 90_000;
  const budget = () => { if (Date.now() > deadline) throw new ProbeStop('PROBE_TIME_BUDGET'); };
  const context = () => ({ idempotencyKey: randomUUID(), requestId: options.requestId, clientType: 'browser' as const });
  let session: UploadSession | undefined; let cancellation: UploadSession | undefined; let ready = false;
  function check(name: string, outcome: Outcome, passed: boolean, unsafe = false, noEffect = false) {
    report.checks.push({ case: name, ...outcome, passed, unsafe_response: unsafe, no_effect: noEffect });
    if (!passed) throw new ProbeStop(unsafe ? 'UNSAFE_STORAGE_RESPONSE' : 'CHECK_NOT_ESTABLISHED');
  }
  async function integrity() {
    budget(); let content: Awaited<ReturnType<ProbeStudio['getMediaContent']>>;
    try { content = await options.studio.getMediaContent(actor, session!.asset_id); }
    catch (error) {
      if (error instanceof DomainError && ['SOURCE_UNREADABLE', 'UPLOAD_INCOMPLETE'].includes(error.code)) {
        report.ready_bytes_unchanged = false; throw new ProbeStop('READY_BYTES_CHANGED');
      }
      throw error;
    }
    const unchanged = content.bytes.length === options.logoBytes.byteLength && digest(content.bytes) === APPROVED_SHA256;
    report.ready_bytes_unchanged = unchanged;
    if (!unchanged) throw new ProbeStop('READY_BYTES_CHANGED');
  }
  async function negative(name: string, operation: () => Promise<{ data: unknown; error: unknown }>,
    policy: { readyMutation?: boolean; filteredDelete?: boolean } = {}) {
    // Scoped 404 is meaningful only for this known-existing Ready target. Mint
    // paths do not opt into this rule, including a cancelled reservation's mint.
    if (policy.readyMutation) { if (!ready) throw new ProbeStop('CHECK_NOT_ESTABLISHED'); await integrity(); }
    budget(); const result = await operation(); const outcome = sdkOutcome(result);
    // DELETE can filter unauthorized rows and return an empty successful list.
    // Treat it as no effect only after independently verifying the Ready bytes.
    if (policy.readyMutation && policy.filteredDelete && !result.error && Array.isArray(result.data) && result.data.length === 0) {
      await integrity(); check(name, outcome, true, false, true); return;
    }
    if (policy.readyMutation && hasStatus(outcome, 404)) {
      await integrity(); check(name, outcome, true, false, true); return;
    }
    check(name, outcome, isForbidden(outcome), outcome.accepted);
    if (ready) await integrity();
  }
  async function put(url: string, upsert: boolean, bytes: Uint8Array = options.logoBytes) {
    budget(); const response = await (options.transferFetch ?? fetch)(url, { method: 'PUT', body: new Uint8Array(bytes),
      headers: { 'Content-Type': 'image/png', 'x-upsert': String(upsert) }, credentials: 'omit', referrerPolicy: 'no-referrer',
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) });
    return transferOutcome(response);
  }
  try {
    budget(); session = await options.studio.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo',
      filename: 'everyone-probe-only.png', mime_type: 'image/png', size_bytes: options.logoBytes.byteLength, sha256: APPROVED_SHA256 }, context());
    const destination = transfer(session);
    report.upload_id = session.id; report.asset_id = session.asset_id;
    budget(); const missing = await options.client.storage.from(BUCKET).download(destination.key, {}, { signal: AbortSignal.timeout(15_000), cache: 'no-store' }).asStream();
    const missingOutcome = sdkOutcome(missing); void missing.data?.cancel().catch(() => undefined);
    check('fresh_object_absent', missingOutcome, hasStatus(missingOutcome, 404));
    check('mint_explicit_false_before_object', { accepted: true, http_status: null, provider_status: null }, true);
    await negative('mint_upsert_true_before_object', () => options.client.storage.from(BUCKET).setHeader('x-upsert', 'true').createSignedUploadUrl(destination.key, { upsert: true }));
    await negative('mint_omitted_header_before_object', () => options.client.storage.from(BUCKET).createSignedUploadUrl(destination.key, { upsert: false }));
    await negative('mint_malformed_header_before_object', () => options.client.storage.from(BUCKET).setHeader('x-upsert', 'FALSE').createSignedUploadUrl(destination.key, { upsert: false }));
    await negative('mint_operation_spoof_before_object', () => options.client.storage.from(BUCKET).setHeader('x-storage-operation', 'storage.object.upload').setHeader('x-upsert', 'true').createSignedUploadUrl(destination.key, { upsert: true }));
    const uploaded = await put(destination.url, false);
    check('explicit_false_signed_transfer', uploaded, uploaded.accepted);
    budget(); const completed = await options.studio.completeUpload(actor, session.id, { actual_size_bytes: options.logoBytes.byteLength, start_processing: false, sha256: APPROVED_SHA256 }, context());
    ready = true;
    if (completed.asset.id !== session.asset_id || completed.asset.sha256 !== APPROVED_SHA256 || completed.asset.status !== 'ready'
      || completed.asset.width !== 447 || completed.asset.height !== 447) throw new ProbeStop('COMPLETION_NOT_VERIFIED');
    report.image = { sha256: APPROVED_SHA256, size_bytes: completed.asset.size_bytes, width: completed.asset.width, height: completed.asset.height };
    await integrity();
    const replay = await put(destination.url, true, OVERWRITE_PNG);
    check('signed_false_token_cannot_promote_or_replace', replay, hasStatus(replay, 409) || isForbidden(replay), replay.accepted);
    await integrity();
    await negative('ready_direct_upsert', () => options.client.storage.from(BUCKET).upload(destination.key, OVERWRITE_PNG, { contentType: 'image/png', upsert: true }), { readyMutation: true });
    await negative('ready_update', () => options.client.storage.from(BUCKET).update(destination.key, OVERWRITE_PNG, { contentType: 'image/png' }), { readyMutation: true });
    await negative('ready_move', () => options.client.storage.from(BUCKET).move(destination.key, `assets/${session!.asset_id}/probe-move.png`), { readyMutation: true });
    await negative('ready_remove', () => options.client.storage.from(BUCKET).remove([destination.key]), { readyMutation: true, filteredDelete: true });
    budget(); cancellation = await options.studio.createUploadSession(actor, { workspace_id: workspaceId, purpose: 'client_logo', filename: 'everyone-probe-cancel-only.png', mime_type: 'image/png', size_bytes: options.logoBytes.byteLength }, context());
    const cancelDestination = transfer(cancellation);
    report.cancellation_upload_id = cancellation.id; report.cancellation_asset_id = cancellation.asset_id;
    budget(); await options.studio.cancelUpload(actor, cancellation.id, context()); report.reservation_cancelled = true;
    budget(); const closed = await options.studio.getUploadSession(actor, cancellation.id);
    check('cancelled_session_returns_no_transfer_url', { accepted: false, http_status: null, provider_status: null }, closed.upload_url === null && Object.keys(closed.upload_headers).length === 0 && closed.status === 'cancelled');
    await negative('cancelled_fresh_mint', () => options.client.storage.from(BUCKET).setHeader('x-upsert', 'false').createSignedUploadUrl(cancelDestination.key, { upsert: false }));
    budget(); let completionDenied = false; let completionAccepted = false;
    try { await options.studio.completeUpload(actor, cancellation.id, { actual_size_bytes: options.logoBytes.byteLength, start_processing: false }, context()); completionAccepted = true; }
    catch (error) { completionDenied = error instanceof DomainError && ['INVALID_TRANSITION', 'UPLOAD_EXPIRED', 'RESOURCE_NOT_FOUND'].includes(error.code); }
    check('cancelled_completion_cannot_publish', { accepted: completionAccepted, http_status: null, provider_status: null }, completionDenied, completionAccepted);
    await integrity(); report.result = 'passed';
  } catch (error) {
    report.stop_code = error instanceof ProbeStop ? error.code : 'PROBE_OPERATION_FAILED';
    if (ready) { try { await integrity(); } catch { if (report.ready_bytes_unchanged !== false) report.ready_bytes_unchanged = null; } }
  } finally {
    // Cancellation never physically deletes bytes; do not hide a failed recovery.
    for (const item of [!ready ? session : undefined, !report.reservation_cancelled ? cancellation : undefined]) {
      if (item) { try { await options.studio.cancelUpload(actor, item.id, context()); report.reservation_cancelled = true; }
        catch { report.reservation_cancelled = false; } }
    }
  }
  return report;
}
