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

export default function AdminMoreScreen() {
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

  function openCalendar() {
    router.push(
      '/admin/more/calendar' as Href,
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
          styles.titleArea
        }
      >
        <Text
          style={
            styles.title
          }
        >
          School Management
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          Additional school tools.
        </Text>
      </View>

      <View
        style={
          styles.card
        }
      >
        <Pressable
          onPress={
            openCalendar
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
              name="calendar-outline"
              size={24}
              color={
                colors.primary
              }
            />
          </View>

          <View
            style={
              styles.itemText
            }
          >
            <Text
              style={
                styles.itemTitle
              }
            >
              School Calendar
            </Text>

            <Text
              style={
                styles.itemDescription
              }
            >
              Closures, holidays, meetings and special dates
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
      </View>
    </ScrollView>
  );
}

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

    titleArea: {
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
      minHeight: 82,

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

    itemText: {
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
  });
}