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

/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function StudentSettingsScreen() {
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
          colors,
        ),
      [
        colors,
      ],
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
        {/* ================================================= */}
        {/* APPEARANCE */}
        {/* ================================================= */}

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
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.rowText
              }
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
              icon="phone-portrait-outline"
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
              colors={
                colors
              }
            />

            <ThemeOption
              title="Light"
              icon="sunny-outline"
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
              colors={
                colors
              }
            />

            <ThemeOption
              title="Dark"
              icon="moon-outline"
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
              colors={
                colors
              }
            />
          </View>
        </View>

        {/* ================================================= */}
        {/* PREFERENCES */}
        {/* ================================================= */}

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
            description="Results, attendance and school updates"
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
            description="Small vibration when you interact"
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
            description="Use simpler and calmer animations"
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

        {/* ================================================= */}
        {/* ABOUT */}
        {/* ================================================= */}

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
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.rowText
              }
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
                Student school portal
              </Text>
            </View>

            <View
              style={
                styles.versionBadge
              }
            >
              <Text
                style={
                  styles.version
                }
              >
                v{version}
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================= */}
        {/* SIMPLE FOOTER */}
        {/* ================================================= */}

        <View
          style={
            styles.footer
          }
        >
          <View
            style={
              styles.footerLogo
            }
          >
            <Ionicons
              name="school-outline"
              size={18}
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={
              styles.footerName
            }
          >
            EduPortal
          </Text>

          <Text
            style={
              styles.footerText
            }
          >
            Student Portal
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * SHARED TYPES
 * =========================================================
 */

type SharedStyles =
  ReturnType<
    typeof createStyles
  >;

type ThemeIcon =
  | 'phone-portrait-outline'
  | 'sunny-outline'
  | 'moon-outline';

type SettingIcon =
  | 'notifications-outline'
  | 'phone-portrait-outline'
  | 'sparkles-outline';

/*
 * =========================================================
 * THEME OPTION
 * =========================================================
 */

function ThemeOption({
  title,
  icon,
  value,
  current,
  onPress,
  styles,
  colors,
}: {
  title:
    string;

  icon:
    ThemeIcon;

  value:
    AppearanceMode;

  current:
    AppearanceMode;

  onPress:
    (
      mode:
        AppearanceMode,
    ) => void;

  styles:
    SharedStyles;

  colors:
    AppThemeColors;
}) {
  const active =
    current ===
    value;

  return (
    <Pressable
      onPress={() =>
        onPress(
          value,
        )
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
      <Ionicons
        name={
          icon
        }
        size={16}
        color={
          active
            ? colors.primary
            : colors.textMuted
        }
      />

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

/*
 * =========================================================
 * SETTING TOGGLE
 * =========================================================
 */

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
    SettingIcon;

  title:
    string;

  description:
    string;

  value:
    boolean;

  onChange:
    (
      value:
        boolean,
    ) => void;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
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
          name={
            icon
          }
          size={22}
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
        value={
          value
        }
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

/*
 * =========================================================
 * DIVIDER
 * =========================================================
 */

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

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 18,

      paddingTop: 20,

      paddingBottom: 125,
    },

    /*
     * SECTION LABEL
     */

    sectionLabel: {
      marginLeft: 4,

      marginBottom: 9,

      fontSize: 13,

      fontWeight:
        '800',

      color:
        colors.textMuted,
    },

    nextSection: {
      marginTop: 26,
    },

    /*
     * CARD
     */

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

    /*
     * APPEARANCE
     */

    appearanceHeader: {
      minHeight: 74,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    iconBox: {
      width: 42,

      height: 42,

      marginRight: 12,

      borderRadius: 13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    rowText: {
      flex: 1,

      minWidth: 0,
    },

    rowTitle: {
      fontSize: 14,

      lineHeight: 19,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    rowDescription: {
      marginTop: 3,

      fontSize: 11.5,

      lineHeight: 16,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    /*
     * SEGMENTED THEME CONTROL
     */

    segmentedControl: {
      height: 48,

      marginBottom: 15,

      padding: 4,

      flexDirection:
        'row',

      gap: 4,

      borderRadius: 14,

      backgroundColor:
        colors.surfaceSecondary,
    },

    segment: {
      flex: 1,

      flexDirection:
        'row',

      gap: 5,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 11,
    },

    segmentActive: {
      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity: 0.05,

      shadowRadius: 4,

      elevation: 1,
    },

    segmentPressed: {
      opacity: 0.75,
    },

    segmentText: {
      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    segmentTextActive: {
      color:
        colors.primary,

      fontWeight:
        '800',
    },

    /*
     * SETTINGS
     */

    settingRow: {
      minHeight: 76,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    settingText: {
      flex: 1,

      minWidth: 0,

      marginRight: 10,
    },

    divider: {
      height: 1,

      marginLeft: 54,

      backgroundColor:
        colors.border,
    },

    /*
     * ABOUT
     */

    infoRow: {
      minHeight: 76,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    versionBadge: {
      minHeight: 30,

      paddingHorizontal: 10,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 10,

      backgroundColor:
        colors.surfaceSecondary,
    },

    version: {
      fontSize: 11,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    /*
     * FOOTER
     */

    footer: {
      marginTop: 35,

      alignItems:
        'center',
    },

    footerLogo: {
      width: 38,

      height: 38,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 12,

      backgroundColor:
        colors.primarySoft,
    },

    footerName: {
      marginTop: 8,

      fontSize: 13,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    footerText: {
      marginTop: 2,

      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },
  });
}