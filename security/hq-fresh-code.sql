-- New approved-HQ endpoint. Refreshing entry codes never revokes joined workers.
create or replace function public.hq_fresh_worker_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_code text;
begin
 if auth.uid() is null or not (public.is_admin() or exists(
  select 1 from public.hq_managers m where m.user_id=auth.uid())) then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 perform 1 from public.fire_events e where e.id=p_event_id and e.status='active' for update;
 if not found then raise exception 'Event not active'; end if;
 v_code:=pg_catalog.encode(extensions.gen_random_bytes(16),'hex');
 insert into public.worker_event_access_codes(event_id,code_hash,created_at,expires_at,disabled_at)
 values(p_event_id,extensions.crypt(v_code,extensions.gen_salt('bf',12)),pg_catalog.now(),pg_catalog.now()+interval '8 hours',null)
 on conflict(event_id) do update set code_hash=excluded.code_hash,created_at=excluded.created_at,
 expires_at=excluded.expires_at,disabled_at=null;
 return v_code;
end $function$;
revoke all on function public.hq_fresh_worker_event_code(uuid) from public,anon;
grant execute on function public.hq_fresh_worker_event_code(uuid) to authenticated;
