-- Additive feature: private device approval, never trusts a name/phone as authentication.
create schema if not exists worker_trust_internal;
revoke all on schema worker_trust_internal from public,anon,authenticated;
create table public.worker_trusted_devices(
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 70),
 phone text not null check(phone ~ '^9725[0-9]{8}$'), token_hash text not null unique,
 fingerprint text not null, status text not null default 'pending' check(status in ('pending','approved','revoked')),
 team text not null default '' check(length(team)<=60), equipment text[] not null default '{}',
 push_token text, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '1 year',
 approved_by uuid, approved_at timestamptz, revoked_at timestamptz
);
create index worker_trusted_devices_status_idx on public.worker_trusted_devices(status,created_at);
create table public.worker_trusted_session_links(session_id uuid primary key references public.worker_access_sessions(id) on delete cascade,device_id uuid not null references public.worker_trusted_devices(id));
create index worker_trusted_session_device_idx on public.worker_trusted_session_links(device_id);
create table public.worker_trusted_enrollment_limits(phone_hash text primary key,window_start timestamptz not null default now(),attempts integer not null default 0);
create table public.worker_event_invitations(
 event_id uuid not null references public.fire_events(id),device_id uuid not null references public.worker_trusted_devices(id),
 response text not null default 'pending' check(response in ('pending','accepted','declined')), invited_at timestamptz not null default now(),responded_at timestamptz,invited_by uuid not null,
 primary key(event_id,device_id)
);
create index worker_event_invitations_device_idx on public.worker_event_invitations(device_id,event_id);
create table public.worker_invitation_push_queue(
 id uuid primary key default gen_random_uuid(),event_id uuid not null,device_id uuid not null,
 status text not null default 'queued' check(status in ('queued','sending','accepted_by_provider','failed','unconfigured','no_token','cancelled')),
 attempts integer not null default 0,updated_at timestamptz not null default now(),last_error text,
 foreign key(event_id,device_id) references public.worker_event_invitations(event_id,device_id),unique(event_id,device_id)
);
create index worker_invitation_queue_status_idx on public.worker_invitation_push_queue(event_id,status,updated_at);
alter table public.worker_trusted_devices enable row level security;
alter table public.worker_trusted_session_links enable row level security;
alter table public.worker_trusted_enrollment_limits enable row level security;
alter table public.worker_event_invitations enable row level security;
alter table public.worker_invitation_push_queue enable row level security;
revoke all on public.worker_trusted_devices,public.worker_trusted_session_links,public.worker_trusted_enrollment_limits,public.worker_event_invitations,public.worker_invitation_push_queue from public,anon,authenticated;

create function worker_trust_internal.is_manager() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_admin() or exists(select 1 from public.hq_managers m where m.user_id=auth.uid()))
$$;
create function worker_trust_internal.device(p_id uuid,p_token text,p_approved boolean default true) returns uuid language sql stable security definer set search_path='' as $$
 select d.id from public.worker_trusted_devices d where d.id=p_id and p_token ~ '^[0-9a-f]{64}$'
 and d.token_hash=pg_catalog.encode(extensions.digest(p_token,'sha256'),'hex') and d.expires_at>now()
 and (not p_approved or d.status='approved')
$$;
revoke all on all functions in schema worker_trust_internal from public,anon,authenticated;

create function public.worker_request_device_approval(p_name text,p_phone text,p_equipment text[] default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare t text;d uuid;f text;k text;a integer;
begin
 if length(trim(coalesce(p_name,''))) not between 2 and 70 or p_phone !~ '^9725[0-9]{8}$' or p_phone is null or coalesce(cardinality(p_equipment),0)>10 or not coalesce(p_equipment,'{}') <@ array['מפוח','דבשת','מרסס גב','משאבה צפה','משאבה טבולה','תיק צינורות','בלי ציוד'] then raise exception 'Invalid registration';end if;
 k:=encode(extensions.digest(p_phone,'sha256'),'hex');
 insert into public.worker_trusted_enrollment_limits(phone_hash,attempts) values(k,1)
 on conflict(phone_hash) do update set attempts=case when worker_trusted_enrollment_limits.window_start<now()-interval '1 day' then 1 else worker_trusted_enrollment_limits.attempts+1 end,
 window_start=case when worker_trusted_enrollment_limits.window_start<now()-interval '1 day' then now() else worker_trusted_enrollment_limits.window_start end returning attempts into a;
 if a>5 then return jsonb_build_object('error','Too many registration requests');end if;
 t:=encode(extensions.gen_random_bytes(32),'hex');f:=upper(substr(encode(extensions.digest(t,'sha256'),'hex'),1,8));
 insert into public.worker_trusted_devices(name,phone,token_hash,fingerprint,equipment) values(trim(p_name),p_phone,encode(extensions.digest(t,'sha256'),'hex'),f,coalesce(p_equipment,'{}')) returning id into d;
 return jsonb_build_object('id',d,'token',t,'fingerprint',f,'status','pending');
end $$;
create function public.worker_device_profile(p_device_id uuid,p_device_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.worker_trusted_devices;
begin
 if worker_trust_internal.device(p_device_id,p_device_token,false) is null then return null;end if;
 select * into d from public.worker_trusted_devices where id=p_device_id;
 return jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'fingerprint',d.fingerprint,'status',d.status,'team',d.team,'equipment',d.equipment);
end $$;
create function public.worker_device_set_push_token(p_device_id uuid,p_device_token text,p_push_token text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if worker_trust_internal.device(p_device_id,p_device_token,false) is null or length(coalesce(p_push_token,'')) not between 20 and 4096 then return false;end if;
 update public.worker_trusted_devices set push_token=p_push_token where id=p_device_id and status<>'revoked';return found;
end $$;
create function public.worker_device_update_equipment(p_device_id uuid,p_device_token text,p_equipment text[]) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if worker_trust_internal.device(p_device_id,p_device_token,false) is null or cardinality(p_equipment)>10 or p_equipment is null or not p_equipment <@ array['מפוח','דבשת','מרסס גב','משאבה צפה','משאבה טבולה','תיק צינורות','בלי ציוד'] then return false;end if;
 update public.worker_trusted_devices set equipment=p_equipment where id=p_device_id and status<>'revoked';return found;
end $$;
create function public.worker_device_events(p_device_id uuid,p_device_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if worker_trust_internal.device(p_device_id,p_device_token) is null then return '[]';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'event_number',e.event_number::text,'started_at',e.started_at,'response',i.response,'invited_at',i.invited_at) order by e.started_at desc)
 from public.fire_events e left join public.worker_event_invitations i on i.event_id=e.id and i.device_id=p_device_id where e.status='active'),'[]');
end $$;
create function public.worker_device_respond(p_device_id uuid,p_device_token text,p_event_id uuid,p_response text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_response not in ('accepted','declined') or worker_trust_internal.device(p_device_id,p_device_token) is null then return false;end if;
 update public.worker_event_invitations i set response=p_response,responded_at=now() where i.event_id=p_event_id and i.device_id=p_device_id and exists(select 1 from public.fire_events e where e.id=i.event_id and e.status='active');return found;
end $$;
create function public.worker_device_join_event(p_device_id uuid,p_device_token text,p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.worker_trusted_devices;w uuid;sid uuid;t text;until_at timestamptz;
begin
 select * into d from public.worker_trusted_devices where id=worker_trust_internal.device(p_device_id,p_device_token) for update;
 if not found then raise exception 'Device not approved' using errcode='42501';end if;
 perform 1 from public.fire_events where id=p_event_id and status='active' for share;if not found then raise exception 'Event not active';end if;
 select s.worker_id into w from public.worker_trusted_session_links l join public.worker_access_sessions s on s.id=l.session_id where l.device_id=d.id and s.event_id=p_event_id and s.worker_id is not null order by s.created_at desc limit 1;
 if w is not null and exists(select 1 from public.workers where id=w and finish_source='חפ״ק') then raise exception 'Participation closed by HQ';end if;
 if w is null then insert into public.workers(event_id,name,phone,status) values(p_event_id,d.name,d.phone,'בדרך') returning id into w;
 else update public.workers set status='בדרך',finished_at=null,finish_source=null where id=w and status='סיים';end if;
 t:=encode(extensions.gen_random_bytes(32),'hex');until_at:=now()+interval '8 hours';
 insert into public.worker_access_sessions(event_id,worker_id,token_hash,expires_at) values(p_event_id,w,encode(extensions.digest(t,'sha256'),'hex'),until_at) returning id into sid;
 insert into public.worker_trusted_session_links(session_id,device_id) values(sid,d.id);
 update public.worker_event_invitations set response='accepted',responded_at=now() where event_id=p_event_id and device_id=d.id;
 return jsonb_build_object('event_id',p_event_id,'worker_id',w,'session_token',t,'expires_at',until_at,'name',d.name,'phone',d.phone);
end $$;

create function public.hq_trusted_workers() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not worker_trust_internal.is_manager() then raise exception 'Not authorized' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'phone',d.phone,'fingerprint',d.fingerprint,'status',d.status,'team',d.team,'equipment',d.equipment,'push_registered',d.push_token is not null,'created_at',d.created_at) order by d.status,d.name) from public.worker_trusted_devices d),'[]');
end $$;
create function public.hq_decide_worker_device(p_device_id uuid,p_status text,p_team text default '') returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not worker_trust_internal.is_manager() then raise exception 'Not authorized' using errcode='42501';end if;
 if p_status not in ('approved','revoked') or length(coalesce(p_team,''))>60 then raise exception 'Invalid decision';end if;
 perform 1 from public.worker_trusted_devices where id=p_device_id for update;if not found then return false;end if;
 update public.worker_trusted_devices set status=p_status,team=coalesce(p_team,''),approved_by=case when p_status='approved' then auth.uid() else approved_by end,
 approved_at=case when p_status='approved' then now() else approved_at end,revoked_at=case when p_status='revoked' then now() else null end where id=p_device_id;
 if p_status='revoked' then
 update public.worker_access_sessions s set revoked_at=now() from public.worker_trusted_session_links l where l.session_id=s.id and l.device_id=p_device_id and s.revoked_at is null;
 update public.worker_invitation_push_queue set status='cancelled',updated_at=now() where device_id=p_device_id and status in ('queued','sending','failed','unconfigured','no_token');
 end if;return true;
end $$;
create function public.hq_invite_trusted_workers(p_event_id uuid,p_device_ids uuid[] default null,p_team text default null,p_equipment text default null) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not worker_trust_internal.is_manager() then raise exception 'Not authorized' using errcode='42501';end if;
 perform 1 from public.fire_events where id=p_event_id and status='active' for share;if not found then raise exception 'Event not active';end if;
 if cardinality(p_device_ids)>300 then raise exception 'Too many recipients';end if;
 with added as (
 insert into public.worker_event_invitations(event_id,device_id,invited_by)
 select p_event_id,d.id,auth.uid() from public.worker_trusted_devices d where d.status='approved' and d.expires_at>now()
 and (p_device_ids is null or d.id=any(p_device_ids)) and (nullif(p_team,'') is null or d.team=p_team) and (nullif(p_equipment,'') is null or p_equipment=any(d.equipment))
 on conflict(event_id,device_id) do nothing returning event_id,device_id)
 insert into public.worker_invitation_push_queue(event_id,device_id) select event_id,device_id from added;
 get diagnostics n=row_count;return n;
end $$;
create function public.hq_event_invitation_status(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not worker_trust_internal.is_manager() then raise exception 'Not authorized' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'team',d.team,'equipment',d.equipment,'response',i.response,'push_status',q.status,'approved',d.status='approved') order by d.name)
 from public.worker_event_invitations i join public.worker_trusted_devices d on d.id=i.device_id left join public.worker_invitation_push_queue q on q.event_id=i.event_id and q.device_id=i.device_id where i.event_id=p_event_id),'[]');
end $$;
-- Service-only dispatch: tokens never appear in an HQ/browser response.
create function public.service_claim_worker_invitation_push(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with ready as(select q.id from public.worker_invitation_push_queue q join public.worker_trusted_devices d on d.id=q.device_id join public.fire_events e on e.id=q.event_id
 where q.event_id=p_event_id and e.status='active' and d.status='approved' and d.expires_at>now() and q.attempts<3 and (q.status in ('queued','failed','unconfigured','no_token') or (q.status='sending' and q.updated_at<now()-interval '5 minutes')) order by q.updated_at for update of q skip locked limit 100),
 claimed as(update public.worker_invitation_push_queue q set status='sending',attempts=attempts+1,updated_at=now() from ready where q.id=ready.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('queue_id',q.id,'device_id',q.device_id,'push_token',d.push_token,'event_id',q.event_id,'name',e.name,'event_number',e.event_number::text)),'[]'::jsonb) into result from claimed q join public.worker_trusted_devices d on d.id=q.device_id join public.fire_events e on e.id=q.event_id;
 return result;
end $$;
create function public.service_finish_worker_invitation_push(p_queue_id uuid,p_status text,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('accepted_by_provider','failed','unconfigured','no_token','cancelled') then return false;end if;
 update public.worker_invitation_push_queue set status=p_status,last_error=left(p_error,120),updated_at=now() where id=p_queue_id and status='sending';return found;
end $$;
-- Explicit signatures and grants; default PUBLIC execute is removed before commit.
do $$declare r record;begin
 for r in select p.oid::regprocedure as sig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
 'worker_request_device_approval','worker_device_profile','worker_device_set_push_token','worker_device_update_equipment','worker_device_events','worker_device_respond','worker_device_join_event',
 'hq_trusted_workers','hq_decide_worker_device','hq_invite_trusted_workers','hq_event_invitation_status','service_claim_worker_invitation_push','service_finish_worker_invitation_push') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.sig);
 if r.proname like 'worker_%' then execute format('grant execute on function %s to anon,authenticated',r.sig);
 elsif r.proname like 'hq_%' then execute format('grant execute on function %s to authenticated',r.sig);
 else execute format('grant execute on function %s to service_role',r.sig);end if;
 end loop;
end $$;
