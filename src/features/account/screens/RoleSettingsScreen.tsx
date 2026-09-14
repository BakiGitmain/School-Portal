import React, {
  useMemo,
} from 'react';

import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import Constants from 'expo-constants';

import {
  useAppSettings,
  type AppearanceMode,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';
import {
  disableCurrentPushToken,
  enableCurrentPushNotifications,
  openNotificationSettings,
} from '../../../components/notifications/PushNotificationManager';

type Role =
  | 'admin'
  | 'teacher'
  | 'student';

type Props = {
  role: Role;
};

const ROLE_LABELS: Record<
  Role,
  string
> = {
  admin: 'President',
  teacher: 'Teacher',
  student: 'Student',
};

export default function RoleSettingsScreen({
  role,
}: Props) {
  const {
    appearance,
    setAppearance,

    resolvedTheme,

    colors,

    notificationsEnabled,
    setNotificationsEnabled,

    hapticsEnabled,
    setHapticsEnabled,

    reduceMotion,
    setReduceMotion,
  } = useAppSettings();

  const styles =
    useMemo(
      () =>
        createStyles(
          colors
        ),
      [colors]
    );

  const version =
    Constants.expoConfig
      ?.version ??
    '1.0.0';

  async function changeNotifications(value: boolean) {
    if (!value) {
      const disabled = await disableCurrentPushToken();
      if (!disabled) {
        Alert.alert('Notifications', "We couldn't update notification settings. Check your connection and try again.");
        return;
      }
      setNotificationsEnabled(false);
      return;
    }

    const status = await enableCurrentPushNotifications();
    if (status === 'registered') {
      setNotificationsEnabled(true);
      return;
    }

    setNotificationsEnabled(false);
    if (status === 'denied') {
      Alert.alert(
        'Allow notifications',
        'Please allow notifications in Android Settings.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void openNotificationSettings() },
        ],
      );
      return;
    }

    Alert.alert(
      'Notifications unavailable',
      status === 'unavailable'
        ? 'Remote notifications require a physical device and an installed preview or production build.'
        : "We couldn't register this device for notifications.",
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'left',
        'right',
        'bottom',
      ]}
    >
      <StatusBar
        style={
          resolvedTheme ===
          'dark'
            ? 'light'
            : 'dark'
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* APPEARANCE */}

        <Text
          style={
            styles.sectionLabel
          }
        >
          Appearance
        </Text>

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.mainRow
            }
          >
            <IconBox
              icon="contrast-outline"
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.title
                }
              >
                Theme
              </Text>

              <Text
                style={
                  styles.description
                }
              >
                Choose your app appearance
              </Text>
            </View>
          </View>

          <View
            style={
              styles.segmented
            }
          >
            <ThemeButton
              title="System"
              mode="system"
              current={
                appearance
              }
              onPress={
                setAppearance
              }
              styles={
                styles
              }
            />

            <ThemeButton
              title="Light"
              mode="light"
              current={
                appearance
              }
              onPress={
                setAppearance
              }
              styles={
                styles
              }
            />

            <ThemeButton
              title="Dark"
              mode="dark"
              current={
                appearance
              }
              onPress={
                setAppearance
              }
              styles={
                styles
              }
            />
          </View>
        </View>

        {/* PREFERENCES */}

        <Text
          style={[
            styles.sectionLabel,
            styles.nextSection,
          ]}
        >
          Preferences
        </Text>

        <View
          style={
            styles.card
          }
        >
          <ToggleRow
            icon="notifications-outline"
            title="Notifications"
            description="Updates and reminders"
            value={
              notificationsEnabled
            }
            onValueChange={
              value => void changeNotifications(value)
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <Divider
            styles={
              styles
            }
          />

          <ToggleRow
            icon="phone-portrait-outline"
            title="Haptic feedback"
            description="Vibration for actions"
            value={
              hapticsEnabled
            }
            onValueChange={
              setHapticsEnabled
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <Divider
            styles={
              styles
            }
          />

          <ToggleRow
            icon="sparkles-outline"
            title="Reduce motion"
            description="Use simpler animations"
            value={
              reduceMotion
            }
            onValueChange={
              setReduceMotion
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />
        </View>

        {/* APP */}

        <Text
          style={[
            styles.sectionLabel,
            styles.nextSection,
          ]}
        >
          App
        </Text>

        <View
          style={
            styles.card
          }
        >
          <InfoRow
            icon="language-outline"
            title="Language"
            value="English"
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <Divider
            styles={
              styles
            }
          />

          <InfoRow
            icon="shield-checkmark-outline"
            title="Account"
            value={
              ROLE_LABELS[
                role
              ]
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <Divider
            styles={
              styles
            }
          />

          <InfoRow
            icon="information-circle-outline"
            title="Version"
            value={`v${version}`}
            colors={
              colors
            }
            styles={
              styles
            }
          />
        </View>

        <Text
          style={
            styles.footer
          }
        >
          EduPortal
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

type SharedStyles =
  ReturnType<
    typeof createStyles
  >;

type ToggleIcon =
  | 'notifications-outline'
  | 'phone-portrait-outline'
  | 'sparkles-outline';

type InfoIcon =
  | 'language-outline'
  | 'shield-checkmark-outline'
  | 'information-circle-outline';

function ThemeButton({
  title,
  mode,
  current,
  onPress,
  styles,
}: {
  title: string;

  mode:
    AppearanceMode;

  current:
    AppearanceMode;

  onPress: (
    mode:
      AppearanceMode
  ) => void;

  styles:
    SharedStyles;
}) {
  const active =
    current === mode;

  return (
    <Pressable
      onPress={() =>
        onPress(mode)
      }
      style={({ pressed }) => [
        styles.segment,

        active &&
          styles.segmentActive,

        pressed &&
          styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.segmentText,

          active &&
            styles.segmentTextActive,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function IconBox({
  icon,
  colors,
  styles,
}: {
  icon:
    | ToggleIcon
    | InfoIcon
    | 'contrast-outline';

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
}) {
  return (
    <View
      style={
        styles.iconBox
      }
    >
      <Ionicons
        name={icon}
        size={20}
        color={
          colors.primary
        }
      />
    </View>
  );
}

function ToggleRow({
  icon,
  title,
  description,
  value,
  onValueChange,
  colors,
  styles,
}: {
  icon:
    ToggleIcon;

  title: string;

  description: string;

  value: boolean;

  onValueChange: (
    value: boolean
  ) => void;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
}) {
  return (
    <View
      style={
        styles.toggleRow
      }
    >
      <IconBox
        icon={icon}
        colors={
          colors
        }
        styles={
          styles
        }
      />

      <View
        style={
          styles.toggleText
        }
      >
        <Text
          style={
            styles.title
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.description
          }
        >
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={
          onValueChange
        }
        trackColor={{
          false:
            colors.border,

          true:
            colors.primary,
        }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

function InfoRow({
  icon,
  title,
  value,
  colors,
  styles,
}: {
  icon: InfoIcon;

  title: string;

  value: string;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <IconBox
        icon={icon}
        colors={
          colors
        }
        styles={
          styles
        }
      />

      <Text
        style={
          styles.title
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

function Divider({
  styles,
}: {
  styles:
    SharedStyles;
}) {
  return (
    <View
      style={
        styles.divider
      }
    />
  );
}

function createStyles(
  colors:
    AppThemeColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        20,

      paddingTop: 18,

      paddingBottom: 130,
    },

    sectionLabel: {
      marginLeft: 4,

      marginBottom: 8,

      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    nextSection: {
      marginTop: 25,
    },

    card: {
      paddingHorizontal:
        14,

      overflow:
        'hidden',

      borderRadius: 20,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    mainRow: {
      minHeight: 70,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    iconBox: {
      width: 38,
      height: 38,

      marginRight: 11,

      borderRadius: 12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    title: {
      fontSize: 14,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    description: {
      marginTop: 3,

      fontSize: 11.5,

      color:
        colors.textMuted,
    },

    segmented: {
      height: 43,

      marginBottom: 14,

      padding: 4,

      flexDirection:
        'row',

      borderRadius: 13,

      backgroundColor:
        colors.surfaceSecondary,
    },

    segment: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 10,
    },

    segmentActive: {
      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    segmentText: {
      fontSize: 12.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    segmentTextActive: {
      color:
        colors.primary,

      fontWeight:
        '700',
    },

    toggleRow: {
      minHeight: 68,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    toggleText: {
      flex: 1,

      marginRight: 8,
    },

    divider: {
      height: 1,

      marginLeft: 49,

      backgroundColor:
        colors.border,
    },

    infoRow: {
      minHeight: 65,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    infoValue: {
      marginLeft: 'auto',

      fontSize: 12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    pressed: {
      opacity: 0.72,
    },

    footer: {
      marginTop: 32,

      textAlign:
        'center',

      fontSize: 11,

      color:
        colors.textMuted,
    },
  });
}
