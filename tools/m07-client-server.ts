/** Actual Studio HTTP/SDK transport, synthetic business ports. Never a central adapter. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { DomainError, type Actor } from '@eps/domain';
import { createMcpHttpHandler } from '../apps/web/lib/mcp-http.ts';
import type { McpServices } from '../apps/web/lib/mcp.ts';

export const CLIENT_TOOLS = ['get_capabilities', 'list_projects', 'get_project', 'update_project'] as const;
export const CLIENT_ACTOR = '71000000-0000-4000-8000-000000000001';
export const CLIENT_PROJECT = '72000000-0000-4000-8000-000000000001';
export const CLIENT_RENAMED = 'Synthetic Claude Code compatibility passed';
export async function createSyntheticClientServer(marker: string, port = 3117) {
  assert.match(marker, /^[a-f0-9]{64}$/u); assert.ok(port === 3117 || port === 0);
  const actor = { principal_id: CLIENT_ACTOR };
  const trace: Record<string, unknown>[] = [];
  let project = { id: CLIENT_PROJECT, name: 'Synthetic Claude Code compatibility fixture', client_id: null,
    client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: null, can_edit: true };
  let writes = 0; const replay = new Map<string, { input: string; result: typeof project }>();
  const check = (supplied: Actor) => { assert.equal(supplied.principal_id, CLIENT_ACTOR); };
  const copy = () => ({ ...project });
  const services = { studio: {
    async getCapabilities(supplied: Actor) {
      check(supplied); return { principal_id: CLIENT_ACTOR, capabilities: ['projects.read', 'projects.write', 'workspaces.read'],
        timezone: 'Africa/Cairo', enabled_modules: ['casting'], upload_policy: { allowed_mime_types: [], maximum_file_bytes: 5242880, recommended_batch_size: 200, available_purposes: [] } };
    },
    async listProjects(supplied: Actor) { check(supplied); return { data: [copy()], page: { next_cursor: null } }; },
    async getProject(supplied: Actor, id: string) { check(supplied); assert.equal(id, CLIENT_PROJECT); return copy(); },
    async updateProject(supplied: Actor, id: string, input: { row_version: number; name?: string }, context: { idempotencyKey?: string }) {
      check(supplied); assert.equal(id, CLIENT_PROJECT);
      if (!context?.idempotencyKey || Object.keys(input).sort().join(',') !== 'name,row_version' || input.name !== CLIENT_RENAMED) throw new DomainError('INVALID_REQUEST', 'Only the synthetic compatibility rename is accepted.', 400);
      const previous = replay.get(context.idempotencyKey);
      if (previous) { if (previous.input !== JSON.stringify(input)) throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'Synthetic key reuse.', 409); return { ...previous.result }; }
      if (input.row_version !== project.row_version) throw new DomainError('STALE_RESOURCE_VERSION', 'Synthetic project changed.', 409);
      project = { ...project, name: input.name, row_version: project.row_version + 1 }; writes++;
      replay.set(context.idempotencyKey, { input: JSON.stringify(input), result: copy() }); return copy();
    },
  } } as unknown as McpServices;
  let origin = '';
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (incoming.headers['x-eps-synthetic-run'] !== marker || incoming.url !== '/mcp' || incoming.socket.remoteAddress !== '127.0.0.1') {
        outgoing.writeHead(403); outgoing.end(); return;
      }
      const chunks: Buffer[] = []; let size = 0;
      for await (const chunk of incoming) { size += chunk.length; if (size > 96 * 1024) { outgoing.writeHead(413); outgoing.end(); return; } chunks.push(chunk); }
      const body = Buffer.concat(chunks); let message: Record<string, unknown> | undefined;
      if (body.length) { try { message = JSON.parse(body.toString('utf8')); } catch { /* SDK owns malformed protocol input. */ } }
      const params = message?.params as Record<string, unknown> | undefined;
      let event: Record<string, unknown> | undefined;
      if (message) {
        event = { method: message.method, id: message.id ?? null, principal_id: CLIENT_ACTOR,
          requested_protocol_header: incoming.headers['mcp-protocol-version'] ?? null };
        const metadata = (params?._meta ?? message._meta) as Record<string, unknown> | undefined;
        if (metadata?.['io.modelcontextprotocol/clientInfo']) event.client_info = metadata['io.modelcontextprotocol/clientInfo'];
        if (metadata?.['io.modelcontextprotocol/protocolVersion']) event.requested_protocol = metadata['io.modelcontextprotocol/protocolVersion'];
        if (message.method === 'initialize') { event.client_info = params?.clientInfo; event.requested_protocol = params?.protocolVersion; }
        if (message.method === 'tools/call') {
          event.tool = params?.name;
          if (!CLIENT_TOOLS.includes(params?.name as typeof CLIENT_TOOLS[number])) { outgoing.writeHead(403); outgoing.end(); trace.push({ ...event, denied: true }); return; }
          event.arguments = params?.arguments;
        }
        trace.push(event);
      }
      const request = new Request(`${origin}/mcp`, { method: incoming.method, headers: incoming.headers as HeadersInit, ...(body.length ? { body } : {}) });
      const response = await handle(request);
      if (event) { event.response_status = response.status; if (response.ok && typeof incoming.headers['mcp-protocol-version'] === 'string') event.accepted_protocol_header = incoming.headers['mcp-protocol-version']; }
      if (['initialize', 'server/discover'].includes(String(message?.method)) && response.ok) {
        const text = await response.clone().text();
        for (const line of text.split(/\r?\n/u)) {
          try {
            const value = JSON.parse(line.startsWith('data: ') ? line.slice(6) : line);
            const protocol = value.result?._meta?.['io.modelcontextprotocol/protocolVersion'] ?? value._meta?.['io.modelcontextprotocol/protocolVersion'] ?? value.result?.protocolVersion;
            if (protocol) trace.push({ negotiated_protocol: protocol, server_info: value.result?._meta?.['io.modelcontextprotocol/serverInfo'] ?? value._meta?.['io.modelcontextprotocol/serverInfo'] ?? value.result?.serverInfo });
          } catch { /* Other SSE lines. */ }
        }
      }
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(outgoing); else outgoing.end();
    } catch { if (!outgoing.headersSent) outgoing.writeHead(503); outgoing.end(); }
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address(); assert.ok(address && typeof address === 'object' && address.address === '127.0.0.1');
  origin = `http://127.0.0.1:${address.port}`;
  const handle = createMcpHttpHandler({ config: { mode: 'local', baseUrl: origin }, runtime: { adapterMode: 'supabase', environment: 'test', baseUrl: origin },
    localContext: async () => ({ actor, services }), oauthContext: async () => { throw new Error('Synthetic transport must not construct OAuth or central services.'); } });
  return { origin, trace, pid: process.pid, snapshot: () => ({ project: copy(), writes }),
    async close() { assert.equal(process.pid, this.pid); server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
