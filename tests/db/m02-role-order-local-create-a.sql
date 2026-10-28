begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
set local application_name='eps_order_create_a';
select set_config('eps.order.requirements',(select requirements::text from eps_local_guard.role_order_fixture where id=1 and marker='EPS ROLE ORDER LOCAL V1'),true);
select set_config('request.jwt.claim.sub','7a940000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a940000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role authenticated;
do $$ begin perform set_config('eps.order.created',public.eps_create_role('7c940000-0000-4000-8000-000000000001',
 jsonb_build_object('name','Synthetic added role','headcount',1,'requirements',current_setting('eps.order.requirements')::jsonb),'order-local-create')->>'id',true); end $$;
reset role;
update eps_local_guard.role_order_fixture fixture set created_role_id=current_setting('eps.order.created')::uuid,
 created_role=(select to_jsonb(role) from eps.roles role where id=current_setting('eps.order.created')::uuid),
 created_slot=(select to_jsonb(slot) from eps.slots slot where role_id=current_setting('eps.order.created')::uuid)
 where fixture.id=1 and fixture.created_role_id is null;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'created',true);
select pg_sleep(6);
commit;
