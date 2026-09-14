import React, {
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useRouter,
} from 'expo-router';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

import type {
  UserRole,
} from '../../../constants/roleNavigation';
import { getNotificationRoute } from '../../../lib/notificationRoutes';
import {
  useNotificationCenter,
  type NotificationKind,
  type NotificationRow,
} from '../../../context/NotificationCenterContext';

type Props = {
  role:
    UserRole;
};

export default function NotificationsScreen({
  role,
}: Props) {
  const router =
    useRouter();

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

  const {
    notifications,
    unreadCount,
    loading,
    errorMessage,
    refresh,
    markRead,
    markAllRead: markAllReadInCenter,
  } = useNotificationCenter();

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    markingAll,
    setMarkingAll,
  ] =
    useState(false);

  async function loadNotifications() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  async function markAllRead() {
    if (
      unreadCount ===
        0 ||
      markingAll
    ) {
      return;
    }

    try {
      setMarkingAll(
        true,
      );

      await markAllReadInCenter();
    } catch (
      error
    ) {
      console.log(
        'MARK ALL READ ERROR:',
        error,
      );
    } finally {
      setMarkingAll(
        false,
      );
    }
  }

  async function openNotification(
    notification:
      NotificationRow,
  ) {
    if (
      !notification.is_read
    ) {
      await markRead(
        notification.id,
      );
    }

    router.push(getNotificationRoute(role, notification.action_type));
  }

  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void loadNotifications()
          }
          tintColor={
            colors.primary
          }
        />
      }
    >
      <Pressable
        onPress={() =>
          router.replace(`/${role}`)
        }
        style={({
          pressed,
        }) => [
          styles.backButton,

          pressed &&
            styles.pressed,
        ]}
      >
        <Ionicons
          name="arrow-back"
          size={21}
          color={
            colors.text
          }
        />

        <Text
          style={
            styles.backText
          }
        >
          Back
        </Text>
      </Pressable>

      <View
        style={
          styles.headingRow
        }
      >
        <View
          style={
            styles.headingText
          }
        >
          <Text
            style={
              styles.title
            }
          >
            Notifications
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            {unreadCount >
            0
              ? `${unreadCount} unread`
              : 'You are all caught up'}
          </Text>
        </View>

        {unreadCount >
        0 ? (
          <Pressable
            disabled={
              markingAll
            }
            onPress={() =>
              void markAllRead()
            }
            style={({
              pressed,
            }) => [
              styles.markAllButton,

              pressed &&
                styles.pressed,
            ]}
          >
            {markingAll ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.primary
                }
              />
            ) : (
              <Text
                style={
                  styles.markAllText
                }
              >
                Mark all read
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <View
          style={
            styles.loadingBox
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading notifications...
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.emptyCard}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.danger} />
          <Text style={styles.emptyTitle}>Could not load notifications</Text>
          <Text style={styles.emptyDescription}>{errorMessage}</Text>
          <Pressable style={styles.markAllButton} onPress={() => void refresh()}>
            <Text style={styles.markAllText}>Try again</Text>
          </Pressable>
        </View>
      ) : notifications.length ===
        0 ? (
        <View
          style={
            styles.emptyCard
          }
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <Ionicons
              name="notifications-outline"
              size={30}
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            Nothing new
          </Text>

          <Text
            style={
              styles.emptyDescription
            }
          >
            Important school updates will appear here.
          </Text>
        </View>
      ) : (
        <View
          style={
            styles.list
          }
        >
          {notifications.map(
            notification => (
              <NotificationCard
                key={
                  notification.id
                }
                notification={
                  notification
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
                onPress={() =>
                  void openNotification(
                    notification,
                  )
                }
              />
            ),
          )}
        </View>
      )}
    </ScrollView>
  );
}

function NotificationCard({
  notification,
  colors,
  styles,
  onPress,
}: {
  notification:
    NotificationRow;

  colors:
    AppThemeColors;

  styles:
    ReturnType<
      typeof createStyles
    >;

  onPress:
    () => void;
}) {
  const config =
    getKindConfig(
      notification.kind,
    );

  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.card,

        !notification.is_read &&
          styles.unreadCard,

        pressed &&
          styles.pressed,
      ]}
    >
      <View
        style={[
          styles.iconBox,

          {
            backgroundColor:
              config.background,
          },
        ]}
      >
        <Ionicons
          name={
            config.icon
          }
          size={24}
          color={
            config.color
          }
        />
      </View>

      <View
        style={
          styles.cardContent
        }
      >
        <View
          style={
            styles.cardTitleRow
          }
        >
          <Text
            style={[
              styles.cardTitle,

              !notification.is_read &&
                styles.cardTitleUnread,
            ]}
            numberOfLines={2}
          >
            {
              notification.title
            }
          </Text>

          {!notification.is_read ? (
            <View
              style={
                styles.unreadDot
              }
            />
          ) : null}
        </View>

        <Text
          style={
            styles.message
          }
        >
          {
            notification.message
          }
        </Text>

        <Text
          style={
            styles.date
          }
        >
          {
            formatDate(
              notification.created_at,
            )
          }
        </Text>
      </View>

      {notification.action_type ? (
        <Ionicons
          name="chevron-forward"
          size={19}
          color={
            colors.textMuted
          }
        />
      ) : null}
    </Pressable>
  );
}

function getKindConfig(
  kind:
    NotificationKind,
) {
  if (
    kind ===
    'attendance'
  ) {
    return {
      icon:
        'school-outline' as const,

      color:
        '#EF4444',

      background:
        '#FFF0F0',
    };
  }

  if (
    kind ===
    'behavior'
  ) {
    return {
      icon:
        'happy-outline' as const,

      color:
        '#7C3AED',

      background:
        '#F3E8FF',
    };
  }

  if (
    kind ===
    'calendar'
  ) {
    return {
      icon:
        'calendar-outline' as const,

      color:
        '#1671F5',

      background:
        '#EAF3FF',
    };
  }

  if (
    kind ===
    'test'
  ) {
    return {
      icon:
        'document-text-outline' as const,

      color:
        '#EA580C',

      background:
        '#FFF2E8',
    };
  }

  if (
    kind ===
    'meeting'
  ) {
    return {
      icon:
        'people-outline' as const,

      color:
        '#0891B2',

      background:
        '#E7F8FC',
    };
  }

  if (
    kind ===
    'announcement'
  ) {
    return {
      icon:
        'megaphone-outline' as const,

      color:
        '#16A34A',

      background:
        '#ECFDF3',
    };
  }

  return {
    icon:
      'information-circle-outline' as const,

    color:
      '#1671F5',

    background:
      '#EAF3FF',
  };
}

function formatDate(
  value:
    string,
) {
  const date =
    new Date(
      value,
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return '';
  }

  return date.toLocaleString(
    undefined,
    {
      month:
        'short',

      day:
        'numeric',

      hour:
        'numeric',

      minute:
        '2-digit',
    },
  );
}

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    screen: {
      flex:
        1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        16,

      paddingTop:
        16,

      paddingBottom:
        130,
    },

    backButton: {
      alignSelf:
        'flex-start',

      height:
        42,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,

      borderRadius:
        14,

      backgroundColor:
        colors.surfaceSecondary,
    },

    backText: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    headingRow: {
      marginTop:
        22,

      marginBottom:
        18,

      flexDirection:
        'row',

      alignItems:
        'flex-end',

      justifyContent:
        'space-between',

      gap:
        12,
    },

    headingText: {
      flex:
        1,
    },

    title: {
      color:
        colors.text,

      fontSize:
        28,

      lineHeight:
        34,

      fontWeight:
        '900',
    },

    subtitle: {
      marginTop:
        4,

      color:
        colors.textSecondary,

      fontSize:
        14,

      lineHeight:
        19,

      fontWeight:
        '700',
    },

    markAllButton: {
      minHeight:
        38,

      paddingHorizontal:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,
    },

    markAllText: {
      color:
        colors.primary,

      fontSize:
        12,

      fontWeight:
        '900',
    },

    list: {
      gap:
        10,
    },

    card: {
      minHeight:
        102,

      padding:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        20,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    unreadCard: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    iconBox: {
      width:
        50,

      height:
        50,

      borderRadius:
        16,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        13,
    },

    cardContent: {
      flex:
        1,

      minWidth:
        0,

      marginRight:
        7,
    },

    cardTitleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,
    },

    cardTitle: {
      flex:
        1,

      color:
        colors.text,

      fontSize:
        16,

      lineHeight:
        21,

      fontWeight:
        '800',
    },

    cardTitleUnread: {
      fontWeight:
        '900',
    },

    unreadDot: {
      width:
        8,

      height:
        8,

      borderRadius:
        4,

      backgroundColor:
        colors.primary,
    },

    message: {
      marginTop:
        5,

      color:
        colors.textSecondary,

      fontSize:
        14,

      lineHeight:
        20,

      fontWeight:
        '600',
    },

    date: {
      marginTop:
        8,

      color:
        colors.textMuted,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    loadingBox: {
      minHeight:
        260,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    loadingText: {
      marginTop:
        12,

      color:
        colors.textSecondary,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    emptyCard: {
      paddingVertical:
        50,

      paddingHorizontal:
        20,

      alignItems:
        'center',

      borderRadius:
        22,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    emptyIcon: {
      width:
        62,

      height:
        62,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    emptyTitle: {
      marginTop:
        14,

      color:
        colors.text,

      fontSize:
        19,

      fontWeight:
        '900',
    },

    emptyDescription: {
      marginTop:
        5,

      color:
        colors.textMuted,

      fontSize:
        13,

      lineHeight:
        19,

      textAlign:
        'center',

      fontWeight:
        '600',
    },

    pressed: {
      opacity:
        0.72,
    },
  });
}
