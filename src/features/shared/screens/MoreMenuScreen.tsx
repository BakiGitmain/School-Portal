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
  type Href,
  useRouter,
} from 'expo-router';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type MoreRole =
  | 'teacher'
  | 'student';

type Props = {
  role:
    MoreRole;
};

type MenuIcon =
  | 'calendar-outline'
  | 'happy-outline'
  | 'analytics-outline'
  | 'megaphone-outline';

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

      <View
        style={
          styles.card
        }
      >
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

        <View
          style={
            styles.divider
          }
        />

        {role ===
        'teacher' ? (
          <>
            <MenuItem
              icon="happy-outline"
              title="Student Behavior"
              description="Record and review homeroom student behavior"
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

            <View
              style={
                styles.divider
              }
            />

            <MenuItem
              icon="megaphone-outline"
              title="Send Notice"
              description="Message your homeroom class or one student"
              onPress={() =>
                openPage(
                  'notice',
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
        ) : (
          <MenuItem
            icon="analytics-outline"
            title="My Behavior"
            description="View your behavior history and progress"
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
        )}
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  title,
  description,
  onPress,
  colors,
  styles,
}: {
  icon:
    MenuIcon;

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
          size={25}
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
        size={21}
        color={
          colors.textMuted
        }
      />
    </Pressable>
  );
}

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    screen: {
      flex:
        1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        16,

      paddingTop:
        20,

      paddingBottom:
        130,
    },

    title: {
      color:
        colors.text,

      fontSize:
        25,

      lineHeight:
        31,

      fontWeight:
        '900',
    },

    subtitle: {
      marginTop:
        5,

      marginBottom:
        18,

      color:
        colors.textSecondary,

      fontSize:
        14,

      lineHeight:
        20,

      fontWeight:
        '600',
    },

    card: {
      overflow:
        'hidden',

      borderRadius:
        21,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    item: {
      minHeight:
        94,

      paddingHorizontal:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    itemPressed: {
      opacity:
        0.72,

      backgroundColor:
        colors.surfaceSecondary,
    },

    iconBox: {
      width:
        52,

      height:
        52,

      borderRadius:
        17,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    itemContent: {
      flex:
        1,

      minWidth:
        0,

      marginLeft:
        13,

      marginRight:
        8,
    },

    itemTitle: {
      color:
        colors.text,

      fontSize:
        17,

      lineHeight:
        22,

      fontWeight:
        '900',
    },

    itemDescription: {
      marginTop:
        4,

      color:
        colors.textMuted,

      fontSize:
        13,

      lineHeight:
        18,

      fontWeight:
        '600',
    },

    divider: {
      height:
        1,

      marginLeft:
        80,

      backgroundColor:
        colors.border,
    },
  });
}