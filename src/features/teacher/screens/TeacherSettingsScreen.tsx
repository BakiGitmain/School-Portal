import React, {
  useMemo,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  Ionicons,
} from '@expo/vector-icons';

import Constants from 'expo-constants';

import {
  useAppSettings,
  type AppearanceMode,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

export default function TeacherSettingsScreen() {
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
  } =
    useAppSettings();

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
              styles.appearanceHeader
            }
          >
            <View
              style={
                styles.iconBox
              }
            >
              <Ionicons
                name="contrast-outline"
                size={20}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                Theme
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                Choose how EduPortal looks.
              </Text>
            </View>
          </View>

          <View
            style={
              styles.segmentedControl
            }
          >
            <ThemeOption
              title="System"
              value="system"
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

            <ThemeOption
              title="Light"
              value="light"
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

            <ThemeOption
              title="Dark"
              value="dark"
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
          <SettingToggle
            icon="notifications-outline"
            title="Notifications"
            description="School updates and reminders"
            value={
              notificationsEnabled
            }
            onChange={
              setNotificationsEnabled
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

          <SettingToggle
            icon="phone-portrait-outline"
            title="Haptic feedback"
            description="Small vibration for actions"
            value={
              hapticsEnabled
            }
            onChange={
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

          <SettingToggle
            icon="sparkles-outline"
            title="Reduce motion"
            description="Use simpler animations"
            value={
              reduceMotion
            }
            onChange={
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

        {/* ABOUT */}

        <Text
          style={[
            styles.sectionLabel,
            styles.nextSection,
          ]}
        >
          About
        </Text>

        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.infoRow
            }
          >
            <View
              style={
                styles.iconBox
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.rowTitle
                }
              >
                EduPortal
              </Text>

              <Text
                style={
                  styles.rowDescription
                }
              >
                School management portal
              </Text>
            </View>

            <Text
              style={
                styles.version
              }
            >
              v{version}
            </Text>
          </View>
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

function ThemeOption({
  title,
  value,
  current,
  onPress,
  styles,
}: {
  title: string;

  value: AppearanceMode;

  current: AppearanceMode;

  onPress: (
    mode: AppearanceMode
  ) => void;

  styles: SharedStyles;
}) {
  const active =
    current === value;

  return (
    <Pressable
      onPress={() =>
        onPress(value)
      }
      style={({
        pressed,
      }) => [
        styles.segment,

        active &&
          styles.segmentActive,

        pressed &&
          styles.segmentPressed,
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

function SettingToggle({
  icon,
  title,
  description,
  value,
  onChange,
  colors,
  styles,
}: {
  icon:
    | 'notifications-outline'
    | 'phone-portrait-outline'
    | 'sparkles-outline';

  title: string;

  description: string;

  value: boolean;

  onChange: (
    value: boolean
  ) => void;

  colors: AppThemeColors;

  styles: SharedStyles;
}) {
  return (
    <View
      style={
        styles.settingRow
      }
    >
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

      <View
        style={
          styles.settingText
        }
      >
        <Text
          style={
            styles.rowTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.rowDescription
          }
        >
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={
          onChange
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

function Divider({
  styles,
}: {
  styles: SharedStyles;
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
  colors: AppThemeColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 20,

      paddingTop: 18,

      paddingBottom: 120,
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
      overflow:
        'hidden',

      paddingHorizontal: 14,

      borderRadius: 20,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    appearanceHeader: {
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

    rowTitle: {
      fontSize: 14,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    rowDescription: {
      marginTop: 3,

      fontSize: 11.5,

      color:
        colors.textMuted,
    },

    segmentedControl: {
      height: 42,

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

    segmentPressed: {
      opacity: 0.75,
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

    settingRow: {
      minHeight: 68,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    settingText: {
      flex: 1,

      marginRight: 10,
    },

    divider: {
      height: 1,

      marginLeft: 49,

      backgroundColor:
        colors.border,
    },

    infoRow: {
      minHeight: 70,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    version: {
      fontSize: 12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
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