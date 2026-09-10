import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from 'expo-router';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useAppSettings,
} from '../../../context/AppSettingsContext';

import {
  supabase,
} from '../../../lib/supabase';

type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'pending';

type SchoolClass = {
  id: string;

  category:
    | 'elementary'
    | 'high_school';

  grade_label: string;

  section: string;

  class_name: string;
};

type Student = {
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
};

type AttendanceStatusMap =
  Record<
    string,
    AttendanceStatus
  >;

type ToastType =
  | 'success'
  | 'error'
  | 'info';

type ToastState = {
  title: string;

  message: string;

  type: ToastType;
} | null;

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

function pad2(
  value: number,
) {
  return String(
    value,
  ).padStart(
    2,
    '0',
  );
}

/*
 * IMPORTANT:
 *
 * This uses the phone's LOCAL calendar date,
 * not UTC.
 *
 * Example:
 * Sep 9, 2026
 * -> 2026-09-09
 */
function toDateKey(
  date: Date,
) {
  return [
    date.getFullYear(),
    pad2(
      date.getMonth() +
        1,
    ),
    pad2(
      date.getDate(),
    ),
  ].join(
    '-',
  );
}

function getStartOfDay(
  date: Date,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function getToday() {
  return getStartOfDay(
    new Date(),
  );
}

function addDays(
  date: Date,
  amount: number,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() +
      amount,
  );
}

function isSameDay(
  first: Date,
  second: Date,
) {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate()
  );
}

function formatMonthDay(
  date: Date,
) {
  return `${
    date.getMonth() +
    1
  }/${pad2(
    date.getDate(),
  )}`;
}

function formatLongDate(
  date: Date,
) {
  return date.toLocaleDateString(
    undefined,
    {
      weekday:
        'long',

      month:
        'long',

      day:
        'numeric',
    },
  );
}

function getErrorMessage(
  error: unknown,
) {
  if (
    error &&
    typeof error ===
      'object'
  ) {
    const value =
      error as {
        message?: string;

        details?: string;

        hint?: string;
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

export default function AttendanceScreen() {
  const {
    colors,
  } =
    useAppSettings();

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState<Date>(
      getToday(),
    );

  const [
    schoolClass,
    setSchoolClass,
  ] =
    useState<SchoolClass | null>(
      null,
    );

  const [
    students,
    setStudents,
  ] =
    useState<Student[]>(
      [],
    );

  const [
    statuses,
    setStatuses,
  ] =
    useState<AttendanceStatusMap>(
      {},
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    dirty,
    setDirty,
  ] =
    useState(
      false,
    );

  const [
    savedAt,
    setSavedAt,
  ] =
    useState<
      string | null
    >(null);

  const [
    toast,
    setToast,
  ] =
    useState<ToastState>(
      null,
    );

  const toastY =
    useRef(
      new Animated.Value(
        -120,
      ),
    ).current;

  const toastTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const hideToast =
    useCallback(() => {
      if (
        toastTimer.current
      ) {
        clearTimeout(
          toastTimer.current,
        );

        toastTimer.current =
          null;
      }

      Animated.timing(
        toastY,
        {
          toValue:
            -120,

          duration:
            180,

          easing:
            Easing.in(
              Easing.cubic,
            ),

          useNativeDriver:
            true,
        },
      ).start(
        ({
          finished,
        }) => {
          if (
            finished
          ) {
            setToast(
              null,
            );
          }
        },
      );
    }, [
      toastY,
    ]);

  const showToast =
    useCallback(
      (
        title: string,
        message: string,
        type: ToastType,
      ) => {
        if (
          toastTimer.current
        ) {
          clearTimeout(
            toastTimer.current,
          );
        }

        setToast({
          title,
          message,
          type,
        });

        toastY.setValue(
          -120,
        );

        Animated.spring(
          toastY,
          {
            toValue:
              0,

            damping:
              19,

            stiffness:
              210,

            mass:
              0.7,

            useNativeDriver:
              true,
          },
        ).start();

        toastTimer.current =
          setTimeout(
            hideToast,
            3000,
          );
      },
      [
        hideToast,
        toastY,
      ],
    );

  useEffect(() => {
    return () => {
      if (
        toastTimer.current
      ) {
        clearTimeout(
          toastTimer.current,
        );
      }
    };
  }, []);

  /*
   * =====================================================
   * LOAD CLASS + STUDENTS + ATTENDANCE
   * =====================================================
   */

  const loadAttendance =
    useCallback(
      async (
        date:
          Date = selectedDate,
      ) => {
        try {
          setLoading(
            true,
          );

          const {
            data:
              authData,
            error:
              authError,
          } =
            await supabase.auth
              .getUser();

          if (
            authError ||
            !authData.user
          ) {
            throw new Error(
              'Teacher account could not be loaded.',
            );
          }

          const teacherUserId =
            authData.user.id;

          /*
           * Teacher's homeroom.
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
                class_name
              `)
              .eq(
                'homeroom_teacher_user_id',
                teacherUserId,
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                },
              )
              .limit(
                1,
              )
              .maybeSingle();

          if (
            classError
          ) {
            throw classError;
          }

          if (
            !classData
          ) {
            setSchoolClass(
              null,
            );

            setStudents(
              [],
            );

            setStatuses(
              {},
            );

            setSavedAt(
              null,
            );

            setDirty(
              false,
            );

            return;
          }

          const classRow: SchoolClass =
            {
              id:
                classData.id,

              category:
                classData.category as
                  SchoolClass['category'],

              grade_label:
                classData.grade_label,

              section:
                classData.section,

              class_name:
                classData.class_name,
            };

          setSchoolClass(
            classRow,
          );

          /*
           * Students sorted A-Z automatically.
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
                user_id,
                full_name,
                first_name,
                last_name,
                student_id,
                avatar_url
              `)
              .eq(
                'role',
                'student',
              )
              .eq(
                'class_id',
                classRow.id,
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

          const studentRows: Student[] =
            (
              studentData ??
              []
            )
              .map(
                (
                  item,
                ) => ({
                  user_id:
                    item.user_id,

                  full_name:
                    item.full_name,

                  first_name:
                    item.first_name ??
                    '',

                  last_name:
                    item.last_name ??
                    '',

                  student_id:
                    item.student_id,

                  avatar_url:
                    item.avatar_url,
                }),
              )
              .sort(
                (
                  a,
                  b,
                ) => {
                  const first =
                    `${
                      a.first_name ||
                      a.full_name
                    } ${
                      a.last_name
                    }`
                      .trim()
                      .toLowerCase();

                  const second =
                    `${
                      b.first_name ||
                      b.full_name
                    } ${
                      b.last_name
                    }`
                      .trim()
                      .toLowerCase();

                  return first.localeCompare(
                    second,
                  );
                },
              );

          setStudents(
            studentRows,
          );

          /*
           * Default everyone to Queue.
           */
          const nextStatuses:
            AttendanceStatusMap =
            {};

          for (
            const student of
            studentRows
          ) {
            nextStatuses[
              student.user_id
            ] =
              'pending';
          }

          /*
           * Find saved session for this date.
           */
          const dateKey =
            toDateKey(
              date,
            );

          const {
            data:
              sessionData,
            error:
              sessionError,
          } =
            await supabase
              .from(
                'attendance_sessions',
              )
              .select(`
                id,
                saved_at
              `)
              .eq(
                'class_id',
                classRow.id,
              )
              .eq(
                'attendance_date',
                dateKey,
              )
              .maybeSingle();

          if (
            sessionError
          ) {
            throw sessionError;
          }

          if (
            !sessionData
          ) {
            setStatuses(
              nextStatuses,
            );

            setSavedAt(
              null,
            );

            setDirty(
              false,
            );

            return;
          }

          /*
           * Load saved statuses.
           */
          const {
            data:
              recordData,
            error:
              recordError,
          } =
            await supabase
              .from(
                'attendance_records',
              )
              .select(`
                student_user_id,
                status
              `)
              .eq(
                'session_id',
                sessionData.id,
              );

          if (
            recordError
          ) {
            throw recordError;
          }

          for (
            const record of
            recordData ??
            []
          ) {
            const status =
              record.status as
                AttendanceStatus;

            if (
              status ===
                'present' ||
              status ===
                'absent' ||
              status ===
                'pending'
            ) {
              nextStatuses[
                record.student_user_id
              ] =
                status;
            }
          }

          setStatuses(
            nextStatuses,
          );

          setSavedAt(
            sessionData.saved_at,
          );

          setDirty(
            false,
          );
        } catch (
          error
        ) {
          console.log(
            'LOAD ATTENDANCE ERROR:',
            error,
          );

          showToast(
            'Unable to load attendance',
            getErrorMessage(
              error,
            ),
            'error',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        selectedDate,
        showToast,
      ],
    );

  useFocusEffect(
    useCallback(() => {
      void loadAttendance(
        selectedDate,
      );
    }, [
      loadAttendance,
      selectedDate,
    ]),
  );

  /*
   * =====================================================
   * COUNTS
   * =====================================================
   */

  const counts =
    useMemo(() => {
      let present =
        0;

      let absent =
        0;

      let pending =
        0;

      for (
        const student of
        students
      ) {
        const status =
          statuses[
            student.user_id
          ] ??
          'pending';

        if (
          status ===
          'present'
        ) {
          present +=
            1;
        } else if (
          status ===
          'absent'
        ) {
          absent +=
            1;
        } else {
          pending +=
            1;
        }
      }

      return {
        present,
        absent,
        pending,
      };
    }, [
      statuses,
      students,
    ]);

  const isToday =
    isSameDay(
      selectedDate,
      getToday(),
    );

  const canGoForward =
    !isToday;

  /*
   * =====================================================
   * STATUS
   * =====================================================
   */

  function setStudentStatus(
    studentUserId:
      string,
    status:
      AttendanceStatus,
  ) {
    setStatuses(
      (
        current,
      ) => {
        const existing =
          current[
            studentUserId
          ] ??
          'pending';

        /*
         * Tap the same selected button again
         * -> return to Queue.
         *
         * This gives us all 3 states with only
         * the X and Check buttons from your sketch.
         */
        const nextStatus =
          existing ===
          status
            ? 'pending'
            : status;

        return {
          ...current,

          [studentUserId]:
            nextStatus,
        };
      },
    );

    setDirty(
      true,
    );
  }

  function markAllQueueAbsent() {
    if (
      counts.pending ===
      0
    ) {
      return;
    }

    setStatuses(
      (
        current,
      ) => {
        const next = {
          ...current,
        };

        for (
          const student of
          students
        ) {
          if (
            (
              next[
                student.user_id
              ] ??
              'pending'
            ) ===
            'pending'
          ) {
            next[
              student.user_id
            ] =
              'absent';
          }
        }

        return next;
      },
    );

    setDirty(
      true,
    );
  }

  /*
   * =====================================================
   * DATE NAVIGATION
   * =====================================================
   */

  async function changeDate(
    amount: number,
  ) {
    if (
      dirty
    ) {
      showToast(
        'Unsaved attendance',
        'Save your changes before changing the date.',
        'info',
      );

      return;
    }

    const nextDate =
      addDays(
        selectedDate,
        amount,
      );

    /*
     * Tomorrow/future = blocked.
     */
    if (
      nextDate.getTime() >
      getToday().getTime()
    ) {
      return;
    }

    setSelectedDate(
      nextDate,
    );
  }

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async function saveAttendance() {
    if (
      !schoolClass
    ) {
      return;
    }

    if (
      students.length ===
      0
    ) {
      showToast(
        'No students',
        'There are no students in this class yet.',
        'info',
      );

      return;
    }

    try {
      setSaving(
        true,
      );

      const records =
        students.map(
          (
            student,
          ) => ({
            student_user_id:
              student.user_id,

            status:
              statuses[
                student.user_id
              ] ??
              'pending',
          }),
        );

      const {
        data,
        error,
      } =
        await supabase.rpc(
          'save_class_attendance',
          {
            p_class_id:
              schoolClass.id,

            p_attendance_date:
              toDateKey(
                selectedDate,
              ),

            p_records:
              records,
          },
        );

      if (
        error
      ) {
        throw error;
      }

      if (
        !data
      ) {
        throw new Error(
          'Attendance could not be saved.',
        );
      }

      setDirty(
        false,
      );

      setSavedAt(
        new Date()
          .toISOString(),
      );

      showToast(
        'Attendance saved',
        `${schoolClass.class_name} attendance was saved successfully.`,
        'success',
      );
    } catch (
      error
    ) {
      console.log(
        'SAVE ATTENDANCE ERROR:',
        error,
      );

      showToast(
        'Could not save attendance',
        getErrorMessage(
          error,
        ),
        'error',
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  /*
   * =====================================================
   * UI HELPERS
   * =====================================================
   */

  function getRowColors(
    status:
      AttendanceStatus,
  ) {
    if (
      status ===
      'present'
    ) {
      return {
        background:
          '#EEFFE8',

        border:
          '#9BE47A',

        badge:
          '#D8FCCD',

        text:
          '#287A26',
      };
    }

    if (
      status ===
      'absent'
    ) {
      return {
        background:
          '#FFF0F0',

        border:
          '#F4A2A2',

        badge:
          '#FFDCDC',

        text:
          '#B42318',
      };
    }

    return {
      background:
        '#FFF9E8',

      border:
        '#F2D486',

      badge:
        '#FFF0B8',

      text:
        '#92710A',
    };
  }

  function renderStudent(
    student:
      Student,
  ) {
    const status =
      statuses[
        student.user_id
      ] ??
      'pending';

    const rowColors =
      getRowColors(
        status,
      );

    const avatar =
      student.avatar_url ??
      generatedAvatar(
        student.full_name,
      );

    return (
      <View
        key={
          student.user_id
        }
        style={
          styles.attendanceRow
        }
      >
        {/* ABSENT */}

        <Pressable
          onPress={() =>
            setStudentStatus(
              student.user_id,
              'absent',
            )
          }
          style={({
            pressed,
          }) => [
            styles.statusButton,

            styles.absentButton,

            status ===
              'absent' &&
              styles.absentButtonSelected,

            pressed && {
              opacity:
                0.7,
            },
          ]}
        >
          <Ionicons
            name="close"
            size={24}
            color={
              status ===
              'absent'
                ? '#FFFFFF'
                : '#DC2626'
            }
          />
        </Pressable>

        {/* STUDENT */}

        <Pressable
          /*
           * Tapping the center card resets back
           * to Queue.
           */
          onPress={() => {
            if (
              status !==
              'pending'
            ) {
              setStudentStatus(
                student.user_id,
                status,
              );
            }
          }}
          style={({
            pressed,
          }) => [
            styles.studentAttendanceCard,

            {
              backgroundColor:
                rowColors.background,

              borderColor:
                rowColors.border,
            },

            pressed && {
              opacity:
                0.85,
            },
          ]}
        >
          <Image
            source={{
              uri:
                avatar,
            }}
            style={
              styles.avatar
            }
          />

          <View
            style={
              styles.studentInfo
            }
          >
            <Text
              numberOfLines={
                1
              }
              style={
                styles.studentName
              }
            >
              {
                student.full_name
              }
            </Text>

            <Text
              style={
                styles.studentId
              }
            >
              {student.student_id ??
                'Student'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,

              {
                backgroundColor:
                  rowColors.badge,
              },
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,

                {
                  color:
                    rowColors.text,
                },
              ]}
            >
              {status ===
              'present'
                ? 'Present'
                : status ===
                    'absent'
                  ? 'Absent'
                  : 'Queue'}
            </Text>
          </View>
        </Pressable>

        {/* PRESENT */}

        <Pressable
          onPress={() =>
            setStudentStatus(
              student.user_id,
              'present',
            )
          }
          style={({
            pressed,
          }) => [
            styles.statusButton,

            styles.presentButton,

            status ===
              'present' &&
              styles.presentButtonSelected,

            pressed && {
              opacity:
                0.7,
            },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={23}
            color={
              status ===
              'present'
                ? '#FFFFFF'
                : '#22A447'
            }
          />
        </Pressable>
      </View>
    );
  }

  const toastIcon =
    toast?.type ===
    'success'
      ? 'checkmark'
      : toast?.type ===
          'error'
        ? 'close'
        : 'information';

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
        contentContainerStyle={
          styles.content
        }
      >
        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
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
              Loading attendance...
            </Text>
          </View>
        ) : !schoolClass ? (
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
                name="calendar-outline"
                size={28}
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
              No homeroom class
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
              You need a homeroom class before taking attendance.
            </Text>
          </View>
        ) : (
          <>
            {/* CLASS */}

            <View
              style={
                styles.topLine
              }
            >
              <View>
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
                    schoolClass.class_name
                  }
                </Text>

                <Text
                  style={[
                    styles.classLabel,

                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Daily Attendance
                </Text>
              </View>

              <View
                style={[
                  styles.azBadge,

                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.azText,

                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  A–Z
                </Text>
              </View>
            </View>

            {/* DATE */}

            <View
              style={[
                styles.dateCard,

                {
                  backgroundColor:
                    colors.card,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() =>
                  changeDate(
                    -1,
                  )
                }
                style={[
                  styles.arrowButton,

                  {
                    backgroundColor:
                      colors.surfaceSecondary,
                  },
                ]}
              >
                <Ionicons
                  name="chevron-back"
                  size={22}
                  color={
                    colors.text
                  }
                />
              </Pressable>

              <View
                style={
                  styles.dateCenter
                }
              >
                <View
                  style={[
                    styles.datePill,

                    {
                      backgroundColor:
                        colors.primarySoft,
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={17}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.monthDay,

                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {formatMonthDay(
                      selectedDate,
                    )}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.longDate,

                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  {formatLongDate(
                    selectedDate,
                  )}
                </Text>
              </View>

              <Pressable
                disabled={
                  !canGoForward
                }
                onPress={() =>
                  changeDate(
                    1,
                  )
                }
                style={[
                  styles.arrowButton,

                  {
                    backgroundColor:
                      colors.surfaceSecondary,

                    opacity:
                      canGoForward
                        ? 1
                        : 0.35,
                  },
                ]}
              >
                <Ionicons
                  name="chevron-forward"
                  size={22}
                  color={
                    colors.text
                  }
                />
              </Pressable>

              <Text
                style={[
                  styles.year,

                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {
                  selectedDate.getFullYear()
                }
              </Text>
            </View>

            {/* SAVED / TODAY */}

            <View
              style={
                styles.dateMetaRow
              }
            >
              <Text
                style={[
                  styles.dateMeta,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {isToday
                  ? 'Today'
                  : 'Past attendance'}
              </Text>

              <Text
                style={[
                  styles.dateMeta,

                  {
                    color:
                      dirty
                        ? '#B7791F'
                        : savedAt
                          ? '#2D8A47'
                          : colors.textMuted,
                  },
                ]}
              >
                {dirty
                  ? 'Unsaved changes'
                  : savedAt
                    ? 'Saved'
                    : 'Not saved yet'}
              </Text>
            </View>

            {/* SUMMARY */}

            <View
              style={
                styles.summaryRow
              }
            >
              <View
                style={[
                  styles.summaryCard,

                  {
                    backgroundColor:
                      '#EEFFE8',

                    borderColor:
                      '#B9EBA7',
                  },
                ]}
              >
                <Text
                  style={
                    styles.presentNumber
                  }
                >
                  {
                    counts.present
                  }
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Present
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,

                  {
                    backgroundColor:
                      '#FFF0F0',

                    borderColor:
                      '#F4BBBB',
                  },
                ]}
              >
                <Text
                  style={
                    styles.absentNumber
                  }
                >
                  {
                    counts.absent
                  }
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Absent
                </Text>
              </View>

              <View
                style={[
                  styles.summaryCard,

                  {
                    backgroundColor:
                      '#FFF9E8',

                    borderColor:
                      '#F1DB9D',
                  },
                ]}
              >
                <Text
                  style={
                    styles.pendingNumber
                  }
                >
                  {
                    counts.pending
                  }
                </Text>

                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Queue
                </Text>
              </View>
            </View>

            {/* STUDENTS */}

            <View
              style={
                styles.studentHeader
              }
            >
              <Text
                style={[
                  styles.studentHeaderTitle,

                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Students
              </Text>

              <Text
                style={[
                  styles.studentHeaderCount,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  students.length
                }
              </Text>
            </View>

            {students.length ===
            0 ? (
              <View
                style={[
                  styles.emptyStudentCard,

                  {
                    backgroundColor:
                      colors.card,

                    borderColor:
                      colors.border,
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

                <Text
                  style={[
                    styles.emptyStudentTitle,

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
                    styles.emptyStudentText,

                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Add students to your class before taking attendance.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.studentList
                }
              >
                {students.map(
                  renderStudent,
                )}
              </View>
            )}

            {/* ACTIONS */}

            {students.length >
              0 && (
              <>
                <Pressable
                  disabled={
                    counts.pending ===
                    0
                  }
                  onPress={
                    markAllQueueAbsent
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.markQueueButton,

                    {
                      backgroundColor:
                        colors.card,

                      borderColor:
                        counts.pending >
                        0
                          ? '#EBA3A3'
                          : colors.border,

                      opacity:
                        counts.pending ===
                        0
                          ? 0.45
                          : pressed
                            ? 0.7
                            : 1,
                    },
                  ]}
                >
                  <View
                    style={
                      styles.markQueueIcon
                    }
                  >
                    <Ionicons
                      name="close"
                      size={17}
                      color="#DC2626"
                    />
                  </View>

                  <View
                    style={
                      styles.markQueueTextArea
                    }
                  >
                    <Text
                      style={[
                        styles.markQueueTitle,

                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      Mark all Queue as Absent
                    </Text>

                    <Text
                      style={[
                        styles.markQueueDescription,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {counts.pending}{' '}
                      student
                      {counts.pending ===
                      1
                        ? ''
                        : 's'}{' '}
                      still waiting
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  disabled={
                    saving
                  }
                  onPress={
                    saveAttendance
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.saveButton,

                    {
                      backgroundColor:
                        colors.primary,

                      opacity:
                        saving
                          ? 0.65
                          : pressed
                            ? 0.82
                            : 1,
                    },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={20}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.saveButtonText
                        }
                      >
                        Save Attendance
                      </Text>
                    </>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}

        <View
          style={{
            height:
              80,
          }}
        />
      </ScrollView>

      {/* TOP NOTIFICATION */}

      {toast && (
        <Animated.View
          style={[
            styles.toastWrapper,

            {
              transform: [
                {
                  translateY:
                    toastY,
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={
              hideToast
            }
            style={[
              styles.toastCard,

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
                styles.toastIcon,

                {
                  backgroundColor:
                    toast.type ===
                    'success'
                      ? '#DCFCE7'
                      : toast.type ===
                          'error'
                        ? '#FEE2E2'
                        : colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name={
                  toastIcon
                }
                size={19}
                color={
                  toast.type ===
                  'success'
                    ? '#16A34A'
                    : toast.type ===
                        'error'
                      ? '#DC2626'
                      : colors.primary
                }
              />
            </View>

            <View
              style={
                styles.toastText
              }
            >
              <Text
                style={[
                  styles.toastTitle,

                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {
                  toast.title
                }
              </Text>

              <Text
                numberOfLines={
                  2
                }
                style={[
                  styles.toastMessage,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  toast.message
                }
              </Text>
            </View>

            <Ionicons
              name="close"
              size={17}
              color={
                colors.textMuted
              }
            />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex:
        1,
    },

    content: {
      paddingHorizontal:
        16,

      paddingTop:
        16,

      paddingBottom:
        110,
    },

    loadingContainer: {
      paddingTop:
        130,

      alignItems:
        'center',

      gap:
        11,
    },

    loadingText: {
      fontSize:
        12,

      fontWeight:
        '500',
    },

    emptyCard: {
      marginTop:
        100,

      borderWidth:
        1,

      borderRadius:
        24,

      padding:
        28,

      alignItems:
        'center',
    },

    emptyIcon: {
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
    },

    emptyTitle: {
      marginTop:
        15,

      fontSize:
        18,

      fontWeight:
        '800',
    },

    emptyText: {
      marginTop:
        7,

      maxWidth:
        270,

      fontSize:
        12,

      lineHeight:
        18,

      textAlign:
        'center',
    },

    topLine: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        13,
    },

    className: {
      fontSize:
        22,

      fontWeight:
        '800',

      letterSpacing:
        -0.4,
    },

    classLabel: {
      marginTop:
        3,

      fontSize:
        11,

      fontWeight:
        '500',
    },

    azBadge: {
      minWidth:
        42,

      height:
        31,

      paddingHorizontal:
        10,

      borderRadius:
        16,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    azText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    dateCard: {
      minHeight:
        82,

      borderWidth:
        1,

      borderRadius:
        21,

      padding:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    arrowButton: {
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

    dateCenter: {
      flex:
        1,

      alignItems:
        'center',

      paddingHorizontal:
        8,
    },

    datePill: {
      minHeight:
        38,

      paddingHorizontal:
        13,

      borderRadius:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    monthDay: {
      fontSize:
        17,

      fontWeight:
        '800',

      letterSpacing:
        -0.25,
    },

    longDate: {
      marginTop:
        5,

      fontSize:
        9.5,

      fontWeight:
        '500',
    },

    year: {
      marginLeft:
        10,

      fontSize:
        16,

      fontWeight:
        '800',
    },

    dateMetaRow: {
      marginTop:
        8,

      paddingHorizontal:
        3,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    dateMeta: {
      fontSize:
        10,

      fontWeight:
        '600',
    },

    summaryRow: {
      marginTop:
        18,

      flexDirection:
        'row',

      gap:
        8,
    },

    summaryCard: {
      flex:
        1,

      minHeight:
        65,

      borderWidth:
        1,

      borderRadius:
        16,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    presentNumber: {
      color:
        '#25843E',

      fontSize:
        20,

      fontWeight:
        '800',
    },

    absentNumber: {
      color:
        '#C33131',

      fontSize:
        20,

      fontWeight:
        '800',
    },

    pendingNumber: {
      color:
        '#97720C',

      fontSize:
        20,

      fontWeight:
        '800',
    },

    summaryLabel: {
      marginTop:
        2,

      color:
        '#64748B',

      fontSize:
        9.5,

      fontWeight:
        '700',
    },

    studentHeader: {
      marginTop:
        24,

      marginBottom:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    studentHeaderTitle: {
      fontSize:
        18,

      fontWeight:
        '800',
    },

    studentHeaderCount: {
      fontSize:
        11,

      fontWeight:
        '600',
    },

    studentList: {
      gap:
        8,
    },

    attendanceRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,
    },

    statusButton: {
      width:
        40,

      height:
        50,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth:
        1,
    },

    absentButton: {
      backgroundColor:
        '#FFF5F5',

      borderColor:
        '#F4B5B5',
    },

    absentButtonSelected: {
      backgroundColor:
        '#DC2626',

      borderColor:
        '#DC2626',
    },

    presentButton: {
      backgroundColor:
        '#F2FFF3',

      borderColor:
        '#AFE5B5',
    },

    presentButtonSelected: {
      backgroundColor:
        '#22A447',

      borderColor:
        '#22A447',
    },

    studentAttendanceCard: {
      flex:
        1,

      minHeight:
        66,

      borderWidth:
        1,

      borderRadius:
        17,

      paddingHorizontal:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    avatar: {
      width:
        39,

      height:
        39,

      borderRadius:
        20,
    },

    studentInfo: {
      flex:
        1,

      marginLeft:
        9,
    },

    studentName: {
      color:
        '#172D4F',

      fontSize:
        12.5,

      fontWeight:
        '700',
    },

    studentId: {
      marginTop:
        2,

      color:
        '#75859A',

      fontSize:
        9.5,

      fontWeight:
        '500',
    },

    statusBadge: {
      minHeight:
        24,

      paddingHorizontal:
        7,

      borderRadius:
        8,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    statusBadgeText: {
      fontSize:
        8.5,

      fontWeight:
        '800',
    },

    emptyStudentCard: {
      minHeight:
        150,

      borderWidth:
        1,

      borderRadius:
        20,

      padding:
        25,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyStudentTitle: {
      marginTop:
        11,

      fontSize:
        15,

      fontWeight:
        '700',
    },

    emptyStudentText: {
      marginTop:
        5,

      maxWidth:
        240,

      textAlign:
        'center',

      fontSize:
        11,

      lineHeight:
        17,
    },

    markQueueButton: {
      minHeight:
        61,

      marginTop:
        20,

      borderWidth:
        1,

      borderRadius:
        17,

      padding:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    markQueueIcon: {
      width:
        39,

      height:
        39,

      borderRadius:
        12,

      backgroundColor:
        '#FEE2E2',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    markQueueTextArea: {
      flex:
        1,

      marginLeft:
        10,
    },

    markQueueTitle: {
      fontSize:
        12.5,

      fontWeight:
        '700',
    },

    markQueueDescription: {
      marginTop:
        2,

      fontSize:
        9.5,

      fontWeight:
        '500',
    },

    saveButton: {
      height:
        54,

      marginTop:
        10,

      borderRadius:
        17,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    saveButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    toastWrapper: {
      position:
        'absolute',

      top:
        10,

      left:
        12,

      right:
        12,

      zIndex:
        9999,

      elevation:
        30,
    },

    toastCard: {
      minHeight:
        70,

      borderWidth:
        1,

      borderRadius:
        20,

      padding:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      elevation:
        12,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          6,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        14,
    },

    toastIcon: {
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
    },

    toastText: {
      flex:
        1,

      marginLeft:
        11,

      marginRight:
        8,
    },

    toastTitle: {
      fontSize:
        13,

      fontWeight:
        '700',
    },

    toastMessage: {
      marginTop:
        2,

      fontSize:
        11,

      lineHeight:
        16,
    },
  });