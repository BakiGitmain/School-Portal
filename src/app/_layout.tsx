import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import {
  AppSettingsProvider,
} from '../context/AppSettingsContext';

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <>
        <StatusBar style="dark" />

        <Stack
          screenOptions={{
            headerShown: false,

            contentStyle: {
              backgroundColor:
                '#F7FAFE',
            },
          }}
        />
      </>
    </AppSettingsProvider>
  );
}