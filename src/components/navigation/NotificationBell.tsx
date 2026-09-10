import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  type Href,
  usePathname,
  useRouter,
} from 'expo-router';

import {
  supabase,
} from '../../lib/supabase';

import {
  useCurrentProfile,
} from '../../hooks/useCurrentProfile';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../context/AppSettingsContext';

import type {
  UserRole,
} from '../../constants/roleNavigation';

type Props = {
  role: UserRole;
};

export default function NotificationBell({
  role,
}: Props) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const {
    profile,
  } =
    useCurrentProfile();

  const {
    colors,
  } =
    useAppSettings();

  const styles =
    useMemo(
      () =>
        createStyles(
          colors,
        ),
      [
        colors,
      ],
    );

  const [
    unreadCount,
    setUnreadCount,
  ] =
    useState(0);

  const loadCount =
    useCallback(
      async () => {
        if (
          !profile?.user_id
        ) {
          setUnreadCount(
            0,
          );

          return;
        }

        const {
          data,
          error,
        } =
          await supabase.rpc(
            'get_my_notification_unread_count',
          );

        if (
          error
        ) {
          console.log(
            'NOTIFICATION COUNT ERROR:',
            error,
          );

          return;
        }

        setUnreadCount(
          Math.max(
            0,
            Number(
              data ??
                0,
            ),
          ),
        );
      },
      [
        profile?.user_id,
      ],
    );

  useEffect(
    () => {
      void loadCount();

      const interval =
        setInterval(
          () => {
            void loadCount();
          },
          20000,
        );

      const subscription =
        AppState.addEventListener(
          'change',
          state => {
            if (
              state ===
              'active'
            ) {
              void loadCount();
            }
          },
        );

      return () => {
        clearInterval(
          interval,
        );

        subscription.remove();
      };
    },
    [
      loadCount,
      pathname,
    ],
  );

  function openNotifications() {
    router.push(
      `/${role}/notifications` as Href,
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      onPress={
        openNotifications
      }
      style={({
        pressed,
      }) => [
        styles.button,

        pressed &&
          styles.pressed,
      ]}
    >
      <Ionicons
        name={
          unreadCount > 0
            ? 'notifications'
            : 'notifications-outline'
        }
        size={24}
        color={
          unreadCount > 0
            ? colors.primary
            : colors.textSecondary
        }
      />

      {unreadCount >
      0 ? (
        <View
          style={
            styles.badge
          }
        >
          <Text
            style={
              styles.badgeText
            }
          >
            {unreadCount >
            99
              ? '99+'
              : unreadCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    button: {
      width:
        42,

      height:
        42,

      borderRadius:
        21,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.surfaceSecondary,

      borderWidth:
        1,

      borderColor:
        colors.border,
    },

    pressed: {
      opacity:
        0.68,
    },

    badge: {
      position:
        'absolute',

      right:
        -3,

      top:
        -3,

      minWidth:
        18,

      height:
        18,

      paddingHorizontal:
        4,

      borderRadius:
        9,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EF4444',

      borderWidth:
        2,

      borderColor:
        colors.surface,
    },

    badgeText: {
      color:
        '#FFFFFF',

      fontSize:
        9,

      lineHeight:
        11,

      fontWeight:
        '900',
    },
  });
}