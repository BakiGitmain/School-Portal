import React from 'react';

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

import SchoolCalendarViewerScreen from '../../../features/shared/screens/SchoolCalendarViewerScreen';

import StudentBehaviorScreen from '../../../features/student/screens/StudentBehaviorScreen';

import {
  useAppSettings,
} from '../../../context/AppSettingsContext';

export default function StudentMoreDetail() {
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

  /*
   * =====================================================
   * CALENDAR
   * =====================================================
   */

  if (
    id ===
    'calendar'
  ) {
    return (
      <SchoolCalendarViewerScreen />
    );
  }

  /*
   * =====================================================
   * BEHAVIOR
   * =====================================================
   */

  if (
    id ===
    'behavior'
  ) {
    return (
      <StudentBehaviorScreen />
    );
  }

  /*
   * =====================================================
   * NOT FOUND
   * =====================================================
   */

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
          styles.icon,

          {
            backgroundColor:
              colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name="apps-outline"
          size={28}
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

      <Pressable
        onPress={() =>
          router.back()
        }
        style={[
          styles.button,

          {
            backgroundColor:
              colors.primary,
          },
        ]}
      >
        <Ionicons
          name="arrow-back"
          size={18}
          color="#FFFFFF"
        />

        <Text
          style={
            styles.buttonText
          }
        >
          Back
        </Text>
      </Pressable>
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,

      paddingHorizontal: 24,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    icon: {
      width: 58,

      height: 58,

      borderRadius: 18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    title: {
      marginTop: 12,

      fontSize: 18,

      fontWeight:
        '800',
    },

    button: {
      height: 44,

      marginTop: 16,

      paddingHorizontal: 16,

      borderRadius: 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 6,
    },

    buttonText: {
      color:
        '#FFFFFF',

      fontSize: 12,

      fontWeight:
        '800',
    },
  });