create temp table inbox_test_results(name text,passed boolean) on commit drop;
do $test$
declare e uuid;w1 uuid;w2 uuid;admin_id uuid;token1 text:=repeat('c',64);token2 text:=repeat('d',64);message_id uuid;
begin
 insert into public.fire_events(name,event_number,status) overriding system value values('INBOX ROLLBACK TEST',7000000000000000002,'active') returning id into e;
 insert into public.workers(event_id,name,status,created_at) values(e,'SAME TEST NAME','בדרך',now()-interval '1 minute') returning id into w1;
 insert into public.worker_access_sessions(event_id,worker_id,token_hash,expires_at) values(e,w1,encode(extensions.digest(token1,'sha256'),'hex'),now()+interval '1 hour');
 insert into public.worker_requests(event_id,worker_name,request_type,details,status) values(e,'SAME TEST NAME','הודעה מהחפ״ק','unique-name legacy message','חדש');
 insert into inbox_test_results select 'unique active name retains live HQ compatibility',exists(select 1 from public.worker_secure_inbox(w1,token1) where details='unique-name legacy message');
 insert into public.workers(event_id,name,status) values(e,'SAME TEST NAME','בדרך') returning id into w2;
 insert into public.worker_access_sessions(event_id,worker_id,token_hash,expires_at) values(e,w2,encode(extensions.digest(token2,'sha256'),'hex'),now()+interval '1 hour');
 insert into inbox_test_results select 'duplicate names do not receive ambiguous legacy message',not exists(select 1 from public.worker_secure_inbox(w1,token1) where details='unique-name legacy message') and not exists(select 1 from public.worker_secure_inbox(w2,token2) where details='unique-name legacy message');
 insert into public.worker_requests(event_id,worker_id,worker_name,request_type,details,status) values(e,w1,'SAME TEST NAME','הודעה מהחפ״ק','id addressed message','חדש');
 insert into inbox_test_results select 'ID-targeted message reaches correct duplicate-name worker',exists(select 1 from public.worker_secure_inbox(w1,token1) where details='id addressed message');
 insert into inbox_test_results select 'ID-targeted message not leaked to other duplicate-name worker',not exists(select 1 from public.worker_secure_inbox(w2,token2) where details='id addressed message');
 insert into inbox_test_results select 'wrong worker token denied',not exists(select 1 from public.worker_secure_inbox(w2,token1));
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.admin_send_secure_worker_message(w1,'Unauthorized');
  insert into inbox_test_results values('admin message endpoint rejects non-admin',false);
 exception when insufficient_privilege then insert into inbox_test_results values('admin message endpoint rejects non-admin',true);end;
 select user_id into admin_id from public.user_roles where role='admin' limit 1;
 if admin_id is null then raise exception 'No admin identity available for rollback-only authorized path test'; end if;
 perform set_config('request.jwt.claim.sub',admin_id::text,true);
 message_id:=public.admin_send_secure_worker_message(w2,'Manager ID-targeted test');
 insert into inbox_test_results select 'admin RPC binds event/identity server-side',exists(select 1 from public.worker_requests where id=message_id and worker_id=w2 and event_id=e);
 insert into inbox_test_results select 'admin RPC message delivered only to recipient',exists(select 1 from public.worker_secure_inbox(w2,token2) where id=message_id) and not exists(select 1 from public.worker_secure_inbox(w1,token1) where id=message_id);
 update public.workers set status='סיים' where id=w2;
 begin
  perform public.admin_send_secure_worker_message(w2,'Closed');
  insert into inbox_test_results values('admin cannot send to finished worker',false);
 exception when raise_exception then insert into inbox_test_results values('admin cannot send to finished worker',true);end;
 insert into public.worker_requests(event_id,worker_name,request_type,details,status,created_at) values(e,'SAME TEST NAME','הודעה מהחפ״ק','older participation message','חדש',now()-interval '2 hours');
 insert into inbox_test_results select 'old participation name-only messages hidden',not exists(select 1 from public.worker_secure_inbox(w1,token1) where details='older participation message');
end $test$;
select * from inbox_test_results;
