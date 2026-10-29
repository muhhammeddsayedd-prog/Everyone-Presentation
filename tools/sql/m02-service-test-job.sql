begin read only;
select id as job_id,workspace_id,stage,input_hash,status from eps.jobs where workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and kind='specs_extract' order by created_at desc limit 1;
rollback;
