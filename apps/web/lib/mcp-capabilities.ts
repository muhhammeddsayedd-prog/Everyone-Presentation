/** Delegation contains atomic business grants. Catalogue expressions describe
 * a preliminary gate; resource/purpose authorization stays in domain/RPC code. */
export const MCP_ATOMIC_CAPABILITIES = new Set([
  'projects.read', 'projects.write', 'workspaces.read', 'workspaces.write',
  'cast.read', 'cast.upload', 'cast.write', 'cast.review', 'presentations.generate',
  'review_links.manage', 'settings.manage', 'operations.read', 'operations.retry',
]);

export function mcpCapabilityAllowed(expression: string, granted: ReadonlySet<string>): boolean {
  if (MCP_ATOMIC_CAPABILITIES.has(expression)) return granted.has(expression);
  switch (expression) {
    case 'workspaces.read AND cast.read': return granted.has('workspaces.read') && granted.has('cast.read');
    case 'workspaces.write AND cast.read': return granted.has('workspaces.write') && granted.has('cast.read');
    case 'workspaces.read OR cast.read': return granted.has('workspaces.read') || granted.has('cast.read');
    case 'purpose-specific: cast.upload OR workspaces.write OR projects.write':
      return ['cast.upload', 'workspaces.write', 'projects.write'].some(capability => granted.has(capability));
    case 'operations.read OR owning workspace read': return granted.has('operations.read') || granted.has('workspaces.read');
    case 'operations.read OR owning workspace read OR own frame read':
      return granted.has('operations.read') || granted.has('workspaces.read') || granted.has('cast.read');
    default: return false;
  }
}
