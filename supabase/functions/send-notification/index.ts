import { createClient } from 'npm:@supabase/supabase-js@2';

type PushTicket = {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
};

type PushReceipt = PushTicket;

const jsonHeaders = { 'Content-Type': 'application/json' };

function safeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

Deno.serve(async request => {
  if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);

  const expectedSecret = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';
  const suppliedSecret = request.headers.get('x-webhook-secret') ?? '';
  if (!expectedSecret || !safeEqual(suppliedSecret, expectedSecret)) return response({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return response({ error: 'Server configuration missing' }, 500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const body = await request.json().catch(() => null) as {
    notificationId?: unknown;
    setup?: unknown;
    checkReceipts?: unknown;
  } | null;
  if (body?.setup === true) {
    const { error } = await supabase.rpc('configure_push_webhook_v1', {
      p_url: `${supabaseUrl}/functions/v1/send-notification`,
      p_secret: expectedSecret,
    });
    return error ? response({ error: 'Webhook setup failed' }, 500) : response({ configured: true });
  }

  if (body?.checkReceipts === true) {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: pending, error: pendingError } = await supabase
      .from('notification_push_deliveries')
      .select('id,push_token_id,expo_ticket_id')
      .eq('status', 'pending')
      .not('expo_ticket_id', 'is', null)
      .lt('attempted_at', cutoff)
      .limit(1000);
    if (pendingError) return response({ error: 'Receipt lookup failed' }, 500);

    const rows = (pending ?? []).filter(row => typeof row.expo_ticket_id === 'string');
    let delivered = 0;
    let failed = 0;
    const invalidPushTokenIds = new Set<string>();

    for (let start = 0; start < rows.length; start += 300) {
      const batch = rows.slice(start, start + 300);
      const receiptResponse = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids: batch.map(row => row.expo_ticket_id) }),
      });
      const receiptBody = await receiptResponse.json().catch(() => null) as {
        data?: Record<string, PushReceipt>;
      } | null;
      if (!receiptResponse.ok || !receiptBody?.data) continue;

      for (const row of batch) {
        const receipt = receiptBody.data[row.expo_ticket_id as string];
        if (!receipt) continue;
        const nextStatus = receipt.status === 'ok' ? 'sent' : 'failed';
        const { error: updateError } = await supabase
          .from('notification_push_deliveries')
          .update({
            status: nextStatus,
            error_code: receipt.details?.error ?? null,
            error_message: receipt.message ?? null,
          })
          .eq('id', row.id);
        if (updateError) continue;
        if (nextStatus === 'sent') delivered += 1;
        else failed += 1;
        if (receipt.details?.error === 'DeviceNotRegistered') {
          invalidPushTokenIds.add(String(row.push_token_id));
        }
      }
    }

    if (invalidPushTokenIds.size) {
      await supabase
        .from('push_tokens')
        .update({ enabled: false, updated_at: new Date().toISOString() })
        .in('id', [...invalidPushTokenIds]);
    }
    return response({ checked: rows.length, delivered, failed });
  }

  const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(notificationId)) {
    return response({ error: 'Invalid notification ID' }, 400);
  }

  const { data: notification, error: notificationError } = await supabase
    .from('app_notifications')
    .select('id,title,message,action_type')
    .eq('id', notificationId)
    .maybeSingle();
  if (notificationError) return response({ error: 'Notification lookup failed' }, 500);
  if (!notification) return response({ error: 'Notification not found' }, 404);

  const { data: recipientRows, error: recipientError } = await supabase.rpc('notification_recipient_ids_v1', {
    p_notification_id: notificationId,
  });
  if (recipientError) return response({ error: 'Recipient lookup failed' }, 500);
  const recipientIds = [...new Set((recipientRows ?? []).map(row => String(row.user_id)))];
  if (!recipientIds.length) return response({ delivered: 0, failed: 0 });

  const tokens: Array<{ id: string; expo_push_token: string }> = [];
  for (let start = 0; start < recipientIds.length; start += 250) {
    const { data, error } = await supabase
      .from('push_tokens')
      .select('id,expo_push_token')
      .eq('enabled', true)
      .in('user_id', recipientIds.slice(start, start + 250));
    if (error) return response({ error: 'Push token lookup failed' }, 500);
    tokens.push(...(data ?? []));
  }
  if (!tokens.length) return response({ delivered: 0, failed: 0 });

  const { data: existingRows } = await supabase
    .from('notification_push_deliveries')
    .select('push_token_id,status,attempts')
    .eq('notification_id', notificationId);
  const existingByToken = new Map(
    (existingRows ?? []).map(row => [String(row.push_token_id), row]),
  );
  const pendingTokens = tokens.filter(token => {
    const existing = existingByToken.get(token.id);
    return !existing || (existing.status === 'failed' && Number(existing.attempts) < 3);
  });

  let delivered = 0;
  let failed = 0;
  for (let start = 0; start < pendingTokens.length; start += 100) {
    const batch = pendingTokens.slice(start, start + 100);
    const messages = batch.map(token => ({
      to: token.expo_push_token,
      sound: 'default',
      channelId: 'school-updates',
      title: notification.title,
      body: notification.message,
      data: {
        notificationId: notification.id,
        actionType: notification.action_type ?? 'notifications',
      },
    }));

    let tickets: PushTicket[];
    try {
      const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate' },
        body: JSON.stringify(messages),
      });
      const expoBody = await expoResponse.json() as { data?: PushTicket[] };
      if (!expoResponse.ok || !Array.isArray(expoBody.data)) throw new Error(`Expo push service returned ${expoResponse.status}`);
      tickets = expoBody.data;
    } catch (error) {
      tickets = batch.map(() => ({ status: 'error', message: error instanceof Error ? error.message : 'Push request failed' }));
    }

    const attemptedAt = new Date().toISOString();
    const deliveries = batch.map((token, index) => {
      const ticket = tickets[index] ?? { status: 'error' as const, message: 'Missing Expo ticket' };
      if (ticket.status === 'ok') delivered += 1;
      else failed += 1;
      return {
        notification_id: notificationId,
        push_token_id: token.id,
        status: ticket.status === 'ok' ? 'pending' : 'failed',
        expo_ticket_id: ticket.id ?? null,
        error_code: ticket.details?.error ?? null,
        error_message: ticket.message ?? null,
        attempts: Number(existingByToken.get(token.id)?.attempts ?? 0) + 1,
        attempted_at: attemptedAt,
      };
    });
    const { error: deliveryError } = await supabase
      .from('notification_push_deliveries')
      .upsert(deliveries, { onConflict: 'notification_id,push_token_id' });
    if (deliveryError) console.error('Could not record push delivery', deliveryError.message);

    const invalidTokens = batch.filter((_, index) => tickets[index]?.details?.error === 'DeviceNotRegistered').map(token => token.id);
    if (invalidTokens.length) {
      await supabase.from('push_tokens').update({ enabled: false, updated_at: attemptedAt }).in('id', invalidTokens);
    }
  }

  return response({ delivered, failed });
});
