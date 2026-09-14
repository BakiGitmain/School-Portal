import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  StatusBar,
} from 'expo-status-bar';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  supabase,
} from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type TeacherProfile = {
  id: string;

  user_id: string;

  full_name: string;

  username:
    | string
    | null;

  teacher_id:
    | string
    | null;

  phone_number:
    | string
    | null;

  location:
    | string
    | null;

  avatar_url:
    | string
    | null;

  subjects:
    string[];
};

export default function TeacherProfileScreen() {
  const {
    colors,
    resolvedTheme,
  } =
    useAppSettings();

  const styles =
    useMemo(
      () =>
        createStyles(
          colors
        ),
      [colors]
    );

  const [
    profile,
    setProfile,
  ] =
    useState<TeacherProfile | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState('');

  const [
    newPassword,
    setNewPassword,
  ] =
    useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('');

  const [
    showCurrent,
    setShowCurrent,
  ] =
    useState(false);

  const [
    showNew,
    setShowNew,
  ] =
    useState(false);

  const [
    showConfirm,
    setShowConfirm,
  ] =
    useState(false);

  const [
    changingPassword,
    setChangingPassword,
  ] =
    useState(false);

  const [
    passwordError,
    setPasswordError,
  ] =
    useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      const {
        data: authData,
        error: authError,
      } =
        await supabase.auth
          .getUser();

      if (
        authError ||
        !authData.user
      ) {
        throw (
          authError ??
          new Error(
            'User not found'
          )
        );
      }

      const {
        data,
        error,
      } =
        await supabase
          .from('profiles')
          .select(`
            id,
            user_id,
            full_name,
            username,
            teacher_id,
            phone_number,
            location,
            avatar_url,
            subjects
          `)
          .eq(
            'user_id',
            authData.user.id
          )
          .eq(
            'role',
            'teacher'
          )
          .single();

      if (
        error ||
        !data
      ) {
        throw (
          error ??
          new Error(
            'Profile not found'
          )
        );
      }

      setProfile({
        ...(data as TeacherProfile),

        subjects:
          data.subjects ??
          [],
      });
    } catch (error) {
      console.log(
        'LOAD PROFILE ERROR:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  async function changePassword() {
    if (
      changingPassword
    ) {
      return;
    }

    setPasswordError('');

    setSuccessMessage('');

    if (!currentPassword) {
      setPasswordError(
        'Current password is required.'
      );

      return;
    }

    if (!newPassword) {
      setPasswordError(
        'New password is required.'
      );

      return;
    }

    if (
      newPassword.length <
      8
    ) {
      setPasswordError(
        'Use at least 8 characters.'
      );

      return;
    }

    if (
      newPassword ===
      currentPassword
    ) {
      setPasswordError(
        'Choose a different password.'
      );

      return;
    }

    if (
      !confirmPassword
    ) {
      setPasswordError(
        'Confirm your new password.'
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordError(
        'Passwords do not match.'
      );

      return;
    }

    try {
      setChangingPassword(
        true
      );

      const {
        data: authData,
        error: userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !authData.user
      ) {
        throw (
          userError ??
          new Error(
            'User not found'
          )
        );
      }

      const email =
        authData.user.email;

      if (!email) {
        throw new Error(
          'Account email is unavailable.'
        );
      }

      /*
       * Confirm current password
       * before allowing the update.
       */

      const {
        error:
          currentPasswordError,
      } =
        await supabase.auth
          .signInWithPassword({
            email,

            password:
              currentPassword,
          });

      if (
        currentPasswordError
      ) {
        setPasswordError(
          'Current password is incorrect.'
        );

        return;
      }

      const {
        error:
          updateError,
      } =
        await supabase.auth
          .updateUser({
            password:
              newPassword,
          });

      if (updateError) {
        throw updateError;
      }

      setCurrentPassword('');

      setNewPassword('');

      setConfirmPassword('');

      setSuccessMessage(
        'Password changed.'
      );
    } catch (error) {
      console.log(
        'CHANGE PASSWORD ERROR:',
        error
      );

      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Could not change password.'
      );
    } finally {
      setChangingPassword(
        false
      );
    }
  }

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
        edges={[
          'left',
          'right',
          'bottom',
        ]}
      >
        <StatusBar
          style={
            resolvedTheme ===
            'dark'
              ? 'light'
              : 'dark'
          }
        />

        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            size="large"
            color={
              colors.primary
            }
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <View
        style={
          styles.loading
        }
      >
        <Text
          style={
            styles.errorText
          }
        >
          Could not load profile.
        </Text>
      </View>
    );
  }

  const initial =
    profile.full_name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'T';

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
      edges={[
        'left',
        'right',
        'bottom',
      ]}
    >
      <StatusBar
        style={
          resolvedTheme ===
          'dark'
            ? 'light'
            : 'dark'
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* PROFILE HERO */}

        <View
          style={
            styles.profileHero
          }
        >
          <View
            style={
              styles.avatar
            }
          >
            {profile.avatar_url ? (
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
                  styles.avatarInitial
                }
              >
                {initial}
              </Text>
            )}
          </View>

          <Text
            style={
              styles.name
            }
          >
            {
              profile.full_name
            }
          </Text>

          <Text
            style={
              styles.role
            }
          >
            Teacher
          </Text>

          <View
            style={
              styles.idBadge
            }
          >
            <Text
              style={
                styles.idBadgeText
              }
            >
              {
                profile.teacher_id
              }
            </Text>
          </View>
        </View>

        {/* DETAILS */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Profile
        </Text>

        <View
          style={
            styles.card
          }
        >
          <InfoRow
            icon="person-outline"
            title="Username"
            value={
              profile.username
                ? `@${profile.username}`
                : 'Not added'
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

          <InfoRow
            icon="call-outline"
            title="Phone"
            value={
              profile.phone_number ??
              'Not added'
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

          <InfoRow
            icon="location-outline"
            title="Location"
            value={
              profile.location ??
              'Not added'
            }
            colors={
              colors
            }
            styles={
              styles
            }
          />
        </View>

        {/* SUBJECTS */}

        <Text
          style={[
            styles.sectionTitle,
            styles.nextSection,
          ]}
        >
          Subjects
        </Text>

        <View
          style={
            styles.subjectCard
          }
        >
          {profile.subjects.length >
          0 ? (
            <View
              style={
                styles.subjects
              }
            >
              {profile.subjects.map(
                (subject) => (
                  <View
                    key={subject}
                    style={
                      styles.subjectChip
                    }
                  >
                    <Text
                      style={
                        styles.subjectText
                      }
                    >
                      {subject}
                    </Text>
                  </View>
                )
              )}
            </View>
          ) : (
            <Text
              style={
                styles.emptySubjects
              }
            >
              No subjects assigned
            </Text>
          )}
        </View>

        {/* PASSWORD */}

        <Text
          style={[
            styles.sectionTitle,
            styles.nextSection,
          ]}
        >
          Password
        </Text>

        <View
          style={
            styles.passwordCard
          }
        >
          <Text
            style={
              styles.passwordTitle
            }
          >
            Change password
          </Text>

          <Text
            style={
              styles.passwordDescription
            }
          >
            Update the password used to sign in.
          </Text>

          <PasswordInput
            value={
              currentPassword
            }
            onChangeText={
              setCurrentPassword
            }
            placeholder="Current password"
            visible={
              showCurrent
            }
            onToggle={() =>
              setShowCurrent(
                (current) =>
                  !current
              )
            }
            styles={styles}
            colors={colors}
          />

          <PasswordInput
            value={
              newPassword
            }
            onChangeText={
              setNewPassword
            }
            placeholder="New password"
            visible={
              showNew
            }
            onToggle={() =>
              setShowNew(
                (current) =>
                  !current
              )
            }
            styles={styles}
            colors={colors}
          />

          <PasswordInput
            value={
              confirmPassword
            }
            onChangeText={
              setConfirmPassword
            }
            placeholder="Confirm password"
            visible={
              showConfirm
            }
            onToggle={() =>
              setShowConfirm(
                (current) =>
                  !current
              )
            }
            styles={styles}
            colors={colors}
          />

          {passwordError ? (
            <View
              style={
                styles.messageRow
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={17}
                color={
                  colors.danger
                }
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {passwordError}
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View
              style={
                styles.messageRow
              }
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={17}
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.successText
                }
              >
                {successMessage}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={
              changePassword
            }
            disabled={
              changingPassword
            }
            style={({
              pressed,
            }) => [
              styles.changeButton,

              pressed &&
                styles.pressed,

              changingPassword &&
                styles.disabled,
            ]}
          >
            {changingPassword ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.changeButtonText
                }
              >
                Change Password
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type SharedStyles =
  ReturnType<
    typeof createStyles
  >;

function InfoRow({
  icon,
  title,
  value,
  colors,
  styles,
}: {
  icon:
    | 'person-outline'
    | 'call-outline'
    | 'location-outline';

  title: string;

  value: string;

  colors: AppThemeColors;

  styles: SharedStyles;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <View
        style={
          styles.infoIcon
        }
      >
        <Ionicons
          name={icon}
          size={19}
          color={
            colors.primary
          }
        />
      </View>

      <View
        style={{
          flex: 1,
        }}
      >
        <Text
          style={
            styles.infoLabel
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.infoValue
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function Divider({
  styles,
}: {
  styles: SharedStyles;
}) {
  return (
    <View
      style={
        styles.divider
      }
    />
  );
}

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggle,
  styles,
  colors,
}: {
  value: string;

  onChangeText: (
    text: string
  ) => void;

  placeholder: string;

  visible: boolean;

  onToggle: () => void;

  styles: SharedStyles;

  colors: AppThemeColors;
}) {
  return (
    <View
      style={
        styles.passwordInput
      }
    >
      <Ionicons
        name="lock-closed-outline"
        size={19}
        color={
          colors.textMuted
        }
      />

      <TextInput
        value={value}
        onChangeText={
          onChangeText
        }
        placeholder={
          placeholder
        }
        placeholderTextColor={
          colors.textMuted
        }
        secureTextEntry={
          !visible
        }
        autoCapitalize="none"
        autoCorrect={false}
        style={
          styles.passwordTextInput
        }
      />

      <Pressable
        onPress={
          onToggle
        }
        hitSlop={10}
      >
        <Ionicons
          name={
            visible
              ? 'eye-off-outline'
              : 'eye-outline'
          }
          size={20}
          color={
            colors.textMuted
          }
        />
      </Pressable>
    </View>
  );
}

function createStyles(
  colors: AppThemeColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 20,

      paddingTop: 20,

      paddingBottom: 120,
    },

    loading: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.background,
    },

    profileHero: {
      alignItems:
        'center',

      paddingVertical: 12,
    },

    avatar: {
      width: 96,
      height: 96,

      borderRadius: 48,

      alignItems:
        'center',

      justifyContent:
        'center',

      overflow:
        'hidden',

      backgroundColor:
        colors.primarySoft,

      borderWidth: 3,

      borderColor:
        colors.card,
    },

    avatarImage: {
      width: '100%',

      height: '100%',
    },

    avatarInitial: {
      fontSize: 32,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    name: {
      marginTop: 13,

      fontSize: 21,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    role: {
      marginTop: 3,

      fontSize: 13,

      color:
        colors.textMuted,
    },

    idBadge: {
      marginTop: 10,

      paddingHorizontal: 11,

      paddingVertical: 6,

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    idBadgeText: {
      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.primary,
    },

    sectionTitle: {
      marginTop: 20,

      marginBottom: 8,

      marginLeft: 3,

      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    nextSection: {
      marginTop: 24,
    },

    card: {
      paddingHorizontal: 14,

      borderRadius: 20,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    infoRow: {
      minHeight: 65,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    infoIcon: {
      width: 38,
      height: 38,

      marginRight: 11,

      borderRadius: 12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    infoLabel: {
      fontSize: 11,

      color:
        colors.textMuted,
    },

    infoValue: {
      marginTop: 3,

      fontSize: 14,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    divider: {
      height: 1,

      backgroundColor:
        colors.border,
    },

    subjectCard: {
      minHeight: 60,

      padding: 14,

      borderRadius: 20,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    subjects: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 8,
    },

    subjectChip: {
      paddingHorizontal: 10,

      paddingVertical: 7,

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    subjectText: {
      fontSize: 12,

      fontWeight:
        '600',

      color:
        colors.primary,
    },

    emptySubjects: {
      fontSize: 13,

      color:
        colors.textMuted,
    },

    passwordCard: {
      padding: 16,

      borderRadius: 20,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    passwordTitle: {
      fontSize: 15,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    passwordDescription: {
      marginTop: 4,

      marginBottom: 16,

      fontSize: 12,

      lineHeight: 18,

      color:
        colors.textMuted,
    },

    passwordInput: {
      height: 52,

      marginBottom: 12,

      paddingHorizontal: 14,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 15,

      backgroundColor:
        colors.input,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    passwordTextInput: {
      flex: 1,

      height: '100%',

      marginHorizontal: 10,

      fontSize: 14,

      color:
        colors.text,
    },

    messageRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,

      marginTop: 2,

      marginBottom: 8,
    },

    errorText: {
      flex: 1,

      fontSize: 12,

      color:
        colors.danger,
    },

    successText: {
      flex: 1,

      fontSize: 12,

      color:
        colors.primary,
    },

    changeButton: {
      height: 51,

      marginTop: 7,

      borderRadius: 16,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primary,
    },

    changeButtonText: {
      color:
        '#FFFFFF',

      fontSize: 14,

      fontWeight:
        '700',
    },

    pressed: {
      opacity: 0.8,
    },

    disabled: {
      opacity: 0.6,
    },
  });
}