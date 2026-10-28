# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api-contracts.spec.ts >> audience preset HTTP lifecycle is strict and settings authority is independent of project preparation
- Location: tests\e2e\api-contracts.spec.ts:76:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "no-store"
Received: "private, no-cache, no-store, must-revalidate, max-age=0"
```

# Test source

```ts
  1   | import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
  2   | import { randomUUID } from 'node:crypto';
  3   | import { validateContract } from '../../apps/web/lib/validation';
  4   | import type { AudiencePreset, Project, UploadSession, Workspace } from '@eps/domain';
  5   | 
  6   | // API contexts are ephemeral. Do not capture auth cookies in network traces.
  7   | test.use({ trace: 'off', screenshot: 'off' });
  8   | const origin = 'http://127.0.0.1:3000';
  9   | const producer = '10000000-0000-4000-8000-000000000001';
  10  | const contributor = '10000000-0000-4000-8000-000000000002';
  11  | const projectId = '20000000-0000-4000-8000-000000000001';
  12  | const headers = (key = randomUUID()) => ({ Origin: origin, 'Idempotency-Key': key });
  13  | 
  14  | async function success<T>(response: APIResponse, schema: string, status = 200): Promise<T> {
  15  |   expect(response.status()).toBe(status);
  16  |   const body = await response.json();
  17  |   expect(Object.keys(body).sort()).toEqual(['data', 'request_id']);
  18  |   expect(body.request_id).toMatch(/^[0-9a-f-]{36}$/i);
  19  |   validateContract(schema, body.data);
> 20  |   expect(response.headers()['cache-control']).toBe('no-store');
      |                                               ^ Error: expect(received).toBe(expected) // Object.is equality
  21  |   return body.data as T;
  22  | }
  23  | async function error(response: APIResponse, status: number, code: string) {
  24  |   expect(response.status()).toBe(status);
  25  |   const body = await response.json();
  26  |   validateContract('ErrorResponse', body);
  27  |   expect(Object.keys(body).sort()).toEqual(['error', 'request_id']);
  28  |   expect(body.error.code).toBe(code);
  29  |   expect(response.headers()['cache-control']).toBe('no-store');
  30  | }
  31  | async function login(request: APIRequestContext, actorId: string) {
  32  |   const response = await request.post('/api/dev/session', { headers: headers(), data: { actor_id: actorId } });
  33  |   expect(response.status()).toBe(200);
  34  |   const body = await response.json();
  35  |   expect(body.data.actor.id).toBe(actorId);
  36  |   // The session cookie is intentionally never read, logged, or attached.
  37  | }
  38  | 
  39  | test('actual HTTP envelopes enforce auth, idempotency, revision and strict input boundaries', async ({ request }) => {
  40  |   await error(await request.get('/api/v1/projects'), 401, 'AUTH_REQUIRED');
  41  |   await login(request, producer);
  42  |   await success(await request.get('/api/v1/capabilities'), 'Capabilities');
  43  |   const key = randomUUID();
  44  |   const input = { project_id: projectId, initial_output: 'selection' };
  45  |   const responses = await Promise.all(Array.from({ length: 4 }, () => request.post('/api/v1/workspaces', { headers: headers(key), data: input })));
  46  |   const workspaces = await Promise.all(responses.map(response => success<Workspace>(response, 'Workspace', 201)));
  47  |   expect(new Set(workspaces.map(workspace => workspace.id)).size).toBe(1);
  48  |   await error(await request.post('/api/v1/workspaces', { headers: headers(key), data: { ...input, initial_output: 'shortlist' } }), 409, 'IDEMPOTENCY_KEY_REUSED');
  49  | 
  50  |   const original = await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project');
  51  |   const temporaryName = `${original.name} · HTTP revision check`;
  52  |   try {
  53  |     const edited = await success<Project>(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: original.row_version, name: temporaryName } }), 'Project');
  54  |     expect(edited.row_version).toBeGreaterThan(original.row_version);
  55  |     await error(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: original.row_version, name: 'Stale overwrite must not save' } }), 409, 'STALE_RESOURCE_VERSION');
  56  |     expect((await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project')).name).toBe(temporaryName);
  57  |     await error(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: edited.row_version, principal_id: producer, name: 'Forged authority must not save' } }), 400, 'VALIDATION_FAILED');
  58  |     expect((await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project')).name).toBe(temporaryName);
  59  |   } finally {
  60  |     const current = await success<Project>(await request.get(`/api/v1/projects/${projectId}`), 'Project');
  61  |     if (current.name !== original.name) await success(await request.patch(`/api/v1/projects/${projectId}`, { headers: headers(), data: { row_version: current.row_version, name: original.name } }), 'Project');
  62  |   }
  63  | 
  64  |   const invalidBytes = Buffer.from('not a decoded raster image');
  65  |   const upload = await success<UploadSession>(await request.post('/api/v1/uploads', { headers: headers(), data: { workspace_id: workspaces[0].id, purpose: 'client_logo', filename: 'synthetic-invalid.png', mime_type: 'image/png', size_bytes: invalidBytes.length } }), 'UploadSession', 201);
  66  |   try {
  67  |     await error(await request.put(upload.upload_url, { headers: { ...headers(), 'Content-Type': 'image/png' }, data: invalidBytes }), 422, 'SOURCE_UNREADABLE');
  68  |     const open = await success<UploadSession>(await request.get(`/api/v1/uploads/${upload.id}`), 'UploadSession');
  69  |     expect(open.status).toBe('open');
  70  |     await error(await request.post(`/api/v1/uploads/${upload.id}/complete`, { headers: headers(), data: { actual_size_bytes: invalidBytes.length, start_processing: false } }), 409, 'UPLOAD_INCOMPLETE');
  71  |   } finally {
  72  |     await success(await request.post(`/api/v1/uploads/${upload.id}/cancel`, { headers: headers(), data: {} }), 'Success');
  73  |   }
  74  | });
  75  | 
  76  | test('audience preset HTTP lifecycle is strict and settings authority is independent of project preparation', async ({ request, playwright }) => {
  77  |   await login(request, producer);
  78  |   const label = `Synthetic HTTP audience ${randomUUID()}`;
  79  |   let preset: AudiencePreset | undefined;
  80  |   let archived = false;
  81  |   const contributorRequest = await playwright.request.newContext({ baseURL: origin });
  82  |   try {
  83  |     preset = await success<AudiencePreset>(await request.post('/api/v1/audience-presets', { headers: headers(), data: { label, scope: 'external', settings: {} } }), 'AudiencePreset', 201);
  84  |     const createdId = preset.id;
  85  |     preset = await success<AudiencePreset>(await request.patch(`/api/v1/audience-presets/${preset.id}`, { headers: headers(), data: { row_version: preset.row_version, label: `${label} edited` } }), 'AudiencePreset');
  86  |     expect(preset.id).toBe(createdId);
  87  |     expect(preset.row_version).toBe(2);
  88  |     await login(contributorRequest, contributor);
  89  |     await error(await contributorRequest.post('/api/v1/audience-presets', { headers: headers(), data: { label: 'Denied audience creation', scope: 'external', settings: {} } }), 403, 'CAPABILITY_REQUIRED');
  90  |     await error(await contributorRequest.patch(`/api/v1/audience-presets/${preset.id}`, { headers: headers(), data: { row_version: preset.row_version, label: 'Denied audience edit' } }), 403, 'CAPABILITY_REQUIRED');
  91  |     await error(await contributorRequest.post(`/api/v1/audience-presets/${preset.id}/archive`, { headers: headers(), data: { row_version: preset.row_version } }), 403, 'CAPABILITY_REQUIRED');
  92  |     const result = await success<{ success: boolean; affected_ids: string[] }>(await request.post(`/api/v1/audience-presets/${preset.id}/archive`, { headers: headers(), data: { row_version: preset.row_version } }), 'Success');
  93  |     expect(result.affected_ids).toContain(preset.id); archived = true;
  94  |     const listed = await request.get(`/api/v1/audience-presets?q=${encodeURIComponent(label)}`);
  95  |     expect(listed.status()).toBe(200);
  96  |     const body = await listed.json();
  97  |     expect(Object.keys(body).sort()).toEqual(['data', 'page', 'request_id']);
  98  |     validateContract('Page', body.page);
  99  |     (body.data as AudiencePreset[]).forEach(item => validateContract('AudiencePreset', item));
  100 |     expect((body.data as AudiencePreset[]).some(item => item.id === preset!.id)).toBeFalsy();
  101 |   } finally {
  102 |     if (preset && !archived) await request.post(`/api/v1/audience-presets/${preset.id}/archive`, { headers: headers(), data: { row_version: preset.row_version } });
  103 |     await contributorRequest.dispose();
  104 |   }
  105 | });
  106 | 
```