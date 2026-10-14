create function public.hq_worker_push_authorized() returns boolean language sql stable security definer set search_path='' as $$select worker_trust_internal.is_manager()$$;
revoke all on function public.hq_worker_push_authorized() from public,anon;
grant execute on function public.hq_worker_push_authorized() to authenticated;
create function public.service_worker_push_allowed(p_queue_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.worker_invitation_push_queue q join public.worker_trusted_devices d on d.id=q.device_id join public.fire_events e on e.id=q.event_id join public.worker_event_invitations i on i.event_id=q.event_id and i.device_id=q.device_id
 where q.id=p_queue_id and q.status='sending' and d.status='approved' and d.expires_at>now() and e.status='active' and i.response='pending')
$$;
revoke all on function public.service_worker_push_allowed(uuid) from public,anon,authenticated;
grant execute on function public.service_worker_push_allowed(uuid) to service_role;
create or replace function public.service_claim_worker_invitation_push(p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 with ready as(select q.id from public.worker_invitation_push_queue q join public.worker_trusted_devices d on d.id=q.device_id join public.fire_events e on e.id=q.event_id join public.worker_event_invitations i on i.event_id=q.event_id and i.device_id=q.device_id
 where q.event_id=p_event_id and e.status='active' and d.status='approved' and d.expires_at>now() and i.response='pending' and q.attempts<3 and (q.status in ('queued','failed','unconfigured','no_token') or (q.status='sending' and q.updated_at<now()-interval '5 minutes')) order by q.updated_at for update of q skip locked limit 100),
 claimed as(update public.worker_invitation_push_queue q set status='sending',attempts=attempts+1,updated_at=now() from ready where q.id=ready.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('queue_id',q.id,'device_id',q.device_id,'push_token',d.push_token,'event_id',q.event_id,'name',e.name,'event_number',e.event_number::text)),'[]'::jsonb) into result from claimed q join public.worker_trusted_devices d on d.id=q.device_id join public.fire_events e on e.id=q.event_id;
 return result;
end $$;
create or replace function public.service_finish_worker_invitation_push(p_queue_id uuid,p_status text,p_error text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('accepted_by_provider','failed','unconfigured','no_token','cancelled') then return false;end if;
 update public.worker_invitation_push_queue set status=p_status,last_error=left(p_error,120),updated_at=now(),attempts=case when p_status in ('unconfigured','no_token') then greatest(0,attempts-1) else attempts end where id=p_queue_id and status='sending';return found;
end $$;
