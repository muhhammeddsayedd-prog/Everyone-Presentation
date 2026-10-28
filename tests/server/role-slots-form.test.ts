import assert from 'node:assert/strict';
import test from 'node:test';
import type { Slot } from '@eps/domain';
import { buildResizeRequest, readSlotPage, retainSlotIntent } from '../../apps/web/components/role-slots-form.ts';

const role = { id: 'role-1', headcount: 3, row_version: 7 };
const slots: Slot[] = ['a', 'b', 'c'].map((id, index) => ({ id, role_id: role.id, label: `Waiter ${index + 1}`,
  sort_order: index, row_version: 2, archived: false }));

test('slot reduction requires a complete list and the exact explicit excess choices', () => {
  assert.throws(() => buildResizeRequest(role, '2', [], slots, true), /Choose exactly 1/u);
  assert.throws(() => buildResizeRequest(role, '2', ['b'], slots.slice(0, 2), false), /Load all slots/u);
  assert.throws(() => buildResizeRequest(role, '2', ['a', 'b'], slots, true), /Choose exactly 1/u);
  assert.throws(() => buildResizeRequest(role, '2', ['foreign'], slots, true), /active slots in this role/u);
  assert.throws(() => buildResizeRequest(role, '1', ['a', 'a'], slots, true), /once/u);
  assert.deepEqual(buildResizeRequest(role, '2', ['b'], slots, true), { row_version: 7, desired_count: 2, retire_slot_ids: ['b'] });
  assert.deepEqual(slots.map(slot => [slot.id, slot.label, slot.archived]), [['a', 'Waiter 1', false], ['b', 'Waiter 2', false], ['c', 'Waiter 3', false]]);
});

test('unknown headcount remains unknown until an explicit positive count confirmation', () => {
  const unknown = { ...role, headcount: null };
  assert.deepEqual(buildResizeRequest(unknown, '1', [], slots.slice(0, 1), true), { row_version: 7, desired_count: 1, retire_slot_ids: [] });
  assert.equal(unknown.headcount, null);
  for (const value of ['', '0', '-1', '1.5', '1e2', 'Infinity', String(Number.MAX_SAFE_INTEGER + 1)]) {
    assert.throws(() => buildResizeRequest(role, value, [], slots, true), /whole number above zero/u);
  }
  assert.throws(() => buildResizeRequest(role, '4', ['a'], slots, true), /Choose exactly 0/u);
  assert.throws(() => buildResizeRequest(role, '4', [], slots.slice(0, 1), true), /saved slot count changed/u);
});

test('slot pagination rejects foreign, repeated, archived and nonadvancing data', () => {
  const first = readSlotPage(role.id, { data: slots.slice(0, 2), page: { next_cursor: 'next' } }, [], null);
  assert.deepEqual(first.slots.map(slot => slot.id), ['a', 'b']);
  const second = readSlotPage(role.id, { data: slots.slice(2), page: { next_cursor: null } }, first.slots, 'next');
  assert.deepEqual(second.slots.map(slot => slot.id), ['a', 'b', 'c']);
  for (const data of [[{ ...slots[0], role_id: 'other' }], [slots[0], slots[0]], [{ ...slots[0], archived: true }]]) {
    assert.throws(() => readSlotPage(role.id, { data, page: { next_cursor: null } }, [], null));
  }
  assert.throws(() => readSlotPage(role.id, { data: [slots[0]], page: { next_cursor: 'next' } }, [], 'next'));
  assert.throws(() => readSlotPage(role.id, { data: [], page: { next_cursor: 'more' } }, [], null));
  assert.throws(() => readSlotPage(role.id, { data: [slots[0]], page: { next_cursor: null } }, [slots[0]], null));
});

test('retries retain the frozen payload, revision and key; changed intent gets a new key', () => {
  let generated = 0; const key = () => `intent-${++generated}`;
  const body = buildResizeRequest(role, '1', ['c', 'b'], slots, true);
  const first = retainSlotIntent(null, body, key);
  body.retire_slot_ids!.push('a');
  assert.deepEqual(first.body.retire_slot_ids, ['b', 'c']);
  const retry = retainSlotIntent(first, buildResizeRequest(role, '1', ['b', 'c'], slots, true), key);
  assert.equal(retry, first); assert.equal(generated, 1);
  const changed = retainSlotIntent(first, { ...first.body, row_version: 8 }, key);
  assert.equal(changed.key, 'intent-2'); assert.equal(changed.body.row_version, 8);
});
