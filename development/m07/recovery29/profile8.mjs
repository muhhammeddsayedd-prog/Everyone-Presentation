/** Additive exact two-pair wrapper; original six-pair planner stays separate. */
import{exactRestoreProfileSql}from'./profile.mjs';
import{OBSERVED_PAIRS}from'./observed-pairs.mjs';
export const MCP_RESOURCE_EXPRESSION=String.raw`length(resource)between 1 and 2048 and resource!~'[[:cntrl:][:space:]]'
  and(resource~'^https://[^/@?#]+(/[^?#]*)?$'or resource~'^http://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/mcp$')`;
export function exactRestoreProfile8Sql(expected,observed,ownership){
 const remaining={...observed},extra=[];let commands='';
 for(const pair of OBSERVED_PAIRS){
  if(expected[pair.key]===observed[pair.key])continue;
  if(expected[pair.key]!==pair.source||observed[pair.key]!==pair.dump_clone)throw Error('RECOVERY29_UNKNOWN_CATALOGUE_PAIR');
  remaining[pair.key]=expected[pair.key];extra.push(pair.key);
  if(pair.key==='tables|auth.sessions|acl')commands+=`set local role supabase_auth_admin;revoke all privileges on table auth.sessions from supabase_auth_admin,dashboard_user;grant all privileges on table auth.sessions to supabase_auth_admin;grant all privileges on table auth.sessions to dashboard_user;set local role postgres;\n`;
  else if(pair.key==='constraints|eps.mcp_oauth_resources.mcp_oauth_resources_resource_check|definition')commands+=`alter table eps.mcp_oauth_resources drop constraint mcp_oauth_resources_resource_check;alter table eps.mcp_oauth_resources add constraint mcp_oauth_resources_resource_check check(${MCP_RESOURCE_EXPRESSION});\n`;
  else throw Error('RECOVERY29_UNKNOWN_CATALOGUE_PAIR');
 }
 const base=exactRestoreProfileSql(expected,remaining,ownership);
 return{sql:base.sql+commands,differences:[...base.differences,...extra]};
}
