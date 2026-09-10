import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  type Href,
  usePathname,
  useRouter,
} from 'expo-router';

import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  supabase,
} from '../../lib/supabase';

import {
  getSavedAccounts,
  getSavedSession,
  removeSavedAccount,
  type SavedAccount,
} from '../../lib/accountStore';

import {
  useCurrentProfile,
} from '../../hooks/useCurrentProfile';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../context/AppSettingsContext';

import type {
  UserRole,
} from '../../constants/roleNavigation';

/* =========================================================
 * TYPES
 * ======================================================= */

type Props = {
  role: UserRole;
};

/* =========================================================
 * ROLE NAMES
 * ======================================================= */

const ROLE_NAMES: Record<
  UserRole,
  string
> = {
  admin: 'President',
  teacher: 'Teacher',
  student: 'Student',
};

/* =========================================================
 * HOME TITLES
 * ======================================================= */

const HOME_TITLES: Record<
  UserRole,
  string
> = {
  admin:
    'President Dashboard',

  teacher:
    'Teacher Dashboard',

  student:
    'Student Dashboard',
};

/* =========================================================
 * PAGE TITLES
 * ======================================================= */

const PAGE_TITLES: Record<
  string,
  string
> = {
  teachers:
    'Teachers',

  classes:
    'Classes',

  reports:
    'Reports',

  students:
    'Students',

  results:
    'Results',

  attendance:
    'Attendance',

  announcements:
    'Announcements',

  more:
    'More',

  calendar:
    'School Calendar',

  behavior:
    'Behavior',

  profile:
    'Profile',

  settings:
    'Settings',
};

/* =========================================================
 * PAGE TITLE
 * ======================================================= */

function getPageTitle(
  pathname: string,
  role: UserRole,
) {
  const parts =
    pathname
      .split('/')
      .filter(Boolean);

  const last =
    parts[
      parts.length - 1
    ];

  if (
    !last ||
    last === role
  ) {
    return HOME_TITLES[
      role
    ];
  }

  return (
    PAGE_TITLES[
      last
    ] ??
    HOME_TITLES[
      role
    ]
  );
}

/* =========================================================
 * ROLE ROUTE
 * ======================================================= */

function getRoleRoute(
  role: UserRole,
): Href {
  if (
    role ===
    'admin'
  ) {
    return (
      '/admin' as Href
    );
  }

  if (
    role ===
    'teacher'
  ) {
    return (
      '/teacher' as Href
    );
  }

  return (
    '/student' as Href
  );
}

/* =========================================================
 * HEADER
 * ======================================================= */

export default function AppHeader({
  role,
}: Props) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const insets =
    useSafeAreaInsets();

  const {
    height:
      windowHeight,
  } =
    useWindowDimensions();

  const {
    colors,
    resolvedTheme,
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

  const {
    profile,
    loading,
  } =
    useCurrentProfile();

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(false);

  const [
    accounts,
    setAccounts,
  ] =
    useState<
      SavedAccount[]
    >([]);

  const [
    switchingId,
    setSwitchingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    loggingOut,
    setLoggingOut,
  ] =
    useState(false);

  const [
    accountError,
    setAccountError,
  ] =
    useState('');

  /* =====================================================
   * PAGE TITLE
   * =================================================== */

  const pageTitle =
    useMemo(
      () =>
        getPageTitle(
          pathname,
          role,
        ),
      [
        pathname,
        role,
      ],
    );

  /* =====================================================
   * DISPLAY NAME
   * =================================================== */

  const displayName =
    profile?.full_name ??
    ROLE_NAMES[
      role
    ];

  const initial =
    displayName
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'U';

  /* =====================================================
   * MENU HEIGHT
   * =================================================== */

  const menuTop =
    insets.top +
    66;

  const availableHeight =
    Math.max(
      300,
      windowHeight -
        menuTop -
        18,
    );

  const menuMaxHeight =
    Math.min(
      560,
      availableHeight,
    );

  /* =====================================================
   * LOAD ACCOUNTS WHEN MENU OPENS
   * =================================================== */

  useEffect(
    () => {
      if (
        !menuOpen
      ) {
        return;
      }

      void loadAccounts();
    },
    [
      menuOpen,
      profile?.user_id,
    ],
  );

  async function loadAccounts() {
    const saved =
      await getSavedAccounts();

    setAccounts(
      saved,
    );
  }

  /* =====================================================
   * CLOSE MENU
   * =================================================== */

  function closeMenu() {
    setMenuOpen(
      false,
    );

    setAccountError(
      '',
    );
  }

  /* =====================================================
   * PROFILE
   * =================================================== */

  function goToProfile() {
    closeMenu();

    const route =
      `/${role}/profile` as Href;

    router.push(
      route,
    );
  }

  /* =====================================================
   * SETTINGS
   * =================================================== */

  function goToSettings() {
    closeMenu();

    const route =
      `/${role}/settings` as Href;

    router.push(
      route,
    );
  }

  /* =====================================================
   * ADD ACCOUNT
   * =================================================== */

  function addAccount() {
    closeMenu();

    router.push(
      '/add-account' as Href,
    );
  }

  /* =====================================================
   * SWITCH ACCOUNT
   * =================================================== */

  async function switchAccount(
    account:
      SavedAccount,
  ) {
    if (
      switchingId ||
      account.userId ===
        profile?.user_id
    ) {
      return;
    }

    try {
      setAccountError(
        '',
      );

      setSwitchingId(
        account.userId,
      );

      const session =
        await getSavedSession(
          account.userId,
        );

      if (
        !session
      ) {
        await removeSavedAccount(
          account.userId,
        );

        await loadAccounts();

        setAccountError(
          'Sign in again.',
        );

        return;
      }

      const {
        error:
          sessionError,
      } =
        await supabase.auth
          .setSession({
            access_token:
              session.accessToken,

            refresh_token:
              session.refreshToken,
          });

      if (
        sessionError
      ) {
        await removeSavedAccount(
          account.userId,
        );

        await loadAccounts();

        setAccountError(
          'Sign in again.',
        );

        return;
      }

      const {
        data:
          newProfile,

        error:
          profileError,
      } =
        await supabase
          .from(
            'profiles',
          )
          .select(`
            role,
            must_change_password
          `)
          .eq(
            'user_id',
            account.userId,
          )
          .single();

      if (
        profileError ||
        !newProfile
      ) {
        setAccountError(
          'Could not switch account.',
        );

        return;
      }

      closeMenu();

      if (
        newProfile
          .must_change_password
      ) {
        router.replace(
          '/change-password' as Href,
        );

        return;
      }

      router.replace(
        getRoleRoute(
          newProfile.role as
            UserRole,
        ),
      );
    } catch (
      error
    ) {
      console.log(
        'SWITCH ACCOUNT ERROR:',
        error,
      );

      setAccountError(
        'Could not switch account.',
      );
    } finally {
      setSwitchingId(
        null,
      );
    }
  }

  /* =====================================================
   * LOGOUT
   * =================================================== */

  async function logout() {
    if (
      loggingOut ||
      !profile
    ) {
      return;
    }

    try {
      setLoggingOut(
        true,
      );

      const currentId =
        profile.user_id;

      await removeSavedAccount(
        currentId,
      );

      const remaining =
        await getSavedAccounts();

      await supabase.auth
        .signOut();

      closeMenu();

      /*
       * No accounts left.
       */

      if (
        remaining.length ===
        0
      ) {
        router.replace(
          '/' as Href,
        );

        return;
      }

      /*
       * Automatically switch
       * to the next saved account.
       */

      const next =
        remaining[0];

      const session =
        await getSavedSession(
          next.userId,
        );

      if (
        !session
      ) {
        router.replace(
          '/' as Href,
        );

        return;
      }

      const {
        error,
      } =
        await supabase.auth
          .setSession({
            access_token:
              session.accessToken,

            refresh_token:
              session.refreshToken,
          });

      if (
        error
      ) {
        router.replace(
          '/' as Href,
        );

        return;
      }

      router.replace(
        getRoleRoute(
          next.role,
        ),
      );
    } catch (
      error
    ) {
      console.log(
        'LOGOUT ERROR:',
        error,
      );

      router.replace(
        '/' as Href,
      );
    } finally {
      setLoggingOut(
        false,
      );
    }
  }

  /* =====================================================
   * OTHER ACCOUNTS
   * =================================================== */

  const otherAccounts =
    accounts.filter(
      account =>
        account.userId !==
        profile?.user_id,
    );

  /* =====================================================
   * UI
   * =================================================== */

  return (
    <>
      <StatusBar
        style={
          resolvedTheme ===
          'dark'
            ? 'light'
            : 'dark'
        }
      />

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <View
        style={[
          styles.header,

          {
            paddingTop:
              insets.top +
              6,
          },
        ]}
      >
        <View
          style={
            styles.titleArea
          }
        >
          <Text
            style={
              styles.pageTitle
            }
            numberOfLines={1}
          >
            {
              pageTitle
            }
          </Text>

          <Text
            style={
              styles.roleText
            }
          >
            {
              ROLE_NAMES[
                role
              ]
            }
          </Text>
        </View>

        {/* ACCOUNT BUTTON */}

        <Pressable
          onPress={() =>
            setMenuOpen(
              true,
            )
          }
          style={({
            pressed,
          }) => [
            styles.accountButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <View
            style={
              styles.avatar
            }
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={
                  colors.primary
                }
              />
            ) : profile
                ?.avatar_url ? (
              <Image
                source={{
                  uri:
                    profile.avatar_url,
                }}
                style={
                  styles.avatarImage
                }
              />
            ) : (
              <Text
                style={
                  styles.avatarText
                }
              >
                {
                  initial
                }
              </Text>
            )}
          </View>

          <Ionicons
            name="chevron-down"
            size={16}
            color={
              colors.textMuted
            }
          />
        </Pressable>
      </View>

      {/* ================================================= */}
      {/* ACCOUNT MENU */}
      {/* ================================================= */}

      <Modal
        visible={
          menuOpen
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeMenu
        }
      >
        <Pressable
          style={
            styles.overlay
          }
          onPress={
            closeMenu
          }
        >
          <Pressable
            style={[
              styles.menuCard,

              {
                top:
                  menuTop,

                maxHeight:
                  menuMaxHeight,
              },
            ]}
            onPress={
              event =>
                event.stopPropagation()
            }
          >
            {/* ============================================= */}
            {/* CURRENT ACCOUNT - FIXED */}
            {/* ============================================= */}

            <View
              style={
                styles.currentAccount
              }
            >
              <AccountAvatar
                name={
                  displayName
                }
                avatarUrl={
                  profile
                    ?.avatar_url ??
                  null
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
                  styles.accountText
                }
              >
                <Text
                  style={
                    styles.accountName
                  }
                  numberOfLines={1}
                >
                  {
                    displayName
                  }
                </Text>

                <Text
                  style={
                    styles.accountId
                  }
                  numberOfLines={1}
                >
                  {profile
                    ?.teacher_id ??
                    profile
                      ?.student_id ??
                    ROLE_NAMES[
                      role
                    ]}
                </Text>
              </View>

              <Ionicons
                name="checkmark-circle"
                size={20}
                color={
                  colors.primary
                }
              />
            </View>

            {/* ============================================= */}
            {/* OTHER ACCOUNTS - ONLY THIS AREA SCROLLS */}
            {/* ============================================= */}

            {otherAccounts.length >
            0 ? (
              <>
                <Divider
                  styles={
                    styles
                  }
                />

                <ScrollView
                  style={
                    styles.accountsViewport
                  }
                  contentContainerStyle={
                    styles.accountsContent
                  }
                  showsVerticalScrollIndicator={
                    false
                  }
                  nestedScrollEnabled
                >
                  {otherAccounts.map(
                    account => (
                      <Pressable
                        key={
                          account.userId
                        }
                        onPress={() =>
                          void switchAccount(
                            account,
                          )
                        }
                        disabled={
                          Boolean(
                            switchingId,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.savedAccount,

                          pressed &&
                            styles.itemPressed,
                        ]}
                      >
                        <AccountAvatar
                          name={
                            account.fullName
                          }
                          avatarUrl={
                            account.avatarUrl
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
                            styles.accountText
                          }
                        >
                          <Text
                            style={
                              styles.accountName
                            }
                            numberOfLines={1}
                          >
                            {
                              account.fullName
                            }
                          </Text>

                          <Text
                            style={
                              styles.accountId
                            }
                            numberOfLines={1}
                          >
                            {
                              account.loginId
                            }
                          </Text>
                        </View>

                        {switchingId ===
                        account.userId ? (
                          <ActivityIndicator
                            size="small"
                            color={
                              colors.primary
                            }
                          />
                        ) : (
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color={
                              colors.textMuted
                            }
                          />
                        )}
                      </Pressable>
                    ),
                  )}
                </ScrollView>
              </>
            ) : null}

            {/* ============================================= */}
            {/* ADD ACCOUNT */}
            {/* ============================================= */}

            <Pressable
              onPress={
                addAccount
              }
              style={({
                pressed,
              }) => [
                styles.addAccount,

                pressed &&
                  styles.itemPressed,
              ]}
            >
              <View
                style={
                  styles.addIcon
                }
              >
                <Ionicons
                  name="add"
                  size={21}
                  color={
                    colors.primary
                  }
                />
              </View>

              <Text
                style={
                  styles.addText
                }
              >
                Add account
              </Text>
            </Pressable>

            {accountError ? (
              <Text
                style={
                  styles.accountError
                }
              >
                {
                  accountError
                }
              </Text>
            ) : null}

            {/* ============================================= */}
            {/* ACTIONS */}
            {/* ============================================= */}

            <Divider
              styles={
                styles
              }
            />

            <MenuItem
              icon="person-outline"
              title="Profile"
              onPress={
                goToProfile
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <MenuItem
              icon="settings-outline"
              title="Settings"
              onPress={
                goToSettings
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <Divider
              styles={
                styles
              }
            />

            <MenuItem
              icon="log-out-outline"
              title="Log out"
              danger
              loading={
                loggingOut
              }
              onPress={() =>
                void logout()
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* =========================================================
 * SHARED STYLE TYPE
 * ======================================================= */

type SharedStyles =
  ReturnType<
    typeof createStyles
  >;

/* =========================================================
 * ACCOUNT AVATAR
 * ======================================================= */

function AccountAvatar({
  name,
  avatarUrl,
  colors,
  styles,
}: {
  name:
    string;

  avatarUrl:
    string | null;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
}) {
  const initial =
    name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'U';

  return (
    <View
      style={
        styles.accountAvatar
      }
    >
      {avatarUrl ? (
        <Image
          source={{
            uri:
              avatarUrl,
          }}
          style={
            styles.accountAvatarImage
          }
        />
      ) : (
        <Text
          style={
            styles.accountAvatarText
          }
        >
          {
            initial
          }
        </Text>
      )}
    </View>
  );
}

/* =========================================================
 * DIVIDER
 * ======================================================= */

function Divider({
  styles,
}: {
  styles:
    SharedStyles;
}) {
  return (
    <View
      style={
        styles.divider
      }
    />
  );
}

/* =========================================================
 * MENU ITEM
 * ======================================================= */

function MenuItem({
  icon,
  title,
  onPress,
  danger = false,
  loading = false,
  colors,
  styles,
}: {
  icon:
    | 'person-outline'
    | 'settings-outline'
    | 'log-out-outline';

  title:
    string;

  onPress:
    () => void;

  danger?:
    boolean;

  loading?:
    boolean;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
}) {
  return (
    <Pressable
      disabled={
        loading
      }
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.menuItem,

        pressed &&
          styles.itemPressed,

        loading &&
          styles.disabled,
      ]}
    >
      <View
        style={[
          styles.menuIcon,

          danger &&
            styles.menuIconDanger,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={
              colors.danger
            }
          />
        ) : (
          <Ionicons
            name={
              icon
            }
            size={19}
            color={
              danger
                ? colors.danger
                : colors.textSecondary
            }
          />
        )}
      </View>

      <Text
        style={[
          styles.menuText,

          danger &&
            styles.dangerText,
        ]}
      >
        {
          title
        }
      </Text>

      {!danger ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={
            colors.textMuted
          }
        />
      ) : null}
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
    /* =====================================================
     * HEADER
     * =================================================== */

    header: {
      width:
        '100%',

      paddingHorizontal:
        20,

      paddingBottom:
        12,

      flexDirection:
        'row',

      alignItems:
        'flex-end',

      justifyContent:
        'space-between',

      backgroundColor:
        colors.surface,

      borderBottomWidth:
        1,

      borderBottomColor:
        colors.border,
    },

    titleArea: {
      flex:
        1,

      minWidth:
        0,

      paddingRight:
        12,
    },

    pageTitle: {
      fontSize:
        20,

      lineHeight:
        25,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    roleText: {
      marginTop:
        2,

      fontSize:
        12,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    /* =====================================================
     * HEADER ACCOUNT
     * =================================================== */

    accountButton: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,

      padding:
        4,

      borderRadius:
        30,
    },

    pressed: {
      opacity:
        0.7,
    },

    disabled: {
      opacity:
        0.55,
    },

    avatar: {
      width:
        40,

      height:
        40,

      borderRadius:
        20,

      overflow:
        'hidden',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,

      borderWidth:
        1,

      borderColor:
        colors.border,
    },

    avatarImage: {
      width:
        '100%',

      height:
        '100%',
    },

    avatarText: {
      fontSize:
        15,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    /* =====================================================
     * OVERLAY
     * =================================================== */

    overlay: {
      flex:
        1,

      backgroundColor:
        'rgba(0,0,0,0.34)',
    },

    /* =====================================================
     * MENU
     * =================================================== */

    menuCard: {
      position:
        'absolute',

      right:
        14,

      width:
        280,

      overflow:
        'hidden',

      paddingHorizontal:
        10,

      paddingVertical:
        10,

      borderRadius:
        20,

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
          8,
      },

      shadowOpacity:
        0.18,

      shadowRadius:
        18,

      elevation:
        12,
    },

    /* =====================================================
     * CURRENT ACCOUNT
     * =================================================== */

    currentAccount: {
      minHeight:
        58,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        8,

      borderRadius:
        14,
    },

    /* =====================================================
     * SAVED ACCOUNTS
     * =================================================== */

    accountsViewport: {
      maxHeight:
        190,
    },

    accountsContent: {
      paddingVertical:
        1,
    },

    savedAccount: {
      minHeight:
        58,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        8,

      borderRadius:
        14,
    },

    accountAvatar: {
      width:
        40,

      height:
        40,

      borderRadius:
        20,

      overflow:
        'hidden',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    accountAvatarImage: {
      width:
        '100%',

      height:
        '100%',
    },

    accountAvatarText: {
      fontSize:
        14,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    accountText: {
      flex:
        1,

      minWidth:
        0,

      marginLeft:
        10,

      marginRight:
        8,
    },

    accountName: {
      fontSize:
        14,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    accountId: {
      marginTop:
        2,

      fontSize:
        11.5,

      color:
        colors.textMuted,
    },

    /* =====================================================
     * ADD ACCOUNT
     * =================================================== */

    addAccount: {
      minHeight:
        50,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        8,

      marginTop:
        3,

      borderRadius:
        13,
    },

    addIcon: {
      width:
        36,

      height:
        36,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    addText: {
      marginLeft:
        10,

      fontSize:
        14,

      fontWeight:
        '600',

      color:
        colors.primary,
    },

    accountError: {
      paddingHorizontal:
        10,

      paddingBottom:
        5,

      color:
        colors.danger,

      fontSize:
        12,
    },

    /* =====================================================
     * DIVIDER
     * =================================================== */

    divider: {
      height:
        1,

      marginVertical:
        5,

      backgroundColor:
        colors.border,
    },

    /* =====================================================
     * MENU ITEM
     * =================================================== */

    menuItem: {
      height:
        48,

      paddingHorizontal:
        8,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        13,
    },

    itemPressed: {
      backgroundColor:
        colors.surfaceSecondary,
    },

    menuIcon: {
      width:
        34,

      height:
        34,

      marginRight:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        10,

      backgroundColor:
        colors.surfaceSecondary,
    },

    menuIconDanger: {
      backgroundColor:
        colors.dangerSoft,
    },

    menuText: {
      flex:
        1,

      color:
        colors.textSecondary,

      fontSize:
        14,

      fontWeight:
        '600',
    },

    dangerText: {
      color:
        colors.danger,
    },
  });
}