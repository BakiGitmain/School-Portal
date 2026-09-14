import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { supabase } from '../lib/supabase';
import type { NotificationAction } from '../lib/notificationRoutes';

export type NotificationKind =
  | 'announcement'
  | 'calendar'
  | 'attendance'
  | 'behavior'
  | 'test'
  | 'meeting'
  | 'info';

export type NotificationRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  action_type: NotificationAction | null;
  created_at: string;
  is_read: boolean;
};

type NotificationCenterValue = {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  errorMessage: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<boolean>;
  markAllRead: () => Promise<boolean>;
};

const NotificationCenterContext = createContext<NotificationCenterValue | null>(null);

function normalizeNotifications(value: unknown): NotificationRow[] {
  if (!Array.isArray(value)) return [];

  const byId = new Map<string, NotificationRow>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Partial<NotificationRow>;
    if (
      typeof row.id !== 'string'
      || typeof row.kind !== 'string'
      || typeof row.title !== 'string'
      || typeof row.message !== 'string'
      || typeof row.created_at !== 'string'
    ) continue;

    byId.set(row.id, {
      id: row.id,
      kind: row.kind as NotificationKind,
      title: row.title,
      message: row.message,
      action_type: row.action_type ?? null,
      created_at: row.created_at,
      is_read: Boolean(row.is_read),
    });
  }

  return [...byId.values()].sort(
    (first, second) => Date.parse(second.created_at) - Date.parse(first.created_at),
  );
}

export function NotificationCenterProvider({ children }: PropsWithChildren) {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const requestId = useRef(0);

  const changeUser = useCallback((nextUserId: string | null) => {
    if (userIdRef.current === nextUserId) return;
    userIdRef.current = nextUserId;
    requestId.current += 1;
    setNotifications([]);
    setUnreadCount(0);
    setErrorMessage(null);
    setLoading(Boolean(nextUserId));
    setUserId(nextUserId);
  }, []);

  useEffect(() => {
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (active) changeUser(data.session?.user.id ?? null);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      changeUser(session?.user.id ?? null);
    });

    return () => {
      active = false;
      requestId.current += 1;
      data.subscription.unsubscribe();
    };
  }, [changeUser]);

  const refresh = useCallback(async () => {
    const expectedUserId = userIdRef.current;
    if (!expectedUserId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const currentRequest = ++requestId.current;
    const [notificationsResult, countResult] = await Promise.all([
      supabase.rpc('get_my_notifications', { p_limit: 60 }),
      supabase.rpc('get_my_notification_unread_count'),
    ]);

    if (currentRequest !== requestId.current || userIdRef.current !== expectedUserId) return;
    setLoading(false);

    if (notificationsResult.error) {
      console.log('LOAD NOTIFICATIONS ERROR:', notificationsResult.error);
      setErrorMessage('Notifications could not be loaded. Check your connection and try again.');
      return;
    }

    const nextNotifications = normalizeNotifications(notificationsResult.data);
    setErrorMessage(null);
    setNotifications(nextNotifications);
    if (countResult.error) {
      console.log('LOAD NOTIFICATION COUNT ERROR:', countResult.error);
      setUnreadCount(nextNotifications.filter(item => !item.is_read).length);
    } else {
      setUnreadCount(Math.max(0, Number(countResult.data ?? 0)));
    }
  }, []);

  useEffect(() => {
    if (!userId) return undefined;

    let active = true;
    const refreshIfCurrent = () => {
      if (active && userIdRef.current === userId) void refresh();
    };

    const initialRefresh = setTimeout(refreshIfCurrent, 0);

    // RLS is evaluated for every Postgres Changes event. The notification table
    // stores group audiences, so filtering by user_id at the channel level is not
    // possible; the existing notification SELECT policy remains the privacy gate.
    const channel = supabase
      .channel(`notifications:${userId}:${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_notifications' },
        refreshIfCurrent,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_reads',
          filter: `user_id=eq.${userId}`,
        },
        refreshIfCurrent,
      )
      .subscribe(status => {
        if (status === 'SUBSCRIBED') refreshIfCurrent();
      });

    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshIfCurrent();
    });

    return () => {
      active = false;
      requestId.current += 1;
      clearTimeout(initialRefresh);
      appStateSubscription.remove();
      void supabase.removeChannel(channel);
    };
  }, [refresh, userId]);

  const markRead = useCallback(async (id: string) => {
    const expectedUserId = userIdRef.current;
    if (!expectedUserId) return false;

    setNotifications(current => current.map(item => (
      item.id === id ? { ...item, is_read: true } : item
    )));
    setUnreadCount(current => Math.max(0, current - 1));

    const { error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: id,
    });
    if (!error && userIdRef.current === expectedUserId) return true;

    if (error) console.log('MARK NOTIFICATION READ ERROR:', error);
    if (userIdRef.current === expectedUserId) void refresh();
    return false;
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    const expectedUserId = userIdRef.current;
    if (!expectedUserId) return false;

    setNotifications(current => current.map(item => ({ ...item, is_read: true })));
    setUnreadCount(0);
    const { error } = await supabase.rpc('mark_all_notifications_read');
    if (!error && userIdRef.current === expectedUserId) return true;

    if (error) console.log('MARK ALL NOTIFICATIONS READ ERROR:', error);
    if (userIdRef.current === expectedUserId) void refresh();
    return false;
  }, [refresh]);

  const value = useMemo<NotificationCenterValue>(() => ({
    notifications,
    unreadCount,
    loading,
    errorMessage,
    refresh,
    markRead,
    markAllRead,
  }), [errorMessage, loading, markAllRead, markRead, notifications, refresh, unreadCount]);

  return (
    <NotificationCenterContext.Provider value={value}>
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const value = useContext(NotificationCenterContext);
  if (!value) throw new Error('useNotificationCenter must be used inside NotificationCenterProvider.');
  return value;
}
