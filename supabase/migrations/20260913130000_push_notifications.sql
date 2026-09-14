-- Device push registration, delivery bookkeeping, and low-noise school reminders.
-- This migration is additive and preserves all existing notification history.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  app_version text,
  enabled boolean not null default true,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_enabled_idx
  on public.push_tokens (user_id, enabled);

alter table public.push_tokens enable row level security;

drop policy if exists "Users can view their push tokens" on public.push_tokens;
create policy "Users can view their push tokens"
  on public.push_tokens for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can add their push tokens" on public.push_tokens;
create policy "Users can add their push tokens"
  on public.push_tokens for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update their push tokens" on public.push_tokens;
create policy "Users can update their push tokens"
  on public.push_tokens for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can remove their push tokens" on public.push_tokens;
create policy "Users can remove their push tokens"
  on public.push_tokens for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.register_push_token_v1(
  p_expo_push_token text,
  p_platform text,
  p_app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_token_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_platform not in ('android', 'ios') then
    raise exception 'Unsupported device platform' using errcode = '22023';
  end if;

  if p_expo_push_token is null
    or length(p_expo_push_token) > 255
    or p_expo_push_token !~ '^(Expo(nent)?PushToken)\\[[A-Za-z0-9_-]+\\]$'
  then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = v_user_id and coalesce(must_change_password, false) = false
  ) then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  insert into public.push_tokens (
    user_id, expo_push_token, platform, app_version, enabled, registered_at, updated_at
  ) values (
    v_user_id, p_expo_push_token, p_platform, nullif(trim(p_app_version), ''), true, now(), now()
  )
  on conflict (expo_push_token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        app_version = excluded.app_version,
        enabled = true,
        registered_at = now(),
        updated_at = now()
  returning id into v_token_id;

  return v_token_id;
end;
$$;

create or replace function public.disable_push_token_v1(p_expo_push_token text)
returns void
language sql
security definer
set search_path = public, auth
as $$
  update public.push_tokens
  set enabled = false, updated_at = now()
  where user_id = auth.uid() and expo_push_token = p_expo_push_token;
$$;

revoke all on function public.register_push_token_v1(text, text, text) from public;
revoke all on function public.disable_push_token_v1(text) from public;
grant execute on function public.register_push_token_v1(text, text, text) to authenticated;
grant execute on function public.disable_push_token_v1(text) to authenticated;

create table if not exists public.notification_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.app_notifications(id) on delete cascade,
  push_token_id uuid not null references public.push_tokens(id) on delete cascade,
  status text not null check (status in ('pending', 'sent', 'failed')),
  expo_ticket_id text,
  error_code text,
  error_message text,
  attempts integer not null default 1 check (attempts > 0),
  attempted_at timestamptz not null default now(),
  unique (notification_id, push_token_id)
);

create index if not exists notification_push_deliveries_notification_idx
  on public.notification_push_deliveries (notification_id, status);

alter table public.notification_push_deliveries enable row level security;
revoke all on public.notification_push_deliveries from anon, authenticated;

-- Safely broaden the existing allow-list; notification data never contains raw routes.
do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.app_notifications'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%action_type%'
  loop
    execute format('alter table public.app_notifications drop constraint %I', v_constraint.conname);
  end loop;
end;
$$;

alter table public.app_notifications
  add constraint app_notifications_action_type_check
  check (action_type is null or action_type in ('calendar', 'attendance', 'behavior', 'results', 'schedule', 'notifications'));

create or replace function public.notification_recipient_ids_v1(p_notification_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.user_id
  from public.app_notifications n
  join public.profiles p
    on coalesce(p.must_change_password, false) = false
  left join public.school_classes c on c.id = p.class_id
  where n.id = p_notification_id
    and n.visible_from <= now()
    and (n.expires_at is null or n.expires_at > now())
    and case n.audience_type
      when 'all' then true
      when 'role' then p.role = n.target_role
      when 'category' then p.role = 'student' and c.category = n.target_category
      when 'class' then p.role = 'student' and p.class_id = n.target_class_id
      when 'user' then p.user_id = n.target_user_id
      else false
    end;
$$;

revoke all on function public.notification_recipient_ids_v1(uuid) from public, anon, authenticated;
grant execute on function public.notification_recipient_ids_v1(uuid) to service_role;

create or replace function public.enqueue_notification_push_v1()
returns trigger
language plpgsql
security definer
set search_path = public, vault, net
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url
  from vault.decrypted_secrets where name = 'push_webhook_url' limit 1;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;

  if nullif(v_url, '') is null or nullif(v_secret, '') is null then
    return new;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('notificationId', new.id),
    timeout_milliseconds := 10000
  );

  return new;
exception when others then
  -- Push is best effort; the in-app notification must always survive.
  raise warning 'Push enqueue failed for notification %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists app_notifications_enqueue_push on public.app_notifications;
create trigger app_notifications_enqueue_push
  after insert on public.app_notifications
  for each row execute function public.enqueue_notification_push_v1();

create or replace function public.notify_published_timetable_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and old.status is distinct from 'published' then
    insert into public.app_notifications (
      kind, title, message, audience_type, target_role,
      sender_user_id, source_type, source_key, action_type, visible_from
    ) values
      ('info', 'Schedule updated', 'A new teaching schedule has been published.', 'role', 'teacher', auth.uid(), 'timetable', 'published:' || new.id || ':teacher', 'schedule', now()),
      ('info', 'Schedule updated', 'A new class schedule has been published.', 'role', 'student', auth.uid(), 'timetable', 'published:' || new.id || ':student', 'schedule', now())
    on conflict (source_type, source_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists timetable_versions_notify_published on public.timetable_versions;
create trigger timetable_versions_notify_published
  after update of status on public.timetable_versions
  for each row execute function public.notify_published_timetable_v1();

create or replace function public.create_attendance_reminders_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_local_now timestamp := clock_timestamp() at time zone 'Africa/Nairobi';
  v_today date;
  v_day integer;
  v_now_minute integer;
  v_inserted integer := 0;
begin
  if current_user not in ('postgres', 'service_role') then
    raise exception 'Server role required' using errcode = '42501';
  end if;

  v_today := v_local_now::date;
  v_day := extract(isodow from v_local_now)::integer;
  v_now_minute := extract(hour from v_local_now)::integer * 60
    + extract(minute from v_local_now)::integer;

  with due as (
    select
      c.id as class_id,
      c.class_name,
      c.homeroom_teacher_user_id as teacher_user_id,
      max(e.end_minute) as last_end_minute
    from public.timetable_versions v
    join public.timetable_entries e on e.version_id = v.id
    join public.school_classes c
      on c.id = e.class_id
      and c.homeroom_teacher_user_id = e.teacher_user_id
    join public.profiles p
      on p.user_id = c.homeroom_teacher_user_id
      and p.role = 'teacher'
      and coalesce(p.must_change_password, false) = false
    where v.status = 'published'
      and e.day_of_week = v_day
    group by c.id, c.class_name, c.homeroom_teacher_user_id
  ), inserted as (
    insert into public.app_notifications (
      kind, title, message, audience_type, target_user_id,
      sender_user_id, source_type, source_key, action_type, visible_from
    )
    select
      'attendance',
      'Attendance reminder',
      'You still need to complete attendance for ' || due.class_name || '.',
      'user',
      due.teacher_user_id,
      null,
      'attendance_reminder',
      v_today::text || ':' || due.teacher_user_id::text || ':' || due.class_id::text,
      'attendance',
      now()
    from due
    where v_now_minute >= due.last_end_minute
      and v_now_minute <= due.last_end_minute + 180
      and not exists (
        select 1 from public.attendance_sessions s
        where s.class_id = due.class_id and s.attendance_date = v_today
      )
    on conflict (source_type, source_key) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.create_attendance_reminders_v1() from public, anon, authenticated;
grant execute on function public.create_attendance_reminders_v1() to service_role;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'attendance-reminders-v1' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'attendance-reminders-v1',
    '*/15 3-15 * * 1-5',
    'select public.create_attendance_reminders_v1();'
  );
end;
$$;
