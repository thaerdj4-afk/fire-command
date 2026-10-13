-- Run inside BEGIN; ... ROLLBACK. Fixtures never reach live realtime subscribers.
create temp table worker_test_results(name text,passed boolean,detail text) on commit drop;
do $test$
declare e uuid; w uuid; other uuid; t text:=repeat('a',64); bad text:=repeat('b',64); ok boolean;
begin
 insert into public.fire_events(name,event_number,status) overriding system value values('SECURITY ROLLBACK TEST',7000000000000000001,'active') returning id into e;
 insert into public.worker_access_sessions(event_id,token_hash,expires_at)
 values(e,encode(extensions.digest(t,'sha256'),'hex'),now()+interval '1 hour');
 w:=public.worker_secure_register(e,t,'ROLLBACK WORKER','972500000000');
 insert into public.workers(event_id,name,status) values(e,'OTHER ROLLBACK WORKER','בדרך') returning id into other;
 insert into worker_test_results values('registration and binding',w is not null and public.worker_secure_session_worker_valid(w,t),null);
 insert into worker_test_results values('cross-worker token rejected',not public.worker_secure_session_worker_valid(other,t),null);
 insert into worker_test_results values('forged token rejected',not public.worker_secure_send_request(w,bad,'SOS / סכנה','test'),null);
 begin
  ok:=public.worker_secure_update_location(w,t,33.2,35.7,10);
  insert into worker_test_results values('GPS update',ok,null);
 exception when others then insert into worker_test_results values('GPS update',false,sqlerrm);end;
 begin
  ok:=not public.worker_secure_update_location(w,t,'NaN'::float8,35.7,10)
     and not public.worker_secure_update_location(w,t,33.2,'Infinity'::float8,10)
     and not public.worker_secure_update_location(w,t,91,35.7,10);
  insert into worker_test_results values('invalid coordinates rejected',ok,null);
 exception when others then insert into worker_test_results values('invalid coordinates rejected',false,sqlerrm);end;
 insert into worker_test_results values('SOS delivered by bound worker',public.worker_secure_send_request(w,t,'SOS / סכנה','rollback test'),null);
 insert into public.worker_requests(event_id,worker_id,worker_name,request_type,details,status)
 values(e,w,'ROLLBACK WORKER','הודעה מהחפ״ק','test message','חדש');
 insert into worker_test_results select 'worker receives HQ message',exists(select 1 from public.worker_secure_inbox(w,t) where details='test message'),null;
 insert into worker_test_results select 'other worker inbox rejected',not exists(select 1 from public.worker_secure_inbox(other,t)),null;
 insert into public.worker_requests(event_id,worker_id,worker_name,request_type,details,status)
 values(e,w,'ROLLBACK WORKER','הפסקת שיתוף מיקום','test','פעיל');
 begin
  insert into worker_test_results values('HQ stop enforced on server',not public.worker_secure_update_location(w,t,33.2,35.7,10),null);
 exception when others then insert into worker_test_results values('HQ stop enforced on server',false,sqlerrm);end;
 insert into worker_test_results values('finish accepted',public.worker_secure_set_status(w,t,'סיים'),null);
 insert into worker_test_results values('finished worker SOS rejected',not public.worker_secure_send_request(w,t,'SOS / סכנה','test'),null);
 update public.worker_access_sessions set revoked_at=now() where worker_id=w;
 insert into worker_test_results values('revocation enforced',not public.worker_secure_session_worker_valid(w,t),null);
 update public.worker_access_sessions set revoked_at=null,created_at=now()-interval '2 hours',expires_at=now()-interval '1 second' where worker_id=w;
 insert into worker_test_results values('expiry enforced',not public.worker_secure_session_worker_valid(w,t),null);
 update public.worker_access_sessions set expires_at=now()+interval '1 hour' where worker_id=w;
 update public.fire_events set status='ended' where id=e;
 insert into worker_test_results values('closed event session rejected',not public.worker_secure_session_worker_valid(w,t),null);
end $test$;
select * from worker_test_results;
