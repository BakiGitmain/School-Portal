-- Correct the literal-delimiter validation used by the setup and registration RPCs.
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
    or p_expo_push_token !~ '^(Expo(nent)?PushToken)[[][A-Za-z0-9_-]+[]]$'
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

create or replace function public.configure_push_webhook_v1(
  p_url text,
  p_secret text
)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_url_id uuid;
  v_secret_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if p_url !~ '^https://[a-z]{20}[.]supabase[.]co/functions/v1/send-notification$'
    or length(p_secret) < 32
  then
    raise exception 'Invalid push webhook configuration' using errcode = '22023';
  end if;

  select id into v_url_id from vault.secrets where name = 'push_webhook_url' limit 1;
  if v_url_id is null then
    perform vault.create_secret(p_url, 'push_webhook_url', 'Push delivery Edge Function URL');
  else
    perform vault.update_secret(v_url_id, p_url, 'push_webhook_url', 'Push delivery Edge Function URL');
  end if;

  select id into v_secret_id from vault.secrets where name = 'push_webhook_secret' limit 1;
  if v_secret_id is null then
    perform vault.create_secret(p_secret, 'push_webhook_secret', 'Push delivery webhook authentication');
  else
    perform vault.update_secret(v_secret_id, p_secret, 'push_webhook_secret', 'Push delivery webhook authentication');
  end if;
end;
$$;
