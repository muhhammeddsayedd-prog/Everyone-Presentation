import type { Assignment, Role, Slot, WorkspaceCandidate } from '@eps/domain';
import { api, type Envelope, type Workspace } from './api';

export type RetirementScope = { kind: 'role' | 'workspace_candidate'; id: string; row_version: number }
  | { kind: 'slots'; id: string; row_version: number; slot_ids: readonly string[] };
export interface RetirementChoice {
  assignment_id: string; candidate_id: string; role: string; slot: string; position: Assignment['position']; shortlisted: boolean;
  has_presentation_notes: boolean; has_internal_notes: boolean;
}
export interface CastingRetirementPreview { workspace_id: string; workspace_row_version: number; draft_revision: number; choices: RetirementChoice[] }
export type CastingReadPort = <T>(path: string, init: RequestInit) => Promise<Envelope<T>>;
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const version = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const ordinal = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const fail = (): never => { throw new Error('Current casting choices could not be verified. Reload the saved project details, then review this removal again.'); };

async function pages<T extends { id: string }>(path: string, signal: AbortSignal, read: CastingReadPort): Promise<T[]> {
  const rows: T[] = []; const ids = new Set<string>(); const cursors = new Set<string>(); let cursor: string | null = null;
  for (let page = 0; page < 100; page++) {
    const result: Envelope<T[]> = await read<T[]>(`${path}${path.includes('?') ? '&' : '?'}limit=100${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, { signal });
    if (!Array.isArray(result.data) || result.data.length > 100 || !result.page || Object.keys(result.page).some(key => key !== 'next_cursor')
      || !(result.page.next_cursor === null || typeof result.page.next_cursor === 'string' && result.page.next_cursor.length > 0 && result.page.next_cursor.length <= 4000)) fail();
    for (const row of result.data) { if (!row || !validId(row.id) || ids.has(row.id)) fail(); ids.add(row.id); rows.push(row); }
    const next: string | null = result.page!.next_cursor;
    if (next === null) return rows;
    if (!result.data.length || cursors.has(next)) fail(); cursors.add(next); cursor = next;
  }
  throw new Error('The current casting choices are too large to review safely here. No removal has been sent.');
}

/** Informative current snapshot, not a commit-time set guarantee. Confirmation
 * explicitly covers all active assignments in the requested retirement scope. */
export async function readCastingRetirementPreview(workspaceId: string, scope: RetirementScope, signal: AbortSignal,
  read: CastingReadPort = api): Promise<CastingRetirementPreview> {
  if (!validId(workspaceId) || !validId(scope.id) || !version(scope.row_version)
    || !['role', 'slots', 'workspace_candidate'].includes(scope.kind)
    || scope.kind === 'slots' && (!scope.slot_ids.length || scope.slot_ids.some(id => !validId(id)) || new Set(scope.slot_ids).size !== scope.slot_ids.length)) fail();
  const base = '/api/v1/workspaces/' + encodeURIComponent(workspaceId);
  // Read the fence before starting any child read, not concurrently with them.
  const before = (await read<Workspace>(base, { signal })).data;
  if (!before || before.id !== workspaceId || !validId(before.project_id) || !version(before.row_version) || !ordinal(before.draft_revision)) fail();
  const [roles, pool, assignments] = await Promise.all([pages<Role>(base + '/roles', signal, read),
    pages<WorkspaceCandidate>(base + '/candidates', signal, read), pages<Assignment>(base + '/assignments?output_type=selection', signal, read)]);
  if (roles.some(role => role.workspace_id !== workspaceId || role.archived !== false || typeof role.name !== 'string' || !ordinal(role.sort_order) || !version(role.row_version))
    || pool.some(row => row.workspace_id !== workspaceId || !validId(row.candidate_id) || !version(row.row_version))) fail();
  const roleMap = new Map(roles.map(role => [role.id, role])); const poolMap = new Map(pool.map(row => [row.id, row]));
  const slots: Slot[] = [];
  for (let index = 0; index < roles.length; index += 4) {
    const batch = roles.slice(index, index + 4);
    const groups = await Promise.all(batch.map(role => pages<Slot>('/api/v1/roles/' + encodeURIComponent(role.id) + '/slots', signal, read)));
    groups.forEach((group, position) => { if (group.some(slot => slot.role_id !== batch[position].id)) fail(); slots.push(...group); });
  }
  if (new Set(slots.map(slot => slot.id)).size !== slots.length || slots.some(slot => slot.archived !== false || !roleMap.has(slot.role_id)
    || typeof slot.label !== 'string' || !ordinal(slot.sort_order) || !version(slot.row_version))) fail();
  const slotMap = new Map(slots.map(slot => [slot.id, slot])); const relations = new Set<string>(); const mains = new Set<string>();
  for (const row of assignments) {
    if (row.workspace_id !== workspaceId || row.archived !== false || !slotMap.has(row.slot_id) || !poolMap.has(row.workspace_candidate_id)
      || !['option', 'main', 'backup'].includes(row.position) || typeof row.shortlist_included !== 'boolean' || !version(row.row_version) || !ordinal(row.sort_order)
      || !(row.presentation_notes === null || typeof row.presentation_notes === 'string') || !(row.internal_notes === null || typeof row.internal_notes === 'string')) fail();
    const relation = row.slot_id + ':' + row.workspace_candidate_id;
    if (relations.has(relation) || row.position === 'main' && mains.has(row.slot_id)) fail();
    relations.add(relation); if (row.position === 'main') mains.add(row.slot_id);
  }
  const resource = scope.kind === 'workspace_candidate' ? poolMap.get(scope.id) : roleMap.get(scope.id);
  if (!resource || resource.row_version !== scope.row_version || scope.kind === 'slots' && scope.slot_ids.some(id => slotMap.get(id)?.role_id !== scope.id)) fail();
  const after = (await read<Workspace>(base, { signal })).data;
  if (!after || after.id !== workspaceId || after.project_id !== before.project_id || after.row_version !== before.row_version || after.draft_revision !== before.draft_revision) fail();
  const selected = assignments.filter(row => scope.kind === 'workspace_candidate' ? row.workspace_candidate_id === scope.id
    : scope.kind === 'slots' ? scope.slot_ids.includes(row.slot_id) : slotMap.get(row.slot_id)!.role_id === scope.id);
  selected.sort((a, b) => {
    const aSlot = slotMap.get(a.slot_id)!; const bSlot = slotMap.get(b.slot_id)!;
    return roleMap.get(aSlot.role_id)!.sort_order - roleMap.get(bSlot.role_id)!.sort_order || aSlot.role_id.localeCompare(bSlot.role_id)
      || aSlot.sort_order - bSlot.sort_order || a.slot_id.localeCompare(b.slot_id) || a.sort_order - b.sort_order || a.id.localeCompare(b.id);
  });
  return { workspace_id: workspaceId, workspace_row_version: after.row_version, draft_revision: after.draft_revision, choices: selected.map(row => {
    const slot = slotMap.get(row.slot_id)!;
    return { assignment_id: row.id, candidate_id: poolMap.get(row.workspace_candidate_id)!.candidate_id, role: roleMap.get(slot.role_id)!.name || 'Unnamed role', slot: slot.label || 'Unnamed slot', position: row.position,
      shortlisted: row.shortlist_included, has_presentation_notes: !!row.presentation_notes, has_internal_notes: !!row.internal_notes };
  }) };
}
