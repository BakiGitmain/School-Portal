import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  useLocalSearchParams,
  useRouter,
  type Href,
} from 'expo-router';

import {
  supabase,
} from '../../../lib/supabase';

import {
  getSavedSession,
  removeSavedAccount,
  saveAccount,
} from '../../../lib/accountStore';

import SubjectMultiSelect from '../../../components/common/SubjectMultiSelect';

import ClassroomMultiSelect, {
  type ClassroomAssignment,
  type ClassroomOption,
} from '../../../components/common/ClassroomMultiSelect';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type Teacher = {
  id: string;

  user_id: string;

  full_name: string;

  username:
    | string
    | null;

  role:
    'teacher';

  teacher_id:
    | string
    | null;

  student_id:
    | string
    | null;

  avatar_url:
    | string
    | null;

  location:
    | string
    | null;

  phone_number:
    | string
    | null;

  subjects:
    string[];

  must_change_password:
    boolean;

  created_at:
    string;
};

type SchoolClass = {
  id: string;

  category:
    | 'elementary'
    | 'high_school';

  grade_label:
    string;

  section:
    string;

  class_name:
    string;

  homeroom_teacher_user_id:
    | string
    | null;
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getClassCategoryLabel(
  category:
    SchoolClass['category'],
) {
  return category ===
    'elementary'
    ? 'Elementary'
    : 'High School';
}

function getClassGradeLabel(
  grade:
    string,
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

function defaultAvatar(
  name:
    string,
) {
  return (
    'https://api.dicebear.com/9.x/personas/png?seed=' +
    encodeURIComponent(
      name ||
        'Teacher',
    )
  );
}

function normalizePhone(
  value:
    string,
) {
  const clean =
    value
      .trim()
      .replace(
        /[\s()-]/g,
        '',
      );

  if (
    /^0[79]\d{8}$/.test(
      clean,
    )
  ) {
    return (
      '+251' +
      clean.slice(
        1,
      )
    );
  }

  if (
    /^[79]\d{8}$/.test(
      clean,
    )
  ) {
    return (
      '+251' +
      clean
    );
  }

  return clean;
}

async function getFunctionError(
  error:
    unknown,
) {
  try {
    const possible =
      error as {
        context?:
          Response;

        message?:
          string;
      };

    if (
      possible.context &&
      typeof possible.context
        .json ===
        'function'
    ) {
      const body =
        await possible.context
          .json();

      if (
        body?.error
      ) {
        return String(
          body.error,
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

/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function TeacherDetailsScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id?:
        | string
        | string[];
    }>();

  const teacherProfileId =
    Array.isArray(
      params.id,
    )
      ? params.id[0]
      : params.id;

  /*
   * =====================================================
   * TEACHER
   * =====================================================
   */

  const [
    teacher,
    setTeacher,
  ] =
    useState<
      Teacher |
      null
    >(
      null,
    );

  /*
   * =====================================================
   * HOMEROOM CLASSES
   *
   * Example:
   * Teacher is homeroom teacher of 10A.
   * =====================================================
   */

  const [
    homeroomClasses,
    setHomeroomClasses,
  ] =
    useState<
      SchoolClass[]
    >([]);

  /*
   * =====================================================
   * TEACHING CLASSROOMS
   *
   * Example:
   * Teacher teaches:
   * 10A
   * 10B
   * 11A
   *
   * Separate from Homeroom.
   * =====================================================
   */

  const [
    teachingClassrooms,
    setTeachingClassrooms,
  ] =
    useState<
      SchoolClass[]
    >([]);

  /*
   * Exact subject mapping for every teaching classroom.
   *
   * Example:
   * 10A -> Mathematics + English
   * 10B -> Mathematics
   */
  const [
    classAssignments,
    setClassAssignments,
  ] =
    useState<
      ClassroomAssignment[]
    >([]);

  /*
   * All classes.
   *
   * Used by ClassroomMultiSelect
   * when editing the teacher.
   */

  const [
    classroomOptions,
    setClassroomOptions,
  ] =
    useState<
      ClassroomOption[]
    >([]);

  /*
   * =====================================================
   * UI STATE
   * =====================================================
   */

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
    useState('');

  const [
    editOpen,
    setEditOpen,
  ] =
    useState(
      false,
    );

  const [
    deleteOpen,
    setDeleteOpen,
  ] =
    useState(
      false,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    deleting,
    setDeleting,
  ] =
    useState(
      false,
    );

  /*
   * =====================================================
   * EDIT FORM
   * =====================================================
   */

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
    editTeacherId,
    setEditTeacherId,
  ] =
    useState('');

  const [
    editLocation,
    setEditLocation,
  ] =
    useState('');

  const [
    editPhone,
    setEditPhone,
  ] =
    useState('');

  const [
    editSubjects,
    setEditSubjects,
  ] =
    useState<
      string[]
    >([]);

  const [
    editClassAssignments,
    setEditClassAssignments,
  ] =
    useState<
      ClassroomAssignment[]
    >([]);

  /*
   * =====================================================
   * LOAD
   * =====================================================
   */

  useEffect(
    () => {
      void loadTeacher();
    },
    [
      teacherProfileId,
    ],
  );

  async function loadTeacher() {
    if (
      !teacherProfileId
    ) {
      setError(
        'Teacher not found.',
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

      setError('');

      /*
       * =========================================
       * TEACHER PROFILE
       * =========================================
       */

      const {
        data,
        error:
          loadError,
      } =
        await supabase
          .from(
            'profiles',
          )
          .select(`
            id,
            user_id,
            full_name,
            username,
            role,
            teacher_id,
            student_id,
            avatar_url,
            location,
            phone_number,
            subjects,
            must_change_password,
            created_at
          `)
          .eq(
            'id',
            teacherProfileId,
          )
          .eq(
            'role',
            'teacher',
          )
          .single();

      if (
        loadError ||
        !data
      ) {
        throw (
          loadError ??
          new Error(
            'Teacher not found',
          )
        );
      }

      const teacherData:
        Teacher = {
        ...(data as
          Teacher),

        subjects:
          Array.isArray(
            data.subjects,
          )
            ? data.subjects
            : [],
      };

      setTeacher(
        teacherData,
      );

      /*
       * =========================================
       * LOAD ALL SCHOOL CLASSES
       * =========================================
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
            homeroom_teacher_user_id
          `)
          .order(
            'created_at',
            {
              ascending:
                true,
            },
          );

      if (
        classError
      ) {
        throw classError;
      }

      const allClasses:
        SchoolClass[] =
        (
          classData ??
          []
        ).map(
          (
            item,
          ) => ({
            id:
              item.id,

            category:
              item.category as
                SchoolClass['category'],

            grade_label:
              item.grade_label,

            section:
              item.section,

            class_name:
              item.class_name,

            homeroom_teacher_user_id:
              item.homeroom_teacher_user_id,
          }),
        );

      /*
       * =========================================
       * CLASSROOM OPTIONS FOR EDIT
       * =========================================
       */

      setClassroomOptions(
        allClasses.map(
          (
            item,
          ) => ({
            id:
              item.id,

            category:
              item.category,

            grade_label:
              item.grade_label,

            section:
              item.section,

            class_name:
              item.class_name,
          }),
        ),
      );

      /*
       * =========================================
       * HOMEROOM CLASS
       * =========================================
       */

      setHomeroomClasses(
        allClasses.filter(
          (
            item,
          ) =>
            item
              .homeroom_teacher_user_id ===
            teacherData
              .user_id,
        ),
      );

      /*
       * =========================================
       * TEACHING CLASS ASSIGNMENTS
       * =========================================
       */

      const {
        data:
          assignmentData,
        error:
          assignmentError,
      } =
        await supabase
          .from(
            'teacher_class_assignments',
          )
          .select(`
            class_id,
            subjects
          `)
          .eq(
            'teacher_user_id',
            teacherData
              .user_id,
          );

      if (
        assignmentError
      ) {
        throw assignmentError;
      }

      const loadedAssignments:
        ClassroomAssignment[] =
        (
          assignmentData ??
          []
        ).map(
          (
            item,
          ) => ({
            classId:
              String(
                item.class_id,
              ),

            subjects:
              Array.isArray(
                item.subjects,
              )
                ? item.subjects.map(
                    (
                      subject,
                    ) =>
                      String(
                        subject,
                      ),
                  )
                : [],
          }),
        );

      setClassAssignments(
        loadedAssignments,
      );

      const assignedIds =
        new Set(
          loadedAssignments.map(
            (
              assignment,
            ) =>
              assignment.classId,
          ),
        );

      setTeachingClassrooms(
        allClasses.filter(
          (
            item,
          ) =>
            assignedIds.has(
              item.id,
            ),
        ),
      );
    } catch (
      loadError
    ) {
      console.log(
        'LOAD TEACHER:',
        loadError,
      );

      setTeacher(
        null,
      );

      setHomeroomClasses(
        [],
      );

      setTeachingClassrooms(
        [],
      );

      setClassAssignments(
        [],
      );

      setClassroomOptions(
        [],
      );

      setError(
        'Teacher not found.',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  /*
   * =====================================================
   * BACK
   * =====================================================
   */

  function goBack() {
    router.replace(
      '/admin/teachers' as Href,
    );
  }

  /*
   * =====================================================
   * OPEN EDIT
   * =====================================================
   */

  function openEdit() {
    if (
      !teacher
    ) {
      return;
    }

    setEditName(
      teacher.full_name,
    );

    setEditUsername(
      teacher.username ??
        '',
    );

    setEditTeacherId(
      teacher.teacher_id ??
        '',
    );

    setEditLocation(
      teacher.location ??
        '',
    );

    setEditPhone(
      teacher.phone_number ??
        '',
    );

    setEditSubjects(
      teacher.subjects ??
        [],
    );

    setEditClassAssignments(
      classAssignments.map(
        (
          assignment,
        ) => ({
          classId:
            assignment.classId,

          subjects: [
            ...assignment.subjects,
          ],
        }),
      ),
    );

    setError('');

    setEditOpen(
      true,
    );
  }

  /*
   * =====================================================
   * EDIT SUBJECTS
   * =====================================================
   *
   * If a subject is removed from the teacher, remove it
   * from every classroom mapping too.
   */

  function handleEditSubjectsChange(
    nextSubjects:
      string[],
  ) {
    setEditSubjects(
      nextSubjects,
    );

    const allowedSubjects =
      new Set(
        nextSubjects.map(
          (
            subject,
          ) =>
            subject.toLowerCase(),
        ),
      );

    setEditClassAssignments(
      (
        current,
      ) =>
        current.map(
          (
            assignment,
          ) => ({
            ...assignment,

            subjects:
              assignment.subjects.filter(
                (
                  subject,
                ) =>
                  allowedSubjects.has(
                    subject.toLowerCase(),
                  ),
              ),
          }),
        ),
    );
  }

  /*
   * =====================================================
   * SAVE EDIT
   * =====================================================
   */

  async function saveEdit() {
    if (
      !teacher
    ) {
      return;
    }

    const cleanName =
      editName.trim();

    const cleanUsername =
      editUsername
        .trim()
        .toLowerCase();

    const cleanTeacherId =
      editTeacherId
        .trim()
        .toUpperCase();

    const cleanLocation =
      editLocation.trim();

    const cleanPhone =
      normalizePhone(
        editPhone,
      );

    setError('');

    /*
     * VALIDATION
     */

    if (
      !cleanName
    ) {
      setError(
        'Name is required.',
      );

      return;
    }

    if (
      !cleanUsername
    ) {
      setError(
        'Username is required.',
      );

      return;
    }

    if (
      !/^[a-z0-9._-]{3,30}$/.test(
        cleanUsername,
      )
    ) {
      setError(
        'Enter a valid username.',
      );

      return;
    }

    if (
      !cleanTeacherId
    ) {
      setError(
        'Teacher ID is required.',
      );

      return;
    }

    if (
      !/^TR-\d{3,}$/.test(
        cleanTeacherId,
      )
    ) {
      setError(
        'Use a Teacher ID like TR-001.',
      );

      return;
    }

    if (
      !cleanLocation
    ) {
      setError(
        'Location is required.',
      );

      return;
    }

    if (
      !cleanPhone
    ) {
      setError(
        'Phone number is required.',
      );

      return;
    }

    if (
      !/^\+251[79]\d{8}$/.test(
        cleanPhone,
      )
    ) {
      setError(
        'Enter a valid Ethiopian phone number.',
      );

      return;
    }

    if (
      editSubjects.length ===
      0
    ) {
      setError(
        'Choose at least one subject.',
      );

      return;
    }

    if (
      editClassAssignments.length ===
      0
    ) {
      setError(
        'Choose at least one classroom.',
      );

      return;
    }

    const incompleteAssignment =
      editClassAssignments.find(
        (
          assignment,
        ) =>
          assignment.subjects.length ===
          0,
      );

    if (
      incompleteAssignment
    ) {
      const classroom =
        classroomOptions.find(
          (
            option,
          ) =>
            option.id ===
            incompleteAssignment.classId,
        );

      setError(
        `Choose at least one subject for ${
          classroom?.class_name ??
          'each classroom'
        }.`,
      );

      return;
    }

    /*
     * UPDATE
     */

    try {
      setSaving(
        true,
      );

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions
          .invoke(
            'update-teacher',
            {
              body: {
                teacherUserId:
                  teacher.user_id,

                fullName:
                  cleanName,

                username:
                  cleanUsername,

                teacherId:
                  cleanTeacherId,

                location:
                  cleanLocation,

                phoneNumber:
                  cleanPhone,

                subjects:
                  editSubjects,

                classAssignments:
                  editClassAssignments,
              },
            },
          );

      if (
        functionError
      ) {
        const message =
          await getFunctionError(
            functionError,
          );

        throw new Error(
          message,
        );
      }

      if (
        !data?.teacher
      ) {
        throw new Error(
          data?.error ??
            'Could not update teacher.',
        );
      }

      const updated:
        Teacher = {
        ...(data.teacher as
          Teacher),

        subjects:
          Array.isArray(
            data.teacher
              .subjects,
          )
            ? data.teacher
                .subjects
            : [],
      };

      setTeacher(
        updated,
      );

      /*
       * Immediately update teaching classrooms
       * without making user wait for another load.
       */

      setClassAssignments(
        editClassAssignments.map(
          (
            assignment,
          ) => ({
            classId:
              assignment.classId,

            subjects: [
              ...assignment.subjects,
            ],
          }),
        ),
      );

      const selectedIds =
        new Set(
          editClassAssignments.map(
            (
              assignment,
            ) =>
              assignment.classId,
          ),
        );

      setTeachingClassrooms(
        classroomOptions
          .filter(
            (
              item,
            ) =>
              selectedIds.has(
                item.id,
              ),
          )
          .map(
            (
              item,
            ) => ({
              ...item,

              homeroom_teacher_user_id:
                homeroomClasses.some(
                  (
                    homeroom,
                  ) =>
                    homeroom.id ===
                    item.id,
                )
                  ? updated.user_id
                  : null,
            }),
          ),
      );

      /*
       * Update saved multi-account info.
       */

      const savedSession =
        await getSavedSession(
          updated.user_id,
        );

      if (
        savedSession
      ) {
        await saveAccount(
          {
            userId:
              updated.user_id,

            loginId:
              updated.teacher_id ??
              cleanTeacherId,

            fullName:
              updated.full_name,

            role:
              'teacher',

            avatarUrl:
              updated.avatar_url,

            teacherId:
              updated.teacher_id,

            studentId:
              null,
          },

          {
            access_token:
              savedSession.accessToken,

            refresh_token:
              savedSession.refreshToken,
          },
        );
      }

      setEditOpen(
        false,
      );

      setError('');
    } catch (
      saveError
    ) {
      console.log(
        'UPDATE TEACHER:',
        saveError,
      );

      setError(
        saveError instanceof
        Error
          ? saveError.message
          : 'Could not update teacher.',
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  /*
   * =====================================================
   * DELETE TEACHER
   * =====================================================
   */

  async function deleteTeacher() {
    if (
      !teacher
    ) {
      return;
    }

    try {
      setDeleting(
        true,
      );

      setError('');

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions
          .invoke(
            'delete-teacher',
            {
              body: {
                teacherUserId:
                  teacher.user_id,
              },
            },
          );

      if (
        functionError
      ) {
        const message =
          await getFunctionError(
            functionError,
          );

        throw new Error(
          message,
        );
      }

      if (
        !data?.success
      ) {
        throw new Error(
          data?.error ??
            'Could not delete teacher.',
        );
      }

      await removeSavedAccount(
        teacher.user_id,
      );

      setDeleteOpen(
        false,
      );

      router.replace(
        '/admin/teachers' as Href,
      );
    } catch (
      deleteError
    ) {
      console.log(
        'DELETE TEACHER:',
        deleteError,
      );

      setError(
        deleteError instanceof
        Error
          ? deleteError.message
          : 'Could not delete teacher.',
      );
    } finally {
      setDeleting(
        false,
      );
    }
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
        style={
          styles.safeArea
        }
      >
        <StatusBar
          style="dark"
        />

        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            size="large"
            color="#1671F5"
          />
        </View>
      </SafeAreaView>
    );
  }

  /*
   * =====================================================
   * NOT FOUND
   * =====================================================
   */

  if (
    !teacher
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <StatusBar
          style="dark"
        />

        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={
              goBack
            }
            style={
              styles.backButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color="#102B59"
            />
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Teacher
          </Text>

          <View
            style={{
              width:
                42,
            }}
          />
        </View>

        <View
          style={
            styles.empty
          }
        >
          <Text
            style={
              styles.errorText
            }
          >
            {error ||
              'Teacher not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * =====================================================
   * MAIN UI
   * =====================================================
   */

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        style="dark"
      />

      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={
            goBack
          }
          style={({
            pressed,
          }) => [
            styles.backButton,

            pressed &&
              styles.backPressed,
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={25}
            color="#102B59"
          />
        </Pressable>

        <Text
          style={
            styles.headerTitle
          }
        >
          Teacher
        </Text>

        <View
          style={{
            width:
              42,
          }}
        />
      </View>

      {/* CONTENT */}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* AVATAR */}

        <Image
          source={{
            uri:
              teacher.avatar_url ??
              defaultAvatar(
                teacher.full_name,
              ),
          }}
          style={
            styles.avatar
          }
        />

        <Text
          style={
            styles.name
          }
        >
          {
            teacher.full_name
          }
        </Text>

        <Text
          style={
            styles.teacherId
          }
        >
          {
            teacher.teacher_id
          }
        </Text>

        {/* ================================================= */}
        {/* INFORMATION */}
        {/* ================================================= */}

        <View
          style={
            styles.infoCard
          }
        >
          {/* USERNAME */}

          <InfoRow
            icon="person-outline"
            label="Username"
            value={
              teacher.username
                ? `@${teacher.username}`
                : 'Not added'
            }
          />

          <Divider />

          {/* TEACHER ID */}

          <InfoRow
            icon="school-outline"
            label="Teacher ID"
            value={
              teacher.teacher_id ??
              'Not added'
            }
          />

          <Divider />

          {/* ================================================= */}
          {/* SUBJECTS */}
          {/* ================================================= */}

          <View
            style={
              styles.multiInfoRow
            }
          >
            <View
              style={
                styles.infoIcon
              }
            >
              <Ionicons
                name="book-outline"
                size={19}
                color="#1671F5"
              />
            </View>

            <View
              style={
                styles.multiInfoContent
              }
            >
              <Text
                style={
                  styles.infoLabel
                }
              >
                Subjects
              </Text>

              {teacher.subjects.length >
              0 ? (
                <View
                  style={
                    styles.detailChips
                  }
                >
                  {teacher.subjects.map(
                    (
                      subject,
                    ) => (
                      <View
                        key={
                          subject
                        }
                        style={
                          styles.detailChip
                        }
                      >
                        <Text
                          style={
                            styles.detailChipText
                          }
                        >
                          {subject}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
              ) : (
                <Text
                  style={
                    styles.infoValue
                  }
                >
                  Not added
                </Text>
              )}
            </View>
          </View>

          <Divider />

          {/* ================================================= */}
          {/* TEACHING CLASSROOMS */}
          {/* ================================================= */}

          <View
            style={
              styles.multiInfoRow
            }
          >
            <View
              style={
                styles.infoIcon
              }
            >
              <Ionicons
                name="easel-outline"
                size={19}
                color="#1671F5"
              />
            </View>

            <View
              style={
                styles.multiInfoContent
              }
            >
              <Text
                style={
                  styles.infoLabel
                }
              >
                Teaching Classrooms
              </Text>

              {teachingClassrooms.length >
              0 ? (
                <View
                  style={
                    styles.detailChips
                  }
                >
                  {teachingClassrooms.map(
                    (
                      classroom,
                    ) => {
                      const assignment =
                        classAssignments.find(
                          (
                            item,
                          ) =>
                            item.classId ===
                            classroom.id,
                        );

                      return (
                        <Pressable
                          key={
                            classroom.id
                          }
                          onPress={() =>
                            router.push(
                              `/admin/class/${classroom.id}` as Href,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.teachingClassChip,

                            pressed &&
                              styles.pressed,
                          ]}
                        >
                          <Text
                            style={
                              styles.teachingClassName
                            }
                          >
                            {
                              classroom.class_name
                            }
                          </Text>

                          <Text
                            style={
                              styles.teachingClassSubjects
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {assignment
                              ?.subjects
                              .length
                              ? assignment.subjects.join(
                                  ' • ',
                                )
                              : 'No subject assigned'}
                          </Text>
                        </Pressable>
                      );
                    },
                  )}
                </View>
              ) : (
                <Text
                  style={
                    styles.infoValue
                  }
                >
                  Not assigned
                </Text>
              )}
            </View>
          </View>

          <Divider />

          {/* LOCATION */}

          <InfoRow
            icon="location-outline"
            label="Location"
            value={
              teacher.location ??
              'Not added'
            }
          />

          <Divider />

          {/* PHONE */}

          <InfoRow
            icon="call-outline"
            label="Phone"
            value={
              teacher.phone_number ??
              'Not added'
            }
          />
        </View>

        {/* ================================================= */}
        {/* HOMEROOM CLASS */}
        {/* ================================================= */}

        <View
          style={
            styles.classroomSection
          }
        >
          <View
            style={
              styles.classroomHeader
            }
          >
            <View>
              <Text
                style={
                  styles.classroomTitle
                }
              >
                Classroom
              </Text>

              <Text
                style={
                  styles.classroomSubtitle
                }
              >
                Homeroom class
              </Text>
            </View>

            <View
              style={
                styles.classroomCount
              }
            >
              <Text
                style={
                  styles.classroomCountText
                }
              >
                {
                  homeroomClasses.length
                }
              </Text>
            </View>
          </View>

          {homeroomClasses.length >
          0 ? (
            <View
              style={
                styles.classroomList
              }
            >
              {homeroomClasses.map(
                (
                  classroom,
                ) => (
                  <Pressable
                    key={
                      classroom.id
                    }
                    onPress={() =>
                      router.push(
                        `/admin/class/${classroom.id}` as Href,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.classroomCard,

                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <View
                      style={
                        styles.classroomIcon
                      }
                    >
                      <Ionicons
                        name="school-outline"
                        size={22}
                        color="#1671F5"
                      />
                    </View>

                    <View
                      style={
                        styles.classroomInfo
                      }
                    >
                      <Text
                        style={
                          styles.classroomName
                        }
                      >
                        {
                          classroom.class_name
                        }
                      </Text>

                      <Text
                        style={
                          styles.classroomMeta
                        }
                      >
                        {getClassCategoryLabel(
                          classroom.category,
                        )}

                        {' • '}

                        {getClassGradeLabel(
                          classroom.grade_label,
                        )}
                      </Text>

                      <View
                        style={
                          styles.homeroomBadge
                        }
                      >
                        <Ionicons
                          name="person-outline"
                          size={12}
                          color="#1671F5"
                        />

                        <Text
                          style={
                            styles.homeroomBadgeText
                          }
                        >
                          Homeroom Teacher
                        </Text>
                      </View>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={19}
                      color="#94A3B8"
                    />
                  </Pressable>
                ),
              )}
            </View>
          ) : (
            <View
              style={
                styles.noClassroomCard
              }
            >
              <View
                style={
                  styles.noClassroomIcon
                }
              >
                <Ionicons
                  name="school-outline"
                  size={23}
                  color="#8C9AAF"
                />
              </View>

              <View
                style={
                  styles.noClassroomInfo
                }
              >
                <Text
                  style={
                    styles.noClassroomTitle
                  }
                >
                  No classroom assigned
                </Text>

                <Text
                  style={
                    styles.noClassroomText
                  }
                >
                  This teacher is not a homeroom teacher yet.
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* ================================================= */}
        {/* EDIT */}
        {/* ================================================= */}

        <Pressable
          onPress={
            openEdit
          }
          style={({
            pressed,
          }) => [
            styles.editButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="create-outline"
            size={20}
            color="#1671F5"
          />

          <Text
            style={
              styles.editText
            }
          >
            Edit teacher
          </Text>
        </Pressable>

        {/* ================================================= */}
        {/* DELETE */}
        {/* ================================================= */}

        <Pressable
          onPress={() => {
            setError('');

            setDeleteOpen(
              true,
            );
          }}
          style={({
            pressed,
          }) => [
            styles.deleteButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color="#EF4444"
          />

          <Text
            style={
              styles.deleteText
            }
          >
            Delete teacher
          </Text>
        </Pressable>
      </ScrollView>

      {/* ================================================= */}
      {/* EDIT MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          editOpen
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          !saving &&
          setEditOpen(
            false,
          )
        }
      >
        <SafeAreaView
          style={
            styles.safeArea
          }
        >
          <KeyboardAvoidingView
            style={{
              flex:
                1,
            }}
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
          >
            {/* HEADER */}

            <View
              style={
                styles.header
              }
            >
              <Pressable
                disabled={
                  saving
                }
                onPress={() =>
                  setEditOpen(
                    false,
                  )
                }
                style={
                  styles.backButton
                }
              >
                <Ionicons
                  name="chevron-back"
                  size={25}
                  color="#102B59"
                />
              </Pressable>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Edit Teacher
              </Text>

              <View
                style={{
                  width:
                    42,
                }}
              />
            </View>

            {/* FORM */}

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.editContent
              }
            >
              {/* AVATAR */}

              <Image
                source={{
                  uri:
                    teacher.avatar_url ??
                    defaultAvatar(
                      teacher.full_name,
                    ),
                }}
                style={
                  styles.editAvatar
                }
              />

              {/* NAME */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Name
              </Text>

              <TextInput
                value={
                  editName
                }
                onChangeText={
                  setEditName
                }
                style={
                  styles.input
                }
              />

              {/* USERNAME */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Username
              </Text>

              <TextInput
                value={
                  editUsername
                }
                onChangeText={(
                  text,
                ) =>
                  setEditUsername(
                    text
                      .toLowerCase()
                      .replace(
                        /\s/g,
                        '',
                      ),
                  )
                }
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                style={
                  styles.input
                }
              />

              {/* TEACHER ID */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Teacher ID
              </Text>

              <TextInput
                value={
                  editTeacherId
                }
                onChangeText={(
                  text,
                ) =>
                  setEditTeacherId(
                    text.toUpperCase(),
                  )
                }
                autoCapitalize="characters"
                style={
                  styles.input
                }
              />

              {/* LOCATION */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Location
              </Text>

              <TextInput
                value={
                  editLocation
                }
                onChangeText={
                  setEditLocation
                }
                placeholder="e.g. Goro"
                placeholderTextColor="#9AA7B8"
                style={
                  styles.input
                }
              />

              {/* PHONE */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Phone
              </Text>

              <TextInput
                value={
                  editPhone
                }
                onChangeText={
                  setEditPhone
                }
                placeholder="0912345678"
                placeholderTextColor="#9AA7B8"
                keyboardType="phone-pad"
                style={
                  styles.input
                }
              />

              {/* SUBJECTS */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Subjects
              </Text>

              <SubjectMultiSelect
                value={
                  editSubjects
                }
                onChange={
                  handleEditSubjectsChange
                }
              />

              <View
                style={
                  styles.fieldGap
                }
              />

              {/* TEACHING CLASSROOMS */}

              <Text
                style={
                  styles.inputLabel
                }
              >
                Teaching Classrooms
              </Text>

              <ClassroomMultiSelect
                value={
                  editClassAssignments
                }
                onChange={
                  setEditClassAssignments
                }
                options={
                  classroomOptions
                }
                subjects={
                  editSubjects
                }
                disabled={
                  editSubjects.length ===
                  0
                }
              />

              {/* ERROR */}

              {error ? (
                <Text
                  style={
                    styles.formError
                  }
                >
                  {error}
                </Text>
              ) : null}

              {/* SAVE */}

              <Pressable
                disabled={
                  saving
                }
                onPress={
                  saveEdit
                }
                style={({
                  pressed,
                }) => [
                  styles.saveButton,

                  (
                    pressed ||
                    saving
                  ) &&
                    styles.buttonDim,
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.saveText
                    }
                  >
                    Save Changes
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ================================================= */}
      {/* DELETE MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          deleteOpen
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          !deleting &&
          setDeleteOpen(
            false,
          )
        }
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.deleteCard
            }
          >
            <View
              style={
                styles.trashIcon
              }
            >
              <Ionicons
                name="trash-outline"
                size={27}
                color="#EF4444"
              />
            </View>

            <Text
              style={
                styles.deleteTitle
              }
            >
              Delete teacher?
            </Text>

            <Text
              style={
                styles.deleteDescription
              }
            >
              {
                teacher.full_name
              }
            </Text>

            {error ? (
              <Text
                style={
                  styles.deleteError
                }
              >
                {error}
              </Text>
            ) : null}

            <View
              style={
                styles.deleteActions
              }
            >
              <Pressable
                disabled={
                  deleting
                }
                onPress={() =>
                  setDeleteOpen(
                    false,
                  )
                }
                style={
                  styles.cancelButton
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  deleting
                }
                onPress={
                  deleteTeacher
                }
                style={
                  styles.confirmDelete
                }
              >
                {deleting ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmDeleteText
                    }
                  >
                    Delete
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * INFO ROW
 * =========================================================
 */

type InfoRowProps = {
  icon:
    | 'person-outline'
    | 'school-outline'
    | 'location-outline'
    | 'call-outline';

  label:
    string;

  value:
    string;
};

function InfoRow({
  icon,
  label,
  value,
}: InfoRowProps) {
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
          size={19}
          color="#1671F5"
        />
      </View>

      <View
        style={
          styles.infoText
        }
      >
        <Text
          style={
            styles.infoLabel
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.infoValue
          }
          numberOfLines={
            2
          }
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

/*
 * =========================================================
 * DIVIDER
 * =========================================================
 */

function Divider() {
  return (
    <View
      style={
        styles.divider
      }
    />
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({
    safeArea: {
      flex:
        1,

      backgroundColor:
        '#F7FAFE',
    },

    header: {
      height:
        58,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        14,

      backgroundColor:
        '#FBFDFF',

      borderBottomWidth:
        1,

      borderBottomColor:
        '#EDF1F6',
    },

    backButton: {
      width:
        42,

      height:
        42,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        21,
    },

    backPressed: {
      backgroundColor:
        '#EEF4FA',
    },

    headerTitle: {
      flex:
        1,

      textAlign:
        'center',

      fontSize:
        17,

      fontWeight:
        '800',

      color:
        '#102B59',
    },

    content: {
      paddingHorizontal:
        22,

      paddingTop:
        28,

      paddingBottom:
        60,

      alignItems:
        'center',
    },

    loading: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    empty: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    errorText: {
      color:
        '#EF4444',

      fontSize:
        13,
    },

    avatar: {
      width:
        104,

      height:
        104,

      borderRadius:
        52,

      backgroundColor:
        '#EAF3FF',
    },

    name: {
      marginTop:
        15,

      fontSize:
        22,

      fontWeight:
        '800',

      color:
        '#102B59',

      textAlign:
        'center',
    },

    teacherId: {
      marginTop:
        4,

      fontSize:
        13,

      fontWeight:
        '600',

      color:
        '#8493A8',
    },

    /*
     * INFO CARD
     */

    infoCard: {
      width:
        '100%',

      marginTop:
        28,

      paddingHorizontal:
        14,

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E8EEF5',
    },

    infoRow: {
      minHeight:
        66,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    infoIcon: {
      width:
        38,

      height:
        38,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EAF3FF',
    },

    infoText: {
      flex:
        1,

      marginLeft:
        12,
    },

    infoLabel: {
      fontSize:
        11,

      color:
        '#8C9AAF',
    },

    infoValue: {
      marginTop:
        3,

      fontSize:
        14,

      fontWeight:
        '600',

      color:
        '#263E5E',
    },

    /*
     * SUBJECTS + TEACHING CLASSROOMS
     */

    multiInfoRow: {
      minHeight:
        76,

      flexDirection:
        'row',

      alignItems:
        'flex-start',

      paddingVertical:
        14,
    },

    multiInfoContent: {
      flex:
        1,

      marginLeft:
        12,
    },

    detailChips: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        6,

      marginTop:
        7,
    },

    detailChip: {
      paddingHorizontal:
        9,

      paddingVertical:
        6,

      borderRadius:
        9,

      backgroundColor:
        '#EAF3FF',
    },

    detailChipText: {
      fontSize:
        11.5,

      fontWeight:
        '600',

      color:
        '#1671F5',
    },

    teachingClassChip: {
      minWidth:
        105,

      maxWidth:
        '100%',

      paddingHorizontal:
        10,

      paddingVertical:
        8,

      borderRadius:
        10,

      backgroundColor:
        '#EAF3FF',
    },

    teachingClassName: {
      fontSize:
        11.5,

      fontWeight:
        '800',

      color:
        '#1671F5',
    },

    teachingClassSubjects: {
      marginTop:
        3,

      fontSize:
        9.5,

      lineHeight:
        13,

      fontWeight:
        '500',

      color:
        '#64748B',
    },

    divider: {
      height:
        1,

      backgroundColor:
        '#EEF2F7',
    },

    /*
     * HOMEROOM
     */

    classroomSection: {
      width:
        '100%',

      marginTop:
        24,
    },

    classroomHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        11,
    },

    classroomTitle: {
      fontSize:
        18,

      fontWeight:
        '800',

      color:
        '#102B59',
    },

    classroomSubtitle: {
      marginTop:
        3,

      fontSize:
        11,

      color:
        '#8C9AAF',
    },

    classroomCount: {
      minWidth:
        30,

      height:
        30,

      paddingHorizontal:
        9,

      borderRadius:
        15,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EAF3FF',
    },

    classroomCountText: {
      color:
        '#1671F5',

      fontSize:
        12,

      fontWeight:
        '800',
    },

    classroomList: {
      gap:
        10,
    },

    classroomCard: {
      width:
        '100%',

      minHeight:
        92,

      padding:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E8EEF5',
    },

    classroomIcon: {
      width:
        46,

      height:
        46,

      borderRadius:
        15,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EAF3FF',
    },

    classroomInfo: {
      flex:
        1,

      marginLeft:
        13,
    },

    classroomName: {
      fontSize:
        16,

      fontWeight:
        '800',

      color:
        '#102B59',
    },

    classroomMeta: {
      marginTop:
        3,

      fontSize:
        11,

      fontWeight:
        '500',

      color:
        '#8190A5',
    },

    homeroomBadge: {
      alignSelf:
        'flex-start',

      marginTop:
        7,

      minHeight:
        25,

      paddingHorizontal:
        8,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        4,

      borderRadius:
        8,

      backgroundColor:
        '#EAF3FF',
    },

    homeroomBadgeText: {
      color:
        '#1671F5',

      fontSize:
        10,

      fontWeight:
        '600',
    },

    noClassroomCard: {
      width:
        '100%',

      minHeight:
        82,

      padding:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        20,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E8EEF5',
    },

    noClassroomIcon: {
      width:
        44,

      height:
        44,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F1F5F9',
    },

    noClassroomInfo: {
      flex:
        1,

      marginLeft:
        12,
    },

    noClassroomTitle: {
      fontSize:
        14,

      fontWeight:
        '700',

      color:
        '#263E5E',
    },

    noClassroomText: {
      marginTop:
        3,

      fontSize:
        11,

      color:
        '#8C9AAF',
    },

    /*
     * ACTIONS
     */

    editButton: {
      width:
        '100%',

      height:
        52,

      marginTop:
        22,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,

      borderRadius:
        16,

      backgroundColor:
        '#EAF3FF',
    },

    editText: {
      color:
        '#1671F5',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    deleteButton: {
      width:
        '100%',

      height:
        52,

      marginTop:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,

      borderRadius:
        16,

      backgroundColor:
        '#FFF0F0',
    },

    deleteText: {
      color:
        '#EF4444',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    pressed: {
      opacity:
        0.75,
    },

    /*
     * EDIT FORM
     */

    editContent: {
      paddingHorizontal:
        22,

      paddingTop:
        24,

      paddingBottom:
        50,
    },

    editAvatar: {
      width:
        92,

      height:
        92,

      borderRadius:
        46,

      alignSelf:
        'center',

      marginBottom:
        28,
    },

    inputLabel: {
      marginBottom:
        7,

      paddingHorizontal:
        2,

      fontSize:
        12,

      fontWeight:
        '600',

      color:
        '#65758B',
    },

    input: {
      height:
        52,

      paddingHorizontal:
        15,

      marginBottom:
        16,

      borderRadius:
        16,

      backgroundColor:
        '#FFFFFF',

      borderWidth:
        1,

      borderColor:
        '#E1E8F0',

      color:
        '#102B59',

      fontSize:
        14,
    },

    fieldGap: {
      height:
        16,
    },

    formError: {
      marginTop:
        14,

      color:
        '#EF4444',

      fontSize:
        12.5,
    },

    saveButton: {
      height:
        53,

      marginTop:
        22,

      borderRadius:
        17,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#1671F5',
    },

    buttonDim: {
      opacity:
        0.7,
    },

    saveText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '700',
    },

    /*
     * DELETE MODAL
     */

    overlay: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        24,

      backgroundColor:
        'rgba(15,23,42,0.28)',
    },

    deleteCard: {
      width:
        '100%',

      maxWidth:
        340,

      padding:
        22,

      alignItems:
        'center',

      borderRadius:
        24,

      backgroundColor:
        '#FFFFFF',
    },

    trashIcon: {
      width:
        58,

      height:
        58,

      borderRadius:
        19,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F0',
    },

    deleteTitle: {
      marginTop:
        15,

      fontSize:
        19,

      fontWeight:
        '800',

      color:
        '#102B59',
    },

    deleteDescription: {
      marginTop:
        5,

      fontSize:
        13,

      color:
        '#8190A5',
    },

    deleteError: {
      marginTop:
        12,

      fontSize:
        12,

      color:
        '#EF4444',

      textAlign:
        'center',
    },

    deleteActions: {
      width:
        '100%',

      flexDirection:
        'row',

      gap:
        10,

      marginTop:
        22,
    },

    cancelButton: {
      flex:
        1,

      height:
        47,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#F1F5F9',
    },

    cancelText: {
      color:
        '#475569',

      fontWeight:
        '700',
    },

    confirmDelete: {
      flex:
        1,

      height:
        47,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#EF4444',
    },

    confirmDeleteText: {
      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },
  });