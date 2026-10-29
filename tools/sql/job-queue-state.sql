begin read only;
select jsonb_build_object('running',count(*) filter(where status='running'),'queued',count(*) filter(where status='queued'),
 'protected_waiting',count(*) filter(where id='b3f90268-147d-41d4-8875-2a6435df1496' and status='waiting_for_input')) as state from eps.jobs;
rollback;
