import React, {
  useMemo,
} from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useRouter,
  type Href,
} from 'expo-router';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type MoreRole =
  | 'teacher'
  | 'student';

type Props = {
  role: MoreRole;
};

export default function MoreMenuScreen({
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

  function openPage(
    id:
      string,
  ) {
    router.push(
      `/${role}/more/${id}` as Href,
    );
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
          School
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          School information and useful tools.
        </Text>
      </View>

      <View
        style={
          styles.card
        }
      >
        {/* ================================================= */}
        {/* CALENDAR */}
        {/* ================================================= */}

        <MenuItem
          icon="calendar-outline"
          title="School Calendar"
          description="Holidays, closures and special school dates"
          onPress={() =>
            openPage(
              'calendar',
            )
          }
          colors={
            colors
          }
          styles={
            styles
          }
        />

        {/* ================================================= */}
        {/* TEACHER ONLY */}
        {/* ================================================= */}

        {role ===
        'teacher' ? (
          <>
            <View
              style={
                styles.divider
              }
            />

            <MenuItem
              icon="happy-outline"
              title="Student Behavior"
              description="Homeroom student behavior records"
              onPress={() =>
                openPage(
                  'behavior',
                )
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />
          </>
        ) : null}
      </View>
    </ScrollView>
  );
}

/* =========================================================
 * MENU ITEM
 * ======================================================= */

function MenuItem({
  icon,
  title,
  description,
  onPress,
  colors,
  styles,
}: {
  icon:
    'calendar-outline' |
    'happy-outline';

  title:
    string;

  description:
    string;

  onPress:
    () => void;

  colors:
    AppThemeColors;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.item,

        pressed &&
          styles.itemPressed,
      ]}
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
          size={24}
          color={
            colors.primary
          }
        />
      </View>

      <View
        style={
          styles.itemContent
        }
      >
        <Text
          style={
            styles.itemTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.itemDescription
          }
        >
          {description}
        </Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={20}
        color={
          colors.textMuted
        }
      />
    </Pressable>
  );
}

/* =========================================================
 * STYLES
 * ======================================================= */

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    screen: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 16,

      paddingTop: 18,

      paddingBottom: 130,
    },

    heading: {
      marginBottom: 15,
    },

    title: {
      fontSize: 21,

      lineHeight: 27,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 3,

      fontSize: 12,

      lineHeight: 17,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    card: {
      overflow:
        'hidden',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    item: {
      minHeight: 84,

      paddingHorizontal: 14,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    itemPressed: {
      opacity: 0.72,

      backgroundColor:
        colors.surfaceSecondary,
    },

    iconBox: {
      width: 48,

      height: 48,

      borderRadius: 15,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    itemContent: {
      flex: 1,

      minWidth: 0,

      marginLeft: 12,

      marginRight: 8,
    },

    itemTitle: {
      fontSize: 15,

      lineHeight: 20,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    itemDescription: {
      marginTop: 3,

      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    divider: {
      height: 1,

      marginLeft: 74,

      backgroundColor:
        colors.border,
    },
  });
}