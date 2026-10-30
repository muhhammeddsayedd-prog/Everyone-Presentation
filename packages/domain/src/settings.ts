import { DomainError } from './types.ts';
import type { Settings, SettingsPatch } from './settings-types.ts';

function invalid(): never { throw new DomainError('INVALID_REQUEST', 'Settings do not match the operation contract.', 400); }
function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) || Object.keys(value).some(key => !allowed.includes(key))) invalid();
  return value as Record<string, unknown>;
}
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 1) invalid(); return value as number; }
function template(value: unknown): string { if (typeof value !== 'string' || !/^[0-9]{1,4}\.[0-9]{1,4}\.[0-9]{1,4}$/u.test(value)) invalid(); return value; }
function timezone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 100 || !(value === 'UTC' || /^[A-Za-z_+-]+(?:\/[A-Za-z0-9_+.-]+)+$/u.test(value)) || /^(?:posix|right)\//u.test(value)) invalid();
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); } catch { invalid(); }
  return value;
}
export function parseSettingsPatch(value: unknown): SettingsPatch {
  const input = object(value, ['row_version', 'default_timezone', 'template_version']);
  return { row_version: revision(input.row_version),
    ...(Object.hasOwn(input, 'default_timezone') ? { default_timezone: timezone(input.default_timezone) } : {}),
    ...(Object.hasOwn(input, 'template_version') ? { template_version: template(input.template_version) } : {}),
  };
}
/** Strict projection; never spreads provider configuration into API/MCP/UI. */
export function settingsDto(value: unknown): Settings {
  const input = object(value, ['template_version', 'default_timezone', 'default_review_expiry_days', 'models', 'row_version']);
  if (Object.keys(input).length !== 5 || input.default_review_expiry_days !== 30) invalid();
  if (!input.models || typeof input.models !== 'object' || Array.isArray(input.models) || ![Object.prototype, null].includes(Object.getPrototypeOf(input.models))) invalid();
  const models = Object.entries(input.models);
  if (models.length > 20 || models.some(([key, model]) => !/^[a-z][a-z0-9_]{0,49}$/u.test(key) || typeof model !== 'string' || !/^[A-Za-z0-9._-]{1,200}$/u.test(model))) invalid();
  return { template_version: template(input.template_version), default_timezone: timezone(input.default_timezone), default_review_expiry_days: 30, models: Object.fromEntries(models) as Record<string, string>, row_version: revision(input.row_version) };
}
