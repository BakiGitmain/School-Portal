import React from 'react';

import {
  Tabs,
} from 'expo-router';

import AppHeader from './AppHeader';

import {
  AnimatedTabBar,
} from './AnimatedTabBar';

import {
  useAppSettings,
} from '../../context/AppSettingsContext';

import type {
  UserRole,
} from '../../constants/roleNavigation';

type Props = {
  role:
    UserRole;
};

export function RoleTabsLayout({
  role,
}: Props) {
  const {
    colors,
  } =
    useAppSettings();

  const commonOptions = {
    headerShown:
      true,

    headerShadowVisible:
      false,

    header: () => (
      <AppHeader
        role={
          role
        }
      />
    ),

    sceneStyle: {
      backgroundColor:
        colors.background,
    },

    lazy:
      true,

    animation:
      'fade' as const,
  };

  /*
   * =====================================================
   * PRESIDENT / ADMIN
   * =====================================================
   */

  if (
    role ===
    'admin'
  ) {
    return (
      <Tabs
        screenOptions={
          commonOptions
        }
        tabBar={(props) => (
          <AnimatedTabBar
            {...props}
            role="admin"
          />
        )}
      >
        {/* Hidden profile page */}

        <Tabs.Screen
          name="profile"
          options={{
            href:
              null,
          }}
        />

        {/* Hidden settings page */}

        <Tabs.Screen
          name="settings"
          options={{
            href:
              null,
          }}
        />

        {/* Teacher route/folder */}

        <Tabs.Screen
          name="teacher"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />

        {/* Class details */}

        <Tabs.Screen
          name="class/[id]"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />

        {/* Student details */}

        <Tabs.Screen
          name="student/[id]"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />
      </Tabs>
    );
  }

  /*
   * =====================================================
   * TEACHER
   * =====================================================
   */

  if (
    role ===
    'teacher'
  ) {
    return (
      <Tabs
        screenOptions={
          commonOptions
        }
        tabBar={(props) => (
          <AnimatedTabBar
            {...props}
            role="teacher"
          />
        )}
      >
        {/* Hidden profile */}

        <Tabs.Screen
          name="profile"
          options={{
            href:
              null,
          }}
        />

        {/* Hidden settings */}

        <Tabs.Screen
          name="settings"
          options={{
            href:
              null,
          }}
        />

        {/* Student details */}

        <Tabs.Screen
          name="student/[id]"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />
      </Tabs>
    );
  }

  /*
   * =====================================================
   * STUDENT
   * =====================================================
   */

  return (
    <Tabs
      screenOptions={
        commonOptions
      }
      tabBar={(props) => (
        <AnimatedTabBar
          {...props}
          role="student"
        />
      )}
    >
      <Tabs.Screen
        name="profile"
        options={{
          href:
            null,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href:
            null,
        }}
      />
    </Tabs>
  );
}