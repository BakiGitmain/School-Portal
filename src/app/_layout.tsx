import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  AppSettingsProvider,
} from '../context/AppSettingsContext';
import PushNotificationManager from '../components/notifications/PushNotificationManager';
import { NotificationCenterProvider } from '../context/NotificationCenterContext';

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <NotificationCenterProvider>
        <StatusBar style="dark" />
        <PushNotificationManager />

        <Stack
          screenOptions={{
            headerShown: false,

            contentStyle: {
              backgroundColor:
                '#F7FAFE',
            },
          }}
        />
      </NotificationCenterProvider>
    </AppSettingsProvider>
  );
}
