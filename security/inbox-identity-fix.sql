-- Only the protected worker path changes. Live HQ and legacy inbox remain untouched.
create or replace function public.worker_secure_inbox(p_worker_id uuid,p_session_token text)
returns table(id uuid,request_type text,details text,status text,created_at timestamptz)
language sql stable security definer set search_path=''
as $function$
 select r.id,r.request_type,r.details,r.status,r.created_at
 from public.worker_requests r join public.workers w on w.id=p_worker_id and w.event_id=r.event_id
 where public.worker_secure_session_worker_valid(p_worker_id,p_session_token)
 and (r.worker_id=p_worker_id or (
   r.worker_id is null and r.worker_name=w.name and w.status<>'סיים'
   and r.created_at>=w.created_at
   and 1=(select count(*) from public.workers same_name
          where same_name.event_id=w.event_id and same_name.name=w.name and same_name.status<>'סיים')
 ))
 order by r.created_at desc limit 50
$function$;

-- Separate manager endpoint for messages addressed by worker ID, never by name.
create or replace function public.admin_send_secure_worker_message(p_worker_id uuid,p_message text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare w public.workers%rowtype;v_id uuid;
begin
 if not public.is_admin() then raise exception 'Not authorized' using errcode='42501'; end if;
 if length(coalesce(pg_catalog.btrim(p_message),'')) not between 1 and 4000 then raise exception 'Invalid message'; end if;
 select * into w from public.workers where id=p_worker_id and status<>'סיים';
 if not found or not exists(select 1 from public.fire_events e where e.id=w.event_id and e.status='active') then raise exception 'Worker not active'; end if;
 insert into public.worker_requests(worker_id,event_id,worker_name,request_type,details,status)
 values(w.id,w.event_id,w.name,'הודעה מהחפ״ק',pg_catalog.btrim(p_message),'חדש') returning id into v_id;
 return v_id;
end $function$;
revoke all on function public.admin_send_secure_worker_message(uuid,text) from public,anon;
grant execute on function public.admin_send_secure_worker_message(uuid,text) to authenticated;
