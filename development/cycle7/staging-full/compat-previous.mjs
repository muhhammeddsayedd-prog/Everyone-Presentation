// After m21: the previous web release's full read/write probe set against the migrated schema (rollout + rollback safety).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { useApp, call, check, note, journey, save, WS, seed, S } from './lib.mjs';
useApp(process.env.EPS_STG_PREVIOUS_APP ?? 'http://127.0.0.1:3161');
const b = JSON.parse(readFileSync(path.join(S, 'before-state.json'), 'utf8'));
await journey(process.env.EPS_STG_COMPAT_NAME ?? '1b-previous-release-on-migrated-schema', async () => {
  const probes = {
    capabilities: ['GET', '/capabilities'], settings: ['GET', '/settings'], presets: ['GET', '/audience-presets'], workspace: ['GET', `/workspaces/${WS}`],
    workspace_candidates: ['GET', `/workspaces/${WS}/candidates?limit=10`], search_candidates: ['GET', '/candidates?limit=5'], get_candidate: ['GET', `/candidates/${seed.ids.photoPerson}`],
    candidate_photos: ['GET', `/candidates/${seed.ids.photoPerson}/photos`], roles: ['GET', `/workspaces/${WS}/roles?limit=10`], slots: ['GET', `/roles/${b.lead.id}/slots`],
    assignments: ['GET', `/workspaces/${WS}/assignments?limit=10`], specs: ['GET', `/workspaces/${WS}/specs`], series: ['GET', `/presentation-series?workspace_id=${WS}`],
    get_series: ['GET', `/presentation-series/${b.series.id}`], versions: ['GET', `/presentation-series/${b.series.id}/versions`], version: ['GET', `/versions/${b.version.id}`],
    review: ['GET', `/workspaces/${WS}/review?series_id=${b.series.id}`], jobs: ['GET', '/jobs?limit=5'], feedback: ['GET', `/versions/${b.version.id}/feedback`],
    summary: ['GET', `/workspaces/${WS}/summary`], projects: ['GET', '/projects?limit=5'], review_links: ['GET', '/review-links'],
  };
  const out = {};
  for (const [k, [m, p]] of Object.entries(probes)) { const r = await call(m, p); out[k] = r.status === 200 ? 200 : `${r.status} ${r.body?.error?.code ?? ''}`; }
  const members = (await call('GET', `/workspaces/${WS}/candidates?limit=10`)).body?.data ?? [];
  const member = members.find(m => m.candidate_id === seed.ids.framePerson);
  if (member) { const r = await call('PATCH', `/workspace-candidates/${member.id}`, { row_version: member.row_version, availability: 'Weekdays (previous release edit)' }); out.update_workspace_candidate = r.status === 200 ? 200 : `${r.status} ${r.body?.error?.code ?? ''}`; }
  const slot = (await call('GET', `/roles/${b.lead.id}/slots`)).body?.data?.[0];
  if (slot) { const r = await call('PATCH', `/slots/${slot.id}`, { row_version: slot.row_version, label: slot.label ?? 'Lead 1' }); out.update_slot = r.status === 200 ? 200 : `${r.status} ${r.body?.error?.code ?? ''}`; }
  const again = await call('POST', `/workspaces/${WS}/candidates`, { candidate_id: seed.ids.framePerson });
  out.add_existing_member = again.status;
  note('probes', out);
  const failing = Object.entries(out).filter(([k, v]) => v !== 200 && !(k === 'add_existing_member' && [200, 201, 409].includes(v)));
  check('previous_release_operations_work', failing.length === 0, failing);
});
save('staging-journeys.json');
