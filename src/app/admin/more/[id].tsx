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

import SchoolCalendarScreen from '../../../features/admin/screens/SchoolCalendarScreen';

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

  /*
   * =====================================================
   * SCHOOL CALENDAR
   * =====================================================
   */

  if (
    id === 'calendar'
  ) {
    return (
      <SchoolCalendarScreen />
    );
  }

  /*
   * =====================================================
   * UNKNOWN MORE PAGE
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
          styles.iconBox,
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

      <Text
        style={[
          styles.description,
          {
            color:
              colors.textMuted,
          },
        ]}
      >
        This section is not available yet.
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

      paddingHorizontal: 24,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    iconBox: {
      width: 60,

      height: 60,

      borderRadius: 18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    title: {
      marginTop: 14,

      fontSize: 19,

      fontWeight:
        '800',
    },

    description: {
      marginTop: 5,

      fontSize: 13,

      textAlign:
        'center',
    },

    button: {
      height: 46,

      marginTop: 18,

      paddingHorizontal: 17,

      flexDirection:
        'row',

      gap: 7,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 14,
    },

    buttonText: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '800',
    },
  });