import React, {
  ComponentProps,
  useMemo,
} from 'react';

import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type IconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type Styles =
  ReturnType<
    typeof createStyles
  >;

export default function AdminDashboard() {
  const {
    colors,
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
      contentInsetAdjustmentBehavior="never"
    >
      <View
        style={
          styles.heading
        }
      >
        <Text
          style={
            styles.title
          }
        >
          School Overview
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Manage your school from one place.
        </Text>
      </View>

      <View
        style={
          styles.grid
        }
      >
        <OverviewCard
          icon="people"
          value="--"
          label="Teachers"
          colors={
            colors
          }
          styles={
            styles
          }
        />

        <OverviewCard
          icon="school"
          value="--"
          label="Classes"
          colors={
            colors
          }
          styles={
            styles
          }
        />

        <OverviewCard
          icon="people-circle"
          value="--"
          label="Students"
          colors={
            colors
          }
          styles={
            styles
          }
        />

        <OverviewCard
          icon="checkmark-circle"
          value="--"
          label="Attendance"
          colors={
            colors
          }
          styles={
            styles
          }
        />
      </View>
    </ScrollView>
  );
}

function OverviewCard({
  icon,
  value,
  label,
  colors,
  styles,
}: {
  icon: IconName;

  value: string;

  label: string;

  colors:
    AppThemeColors;

  styles: Styles;
}) {
  return (
    <View
      style={
        styles.card
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

      <Text
        style={
          styles.value
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.label
        }
      >
        {label}
      </Text>
    </View>
  );
}

function createStyles(
  colors:
    AppThemeColors
) {
  return StyleSheet.create({
    screen: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      flexGrow: 1,

      paddingHorizontal:
        22,

      paddingTop: 17,

      paddingBottom: 120,

      backgroundColor:
        colors.background,
    },

    heading: {
      marginBottom: 18,
    },

    title: {
      fontSize: 20,

      lineHeight: 25,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 4,

      fontSize: 12,

      lineHeight: 18,

      color:
        colors.textMuted,
    },

    grid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      justifyContent:
        'space-between',

      rowGap: 12,
    },

    card: {
      width: '48%',

      minHeight: 108,

      padding: 13,

      borderRadius: 17,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,

      shadowColor:
        colors.shadow,

      shadowOffset: {
        width: 0,
        height: 2,
      },

      shadowOpacity:
        0.06,

      shadowRadius: 5,

      elevation: 2,
    },

    iconBox: {
      width: 35,
      height: 35,

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    value: {
      marginTop: 14,

      fontSize: 17,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    label: {
      marginTop: 4,

      fontSize: 11,

      color:
        colors.textMuted,
    },
  });
}