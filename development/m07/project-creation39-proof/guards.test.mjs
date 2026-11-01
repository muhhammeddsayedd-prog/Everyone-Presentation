import assert from 'node:assert/strict';
import test from 'node:test';
import { assertOwnedDatabase, functionalChange } from './run.mjs';

test('functional adapter retains only the exact marked DDL and rejects transaction or ambiguous markers', () => {
  const body = '\ncreate table synthetic(id uuid);\n';
  const source = `begin;\n-- BEGIN PROJECT CREATION FUNCTIONAL CHANGE${body}-- END PROJECT CREATION FUNCTIONAL CHANGE\ncommit;`;
  assert.equal(functionalChange(source), body);
  for (const wrong of [source + source, source.replace(body, '\ncommit;\n'), source.replace('-- END', '-- MISSING END')]) assert.throws(() => functionalChange(wrong));
});

test('disposable database identity requires exact name, OID, owner, marker, system identity and no other session', () => {
  const expected = { database: 'eps_c39_0123456789abcdef', oid: '12345', owner: 'postgres', marker: 'eps-project39:synthetic', system_identifier: '7701520506262638626' };
  assert.doesNotThrow(() => assertOwnedDatabase({ ...expected, clients: 0 }, expected));
  for (const change of [{ database: 'postgres' }, { oid: '54321' }, { owner: 'other' }, { marker: null }, { system_identifier: 'different' }, { clients: 1 }]) {
    assert.throws(() => assertOwnedDatabase({ ...expected, clients: 0, ...change }, expected));
  }
});
