import { DomainError, type AudiencePreset, type Page, type Project, type Workspace } from '@eps/domain';

type Check = (value: unknown) => boolean;
const text: Check = value => typeof value === 'string';
const id: Check = value => typeof value === 'string' && value.length > 0 && value.length <= 200;
const version: Check = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const count: Check = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const boolean: Check = value => typeof value === 'boolean';
const strings: Check = value => Array.isArray(value) && value.every(text);
const date: Check = value => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const nullable = (check: Check): Check => value => value === null || check(value);
const choice = (...values: unknown[]): Check => value => values.includes(value);
function invalid(): never { throw new DomainError('CENTRAL_RESPONSE_INVALID', 'The central response did not match its published contract. No result was applied.', 503); }
function shape(value: unknown, fields: Record<string, Check>): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== Object.keys(fields).length || Object.entries(fields).some(([key, check]) => !Object.hasOwn(object, key) || !check(object[key]))) return invalid();
  return object;
}
export function projectDto(value: unknown): Project {
  return structuredClone(shape(value, { id, name: text, client_id: nullable(id), client_name: nullable(text), client_logo_asset_id: nullable(id), row_version: version, client_row_version: nullable(version), casting_workspace_id: nullable(id), can_edit: boolean })) as unknown as Project;
}
export function workspaceDto(value: unknown): Workspace {
  return structuredClone(shape(value, { id, project_id: id, module: choice('casting'), title: text, logo_asset_id: nullable(id), logo_placement: choice('cover', 'every_slide'), active_output: choice('selection', 'shortlist'), row_version: version, draft_revision: count, has_unpublished_changes: boolean, created_at: date, updated_at: date })) as unknown as Workspace;
}
export function audienceDto(value: unknown): AudiencePreset {
  const object = shape(value, { id, key: text, label: text, scope: choice('internal', 'external'), settings: field => { shape(field, {}); return true; }, archived: boolean, row_version: version });
  return structuredClone(object) as unknown as AudiencePreset;
}
export function successDto(value: unknown) {
  return structuredClone(shape(value, { success: choice(true), affected_ids: field => Array.isArray(field) && field.every(id) })) as unknown as { success: true; affected_ids: string[] };
}
export function listDto<T>(value: unknown, parser: (input: unknown) => T): { data: T[]; page: Page } {
  const object = shape(value, { data: Array.isArray, page: field => { shape(field, { next_cursor: nullable(text) }); return true; } });
  return { data: (object.data as unknown[]).map(parser), page: structuredClone(object.page) as Page };
}
export interface CentralCapabilities { principal_id: string; capabilities: string[]; timezone: string; enabled_modules: string[]; upload_policy: { allowed_mime_types: string[]; maximum_file_bytes: number; recommended_batch_size: 200; available_purposes: string[] } }
export function capabilitiesDto(value: unknown): CentralCapabilities {
  const object = shape(value, { principal_id: id, capabilities: strings, timezone: text, enabled_modules: strings, upload_policy: field => { shape(field, { allowed_mime_types: strings, maximum_file_bytes: version, recommended_batch_size: choice(200), available_purposes: field => Array.isArray(field) && field.every(choice('specs', 'candidate_video', 'candidate_support', 'client_logo')) }); return true; } });
  return structuredClone(object) as unknown as CentralCapabilities;
}
