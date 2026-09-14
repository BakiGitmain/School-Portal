import { useEffect } from 'react';
import { Linking, Platform } from 'react-native';

import Constants, { AppOwnership } from 'expo-constants';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

import { isUserRole } from '../../hooks/useCurrentProfile';
import { getNotificationRoute } from '../../lib/notificationRoutes';
import { supabase } from '../../lib/supabase';
import { useNotificationCenter } from '../../context/NotificationCenterContext';
import { useAppSettings } from '../../context/AppSettingsContext';

type NotificationsModule = typeof import('expo-notifications');
type NotificationResponse = import('expo-notifications').NotificationResponse;

let currentToken: string | null = null;
let registrationPromise: Promise<unknown> | null = null;
const openedNotifications = new Set<string>();
const PUSH_TOKEN_KEY = 'eduportal.device.expo-push-token';

export type PushRegistrationStatus = 'registered' | 'denied' | 'unavailable' | 'failed';

function isExpoGo() {
  return Constants.appOwnership === AppOwnership.Expo;
}

async function registerCurrentDevice(Notifications: NotificationsModule): Promise<PushRegistrationStatus> {
  if (!Device.isDevice) return 'unavailable';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('school-updates', {
      name: 'School updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return 'unavailable';

  let permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted' && permissions.canAskAgain) {
    permissions = await Notifications.requestPermissionsAsync();
  }
  if (permissions.status !== 'granted') return 'denied';

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('Push registration is waiting for an EAS project ID. Run eas init before a device build.');
    return 'failed';
  }

  const pushToken = await Notifications.getExpoPushTokenAsync({ projectId });
  currentToken = pushToken.data;
  const { error } = await supabase.rpc('register_push_token_v1', {
    p_expo_push_token: pushToken.data,
    p_platform: Platform.OS,
    p_app_version: Constants.expoConfig?.version ?? null,
  });
  if (error) throw error;
  await SecureStore.setItemAsync(PUSH_TOKEN_KEY, pushToken.data);
  return 'registered';
}

export async function enableCurrentPushNotifications(): Promise<PushRegistrationStatus> {
  if (Platform.OS === 'web' || isExpoGo()) return 'unavailable';
  try {
    const Notifications = await import('expo-notifications');
    return await registerCurrentDevice(Notifications);
  } catch (error) {
    console.log('PUSH REGISTRATION ERROR:', error);
    return 'failed';
  }
}

export async function openNotificationSettings() {
  try {
    await Linking.openSettings();
  } catch (error) {
    console.log('OPEN NOTIFICATION SETTINGS ERROR:', error);
  }
}

async function openNotification(response: NotificationResponse) {
  const request = response.notification.request;
  if (openedNotifications.has(request.identifier)) return;
  openedNotifications.add(request.identifier);

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,must_change_password')
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!profile || !isUserRole(profile.role) || profile.must_change_password) return;

  const notificationId = request.content.data?.notificationId;
  if (typeof notificationId === 'string' && /^[0-9a-f-]{36}$/i.test(notificationId)) {
    const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId });
    if (error) console.log('MARK PUSH NOTIFICATION READ ERROR:', error);
  }

  router.push(getNotificationRoute(profile.role, request.content.data?.actionType));
}

export async function disableCurrentPushToken() {
  const token = currentToken ?? await SecureStore.getItemAsync(PUSH_TOKEN_KEY);
  if (!token) return true;
  const { error } = await supabase.rpc('disable_push_token_v1', { p_expo_push_token: token });
  if (error) {
    console.log('DISABLE PUSH TOKEN ERROR:', error);
    return false;
  }
  currentToken = null;
  await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  return true;
}

export default function PushNotificationManager() {
  const { refresh } = useNotificationCenter();
  const { notificationsEnabled, setNotificationsEnabled } = useAppSettings();

  useEffect(() => {
    if (Platform.OS === 'web') return undefined;

    // SDK 57's StoreClient execution environment also includes expo-dev-client.
    // appOwnership === Expo is the narrower signal that this is specifically Expo Go.
    if (isExpoGo()) {
      console.info('Push notifications require a development/preview build.');
      return undefined;
    }

    if (!notificationsEnabled) {
      void disableCurrentPushToken();
      return undefined;
    }

    let active = true;
    let receivedSubscription: { remove: () => void } | undefined;
    let responseSubscription: { remove: () => void } | undefined;
    let authSubscription: { unsubscribe: () => void } | undefined;

    async function setup() {
      const Notifications = await import('expo-notifications');
      if (!active) return;

      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      const register = () => {
        if (registrationPromise) return;
        registrationPromise = registerCurrentDevice(Notifications)
          .then(status => {
            if (active && (status === 'denied' || status === 'failed')) {
              setNotificationsEnabled(false);
            }
          })
          .catch(error => {
            console.log('PUSH REGISTRATION ERROR:', error);
            if (active) setNotificationsEnabled(false);
          })
          .finally(() => {
            registrationPromise = null;
          });
      };
      const handleResponse = async (response: NotificationResponse) => {
        await openNotification(response);
        await refresh();
        Notifications.clearLastNotificationResponse();
      };
      register();
      receivedSubscription = Notifications.addNotificationReceivedListener(() => {
        void refresh();
      });
      responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        void handleResponse(response).catch(error => console.log('OPEN PUSH NOTIFICATION ERROR:', error));
      });
      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse) setTimeout(() => {
        if (active) void handleResponse(lastResponse).catch(error => console.log('OPEN PUSH NOTIFICATION ERROR:', error));
      }, 300);
      const { data } = supabase.auth.onAuthStateChange(event => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          setTimeout(register, 0);
        }
        if (event === 'SIGNED_OUT') currentToken = null;
      });
      authSubscription = data.subscription;
    }

    void setup().catch(error => console.log('PUSH SETUP ERROR:', error));
    return () => {
      active = false;
      receivedSubscription?.remove();
      responseSubscription?.remove();
      authSubscription?.unsubscribe();
    };
  }, [notificationsEnabled, refresh, setNotificationsEnabled]);

  return null;
}
