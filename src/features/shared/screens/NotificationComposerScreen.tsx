import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  supabase,
} from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type ComposerRole =
  | 'admin'
  | 'teacher';

type NoticeKind =
  | 'announcement'
  | 'test'
  | 'meeting'
  | 'info';

type Audience =
  | 'all'
  | 'teachers'
  | 'students'
  | 'elementary'
  | 'highschool'
  | 'class'
  | 'user';

type ClassTarget = {
  id:
    string;

  class_name:
    string;

  category:
    'elementary'
    | 'high_school';
};

type UserTarget = {
  user_id:
    string;

  full_name:
    string;

  role:
    'teacher'
    | 'student';

  class_id:
    string | null;

  display_id:
    string;
};

type TargetsPayload = {
  classes?:
    ClassTarget[];

  users?:
    UserTarget[];
};

type Props = {
  role:
    ComposerRole;
};

export default function NotificationComposerScreen({
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

  const [
    kind,
    setKind,
  ] =
    useState<
      NoticeKind
    >(
      'announcement',
    );

  const [
    audience,
    setAudience,
  ] =
    useState<
      Audience
    >(
      role ===
        'admin'
        ? 'all'
        : 'class',
    );

  const [
    classes,
    setClasses,
  ] =
    useState<
      ClassTarget[]
    >([]);

  const [
    users,
    setUsers,
  ] =
    useState<
      UserTarget[]
    >([]);

  const [
    selectedClassId,
    setSelectedClassId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    selectedUserId,
    setSelectedUserId,
  ] =
    useState<
      string | null
    >(
      null,
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    title,
    setTitle,
  ] =
    useState('');

  const [
    message,
    setMessage,
  ] =
    useState('');

  const [
    loadingTargets,
    setLoadingTargets,
  ] =
    useState(true);

  const [
    sending,
    setSending,
  ] =
    useState(false);

  const [
    success,
    setSuccess,
  ] =
    useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('');

  const loadTargets =
    useCallback(
      async () => {
        try {
          setLoadingTargets(
            true,
          );

          setErrorMessage(
            '',
          );

          const {
            data,
            error,
          } =
            await supabase.rpc(
              'get_notification_targets',
            );

          if (
            error
          ) {
            throw error;
          }

          const payload =
            (
              data ??
              {}
            ) as
              TargetsPayload;

          const nextClasses =
            Array.isArray(
              payload.classes,
            )
              ? payload.classes
              : [];

          const nextUsers =
            Array.isArray(
              payload.users,
            )
              ? payload.users
              : [];

          setClasses(
            nextClasses,
          );

          setUsers(
            nextUsers,
          );

          setSelectedClassId(
            current =>
              current ??
              nextClasses[
                0
              ]?.id ??
              null,
          );
        } catch (
          error
        ) {
          console.log(
            'LOAD NOTIFICATION TARGETS ERROR:',
            error,
          );

          setErrorMessage(
            error instanceof
            Error
              ? error.message
              : 'Could not load recipients.',
          );
        } finally {
          setLoadingTargets(
            false,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadTargets();
      },
      [
        loadTargets,
      ],
    ),
  );

  useEffect(
    () => {
      if (
        role !==
          'teacher' ||
        !selectedUserId
      ) {
        return;
      }

      const selected =
        users.find(
          user =>
            user.user_id ===
            selectedUserId,
        );

      if (
        selected &&
        selected.class_id !==
          selectedClassId
      ) {
        setSelectedUserId(
          null,
        );
      }
    },
    [
      role,
      selectedClassId,
      selectedUserId,
      users,
    ],
  );

  const audienceOptions =
    useMemo(
      () => {
        if (
          role ===
          'teacher'
        ) {
          return [
            {
              key:
                'class' as const,

              label:
                'My Class',
            },

            {
              key:
                'user' as const,

              label:
                'One Student',
            },
          ];
        }

        return [
          {
            key:
              'all' as const,

            label:
              'Everyone',
          },

          {
            key:
              'teachers' as const,

            label:
              'Teachers',
          },

          {
            key:
              'students' as const,

            label:
              'Students',
          },

          {
            key:
              'elementary' as const,

            label:
              'Elementary',
          },

          {
            key:
              'highschool' as const,

            label:
              'High School',
          },

          {
            key:
              'class' as const,

            label:
              'One Class',
          },

          {
            key:
              'user' as const,

            label:
              'One Person',
          },
        ];
      },
      [
        role,
      ],
    );

  const visibleUsers =
    useMemo(
      () => {
        let next =
          users;

        if (
          role ===
            'teacher' &&
          selectedClassId
        ) {
          next =
            next.filter(
              user =>
                user.class_id ===
                selectedClassId,
            );
        }

        const query =
          search
            .trim()
            .toLowerCase();

        if (
          query
        ) {
          next =
            next.filter(
              user =>
                user.full_name
                  .toLowerCase()
                  .includes(
                    query,
                  ) ||
                user.display_id
                  .toLowerCase()
                  .includes(
                    query,
                  ),
            );
        }

        return next.slice(
          0,
          12,
        );
      },
      [
        role,
        users,
        selectedClassId,
        search,
      ],
    );

  const selectedUser =
    users.find(
      user =>
        user.user_id ===
        selectedUserId,
    ) ??
    null;

  const canSend =
    title.trim().length >=
      2 &&
    message.trim().length >=
      2 &&
    !sending &&
    (
      audience !==
        'class' ||
      Boolean(
        selectedClassId,
      )
    ) &&
    (
      audience !==
        'user' ||
      Boolean(
        selectedUserId,
      )
    );

  async function sendNotice() {
    if (
      !canSend
    ) {
      return;
    }

    try {
      setSending(
        true,
      );

      setSuccess(
        '',
      );

      setErrorMessage(
        '',
      );

      let audienceType =
        'all';

      let targetRole:
        string | null =
        null;

      let targetCategory:
        string | null =
        null;

      let targetClassId:
        string | null =
        null;

      let targetUserId:
        string | null =
        null;

      if (
        audience ===
        'teachers'
      ) {
        audienceType =
          'role';

        targetRole =
          'teacher';
      }

      if (
        audience ===
        'students'
      ) {
        audienceType =
          'role';

        targetRole =
          'student';
      }

      if (
        audience ===
        'elementary'
      ) {
        audienceType =
          'category';

        targetCategory =
          'elementary';
      }

      if (
        audience ===
        'highschool'
      ) {
        audienceType =
          'category';

        targetCategory =
          'high_school';
      }

      if (
        audience ===
        'class'
      ) {
        audienceType =
          'class';

        targetClassId =
          selectedClassId;
      }

      if (
        audience ===
        'user'
      ) {
        audienceType =
          'user';

        targetUserId =
          selectedUserId;
      }

      const {
        error,
      } =
        await supabase.rpc(
          'send_school_notification',
          {
            p_kind:
              kind,

            p_title:
              title.trim(),

            p_message:
              message.trim(),

            p_audience_type:
              audienceType,

            p_target_role:
              targetRole,

            p_target_category:
              targetCategory,

            p_target_class_id:
              targetClassId,

            p_target_user_id:
              targetUserId,
          },
        );

      if (
        error
      ) {
        throw error;
      }

      setTitle(
        '',
      );

      setMessage(
        '',
      );

      setSearch(
        '',
      );

      setSelectedUserId(
        null,
      );

      setSuccess(
        'Notification sent successfully.',
      );
    } catch (
      error
    ) {
      console.log(
        'SEND NOTICE ERROR:',
        error,
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : 'Could not send notification.',
      );
    } finally {
      setSending(
        false,
      );
    }
  }

  return (
    <KeyboardAvoidingView
      style={
        styles.screen
      }
      behavior={
        Platform.OS ===
        'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={({
            pressed,
          }) => [
            styles.backButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={21}
            color={
              colors.text
            }
          />

          <Text
            style={
              styles.backText
            }
          >
            Back
          </Text>
        </Pressable>

        <Text
          style={
            styles.pageTitle
          }
        >
          {role ===
          'admin'
            ? 'Send Announcement'
            : 'Send Class Notice'}
        </Text>

        <Text
          style={
            styles.pageDescription
          }
        >
          {role ===
          'admin'
            ? 'Send an update to the school, a group, a class or one person.'
            : 'Send an update to your homeroom class or one student.'}
        </Text>

        {success ? (
          <View
            style={
              styles.successBox
            }
          >
            <Ionicons
              name="checkmark-circle"
              size={21}
              color={
                colors.success
              }
            />

            <Text
              style={
                styles.successText
              }
            >
              {success}
            </Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View
            style={
              styles.errorBox
            }
          >
            <Ionicons
              name="alert-circle"
              size={21}
              color={
                colors.danger
              }
            />

            <Text
              style={
                styles.errorText
              }
            >
              {errorMessage}
            </Text>
          </View>
        ) : null}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Type
        </Text>

        <View
          style={
            styles.chipRow
          }
        >
          <ChoiceChip
            label="Announcement"
            selected={
              kind ===
              'announcement'
            }
            onPress={() =>
              setKind(
                'announcement',
              )
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <ChoiceChip
            label="Test"
            selected={
              kind ===
              'test'
            }
            onPress={() =>
              setKind(
                'test',
              )
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <ChoiceChip
            label="Meeting"
            selected={
              kind ===
              'meeting'
            }
            onPress={() =>
              setKind(
                'meeting',
              )
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />

          <ChoiceChip
            label="Info"
            selected={
              kind ===
              'info'
            }
            onPress={() =>
              setKind(
                'info',
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

        <Text
          style={
            styles.sectionTitle
          }
        >
          Who should receive it?
        </Text>

        <View
          style={
            styles.chipRow
          }
        >
          {audienceOptions.map(
            option => (
              <ChoiceChip
                key={
                  option.key
                }
                label={
                  option.label
                }
                selected={
                  audience ===
                  option.key
                }
                onPress={() => {
                  setAudience(
                    option.key,
                  );

                  setSelectedUserId(
                    null,
                  );
                }}
                colors={
                  colors
                }
                styles={
                  styles
                }
              />
            ),
          )}
        </View>

        {loadingTargets ? (
          <View
            style={
              styles.loadingTargets
            }
          >
            <ActivityIndicator
              color={
                colors.primary
              }
            />
          </View>
        ) : null}

        {audience ===
          'class' ||
        (
          role ===
            'teacher' &&
          audience ===
            'user'
        ) ? (
          <>
            <Text
              style={
                styles.fieldLabel
              }
            >
              Class
            </Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.classRow
              }
            >
              {classes.map(
                schoolClass => (
                  <ChoiceChip
                    key={
                      schoolClass.id
                    }
                    label={
                      schoolClass.class_name
                    }
                    selected={
                      selectedClassId ===
                      schoolClass.id
                    }
                    onPress={() => {
                      setSelectedClassId(
                        schoolClass.id,
                      );

                      setSelectedUserId(
                        null,
                      );
                    }}
                    colors={
                      colors
                    }
                    styles={
                      styles
                    }
                  />
                ),
              )}
            </ScrollView>
          </>
        ) : null}

        {audience ===
        'user' ? (
          <View
            style={
              styles.userSection
            }
          >
            <Text
              style={
                styles.fieldLabel
              }
            >
              {role ===
              'admin'
                ? 'Choose person'
                : 'Choose student'}
            </Text>

            <View
              style={
                styles.searchBox
              }
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={
                  colors.textMuted
                }
              />

              <TextInput
                value={
                  search
                }
                onChangeText={
                  setSearch
                }
                placeholder="Search by name or ID"
                placeholderTextColor={
                  colors.textMuted
                }
                style={
                  styles.searchInput
                }
              />
            </View>

            {selectedUser ? (
              <View
                style={
                  styles.selectedUser
                }
              >
                <View
                  style={
                    styles.selectedUserIcon
                  }
                >
                  <Ionicons
                    name="person"
                    size={19}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.selectedUserText
                  }
                >
                  <Text
                    style={
                      styles.selectedUserName
                    }
                  >
                    {
                      selectedUser.full_name
                    }
                  </Text>

                  <Text
                    style={
                      styles.selectedUserId
                    }
                  >
                    {selectedUser.role ===
                    'teacher'
                      ? 'Teacher'
                      : 'Student'}
                    {selectedUser.display_id
                      ? ` • ${selectedUser.display_id}`
                      : ''}
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    setSelectedUserId(
                      null,
                    )
                  }
                >
                  <Ionicons
                    name="close-circle"
                    size={23}
                    color={
                      colors.textMuted
                    }
                  />
                </Pressable>
              </View>
            ) : (
              <View
                style={
                  styles.userList
                }
              >
                {visibleUsers.map(
                  user => (
                    <Pressable
                      key={
                        user.user_id
                      }
                      onPress={() =>
                        setSelectedUserId(
                          user.user_id,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.userRow,

                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <View
                        style={
                          styles.userAvatar
                        }
                      >
                        <Text
                          style={
                            styles.userAvatarText
                          }
                        >
                          {user.full_name
                            .trim()
                            .charAt(
                              0,
                            )
                            .toUpperCase() ||
                            'U'}
                        </Text>
                      </View>

                      <View
                        style={
                          styles.userText
                        }
                      >
                        <Text
                          style={
                            styles.userName
                          }
                          numberOfLines={1}
                        >
                          {
                            user.full_name
                          }
                        </Text>

                        <Text
                          style={
                            styles.userMeta
                          }
                        >
                          {user.role ===
                          'teacher'
                            ? 'Teacher'
                            : 'Student'}
                          {user.display_id
                            ? ` • ${user.display_id}`
                            : ''}
                        </Text>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={19}
                        color={
                          colors.textMuted
                        }
                      />
                    </Pressable>
                  ),
                )}

                {visibleUsers.length ===
                0 ? (
                  <Text
                    style={
                      styles.noUsers
                    }
                  >
                    No matching users.
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        <Text
          style={
            styles.fieldLabel
          }
        >
          Title
        </Text>

        <TextInput
          value={
            title
          }
          onChangeText={
            setTitle
          }
          maxLength={
            80
          }
          placeholder="Example: Math test tomorrow"
          placeholderTextColor={
            colors.textMuted
          }
          style={
            styles.input
          }
        />

        <Text
          style={
            styles.fieldLabel
          }
        >
          Message
        </Text>

        <TextInput
          value={
            message
          }
          onChangeText={
            setMessage
          }
          maxLength={
            500
          }
          multiline
          textAlignVertical="top"
          placeholder="Write the important information..."
          placeholderTextColor={
            colors.textMuted
          }
          style={[
            styles.input,
            styles.messageInput,
          ]}
        />

        <Text
          style={
            styles.helper
          }
        >
          Group notices are visible only to that audience. One-person notices are private.
        </Text>

        <Pressable
          disabled={
            !canSend
          }
          onPress={() =>
            void sendNotice()
          }
          style={({
            pressed,
          }) => [
            styles.sendButton,

            !canSend &&
              styles.sendButtonDisabled,

            pressed &&
              canSend &&
              styles.pressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator
              color="#FFFFFF"
            />
          ) : (
            <>
              <Ionicons
                name="send"
                size={20}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.sendButtonText
                }
              >
                Send Notification
              </Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
  colors,
  styles,
}: {
  label:
    string;

  selected:
    boolean;

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
        styles.chip,

        selected &&
          styles.chipSelected,

        pressed &&
          styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipText,

          selected &&
            styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
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
        16,

      paddingBottom:
        140,
    },

    backButton: {
      alignSelf:
        'flex-start',

      height:
        42,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,

      borderRadius:
        14,

      backgroundColor:
        colors.surfaceSecondary,
    },

    backText: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '800',
    },

    pageTitle: {
      marginTop:
        22,

      color:
        colors.text,

      fontSize:
        27,

      lineHeight:
        34,

      fontWeight:
        '900',
    },

    pageDescription: {
      marginTop:
        6,

      marginBottom:
        20,

      color:
        colors.textSecondary,

      fontSize:
        14,

      lineHeight:
        21,

      fontWeight:
        '600',
    },

    sectionTitle: {
      marginTop:
        18,

      marginBottom:
        10,

      color:
        colors.text,

      fontSize:
        17,

      lineHeight:
        22,

      fontWeight:
        '900',
    },

    fieldLabel: {
      marginTop:
        18,

      marginBottom:
        8,

      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    chipRow: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        8,
    },

    classRow: {
      gap:
        8,

      paddingRight:
        20,
    },

    chip: {
      minHeight:
        42,

      paddingHorizontal:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    chipSelected: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    chipText: {
      color:
        colors.textSecondary,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    chipTextSelected: {
      color:
        colors.primary,

      fontWeight:
        '900',
    },

    input: {
      minHeight:
        54,

      paddingHorizontal:
        15,

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.input,

      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '700',
    },

    messageInput: {
      minHeight:
        132,

      paddingTop:
        15,

      paddingBottom:
        15,

      lineHeight:
        21,
    },

    helper: {
      marginTop:
        9,

      color:
        colors.textMuted,

      fontSize:
        12,

      lineHeight:
        18,

      fontWeight:
        '600',
    },

    searchBox: {
      height:
        52,

      paddingHorizontal:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.input,
    },

    searchInput: {
      flex:
        1,

      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '700',
    },

    userSection: {
      marginTop:
        2,
    },

    userList: {
      marginTop:
        9,

      overflow:
        'hidden',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    userRow: {
      minHeight:
        66,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    userAvatar: {
      width:
        40,

      height:
        40,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    userAvatarText: {
      color:
        colors.primary,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    userText: {
      flex:
        1,

      minWidth:
        0,

      marginHorizontal:
        11,
    },

    userName: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    userMeta: {
      marginTop:
        3,

      color:
        colors.textMuted,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    noUsers: {
      padding:
        18,

      color:
        colors.textMuted,

      textAlign:
        'center',

      fontSize:
        13,

      fontWeight:
        '700',
    },

    selectedUser: {
      marginTop:
        9,

      minHeight:
        66,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    selectedUserIcon: {
      width:
        40,

      height:
        40,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.card,
    },

    selectedUserText: {
      flex:
        1,

      marginHorizontal:
        10,
    },

    selectedUserName: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    selectedUserId: {
      marginTop:
        3,

      color:
        colors.textSecondary,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    sendButton: {
      height:
        56,

      marginTop:
        24,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        9,

      borderRadius:
        17,

      backgroundColor:
        colors.primary,
    },

    sendButtonDisabled: {
      opacity:
        0.4,
    },

    sendButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '900',
    },

    successBox: {
      minHeight:
        52,

      padding:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,

      borderRadius:
        15,

      backgroundColor:
        colors.successSoft,
    },

    successText: {
      flex:
        1,

      color:
        colors.success,

      fontSize:
        13,

      lineHeight:
        18,

      fontWeight:
        '800',
    },

    errorBox: {
      minHeight:
        52,

      marginTop:
        8,

      padding:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,

      borderRadius:
        15,

      backgroundColor:
        colors.dangerSoft,
    },

    errorText: {
      flex:
        1,

      color:
        colors.danger,

      fontSize:
        13,

      lineHeight:
        18,

      fontWeight:
        '800',
    },

    loadingTargets: {
      paddingVertical:
        12,

      alignItems:
        'center',
    },

    pressed: {
      opacity:
        0.7,
    },
  });
}