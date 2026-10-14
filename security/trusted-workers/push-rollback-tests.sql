create temp table push_results(name text,passed boolean) on commit drop;
do $$declare m uuid;e uuid;a jsonb;d uuid;t text;batch jsonb;q uuid;begin
 select user_id into m from public.hq_managers limit 1;perform set_config('request.jwt.claim.sub',m::text,true);
 insert into public.fire_events(name,event_number,status) overriding system value values('PUSH ROLLBACK',7000000000000000006,'active') returning id into e;
 a:=public.worker_request_device_approval('PUSH TEST','972500000003','{}');d:=(a->>'id')::uuid;t:=a->>'token';perform public.hq_decide_worker_device(d,'approved');perform public.hq_invite_trusted_workers(e,array[d]);
 batch:=public.service_claim_worker_invitation_push(e);q:=(batch->0->>'queue_id')::uuid;
 insert into push_results values('claim includes exactly one approved invitation',jsonb_array_length(batch)=1);
 insert into push_results values('claimed queue cannot be claimed concurrently',public.service_claim_worker_invitation_push(e)='[]');
 perform public.service_finish_worker_invitation_push(q,'no_token');
 insert into push_results select 'missing token claim marked and not burned retry',status='no_token' and attempts=0 from public.worker_invitation_push_queue where id=q;
 perform public.worker_device_set_push_token(d,t,repeat('test-push-token-',5));batch:=public.service_claim_worker_invitation_push(e);
 insert into push_results values('push token visible only to service claim',batch->0->>'push_token'=repeat('test-push-token-',5));
 perform public.worker_device_respond(d,t,e,'declined');insert into push_results values('declined invitation blocks pending dispatch',not public.service_worker_push_allowed(q));
 perform public.worker_device_respond(d,t,e,'pending'); -- Invalid response cannot change declined state.
 insert into push_results values('invalid response does not reset choice',(select response='declined' from public.worker_event_invitations where event_id=e and device_id=d));
 perform public.hq_decide_worker_device(d,'revoked');insert into push_results values('revoke cancels pending queue',not public.service_worker_push_allowed(q));
 insert into push_results values('manager cannot call service-only token endpoint',not has_function_privilege('authenticated','public.service_claim_worker_invitation_push(uuid)','execute'));
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);insert into push_results values('unapproved signed-in identity cannot dispatch',not public.hq_worker_push_authorized());
end $$;
select * from push_results;
do $$begin if exists(select 1 from push_results where not passed) then raise exception 'Push test failed';end if;end $$;
