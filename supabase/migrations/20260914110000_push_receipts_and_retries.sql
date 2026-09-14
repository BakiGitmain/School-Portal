-- Verify Expo delivery receipts and retry transiently failed sends without
-- duplicating accepted deliveries. All calls remain authenticated by Vault.

create or replace function public.process_notification_push_delivery_v1()
returns void
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url text;
  v_secret text;
  v_notification_id uuid;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Server role required' using errcode = '42501';
  end if;

  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'push_webhook_url' limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;

  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('checkReceipts', true),
    timeout_milliseconds := 10000
  );

  for v_notification_id in
    select distinct d.notification_id
    from public.notification_push_deliveries d
    where d.status = 'failed'
      and d.attempts < 3
      and d.error_code is distinct from 'DeviceNotRegistered'
      and d.attempted_at < now() - interval '15 minutes'
    order by d.notification_id
    limit 100
  loop
    perform net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-webhook-secret', v_secret
      ),
      body := jsonb_build_object('notificationId', v_notification_id),
      timeout_milliseconds := 10000
    );
  end loop;
end;
$$;

revoke all on function public.process_notification_push_delivery_v1() from public, anon, authenticated;
grant execute on function public.process_notification_push_delivery_v1() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'notification-push-delivery-v1'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'notification-push-delivery-v1',
    '*/15 * * * *',
    'select public.process_notification_push_delivery_v1();'
  );
end;
$$;
