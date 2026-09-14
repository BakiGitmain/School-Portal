import Ionicons from '@expo/vector-icons/Ionicons';

import {
  router,
  useFocusEffect,
  type Href,
} from 'expo-router';

import React, {
  useCallback,
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
  useWindowDimensions,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

import {
  supabase,
} from '../../../lib/supabase';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type ClassCategory =
  | 'elementary'
  | 'high_school';

type SchoolClass = {
  id: string;

  category:
    ClassCategory;

  grade_label: string;

  section: string;

  class_name: string;

  homeroom_teacher_user_id:
    | string
    | null;

  created_at: string;
};

type Teacher = {
  user_id: string;

  full_name: string;

  teacher_id:
    | string
    | null;

  avatar_url:
    | string
    | null;

  subjects:
    | string[]
    | null;
};

type Student = {
  id: string;

  user_id: string;

  full_name: string;

  first_name: string;

  last_name: string;

  student_id:
    | string
    | null;

  avatar_url:
    | string
    | null;

  gender:
    | 'male'
    | 'female'
    | null;

  age:
    | number
    | null;

  mother_phone:
    | string
    | null;

  father_phone:
    | string
    | null;

  location:
    | string
    | null;

  special_case:
    | string
    | null;
};

type Props = {
  classId: string;
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getInitials(
  name: string,
) {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(
        Boolean,
      );

  if (
    parts.length ===
    0
  ) {
    return '?';
  }

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2,
      )
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
}

function generatedAvatar(
  name: string,
) {
  return (
    'https://api.dicebear.com/9.x/personas/png?seed=' +
    encodeURIComponent(
      name ||
        'Student',
    )
  );
}

function getCategoryLabel(
  category:
    ClassCategory,
) {
  return category ===
    'elementary'
    ? 'Elementary'
    : 'High School';
}

function getGradeLabel(
  grade: string,
) {
  if (
    grade ===
      'Nursery' ||
    grade ===
      'LKG' ||
    grade ===
      'UKG'
  ) {
    return grade;
  }

  return `Grade ${grade}`;
}

function getErrorMessage(
  error: unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      'object'
  ) {
    const value =
      error as {
        message?:
          string;

        details?:
          string;

        hint?:
          string;
      };

    return (
      value.message ??
      value.details ??
      value.hint ??
      'Something went wrong.'
    );
  }

  if (
    typeof error ===
    'string'
  ) {
    return error;
  }

  return 'Something went wrong.';
}

/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ClassDetailsScreen({
  classId,
}: Props) {
  const {
    colors,
  } =
    useAppSettings();

  /*
   * =====================================================
   * RESPONSIVE SCREEN SIZE
   * =====================================================
   */

  const {
    width:
      screenWidth,
  } =
    useWindowDimensions();

  const styles =
    useMemo(
      () =>
        createStyles(
          colors,
          screenWidth,
        ),
      [
        colors,
        screenWidth,
      ],
    );

  /*
   * =====================================================
   * STATE
   * =====================================================
   */

  const [
    schoolClass,
    setSchoolClass,
  ] =
    useState<
      SchoolClass |
      null
    >(
      null,
    );

  const [
    homeroomTeacher,
    setHomeroomTeacher,
  ] =
    useState<
      Teacher |
      null
    >(
      null,
    );

  const [
    students,
    setStudents,
  ] =
    useState<
      Student[]
    >([]);

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  /*
   * =====================================================
   * LOAD CLASS
   * =====================================================
   */

  const loadClass =
    useCallback(
      async () => {
        if (
          !classId
        ) {
          setError(
            'Class ID was not provided.',
          );

          setLoading(
            false,
          );

          return;
        }

        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          /*
           * =============================================
           * CLASS
           * =============================================
           */

          const {
            data:
              classData,
            error:
              classError,
          } =
            await supabase
              .from(
                'school_classes',
              )
              .select(`
                id,
                category,
                grade_label,
                section,
                class_name,
                homeroom_teacher_user_id,
                created_at
              `)
              .eq(
                'id',
                classId,
              )
              .single();

          if (
            classError ||
            !classData
          ) {
            throw (
              classError ??
              new Error(
                'Class not found.',
              )
            );
          }

          const classRow:
            SchoolClass = {
            id:
              String(
                classData.id,
              ),

            category:
              classData.category as
                ClassCategory,

            grade_label:
              String(
                classData.grade_label,
              ),

            section:
              String(
                classData.section,
              ),

            class_name:
              String(
                classData.class_name,
              ),

            homeroom_teacher_user_id:
              classData.homeroom_teacher_user_id
                ? String(
                    classData.homeroom_teacher_user_id,
                  )
                : null,

            created_at:
              String(
                classData.created_at,
              ),
          };

          setSchoolClass(
            classRow,
          );

          /*
           * =============================================
           * STUDENTS
           * =============================================
           */

          const {
            data:
              studentData,
            error:
              studentError,
          } =
            await supabase
              .from(
                'profiles',
              )
              .select(`
                id,
                user_id,
                full_name,
                first_name,
                last_name,
                student_id,
                avatar_url,
                gender,
                age,
                mother_phone,
                father_phone,
                location,
                special_case
              `)
              .eq(
                'role',
                'student',
              )
              .eq(
                'class_id',
                classId,
              )
              .order(
                'first_name',
                {
                  ascending:
                    true,
                },
              )
              .order(
                'last_name',
                {
                  ascending:
                    true,
                },
              );

          if (
            studentError
          ) {
            throw studentError;
          }

          const studentRows:
            Student[] =
            (
              studentData ??
              []
            ).map(
              (
                student,
              ) => ({
                id:
                  String(
                    student.id,
                  ),

                user_id:
                  String(
                    student.user_id,
                  ),

                full_name:
                  String(
                    student.full_name ??
                      '',
                  ),

                first_name:
                  String(
                    student.first_name ??
                      '',
                  ),

                last_name:
                  String(
                    student.last_name ??
                      '',
                  ),

                student_id:
                  student.student_id
                    ? String(
                        student.student_id,
                      )
                    : null,

                avatar_url:
                  student.avatar_url
                    ? String(
                        student.avatar_url,
                      )
                    : null,

                gender:
                  student.gender as
                    Student['gender'],

                age:
                  student.age ===
                    null ||
                  student.age ===
                    undefined
                    ? null
                    : Number(
                        student.age,
                      ),

                mother_phone:
                  student.mother_phone
                    ? String(
                        student.mother_phone,
                      )
                    : null,

                father_phone:
                  student.father_phone
                    ? String(
                        student.father_phone,
                      )
                    : null,

                location:
                  student.location
                    ? String(
                        student.location,
                      )
                    : null,

                special_case:
                  student.special_case
                    ? String(
                        student.special_case,
                      )
                    : null,
              }),
            );

          setStudents(
            studentRows,
          );

          /*
           * =============================================
           * HOMEROOM TEACHER
           * =============================================
           */

          if (
            !classRow
              .homeroom_teacher_user_id
          ) {
            setHomeroomTeacher(
              null,
            );

            return;
          }

          const {
            data:
              teacherData,
            error:
              teacherError,
          } =
            await supabase
              .from(
                'profiles',
              )
              .select(`
                user_id,
                full_name,
                teacher_id,
                avatar_url,
                subjects
              `)
              .eq(
                'user_id',
                classRow
                  .homeroom_teacher_user_id,
              )
              .eq(
                'role',
                'teacher',
              )
              .maybeSingle();

          if (
            teacherError
          ) {
            console.log(
              'CLASS TEACHER ERROR:',
              teacherError,
            );

            setHomeroomTeacher(
              null,
            );

            return;
          }

          if (
            !teacherData
          ) {
            setHomeroomTeacher(
              null,
            );

            return;
          }

          setHomeroomTeacher({
            user_id:
              String(
                teacherData.user_id,
              ),

            full_name:
              String(
                teacherData.full_name ??
                  '',
              ),

            teacher_id:
              teacherData.teacher_id
                ? String(
                    teacherData.teacher_id,
                  )
                : null,

            avatar_url:
              teacherData.avatar_url
                ? String(
                    teacherData.avatar_url,
                  )
                : null,

            subjects:
              Array.isArray(
                teacherData.subjects,
              )
                ? teacherData.subjects
                : null,
          });
        } catch (
          loadError
        ) {
          console.log(
            'CLASS DETAILS ERROR:',
            loadError,
          );

          setError(
            getErrorMessage(
              loadError,
            ),
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        classId,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadClass();
      },
      [
        loadClass,
      ],
    ),
  );

  /*
   * =====================================================
   * SEARCH
   * =====================================================
   */

  const filteredStudents =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (
          !query
        ) {
          return students;
        }

        return students.filter(
          (
            student,
          ) => {
            const text =
              [
                student.first_name,

                student.last_name,

                student.full_name,

                student.student_id ??
                  '',
              ]
                .join(
                  ' ',
                )
                .toLowerCase();

            return text.includes(
              query,
            );
          },
        );
      },
      [
        search,
        students,
      ],
    );

  /*
   * =====================================================
   * NAVIGATION
   * =====================================================
   */

  function goBack() {
    router.replace(
      '/admin/classes' as Href,
    );
  }

  function openStudent(
    student:
      Student,
  ) {
    router.push({
      pathname:
        '/admin/student/[id]',

      params: {
        id:
          student.user_id,
      },
    });
  }

  /*
   * =====================================================
   * TEACHER AVATAR
   * =====================================================
   */

  function renderTeacherAvatar() {
    if (
      homeroomTeacher
        ?.avatar_url
    ) {
      return (
        <Image
          source={{
            uri:
              homeroomTeacher.avatar_url,
          }}
          resizeMode="cover"
          style={
            styles.teacherAvatar
          }
        />
      );
    }

    return (
      <View
        style={[
          styles.teacherAvatarFallback,

          {
            backgroundColor:
              colors.primarySoft,
          },
        ]}
      >
        {homeroomTeacher ? (
          <Text
            style={[
              styles.teacherInitials,

              {
                color:
                  colors.primary,
              },
            ]}
          >
            {getInitials(
              homeroomTeacher.full_name,
            )}
          </Text>
        ) : (
          <Ionicons
            name="person-outline"
            size={21}
            color={
              colors.textMuted
            }
          />
        )}
      </View>
    );
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={[
          styles.centerScreen,

          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <ActivityIndicator
          size="small"
          color={
            colors.primary
          }
        />

        <Text
          style={[
            styles.loadingText,

            {
              color:
                colors.textMuted,
            },
          ]}
        >
          Loading class...
        </Text>
      </SafeAreaView>
    );
  }

  /*
   * =====================================================
   * ERROR
   * =====================================================
   */

  if (
    error ||
    !schoolClass
  ) {
    return (
      <SafeAreaView
        style={[
          styles.screen,

          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <View
          style={
            styles.errorContainer
          }
        >
          <View
            style={[
              styles.errorIcon,

              {
                backgroundColor:
                  colors.primarySoft,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={28}
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={[
              styles.errorTitle,

              {
                color:
                  colors.text,
              },
            ]}
          >
            Unable to open class
          </Text>

          <Text
            style={[
              styles.errorText,

              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {error ??
              'The class could not be found.'}
          </Text>

          <Pressable
            onPress={
              goBack
            }
            style={[
              styles.backToClassesButton,

              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          >
            <Text
              style={
                styles.backToClassesText
              }
            >
              Back to Classes
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * =====================================================
   * SCREEN
   * =====================================================
   */

  return (
    <SafeAreaView
      edges={[
        'top',
        'left',
        'right',
      ]}
      style={[
        styles.screen,

        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.content
        }
      >
        {/* ============================================= */}
        {/* BACK */}
        {/* ============================================= */}

        <Pressable
          onPress={
            goBack
          }
          hitSlop={
            10
          }
          style={({
            pressed,
          }) => [
            styles.backButton,

            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,

              opacity:
                pressed
                  ? 0.7
                  : 1,
            },
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={20}
            color={
              colors.text
            }
          />
        </Pressable>

        {/* ============================================= */}
        {/* CLASS CARD */}
        {/* ============================================= */}

        <View
          style={[
            styles.classCard,

            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,
            },
          ]}
        >
          <View
            style={
              styles.classTop
            }
          >
            <View
              style={
                styles.classTitleArea
              }
            >
              <Text
                numberOfLines={
                  2
                }
                adjustsFontSizeToFit
                minimumFontScale={
                  0.78
                }
                style={[
                  styles.className,

                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {
                  schoolClass.class_name
                }
              </Text>

              <View
                style={
                  styles.classMetaRow
                }
              >
                <View
                  style={[
                    styles.categoryBadge,

                    {
                      backgroundColor:
                        colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,

                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {getCategoryLabel(
                      schoolClass.category,
                    )}
                  </Text>
                </View>

                <Text
                  numberOfLines={
                    1
                  }
                  style={[
                    styles.gradeText,

                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {getGradeLabel(
                    schoolClass.grade_label,
                  )}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.classIcon,

                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name="school-outline"
                size={
                  styles.iconSize
                    .fontSize
                }
                color={
                  colors.primary
                }
              />
            </View>
          </View>

          <View
            style={[
              styles.divider,

              {
                backgroundColor:
                  colors.border,
              },
            ]}
          />

          {/* =========================================== */}
          {/* HOMEROOM */}
          {/* =========================================== */}

          <Text
            style={[
              styles.homeroomLabel,

              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            Homeroom Teacher
          </Text>

          <View
            style={
              styles.teacherRow
            }
          >
            {
              renderTeacherAvatar()
            }

            <View
              style={
                styles.teacherInfo
              }
            >
              <Text
                numberOfLines={
                  1
                }
                ellipsizeMode="tail"
                style={[
                  styles.teacherName,

                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {homeroomTeacher
                  ? homeroomTeacher.full_name
                  : 'Not assigned'}
              </Text>

              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.teacherId,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {homeroomTeacher
                  ?.teacher_id ??
                  'No homeroom teacher'}
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================= */}
        {/* STUDENT HEADER */}
        {/* ============================================= */}

        <View
          style={
            styles.studentsHeader
          }
        >
          <View
            style={
              styles.studentsHeaderText
            }
          >
            <Text
              numberOfLines={
                1
              }
              style={[
                styles.studentsTitle,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              Students
            </Text>

            <Text
              numberOfLines={
                2
              }
              style={[
                styles.studentsSubtitle,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Students assigned to{' '}
              {
                schoolClass.class_name
              }
            </Text>
          </View>

          <View
            style={[
              styles.studentCount,

              {
                backgroundColor:
                  colors.primarySoft,
              },
            ]}
          >
            <Text
              style={[
                styles.studentCountText,

                {
                  color:
                    colors.primary,
                },
              ]}
            >
              {
                students.length
              }
            </Text>
          </View>
        </View>

        {/* ============================================= */}
        {/* SEARCH */}
        {/* ============================================= */}

        <View
          style={[
            styles.searchBar,

            {
              backgroundColor:
                colors.input,

              borderColor:
                colors.border,
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={18}
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
            placeholder="Search student by name or ID"
            placeholderTextColor={
              colors.textMuted
            }
            autoCapitalize="none"
            returnKeyType="search"
            style={[
              styles.searchInput,

              {
                color:
                  colors.text,
              },
            ]}
          />

          {search.length >
          0 ? (
            <Pressable
              onPress={() =>
                setSearch(
                  '',
                )
              }
              hitSlop={
                8
              }
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={
                  colors.textMuted
                }
              />
            </Pressable>
          ) : null}
        </View>

        {/* ============================================= */}
        {/* EMPTY */}
        {/* ============================================= */}

        {students.length ===
        0 ? (
          <View
            style={[
              styles.emptyStudents,

              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyStudentsIcon,

                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name="people-outline"
                size={27}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={[
                styles.emptyStudentsTitle,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              No students yet
            </Text>

            <Text
              style={[
                styles.emptyStudentsText,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Students assigned to this class will appear here.
            </Text>
          </View>
        ) : filteredStudents.length ===
          0 ? (
          <View
            style={[
              styles.emptyStudents,

              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,
              },
            ]}
          >
            <Ionicons
              name="search-outline"
              size={27}
              color={
                colors.textMuted
              }
            />

            <Text
              style={[
                styles.emptyStudentsTitle,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              No students found
            </Text>

            <Text
              style={[
                styles.emptyStudentsText,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Try another name or Student ID.
            </Text>
          </View>
        ) : (
          /*
           * ===========================================
           * STUDENT LIST
           * ===========================================
           */

          <View
            style={
              styles.studentList
            }
          >
            {filteredStudents.map(
              (
                student,
                index,
              ) => {
                const avatar =
                  student.avatar_url ??
                  generatedAvatar(
                    student.full_name,
                  );

                const firstName =
                  student.first_name ||
                  student.full_name
                    .split(
                      ' ',
                    )[0] ||
                  '';

                const lastName =
                  student.last_name ||
                  student.full_name
                    .split(
                      ' ',
                    )
                    .slice(
                      1,
                    )
                    .join(
                      ' ',
                    );

                return (
                  <Pressable
                    key={
                      student.user_id
                    }
                    onPress={() =>
                      openStudent(
                        student,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.studentCard,

                      {
                        backgroundColor:
                          colors.card,

                        borderColor:
                          colors.border,

                        opacity:
                          pressed
                            ? 0.78
                            : 1,
                      },
                    ]}
                  >
                    {/* NUMBER */}

                    <View
                      style={[
                        styles.studentNumber,

                        {
                          backgroundColor:
                            colors.primarySoft,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.studentNumberText,

                          {
                            color:
                              colors.primary,
                          },
                        ]}
                      >
                        {
                          index +
                          1
                        }
                      </Text>
                    </View>

                    {/* AVATAR */}

                    <Image
                      source={{
                        uri:
                          avatar,
                      }}
                      resizeMode="cover"
                      style={
                        styles.studentAvatar
                      }
                    />

                    {/* INFO */}

                    <View
                      style={
                        styles.studentInfo
                      }
                    >
                      <Text
                        numberOfLines={
                          1
                        }
                        ellipsizeMode="tail"
                        style={[
                          styles.studentName,

                          {
                            color:
                              colors.text,
                          },
                        ]}
                      >
                        {firstName}{' '}
                        {lastName}
                      </Text>

                      <Text
                        numberOfLines={
                          1
                        }
                        style={[
                          styles.studentIdText,

                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        {student.student_id ??
                          'Student'}
                      </Text>

                      {(student.age ||
                        student.gender) ? (
                        <View
                          style={
                            styles.studentMetaRow
                          }
                        >
                          {student.age ? (
                            <Text
                              style={[
                                styles.studentMeta,

                                {
                                  color:
                                    colors.textMuted,
                                },
                              ]}
                            >
                              Age{' '}
                              {
                                student.age
                              }
                            </Text>
                          ) : null}

                          {student.gender ? (
                            <Text
                              style={[
                                styles.studentMeta,

                                {
                                  color:
                                    colors.textMuted,
                                },
                              ]}
                            >
                              {student.age
                                ? ' • '
                                : ''}

                              {student.gender ===
                              'male'
                                ? 'Male'
                                : 'Female'}
                            </Text>
                          ) : null}
                        </View>
                      ) : null}

                      {student.special_case ? (
                        <View
                          style={
                            styles.specialBadge
                          }
                        >
                          <Ionicons
                            name="information-circle-outline"
                            size={10}
                            color="#A16207"
                          />

                          <Text
                            numberOfLines={
                              1
                            }
                            style={
                              styles.specialBadgeText
                            }
                          >
                            Special case
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* OPEN */}

                    <View
                      style={[
                        styles.openStudentButton,

                        {
                          backgroundColor:
                            colors.primarySoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name="chevron-forward"
                        size={16}
                        color={
                          colors.primary
                        }
                      />
                    </View>
                  </Pressable>
                );
              },
            )}
          </View>
        )}

        <View
          style={
            styles.bottomSpace
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * RESPONSIVE STYLES
 * =========================================================
 */

function createStyles(
  colors:
    AppThemeColors,

  screenWidth:
    number,
) {
  /*
   * Small phones:
   * < 370
   *
   * Very small phones:
   * < 330
   */

  const verySmall =
    screenWidth <
    330;

  const small =
    screenWidth <
    370;

  const horizontalPadding =
    verySmall
      ? 10
      : small
        ? 12
        : 18;

  const cardPadding =
    verySmall
      ? 11
      : small
        ? 13
        : 18;

  const classFontSize =
    verySmall
      ? 21
      : small
        ? 24
        : 29;

  const studentTitleSize =
    verySmall
      ? 18
      : small
        ? 20
        : 23;

  return StyleSheet.create({
    /*
     * =====================================================
     * SCREEN
     * =====================================================
     */

    screen: {
      flex: 1,

      width:
        '100%',
    },

    centerScreen: {
      flex: 1,

      width:
        '100%',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 10,
    },

    loadingText: {
      fontSize:
        small
          ? 11
          : 13,

      fontWeight:
        '500',
    },

    /*
     * =====================================================
     * CONTENT
     * =====================================================
     */

    content: {
      width:
        '100%',

      paddingHorizontal:
        horizontalPadding,

      paddingTop:
        small
          ? 9
          : 14,

      paddingBottom:
        120,
    },

    /*
     * =====================================================
     * BACK
     * =====================================================
     */

    backButton: {
      width:
        small
          ? 36
          : 40,

      height:
        small
          ? 36
          : 40,

      borderRadius:
        small
          ? 12
          : 13,

      borderWidth: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginBottom:
        small
          ? 10
          : 14,

      flexShrink: 0,
    },

    /*
     * =====================================================
     * CLASS CARD
     * =====================================================
     */

    classCard: {
      width:
        '100%',

      minWidth: 0,

      borderWidth: 1,

      borderRadius:
        small
          ? 18
          : 22,

      padding:
        cardPadding,
    },

    classTop: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',

      gap:
        small
          ? 8
          : 12,
    },

    classTitleArea: {
      flex: 1,

      minWidth: 0,

      flexShrink: 1,
    },

    className: {
      maxWidth:
        '100%',

      fontSize:
        classFontSize,

      lineHeight:
        classFontSize +
        4,

      fontWeight:
        '800',

      letterSpacing:
        small
          ? -0.3
          : -0.6,

      flexShrink: 1,
    },

    classMetaRow: {
      marginTop:
        small
          ? 6
          : 8,

      flexDirection:
        'row',

      flexWrap:
        'wrap',

      alignItems:
        'center',

      gap:
        small
          ? 5
          : 8,
    },

    categoryBadge: {
      minHeight:
        small
          ? 23
          : 27,

      paddingHorizontal:
        small
          ? 7
          : 9,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink: 0,
    },

    categoryText: {
      fontSize:
        small
          ? 9
          : 10.5,

      fontWeight:
        '700',
    },

    gradeText: {
      fontSize:
        small
          ? 9.5
          : 11,

      fontWeight:
        '600',

      flexShrink: 1,
    },

    classIcon: {
      width:
        small
          ? 42
          : 48,

      height:
        small
          ? 42
          : 48,

      borderRadius:
        small
          ? 13
          : 15,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink: 0,
    },

    iconSize: {
      fontSize:
        small
          ? 21
          : 24,
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      marginVertical:
        small
          ? 13
          : 17,
    },

    /*
     * =====================================================
     * HOMEROOM
     * =====================================================
     */

    homeroomLabel: {
      fontSize:
        small
          ? 9
          : 10.5,

      fontWeight:
        '600',

      marginBottom:
        small
          ? 8
          : 10,
    },

    teacherRow: {
      width:
        '100%',

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    teacherAvatar: {
      width:
        small
          ? 42
          : 48,

      height:
        small
          ? 42
          : 48,

      borderRadius:
        small
          ? 21
          : 24,

      flexShrink: 0,
    },

    teacherAvatarFallback: {
      width:
        small
          ? 42
          : 48,

      height:
        small
          ? 42
          : 48,

      borderRadius:
        small
          ? 21
          : 24,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink: 0,
    },

    teacherInitials: {
      fontSize:
        small
          ? 13
          : 15,

      fontWeight:
        '800',
    },

    teacherInfo: {
      flex: 1,

      minWidth: 0,

      marginLeft:
        small
          ? 9
          : 12,
    },

    teacherName: {
      fontSize:
        small
          ? 12
          : 14,

      fontWeight:
        '700',

      flexShrink: 1,
    },

    teacherId: {
      marginTop: 3,

      fontSize:
        small
          ? 9
          : 11,

      fontWeight:
        '500',

      flexShrink: 1,
    },

    /*
     * =====================================================
     * STUDENTS HEADER
     * =====================================================
     */

    studentsHeader: {
      width:
        '100%',

      marginTop:
        small
          ? 21
          : 28,

      marginBottom:
        small
          ? 10
          : 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap: 8,
    },

    studentsHeaderText: {
      flex: 1,

      minWidth: 0,

      paddingRight:
        small
          ? 6
          : 10,
    },

    studentsTitle: {
      fontSize:
        studentTitleSize,

      lineHeight:
        studentTitleSize +
        5,

      fontWeight:
        '800',

      letterSpacing:
        small
          ? -0.2
          : -0.4,
    },

    studentsSubtitle: {
      marginTop: 3,

      fontSize:
        small
          ? 9.5
          : 11,

      lineHeight:
        small
          ? 13
          : 15,

      fontWeight:
        '500',

      flexShrink: 1,
    },

    studentCount: {
      minWidth:
        small
          ? 29
          : 33,

      height:
        small
          ? 29
          : 33,

      paddingHorizontal:
        small
          ? 7
          : 9,

      borderRadius:
        17,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink: 0,
    },

    studentCountText: {
      fontSize:
        small
          ? 10
          : 11,

      fontWeight:
        '800',
    },

    /*
     * =====================================================
     * SEARCH
     * =====================================================
     */

    searchBar: {
      width:
        '100%',

      height:
        small
          ? 46
          : 50,

      borderWidth: 1,

      borderRadius:
        small
          ? 13
          : 15,

      paddingHorizontal:
        small
          ? 10
          : 13,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    searchInput: {
      flex: 1,

      minWidth: 0,

      height:
        small
          ? 44
          : 48,

      marginLeft:
        small
          ? 6
          : 8,

      marginRight:
        small
          ? 4
          : 7,

      paddingVertical: 0,

      fontSize:
        small
          ? 11.5
          : 13,

      fontWeight:
        '500',
    },

    /*
     * =====================================================
     * EMPTY
     * =====================================================
     */

    emptyStudents: {
      width:
        '100%',

      marginTop: 13,

      borderWidth: 1,

      borderRadius:
        small
          ? 17
          : 21,

      paddingHorizontal:
        small
          ? 15
          : 22,

      paddingVertical:
        small
          ? 27
          : 34,

      alignItems:
        'center',
    },

    emptyStudentsIcon: {
      width:
        small
          ? 50
          : 56,

      height:
        small
          ? 50
          : 56,

      borderRadius:
        small
          ? 16
          : 18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyStudentsTitle: {
      marginTop:
        small
          ? 11
          : 14,

      fontSize:
        small
          ? 14
          : 16,

      fontWeight:
        '700',
    },

    emptyStudentsText: {
      marginTop: 6,

      maxWidth: 270,

      textAlign:
        'center',

      fontSize:
        small
          ? 11
          : 12,

      lineHeight:
        small
          ? 16
          : 18,
    },

    /*
     * =====================================================
     * STUDENT LIST
     * =====================================================
     */

    studentList: {
      width:
        '100%',

      marginTop:
        small
          ? 11
          : 13,

      gap:
        small
          ? 8
          : 10,
    },

    studentCard: {
      width:
        '100%',

      minWidth: 0,

      minHeight:
        small
          ? 70
          : 80,

      borderWidth: 1,

      borderRadius:
        small
          ? 15
          : 18,

      padding:
        verySmall
          ? 7
          : small
            ? 9
            : 11,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    studentNumber: {
      width:
        verySmall
          ? 23
          : small
            ? 25
            : 27,

      height:
        verySmall
          ? 23
          : small
            ? 25
            : 27,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        verySmall
          ? 4
          : small
            ? 6
            : 8,

      flexShrink: 0,
    },

    studentNumberText: {
      fontSize:
        small
          ? 9
          : 10,

      fontWeight:
        '800',
    },

    studentAvatar: {
      width:
        verySmall
          ? 36
          : small
            ? 39
            : 44,

      height:
        verySmall
          ? 36
          : small
            ? 39
            : 44,

      borderRadius:
        verySmall
          ? 18
          : small
            ? 20
            : 22,

      flexShrink: 0,
    },

    studentInfo: {
      flex: 1,

      minWidth: 0,

      marginLeft:
        verySmall
          ? 6
          : small
            ? 8
            : 10,
    },

    studentName: {
      fontSize:
        verySmall
          ? 10.5
          : small
            ? 11.5
            : 13,

      fontWeight:
        '700',

      flexShrink: 1,
    },

    studentIdText: {
      marginTop: 2,

      fontSize:
        verySmall
          ? 8
          : small
            ? 8.5
            : 10,

      fontWeight:
        '500',

      flexShrink: 1,
    },

    studentMetaRow: {
      marginTop: 3,

      flexDirection:
        'row',

      flexWrap:
        'wrap',

      alignItems:
        'center',
    },

    studentMeta: {
      fontSize:
        verySmall
          ? 8
          : small
            ? 8.5
            : 10,

      fontWeight:
        '500',
    },

    specialBadge: {
      marginTop: 4,

      alignSelf:
        'flex-start',

      minHeight:
        small
          ? 19
          : 22,

      maxWidth:
        '100%',

      paddingHorizontal:
        small
          ? 5
          : 7,

      borderRadius: 6,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 3,

      backgroundColor:
        '#FEF3C7',
    },

    specialBadgeText: {
      color:
        '#A16207',

      fontSize:
        small
          ? 7.5
          : 9,

      fontWeight:
        '700',

      flexShrink: 1,
    },

    openStudentButton: {
      width:
        verySmall
          ? 27
          : small
            ? 29
            : 33,

      height:
        verySmall
          ? 27
          : small
            ? 29
            : 33,

      marginLeft:
        verySmall
          ? 3
          : small
            ? 5
            : 7,

      borderRadius:
        small
          ? 9
          : 10,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink: 0,
    },

    /*
     * =====================================================
     * BOTTOM
     * =====================================================
     */

    bottomSpace: {
      height: 40,
    },

    /*
     * =====================================================
     * ERROR
     * =====================================================
     */

    errorContainer: {
      flex: 1,

      width:
        '100%',

      paddingHorizontal:
        horizontalPadding +
        12,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    errorIcon: {
      width: 56,

      height: 56,

      borderRadius: 18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    errorTitle: {
      marginTop: 15,

      fontSize:
        small
          ? 16
          : 18,

      fontWeight:
        '700',

      textAlign:
        'center',
    },

    errorText: {
      marginTop: 6,

      textAlign:
        'center',

      fontSize:
        small
          ? 11
          : 13,

      lineHeight:
        small
          ? 16
          : 19,
    },

    backToClassesButton: {
      marginTop: 19,

      minHeight: 45,

      paddingHorizontal:
        small
          ? 15
          : 20,

      borderRadius: 14,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    backToClassesText: {
      color:
        '#FFFFFF',

      fontSize:
        small
          ? 12
          : 14,

      fontWeight:
        '700',
    },
  });
}