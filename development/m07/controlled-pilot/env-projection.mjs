import assert from 'node:assert/strict';

export function validatePublicCentral(values) {
  assert.equal(values.SUPABASE_URL, 'https://pyibofyctwnqpvktepse.supabase.co');
  assert(typeof values.SUPABASE_PUBLISHABLE_KEY === 'string' && values.SUPABASE_PUBLISHABLE_KEY.length <= 4096
    && /^sb_publishable_[A-Za-z0-9_-]{8,}$/u.test(values.SUPABASE_PUBLISHABLE_KEY));
}
export function environmentMetadata(value) {
  assert(Array.isArray(value));
  const seen = new Set();
  return value.map(v => {
    assert(typeof v.key === 'string' && /^[A-Z][A-Z0-9_]{0,127}$/u.test(v.key) && !seen.has(v.key));
    seen.add(v.key);
    assert(['plain', 'sensitive', 'encrypted', 'system'].includes(v.type) && Array.isArray(v.target) && v.target.length > 0
      && v.target.every(t => typeof t === 'string' && ['production', 'preview', 'development'].includes(t))
      && new Set(v.target).size === v.target.length);
    return { key: v.key, type: v.type, target: [...v.target].sort() };
  }).sort((a, b) => a.key.localeCompare(b.key));
}
export function createdEnvironmentMetadata(response) {
  assert(response && typeof response === 'object' && Array.isArray(response.failed) && response.failed.length === 0);
  assert(response.created && typeof response.created === 'object');
  return environmentMetadata(Array.isArray(response.created) ? response.created : [response.created]);
}
