/** Exact observed pairs; no general normalization. */
export const PAIR_EVIDENCE={
  "path": "tracking/evidence/m07/recovery29/2026-10-30T12-19-02-143Z-0ec7ead2-diagnostic-differences.json",
  "sha256": "ea581b2e795f6c06fe2b950b714957520529517f946bfcf9fb7f100005015d2a"
};
export const OBSERVED_PAIRS=[
  {
    "key": "tables|auth.sessions|acl",
    "source": "{postgres=ar*wdDxtm/supabase_auth_admin,supabase_auth_admin=arwdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}",
    "dump_clone": "{supabase_auth_admin=arwdDxtm/supabase_auth_admin,postgres=ar*wdDxtm/supabase_auth_admin,dashboard_user=arwdDxtm/supabase_auth_admin}"
  },
  {
    "key": "constraints|eps.mcp_oauth_resources.mcp_oauth_resources_resource_check|definition",
    "source": "CHECK ((((length(resource) >= 1) AND (length(resource) <= 2048)) AND (resource !~ '[[:cntrl:][:space:]]'::text) AND ((resource ~ '^https://[^/@?#]+(/[^?#]*)?$'::text) OR (resource ~ '^http://(127\\.0\\.0\\.1|localhost|\\[::1\\])(:[0-9]{1,5})?/mcp$'::text))))",
    "dump_clone": "CHECK (((length(resource) >= 1) AND (length(resource) <= 2048) AND (resource !~ '[[:cntrl:][:space:]]'::text) AND ((resource ~ '^https://[^/@?#]+(/[^?#]*)?$'::text) OR (resource ~ '^http://(127\\.0\\.0\\.1|localhost|\\[::1\\])(:[0-9]{1,5})?/mcp$'::text))))"
  }
];
