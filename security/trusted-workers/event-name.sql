create function public.hq_rename_active_fire_event(p_event_id uuid,p_name text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not worker_trust_internal.is_manager() then raise exception 'Not authorized' using errcode='42501';end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 120 then raise exception 'Invalid event name';end if;
 update public.fire_events set name=trim(p_name) where id=p_event_id and status='active';return found;
end $$;
revoke all on function public.hq_rename_active_fire_event(uuid,text) from public,anon;
grant execute on function public.hq_rename_active_fire_event(uuid,text) to authenticated;
