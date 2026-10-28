import type { ResizeSlots, Role, Slot } from '@eps/domain';

export interface SlotIntent<T> { key: string; signature: string; body: T }
export function retainSlotIntent<T>(previous: SlotIntent<T> | null, body: T, createKey: () => string): SlotIntent<T> {
  const signature = JSON.stringify(body);
  return previous?.signature === signature ? previous : { key: createKey(), signature, body: structuredClone(body) };
}

export function buildResizeRequest(role: Pick<Role, 'id' | 'headcount' | 'row_version'>, desiredText: string,
  selected: readonly string[], slots: readonly Slot[], complete: boolean): ResizeSlots {
  const desired = Number(desiredText);
  if (!/^[1-9][0-9]*$/u.test(desiredText) || !Number.isSafeInteger(desired)) {
    throw new Error('Enter a whole number above zero for the required people.');
  }
  const current = role.headcount ?? 1;
  const excess = Math.max(0, current - desired);
  if (excess > 0 && !complete) throw new Error('Load all slots before reviewing a reduction.');
  if (complete && slots.filter(slot => !slot.archived && slot.role_id === role.id).length !== current) {
    throw new Error('The saved slot count changed. Reload the saved role and slots before changing the count.');
  }
  if (new Set(selected).size !== selected.length) throw new Error('Choose each slot only once.');
  if (selected.length !== excess) throw new Error(`Choose exactly ${excess} ${excess === 1 ? 'slot' : 'slots'} to archive.`);
  if (selected.some(id => !slots.some(slot => slot.id === id && slot.role_id === role.id && !slot.archived))) {
    throw new Error('Choose only active slots in this role.');
  }
  return { row_version: role.row_version, desired_count: desired, retire_slot_ids: [...selected].sort() };
}

export function readSlotPage(roleId: string, response: { data: unknown; page?: unknown }, previous: readonly Slot[], cursor: string | null) {
  const fail = (): never => { throw new Error('The saved slot list changed or could not be verified. Reload slots before reviewing the count.'); };
  if (!Array.isArray(response.data)) return fail();
  const data: unknown[] = response.data;
  if (data.length > 100 || !response.page || typeof response.page !== 'object') return fail();
  const page = response.page as Record<string, unknown>;
  if (Object.keys(page).some(key => key !== 'next_cursor') || !(page.next_cursor === null
    || typeof page.next_cursor === 'string' && page.next_cursor.length > 0 && page.next_cursor.length <= 200)) fail();
  if (page.next_cursor !== null && (page.next_cursor === cursor || data.length === 0)) fail();
  const ids = new Set(previous.map(slot => slot.id));
  const additions: Slot[] = data.map(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
    const slot = value as Record<string, unknown>;
    if (Object.keys(slot).some(key => !['id', 'role_id', 'label', 'sort_order', 'row_version', 'archived'].includes(key))
      || typeof slot.id !== 'string' || slot.id.length < 1 || slot.id.length > 200 || ids.has(slot.id)
      || slot.role_id !== roleId || typeof slot.label !== 'string' || slot.archived !== false
      || typeof slot.row_version !== 'number' || !Number.isSafeInteger(slot.row_version) || slot.row_version < 1
      || typeof slot.sort_order !== 'number' || !Number.isSafeInteger(slot.sort_order) || slot.sort_order < 0) fail();
    ids.add(slot.id as string);
    return { id: slot.id as string, role_id: roleId, label: slot.label as string,
      sort_order: slot.sort_order as number, row_version: slot.row_version as number, archived: false };
  });
  return { slots: [...previous, ...additions], nextCursor: page.next_cursor as string | null };
}
