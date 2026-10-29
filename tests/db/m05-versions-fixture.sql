-- Synthetic packet-shaped data. No real Auth or personal records; outer rollback.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)select current_setting('eps.casting.fixture.actor')::uuid,value from unnest(array['presentations.generate','cast.read','cast.write','cast.review','operations.retry'])value;
insert into eps.audience_presets(id,key,label,scope)values('8a7a0000-0000-4000-8000-000000000001','m05-synthetic-internal','Synthetic internal','internal');
update eps.presentation_processing_config set enabled=true where id;update eps.review_processing_config set enabled=true where id;
update eps.roles set name=case id when'8a3a0000-0000-4000-8000-000000000001'then'Father'else'Manager'end,category='Supporting'where workspace_id=current_setting('eps.casting.fixture.workspace')::uuid;
update eps.candidates set facts=facts||jsonb_build_object('name',case id when'8a5a0000-0000-4000-8000-000000000001'then'Samir'else'Omar'end,'skills_experience','Supplied experience.','height_measurements','178 cm')where id in('8a5a0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000002');
insert into eps.candidates(id,facts,casting_id,source_kind,created_by)values('8a5a0000-0000-4000-8000-000000000003','{"name":"Maya","casting_id":"M05-SYNTHETIC-3","age_or_range":null,"stated_gender":null,"height_measurements":null,"languages":[],"accents":[],"skills_experience":null,"city":null,"previous_projects_roles":null,"classification":null}','M05-SYNTHETIC-3','manual',current_setting('eps.casting.fixture.actor')::uuid);
insert into eps.workspace_candidates(id,workspace_id,candidate_id)values('8a6a0000-0000-4000-8000-000000000004',current_setting('eps.casting.fixture.workspace')::uuid,'8a5a0000-0000-4000-8000-000000000003');
insert into eps.roles(id,workspace_id,name,headcount,sort_order,category,requirements)select'8a3a0000-0000-4000-8000-000000000004',workspace_id,'Waiter',3,2,'Supporting',requirements from eps.roles where id='8a3a0000-0000-4000-8000-000000000001';
insert into eps.slots(id,workspace_id,role_id,ordinal,label,sort_order)select('8a4a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,current_setting('eps.casting.fixture.workspace')::uuid,'8a3a0000-0000-4000-8000-000000000004',n-3,'Waiter '||(n-3),n-4 from generate_series(4,6)n;
set local role authenticated;
do $$declare r record;slot_version bigint;assignment jsonb;series jsonb;begin
 for r in select * from(values
 ('8a4a0000-0000-4000-8000-000000000001','8a6a0000-0000-4000-8000-000000000001',true),
 ('8a4a0000-0000-4000-8000-000000000001','8a6a0000-0000-4000-8000-000000000002',false),
 ('8a4a0000-0000-4000-8000-000000000002','8a6a0000-0000-4000-8000-000000000001',true),
 ('8a4a0000-0000-4000-8000-000000000002','8a6a0000-0000-4000-8000-000000000004',false),
 ('8a4a0000-0000-4000-8000-000000000004','8a6a0000-0000-4000-8000-000000000002',true),
 ('8a4a0000-0000-4000-8000-000000000005','8a6a0000-0000-4000-8000-000000000004',false))v(slot,pool,shortlist)loop
  select(row->>'row_version')::bigint into slot_version from jsonb_array_elements(public.eps_list_slots((case r.slot when'8a4a0000-0000-4000-8000-000000000001'then'8a3a0000-0000-4000-8000-000000000001'when'8a4a0000-0000-4000-8000-000000000002'then'8a3a0000-0000-4000-8000-000000000002'else'8a3a0000-0000-4000-8000-000000000004'end)::uuid,null,100)->'data')row where row->>'id'=r.slot;
  assignment:=public.eps_create_assignment(current_setting('eps.casting.fixture.workspace')::uuid,jsonb_build_object('slot_id',r.slot,'workspace_candidate_id',r.pool,'expected_slot_row_version',slot_version,'shortlist_included',r.shortlist),'m05-fixture-assign-'||r.slot||r.pool);
 end loop;
 series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000001'),'m05-selection');perform set_config('eps.m05.selection',series->>'id',true);
 series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','shortlist','audience_preset_id','8a7a0000-0000-4000-8000-000000000001'),'m05-shortlist');perform set_config('eps.m05.shortlist',series->>'id',true);
end$$;
-- Injected layout proof for domain tests only. Native measurement has separate evidence.
set local role postgres;
do $$declare sid uuid;r jsonb;jid uuid;begin
 foreach sid in array array[current_setting('eps.m05.selection')::uuid,current_setting('eps.m05.shortlist')::uuid]loop
  r:=eps.review_snapshot_data(current_setting('eps.casting.fixture.workspace')::uuid,sid,null);jid:=gen_random_uuid();
  insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status)
  values(jid,current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.actor')::uuid,'review_fit',sid,'{}',repeat('f',64),'eps.review-job-input.pg-jsonb.v1',eps.presentation_hash(to_jsonb(jid)),'measure_review_fit','m05-synthetic-layout','succeeded');
  insert into eps.review_fit_results(job_id,workspace_id,series_id,input_fingerprint,status,result)values(jid,current_setting('eps.casting.fixture.workspace')::uuid,sid,r->>'input_fingerprint','measured',jsonb_build_object('overflows','[]'::jsonb,'measured_at','2026-10-29T20:00:00.000000Z'));
 end loop;
end$$;
set local role authenticated;
