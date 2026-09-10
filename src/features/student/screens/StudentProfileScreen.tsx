import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Linking,
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

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  supabase,
} from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

/* =========================================================
 * TYPES
 * ======================================================= */

type StudentProfile = {
  id: string;
  user_id: string;
  full_name: string;

  username: string | null;
  student_id: string | null;
  class_id: string | null;
  avatar_url: string | null;
  gender: string | null;
  age: number | null;
  mother_phone: string | null;
  father_phone: string | null;
  location: string | null;
  special_case: string | null;
};

type SchoolClass = {
  id: string;
  class_name: string;
};

type TeacherRpcRow = {
  teacher_user_id: string;
  full_name: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  teacher_id: string | null;
  is_homeroom: boolean | null;
  subjects: string[] | null;
};

type TeacherContact = {
  teacher_user_id: string;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  teacher_id: string | null;
  is_homeroom: boolean;
  subjects: string[];
};

/* =========================================================
 * SCREEN
 * ======================================================= */

export default function StudentProfileScreen() {
  const {
    colors,
    resolvedTheme,
  } = useAppSettings();

  const styles = useMemo(
    () => createStyles(colors),
    [colors],
  );

  const [
    profile,
    setProfile,
  ] = useState<StudentProfile | null>(
    null,
  );

  const [
    schoolClass,
    setSchoolClass,
  ] = useState<SchoolClass | null>(
    null,
  );

  const [
    homeroomTeacher,
    setHomeroomTeacher,
  ] = useState<TeacherContact | null>(
    null,
  );

  const [
    classTeachers,
    setClassTeachers,
  ] = useState<TeacherContact[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState('');

  const [
    callError,
    setCallError,
  ] = useState('');

  /*
   * PASSWORD
   */

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState('');

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showCurrent,
    setShowCurrent,
  ] = useState(false);

  const [
    showNew,
    setShowNew,
  ] = useState(false);

  const [
    showConfirm,
    setShowConfirm,
  ] = useState(false);

  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false);

  const [
    passwordError,
    setPasswordError,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  /* =====================================================
   * LOAD
   * =================================================== */

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    try {
      setLoading(true);
      setLoadError('');
      setCallError('');

      setProfile(null);
      setSchoolClass(null);
      setHomeroomTeacher(null);
      setClassTeachers([]);

      /*
       * AUTH
       */

      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !authData.user
      ) {
        throw (
          authError ??
          new Error(
            'User not found.',
          )
        );
      }

      /*
       * STUDENT PROFILE
       */

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          full_name,
          username,
          student_id,
          class_id,
          avatar_url,
          gender,
          age,
          mother_phone,
          father_phone,
          location,
          special_case
        `)
        .eq(
          'user_id',
          authData.user.id,
        )
        .eq(
          'role',
          'student',
        )
        .single();

      if (
        profileError ||
        !profileData
      ) {
        throw (
          profileError ??
          new Error(
            'Student profile not found.',
          )
        );
      }

      const studentProfile =
        profileData as StudentProfile;

      setProfile(
        studentProfile,
      );

      /*
       * CLASS
       */

      if (
        studentProfile.class_id
      ) {
        const {
          data: classData,
          error: classError,
        } = await supabase
          .from('school_classes')
          .select(`
            id,
            class_name
          `)
          .eq(
            'id',
            studentProfile.class_id,
          )
          .maybeSingle();

        if (
          classError
        ) {
          console.log(
            'LOAD STUDENT CLASS ERROR:',
            classError,
          );

          setSchoolClass(
            null,
          );
        } else {
          setSchoolClass(
            classData as SchoolClass | null,
          );
        }
      }

      /*
       * CLASS TEACHERS
       */

      const {
        data: teacherData,
        error: teacherError,
      } = await supabase.rpc(
        'get_my_class_teachers',
      );

      if (
        teacherError
      ) {
        console.log(
          'LOAD CLASS TEACHERS ERROR:',
          teacherError,
        );

        setHomeroomTeacher(
          null,
        );

        setClassTeachers(
          [],
        );

        return;
      }

      const teacherRows =
        (
          teacherData ??
          []
        ) as TeacherRpcRow[];

      const teachers:
        TeacherContact[] =
        teacherRows.map(
          (
            teacher:
              TeacherRpcRow,
          ): TeacherContact => ({
            teacher_user_id:
              String(
                teacher.teacher_user_id,
              ),

            full_name:
              String(
                teacher.full_name ??
                  'Teacher',
              ),

            phone_number:
              teacher.phone_number
                ? String(
                    teacher.phone_number,
                  )
                : null,

            avatar_url:
              teacher.avatar_url
                ? String(
                    teacher.avatar_url,
                  )
                : null,

            teacher_id:
              teacher.teacher_id
                ? String(
                    teacher.teacher_id,
                  )
                : null,

            is_homeroom:
              Boolean(
                teacher.is_homeroom,
              ),

            subjects:
              Array.isArray(
                teacher.subjects,
              )
                ? teacher.subjects
                    .map(
                      subject =>
                        String(
                          subject,
                        ).trim(),
                    )
                    .filter(
                      Boolean,
                    )
                : [],
          }),
        );

      const homeroom =
        teachers.find(
          (
            teacher:
              TeacherContact,
          ) =>
            teacher.is_homeroom,
        ) ??
        null;

      setHomeroomTeacher(
        homeroom,
      );

      /*
       * Don't repeat homeroom teacher
       * in the smaller grid.
       */

      const others =
        teachers.filter(
          (
            teacher:
              TeacherContact,
          ) =>
            !teacher.is_homeroom,
        );

      setClassTeachers(
        others,
      );
    } catch (
      error
    ) {
      console.log(
        'LOAD STUDENT PROFILE ERROR:',
        error,
      );

      setLoadError(
        error instanceof Error
          ? error.message
          : 'Could not load profile.',
      );
    } finally {
      setLoading(false);
    }
  }

  /* =====================================================
   * PHONE CALL
   * =================================================== */

  async function callTeacher(
    phone:
      string | null,
  ) {
    setCallError('');

    if (
      !phone
    ) {
      setCallError(
        'This teacher does not have a phone number.',
      );

      return;
    }

    /*
     * Keep:
     *
     * +251911234567
     *
     * or:
     *
     * 0911234567
     */

    const cleanPhone =
      phone
        .trim()
        .replace(
          /[^\d+]/g,
          '',
        );

    if (
      !cleanPhone
    ) {
      setCallError(
        'This phone number is invalid.',
      );

      return;
    }

    try {
      /*
       * Don't use canOpenURL here.
       *
       * Some Android devices/emulators
       * return false even though the
       * phone intent can be opened.
       */

      await Linking.openURL(
        `tel:${cleanPhone}`,
      );
    } catch (
      error
    ) {
      console.log(
        'CALL TEACHER ERROR:',
        error,
      );

      setCallError(
        'Could not open the phone app on this device.',
      );
    }
  }

  /* =====================================================
   * CHANGE PASSWORD
   * =================================================== */

  async function changePassword() {
    if (
      changingPassword
    ) {
      return;
    }

    setPasswordError('');
    setSuccessMessage('');

    if (
      !currentPassword
    ) {
      setPasswordError(
        'Current password is required.',
      );

      return;
    }

    if (
      !newPassword
    ) {
      setPasswordError(
        'New password is required.',
      );

      return;
    }

    if (
      newPassword.length < 8
    ) {
      setPasswordError(
        'Use at least 8 characters.',
      );

      return;
    }

    if (
      newPassword ===
      currentPassword
    ) {
      setPasswordError(
        'Choose a different password.',
      );

      return;
    }

    if (
      !confirmPassword
    ) {
      setPasswordError(
        'Confirm your new password.',
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordError(
        'Passwords do not match.',
      );

      return;
    }

    try {
      setChangingPassword(
        true,
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
            'User not found.',
          )
        );
      }

      const email =
        authData.user.email;

      if (
        !email
      ) {
        throw new Error(
          'Account email is unavailable.',
        );
      }

      /*
       * Confirm old password.
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
          'Current password is incorrect.',
        );

        return;
      }

      /*
       * Change password.
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

      if (
        updateError
      ) {
        throw updateError;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);

      setSuccessMessage(
        'Password changed successfully.',
      );
    } catch (
      error
    ) {
      console.log(
        'CHANGE STUDENT PASSWORD ERROR:',
        error,
      );

      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Could not change password.',
      );
    } finally {
      setChangingPassword(
        false,
      );
    }
  }

  /* =====================================================
   * LOADING
   * =================================================== */

  if (
    loading
  ) {
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

          <Text
            style={
              styles.loadingText
            }
          >
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* =====================================================
   * ERROR
   * =================================================== */

  if (
    !profile
  ) {
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
          <View
            style={
              styles.bigErrorIcon
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={30}
              color={
                colors.danger
              }
            />
          </View>

          <Text
            style={
              styles.loadErrorTitle
            }
          >
            Could not load profile
          </Text>

          <Text
            style={
              styles.loadErrorText
            }
          >
            {loadError ||
              'Please try again.'}
          </Text>

          <Pressable
            onPress={() =>
              void loadProfile()
            }
            style={({
              pressed,
            }) => [
              styles.retryButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="refresh-outline"
              size={18}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.retryButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* =====================================================
   * DISPLAY VALUES
   * =================================================== */

  const initial =
    profile.full_name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'S';

  const ageText =
    profile.age !== null &&
    profile.age !== undefined
      ? `${profile.age} years`
      : 'Not added';

  const genderText =
    profile.gender
      ? profile.gender
          .charAt(0)
          .toUpperCase() +
        profile.gender
          .slice(1)
          .toLowerCase()
      : 'Not added';

  /* =====================================================
   * MAIN
   * =================================================== */

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
        {/* ================================================= */}
        {/* PROFILE */}
        {/* ================================================= */}

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
            Student
          </Text>

          <View
            style={
              styles.idBadge
            }
          >
            <Ionicons
              name="school-outline"
              size={15}
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.idBadgeText
              }
            >
              {profile.student_id ??
                'No Student ID'}
            </Text>
          </View>
        </View>

        {/* ================================================= */}
        {/* SCHOOL */}
        {/* ================================================= */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          School
        </Text>

        <View
          style={
            styles.card
          }
        >
          <InfoRow
            icon="school-outline"
            title="Class"
            value={
              schoolClass
                ?.class_name ??
              'Not assigned'
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
            icon="card-outline"
            title="Student ID"
            value={
              profile.student_id ??
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

        {/* ================================================= */}
        {/* HOMEROOM */}
        {/* ================================================= */}

        <Text
          style={[
            styles.sectionTitle,
            styles.nextSection,
          ]}
        >
          Homeroom Teacher
        </Text>

        {homeroomTeacher ? (
          <View
            style={
              styles.homeroomCard
            }
          >
            <TeacherAvatar
              teacher={
                homeroomTeacher
              }
              large
              styles={
                styles
              }
            />

            <View
              style={
                styles.homeroomInfo
              }
            >
              <View
                style={
                  styles.homeroomBadge
                }
              >
                <Ionicons
                  name="star"
                  size={10}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={
                    styles.homeroomBadgeText
                  }
                >
                  Homeroom
                </Text>
              </View>

              <Text
                style={
                  styles.homeroomName
                }
                numberOfLines={2}
              >
                {
                  homeroomTeacher.full_name
                }
              </Text>

              {homeroomTeacher
                .subjects.length >
              0 ? (
                <View
                  style={
                    styles.homeroomSubjects
                  }
                >
                  <Ionicons
                    name="book-outline"
                    size={13}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={
                      styles.homeroomSubjectText
                    }
                    numberOfLines={2}
                  >
                    {homeroomTeacher
                      .subjects
                      .join(', ')}
                  </Text>
                </View>
              ) : null}

              <View
                style={
                  styles.phoneLine
                }
              >
                <Ionicons
                  name="call-outline"
                  size={15}
                  color={
                    homeroomTeacher.phone_number
                      ? colors.primary
                      : colors.textMuted
                  }
                />

                <Text
                  style={
                    styles.homeroomPhone
                  }
                >
                  {homeroomTeacher.phone_number ??
                    'No phone number'}
                </Text>
              </View>
            </View>

            {homeroomTeacher.phone_number ? (
              <Pressable
                onPress={() =>
                  void callTeacher(
                    homeroomTeacher.phone_number,
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.callButton,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Ionicons
                  name="call"
                  size={19}
                  color="#FFFFFF"
                />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View
            style={
              styles.emptyTeacherCard
            }
          >
            <View
              style={
                styles.emptyTeacherIcon
              }
            >
              <Ionicons
                name="person-outline"
                size={22}
                color={
                  colors.textMuted
                }
              />
            </View>

            <View
              style={
                styles.emptyTeacherContent
              }
            >
              <Text
                style={
                  styles.emptyTeacherTitle
                }
              >
                No homeroom teacher
              </Text>

              <Text
                style={
                  styles.emptyTeacherText
                }
              >
                A homeroom teacher has not been assigned yet.
              </Text>
            </View>
          </View>
        )}

        {/* CALL ERROR */}

        {callError ? (
          <View
            style={
              styles.callErrorCard
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color={
                colors.danger
              }
            />

            <Text
              style={
                styles.callErrorText
              }
            >
              {callError}
            </Text>

            <Pressable
              onPress={() =>
                setCallError('')
              }
              hitSlop={10}
            >
              <Ionicons
                name="close"
                size={18}
                color={
                  colors.danger
                }
              />
            </Pressable>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* CLASS TEACHERS */}
        {/* ================================================= */}

        <View
          style={
            styles.teacherSectionHeader
          }
        >
          <Text
            style={[
              styles.sectionTitle,
              styles.teacherSectionTitle,
            ]}
          >
            Class Teachers
          </Text>

          {classTeachers.length >
          0 ? (
            <View
              style={
                styles.teacherCountBadge
              }
            >
              <Text
                style={
                  styles.teacherCountText
                }
              >
                {
                  classTeachers.length
                }
              </Text>
            </View>
          ) : null}
        </View>

        {classTeachers.length >
        0 ? (
          <View
            style={
              styles.teacherGrid
            }
          >
            {classTeachers.map(
              (
                teacher:
                  TeacherContact,
              ) => (
                <View
                  key={
                    teacher.teacher_user_id
                  }
                  style={
                    styles.teacherGridCard
                  }
                >
                  <TeacherAvatar
                    teacher={
                      teacher
                    }
                    styles={
                      styles
                    }
                  />

                  <Text
                    style={
                      styles.teacherGridName
                    }
                    numberOfLines={2}
                  >
                    {
                      teacher.full_name
                    }
                  </Text>

                  {/* SUBJECTS */}

                  {teacher
                    .subjects
                    .length >
                  0 ? (
                    <View
                      style={
                        styles.subjectArea
                      }
                    >
                      {teacher
                        .subjects
                        .map(
                          (
                            subject:
                              string,
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
                                  styles.subjectChipText
                                }
                                numberOfLines={1}
                              >
                                {
                                  subject
                                }
                              </Text>
                            </View>
                          ),
                        )}
                    </View>
                  ) : (
                    <Text
                      style={
                        styles.noSubjectText
                      }
                    >
                      No subject assigned
                    </Text>
                  )}

                  {/* PHONE */}

                  <View
                    style={
                      styles.teacherGridPhoneRow
                    }
                  >
                    <Ionicons
                      name="call-outline"
                      size={14}
                      color={
                        teacher.phone_number
                          ? colors.primary
                          : colors.textMuted
                      }
                    />

                    <Text
                      style={[
                        styles.teacherGridPhone,

                        !teacher.phone_number &&
                          styles.teacherGridPhoneMissing,
                      ]}
                      numberOfLines={1}
                    >
                      {teacher.phone_number ??
                        'No phone'}
                    </Text>
                  </View>

                  {/* CALL BUTTON */}

                  {teacher.phone_number ? (
                    <Pressable
                      onPress={() =>
                        void callTeacher(
                          teacher.phone_number,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.teacherCallButton,

                        pressed &&
                          styles.pressed,
                      ]}
                    >
                      <Ionicons
                        name="call"
                        size={14}
                        color={
                          colors.primary
                        }
                      />

                      <Text
                        style={
                          styles.teacherCallButtonText
                        }
                      >
                        Call
                      </Text>
                    </Pressable>
                  ) : (
                    <View
                      style={
                        styles.noCallButton
                      }
                    >
                      <Text
                        style={
                          styles.noCallButtonText
                        }
                      >
                        No phone
                      </Text>
                    </View>
                  )}
                </View>
              ),
            )}
          </View>
        ) : (
          <View
            style={
              styles.emptyTeacherCard
            }
          >
            <View
              style={
                styles.emptyTeacherIcon
              }
            >
              <Ionicons
                name="people-outline"
                size={22}
                color={
                  colors.textMuted
                }
              />
            </View>

            <View
              style={
                styles.emptyTeacherContent
              }
            >
              <Text
                style={
                  styles.emptyTeacherTitle
                }
              >
                No class teachers
              </Text>

              <Text
                style={
                  styles.emptyTeacherText
                }
              >
                No other teachers are assigned to this class yet.
              </Text>
            </View>
          </View>
        )}

        {/* ================================================= */}
        {/* PERSONAL */}
        {/* ================================================= */}

        <Text
          style={[
            styles.sectionTitle,
            styles.nextSection,
          ]}
        >
          Personal Information
        </Text>

        <View
          style={
            styles.card
          }
        >
          {profile.username ? (
            <>
              <InfoRow
                icon="person-outline"
                title="Username"
                value={`@${profile.username}`}
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
            </>
          ) : null}

          <InfoRow
            icon="calendar-outline"
            title="Age"
            value={
              ageText
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
            icon="person-circle-outline"
            title="Gender"
            value={
              genderText
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

        {/* ================================================= */}
        {/* PARENTS */}
        {/* ================================================= */}

        <Text
          style={[
            styles.sectionTitle,
            styles.nextSection,
          ]}
        >
          Parent Information
        </Text>

        <View
          style={
            styles.card
          }
        >
          <InfoRow
            icon="woman-outline"
            title="Mother's Phone"
            value={
              profile.mother_phone ??
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
            icon="man-outline"
            title="Father's Phone"
            value={
              profile.father_phone ??
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

        {/* ================================================= */}
        {/* SPECIAL CASE */}
        {/* ================================================= */}

        {profile.special_case ? (
          <>
            <Text
              style={[
                styles.sectionTitle,
                styles.nextSection,
              ]}
            >
              Additional Information
            </Text>

            <View
              style={
                styles.specialCard
              }
            >
              <View
                style={
                  styles.specialIcon
                }
              >
                <Ionicons
                  name="information-circle-outline"
                  size={22}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.specialTextArea
                }
              >
                <Text
                  style={
                    styles.specialTitle
                  }
                >
                  Special Case
                </Text>

                <Text
                  style={
                    styles.specialText
                  }
                >
                  {
                    profile.special_case
                  }
                </Text>
              </View>
            </View>
          </>
        ) : null}

        {/* ================================================= */}
        {/* PASSWORD */}
        {/* ================================================= */}

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
          <View
            style={
              styles.passwordHeader
            }
          >
            <View
              style={
                styles.passwordHeaderIcon
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={22}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.passwordHeaderText
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
                current =>
                  !current,
              )
            }
            styles={
              styles
            }
            colors={
              colors
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
                current =>
                  !current,
              )
            }
            styles={
              styles
            }
            colors={
              colors
            }
          />

          <PasswordInput
            value={
              confirmPassword
            }
            onChangeText={
              setConfirmPassword
            }
            placeholder="Confirm new password"
            visible={
              showConfirm
            }
            onToggle={() =>
              setShowConfirm(
                current =>
                  !current,
              )
            }
            styles={
              styles
            }
            colors={
              colors
            }
          />

          {passwordError ? (
            <View
              style={[
                styles.messageRow,
                styles.errorMessage,
              ]}
            >
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={
                  colors.danger
                }
              />

              <Text
                style={
                  styles.errorText
                }
              >
                {
                  passwordError
                }
              </Text>
            </View>
          ) : null}

          {successMessage ? (
            <View
              style={[
                styles.messageRow,
                styles.successMessage,
              ]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.successText
                }
              >
                {
                  successMessage
                }
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={() =>
              void changePassword()
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
              <>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.changeButtonText
                  }
                >
                  Change Password
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
 * SHARED TYPES
 * ======================================================= */

type SharedStyles =
  ReturnType<
    typeof createStyles
  >;

type InfoIcon =
  | 'person-outline'
  | 'school-outline'
  | 'card-outline'
  | 'calendar-outline'
  | 'person-circle-outline'
  | 'location-outline'
  | 'woman-outline'
  | 'man-outline';

/* =========================================================
 * TEACHER AVATAR
 * ======================================================= */

function TeacherAvatar({
  teacher,
  large = false,
  styles,
}: {
  teacher:
    TeacherContact;

  large?:
    boolean;

  styles:
    SharedStyles;
}) {
  const initial =
    teacher.full_name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'T';

  return (
    <View
      style={[
        styles.teacherAvatar,

        large &&
          styles.teacherAvatarLarge,
      ]}
    >
      {teacher.avatar_url ? (
        <Image
          source={{
            uri:
              teacher.avatar_url,
          }}
          style={
            styles.teacherAvatarImage
          }
        />
      ) : (
        <Text
          style={[
            styles.teacherAvatarInitial,

            large &&
              styles.teacherAvatarInitialLarge,
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

/* =========================================================
 * INFO ROW
 * ======================================================= */

function InfoRow({
  icon,
  title,
  value,
  colors,
  styles,
}: {
  icon:
    InfoIcon;

  title:
    string;

  value:
    string;

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
          name={
            icon
          }
          size={20}
          color={
            colors.primary
          }
        />
      </View>

      <View
        style={
          styles.infoTextArea
        }
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
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
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
 * PASSWORD INPUT
 * ======================================================= */

function PasswordInput({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggle,
  styles,
  colors,
}: {
  value:
    string;

  onChangeText:
    (
      text:
        string,
    ) => void;

  placeholder:
    string;

  visible:
    boolean;

  onToggle:
    () => void;

  styles:
    SharedStyles;

  colors:
    AppThemeColors;
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
        value={
          value
        }
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
        autoCorrect={
          false
        }
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
          size={21}
          color={
            colors.textMuted
          }
        />
      </Pressable>
    </View>
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
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 125,
    },

    loading: {
      flex: 1,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.background,
    },

    loadingText: {
      marginTop: 12,
      fontSize: 14,
      fontWeight: '600',
      color:
        colors.textMuted,
    },

    /* PROFILE */

    profileHero: {
      alignItems: 'center',
      paddingTop: 8,
      paddingBottom: 16,
    },

    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor:
        colors.primarySoft,
      borderWidth: 4,
      borderColor:
        colors.card,

      shadowColor: '#000000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 3,
    },

    avatarImage: {
      width: '100%',
      height: '100%',
    },

    avatarInitial: {
      fontSize: 34,
      fontWeight: '800',
      color:
        colors.primary,
    },

    name: {
      marginTop: 14,
      paddingHorizontal: 20,
      textAlign: 'center',
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '800',
      color:
        colors.text,
    },

    role: {
      marginTop: 3,
      fontSize: 14,
      fontWeight: '600',
      color:
        colors.textMuted,
    },

    idBadge: {
      marginTop: 11,
      minHeight: 34,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 11,
      backgroundColor:
        colors.primarySoft,
    },

    idBadgeText: {
      fontSize: 12,
      fontWeight: '800',
      color:
        colors.primary,
    },

    /* SECTION */

    sectionTitle: {
      marginTop: 17,
      marginBottom: 9,
      marginLeft: 3,
      fontSize: 13,
      fontWeight: '800',
      color:
        colors.textMuted,
    },

    nextSection: {
      marginTop: 25,
    },

    card: {
      overflow: 'hidden',
      paddingHorizontal: 14,
      borderRadius: 20,
      backgroundColor:
        colors.card,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    /* INFO */

    infoRow: {
      minHeight: 70,
      flexDirection: 'row',
      alignItems: 'center',
    },

    infoIcon: {
      width: 40,
      height: 40,
      marginRight: 12,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.primarySoft,
    },

    infoTextArea: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
    },

    infoLabel: {
      fontSize: 11,
      fontWeight: '600',
      color:
        colors.textMuted,
    },

    infoValue: {
      marginTop: 3,
      fontSize: 14,
      lineHeight: 19,
      fontWeight: '700',
      color:
        colors.text,
    },

    divider: {
      height: 1,
      marginLeft: 52,
      backgroundColor:
        colors.border,
    },

    /* HOMEROOM */

    homeroomCard: {
      minHeight: 110,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.card,
    },

    teacherAvatar: {
      width: 48,
      height: 48,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      backgroundColor:
        colors.primarySoft,
    },

    teacherAvatarLarge: {
      width: 60,
      height: 60,
      borderRadius: 30,
    },

    teacherAvatarImage: {
      width: '100%',
      height: '100%',
    },

    teacherAvatarInitial: {
      fontSize: 17,
      fontWeight: '800',
      color:
        colors.primary,
    },

    teacherAvatarInitialLarge: {
      fontSize: 21,
    },

    homeroomInfo: {
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
    },

    homeroomBadge: {
      alignSelf: 'flex-start',
      minHeight: 23,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: 8,
      backgroundColor:
        colors.primarySoft,
    },

    homeroomBadgeText: {
      fontSize: 9,
      fontWeight: '800',
      color:
        colors.primary,
    },

    homeroomName: {
      marginTop: 6,
      fontSize: 15,
      lineHeight: 20,
      fontWeight: '800',
      color:
        colors.text,
    },

    homeroomSubjects: {
      marginTop: 5,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 5,
    },

    homeroomSubjectText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: '700',
      color:
        colors.primary,
    },

    phoneLine: {
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },

    homeroomPhone: {
      flex: 1,
      fontSize: 12,
      fontWeight: '700',
      color:
        colors.textMuted,
    },

    callButton: {
      width: 46,
      height: 46,
      marginLeft: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 15,
      backgroundColor:
        colors.primary,
    },

    /* CALL ERROR */

    callErrorCard: {
      minHeight: 46,
      marginTop: 9,
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor:
        '#FFF0F1',
    },

    callErrorText: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '700',
      color:
        colors.danger,
    },

    /* CLASS TEACHERS */

    teacherSectionHeader: {
      marginTop: 25,
      marginBottom: 9,
      paddingHorizontal: 3,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent:
        'space-between',
    },

    teacherSectionTitle: {
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 0,
    },

    teacherCountBadge: {
      minWidth: 30,
      height: 30,
      paddingHorizontal: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor:
        colors.primarySoft,
    },

    teacherCountText: {
      fontSize: 11,
      fontWeight: '800',
      color:
        colors.primary,
    },

    teacherGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent:
        'space-between',
      rowGap: 10,
    },

    teacherGridCard: {
      width: '48.5%',
      minHeight: 205,
      paddingHorizontal: 10,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.card,
    },

    teacherGridName: {
      minHeight: 38,
      marginTop: 9,
      textAlign: 'center',
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800',
      color:
        colors.text,
    },

    /* SUBJECTS */

    subjectArea: {
      width: '100%',
      minHeight: 31,
      marginTop: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 4,
    },

    subjectChip: {
      minHeight: 24,
      maxWidth: '100%',
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 8,
      justifyContent: 'center',
      backgroundColor:
        colors.primarySoft,
    },

    subjectChipText: {
      maxWidth: 120,
      fontSize: 9.5,
      fontWeight: '800',
      color:
        colors.primary,
    },

    noSubjectText: {
      minHeight: 31,
      marginTop: 6,
      fontSize: 9.5,
      lineHeight: 14,
      textAlign: 'center',
      fontWeight: '600',
      color:
        colors.textMuted,
    },

    /* TEACHER PHONE */

    teacherGridPhoneRow: {
      marginTop: 7,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      maxWidth: '100%',
    },

    teacherGridPhone: {
      flexShrink: 1,
      fontSize: 10.5,
      fontWeight: '700',
      color:
        colors.primary,
    },

    teacherGridPhoneMissing: {
      color:
        colors.textMuted,
    },

    teacherCallButton: {
      minWidth: 78,
      height: 33,
      marginTop: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      borderRadius: 10,
      backgroundColor:
        colors.primarySoft,
    },

    teacherCallButtonText: {
      fontSize: 10,
      fontWeight: '800',
      color:
        colors.primary,
    },

    noCallButton: {
      minWidth: 78,
      height: 33,
      marginTop: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor:
        colors.surfaceSecondary,
    },

    noCallButtonText: {
      fontSize: 9.5,
      fontWeight: '700',
      color:
        colors.textMuted,
    },

    /* EMPTY TEACHER */

    emptyTeacherCard: {
      minHeight: 84,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.card,
    },

    emptyTeacherIcon: {
      width: 42,
      height: 42,
      marginRight: 11,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor:
        colors.surfaceSecondary,
    },

    emptyTeacherContent: {
      flex: 1,
    },

    emptyTeacherTitle: {
      fontSize: 13,
      fontWeight: '800',
      color:
        colors.text,
    },

    emptyTeacherText: {
      marginTop: 3,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: '500',
      color:
        colors.textMuted,
    },

    /* SPECIAL */

    specialCard: {
      minHeight: 82,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderRadius: 20,
      borderWidth: 1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.card,
    },

    specialIcon: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor:
        colors.primarySoft,
    },

    specialTextArea: {
      flex: 1,
      marginLeft: 11,
      paddingTop: 2,
    },

    specialTitle: {
      fontSize: 13,
      fontWeight: '800',
      color:
        colors.text,
    },

    specialText: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: '500',
      color:
        colors.textMuted,
    },

    /* PASSWORD */

    passwordCard: {
      padding: 16,
      borderRadius: 20,
      backgroundColor:
        colors.card,
      borderWidth: 1,
      borderColor:
        colors.border,
    },

    passwordHeader: {
      marginBottom: 17,
      flexDirection: 'row',
      alignItems: 'center',
    },

    passwordHeaderIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 13,
      backgroundColor:
        colors.primarySoft,
    },

    passwordHeaderText: {
      flex: 1,
      marginLeft: 11,
    },

    passwordTitle: {
      fontSize: 15,
      fontWeight: '800',
      color:
        colors.text,
    },

    passwordDescription: {
      marginTop: 3,
      fontSize: 12,
      lineHeight: 17,
      color:
        colors.textMuted,
    },

    passwordInput: {
      height: 54,
      marginBottom: 12,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
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
      fontWeight: '600',
      color:
        colors.text,
    },

    messageRow: {
      minHeight: 42,
      marginBottom: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 11,
    },

    errorMessage: {
      backgroundColor:
        '#FFF0F1',
    },

    successMessage: {
      backgroundColor:
        colors.primarySoft,
    },

    errorText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      color:
        colors.danger,
    },

    successText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: '600',
      color:
        colors.primary,
    },

    changeButton: {
      height: 53,
      marginTop: 5,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        colors.primary,
    },

    changeButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },

    /* LOAD ERROR */

    bigErrorIcon: {
      width: 58,
      height: 58,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor:
        '#FFF0F1',
    },

    loadErrorTitle: {
      marginTop: 12,
      fontSize: 17,
      fontWeight: '800',
      color:
        colors.text,
    },

    loadErrorText: {
      marginTop: 5,
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 18,
      color:
        colors.textMuted,
    },

    retryButton: {
      height: 46,
      marginTop: 16,
      paddingHorizontal: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: 14,
      backgroundColor:
        colors.primary,
    },

    retryButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
    },

    pressed: {
      opacity: 0.75,
    },

    disabled: {
      opacity: 0.6,
    },
  });
}