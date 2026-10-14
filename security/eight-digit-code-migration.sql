-- New approved-HQ endpoint. Refreshing entry codes never revokes joined workers.
create or replace function public.hq_fresh_worker_event_code(p_event_id uuid)
returns text language plpgsql security definer set search_path=''
as $function$
declare v_code text; v_bytes bytea; v_number bigint;
begin
 if auth.uid() is null or not (public.is_admin() or exists(
  select 1 from public.hq_managers m where m.user_id=auth.uid())) then
  raise exception 'Not authorized' using errcode='42501';
 end if;
 perform 1 from public.fire_events e where e.id=p_event_id and e.status='active' for update;
 if not found then raise exception 'Event not active'; end if;
 loop
  v_bytes:=extensions.gen_random_bytes(4);
  v_number:=pg_catalog.get_byte(v_bytes,0)::bigint*16777216+pg_catalog.get_byte(v_bytes,1)::bigint*65536+pg_catalog.get_byte(v_bytes,2)::bigint*256+pg_catalog.get_byte(v_bytes,3);
  continue when v_number>=4230000000;
  v_code:=(10000000+v_number%90000000)::text;
  exit when not exists(select 1 from public.worker_event_access_codes a where a.event_id=p_event_id and a.code_hash=extensions.crypt(v_code,a.code_hash));
 end loop;
 insert into public.worker_event_access_codes(event_id,code_hash,created_at,expires_at,disabled_at)
 values(p_event_id,extensions.crypt(v_code,extensions.gen_salt('bf',12)),pg_catalog.now(),pg_catalog.now()+interval '8 hours',null)
 on conflict(event_id) do update set code_hash=excluded.code_hash,created_at=excluded.created_at,
 expires_at=excluded.expires_at,disabled_at=null;
 return v_code;
end $function$;
revoke all on function public.hq_fresh_worker_event_code(uuid) from public,anon;
grant execute on function public.hq_fresh_worker_event_code(uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.verify_worker_event_access(p_event_number text, p_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_valid boolean := false; v_recent integer; v_key text;
begin
 if p_event_number is null or p_event_number !~ '^[0-9]{6,19}$' then return false; end if;
 v_key := encode(extensions.digest(p_event_number,'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_key,0));
 select count(*) into v_recent from public.worker_access_attempts
 where attempt_key_hash=v_key and attempted_at>pg_catalog.now()-interval '15 minutes' and not successful;
 if v_recent >= 20 then return false; end if;
 if p_code is not null and (p_code ~ '^[0-9]{8}$' or length(p_code) between 12 and 128) then
  select coalesce(a.disabled_at is null and (a.expires_at is null or a.expires_at > pg_catalog.now()) and a.code_hash=extensions.crypt(p_code,a.code_hash),false)
  into v_valid from public.fire_events e
  join public.worker_event_access_codes a on a.event_id=e.id
  where e.event_number::text=p_event_number and e.status='active' limit 1;
 end if;
 v_valid := coalesce(v_valid,false);
 insert into public.worker_access_attempts(event_number,attempt_key_hash,successful)
 values (p_event_number,v_key,v_valid);
 return v_valid;
end $function$
;
