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

function isTeacherFullScreenRoute(
  routeName:
    string |
    undefined,
) {
  if (
    !routeName
  ) {
    return false;
  }

  return (
    routeName ===
      'mark-sheet' ||
    routeName ===
      'mark-sheet/[id]' ||
    routeName.startsWith(
      'mark-sheet/',
    )
  );
}

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

  if (
    role ===
    'admin'
  ) {
    return (
      <Tabs
        screenOptions={
          commonOptions
        }
        tabBar={props => (
          <AnimatedTabBar
            {...props}
            role="admin"
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

        <Tabs.Screen
          name="teacher"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />

        <Tabs.Screen
          name="class/[id]"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />

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

  if (
    role ===
    'teacher'
  ) {
    return (
      <Tabs
        screenOptions={
          commonOptions
        }
        tabBar={props => {
          const currentRoute =
            props.state.routes[
              props.state.index
            ];

          if (
            isTeacherFullScreenRoute(
              currentRoute?.name,
            )
          ) {
            return null;
          }

          return (
            <AnimatedTabBar
              {...props}
              role="teacher"
            />
          );
        }}
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

        <Tabs.Screen
          name="student/[id]"
          options={{
            href:
              null,

            headerShown:
              false,
          }}
        />

        <Tabs.Screen
          name="mark-sheet/[id]"
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

  return (
    <Tabs
      screenOptions={
        commonOptions
      }
      tabBar={props => (
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