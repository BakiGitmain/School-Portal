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

type ViewerRole =
  | 'admin'
  | 'teacher';

type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'pending';

type Student = {
  id: string;

  user_id: string;

  full_name: string;

  first_name:
    | string
    | null;

  last_name:
    | string
    | null;

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

  class_id:
    | string
    | null;
};

type SchoolClass = {
  id: string;

  category:
    | 'elementary'
    | 'high_school';

  grade_label: string;

  section: string;

  class_name: string;
};

type AttendanceSession = {
  id: string;

  attendance_date: string;
};

type Props = {
  studentUserId: string;

  viewerRole:
    ViewerRole;
};

type CalendarStatus =
  | AttendanceStatus
  | 'future'
  | 'none';

type AttendancePalette = {
  present: {
    background: string;
    border: string;
    text: string;
    dot: string;
  };

  absent: {
    background: string;
    border: string;
    text: string;
    dot: string;
  };

  pending: {
    background: string;
    border: string;
    text: string;
    dot: string;
  };

  future: {
    background: string;
    border: string;
    text: string;
    dot: string;
  };

  none: {
    background: string;
    border: string;
    text: string;
    dot: string;
  };
};

/*
 * =========================================================
 * SCHOOL ATTENDANCE START
 *
 * You said attendance starts:
 * September 1, 2026.
 *
 * If the school year changes later,
 * we can make this come from school settings.
 * =========================================================
 */

const ATTENDANCE_START_DATE =
  new Date(
    2026,
    8,
    1,
  );

const WEEK_DAYS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

/*
 * =========================================================
 * DATE HELPERS
 * =========================================================
 */

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

function startOfDay(
  date: Date,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function today() {
  return startOfDay(
    new Date(),
  );
}

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

function fromDateKey(
  key: string,
) {
  const [
    year,
    month,
    day,
  ] =
    key
      .split('-')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
}

function sameDate(
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

function sameMonth(
  first: Date,
  second: Date,
) {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth()
  );
}

function monthStart(
  date: Date,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function monthEnd(
  date: Date,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() +
      1,
    0,
  );
}

function addMonths(
  date: Date,
  amount: number,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() +
      amount,
    1,
  );
}

function daysInMonth(
  date: Date,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() +
      1,
    0,
  ).getDate();
}

/*
 * JavaScript:
 *
 * Sunday = 0
 * Monday = 1
 *
 * Our calendar starts Monday.
 */
function mondayIndex(
  date: Date,
) {
  const day =
    date.getDay();

  return day === 0
    ? 6
    : day - 1;
}

function formatMonth(
  date: Date,
) {
  return date.toLocaleDateString(
    undefined,
    {
      month:
        'long',
    },
  );
}

function formatFullDate(
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

      year:
        'numeric',
    },
  );
}

/*
 * =========================================================
 * IMAGE
 * =========================================================
 */

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

/*
 * =========================================================
 * CLASS LABEL
 * =========================================================
 */

function classCategoryLabel(
  category:
    SchoolClass['category'],
) {
  return category ===
    'elementary'
    ? 'Elementary'
    : 'High School';
}

/*
 * =========================================================
 * ERROR
 * =========================================================
 */

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

/*
 * =========================================================
 * DARK MODE DETECTION
 *
 * We detect the luminance of the existing
 * AppSettings background.
 *
 * We are NOT changing system appearance here.
 * =========================================================
 */

function isDarkHex(
  color: string,
) {
  const clean =
    color
      .replace(
        '#',
        '',
      )
      .trim();

  if (
    clean.length !==
    6
  ) {
    return false;
  }

  const red =
    parseInt(
      clean.slice(
        0,
        2,
      ),
      16,
    );

  const green =
    parseInt(
      clean.slice(
        2,
        4,
      ),
      16,
    );

  const blue =
    parseInt(
      clean.slice(
        4,
        6,
      ),
      16,
    );

  const luminance =
    (
      0.299 *
        red +
      0.587 *
        green +
      0.114 *
        blue
    ) /
    255;

  return (
    luminance <
    0.45
  );
}

function getAttendancePalette(
  isDark: boolean,
  colors:
    AppThemeColors,
): AttendancePalette {
  if (
    isDark
  ) {
    return {
      present: {
        background:
          '#182B1B',

        border:
          '#3C6332',

        text:
          '#BEF264',

        dot:
          '#A3E635',
      },

      absent: {
        background:
          '#321A20',

        border:
          '#65313D',

        text:
          '#FDA4AF',

        dot:
          '#FB7185',
      },

      pending: {
        background:
          '#302A18',

        border:
          '#5B4D24',

        text:
          '#FDE68A',

        dot:
          '#FACC15',
      },

      future: {
        background:
          colors.surfaceSecondary,

        border:
          colors.border,

        text:
          colors.textMuted,

        dot:
          colors.textMuted,
      },

      none: {
        background:
          colors.card,

        border:
          colors.border,

        text:
          colors.textSecondary,

        dot:
          colors.textMuted,
      },
    };
  }

  return {
    present: {
      background:
        '#F3FAEB',

      border:
        '#CFE8B3',

      text:
        '#5F8F19',

      dot:
        '#84CC16',
    },

    absent: {
      background:
        '#FFF2F4',

      border:
        '#F3C7CE',

      text:
        '#B6384C',

      dot:
        '#E85D75',
    },

    pending: {
      background:
        '#FFF9E9',

      border:
        '#EEDB9D',

      text:
        '#98720B',

      dot:
        '#EAB308',
    },

    future: {
      background:
        '#F3F6FA',

      border:
        '#E7ECF3',

      text:
        '#A5B0BF',

      dot:
        '#B8C1CC',
    },

    none: {
      background:
        '#FFFFFF',

      border:
        '#E5ECF4',

      text:
        '#607087',

      dot:
        '#A5B0BF',
    },
  };
}

export default function StudentDetailsScreen({
  studentUserId,
  viewerRole,
}: Props) {
  const {
    colors,
  } =
    useAppSettings();

  const isDark =
    useMemo(
      () =>
        isDarkHex(
          colors.background,
        ),
      [
        colors.background,
      ],
    );

  const styles =
    useMemo(
      () =>
        createStyles(
          colors,
          isDark,
        ),
      [
        colors,
        isDark,
      ],
    );

  const palette =
    useMemo(
      () =>
        getAttendancePalette(
          isDark,
          colors,
        ),
      [
        isDark,
        colors,
      ],
    );

  const [
    student,
    setStudent,
  ] =
    useState<Student | null>(
      null,
    );

  const [
    schoolClass,
    setSchoolClass,
  ] =
    useState<SchoolClass | null>(
      null,
    );

  const [
    attendanceByDate,
    setAttendanceByDate,
  ] =
    useState<
      Record<
        string,
        AttendanceStatus
      >
    >({});

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
      string | null
    >(null);

  /*
   * Default selected day:
   * today.
   */
  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState<Date>(
      today(),
    );

  /*
   * Default calendar month:
   * current month.
   */
  const [
    visibleMonth,
    setVisibleMonth,
  ] =
    useState<Date>(
      monthStart(
        today(),
      ),
    );

  /*
   * =====================================================
   * LOAD STUDENT
   * =====================================================
   */

  const loadStudent =
    useCallback(
      async () => {
        if (
          !studentUserId
        ) {
          setError(
            'Student ID was not provided.',
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
           * STUDENT PROFILE
           */

          const {
            data:
              profileData,
            error:
              profileError,
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
                special_case,
                class_id
              `)
              .eq(
                'user_id',
                studentUserId,
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
                'Student not found.',
              )
            );
          }

          const studentRow:
            Student =
            {
              id:
                profileData.id,

              user_id:
                profileData.user_id,

              full_name:
                profileData.full_name,

              first_name:
                profileData.first_name,

              last_name:
                profileData.last_name,

              student_id:
                profileData.student_id,

              avatar_url:
                profileData.avatar_url,

              gender:
                profileData.gender as
                  Student['gender'],

              age:
                profileData.age,

              mother_phone:
                profileData.mother_phone,

              father_phone:
                profileData.father_phone,

              location:
                profileData.location,

              special_case:
                profileData.special_case,

              class_id:
                profileData.class_id,
            };

          setStudent(
            studentRow,
          );

          /*
           * CLASS
           */

          if (
            !studentRow.class_id
          ) {
            setSchoolClass(
              null,
            );

            setAttendanceByDate(
              {},
            );

            return;
          }

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
                'id',
                studentRow.class_id,
              )
              .single();

          if (
            classError ||
            !classData
          ) {
            throw (
              classError ??
              new Error(
                'Student class could not be loaded.',
              )
            );
          }

          const classRow:
            SchoolClass =
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
           * =================================================
           * ATTENDANCE SESSIONS
           *
           * Only:
           *
           * September 1, 2026
           * ->
           * today
           * =================================================
           */

          const {
            data:
              sessionsData,
            error:
              sessionsError,
          } =
            await supabase
              .from(
                'attendance_sessions',
              )
              .select(`
                id,
                attendance_date
              `)
              .eq(
                'class_id',
                classRow.id,
              )
              .gte(
                'attendance_date',
                toDateKey(
                  ATTENDANCE_START_DATE,
                ),
              )
              .lte(
                'attendance_date',
                toDateKey(
                  today(),
                ),
              )
              .order(
                'attendance_date',
                {
                  ascending:
                    true,
                },
              );

          if (
            sessionsError
          ) {
            throw sessionsError;
          }

          const sessions:
            AttendanceSession[] =
            (
              sessionsData ??
              []
            ).map(
              (
                session,
              ) => ({
                id:
                  session.id,

                attendance_date:
                  session.attendance_date,
              }),
            );

          if (
            sessions.length ===
            0
          ) {
            setAttendanceByDate(
              {},
            );

            return;
          }

          const sessionIds =
            sessions.map(
              (
                session,
              ) =>
                session.id,
            );

          /*
           * ATTENDANCE RECORDS
           */

          const {
            data:
              recordsData,
            error:
              recordsError,
          } =
            await supabase
              .from(
                'attendance_records',
              )
              .select(`
                session_id,
                status
              `)
              .eq(
                'student_user_id',
                studentRow.user_id,
              )
              .in(
                'session_id',
                sessionIds,
              );

          if (
            recordsError
          ) {
            throw recordsError;
          }

          const sessionDateMap =
            new Map<
              string,
              string
            >();

          for (
            const session of
            sessions
          ) {
            sessionDateMap.set(
              session.id,
              session.attendance_date,
            );
          }

          const nextAttendance:
            Record<
              string,
              AttendanceStatus
            > =
            {};

          for (
            const record of
            recordsData ??
            []
          ) {
            const status =
              record.status as
                AttendanceStatus;

            if (
              status !==
                'present' &&
              status !==
                'absent' &&
              status !==
                'pending'
            ) {
              continue;
            }

            const dateKey =
              sessionDateMap.get(
                record.session_id,
              );

            if (
              !dateKey
            ) {
              continue;
            }

            nextAttendance[
              dateKey
            ] =
              status;
          }

          setAttendanceByDate(
            nextAttendance,
          );
        } catch (
          loadError
        ) {
          console.log(
            'LOAD STUDENT DETAILS:',
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
        studentUserId,
      ],
    );

  useFocusEffect(
    useCallback(() => {
      void loadStudent();
    }, [
      loadStudent,
    ]),
  );

  /*
   * =====================================================
   * BACK
   * =====================================================
   */

  function goBack() {
    if (
      viewerRole ===
      'teacher'
    ) {
      router.replace(
        '/teacher/students' as Href,
      );

      return;
    }

    if (
      schoolClass
    ) {
      router.replace(
        `/admin/class/${schoolClass.id}` as Href,
      );

      return;
    }

    router.replace(
      '/admin/classes' as Href,
    );
  }

  /*
   * =====================================================
   * CALENDAR RANGE
   * =====================================================
   */

  const currentDay =
    today();

  const currentMonth =
    monthStart(
      currentDay,
    );

  const firstMonth =
    monthStart(
      ATTENDANCE_START_DATE,
    );

  const canGoPreviousMonth =
    visibleMonth.getTime() >
    firstMonth.getTime();

  const canGoNextMonth =
    visibleMonth.getTime() <
    currentMonth.getTime();

  /*
   * =====================================================
   * MONTH MOVEMENT
   * =====================================================
   */

  function moveMonth(
    amount: number,
  ) {
    const target =
      addMonths(
        visibleMonth,
        amount,
      );

    if (
      target.getTime() <
      firstMonth.getTime()
    ) {
      return;
    }

    if (
      target.getTime() >
      currentMonth.getTime()
    ) {
      return;
    }

    setVisibleMonth(
      target,
    );

    /*
     * If moving into the current month:
     * select today.
     *
     * If moving into a past month:
     * select the final day of that month.
     */
    if (
      sameMonth(
        target,
        currentDay,
      )
    ) {
      setSelectedDate(
        currentDay,
      );

      return;
    }

    setSelectedDate(
      monthEnd(
        target,
      ),
    );
  }

  /*
   * =====================================================
   * CALENDAR CELLS
   * =====================================================
   */

  const calendarCells =
    useMemo(() => {
      const first =
        new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth(),
          1,
        );

      const offset =
        mondayIndex(
          first,
        );

      const totalDays =
        daysInMonth(
          visibleMonth,
        );

      const cells:
        Array<
          number | null
        > =
        [];

      for (
        let i = 0;
        i < offset;
        i += 1
      ) {
        cells.push(
          null,
        );
      }

      for (
        let day = 1;
        day <=
        totalDays;
        day += 1
      ) {
        cells.push(
          day,
        );
      }

      while (
        cells.length %
          7 !==
        0
      ) {
        cells.push(
          null,
        );
      }

      return cells;
    }, [
      visibleMonth,
    ]);

  /*
   * =====================================================
   * TOTALS
   * =====================================================
   */

  const totals =
    useMemo(() => {
      let present =
        0;

      let absent =
        0;

      let pending =
        0;

      Object.values(
        attendanceByDate,
      ).forEach(
        (
          status,
        ) => {
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
        },
      );

      return {
        present,
        absent,
        pending,
      };
    }, [
      attendanceByDate,
    ]);

  const markedTotal =
    totals.present +
    totals.absent;

  const attendanceRate =
    markedTotal ===
    0
      ? 0
      : Math.round(
          (
            totals.present /
            markedTotal
          ) *
            100,
        );

  /*
   * =====================================================
   * SELECTED STATUS
   * =====================================================
   */

  const selectedDateKey =
    toDateKey(
      selectedDate,
    );

  const selectedAttendanceStatus =
    attendanceByDate[
      selectedDateKey
    ] ??
    null;

  function getCalendarStatus(
    date: Date,
  ): CalendarStatus {
    if (
      date.getTime() >
      currentDay.getTime()
    ) {
      return 'future';
    }

    const saved =
      attendanceByDate[
        toDateKey(
          date,
        )
      ];

    return (
      saved ??
      'none'
    );
  }

  function selectCalendarDay(
    date: Date,
  ) {
    if (
      date.getTime() >
      currentDay.getTime()
    ) {
      return;
    }

    if (
      date.getTime() <
      ATTENDANCE_START_DATE.getTime()
    ) {
      return;
    }

    setSelectedDate(
      date,
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
          styles.safeArea,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
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
            Loading student...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * =====================================================
   * ERROR
   * =====================================================
   */

  if (
    !student ||
    error
  ) {
    return (
      <SafeAreaView
        style={[
          styles.safeArea,
          {
            backgroundColor:
              colors.background,
          },
        ]}
      >
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
              styles.headerButton
            }
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={
                colors.text
              }
            />
          </Pressable>

          <Text
            style={[
              styles.headerTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            Student
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>

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
            Unable to load student
          </Text>

          <Text
            style={[
              styles.errorMessage,
              {
                color:
                  colors.textMuted,
              },
            ]}
          >
            {error ??
              'Student not found.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const avatar =
    student.avatar_url ??
    generatedAvatar(
      student.full_name,
    );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.background,
        },
      ]}
      edges={[
        'top',
        'left',
        'right',
      ]}
    >
      {/* HEADER */}

      <View
        style={[
          styles.header,
          {
            borderBottomColor:
              colors.border,
          },
        ]}
      >
        <Pressable
          onPress={
            goBack
          }
          style={({
            pressed,
          }) => [
            styles.headerButton,

            {
              backgroundColor:
                colors.surfaceSecondary,

              opacity:
                pressed
                  ? 0.65
                  : 1,
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

        <Text
          style={[
            styles.headerTitle,
            {
              color:
                colors.text,
            },
          ]}
        >
          Student
        </Text>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* ============================================= */}
        {/* STUDENT HERO */}
        {/* ============================================= */}

        <View
          style={[
            styles.studentHero,
            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,
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
              styles.heroInfo
            }
          >
            <Text
              numberOfLines={
                1
              }
              style={[
                styles.studentName,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {
                student.full_name
              }
            </Text>

            <Text
              style={[
                styles.studentId,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {student.student_id ??
                'Student'}
            </Text>

            {schoolClass && (
              <View
                style={[
                  styles.classBadge,
                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name="school-outline"
                  size={13}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={[
                    styles.classBadgeText,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  {
                    schoolClass.class_name
                  }
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ============================================= */}
        {/* STUDENT INFO */}
        {/* ============================================= */}

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  colors.text,
              },
            ]}
          >
            Student Info
          </Text>
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,
            },
          ]}
        >
          <InfoRow
            icon="person-outline"
            label="Name"
            value={
              student.full_name
            }
            colors={
              colors
            }
          />

          <Divider
            color={
              colors.border
            }
          />

          <View
            style={
              styles.doubleInfoRow
            }
          >
            <SmallInfo
              label="Age"
              value={
                student.age
                  ? String(
                      student.age,
                    )
                  : '—'
              }
              colors={
                colors
              }
            />

            <View
              style={[
                styles.verticalDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <SmallInfo
              label="Gender"
              value={
                student.gender
                  ? student.gender ===
                    'male'
                    ? 'Male'
                    : 'Female'
                  : '—'
              }
              colors={
                colors
              }
            />

            <View
              style={[
                styles.verticalDivider,
                {
                  backgroundColor:
                    colors.border,
                },
              ]}
            />

            <SmallInfo
              label="Class"
              value={
                schoolClass
                  ?.class_name ??
                '—'
              }
              colors={
                colors
              }
            />
          </View>

          <Divider
            color={
              colors.border
            }
          />

          <InfoRow
            icon="woman-outline"
            label="Mother's Phone"
            value={
              student.mother_phone ??
              'Not added'
            }
            colors={
              colors
            }
          />

          <Divider
            color={
              colors.border
            }
          />

          <InfoRow
            icon="man-outline"
            label="Father's Phone"
            value={
              student.father_phone ??
              'Not added'
            }
            colors={
              colors
            }
          />

          {student.location ? (
            <>
              <Divider
                color={
                  colors.border
                }
              />

              <InfoRow
                icon="location-outline"
                label="Location"
                value={
                  student.location
                }
                colors={
                  colors
                }
              />
            </>
          ) : null}

          {student.special_case ? (
            <>
              <Divider
                color={
                  colors.border
                }
              />

              <InfoRow
                icon="medical-outline"
                label="Special Case"
                value={
                  student.special_case
                }
                colors={
                  colors
                }
              />
            </>
          ) : null}
        </View>

        {/* ============================================= */}
        {/* ATTENDANCE */}
        {/* ============================================= */}

        <View
          style={
            styles.attendanceHeader
          }
        >
          <View>
            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Attendance
            </Text>

            <Text
              style={[
                styles.sectionSubtitle,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Since September 1, 2026
            </Text>
          </View>

          {schoolClass && (
            <View
              style={[
                styles.smallClassChip,
                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.smallClassChipText,
                  {
                    color:
                      colors.primary,
                  },
                ]}
              >
                {classCategoryLabel(
                  schoolClass.category,
                )}
              </Text>
            </View>
          )}
        </View>

        {/* ============================================= */}
        {/* CALENDAR */}
        {/* ============================================= */}

        <View
          style={[
            styles.calendarCard,
            {
              backgroundColor:
                isDark
                  ? colors.card
                  : '#F8FBFF',

              borderColor:
                colors.border,
            },
          ]}
        >
          {/* MONTH HEADER */}

          <View
            style={
              styles.calendarMonthHeader
            }
          >
            <Pressable
              disabled={
                !canGoPreviousMonth
              }
              onPress={() =>
                moveMonth(
                  -1,
                )
              }
              style={({
                pressed,
              }) => [
                styles.monthArrow,

                {
                  backgroundColor:
                    colors.card,

                  borderColor:
                    colors.border,

                  opacity:
                    !canGoPreviousMonth
                      ? 0.3
                      : pressed
                        ? 0.6
                        : 1,
                },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={19}
                color={
                  colors.text
                }
              />
            </Pressable>

            <View
              style={
                styles.monthTitleArea
              }
            >
              <Text
                style={[
                  styles.monthTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {formatMonth(
                  visibleMonth,
                )}
              </Text>

              <Text
                style={[
                  styles.monthYear,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  visibleMonth.getFullYear()
                }
              </Text>
            </View>

            <Pressable
              disabled={
                !canGoNextMonth
              }
              onPress={() =>
                moveMonth(
                  1,
                )
              }
              style={({
                pressed,
              }) => [
                styles.monthArrow,

                {
                  backgroundColor:
                    colors.card,

                  borderColor:
                    colors.border,

                  opacity:
                    !canGoNextMonth
                      ? 0.3
                      : pressed
                        ? 0.6
                        : 1,
                },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={19}
                color={
                  colors.text
                }
              />
            </Pressable>
          </View>

          {/* WEEK DAYS */}

          <View
            style={
              styles.weekRow
            }
          >
            {WEEK_DAYS.map(
              (
                day,
              ) => (
                <View
                  key={
                    day
                  }
                  style={
                    styles.weekSlot
                  }
                >
                  <Text
                    style={[
                      styles.weekText,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {
                      day
                    }
                  </Text>
                </View>
              ),
            )}
          </View>

          {/* DAYS */}

          <View
            style={
              styles.calendarGrid
            }
          >
            {calendarCells.map(
              (
                day,
                index,
              ) => {
                if (
                  day ===
                  null
                ) {
                  return (
                    <View
                      key={`empty-${index}`}
                      style={
                        styles.daySlot
                      }
                    />
                  );
                }

                const date =
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    day,
                  );

                const beforeStart =
                  date.getTime() <
                  ATTENDANCE_START_DATE.getTime();

                const status =
                  beforeStart
                    ? 'future'
                    : getCalendarStatus(
                        date,
                      );

                const statusColors =
                  palette[
                    status
                  ];

                const selected =
                  sameDate(
                    selectedDate,
                    date,
                  );

                const isToday =
                  sameDate(
                    currentDay,
                    date,
                  );

                const disabled =
                  beforeStart ||
                  status ===
                    'future';

                return (
                  <View
                    key={
                      toDateKey(
                        date,
                      )
                    }
                    style={
                      styles.daySlot
                    }
                  >
                    <Pressable
                      disabled={
                        disabled
                      }
                      onPress={() =>
                        selectCalendarDay(
                          date,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.dayButton,

                        {
                          backgroundColor:
                            statusColors.background,

                          borderColor:
                            selected
                              ? colors.text
                              : statusColors.border,

                          borderWidth:
                            selected
                              ? 2
                              : 1,

                          opacity:
                            pressed
                              ? 0.7
                              : 1,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,

                          {
                            color:
                              statusColors.text,

                            fontWeight:
                              selected ||
                              isToday
                                ? '800'
                                : '600',
                          },
                        ]}
                      >
                        {
                          day
                        }
                      </Text>

                      {status ===
                        'present' ||
                      status ===
                        'absent' ||
                      status ===
                        'pending' ? (
                        <View
                          style={[
                            styles.dayDot,

                            {
                              backgroundColor:
                                statusColors.dot,
                            },
                          ]}
                        />
                      ) : isToday ? (
                        <View
                          style={[
                            styles.dayDot,

                            {
                              backgroundColor:
                                colors.primary,
                            },
                          ]}
                        />
                      ) : null}
                    </Pressable>
                  </View>
                );
              },
            )}
          </View>

          {/* LEGEND */}

          <View
            style={[
              styles.legend,
              {
                borderTopColor:
                  colors.border,
              },
            ]}
          >
            <LegendItem
              color={
                palette.present.dot
              }
              label="Present"
              textColor={
                colors.textMuted
              }
            />

            <LegendItem
              color={
                palette.absent.dot
              }
              label="Absent"
              textColor={
                colors.textMuted
              }
            />

            <LegendItem
              color={
                palette.pending.dot
              }
              label="Queue"
              textColor={
                colors.textMuted
              }
            />

            <LegendItem
              color={
                palette.future.dot
              }
              label="Upcoming"
              textColor={
                colors.textMuted
              }
            />
          </View>
        </View>

        {/* ============================================= */}
        {/* SELECTED DAY */}
        {/* ============================================= */}

        <View
          style={[
            styles.selectedDayCard,
            {
              backgroundColor:
                colors.card,

              borderColor:
                colors.border,
            },
          ]}
        >
          <View>
            <Text
              style={[
                styles.selectedDayLabel,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Selected Day
            </Text>

            <Text
              style={[
                styles.selectedDayDate,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              {formatFullDate(
                selectedDate,
              )}
            </Text>
          </View>

          {selectedAttendanceStatus ? (
            <View
              style={[
                styles.selectedStatus,

                {
                  backgroundColor:
                    palette[
                      selectedAttendanceStatus
                    ].background,

                  borderColor:
                    palette[
                      selectedAttendanceStatus
                    ].border,
                },
              ]}
            >
              <View
                style={[
                  styles.selectedStatusDot,

                  {
                    backgroundColor:
                      palette[
                        selectedAttendanceStatus
                      ].dot,
                  },
                ]}
              />

              <Text
                style={[
                  styles.selectedStatusText,

                  {
                    color:
                      palette[
                        selectedAttendanceStatus
                      ].text,
                  },
                ]}
              >
                {selectedAttendanceStatus ===
                'present'
                  ? 'Present'
                  : selectedAttendanceStatus ===
                      'absent'
                    ? 'Absent'
                    : 'Queue'}
              </Text>
            </View>
          ) : (
            <View
              style={[
                styles.selectedStatus,

                {
                  backgroundColor:
                    colors.surfaceSecondary,

                  borderColor:
                    colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.selectedStatusText,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                No record
              </Text>
            </View>
          )}
        </View>

        {/* ============================================= */}
        {/* TOTALS */}
        {/* ============================================= */}

        <View
          style={
            styles.totalRow
          }
        >
          <View
            style={[
              styles.totalCard,

              {
                backgroundColor:
                  palette.present.background,

                borderColor:
                  palette.present.border,
              },
            ]}
          >
            <View
              style={[
                styles.totalIcon,

                {
                  backgroundColor:
                    palette.present.dot,
                },
              ]}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color="#FFFFFF"
              />
            </View>

            <View>
              <Text
                style={[
                  styles.totalNumber,

                  {
                    color:
                      palette.present.text,
                  },
                ]}
              >
                {
                  totals.present
                }
              </Text>

              <Text
                style={[
                  styles.totalLabel,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Total Present
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.totalCard,

              {
                backgroundColor:
                  palette.absent.background,

                borderColor:
                  palette.absent.border,
              },
            ]}
          >
            <View
              style={[
                styles.totalIcon,

                {
                  backgroundColor:
                    palette.absent.dot,
                },
              ]}
            >
              <Ionicons
                name="close"
                size={18}
                color="#FFFFFF"
              />
            </View>

            <View>
              <Text
                style={[
                  styles.totalNumber,

                  {
                    color:
                      palette.absent.text,
                  },
                ]}
              >
                {
                  totals.absent
                }
              </Text>

              <Text
                style={[
                  styles.totalLabel,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                Total Absent
              </Text>
            </View>
          </View>
        </View>

        {/* RATE */}

        <View
          style={[
            styles.rateCard,
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
              styles.rateIcon,
              {
                backgroundColor:
                  colors.primarySoft,
              },
            ]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={19}
              color={
                colors.primary
              }
            />
          </View>

          <View
            style={
              styles.rateInfo
            }
          >
            <Text
              style={[
                styles.rateTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Attendance Rate
            </Text>

            <Text
              style={[
                styles.rateDescription,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Based on marked present and absent days
            </Text>
          </View>

          <Text
            style={[
              styles.rateValue,
              {
                color:
                  colors.primary,
              },
            ]}
          >
            {
              attendanceRate
            }%
          </Text>
        </View>

        <View
          style={{
            height:
              90,
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * INFO COMPONENTS
 * =========================================================
 */

function Divider({
  color,
}: {
  color: string;
}) {
  return (
    <View
      style={[
        stylesStatic.divider,

        {
          backgroundColor:
            color,
        },
      ]}
    />
  );
}

function InfoRow({
  icon,
  label,
  value,
  colors,
}: {
  icon:
    keyof typeof Ionicons.glyphMap;

  label: string;

  value: string;

  colors:
    AppThemeColors;
}) {
  return (
    <View
      style={
        stylesStatic.infoRow
      }
    >
      <View
        style={[
          stylesStatic.infoIcon,

          {
            backgroundColor:
              colors.primarySoft,
          },
        ]}
      >
        <Ionicons
          name={
            icon
          }
          size={18}
          color={
            colors.primary
          }
        />
      </View>

      <View
        style={
          stylesStatic.infoRowText
        }
      >
        <Text
          style={[
            stylesStatic.infoLabel,

            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {label}
        </Text>

        <Text
          style={[
            stylesStatic.infoValue,

            {
              color:
                colors.text,
            },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function SmallInfo({
  label,
  value,
  colors,
}: {
  label: string;

  value: string;

  colors:
    AppThemeColors;
}) {
  return (
    <View
      style={
        stylesStatic.smallInfo
      }
    >
      <Text
        style={[
          stylesStatic.smallInfoLabel,

          {
            color:
              colors.textMuted,
          },
        ]}
      >
        {label}
      </Text>

      <Text
        numberOfLines={
          1
        }
        style={[
          stylesStatic.smallInfoValue,

          {
            color:
              colors.text,
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function LegendItem({
  color,
  label,
  textColor,
}: {
  color: string;

  label: string;

  textColor: string;
}) {
  return (
    <View
      style={
        stylesStatic.legendItem
      }
    >
      <View
        style={[
          stylesStatic.legendDot,

          {
            backgroundColor:
              color,
          },
        ]}
      />

      <Text
        style={[
          stylesStatic.legendText,

          {
            color:
              textColor,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * STATIC STYLES
 * =========================================================
 */

const stylesStatic =
  StyleSheet.create({
    divider: {
      height:
        StyleSheet.hairlineWidth,

      marginLeft:
        54,
    },

    infoRow: {
      minHeight:
        64,

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
    },

    infoRowText: {
      flex:
        1,

      marginLeft:
        12,
    },

    infoLabel: {
      fontSize:
        10,

      fontWeight:
        '600',
    },

    infoValue: {
      marginTop:
        3,

      fontSize:
        13,

      fontWeight:
        '600',
    },

    smallInfo: {
      flex:
        1,

      alignItems:
        'center',

      paddingHorizontal:
        5,
    },

    smallInfoLabel: {
      fontSize:
        9.5,

      fontWeight:
        '600',
    },

    smallInfoValue: {
      marginTop:
        4,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    legendItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        4,
    },

    legendDot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,
    },

    legendText: {
      fontSize:
        8.5,

      fontWeight:
        '600',
    },
  });

/*
 * =========================================================
 * THEMED STYLES
 * =========================================================
 */

function createStyles(
  colors:
    AppThemeColors,

  isDark:
    boolean,
) {
  return StyleSheet.create({
    safeArea: {
      flex:
        1,
    },

    header: {
      minHeight:
        60,

      paddingHorizontal:
        16,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,
    },

    headerButton: {
      width:
        38,

      height:
        38,

      borderRadius:
        19,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    headerTitle: {
      flex:
        1,

      textAlign:
        'center',

      fontSize:
        16,

      fontWeight:
        '800',
    },

    headerSpacer: {
      width:
        38,
    },

    content: {
      paddingHorizontal:
        16,

      paddingTop:
        18,
    },

    loadingContainer: {
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
        12,

      fontWeight:
        '500',
    },

    errorContainer: {
      flex:
        1,

      paddingHorizontal:
        28,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    errorIcon: {
      width:
        56,

      height:
        56,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    errorTitle: {
      marginTop:
        14,

      fontSize:
        18,

      fontWeight:
        '800',
    },

    errorMessage: {
      marginTop:
        7,

      textAlign:
        'center',

      fontSize:
        12,

      lineHeight:
        18,
    },

    studentHero: {
      minHeight:
        102,

      borderWidth:
        1,

      borderRadius:
        22,

      padding:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    avatar: {
      width:
        72,

      height:
        72,

      borderRadius:
        36,
    },

    heroInfo: {
      flex:
        1,

      marginLeft:
        14,
    },

    studentName: {
      fontSize:
        18,

      fontWeight:
        '800',

      letterSpacing:
        -0.2,
    },

    studentId: {
      marginTop:
        3,

      fontSize:
        11,

      fontWeight:
        '600',
    },

    classBadge: {
      alignSelf:
        'flex-start',

      marginTop:
        8,

      paddingHorizontal:
        8,

      minHeight:
        25,

      borderRadius:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },

    classBadgeText: {
      fontSize:
        10,

      fontWeight:
        '700',
    },

    sectionHeader: {
      marginTop:
        24,

      marginBottom:
        10,
    },

    sectionTitle: {
      fontSize:
        19,

      fontWeight:
        '800',

      letterSpacing:
        -0.2,
    },

    sectionSubtitle: {
      marginTop:
        3,

      fontSize:
        10,

      fontWeight:
        '500',
    },

    infoCard: {
      borderWidth:
        1,

      borderRadius:
        20,

      paddingHorizontal:
        13,
    },

    doubleInfoRow: {
      minHeight:
        66,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    verticalDivider: {
      width:
        StyleSheet.hairlineWidth,

      height:
        32,
    },

    attendanceHeader: {
      marginTop:
        27,

      marginBottom:
        11,

      flexDirection:
        'row',

      alignItems:
        'flex-end',

      justifyContent:
        'space-between',
    },

    smallClassChip: {
      minHeight:
        27,

      paddingHorizontal:
        9,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    smallClassChipText: {
      fontSize:
        9.5,

      fontWeight:
        '700',
    },

    calendarCard: {
      borderWidth:
        1,

      borderRadius:
        23,

      padding:
        13,

      overflow:
        'hidden',

      shadowColor:
        '#000000',

      shadowOpacity:
        isDark
          ? 0
          : 0.04,

      shadowRadius:
        12,

      shadowOffset: {
        width:
          0,

        height:
          5,
      },

      elevation:
        isDark
          ? 0
          : 2,
    },

    calendarMonthHeader: {
      minHeight:
        48,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    monthArrow: {
      width:
        37,

      height:
        37,

      borderRadius:
        12,

      borderWidth:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    monthTitleArea: {
      alignItems:
        'center',
    },

    monthTitle: {
      fontSize:
        17,

      fontWeight:
        '800',
    },

    monthYear: {
      marginTop:
        1,

      fontSize:
        10,

      fontWeight:
        '600',
    },

    weekRow: {
      marginTop:
        12,

      marginBottom:
        5,

      flexDirection:
        'row',
    },

    weekSlot: {
      width:
        '14.285714%',

      alignItems:
        'center',
    },

    weekText: {
      fontSize:
        8.5,

      fontWeight:
        '700',
    },

    calendarGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',
    },

    daySlot: {
      width:
        '14.285714%',

      aspectRatio:
        1,
    },

    dayButton: {
      flex:
        1,

      margin:
        3,

      borderRadius:
        13,

      borderWidth:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    dayNumber: {
      fontSize:
        11.5,
    },

    dayDot: {
      position:
        'absolute',

      bottom:
        5,

      width:
        4,

      height:
        4,

      borderRadius:
        2,
    },

    legend: {
      minHeight:
        43,

      marginTop:
        9,

      paddingTop:
        12,

      paddingHorizontal:
        4,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    selectedDayCard: {
      minHeight:
        68,

      marginTop:
        12,

      borderWidth:
        1,

      borderRadius:
        18,

      paddingHorizontal:
        14,

      paddingVertical:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        10,
    },

    selectedDayLabel: {
      fontSize:
        9,

      fontWeight:
        '600',
    },

    selectedDayDate: {
      marginTop:
        3,

      fontSize:
        12,

      fontWeight:
        '700',
    },

    selectedStatus: {
      minHeight:
        32,

      paddingHorizontal:
        10,

      borderRadius:
        11,

      borderWidth:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },

    selectedStatusDot: {
      width:
        7,

      height:
        7,

      borderRadius:
        4,
    },

    selectedStatusText: {
      fontSize:
        10,

      fontWeight:
        '800',
    },

    totalRow: {
      marginTop:
        13,

      flexDirection:
        'row',

      gap:
        9,
    },

    totalCard: {
      flex:
        1,

      minHeight:
        79,

      borderWidth:
        1,

      borderRadius:
        18,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    totalIcon: {
      width:
        35,

      height:
        35,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        10,
    },

    totalNumber: {
      fontSize:
        20,

      fontWeight:
        '800',
    },

    totalLabel: {
      marginTop:
        1,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    rateCard: {
      minHeight:
        70,

      marginTop:
        9,

      borderWidth:
        1,

      borderRadius:
        18,

      padding:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    rateIcon: {
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

    rateInfo: {
      flex:
        1,

      marginLeft:
        11,
    },

    rateTitle: {
      fontSize:
        12.5,

      fontWeight:
        '700',
    },

    rateDescription: {
      marginTop:
        2,

      fontSize:
        8.5,

      fontWeight:
        '500',
    },

    rateValue: {
      fontSize:
        20,

      fontWeight:
        '800',
    },
  });
}