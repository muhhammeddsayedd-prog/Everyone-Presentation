"""Finite body-only successful row reuse in one STABLE invocation; no SQL runner."""
import hashlib

DATA_SHA = '4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7'
WRAPPER_SHA = 'f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb'


def need(ok):
    if not ok:
        raise ValueError('GENERATION_REVIEW_REUSE_UNCONFIRMED')


def sha(text):
    return hashlib.sha256(text.encode()).hexdigest()


LOOKUPS = [
    {'row': 'pool', 'type': 'eps.workspace_candidates', 'cache': 'pools',
     'key': "assignment.workspace_candidate_id::text||':'||p_workspace::text",
     'query': 'select * into pool from eps.workspace_candidates where id=assignment.workspace_candidate_id and workspace_id=p_workspace and archived_at is null;',
     'tail': "if not found then perform eps.fail('ASSIGNMENT_STATE_INVALID','An assigned project candidate is unavailable.',409);end if;"},
    {'row': 'candidate', 'type': 'eps.candidates', 'cache': 'candidates', 'key': 'pool.candidate_id::text',
     'query': 'select * into candidate from eps.candidates where id=pool.candidate_id;',
     'tail': "if not found then perform eps.fail('ASSIGNMENT_STATE_INVALID','An assigned shared profile is unavailable.',409);end if;"},
    {'row': 'media', 'type': 'eps.candidate_media', 'cache': 'media',
     'key': "pool.selected_candidate_media_id::text||':'||candidate.id::text",
     'query': 'select * into media from eps.candidate_media where id=pool.selected_candidate_media_id and candidate_id=candidate.id;',
     'tail': "if not found then issues:=issues||jsonb_build_array(eps.review_issue('MEDIA_UNAVAILABLE','blocking',pool.id,null,'Selected introduction no longer matches this profile.','Choose an available introduction.'));"},
    {'row': 'asset', 'type': 'eps.media_assets', 'cache': 'videos', 'key': 'media.source_asset_id::text',
     'query': 'select * into asset from eps.media_assets where id=media.source_asset_id;',
     'tail': "if not found or asset.status<>'ready'then issues:=issues||jsonb_build_array(eps.review_issue('MEDIA_UNAVAILABLE','blocking',pool.id,null,'Selected original video is unavailable.','Choose an available introduction.'));end if;"},
    {'row': 'frame_asset', 'type': 'eps.media_assets', 'cache': 'frames',
     'key': "frame_id::text||':'||media.id::text||':'||media.source_asset_id::text",
     'query': "select * into frame_asset from eps.media_assets f where f.id=frame_id and f.status='ready'and f.purpose='candidate_frame'and f.source_asset_id=media.source_asset_id and f.sha256 is not null and f.width>0 and f.height>0 and f.source_timestamp_ms>=0 and exists(select 1 from eps.candidate_media_frames link where link.candidate_media_id=media.id and link.asset_id=f.id);",
     'tail': "if not found then frame_input:=frame_input||jsonb_build_array(jsonb_build_object('asset_id',frame_id,'available',false));issues:=issues||jsonb_build_array(eps.review_issue('FRAME_UNAVAILABLE','blocking',frame_id,null,'A selected source frame is unavailable.','Choose an available frame or clear the selection.'));"},
]

ROLE_INPUTS = "select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'headcount',headcount,'category',category,'requirements',requirements,'clarifications',clarifications,'sort_order',sort_order)order by sort_order,id),'[]')into role_inputs from eps.roles where workspace_id=p_workspace and archived_at is null;"
SLOT_INPUTS = "select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'role_id',s.role_id,'label',s.label,'provisional',s.provisional,'sort_order',s.sort_order)order by r.sort_order,r.id,s.sort_order,s.id),'[]')into slot_inputs from eps.slots s join eps.roles r on r.id=s.role_id where s.workspace_id=p_workspace and s.archived_at is null and r.archived_at is null;"
CATEGORY = "(select r.category from eps.roles r where r.id=(v->>'role_id')::uuid)"


def cost(row):
    # Count both the physical composite and its fully serialized field bytes;
    # this accounts for toasted values as well as key/array-entry overhead.
    return f'pg_column_size({row})::bigint+octet_length({row}::text)::bigint+octet_length(reuse_key)+256'


def lookup(item):
    row, cache = item['row'], item['cache']
    return f"""reuse_key:={item['key']};reuse_pos:=array_position(reuse_{cache}_keys,reuse_key);
     if reuse_pos is not null then {row}:=reuse_{cache}[reuse_pos];reuse_found:=true;
     else
      {item['query']}
      reuse_found:=found;
      if reuse_found then
       reuse_cost:={cost(row)};
       if reuse_bytes+reuse_cost<=4194304 then
        reuse_{cache}_keys:=array_append(reuse_{cache}_keys,reuse_key);reuse_{cache}:=array_append(reuse_{cache},{row});reuse_bytes:=reuse_bytes+reuse_cost;
       end if;
      end if;
     end if;
     {item['tail'].replace('if not found', 'if not reuse_found', 1)}"""


def retain(row, cache):
    return f"""reuse_key:={row}.id::text;reuse_cost:={cost(row)};
   if reuse_bytes+reuse_cost<=4194304 then
    reuse_{cache}:=array_append(reuse_{cache},{row});reuse_bytes:=reuse_bytes+reuse_cost;
   else reuse_{cache}_complete:=false;end if;"""


def edits():
    declaration = "slot_inputs jsonb;begin"
    extra = "slot_inputs jsonb;\n -- Private per-invocation row data only. No misses or authority results retained.\n reuse_bytes bigint:=0;reuse_cost bigint;reuse_key text;reuse_pos integer;reuse_found boolean;\n reuse_roles eps.roles[]:='{}';reuse_slots eps.slots[]:='{}';reuse_roles_complete boolean:=true;reuse_slots_complete boolean:=true;"
    for item in LOOKUPS:
        extra += f"\n reuse_{item['cache']}_keys text[]:='{{}}';reuse_{item['cache']} {item['type']}[]:='{{}}';"
    extra += '\nbegin'
    pairs = [(declaration, extra)]
    for item in LOOKUPS:
        # Original indentation remains outside this finite region.
        pairs.append((item['query'] + '\n' + (' ' * (6 if item['row'] in ['asset', 'frame_asset'] else 5 if item['row'] == 'media' else 4)) + item['tail'], lookup(item)))
    role_loop = 'for role_item in select * from eps.roles where workspace_id=p_workspace and archived_at is null order by sort_order,id loop'
    slot_loop = 'for slot_item in select * from eps.slots where role_id=role_item.id and workspace_id=p_workspace and archived_at is null order by sort_order,id loop'
    pairs.extend([
        (role_loop, role_loop + '\n   ' + retain('role_item', 'roles')),
        (slot_loop, slot_loop + '\n   ' + retain('slot_item', 'slots')),
        (CATEGORY, "(case when reuse_roles_complete then (select r.category from unnest(reuse_roles)r where r.id=(v->>'role_id')::uuid)else " + CATEGORY + 'end)'),
        (ROLE_INPUTS, 'if reuse_roles_complete then\n  ' + ROLE_INPUTS.replace('from eps.roles where workspace_id=p_workspace and archived_at is null;', 'from unnest(reuse_roles);') + '\n else\n  ' + ROLE_INPUTS + '\n end if;'),
        (SLOT_INPUTS, 'if reuse_roles_complete and reuse_slots_complete then\n  ' + SLOT_INPUTS.replace('from eps.slots s join eps.roles r', 'from unnest(reuse_slots)s join unnest(reuse_roles)r') + '\n else\n  ' + SLOT_INPUTS + '\n end if;'),
    ])
    return pairs


def patch_data_body(body):
    need(sha(body) == DATA_SHA)
    for before, after in edits():
        need(body.count(before) == 1)
        body = body.replace(before, after, 1)
    return body


def unpatch_data_body(body):
    for before, after in reversed(edits()):
        need(body.count(after) == 1)
        body = body.replace(after, before, 1)
    need(sha(body) == DATA_SHA)
    return body


def patch_wrapper_body(body):
    need(sha(body) == WRAPPER_SHA)
    return """declare data jsonb;begin
 perform eps.review_require(p_workspace);perform eps.require_capability('cast.read');
 data:=eps.review_snapshot_data(p_workspace,p_series_id,p_output);
 -- Repeat current-clock authority checks at return; no authorization is cached.
 perform eps.review_require(p_workspace);perform eps.require_capability('cast.read');return data;
end"""
