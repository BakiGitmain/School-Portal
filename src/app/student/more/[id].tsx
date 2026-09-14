import React from 'react';

import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useLocalSearchParams,
  useRouter,
} from 'expo-router';

import SchoolCalendarViewerScreen from '../../../features/shared/screens/SchoolCalendarViewerScreen';

import StudentBehaviorScreen from '../../../features/student/screens/StudentBehaviorScreen';

import PublishedScheduleScreen from '../../../features/timetable/PublishedScheduleScreen';

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
        string
        | string[];
    }>();

  const id =
    Array.isArray(
      params.id,
    )
      ? params.id[0]
      : params.id;

  if (
    id ===
    'schedule'
  ) {
    return (
      <PublishedScheduleScreen role="student" />
    );
  }

  if (
    id ===
    'calendar'
  ) {
    return (
      <SchoolCalendarViewerScreen />
    );
  }

  if (
    id ===
    'behavior'
  ) {
    return (
      <StudentBehaviorScreen />
    );
  }

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
      <Ionicons
        name="alert-circle-outline"
        size={36}
        color={
          colors.primary
        }
      />

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
      flex:
        1,

      padding:
        24,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    title: {
      marginTop:
        12,

      fontSize:
        20,

      fontWeight:
        '900',
    },

    button: {
      height:
        46,

      marginTop:
        18,

      paddingHorizontal:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        14,
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
