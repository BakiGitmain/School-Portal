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
        School Management
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        Important school tools and communication.
      </Text>

      <View
        style={
          styles.card
        }
      >
        <MenuItem
          icon="calendar-outline"
          title="School Calendar"
          description="Closures, holidays, meetings and special dates"
          onPress={() =>
            router.push(
              '/admin/more/calendar' as Href,
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
          title="Announcements"
          description="Send school, group, class or private notifications"
          onPress={() =>
            router.push(
              '/admin/more/announcements' as Href,
            )
          }
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

function MenuItem({
  icon,
  title,
  description,
  onPress,
  colors,
  styles,
}: {
  icon:
    | 'calendar-outline'
    | 'megaphone-outline';

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
          styles.itemText
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

    itemText: {
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