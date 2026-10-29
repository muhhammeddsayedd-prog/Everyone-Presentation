'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Role, SuggestedCandidateFilters } from '@eps/domain';
import { api, errorMessage } from './api';
import { ErrorNotice } from './Feedback';

/** Requirements propose editable search values; they never supply candidate facts. */
type Props={
  workspaceId: string; onApply: (field: string, value: string) => void;
};
export function RoleFilterSuggestions(props:Props){return <WorkspaceRoleFilterSuggestions key={props.workspaceId} {...props}/>;}
function WorkspaceRoleFilterSuggestions({workspaceId,onApply}:Props) {
  const id = useId();
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestedCandidateFilters | null>(null);
  const [nextRoleCursor, setNextRoleCursor] = useState<string | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const rolesRequest = useRef<AbortController | null>(null);
  const [editingFilter, setEditingFilter] = useState<{field: string; value: string; source_field: string} | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    rolesRequest.current = controller;
    api<Role[]>(`/api/v1/workspaces/${workspaceId}/roles?limit=100`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setRoles(result.data.filter(role => !role.archived)); setNextRoleCursor(result.page?.next_cursor ?? null); } })
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoadingRoles(false); });
    return () => controller.abort();
  }, [workspaceId]);

  useEffect(() => {
    const controller = new AbortController();
    if (roleId) api<SuggestedCandidateFilters>(`/api/v1/roles/${roleId}/candidate-filters`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setSuggestions(result.data); })
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [roleId]);

  async function loadMoreRoles() {
    const controller = rolesRequest.current;
    if (!controller || controller.signal.aborted || !nextRoleCursor || loadingRoles) return;
    setLoadingRoles(true);
    try {
      const result = await api<Role[]>(`/api/v1/workspaces/${workspaceId}/roles?limit=100&cursor=${encodeURIComponent(nextRoleCursor)}`, {signal: controller.signal});
      if (!controller.signal.aborted) {
        setRoles(current => [...current, ...result.data.filter(role => !role.archived && !current.some(existing => existing.id === role.id))]);
        setNextRoleCursor(result.page?.next_cursor ?? null);
      }
    } catch (reason) { if (!controller.signal.aborted) setError(errorMessage(reason)); }
    finally { if (!controller.signal.aborted) setLoadingRoles(false); }
  }

  return <section className="requirements-details" aria-label="Role filter suggestions">
    <div className="field"><label htmlFor={id}>Suggest filters from a role</label>
      <select id={id} value={roleId} onChange={event => {setRoleId(event.target.value);setSuggestions(null);setError('');setEditingFilter(null);setLoading(Boolean(event.target.value));}}>
        <option value="">Choose a project role</option>
        {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
      </select>
    </div>
    {nextRoleCursor && <button className="button button-small" type="button" disabled={loadingRoles} onClick={() => void loadMoreRoles()}>Load more project roles</button>}
    <p className="small muted">Choose a suggestion to fill one editable search filter. Missing candidate values remain included unless you change the unknown control.</p>
    {loading && <p role="status">Reading role requirements…</p>}
    {error && <ErrorNotice message={error} />}
    {suggestions && <>
      <ul className="button-row" aria-label="Supplied role requirements">{suggestions.suggested_filters.map((suggestion, index) =>
        <li key={`${suggestion.source_field}/${index}`}><button className="button button-small" type="button"
          onClick={() => suggestion.value.length > 500 ? setEditingFilter({...suggestion}) : onApply(suggestion.field, suggestion.value)}>
          {suggestion.value.length > 500 ? 'Edit long filter: ' : ''}{suggestion.field.replaceAll('_', ' ')}: {suggestion.value}
        </button><span className="small muted"> Source: {suggestion.source_field}</span></li>)}</ul>
      {!suggestions.suggested_filters.length && <p>No supported filter values were supplied for this role.</p>}
      {suggestions.explanations.map((explanation, index) => <p className="small muted" key={index}>{explanation}</p>)}
    </>}
    {editingFilter && <div className="field"><label htmlFor={`${id}-edit`}>Shorten this search filter ({editingFilter.value.length}/500)</label>
      <textarea id={`${id}-edit`} rows={4} value={editingFilter.value} onChange={event => setEditingFilter({...editingFilter,value:event.target.value})} />
      <p className="small muted">The full role requirement remains saved. Source: {editingFilter.source_field}</p>
      <div className="button-row"><button className="button button-small" type="button" disabled={!editingFilter.value.trim() || editingFilter.value.length > 500}
        onClick={() => {onApply(editingFilter.field,editingFilter.value);setEditingFilter(null);}}>Apply edited search filter</button>
        <button className="button button-small" type="button" onClick={() => setEditingFilter(null)}>Cancel filter edit</button></div>
    </div>}
  </section>;
}
