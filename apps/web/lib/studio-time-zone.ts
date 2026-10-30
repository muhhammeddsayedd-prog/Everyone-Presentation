export const DEFAULT_STUDIO_TIME_ZONE = 'Africa/Cairo';

/** Settings/session data is authoritative when valid. Guests and older session
 * fixtures have no privileged settings read and retain the documented default. */
export function studioTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 100) return DEFAULT_STUDIO_TIME_ZONE;
  try { return new Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions().timeZone; }
  catch { return DEFAULT_STUDIO_TIME_ZONE; }
}

function format(value: string, timeZone: string, dateOnly: boolean, locale?: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat(locale, { timeZone: studioTimeZone(timeZone), dateStyle: 'medium', ...(dateOnly ? {} : { timeStyle: 'short' }) }).format(date);
}
export function formatStudioDateTime(value: string, timeZone: string, locale?: string) { return format(value, timeZone, false, locale); }
export function formatStudioDate(value: string, timeZone: string, locale?: string) { return format(value, timeZone, true, locale); }
