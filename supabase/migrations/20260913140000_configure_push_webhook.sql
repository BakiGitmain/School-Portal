-- Service-only helper used by the Edge Function deployment to keep its webhook
-- secret in Vault rather than source control or the mobile application.
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

  if p_url !~ '^https://[a-z]{20}\\.supabase\\.co/functions/v1/send-notification$'
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

revoke all on function public.configure_push_webhook_v1(text, text) from public, anon, authenticated;
grant execute on function public.configure_push_webhook_v1(text, text) to service_role;
