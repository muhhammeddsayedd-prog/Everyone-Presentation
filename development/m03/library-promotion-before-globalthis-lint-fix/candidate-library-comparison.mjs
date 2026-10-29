import assert from 'node:assert/strict';

export const LIBRARY_TABLES = ['eps.candidates', 'eps.candidate_media', 'eps.candidate_media_frames', 'eps.workspace_candidates'];
export const LIBRARY_PUBLIC_FUNCTIONS = ['eps_search_candidates', 'eps_get_candidate', 'eps_get_candidate_media', 'eps_find_candidate_duplicates', 'eps_list_workspace_candidates', 'eps_create_candidate', 'eps_update_candidate', 'eps_confirm_candidate_reviewed', 'eps_archive_candidate', 'eps_update_candidate_frames', 'eps_resolve_candidate_duplicate', 'eps_add_workspace_candidate', 'eps_update_workspace_candidate', 'eps_remove_workspace_candidate'].map(name => `public.${name}`);
const NEW_COLUMNS = ['source_timestamp_ms', 'duration_ms'];
const NEW_CHECKS = NEW_COLUMNS.map(name => `media_assets_${name}_check`);
export function isLibraryAddition(key, row) {
  return LIBRARY_TABLES.includes(row.table) || LIBRARY_TABLES.includes(row.name)
    || key === 'functions' && (row.name.startsWith('eps.cast_') || LIBRARY_PUBLIC_FUNCTIONS.includes(row.name))
    || key === 'roles' && row.name === 'eps_cast_owner'
    || ['table_acls', 'column_acls'].includes(key) && row.role === 'eps_cast_owner'
    || key === 'columns' && row.table === 'eps.media_assets' && NEW_COLUMNS.includes(row.name)
    || key === 'column_acls' && row.table === 'eps.media_assets' && NEW_COLUMNS.includes(row.column)
    || key === 'constraints' && row.table === 'eps.media_assets' && NEW_CHECKS.includes(row.name)
    || key === 'policies' && (row.name.startsWith('cast_') || ['eps_cast_no_objects', 'eps_cast_no_buckets'].includes(row.name));
}
export function withoutLibraryAdditions(catalog) {
  const result = structuredClone(catalog);
  for (const [key, rows] of Object.entries(result)) result[key] = rows.filter(row => !isLibraryAddition(key, row)).map(row => {
    if (row.execute) delete row.execute.eps_cast_owner;
    if (row.explicit_acl) row.explicit_acl = row.explicit_acl.filter(acl => acl.grantee !== 'eps_cast_owner');
    return row;
  });
  return result;
}
export function libraryAdditions(catalog) {
  return Object.fromEntries(Object.entries(catalog).map(([key, rows]) => [key, rows.filter(row => isLibraryAddition(key, row))]));
}
export function compareLibraryPromotion(before, after) {
  assert.deepEqual(after.versions, [...before.versions, '20261029090724']);
  for (const key of ['source_config', 'assets', 'runtime', 'buckets', 'release_additions_pristine', 'candidate_media_extensions_pristine', 'query_role', 'database', 'unrestricted_visibility']) assert.deepEqual(after[key], before[key]);
  assert.equal(after.candidate_media_extensions_pristine, true);
  for (const key of ['counts', 'data_sha256']) {
    const original = { ...after[key] }; for (const table of LIBRARY_TABLES) delete original[table];
    assert.deepEqual(original, before[key]);
  }
  for (const table of LIBRARY_TABLES) assert.equal(after.counts[table], 0);
  assert.deepEqual(withoutLibraryAdditions(after.catalog), before.catalog);
  return true;
}
