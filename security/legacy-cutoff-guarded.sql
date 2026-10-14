-- NOT APPLIED. This transaction must only run AFTER confirmed worker migration,
-- phone tests, approved-admin HQ read/write/realtime rehearsal and rollback backup.
-- With no explicit readiness setting this file fails before changing permissions.
begin;
do $gate$
begin
 if current_setting('app.worker_cutoff_verified',true) is distinct from 'migrated-and-device-tested' then
  raise exception 'Cutoff blocked: worker migration, device tests and HQ rehearsal must be verified first';
 end if;
 if exists(select 1 from public.workers w join public.fire_events e on e.id=w.event_id
  where e.status='active' and w.status<>'סיים'
  and not exists(select 1 from public.worker_access_sessions s where s.worker_id=w.id
   and s.revoked_at is null and s.expires_at>now())) then
  raise exception 'Cutoff blocked: active workers without protected sessions remain';
 end if;
end $gate$;
-- Authenticated approved HQ/admin policies remain in place.
drop policy if exists worker_insert on public.workers;
drop policy if exists worker_read_own_insert on public.workers;
drop policy if exists worker_update on public.workers;
drop policy if exists request_insert on public.worker_requests;
drop policy if exists request_insert_authenticated on public.worker_requests;
create policy admin_requests_insert_secure on public.worker_requests for insert
 to authenticated with check(public.is_admin());
revoke execute on function public.worker_inbox(uuid,text) from public,anon,authenticated;
revoke execute on function public.worker_event_by_number(text) from public,anon,authenticated;
revoke execute on function public.worker_latest_active_event() from public,anon,authenticated;
revoke execute on function public.worker_bind_secure_session(uuid,uuid,text) from public,anon,authenticated;
revoke execute on function public.verify_worker_event_access(text,text) from public,anon,authenticated;
commit;
