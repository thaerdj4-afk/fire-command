-- Worker staging RPC only. No live HQ files, policies, legacy RPCs, or tables changed.
create or replace function public.worker_secure_update_location(
 p_worker_id uuid,p_session_token text,p_latitude double precision,
 p_longitude double precision,p_accuracy double precision default null)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
 if not public.worker_secure_session_worker_valid(p_worker_id,p_session_token) then return false; end if;
 if (p_latitude is null) <> (p_longitude is null) then return false; end if;
 -- PostgreSQL has no isfinite(float8). Range checks reject NaN and infinities too.
 if p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180) then return false; end if;
 if p_accuracy is not null and not (p_accuracy between 0 and 100000) then return false; end if;
 update public.workers w set latitude=p_latitude,longitude=p_longitude,
 location_accuracy=p_accuracy,location_updated_at=pg_catalog.now()
 where w.id=p_worker_id and w.status<>'סיים'
 and exists(select 1 from public.fire_events e where e.id=w.event_id and e.status='active')
 and not exists(select 1 from public.worker_requests r where r.event_id=w.event_id
   and (r.worker_id=w.id or (r.worker_id is null and r.worker_name=w.name))
   and r.request_type='הפסקת שיתוף מיקום' and r.status='פעיל');
 return found;
end $function$;

create or replace function public.worker_secure_register(p_event_id uuid,p_session_token text,p_name text,p_phone text default null)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_session uuid;v_worker uuid;
begin
 if length(coalesce(pg_catalog.btrim(p_name),'')) not between 2 and 70 or length(coalesce(p_phone,''))>24 then return null; end if;
 if not public.worker_secure_session_valid(p_event_id,p_session_token) then return null; end if;
 select s.id,s.worker_id into v_session,v_worker from public.worker_access_sessions s
 where s.event_id=p_event_id and s.revoked_at is null and s.expires_at>pg_catalog.now()
 and s.token_hash=pg_catalog.encode(extensions.digest(p_session_token,'sha256'),'hex') for update;
 if v_session is null then return null; end if;
 if v_worker is not null then return v_worker; end if;
 insert into public.workers(event_id,name,phone,status)
 values(p_event_id,pg_catalog.btrim(p_name),nullif(pg_catalog.btrim(p_phone),''),'בדרך') returning id into v_worker;
 update public.worker_access_sessions set worker_id=v_worker,last_used_at=pg_catalog.now() where id=v_session;
 return v_worker;
end $function$;
