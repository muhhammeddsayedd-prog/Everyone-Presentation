-- Read-only quiescence diagnostic; no inputs, facts, URLs or credentials.
begin read only;
set local search_path='';
set local statement_timeout='20s';
select id,kind,resource_id,status,stage,attempt,created_at,updated_at
from eps.jobs where status in('queued','running','waiting_for_input')
order by created_at;
rollback;
