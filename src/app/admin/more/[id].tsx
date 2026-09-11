import React from 'react';
import TimetableBuilderScreen from '../../../features/admin/screens/TimetableBuilderScreen';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import SchoolCalendarScreen from '../../../features/admin/screens/SchoolCalendarScreen';

import NotificationComposerScreen from '../../../features/shared/screens/NotificationComposerScreen';

import {
  useAppSettings,
} from '../../../context/AppSettingsContext';

export default function AdminMoreDetail() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useAppSettings();

  const params =
    useLocalSearchParams<{
      id?:
        | string
        | string[];
    }>();

  const id =
    Array.isArray(
      params.id,
    )
      ? params.id[0]
      : params.id;

  /* =====================================================
   * SCHOOL CALENDAR
   * =================================================== */

  if (
    id ===
    'calendar'
  ) {
    return (
      <SchoolCalendarScreen />
    );
  }

  /* =====================================================
   * PRESIDENT ANNOUNCEMENTS
   * =================================================== */

  if (
    id ===
    'announcements'
  ) {
    return (
      <NotificationComposerScreen
        role="admin"
      />
    );
  }
/* =====================================================
 * SMART TIMETABLE
 * =================================================== */

if (
  id ===
  'timetable'
) {
  return (
    <TimetableBuilderScreen />
  );
}
  /* =====================================================
   * UNKNOWN PAGE
   * =================================================== */

  return (
    <View
      style={[
        styles.screen,

        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <View
        style={[
          styles.iconBox,

          {
            backgroundColor:
              colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name="apps-outline"
          size={30}
          color={
            colors.primary
          }
        />
      </View>

      <Text
        style={[
          styles.title,

          {
            color:
              colors.text,
          },
        ]}
      >
        Page not found
      </Text>

      <Text
        style={[
          styles.description,

          {
            color:
              colors.textMuted,
          },
        ]}
      >
        This section is not available.
      </Text>

      <Pressable
        onPress={() =>
          router.back()
        }
        style={({ pressed }) => [
          styles.button,

          {
            backgroundColor:
              colors.primary,
          },

          pressed &&
            styles.buttonPressed,
        ]}
      >
        <Ionicons
          name="arrow-back"
          size={19}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.buttonText
          }
        >
          Go Back
        </Text>
      </Pressable>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,

      paddingHorizontal:
        24,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    iconBox: {
      width:
        64,

      height:
        64,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    title: {
      marginTop:
        16,

      fontSize:
        21,

      lineHeight:
        27,

      fontWeight:
        '900',
    },

    description: {
      marginTop:
        6,

      fontSize:
        14,

      lineHeight:
        20,

      fontWeight:
        '600',

      textAlign:
        'center',
    },

    button: {
      height:
        48,

      marginTop:
        20,

      paddingHorizontal:
        18,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,

      borderRadius:
        15,
    },

    buttonPressed: {
      opacity:
        0.7,
    },

    buttonText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '900',
    },
  });