import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  removeSavedAccount,
} from '../../../lib/accountStore';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  type Href,
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  supabase,
} from '../../../lib/supabase';

import {
  useAppSettings,
} from '../../../context/AppSettingsContext';

import SubjectMultiSelect from '../../../components/common/SubjectMultiSelect';

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

  grade_label:
    string;

  section:
    string;

  class_name:
    string;

  homeroom_teacher_user_id:
    | string
    | null;

  subjects:
    string[];

  created_at:
    string;
};

type Teacher = {
  id: string;

  user_id: string;

  full_name: string;

  teacher_id:
    | string
    | null;

  avatar_url:
    | string
    | null;
};

type FormMode =
  | 'create'
  | 'edit';

type AppNotice = {
  title: string;

  message: string;

  type:
    | 'error'
    | 'info'
    | 'success';
};

/*
 * =========================================================
 * GRADES
 * =========================================================
 */

const ELEMENTARY_GRADES = [
  'Nursery',
  'LKG',
  'UKG',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
];

const HIGH_SCHOOL_GRADES = [
  '9',
  '10',
  '11',
  '12',
];

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function getGradeOptions(
  category:
    ClassCategory,
) {
  if (
    category ===
    'high_school'
  ) {
    return HIGH_SCHOOL_GRADES;
  }

  return ELEMENTARY_GRADES;
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

function makeClassName(
  grade:
    string,

  section:
    string,
) {
  const cleanSection =
    section
      .trim()
      .toUpperCase();

  if (
    grade ===
      'Nursery' ||
    grade ===
      'LKG' ||
    grade ===
      'UKG'
  ) {
    return `${grade} ${cleanSection}`;
  }

  return `${grade}${cleanSection}`;
}

function normalizeSubjects(
  values:
    string[],
) {
  const map =
    new Map<
      string,
      string
    >();

  for (
    const value of
    values
  ) {
    const clean =
      value.trim();

    if (!clean) {
      continue;
    }

    const key =
      clean.toLowerCase();

    if (
      !map.has(
        key,
      )
    ) {
      map.set(
        key,
        clean,
      );
    }
  }

  return Array.from(
    map.values(),
  );
}

function getErrorMessage(
  error:
    unknown,
) {
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
async function getFunctionError(
  error: unknown,
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
          body.error,
        );
      }
    }

    if (possible.message) {
      return possible.message;
    }
  } catch {}

  return getErrorMessage(
    error,
  );
}
/*
 * =========================================================
 * MAIN SCREEN
 * =========================================================
 */

export default function ClassesScreen() {
  const router =
    useRouter();

  const {
    colors,
  } =
    useAppSettings();

  /*
   * =====================================================
   * MAIN DATA
   * =====================================================
   */

  const [
    classes,
    setClasses,
  ] =
    useState<
      SchoolClass[]
    >([]);

  const [
    teachers,
    setTeachers,
  ] =
    useState<
      Teacher[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    search,
    setSearch,
  ] =
    useState('');

  /*
   * =====================================================
   * CLASS FORM
   * =====================================================
   */

  const [
    formOpen,
    setFormOpen,
  ] =
    useState(
      false,
    );

  const [
    formMode,
    setFormMode,
  ] =
    useState<
      FormMode
    >(
      'create',
    );

  const [
    editingClassId,
    setEditingClassId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    category,
    setCategory,
  ] =
    useState<
      ClassCategory
    >(
      'elementary',
    );

  const [
    grade,
    setGrade,
  ] =
    useState(
      'Nursery',
    );

  const [
    section,
    setSection,
  ] =
    useState(
      'A',
    );

  const [
    subjects,
    setSubjects,
  ] =
    useState<
      string[]
    >([]);

  const [
    homeroomTeacherId,
    setHomeroomTeacherId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    formError,
    setFormError,
  ] =
    useState('');

  /*
   * =====================================================
   * CUSTOM APP DIALOGS
   * =====================================================
   */

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<
      SchoolClass |
      null
    >(
      null,
    );

  const [
    deleting,
    setDeleting,
  ] =
    useState(
      false,
    );

  const [
    notice,
    setNotice,
  ] =
    useState<
      AppNotice |
      null
    >(
      null,
    );

  /*
   * =====================================================
   * GRADE PICKER
   * =====================================================
   */

  const [
    gradePickerOpen,
    setGradePickerOpen,
  ] =
    useState(
      false,
    );

  /*
   * =====================================================
   * TEACHER PICKER
   * =====================================================
   */

  const [
    teacherPickerOpen,
    setTeacherPickerOpen,
  ] =
    useState(
      false,
    );

  const [
    teacherSearch,
    setTeacherSearch,
  ] =
    useState('');

  /*
   * =====================================================
   * LOAD
   * =====================================================
   */

  const loadData =
    useCallback(
      async (
        isRefresh =
          false,
      ) => {
        try {
          if (
            isRefresh
          ) {
            setRefreshing(
              true,
            );
          } else {
            setLoading(
              true,
            );
          }

          setError('');

          /*
           * ===========================================
           * LOAD CLASSES
           * ===========================================
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
                subjects,
                created_at
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

          const rows:
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
                    ClassCategory,

                grade_label:
                  item.grade_label,

                section:
                  item.section,

                class_name:
                  item.class_name,

                homeroom_teacher_user_id:
                  item.homeroom_teacher_user_id,

                subjects:
                  Array.isArray(
                    item.subjects,
                  )
                    ? item.subjects
                    : [],

                created_at:
                  item.created_at,
              }),
            );

          setClasses(
            rows,
          );

          /*
           * ===========================================
           * LOAD TEACHERS
           * ===========================================
           */

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
                id,
                user_id,
                full_name,
                teacher_id,
                avatar_url
              `)
              .eq(
                'role',
                'teacher',
              )
              .order(
                'full_name',
                {
                  ascending:
                    true,
                },
              );

          if (
            teacherError
          ) {
            throw teacherError;
          }

          const teacherRows:
            Teacher[] =
            (
              teacherData ??
              []
            ).map(
              (
                item,
              ) => ({
                id:
                  item.id,

                user_id:
                  item.user_id,

                full_name:
                  item.full_name,

                teacher_id:
                  item.teacher_id,

                avatar_url:
                  item.avatar_url,
              }),
            );

          setTeachers(
            teacherRows,
          );
        } catch (
          loadError
        ) {
          console.log(
            'LOAD CLASSES:',
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

          setRefreshing(
            false,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadData();
      },
      [
        loadData,
      ],
    ),
  );

  /*
   * =====================================================
   * FILTER
   * =====================================================
   */

  const filteredClasses =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return classes;
        }

        return classes.filter(
          (
            classroom,
          ) => {
            const subjectText =
              classroom.subjects
                .join(
                  ' ',
                );

            const text =
              [
                classroom.class_name,
                classroom.grade_label,
                classroom.section,
                getCategoryLabel(
                  classroom.category,
                ),
                subjectText,
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
        classes,
        search,
      ],
    );

  /*
   * =====================================================
   * TEACHER SEARCH
   * =====================================================
   */

  const filteredTeachers =
    useMemo(
      () => {
        const query =
          teacherSearch
            .trim()
            .toLowerCase();

        if (!query) {
          return teachers;
        }

        return teachers.filter(
          (
            teacher,
          ) => {
            return (
              teacher.full_name
                .toLowerCase()
                .includes(
                  query,
                ) ||
              (
                teacher.teacher_id ??
                ''
              )
                .toLowerCase()
                .includes(
                  query,
                )
            );
          },
        );
      },
      [
        teacherSearch,
        teachers,
      ],
    );

  /*
   * =====================================================
   * SELECTED HOMEROOM TEACHER
   * =====================================================
   */

  const selectedTeacher =
    useMemo(
      () =>
        teachers.find(
          (
            teacher,
          ) =>
            teacher.user_id ===
            homeroomTeacherId,
        ) ??
        null,
      [
        teachers,
        homeroomTeacherId,
      ],
    );

  /*
   * =====================================================
   * OPEN CREATE
   * =====================================================
   */

  function openCreate() {
    setFormMode(
      'create',
    );

    setEditingClassId(
      null,
    );

    setCategory(
      'elementary',
    );

    setGrade(
      'Nursery',
    );

    setSection(
      'A',
    );

    setSubjects(
      [],
    );

    setHomeroomTeacherId(
      null,
    );

    setFormError('');

    setFormOpen(
      true,
    );
  }

  /*
   * =====================================================
   * OPEN EDIT
   * =====================================================
   */

  function openEdit(
    classroom:
      SchoolClass,
  ) {
    setFormMode(
      'edit',
    );

    setEditingClassId(
      classroom.id,
    );

    setCategory(
      classroom.category,
    );

    setGrade(
      classroom.grade_label,
    );

    setSection(
      classroom.section,
    );

    setSubjects(
      classroom.subjects ??
        [],
    );

    setHomeroomTeacherId(
      classroom.homeroom_teacher_user_id,
    );

    setFormError('');

    setFormOpen(
      true,
    );
  }

  /*
   * =====================================================
   * CATEGORY CHANGE
   * =====================================================
   */

  function chooseCategory(
    nextCategory:
      ClassCategory,
  ) {
    setCategory(
      nextCategory,
    );

    const grades =
      getGradeOptions(
        nextCategory,
      );

    if (
      !grades.includes(
        grade,
      )
    ) {
      setGrade(
        grades[0],
      );
    }
  }

  /*
   * =====================================================
   * SAVE CLASS
   * =====================================================
   */

  async function saveClass() {
    const cleanSection =
      section
        .trim()
        .toUpperCase();

    const cleanSubjects =
      normalizeSubjects(
        subjects,
      );

    setFormError('');

    /*
     * ===========================================
     * VALIDATION
     * ===========================================
     */

    if (!grade) {
      setFormError(
        'Choose a grade.',
      );

      return;
    }

    if (
      !/^[A-Z]$/.test(
        cleanSection,
      )
    ) {
      setFormError(
        'Section must be one letter, for example A or B.',
      );

      return;
    }

    if (
      cleanSubjects.length ===
      0
    ) {
      setFormError(
        'Choose at least one subject this class learns.',
      );

      return;
    }

    const className =
      makeClassName(
        grade,
        cleanSection,
      );

    try {
      setSaving(
        true,
      );

      /*
       * ===========================================
       * DUPLICATE CLASS CHECK
       * ===========================================
       */

      const {
        data:
          duplicateRows,
        error:
          duplicateError,
      } =
        await supabase
          .from(
            'school_classes',
          )
          .select(
            'id, class_name',
          )
          .eq(
            'class_name',
            className,
          );

      if (
        duplicateError
      ) {
        throw duplicateError;
      }

      const duplicate =
        (
          duplicateRows ??
          []
        ).find(
          (
            item,
          ) =>
            item.id !==
            editingClassId,
        );

      if (duplicate) {
        setFormError(
          `${className} already exists.`,
        );

        return;
      }

      /*
       * ===========================================
       * EDIT SAFETY
       *
       * We do not allow removing a subject while
       * a teacher is still assigned to teach that
       * subject in this class.
       * ===========================================
       */

      if (
        formMode ===
          'edit' &&
        editingClassId
      ) {
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
            .select(
              'subjects',
            )
            .eq(
              'class_id',
              editingClassId,
            );

        if (
          assignmentError
        ) {
          throw assignmentError;
        }

        const assignedSubjects =
          new Set<
            string
          >();

        for (
          const assignment of
          assignmentData ??
          []
        ) {
          const values =
            Array.isArray(
              assignment.subjects,
            )
              ? assignment.subjects
              : [];

          for (
            const value of
            values
          ) {
            assignedSubjects.add(
              String(
                value,
              )
                .trim()
                .toLowerCase(),
            );
          }
        }

        const newSubjectSet =
          new Set(
            cleanSubjects.map(
              (
                subject,
              ) =>
                subject
                  .trim()
                  .toLowerCase(),
            ),
          );

        const removedAssignedSubjects =
          Array.from(
            assignedSubjects,
          ).filter(
            (
              subject,
            ) =>
              !newSubjectSet.has(
                subject,
              ),
          );

        if (
          removedAssignedSubjects.length >
          0
        ) {
          setFormError(
            `You cannot remove ${removedAssignedSubjects.join(
              ', ',
            )} because a teacher is still assigned to that subject in this class.`,
          );

          return;
        }
      }

      /*
       * ===========================================
       * CREATE
       * ===========================================
       */

      if (
        formMode ===
        'create'
      ) {
        const {
          error:
            createError,
        } =
          await supabase
            .from(
              'school_classes',
            )
            .insert({
              category,

              grade_label:
                grade,

              section:
                cleanSection,

              class_name:
                className,

              homeroom_teacher_user_id:
                homeroomTeacherId,

              subjects:
                cleanSubjects,
            });

        if (
          createError
        ) {
          throw createError;
        }
      }

      /*
       * ===========================================
       * UPDATE
       * ===========================================
       */

      if (
        formMode ===
          'edit' &&
        editingClassId
      ) {
        const {
          error:
            updateError,
        } =
          await supabase
            .from(
              'school_classes',
            )
            .update({
              category,

              grade_label:
                grade,

              section:
                cleanSection,

              class_name:
                className,

              homeroom_teacher_user_id:
                homeroomTeacherId,

              subjects:
                cleanSubjects,
            })
            .eq(
              'id',
              editingClassId,
            );

        if (
          updateError
        ) {
          throw updateError;
        }
      }

      setFormOpen(
        false,
      );

      await loadData();
    } catch (
      saveError
    ) {
      console.log(
        'SAVE CLASS:',
        saveError,
      );

      setFormError(
        getErrorMessage(
          saveError,
        ),
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  function confirmDelete(
    classroom:
      SchoolClass,
  ) {
    setDeleteTarget(
      classroom,
    );
  }

  async function deleteClass(
  classroom:
    SchoolClass,
) {
  try {
    setDeleting(
      true,
    );

    /*
     * ===========================================
     * DELETE EVERYTHING THROUGH BACKEND
     * ===========================================
     */

    const {
      data,
      error:
        functionError,
    } =
      await supabase.functions
        .invoke(
          'delete-class',
          {
            body: {
              classId:
                classroom.id,
            },
          },
        );

    if (functionError) {
      throw new Error(
        await getFunctionError(
          functionError,
        ),
      );
    }

    if (!data?.deleted) {
      throw new Error(
        data?.error ??
          'Could not delete class.',
      );
    }

    /*
     * Remove deleted student accounts
     * from this device's account switcher.
     */

    const deletedStudentIds:
      string[] =
      Array.isArray(
        data.studentUserIds,
      )
        ? data.studentUserIds
        : [];

    for (
      const studentUserId of
      deletedStudentIds
    ) {
      try {
        await removeSavedAccount(
          studentUserId,
        );
      } catch (
        accountError
      ) {
        console.log(
          'REMOVE LOCAL STUDENT ACCOUNT:',
          accountError,
        );
      }
    }

    setDeleteTarget(
      null,
    );

    const warnings =
      Array.isArray(
        data.warnings,
      )
        ? data.warnings
        : [];

    setNotice({
      title:
        'Class Deleted',

      message:
        warnings.length >
        0
          ? `${classroom.class_name} was deleted. ${warnings.join(
              ' ',
            )}`
          : `${classroom.class_name} and all of its students and data were permanently deleted.`,

      type:
        warnings.length >
        0
          ? 'info'
          : 'success',
    });

    await loadData();
  } catch (
    deleteError
  ) {
    console.log(
      'DELETE CLASS:',
      deleteError,
    );

    setDeleteTarget(
      null,
    );

    setNotice({
      title:
        'Delete Failed',

      message:
        getErrorMessage(
          deleteError,
        ),

      type:
        'error',
    });
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
      <View
        style={[
          styles.center,
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
          Loading classes...
        </Text>
      </View>
    );
  }

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <View
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
        {/* HEADER */}

        <View
          style={
            styles.titleRow
          }
        >
          <View
            style={
              styles.titleContent
            }
          >
            <Text
              style={[
                styles.title,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Classes
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Manage classes, subjects and students.
            </Text>
          </View>

          <Pressable
            onPress={
              openCreate
            }
            style={({
              pressed,
            }) => [
              styles.addButton,
              {
                backgroundColor:
                  colors.primary,
              },

              pressed &&
                styles.pressed,
            ]}
          >
            <Ionicons
              name="add"
              size={21}
              color="#FFFFFF"
            />

            <Text
              style={
                styles.addText
              }
            >
              Add
            </Text>
          </Pressable>
        </View>

        {/* SEARCH */}

        <View
          style={[
            styles.searchBox,
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
            size={19}
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
            placeholder="Search class or subject"
            placeholderTextColor={
              colors.textMuted
            }
            style={[
              styles.searchInput,
              {
                color:
                  colors.text,
              },
            ]}
          />

          {search.length >
            0 && (
            <Pressable
              onPress={() =>
                setSearch(
                  '',
                )
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
          )}
        </View>

        {/* LIST HEADER */}

        <View
          style={
            styles.listHeader
          }
        >
          <Text
            style={[
              styles.listTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            All Classes
          </Text>

          <View
            style={[
              styles.countBadge,
              {
                backgroundColor:
                  colors.primarySoft,
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              {
                filteredClasses.length
              }
            </Text>
          </View>
        </View>

        {/* ERROR */}

        {error ? (
          <Pressable
            onPress={() =>
              void loadData(
                true,
              )
            }
            style={[
              styles.errorCard,
              {
                borderColor:
                  colors.border,

                backgroundColor:
                  colors.card,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color="#EF4444"
            />

            <View
              style={
                styles.errorContent
              }
            >
              <Text
                style={
                  styles.errorTitle
                }
              >
                Could not load classes
              </Text>

              <Text
                style={[
                  styles.errorDescription,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {error}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* EMPTY */}

        {!error &&
        filteredClasses.length ===
          0 ? (
          <View
            style={[
              styles.emptyCard,
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
                styles.emptyIcon,
                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name="school-outline"
                size={27}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              No classes found
            </Text>

            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Add your first classroom to get started.
            </Text>
          </View>
        ) : null}

        {/* CLASS CARDS */}

        <View
          style={
            styles.classList
          }
        >
          {filteredClasses.map(
            (
              classroom,
            ) => {
              const teacher =
                teachers.find(
                  (
                    item,
                  ) =>
                    item.user_id ===
                    classroom.homeroom_teacher_user_id,
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
                    styles.classCard,
                    {
                      backgroundColor:
                        colors.card,

                      borderColor:
                        colors.border,
                    },

                    pressed &&
                      styles.pressed,
                  ]}
                >
                  {/* TOP */}

                  <View
                    style={
                      styles.classTop
                    }
                  >
                    <View
                      style={
                        styles.classMain
                      }
                    >
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
                          size={22}
                          color={
                            colors.primary
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.classInfo
                        }
                      >
                        <Text
                          style={[
                            styles.className,
                            {
                              color:
                                colors.text,
                            },
                          ]}
                        >
                          {
                            classroom.class_name
                          }
                        </Text>

                        <Text
                          style={[
                            styles.classMeta,
                            {
                              color:
                                colors.textMuted,
                            },
                          ]}
                        >
                          {getCategoryLabel(
                            classroom.category,
                          )}

                          {' • '}

                          {getGradeLabel(
                            classroom.grade_label,
                          )}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={
                        styles.actions
                      }
                    >
                      <Pressable
                        onPress={(
                          event,
                        ) => {
                          event.stopPropagation();

                          openEdit(
                            classroom,
                          );
                        }}
                        style={[
                          styles.actionButton,
                          {
                            backgroundColor:
                              colors.primarySoft,
                          },
                        ]}
                      >
                        <Ionicons
                          name="create-outline"
                          size={17}
                          color={
                            colors.primary
                          }
                        />
                      </Pressable>

                      <Pressable
                        onPress={(
                          event,
                        ) => {
                          event.stopPropagation();

                          confirmDelete(
                            classroom,
                          );
                        }}
                        style={[
                          styles.actionButton,
                          styles.deleteAction,
                        ]}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={17}
                          color="#EF4444"
                        />
                      </Pressable>
                    </View>
                  </View>

                  {/* SUBJECTS */}

                  <View
                    style={[
                      styles.divider,
                      {
                        backgroundColor:
                          colors.border,
                      },
                    ]}
                  />

                  <View
                    style={
                      styles.subjectRow
                    }
                  >
                    <Ionicons
                      name="book-outline"
                      size={15}
                      color={
                        colors.textMuted
                      }
                    />

                    <View
                      style={
                        styles.subjectsContent
                      }
                    >
                      {classroom.subjects.length >
                      0 ? (
                        <>
                          {classroom.subjects
                            .slice(
                              0,
                              3,
                            )
                            .map(
                              (
                                subject,
                              ) => (
                                <View
                                  key={
                                    subject
                                  }
                                  style={[
                                    styles.subjectChip,
                                    {
                                      backgroundColor:
                                        colors.primarySoft,
                                    },
                                  ]}
                                >
                                  <Text
                                    numberOfLines={
                                      1
                                    }
                                    style={[
                                      styles.subjectChipText,
                                      {
                                        color:
                                          colors.primary,
                                      },
                                    ]}
                                  >
                                    {
                                      subject
                                    }
                                  </Text>
                                </View>
                              ),
                            )}

                          {classroom.subjects.length >
                            3 && (
                            <Text
                              style={[
                                styles.moreSubjects,
                                {
                                  color:
                                    colors.textMuted,
                                },
                              ]}
                            >
                              +
                              {classroom.subjects.length -
                                3}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text
                          style={[
                            styles.noSubjects,
                            {
                              color:
                                colors.textMuted,
                            },
                          ]}
                        >
                          No subjects selected
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* TEACHER */}

                  <View
                    style={
                      styles.teacherRow
                    }
                  >
                    <View
                      style={[
                        styles.teacherIcon,
                        {
                          backgroundColor:
                            colors.primarySoft,
                        },
                      ]}
                    >
                      <Ionicons
                        name="person-outline"
                        size={14}
                        color={
                          colors.primary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.teacherInfo
                      }
                    >
                      <Text
                        style={[
                          styles.teacherLabel,
                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Homeroom teacher
                      </Text>

                      <Text
                        style={[
                          styles.teacherName,
                          {
                            color:
                              colors.text,
                          },
                        ]}
                      >
                        {teacher
                          ?.full_name ??
                          'Not assigned'}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        colors.textMuted
                      }
                    />
                  </View>
                </Pressable>
              );
            },
          )}
        </View>

        {refreshing ? (
          <ActivityIndicator
            style={
              styles.refreshIndicator
            }
            color={
              colors.primary
            }
          />
        ) : null}
      </ScrollView>

      {/* ================================================= */}
      {/* ADD / EDIT CLASS MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          formOpen
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setFormOpen(
            false,
          )
        }
      >
        <View
          style={[
            styles.modalScreen,
            {
              backgroundColor:
                colors.background,
            },
          ]}
        >
          {/* MODAL HEADER */}

          <View
            style={[
              styles.modalHeader,
              {
                borderBottomColor:
                  colors.border,

                backgroundColor:
                  colors.background,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                setFormOpen(
                  false,
                )
              }
              style={
                styles.headerButton
              }
            >
              <Ionicons
                name="chevron-back"
                size={23}
                color={
                  colors.text
                }
              />
            </Pressable>

            <Text
              style={[
                styles.modalTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {formMode ===
              'create'
                ? 'Add Class'
                : 'Edit Class'}
            </Text>

            <View
              style={
                styles.headerButton
              }
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.formContent
            }
          >
            {/* CLASS PREVIEW */}

            <View
              style={[
                styles.previewCard,
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
                  styles.previewIcon,
                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={24}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View>
                <Text
                  style={[
                    styles.previewName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {makeClassName(
                    grade,
                    section ||
                      'A',
                  )}
                </Text>

                <Text
                  style={[
                    styles.previewMeta,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {getCategoryLabel(
                    category,
                  )}

                  {' • '}

                  {getGradeLabel(
                    grade,
                  )}
                </Text>
              </View>
            </View>

            {/* CATEGORY */}

            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Category
            </Text>

            <View
              style={
                styles.categoryRow
              }
            >
              <Pressable
                onPress={() =>
                  chooseCategory(
                    'elementary',
                  )
                }
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor:
                      category ===
                      'elementary'
                        ? colors.primarySoft
                        : colors.input,

                    borderColor:
                      category ===
                      'elementary'
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={
                    category ===
                    'elementary'
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={18}
                  color={
                    category ===
                    'elementary'
                      ? colors.primary
                      : colors.textMuted
                  }
                />

                <Text
                  style={[
                    styles.categoryText,
                    {
                      color:
                        category ===
                        'elementary'
                          ? colors.primary
                          : colors.text,
                    },
                  ]}
                >
                  Elementary
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  chooseCategory(
                    'high_school',
                  )
                }
                style={[
                  styles.categoryButton,
                  {
                    backgroundColor:
                      category ===
                      'high_school'
                        ? colors.primarySoft
                        : colors.input,

                    borderColor:
                      category ===
                      'high_school'
                        ? colors.primary
                        : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={
                    category ===
                    'high_school'
                      ? 'radio-button-on'
                      : 'radio-button-off'
                  }
                  size={18}
                  color={
                    category ===
                    'high_school'
                      ? colors.primary
                      : colors.textMuted
                  }
                />

                <Text
                  style={[
                    styles.categoryText,
                    {
                      color:
                        category ===
                        'high_school'
                          ? colors.primary
                          : colors.text,
                    },
                  ]}
                >
                  High School
                </Text>
              </Pressable>
            </View>

            {/* GRADE */}

            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Grade
            </Text>

            <Pressable
              onPress={() =>
                setGradePickerOpen(
                  true,
                )
              }
              style={[
                styles.selectBox,
                {
                  backgroundColor:
                    colors.input,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.selectLeft
                }
              >
                <Ionicons
                  name="school-outline"
                  size={18}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={[
                    styles.selectText,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {
                    getGradeLabel(
                      grade,
                    )
                  }
                </Text>
              </View>

              <Ionicons
                name="chevron-down"
                size={18}
                color={
                  colors.textMuted
                }
              />
            </Pressable>

            {/* SECTION */}

            <Text
              style={[
                styles.label,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Section
            </Text>

            <TextInput
              value={
                section
              }
              onChangeText={(
                value,
              ) =>
                setSection(
                  value
                    .replace(
                      /[^a-zA-Z]/g,
                      '',
                    )
                    .slice(
                      0,
                      1,
                    )
                    .toUpperCase(),
                )
              }
              placeholder="A"
              placeholderTextColor={
                colors.textMuted
              }
              autoCapitalize="characters"
              maxLength={1}
              style={[
                styles.input,
                {
                  backgroundColor:
                    colors.input,

                  borderColor:
                    colors.border,

                  color:
                    colors.text,
                },
              ]}
            />

            {/* =========================================== */}
            {/* SUBJECTS */}
            {/* =========================================== */}

            <View
              style={
                styles.subjectLabelRow
              }
            >
              <View>
                <Text
                  style={[
                    styles.label,
                    styles.subjectMainLabel,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  Subjects
                </Text>

                <Text
                  style={[
                    styles.fieldHint,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Choose subjects this class learns.
                </Text>
              </View>

              {subjects.length >
                0 && (
                <View
                  style={[
                    styles.selectedCount,
                    {
                      backgroundColor:
                        colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.selectedCountText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {
                      subjects.length
                    }
                  </Text>
                </View>
              )}
            </View>

            <SubjectMultiSelect
              value={
                subjects
              }
              onChange={
                setSubjects
              }
            />

            {/* HOMEROOM TEACHER */}

            <Text
              style={[
                styles.label,
                styles.teacherFieldLabel,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Homeroom Teacher
            </Text>

            <Pressable
              onPress={() => {
                setTeacherSearch(
                  '',
                );

                setTeacherPickerOpen(
                  true,
                );
              }}
              style={[
                styles.selectBox,
                {
                  backgroundColor:
                    colors.input,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              <View
                style={
                  styles.selectLeft
                }
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={
                    colors.primary
                  }
                />

                <View>
                  <Text
                    style={[
                      styles.selectText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {selectedTeacher
                      ?.full_name ??
                      'Choose teacher'}
                  </Text>

                  {selectedTeacher
                    ?.teacher_id ? (
                    <Text
                      style={[
                        styles.selectedTeacherId,
                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {
                        selectedTeacher.teacher_id
                      }
                    </Text>
                  ) : null}
                </View>
              </View>

              <Ionicons
                name="chevron-down"
                size={18}
                color={
                  colors.textMuted
                }
              />
            </Pressable>

            <Text
              style={[
                styles.fieldHint,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Optional. Teaching subjects are assigned separately.
            </Text>

            {/* ERROR */}

            {formError ? (
              <View
                style={
                  styles.formErrorBox
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={17}
                  color="#EF4444"
                />

                <Text
                  style={
                    styles.formErrorText
                  }
                >
                  {
                    formError
                  }
                </Text>
              </View>
            ) : null}

            {/* SAVE */}

            <Pressable
              disabled={
                saving
              }
              onPress={() =>
                void saveClass()
              }
              style={({
                pressed,
              }) => [
                styles.saveButton,
                {
                  backgroundColor:
                    colors.primary,
                },

                pressed &&
                  styles.pressed,

                saving &&
                  styles.disabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <>
                  <Ionicons
                    name={
                      formMode ===
                      'create'
                        ? 'add-circle-outline'
                        : 'checkmark-circle-outline'
                    }
                    size={19}
                    color="#FFFFFF"
                  />

                  <Text
                    style={
                      styles.saveText
                    }
                  >
                    {formMode ===
                    'create'
                      ? 'Create Class'
                      : 'Save Changes'}
                  </Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* GRADE PICKER */}
      {/* ================================================= */}

      <Modal
        visible={
          gradePickerOpen
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          setGradePickerOpen(
            false,
          )
        }
      >
        <Pressable
          style={
            styles.overlay
          }
          onPress={() =>
            setGradePickerOpen(
              false,
            )
          }
        >
          <Pressable
            style={[
              styles.pickerCard,
              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,
              },
            ]}
            onPress={() => {}}
          >
            <View
              style={
                styles.pickerHeader
              }
            >
              <Text
                style={[
                  styles.pickerTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Choose Grade
              </Text>

              <Pressable
                onPress={() =>
                  setGradePickerOpen(
                    false,
                  )
                }
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={
                    colors.text
                  }
                />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              {getGradeOptions(
                category,
              ).map(
                (
                  item,
                ) => {
                  const selected =
                    item ===
                    grade;

                  return (
                    <Pressable
                      key={
                        item
                      }
                      onPress={() => {
                        setGrade(
                          item,
                        );

                        setGradePickerOpen(
                          false,
                        );
                      }}
                      style={[
                        styles.pickerRow,
                        {
                          borderBottomColor:
                            colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pickerRowText,
                          {
                            color:
                              selected
                                ? colors.primary
                                : colors.text,
                          },
                        ]}
                      >
                        {
                          getGradeLabel(
                            item,
                          )
                        }
                      </Text>

                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={
                            colors.primary
                          }
                        />
                      ) : null}
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ================================================= */}
      {/* TEACHER PICKER */}
      {/* ================================================= */}

      <Modal
        visible={
          teacherPickerOpen
        }
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setTeacherPickerOpen(
            false,
          )
        }
      >
        <View
          style={[
            styles.teacherPickerScreen,
            {
              backgroundColor:
                colors.background,
            },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor:
                  colors.background,

                borderBottomColor:
                  colors.border,
              },
            ]}
          >
            <Pressable
              onPress={() =>
                setTeacherPickerOpen(
                  false,
                )
              }
              style={
                styles.headerButton
              }
            >
              <Ionicons
                name="chevron-back"
                size={23}
                color={
                  colors.text
                }
              />
            </Pressable>

            <Text
              style={[
                styles.modalTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Homeroom Teacher
            </Text>

            <View
              style={
                styles.headerButton
              }
            />
          </View>

          <View
            style={
              styles.teacherPickerContent
            }
          >
            <View
              style={[
                styles.searchBox,
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
                size={19}
                color={
                  colors.textMuted
                }
              />

              <TextInput
                value={
                  teacherSearch
                }
                onChangeText={
                  setTeacherSearch
                }
                placeholder="Search teacher"
                placeholderTextColor={
                  colors.textMuted
                }
                style={[
                  styles.searchInput,
                  {
                    color:
                      colors.text,
                  },
                ]}
              />
            </View>

            {/* NO TEACHER */}

            <Pressable
              onPress={() => {
                setHomeroomTeacherId(
                  null,
                );

                setTeacherPickerOpen(
                  false,
                );
              }}
              style={[
                styles.teacherPickerRow,
                {
                  backgroundColor:
                    colors.card,

                  borderColor:
                    homeroomTeacherId ===
                    null
                      ? colors.primary
                      : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.teacherPickerAvatar,
                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name="person-remove-outline"
                  size={20}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.teacherPickerInfo
                }
              >
                <Text
                  style={[
                    styles.teacherPickerName,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  No homeroom teacher
                </Text>

                <Text
                  style={[
                    styles.teacherPickerId,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Assign later
                </Text>
              </View>

              {homeroomTeacherId ===
              null ? (
                <Ionicons
                  name="checkmark-circle"
                  size={21}
                  color={
                    colors.primary
                  }
                />
              ) : null}
            </Pressable>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.teacherList
              }
            >
              {filteredTeachers.map(
                (
                  teacher,
                ) => {
                  const selected =
                    teacher.user_id ===
                    homeroomTeacherId;

                  return (
                    <Pressable
                      key={
                        teacher.user_id
                      }
                      onPress={() => {
                        setHomeroomTeacherId(
                          teacher.user_id,
                        );

                        setTeacherPickerOpen(
                          false,
                        );
                      }}
                      style={[
                        styles.teacherPickerRow,
                        {
                          backgroundColor:
                            colors.card,

                          borderColor:
                            selected
                              ? colors.primary
                              : colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.teacherPickerAvatar,
                          {
                            backgroundColor:
                              colors.primarySoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.teacherInitial,
                            {
                              color:
                                colors.primary,
                            },
                          ]}
                        >
                          {
                            teacher.full_name
                              .trim()
                              .charAt(
                                0,
                              )
                              .toUpperCase()
                          }
                        </Text>
                      </View>

                      <View
                        style={
                          styles.teacherPickerInfo
                        }
                      >
                        <Text
                          style={[
                            styles.teacherPickerName,
                            {
                              color:
                                colors.text,
                            },
                          ]}
                        >
                          {
                            teacher.full_name
                          }
                        </Text>

                        <Text
                          style={[
                            styles.teacherPickerId,
                            {
                              color:
                                colors.textMuted,
                            },
                          ]}
                        >
                          {teacher.teacher_id ??
                            'Teacher'}
                        </Text>
                      </View>

                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={21}
                          color={
                            colors.primary
                          }
                        />
                      ) : (
                        <Ionicons
                          name="ellipse-outline"
                          size={21}
                          color={
                            colors.border
                          }
                        />
                      )}
                    </Pressable>
                  );
                },
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* CUSTOM DELETE CONFIRMATION */}
      {/* ================================================= */}

      <Modal
        visible={
          deleteTarget !==
          null
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (
            !deleting
          ) {
            setDeleteTarget(
              null,
            );
          }
        }}
      >
        <View
          style={
            styles.dialogOverlay
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            disabled={
              deleting
            }
            onPress={() =>
              setDeleteTarget(
                null,
              )
            }
          />

          <View
            style={[
              styles.dialogCard,
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
                styles.dialogIcon,
                styles.dialogDangerIcon,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={23}
                color="#EF4444"
              />
            </View>

            <Text
              style={[
                styles.dialogTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Delete Class
            </Text>

            <Text
              style={[
                styles.dialogMessage,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {deleteTarget
  ? `Permanently delete ${deleteTarget.class_name}? All students in this class, their login accounts, attendance, results and class data will be deleted. Teacher accounts will not be deleted. This cannot be undone.`
  : ''}
            </Text>

            <View
              style={
                styles.dialogActions
              }
            >
              <Pressable
                disabled={
                  deleting
                }
                onPress={() =>
                  setDeleteTarget(
                    null,
                  )
                }
                style={[
                  styles.dialogButton,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dialogCancelText,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  deleting ||
                  !deleteTarget
                }
                onPress={() => {
                  if (
                    deleteTarget
                  ) {
                    void deleteClass(
                      deleteTarget,
                    );
                  }
                }}
                style={[
                  styles.dialogButton,
                  styles.dialogDeleteButton,
                  {
                    opacity:
                      deleting
                        ? 0.7
                        : 1,
                  },
                ]}
              >
                {deleting ? (
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={16}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.dialogDeleteText
                      }
                    >
                      Delete
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================= */}
      {/* CUSTOM NOTICE / ERROR POPUP */}
      {/* ================================================= */}

      <Modal
        visible={
          notice !==
          null
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setNotice(
            null,
          )
        }
      >
        <View
          style={
            styles.dialogOverlay
          }
        >
          <Pressable
            style={
              StyleSheet.absoluteFill
            }
            onPress={() =>
              setNotice(
                null,
              )
            }
          />

          <View
            style={[
              styles.dialogCard,
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
                styles.dialogIcon,

                notice?.type ===
                'success'
                  ? styles.dialogSuccessIcon
                  : notice?.type ===
                    'info'
                    ? styles.dialogInfoIcon
                    : styles.dialogDangerIcon,
              ]}
            >
              <Ionicons
                name={
                  notice?.type ===
                  'success'
                    ? 'checkmark-circle-outline'
                    : notice?.type ===
                      'info'
                      ? 'information-circle-outline'
                      : 'alert-circle-outline'
                }
                size={24}
                color={
                  notice?.type ===
                  'success'
                    ? '#16A34A'
                    : notice?.type ===
                      'info'
                      ? colors.primary
                      : '#EF4444'
                }
              />
            </View>

            <Text
              style={[
                styles.dialogTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {
                notice?.title ??
                ''
              }
            </Text>

            <Text
              style={[
                styles.dialogMessage,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {
                notice?.message ??
                ''
              }
            </Text>

            <Pressable
              onPress={() =>
                setNotice(
                  null,
                )
              }
              style={[
                styles.dialogOkayButton,
                {
                  backgroundColor:
                    colors.primary,
                },
              ]}
            >
              <Text
                style={
                  styles.dialogOkayText
                }
              >
                OK
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({
    screen: {
      flex:
        1,
    },

    center: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        10,
    },

    loadingText: {
      fontSize:
        13,

      fontWeight:
        '500',
    },

    content: {
      paddingHorizontal:
        18,

      paddingTop:
        18,

      paddingBottom:
        130,
    },

    titleRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        12,
    },

    titleContent: {
      flex:
        1,
    },

    title: {
      fontSize:
        26,

      fontWeight:
        '800',
    },

    subtitle: {
      marginTop:
        4,

      fontSize:
        12,

      lineHeight:
        17,
    },

    addButton: {
      height:
        42,

      paddingHorizontal:
        14,

      borderRadius:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        5,
    },

    addText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    pressed: {
      opacity:
        0.72,
    },

    disabled: {
      opacity:
        0.6,
    },

    searchBox: {
      marginTop:
        18,

      minHeight:
        46,

      borderWidth:
        1,

      borderRadius:
        14,

      paddingHorizontal:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,
    },

    searchInput: {
      flex:
        1,

      minHeight:
        44,

      paddingVertical:
        0,

      fontSize:
        14,
    },

    listHeader: {
      marginTop:
        20,

      marginBottom:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        8,
    },

    listTitle: {
      fontSize:
        16,

      fontWeight:
        '800',
    },

    countBadge: {
      minWidth:
        24,

      height:
        24,

      paddingHorizontal:
        7,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    countText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    errorCard: {
      borderWidth:
        1,

      borderRadius:
        14,

      padding:
        13,

      flexDirection:
        'row',

      gap:
        10,

      marginBottom:
        12,
    },

    errorContent: {
      flex:
        1,
    },

    errorTitle: {
      color:
        '#EF4444',

      fontSize:
        13,

      fontWeight:
        '700',
    },

    errorDescription: {
      marginTop:
        2,

      fontSize:
        11,

      lineHeight:
        16,
    },

    emptyCard: {
      borderWidth:
        1,

      borderRadius:
        18,

      padding:
        30,

      alignItems:
        'center',
    },

    emptyIcon: {
      width:
        54,

      height:
        54,

      borderRadius:
        17,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop:
        13,

      fontSize:
        15,

      fontWeight:
        '800',
    },

    emptyText: {
      marginTop:
        5,

      fontSize:
        12,

      textAlign:
        'center',

      lineHeight:
        17,
    },

    classList: {
      gap:
        11,
    },

    classCard: {
      borderWidth:
        1,

      borderRadius:
        18,

      padding:
        14,
    },

    classTop: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        10,
    },

    classMain: {
      flex:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        11,
    },

    classIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    classInfo: {
      flex:
        1,
    },

    className: {
      fontSize:
        16,

      fontWeight:
        '800',
    },

    classMeta: {
      marginTop:
        3,

      fontSize:
        11,
    },

    actions: {
      flexDirection:
        'row',

      gap:
        7,
    },

    actionButton: {
      width:
        34,

      height:
        34,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    deleteAction: {
      backgroundColor:
        '#FEECEE',
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      marginVertical:
        12,
    },

    subjectRow: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        8,
    },

    subjectsContent: {
      flex:
        1,

      flexDirection:
        'row',

      flexWrap:
        'wrap',

      alignItems:
        'center',

      gap:
        6,
    },

    subjectChip: {
      maxWidth:
        110,

      paddingHorizontal:
        8,

      paddingVertical:
        5,

      borderRadius:
        8,
    },

    subjectChipText: {
      fontSize:
        10,

      fontWeight:
        '600',
    },

    moreSubjects: {
      fontSize:
        10,

      fontWeight:
        '700',
    },

    noSubjects: {
      fontSize:
        11,
    },

    teacherRow: {
      marginTop:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    teacherIcon: {
      width:
        31,

      height:
        31,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    teacherInfo: {
      flex:
        1,

      marginLeft:
        9,
    },

    teacherLabel: {
      fontSize:
        9,
    },

    teacherName: {
      marginTop:
        2,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    refreshIndicator: {
      marginTop:
        20,
    },

    /*
     * MODAL
     */

    modalScreen: {
      flex:
        1,
    },

    modalHeader: {
      height:
        58,

      paddingHorizontal:
        14,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    headerButton: {
      width:
        38,

      height:
        38,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    modalTitle: {
      fontSize:
        15,

      fontWeight:
        '800',
    },

    formContent: {
      padding:
        18,

      paddingBottom:
        60,
    },

    previewCard: {
      borderWidth:
        1,

      borderRadius:
        17,

      padding:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        11,

      marginBottom:
        19,
    },

    previewIcon: {
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
    },

    previewName: {
      fontSize:
        18,

      fontWeight:
        '800',
    },

    previewMeta: {
      marginTop:
        3,

      fontSize:
        11,
    },

    label: {
      marginTop:
        15,

      marginBottom:
        7,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    categoryRow: {
      flexDirection:
        'row',

      gap:
        9,
    },

    categoryButton: {
      flex:
        1,

      minHeight:
        47,

      paddingHorizontal:
        12,

      borderWidth:
        1,

      borderRadius:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        8,
    },

    categoryText: {
      fontSize:
        12,

      fontWeight:
        '700',
    },

    selectBox: {
      minHeight:
        51,

      borderWidth:
        1,

      borderRadius:
        14,

      paddingHorizontal:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        10,
    },

    selectLeft: {
      flex:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,
    },

    selectText: {
      fontSize:
        13,

      fontWeight:
        '600',
    },

    selectedTeacherId: {
      marginTop:
        2,

      fontSize:
        9,
    },

    input: {
      height:
        51,

      borderWidth:
        1,

      borderRadius:
        14,

      paddingHorizontal:
        13,

      fontSize:
        14,
    },

    subjectLabelRow: {
      marginTop:
        4,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    subjectMainLabel: {
      marginBottom:
        2,
    },

    fieldHint: {
      marginTop:
        6,

      fontSize:
        10,

      lineHeight:
        14,
    },

    selectedCount: {
      minWidth:
        27,

      height:
        27,

      paddingHorizontal:
        7,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    selectedCountText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    teacherFieldLabel: {
      marginTop:
        20,
    },

    formErrorBox: {
      marginTop:
        17,

      padding:
        11,

      borderRadius:
        11,

      backgroundColor:
        '#FEECEE',

      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        8,
    },

    formErrorText: {
      flex:
        1,

      color:
        '#D92D20',

      fontSize:
        11,

      lineHeight:
        16,

      fontWeight:
        '500',
    },

    saveButton: {
      marginTop:
        22,

      minHeight:
        51,

      borderRadius:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    saveText: {
      color:
        '#FFFFFF',

      fontSize:
        13,

      fontWeight:
        '800',
    },

    /*
     * PICKER
     */

    overlay: {
      flex:
        1,

      backgroundColor:
        'rgba(0,0,0,0.38)',

      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        24,
    },

    pickerCard: {
      width:
        '100%',

      maxHeight:
        '75%',

      borderWidth:
        1,

      borderRadius:
        20,

      overflow:
        'hidden',
    },

    pickerHeader: {
      paddingHorizontal:
        16,

      paddingVertical:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    pickerTitle: {
      fontSize:
        15,

      fontWeight:
        '800',
    },

    pickerRow: {
      minHeight:
        49,

      paddingHorizontal:
        16,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    pickerRowText: {
      fontSize:
        13,

      fontWeight:
        '600',
    },

    /*
     * TEACHER PICKER
     */

    teacherPickerScreen: {
      flex:
        1,
    },

    teacherPickerContent: {
      flex:
        1,

      paddingHorizontal:
        17,

      paddingBottom:
        30,
    },

    teacherList: {
      paddingTop:
        9,

      paddingBottom:
        40,

      gap:
        8,
    },

    teacherPickerRow: {
      minHeight:
        65,

      borderWidth:
        1,

      borderRadius:
        15,

      paddingHorizontal:
        12,

      paddingVertical:
        9,

      marginTop:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    teacherPickerAvatar: {
      width:
        40,

      height:
        40,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    teacherInitial: {
      fontSize:
        15,

      fontWeight:
        '800',
    },

    teacherPickerInfo: {
      flex:
        1,

      marginLeft:
        10,
    },

    teacherPickerName: {
      fontSize:
        13,

      fontWeight:
        '700',
    },

    teacherPickerId: {
      marginTop:
        3,

      fontSize:
        10,
    },

    /*
     * =====================================================
     * CUSTOM APP DIALOG
     * =====================================================
     */

    dialogOverlay: {
      flex:
        1,

      backgroundColor:
        'rgba(8, 15, 30, 0.48)',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        24,
    },

    dialogCard: {
      width:
        '100%',

      maxWidth:
        380,

      paddingHorizontal:
        20,

      paddingTop:
        22,

      paddingBottom:
        18,

      borderWidth:
        1,

      borderRadius:
        22,

      alignItems:
        'center',

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          10,
      },

      shadowOpacity:
        0.18,

      shadowRadius:
        24,

      elevation:
        12,
    },

    dialogIcon: {
      width:
        50,

      height:
        50,

      borderRadius:
        16,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    dialogDangerIcon: {
      backgroundColor:
        'rgba(239, 68, 68, 0.10)',
    },

    dialogInfoIcon: {
      backgroundColor:
        '#EAF3FF',
    },

    dialogSuccessIcon: {
      backgroundColor:
        'rgba(22, 163, 74, 0.10)',
    },

    dialogTitle: {
      marginTop:
        14,

      fontSize:
        17,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    dialogMessage: {
      marginTop:
        7,

      fontSize:
        11.5,

      lineHeight:
        17,

      textAlign:
        'center',
    },

    dialogActions: {
      width:
        '100%',

      marginTop:
        20,

      flexDirection:
        'row',

      gap:
        9,
    },

    dialogButton: {
      flex:
        1,

      minHeight:
        46,

      borderWidth:
        1,

      borderRadius:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        6,
    },

    dialogCancelText: {
      fontSize:
        12,

      fontWeight:
        '700',
    },

    dialogDeleteButton: {
      borderColor:
        '#EF4444',

      backgroundColor:
        '#EF4444',
    },

    dialogDeleteText: {
      color:
        '#FFFFFF',

      fontSize:
        12,

      fontWeight:
        '800',
    },

    dialogOkayButton: {
      width:
        '100%',

      minHeight:
        46,

      marginTop:
        20,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    dialogOkayText: {
      color:
        '#FFFFFF',

      fontSize:
        12,

      fontWeight:
        '800',
    },
  });