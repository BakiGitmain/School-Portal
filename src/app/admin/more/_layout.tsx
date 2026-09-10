import React from 'react';

import {
  Stack,
} from 'expo-router';

export default function AdminMoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}