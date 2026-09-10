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
  StatusBar,
} from 'expo-status-bar';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  supabase,
} from '../../../lib/supabase';

import {
  saveAccount,
} from '../../../lib/accountStore';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type Role =
  | 'admin'
  | 'teacher'
  | 'student';

type Props = {
  role: Role;
};

type Profile = {
  id: string;

  user_id: string;

  full_name: string;

  username:
    | string
    | null;

  role: Role;

  teacher_id:
    | string
    | null;

  student_id:
    | string
    | null;

  avatar_url:
    | string
    | null;

  phone_number:
    | string
    | null;

  location:
    | string
    | null;

  subjects: string[];
};

type EditingField =
  | 'name'
  | 'username'
  | null;

const ROLE_LABELS: Record<
  Role,
  string
> = {
  admin: 'President',
  teacher: 'Teacher',
  student: 'Student',
};

async function getFunctionError(
  error: unknown
) {
  try {
    const possible =
      error as {
        context?: Response;

        message?: string;
      };

    if (
      possible.context &&
      typeof possible.context.json ===
        'function'
    ) {
      const body =
        await possible.context.json();

      if (body?.error) {
        return String(
          body.error
        );
      }
    }

    if (
      possible.message
    ) {
      return possible.message;
    }
  } catch {}

  return 'Something went wrong.';
}

export default function RoleProfileScreen({
  role,
}: Props) {
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
    useState<Profile | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  /*
   * =====================================
   * PRESIDENT PROFILE EDITING
   * =====================================
   */

  const [
    editingField,
    setEditingField,
  ] =
    useState<EditingField>(
      null
    );

  const [
    editName,
    setEditName,
  ] =
    useState('');

  const [
    editUsername,
    setEditUsername,
  ] =
    useState('');

  const [
    savingField,
    setSavingField,
  ] =
    useState<EditingField>(
      null
    );

  const [
    editError,
    setEditError,
  ] =
    useState('');

  const [
    editSuccess,
    setEditSuccess,
  ] =
    useState('');

  /*
   * =====================================
   * PASSWORD
   * =====================================
   */

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
    passwordSuccess,
    setPasswordSuccess,
  ] =
    useState('');

  const [
    loadError,
    setLoadError,
  ] =
    useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);

      setLoadError('');

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
        error:
          profileError,
      } =
        await supabase
          .from('profiles')
          .select(`
            id,
            user_id,
            full_name,
            username,
            role,
            teacher_id,
            student_id,
            avatar_url,
            phone_number,
            location,
            subjects
          `)
          .eq(
            'user_id',
            authData.user.id
          )
          .single();

      if (
        profileError ||
        !data
      ) {
        throw (
          profileError ??
          new Error(
            'Profile not found'
          )
        );
      }

      const loadedProfile = {
        ...(data as Profile),

        subjects:
          data.subjects ??
          [],
      };

      setProfile(
        loadedProfile
      );

      setEditName(
        loadedProfile.full_name
      );

      setEditUsername(
        loadedProfile.username ??
          ''
      );
    } catch (
      error
    ) {
      console.log(
        'PROFILE LOAD ERROR:',
        error
      );

      setLoadError(
        'Could not load profile.'
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * =====================================
   * EDIT PRESIDENT NAME / USERNAME
   * =====================================
   */

  function startEdit(
    field:
      Exclude<
        EditingField,
        null
      >
  ) {
    if (
      !profile ||
      role !== 'admin'
    ) {
      return;
    }

    setEditError('');

    setEditSuccess('');

    if (
      field === 'name'
    ) {
      setEditName(
        profile.full_name
      );
    }

    if (
      field ===
      'username'
    ) {
      setEditUsername(
        profile.username ??
          ''
      );
    }

    setEditingField(
      field
    );
  }

  async function saveProfileField() {
    if (
      !profile ||
      role !== 'admin' ||
      !editingField ||
      savingField
    ) {
      return;
    }

    const cleanName =
      (
        editingField ===
        'name'
          ? editName
          : profile.full_name
      ).trim();

    const cleanUsername =
      (
        editingField ===
        'username'
          ? editUsername
          : profile.username ??
            ''
      )
        .trim()
        .toLowerCase();

    setEditError('');

    setEditSuccess('');

    if (!cleanName) {
      setEditError(
        'Name is required.'
      );

      return;
    }

    if (!cleanUsername) {
      setEditError(
        'Username is required.'
      );

      return;
    }

    if (
      !/^[a-z0-9._-]{3,30}$/.test(
        cleanUsername
      )
    ) {
      setEditError(
        'Use 3–30 letters, numbers, dots, _ or -.'
      );

      return;
    }

    try {
      setSavingField(
        editingField
      );

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions
          .invoke(
            'update-admin-profile',
            {
              body: {
                fullName:
                  cleanName,

                username:
                  cleanUsername,
              },
            }
          );

      if (
        functionError
      ) {
        const message =
          await getFunctionError(
            functionError
          );

        throw new Error(
          message
        );
      }

      if (
        !data?.profile
      ) {
        throw new Error(
          data?.error ??
            'Could not update profile.'
        );
      }

      const updated =
        data.profile as Profile;

      const nextProfile: Profile = {
        ...profile,

        ...updated,

        subjects:
          updated.subjects ??
          profile.subjects ??
          [],
      };

      setProfile(
        nextProfile
      );

      setEditName(
        nextProfile.full_name
      );

      setEditUsername(
        nextProfile.username ??
          ''
      );

      /*
       * Refresh Auth so the current
       * account knows about the new
       * hidden login email.
       */

      const {
        data:
          refreshData,
        error:
          refreshError,
      } =
        await supabase.auth
          .refreshSession();

      if (refreshError) {
        console.log(
          'SESSION REFRESH ERROR:',
          refreshError.message
        );
      }

      const session =
        refreshData.session ??
        (
          await supabase.auth
            .getSession()
        ).data.session;

      /*
       * Keep Add Account / account
       * switching data up to date.
       */

      if (session) {
        await saveAccount(
          {
            userId:
              nextProfile.user_id,

            loginId:
              cleanUsername,

            fullName:
              nextProfile.full_name,

            role:
              nextProfile.role,

            avatarUrl:
              nextProfile.avatar_url,

            teacherId:
              nextProfile.teacher_id,

            studentId:
              nextProfile.student_id,
          },

          session
        );
      }

      setEditingField(
        null
      );

      setEditSuccess(
        'Profile updated.'
      );

      /*
       * Clear success text shortly
       * afterwards so the screen stays clean.
       */

      setTimeout(
        () => {
          setEditSuccess('');
        },
        1800
      );
    } catch (
      error
    ) {
      console.log(
        'UPDATE PROFILE ERROR:',
        error
      );

      setEditError(
        error instanceof
          Error
          ? error.message
          : 'Could not update profile.'
      );
    } finally {
      setSavingField(
        null
      );
    }
  }

  /*
   * =====================================
   * PASSWORD
   * =====================================
   */

  async function changePassword() {
    if (
      changingPassword
    ) {
      return;
    }

    setPasswordError('');

    setPasswordSuccess('');

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

    if (!confirmPassword) {
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
        data: userData,
        error:
          userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !userData.user
      ) {
        throw (
          userError ??
          new Error(
            'Account unavailable'
          )
        );
      }

      const email =
        userData.user.email;

      if (!email) {
        throw new Error(
          'Account unavailable.'
        );
      }

      /*
       * Verify current password.
       */

      const {
        error:
          verifyError,
      } =
        await supabase.auth
          .signInWithPassword({
            email,

            password:
              currentPassword,
          });

      if (verifyError) {
        setPasswordError(
          'Current password is incorrect.'
        );

        return;
      }

      /*
       * Update password.
       */

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

      /*
       * Save the refreshed session
       * for account switching.
       */

      const {
        data:
          sessionData,
      } =
        await supabase.auth
          .getSession();

      if (
        sessionData.session &&
        profile
      ) {
        const loginId =
          role === 'admin'
            ? profile.username ??
              'president'
            : role ===
                'teacher'
              ? profile.teacher_id ??
                ''
              : profile.student_id ??
                '';

        await saveAccount(
          {
            userId:
              profile.user_id,

            loginId,

            fullName:
              profile.full_name,

            role:
              profile.role,

            avatarUrl:
              profile.avatar_url,

            teacherId:
              profile.teacher_id,

            studentId:
              profile.student_id,
          },

          sessionData.session
        );
      }

      setCurrentPassword('');

      setNewPassword('');

      setConfirmPassword('');

      setPasswordSuccess(
        'Password changed.'
      );
    } catch (
      error
    ) {
      console.log(
        'CHANGE PASSWORD ERROR:',
        error
      );

      setPasswordError(
        error instanceof
          Error
          ? error.message
          : 'Could not change password.'
      );
    } finally {
      setChangingPassword(
        false
      );
    }
  }

  /*
   * =====================================
   * LOADING
   * =====================================
   */

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
          {loadError ||
            'Could not load profile.'}
        </Text>
      </View>
    );
  }

  const initial =
    profile.full_name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'U';

  const accountId =
    role === 'teacher'
      ? profile.teacher_id
      : role === 'student'
        ? profile.student_id
        : null;

  const isPresident =
    role === 'admin';

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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.content
        }
      >
        {/* =================================
            PROFILE HERO
        ================================= */}

        <View
          style={
            styles.hero
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
                  styles.avatarText
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
            {
              ROLE_LABELS[
                role
              ]
            }
          </Text>

          {accountId ? (
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
                {accountId}
              </Text>
            </View>
          ) : null}
        </View>

        {/* =================================
            PROFILE
        ================================= */}

        <Text
          style={
            styles.sectionLabel
          }
        >
          Profile
        </Text>

        <View
          style={
            styles.card
          }
        >
          {isPresident ? (
            <EditableInfoRow
              icon="person-outline"
              title="Name"
              value={
                profile.full_name
              }
              editValue={
                editName
              }
              onChangeText={
                setEditName
              }
              editing={
                editingField ===
                'name'
              }
              saving={
                savingField ===
                'name'
              }
              onEdit={() =>
                startEdit(
                  'name'
                )
              }
              onSave={
                saveProfileField
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />
          ) : (
            <InfoRow
              icon="person-outline"
              title="Name"
              value={
                profile.full_name
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />
          )}

          <Divider
            styles={
              styles
            }
          />

          {isPresident ? (
            <EditableInfoRow
              icon="at-outline"
              title="Username"
              value={
                profile.username
                  ? `@${profile.username}`
                  : 'Not added'
              }
              editValue={
                editUsername
              }
              onChangeText={(
                text
              ) =>
                setEditUsername(
                  text
                    .toLowerCase()
                    .replace(
                      /\s/g,
                      ''
                    )
                )
              }
              editing={
                editingField ===
                'username'
              }
              saving={
                savingField ===
                'username'
              }
              onEdit={() =>
                startEdit(
                  'username'
                )
              }
              onSave={
                saveProfileField
              }
              autoCapitalize="none"
              colors={
                colors
              }
              styles={
                styles
              }
            />
          ) : (
            <InfoRow
              icon="at-outline"
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
          )}

          {/*
           * President intentionally has
           * NO Phone and NO Location.
           */}

          {!isPresident ? (
            <>
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
            </>
          ) : null}
        </View>

        {editError ? (
          <View
            style={
              styles.editMessage
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={16}
              color={
                colors.danger
              }
            />

            <Text
              style={
                styles.editErrorText
              }
            >
              {editError}
            </Text>
          </View>
        ) : null}

        {editSuccess ? (
          <View
            style={
              styles.editMessage
            }
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={16}
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.editSuccessText
              }
            >
              {editSuccess}
            </Text>
          </View>
        ) : null}

        {/* =================================
            SUBJECTS - TEACHER ONLY
        ================================= */}

        {role ===
          'teacher' && (
          <>
            <Text
              style={[
                styles.sectionLabel,
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
                    (
                      subject
                    ) => (
                      <View
                        key={
                          subject
                        }
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
                    styles.emptyText
                  }
                >
                  No subjects assigned
                </Text>
              )}
            </View>
          </>
        )}

        {/* =================================
            SECURITY
        ================================= */}

        <Text
          style={[
            styles.sectionLabel,
            styles.nextSection,
          ]}
        >
          Security
        </Text>

        <View
          style={
            styles.passwordCard
          }
        >
          <View
            style={
              styles.securityHeader
            }
          >
            <View
              style={
                styles.securityIcon
              }
            >
              <Ionicons
                name="key-outline"
                size={20}
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
                Update your sign-in password.
              </Text>
            </View>
          </View>

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
            colors={
              colors
            }
            styles={
              styles
            }
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
            colors={
              colors
            }
            styles={
              styles
            }
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
            colors={
              colors
            }
            styles={
              styles
            }
          />

          {passwordError ? (
            <View
              style={
                styles.message
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

          {passwordSuccess ? (
            <View
              style={
                styles.message
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
                {passwordSuccess}
              </Text>
            </View>
          ) : null}

          <Pressable
            disabled={
              changingPassword
            }
            onPress={
              changePassword
            }
            style={({ pressed }) => [
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

/*
 * =====================================
 * TYPES
 * =====================================
 */

type SharedStyles =
  ReturnType<
    typeof createStyles
  >;

type InfoIcon =
  | 'person-outline'
  | 'at-outline'
  | 'call-outline'
  | 'location-outline';

/*
 * =====================================
 * EDITABLE PRESIDENT ROW
 * =====================================
 */

function EditableInfoRow({
  icon,
  title,
  value,
  editValue,
  onChangeText,
  editing,
  saving,
  onEdit,
  onSave,
  autoCapitalize = 'sentences',
  colors,
  styles,
}: {
  icon:
    | 'person-outline'
    | 'at-outline';

  title: string;

  value: string;

  editValue: string;

  onChangeText: (
    value: string
  ) => void;

  editing: boolean;

  saving: boolean;

  onEdit: () => void;

  onSave: () => void;

  autoCapitalize?:
    | 'none'
    | 'sentences'
    | 'words'
    | 'characters';

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
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
        style={
          styles.editableContent
        }
      >
        <Text
          style={
            styles.infoLabel
          }
        >
          {title}
        </Text>

        {editing ? (
          <TextInput
            value={
              editValue
            }
            onChangeText={
              onChangeText
            }
            autoFocus
            autoCorrect={
              false
            }
            autoCapitalize={
              autoCapitalize
            }
            selectionColor={
              colors.primary
            }
            style={
              styles.inlineInput
            }
            onSubmitEditing={
              onSave
            }
            returnKeyType="done"
          />
        ) : (
          <Text
            style={
              styles.infoValue
            }
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>

      <Pressable
        disabled={saving}
        hitSlop={10}
        onPress={
          editing
            ? onSave
            : onEdit
        }
        style={({
          pressed,
        }) => [
          styles.editButton,

          pressed &&
            styles.editButtonPressed,
        ]}
      >
        {saving ? (
          <ActivityIndicator
            size="small"
            color={
              colors.primary
            }
          />
        ) : (
          <Ionicons
            name={
              editing
                ? 'save-outline'
                : 'create-outline'
            }
            size={18}
            color={
              colors.primary
            }
          />
        )}
      </Pressable>
    </View>
  );
}

/*
 * =====================================
 * NORMAL READ-ONLY ROW
 * =====================================
 */

function InfoRow({
  icon,
  title,
  value,
  colors,
  styles,
}: {
  icon: InfoIcon;

  title: string;

  value: string;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
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
          numberOfLines={1}
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

/*
 * =====================================
 * PASSWORD INPUT
 * =====================================
 */

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggle,
  colors,
  styles,
}: {
  value: string;

  onChangeText: (
    text: string
  ) => void;

  placeholder: string;

  visible: boolean;

  onToggle:
    () => void;

  colors:
    AppThemeColors;

  styles:
    SharedStyles;
}) {
  return (
    <View
      style={
        styles.passwordInput
      }
    >
      <Ionicons
        name="lock-closed-outline"
        size={18}
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
          styles.passwordText
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

/*
 * =====================================
 * STYLES
 * =====================================
 */

function createStyles(
  colors:
    AppThemeColors
) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        colors.background,
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

    content: {
      paddingHorizontal:
        16,

      paddingTop: 14,

      paddingBottom: 130,
    },

    hero: {
      alignItems:
        'center',

      paddingTop: 3,

      paddingBottom: 10,
    },

    avatar: {
      width: 92,
      height: 92,

      borderRadius: 46,

      overflow:
        'hidden',

      alignItems:
        'center',

      justifyContent:
        'center',

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

    avatarText: {
      fontSize: 30,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    name: {
      marginTop: 12,

      fontSize: 20,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    role: {
      marginTop: 2,

      fontSize: 12.5,

      color:
        colors.textMuted,
    },

    idBadge: {
      marginTop: 8,

      paddingHorizontal: 10,

      paddingVertical: 5,

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    idBadgeText: {
      fontSize: 11.5,

      fontWeight:
        '700',

      color:
        colors.primary,
    },

    sectionLabel: {
      marginTop: 15,

      marginBottom: 7,

      marginLeft: 3,

      fontSize: 11.5,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    nextSection: {
      marginTop: 23,
    },

    card: {
      paddingHorizontal: 12,

      borderRadius: 18,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    infoRow: {
      minHeight: 64,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    infoIcon: {
      width: 36,
      height: 36,

      marginRight: 10,

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    infoLabel: {
      fontSize: 10.5,

      color:
        colors.textMuted,
    },

    infoValue: {
      marginTop: 3,

      fontSize: 13.5,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    editableContent: {
      flex: 1,

      minWidth: 0,

      paddingRight: 8,
    },

    inlineInput: {
      height: 31,

      marginTop: 1,

      paddingHorizontal: 0,

      paddingVertical: 0,

      fontSize: 13.5,

      fontWeight:
        '600',

      color:
        colors.text,

      borderBottomWidth:
        1.5,

      borderBottomColor:
        colors.primary,
    },

    editButton: {
      width: 36,
      height: 36,

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    editButtonPressed: {
      opacity: 0.65,
    },

    divider: {
      height: 1,

      marginLeft: 46,

      backgroundColor:
        colors.border,
    },

    editMessage: {
      minHeight: 28,

      marginTop: 7,

      paddingHorizontal: 5,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,
    },

    editErrorText: {
      flex: 1,

      fontSize: 11.5,

      color:
        colors.danger,
    },

    editSuccessText: {
      flex: 1,

      fontSize: 11.5,

      color:
        colors.primary,
    },

    subjectCard: {
      minHeight: 60,

      padding: 14,

      borderRadius: 18,

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

    emptyText: {
      color:
        colors.textMuted,

      fontSize: 13,
    },

    passwordCard: {
      padding: 14,

      borderRadius: 18,

      backgroundColor:
        colors.card,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    securityHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginBottom: 14,
    },

    securityIcon: {
      width: 38,
      height: 38,

      marginRight: 10,

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    passwordTitle: {
      fontSize: 13.5,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    passwordDescription: {
      marginTop: 2,

      fontSize: 11,

      color:
        colors.textMuted,
    },

    passwordInput: {
      height: 50,

      marginBottom: 10,

      paddingHorizontal: 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 14,

      backgroundColor:
        colors.input,

      borderWidth: 1,

      borderColor:
        colors.border,
    },

    passwordText: {
      flex: 1,

      height: '100%',

      marginHorizontal: 10,

      color:
        colors.text,

      fontSize: 13.5,
    },

    message: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,

      marginBottom: 9,
    },

    errorText: {
      flex: 1,

      color:
        colors.danger,

      fontSize: 11.5,
    },

    successText: {
      flex: 1,

      color:
        colors.primary,

      fontSize: 11.5,
    },

    changeButton: {
      height: 49,

      marginTop: 3,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 14,

      backgroundColor:
        colors.primary,
    },

    changeButtonText: {
      color:
        '#FFFFFF',

      fontSize: 13.5,

      fontWeight:
        '700',
    },

    pressed: {
      opacity: 0.78,
    },

    disabled: {
      opacity: 0.6,
    },
  });
}