import assert from 'node:assert/strict';
import test from 'node:test';
import type { CentralCapabilities } from '@eps/central';
import * as sessionData from '../../apps/web/lib/session-data.ts';

test('signed-in session projection carries authoritative timezone and only the safe actor/upload fields', () => {
  const project = (sessionData as unknown as { projectSessionIdentity: (principal: string, name: string, capabilities: CentralCapabilities) => unknown }).projectSessionIdentity;
  assert.equal(typeof project, 'function');
  const capabilities: CentralCapabilities = { principal_id: 'synthetic', timezone: 'UTC', capabilities: ['workspaces.read'], enabled_modules: ['casting'],
    upload_policy: { available_purposes: [], maximum_file_bytes: 5242880, recommended_batch_size: 200, allowed_mime_types: [] } };
  assert.deepEqual(project('synthetic', 'Synthetic reader', capabilities), { timezone: 'UTC', actor: { id: 'synthetic', name: 'Synthetic reader',
    capabilities: ['workspaces.read'], upload_purposes: [], upload_maximum_bytes: 5242880 } });
  assert.equal((project('synthetic', 'Synthetic reader', { ...capabilities, timezone: 'invalid' }) as { timezone: string }).timezone, 'Africa/Cairo');
  const projected = project('synthetic', 'Synthetic reader', { ...capabilities, private_marker: 'must-not-be-projected' } as CentralCapabilities);
  assert.ok(!JSON.stringify(projected).includes('must-not-be-projected'));
});
