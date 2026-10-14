create or replace function public.worker_device_join_event(p_device_id uuid,p_device_token text,p_event_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.worker_trusted_devices;w uuid;sid uuid;t text;until_at timestamptz;
begin
 select * into d from public.worker_trusted_devices where id=worker_trust_internal.device(p_device_id,p_device_token) for update;
 if not found or d.status<>'approved' or d.expires_at<=now() then raise exception 'Device not approved' using errcode='42501';end if;
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

create or replace function public.hq_decide_worker_device(p_device_id uuid,p_status text,p_team text default '') returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not worker_trust_internal.is_manager() then raise exception 'Not authorized' using errcode='42501';end if;
 if p_status not in ('approved','revoked') or length(coalesce(p_team,''))>60 then raise exception 'Invalid decision';end if;
 perform 1 from public.worker_trusted_devices where id=p_device_id for update;if not found then return false;end if;
 update public.worker_trusted_devices set status=p_status,team=coalesce(p_team,''),approved_by=case when p_status='approved' then auth.uid() else approved_by end,
 approved_at=case when p_status='approved' then now() else approved_at end,revoked_at=case when p_status='revoked' then now() else null end where id=p_device_id;
 if p_status='revoked' then
 update public.workers w set status='סיים',finished_at=now(),finish_source='חפ״ק',latitude=null,longitude=null,location_updated_at=now() where w.id in (select s.worker_id from public.worker_trusted_session_links l join public.worker_access_sessions s on s.id=l.session_id where l.device_id=p_device_id) and w.status<>'סיים';
 update public.worker_access_sessions s set revoked_at=now() from public.worker_trusted_session_links l where l.session_id=s.id and l.device_id=p_device_id and s.revoked_at is null;
 update public.worker_invitation_push_queue set status='cancelled',updated_at=now() where device_id=p_device_id and status in ('queued','sending','failed','unconfigured','no_token');
 end if;return true;
end $$;
