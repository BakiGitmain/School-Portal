import React, {
  ComponentProps,
  useMemo,
} from 'react';

import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../context/AppSettingsContext';

type IconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type Props = {
  title: string;

  subtitle?: string;

  description?: string;

  icon?: IconName;
};

export function PlaceholderScreen({
  title,
  subtitle,
  description,
  icon = 'construct-outline',
}: Props) {
  const {
    colors,
  } = useAppSettings();

  const styles =
    useMemo(
      () =>
        createStyles(
          colors
        ),
      [colors]
    );

  const message =
    subtitle ??
    description ??
    'This section will be available soon.';

  return (
    <View
      style={
        styles.screen
      }
    >
      <View
        style={
          styles.content
        }
      >
        <View
          style={
            styles.iconBox
          }
        >
          <Ionicons
            name={icon}
            size={25}
            color={
              colors.primary
            }
          />
        </View>

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
          {message}
        </Text>
      </View>
    </View>
  );
}

/*
 * This keeps BOTH import styles working:
 *
 * import PlaceholderScreen from ...
 *
 * AND
 *
 * import { PlaceholderScreen } from ...
 */

export default PlaceholderScreen;

function createStyles(
  colors: AppThemeColors
) {
  return StyleSheet.create({
    screen: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        34,

      paddingBottom:
        80,

      backgroundColor:
        colors.background,
    },

    iconBox: {
      width: 60,

      height: 60,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    title: {
      marginTop: 16,

      fontSize: 19,

      fontWeight:
        '800',

      color:
        colors.text,

      textAlign:
        'center',
    },

    description: {
      marginTop: 6,

      maxWidth: 260,

      fontSize: 12.5,

      lineHeight: 19,

      color:
        colors.textMuted,

      textAlign:
        'center',
    },
  });
}