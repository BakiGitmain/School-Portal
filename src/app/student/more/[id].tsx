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
    'calendar'
  ) {
    return (
      <SchoolCalendarScreen />
    );
  }

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