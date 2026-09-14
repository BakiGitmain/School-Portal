import React, {
  ComponentProps,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../context/AppSettingsContext';

import type {
  UserRole,
} from '../../constants/roleNavigation';

type IoniconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type TabRoute = {
  key: string;
  name: string;
};

type Props = {
  role: UserRole;

  state: {
    index: number;
    routes: TabRoute[];
  };

  navigation: any;

  descriptors?: any;
};

const BAR_HEIGHT = 56;

const BAR_RADIUS = 18;

const ACTIVE_SIZE = 52;

const NOTCH_SIZE = 66;

const ACTIVE_TOP = -15;

const NOTCH_TOP = -21;

const SIDE_PADDING = 14;

const TOP_SPACE = 24;

/*
 * =========================================
 * REAL BOTTOM TABS
 * =========================================
 *
 * Only routes here are allowed to appear
 * in the bottom navigation.
 */

const ROLE_TAB_ORDER: Record<
  UserRole,
  string[]
> = {
  admin: [
    'index',
    'teachers',
    'classes',
    'reports',
    'more',
  ],

  teacher: [
    'index',
    'students',
    'attendance',
    'results',
    'more',
  ],

  student: [
    'index',
    'attendance',
    'results',
    'more',
  ],
};

const ICONS: Record<
  string,
  {
    active: IoniconName;
    inactive: IoniconName;
  }
> = {
  index: {
    active: 'home',
    inactive: 'home-outline',
  },

  teachers: {
    active: 'people',
    inactive: 'people-outline',
  },

  students: {
    active: 'people',
    inactive: 'people-outline',
  },

  classes: {
    active: 'school',
    inactive: 'school-outline',
  },

  reports: {
    active: 'bar-chart',
    inactive: 'bar-chart-outline',
  },

  attendance: {
    active: 'calendar',
    inactive: 'calendar-outline',
  },

  results: {
    active: 'ribbon',
    inactive: 'ribbon-outline',
  },

  announcements: {
    active: 'megaphone',
    inactive: 'megaphone-outline',
  },

  more: {
    active: 'grid',
    inactive: 'grid-outline',
  },
};

const LABELS: Record<
  string,
  string
> = {
  index: 'Home',

  teachers: 'Teachers',

  students: 'Students',

  classes: 'Classes',

  reports: 'Reports',

  attendance: 'Attendance',

  results: 'Results',

  announcements: 'Announcements',

  more: 'More',
};

/*
 * =========================================
 * RESOLVE DETAIL ROUTES
 * =========================================
 *
 * This keeps the correct main navbar tab
 * selected while opening detail pages.
 *
 * President:
 *
 * /admin/class/[id]
 * -> Classes
 *
 * /admin/student/[id]
 * -> Classes
 *
 * /admin/teacher/[id]
 * -> Teachers
 *
 * Teacher:
 *
 * /teacher/student/[id]
 * -> Students
 */

function resolveActiveRouteName(
  routeName:
    | string
    | undefined,

  role: UserRole,
) {
  if (!routeName) {
    return 'index';
  }

  const normalTabs =
    ROLE_TAB_ORDER[
      role
    ];

  /*
   * Already a normal tab.
   */

  if (
    normalTabs.includes(
      routeName,
    )
  ) {
    return routeName;
  }

  /*
   * =====================================
   * PRESIDENT / ADMIN
   * =====================================
   */

  if (
    role === 'admin' &&
    (
      routeName ===
        'class' ||
      routeName.startsWith(
        'class/',
      )
    )
  ) {
    return 'classes';
  }

  if (
    role === 'admin' &&
    (
      routeName ===
        'student' ||
      routeName.startsWith(
        'student/',
      )
    )
  ) {
    return 'classes';
  }

  if (
    role === 'admin' &&
    (
      routeName ===
        'teacher' ||
      routeName.startsWith(
        'teacher/',
      )
    )
  ) {
    return 'teachers';
  }

  /*
   * =====================================
   * TEACHER
   * =====================================
   */

  if (
    role ===
      'teacher' &&
    (
      routeName ===
        'student' ||
      routeName.startsWith(
        'student/',
      )
    )
  ) {
    return 'students';
  }

  /*
   * Unknown hidden page.
   */

  return 'index';
}

export function AnimatedTabBar({
  state,
  navigation,
  role,
}: Props) {
  const insets =
    useSafeAreaInsets();

  const {
    colors,
    reduceMotion,
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

  const [
    barWidth,
    setBarWidth,
  ] =
    useState(
      0,
    );

  /*
   * =========================================
   * VISIBLE ROUTES
   * =========================================
   *
   * Only use routes listed inside
   * ROLE_TAB_ORDER.
   *
   * Dynamic pages never become extra tabs.
   */

  const visibleRoutes =
    useMemo(
      () => {
        const preferred =
          ROLE_TAB_ORDER[
            role
          ] ?? [];

        const ordered =
          preferred
            .map(
              (
                routeName,
              ) =>
                state.routes.find(
                  (
                    route:
                      TabRoute,
                  ) =>
                    route.name ===
                    routeName,
                ),
            )
            .filter(
              (
                route,
              ): route is TabRoute =>
                Boolean(
                  route,
                ),
            );

        return ordered;
      },
      [
        role,
        state.routes,
      ],
    );

  /*
   * =========================================
   * CURRENT EXPO ROUTE
   * =========================================
   */

  const currentRoute =
    state.routes[
      state.index
    ];

  /*
   * Convert dynamic route to its parent tab.
   */

  const activeRouteName =
    resolveActiveRouteName(
      currentRoute
        ?.name,
      role,
    );

  let activeIndex =
    visibleRoutes.findIndex(
      (
        route,
      ) =>
        route.name ===
        activeRouteName,
    );

  if (
    activeIndex <
    0
  ) {
    activeIndex =
      0;
  }

  const activeRoute =
    visibleRoutes[
      activeIndex
    ];

  /*
   * =========================================
   * ANIMATION
   * =========================================
   */

  const animatedIndex =
    useRef(
      new Animated.Value(
        activeIndex,
      ),
    ).current;

  const bounce =
    useRef(
      new Animated.Value(
        1,
      ),
    ).current;

  useEffect(
    () => {
      /*
       * Accessibility:
       * disable movement when Reduce Motion
       * is enabled.
       */

      if (
        reduceMotion
      ) {
        animatedIndex.setValue(
          activeIndex,
        );

        bounce.setValue(
          1,
        );

        return;
      }

      /*
       * Smooth sideways movement.
       */

      Animated.spring(
        animatedIndex,
        {
          toValue:
            activeIndex,

          stiffness:
            180,

          damping:
            18,

          mass:
            0.75,

          useNativeDriver:
            true,
        },
      ).start();

      /*
       * Small pop animation.
       */

      bounce.setValue(
        0.92,
      );

      Animated.spring(
        bounce,
        {
          toValue:
            1,

          stiffness:
            260,

          damping:
            15,

          mass:
            0.55,

          useNativeDriver:
            true,
        },
      ).start();
    },
    [
      activeIndex,
      animatedIndex,
      bounce,
      reduceMotion,
    ],
  );

  /*
   * =========================================
   * BAR SIZE
   * =========================================
   */

  const usableWidth =
    Math.max(
      0,

      barWidth -
        SIDE_PADDING *
          2,
    );

  const tabWidth =
    visibleRoutes.length >
    0
      ? usableWidth /
        visibleRoutes.length
      : 0;

  /*
   * Move active floating circle.
   */

  const translateX =
    Animated.multiply(
      animatedIndex,
      tabWidth,
    );

  function handleBarLayout(
    event:
      LayoutChangeEvent,
  ) {
    const width =
      event
        .nativeEvent
        .layout
        .width;

    if (
      width !==
      barWidth
    ) {
      setBarWidth(
        width,
      );
    }
  }

  /*
   * =========================================
   * TAB PRESS
   * =========================================
   */

  function pressTab(
    route:
      TabRoute,

    focused:
      boolean,
  ) {
    const event =
      navigation.emit({
        type:
          'tabPress',

        target:
          route.key,

        canPreventDefault:
          true,
      });

    if (
      !focused &&
      !event.defaultPrevented
    ) {
      navigation.navigate(
        route.name,
      );
    }
  }

  function longPressTab(
    route:
      TabRoute,
  ) {
    navigation.emit({
      type:
        'tabLongPress',

      target:
        route.key,
    });
  }

  /*
   * Nothing available.
   */

  if (
    visibleRoutes.length ===
    0
  ) {
    return null;
  }

  /*
   * Icon for floating bubble.
   */

  const activeIcons =
    ICONS[
      activeRoute
        ?.name
    ] ?? {
      active:
        'ellipse',

      inactive:
        'ellipse-outline',
    };

  /*
   * =========================================
   * UI
   * =========================================
   */

  return (
    <View
      style={[
        styles.root,

        {
          paddingBottom:
            Math.max(
              insets.bottom,
              8,
            ),
        },
      ]}
    >
      <View
        style={
          styles.navArea
        }
      >
        <View
          onLayout={
            handleBarLayout
          }
          style={
            styles.bar
          }
        >
          {/* ================================= */}
          {/* MOVING FLOATING ICON */}
          {/* ================================= */}

          {barWidth >
            0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.movingSlot,

                {
                  left:
                    SIDE_PADDING,

                  width:
                    tabWidth,

                  transform: [
                    {
                      translateX,
                    },
                  ],
                },
              ]}
            >
              {/* NOTCH */}

              <View
                style={[
                  styles.notch,

                  {
                    left:
                      (
                        tabWidth -
                        NOTCH_SIZE
                      ) /
                      2,
                  },
                ]}
              />

              {/* ACTIVE CIRCLE */}

              <Animated.View
                style={[
                  styles.activeBubble,

                  {
                    left:
                      (
                        tabWidth -
                        ACTIVE_SIZE
                      ) /
                      2,

                    transform: [
                      {
                        scale:
                          bounce,
                      },
                    ],
                  },
                ]}
              >
                <Ionicons
                  name={
                    activeIcons.active
                  }
                  size={
                    23
                  }
                  color={
                    colors.primary
                  }
                />
              </Animated.View>
            </Animated.View>
          )}

          {/* ================================= */}
          {/* TAB BUTTONS */}
          {/* ================================= */}

          <View
            style={
              styles.tabRow
            }
          >
            {visibleRoutes.map(
              (
                route:
                  TabRoute,
              ) => {
                /*
                 * IMPORTANT:
                 *
                 * We compare against
                 * activeRouteName.
                 *
                 * That means:
                 *
                 * admin/student
                 * still visually focuses
                 * the Classes tab.
                 */

                const focused =
                  route.name ===
                  activeRouteName;

                const icons =
                  ICONS[
                    route.name
                  ] ?? {
                    active:
                      'ellipse',

                    inactive:
                      'ellipse-outline',
                  };

                const label =
                  LABELS[
                    route.name
                  ] ??
                  route.name;

                return (
                  <Pressable
                    key={
                      route.key
                    }
                    accessibilityRole="button"
                    accessibilityLabel={
                      label
                    }
                    accessibilityState={{
                      selected:
                        focused,
                    }}
                    onPress={() =>
                      pressTab(
                        route,
                        focused,
                      )
                    }
                    onLongPress={() =>
                      longPressTab(
                        route,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.tab,

                      pressed &&
                        styles.tabPressed,
                    ]}
                  >
                    {/*
                     * Hide the normal icon when
                     * this tab is active because
                     * its icon is displayed inside
                     * the floating circle.
                     */}

                    <Ionicons
                      name={
                        icons.inactive
                      }
                      size={
                        21
                      }
                      color={
                        colors.textMuted
                      }
                      style={{
                        opacity:
                          focused
                            ? 0
                            : 1,
                      }}
                    />
                  </Pressable>
                );
              },
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    /*
     * =========================================
     * BOTTOM NAV ROOT
     * =========================================
     */

    root: {
      paddingHorizontal:
        12,

      backgroundColor:
        colors.background,
    },

    /*
     * Space for floating circle.
     */

    navArea: {
      paddingTop:
        TOP_SPACE,
    },

    /*
     * Main rounded navbar.
     */

    bar: {
      height:
        BAR_HEIGHT,

      position:
        'relative',

      borderRadius:
        BAR_RADIUS,

      backgroundColor:
        colors.card,

      borderWidth:
        1,

      borderColor:
        colors.border,

      overflow:
        'visible',

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          5,
      },

      shadowOpacity:
        0.09,

      shadowRadius:
        12,

      elevation:
        7,
    },

    /*
     * Icon row.
     */

    tabRow: {
      flex:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        SIDE_PADDING,

      zIndex:
        3,
    },

    /*
     * Every tab uses equal width.
     */

    tab: {
      flex:
        1,

      height:
        BAR_HEIGHT,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    tabPressed: {
      opacity:
        0.55,
    },

    /*
     * Moving invisible slot.
     *
     * This carries both:
     * - notch
     * - active bubble
     */

    movingSlot: {
      position:
        'absolute',

      top:
        0,

      height:
        BAR_HEIGHT,

      zIndex:
        5,

      overflow:
        'visible',
    },

    /*
     * Creates curved cradle behind
     * floating circle.
     */

    notch: {
      position:
        'absolute',

      top:
        NOTCH_TOP,

      width:
        NOTCH_SIZE,

      height:
        NOTCH_SIZE,

      borderRadius:
        NOTCH_SIZE /
        2,

      backgroundColor:
        colors.background,
    },

    /*
     * Floating active circle.
     */

    activeBubble: {
      position:
        'absolute',

      top:
        ACTIVE_TOP,

      width:
        ACTIVE_SIZE,

      height:
        ACTIVE_SIZE,

      borderRadius:
        ACTIVE_SIZE /
        2,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.card,

      borderWidth:
        1,

      borderColor:
        colors.border,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          5,
      },

      shadowOpacity:
        0.16,

      shadowRadius:
        8,

      elevation:
        10,

      zIndex:
        10,
    },
  });
}