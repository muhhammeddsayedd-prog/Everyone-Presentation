import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyRequirements, rebaseRoleForm, roleCreate, roleForm, rolePatch } from '../../apps/web/components/specs-form.ts';
import { errorMessage } from '../../apps/web/components/api.ts';

test('editing supplied requirements preserves multilingual nuance and unresolved evidence', () => {
  const clarification = { field_path: 'requirements.age_range', reason: 'Needs producer clarification', source: null, resolved: false };
  const role = { name: 'Waiter', category: null, requirements: { ...emptyRequirements(), appearance_performance: 'هادئ\nNatural delivery', scene_references: ['Scene 1', 'Scene 3'] }, clarifications: [clarification] };
  const form = roleForm(role); form.requirements.languages = 'Arabic\n\nEnglish'; form.requirements.age_range = '   ';
  const patch = rolePatch(form, 7);
  assert.equal(patch.requirements?.appearance_performance, role.requirements.appearance_performance);
  assert.deepEqual(patch.requirements?.languages, ['Arabic', 'English']);
  assert.deepEqual(patch.requirements?.scene_references, ['Scene 1', 'Scene 3']);
  assert.equal(patch.requirements?.age_range, null);
  assert.equal(patch.row_version, 7);
  assert.deepEqual(patch.clarifications, [clarification]);
  form.clarifications[0].resolved = true;
  assert.equal(role.clarifications[0].resolved, false);
  assert.equal(patch.clarifications?.[0].resolved, false);
});

test('unknown counts stay null; scene references never manufacture headcount', () => {
  const role = roleCreate('', '', '');
  assert.equal(role.headcount, null); assert.equal(role.name, ''); assert.equal(role.category, null);
  assert.deepEqual(role.requirements.scene_references, []);
  assert.equal(roleCreate('Waiter', '3', 'Supporting').headcount, 3);
  for (const count of ['0', '-1', '1.5', '1e2', 'Infinity', String(Number.MAX_SAFE_INTEGER + 1)]) {
    assert.throws(() => roleCreate('Waiter', count, ''));
  }
});

test('an unrelated edit preserves untouched array entry boundaries and supplied whitespace', () => {
  const role = { name: 'Waiter', category: '', requirements: { ...emptyRequirements(), skills: ['Tray carrying\nand balancing', '  Supplied wording  '] }, clarifications: [] };
  const form = roleForm(role); form.name = 'Server';
  assert.deepEqual(rolePatch(form, 3).requirements?.skills, role.requirements.skills);
  assert.equal(rolePatch(form, 3).category, '');
});

test('a confirmed count updates pristine markers without erasing a simultaneous name edit', () => {
  const marker = { field_path: 'headcount', reason: 'Count unknown', source: null, resolved: false };
  const previous = { id: 'role', workspace_id: 'workspace', name: 'Waiter', category: null,
    requirements: emptyRequirements(), clarifications: [marker], headcount: null, sort_order: 0, row_version: 1, archived: false };
  const next = { ...previous, row_version: 2, headcount: 3, clarifications: [{ ...marker, resolved: true }] };
  const before = roleForm(previous); const typing = roleForm(previous); typing.name = 'Server';
  const pristine = rebaseRoleForm(before, before, next);
  assert.deepEqual(rolePatch(pristine, 2), rolePatch(roleForm(next), 2));
  const rebased = rebaseRoleForm(typing, before, next);
  assert.equal(rebased.name, 'Server'); assert.equal(rebased.clarifications[0].resolved, true);
  assert.equal(before.clarifications[0].resolved, false);
});

test('an interrupted save reports an unknown outcome without inventing success or exposing exception text', () => {
  const interrupted = new Error('private transport details'); interrupted.name = 'TimeoutError';
  assert.match(errorMessage(interrupted), /confirm whether it was saved/);
  assert.doesNotMatch(errorMessage(interrupted), /private transport details|successfully saved/);
});
