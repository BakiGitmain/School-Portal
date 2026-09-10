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
  Ionicons,
} from '@expo/vector-icons';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  useFocusEffect,
} from 'expo-router';

import * as FileSystem from 'expo-file-system/legacy';

import * as Sharing from 'expo-sharing';

import * as XLSX from 'xlsx';

import {
  supabase,
} from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */
type MarkSheetStudentRow = {
  user_id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  student_id: string | null;
};
type TeachingAssignment = {
  classId: string;

  className: string;

  category:
    | 'elementary'
    | 'high_school';

  gradeLabel: string;

  section: string;

  subject: string;
};

type Student = {
  userId: string;

  fullName: string;

  firstName:
    | string
    | null;

  lastName:
    | string
    | null;

  studentId:
    | string
    | null;
};

type ScoreField =
  | 'test'
  | 'mid'
  | 'assignment'
  | 'finalExam';

type ScoreInputs = {
  test: string;

  mid: string;

  assignment: string;

  finalExam: string;
};

type RawMaxInputs = {
  test: string;

  mid: string;

  assignment: string;

  finalExam: string;
};

type SemesterMode =
  | 'first'
  | 'second'
  | 'final';

type FinalStudentResult = {
  first:
    | number
    | null;

  second:
    | number
    | null;

  final:
    | number
    | null;
};

type StoredMark = {
  student_user_id: string;

  test_raw_score:
    | number
    | null;

  mid_raw_score:
    | number
    | null;

  assignment_raw_score:
    | number
    | null;

  final_exam_raw_score:
    | number
    | null;

  test_score:
    | number
    | null;

  mid_score:
    | number
    | null;

  assignment_score:
    | number
    | null;

  final_exam_score:
    | number
    | null;

  total_score:
    | number
    | null;
};

type ExportSemesterData = {
  exists: boolean;

  testMax: number;

  midMax: number;

  assignmentMax: number;

  finalExamMax: number;

  marks: Map<
    string,
    StoredMark
  >;
};

type RankItem = {
  userId: string;

  total:
    | number
    | null;
};

type ToastType =
  | 'success'
  | 'error';

/*
 * =========================================================
 * CONSTANTS
 * =========================================================
 */

const SCORE_WEIGHTS = {
  test: 10,

  mid: 30,

  assignment: 20,

  finalExam: 40,
};

const DEFAULT_RAW_MAXES: RawMaxInputs = {
  test: '10',

  mid: '30',

  assignment: '20',

  finalExam: '40',
};

const SCORE_FIELDS: ScoreField[] = [
  'test',
  'mid',
  'assignment',
  'finalExam',
];

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function emptyScore(): ScoreInputs {
  return {
    test: '',

    mid: '',

    assignment: '',

    finalExam: '',
  };
}

function currentSchoolYear() {
  const now =
    new Date();

  const startYear =
    now.getMonth() >= 8
      ? now.getFullYear()
      : now.getFullYear() - 1;

  return `${startYear}-${startYear + 1}`;
}

function semesterNumber(
  mode: SemesterMode,
) {
  if (
    mode === 'first'
  ) {
    return 1;
  }

  if (
    mode === 'second'
  ) {
    return 2;
  }

  return null;
}

function semesterLabel(
  mode: SemesterMode,
) {
  if (
    mode === 'first'
  ) {
    return 'First Semester';
  }

  if (
    mode === 'second'
  ) {
    return 'Second Semester';
  }

  return 'Final Result';
}

function categoryLabel(
  category:
    TeachingAssignment['category'],
) {
  return category ===
    'elementary'
    ? 'Elementary'
    : 'High School';
}

function parseNumber(
  value: string,
) {
  const clean =
    value.trim();

  if (
    !clean
  ) {
    return null;
  }

  const number =
    Number(
      clean,
    );

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return null;
  }

  return number;
}

function parsePositive(
  value: string,
) {
  const number =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      number,
    ) ||
    number <= 0
  ) {
    return null;
  }

  return number;
}

function normalizeScore(
  rawValue: string,

  rawMaximum: string,

  weight: number,
) {
  const raw =
    parseNumber(
      rawValue,
    );

  const max =
    parsePositive(
      rawMaximum,
    );

  if (
    raw === null ||
    max === null
  ) {
    return null;
  }

  return (
    Math.round(
      (
        (
          raw /
          max
        ) *
        weight
      ) *
        100,
    ) /
    100
  );
}

function formatScore(
  value:
    | number
    | null
    | undefined,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '—';
  }

  if (
    Number.isInteger(
      value,
    )
  ) {
    return String(
      value,
    );
  }

  return value
    .toFixed(
      2,
    )
    .replace(
      /\.?0+$/,
      '',
    );
}

function safeFileName(
  value: string,
) {
  return value
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      '-',
    )
    .replace(
      /-+/g,
      '-',
    )
    .replace(
      /^-+|-+$/g,
      '',
    );
}

function cleanNumericInput(
  value: string,
) {
  const clean =
    value.replace(
      /[^0-9.]/g,
      '',
    );

  const pieces =
    clean.split(
      '.',
    );

  if (
    pieces.length <= 2
  ) {
    return clean;
  }

  return (
    pieces[0] +
    '.' +
    pieces
      .slice(
        1,
      )
      .join('')
  );
}

/*
 * =========================================================
 * RANKING
 *
 * Competition ranking:
 *
 * 95 -> 1
 * 90 -> 2
 * 90 -> 2
 * 85 -> 4
 *
 * Incomplete students receive no rank.
 * =========================================================
 */

function buildCompetitionRanks(
  items:
    RankItem[],
) {
  const eligible =
    items
      .filter(
        (
          item,
        ) =>
          item.total !==
            null &&
          Number.isFinite(
            item.total,
          ),
      )
      .map(
        (
          item,
        ) => ({
          userId:
            item.userId,

          total:
            item.total as
              number,
        }),
      )
      .sort(
        (
          a,
          b,
        ) => {
          if (
            b.total !==
            a.total
          ) {
            return (
              b.total -
              a.total
            );
          }

          return a.userId.localeCompare(
            b.userId,
          );
        },
      );

  const ranks =
    new Map<
      string,
      number
    >();

  let previousScore:
    number |
    null =
    null;

  let currentRank =
    0;

  eligible.forEach(
    (
      item,
      index,
    ) => {
      const differentScore =
        previousScore ===
          null ||
        Math.abs(
          item.total -
            previousScore,
        ) >
          0.0001;

      if (
        differentScore
      ) {
        currentRank =
          index +
          1;
      }

      ranks.set(
        item.userId,
        currentRank,
      );

      previousScore =
        item.total;
    },
  );

  return ranks;
}

/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function ResultsScreen() {
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

  const schoolYear =
    useMemo(
      () =>
        currentSchoolYear(),
      [],
    );

  /*
   * =====================================================
   * ASSIGNMENTS
   * =====================================================
   */

  const [
    assignments,
    setAssignments,
  ] =
    useState<
      TeachingAssignment[]
    >([]);

  const [
    assignmentsLoading,
    setAssignmentsLoading,
  ] =
    useState(
      true,
    );

  /*
   * =====================================================
   * MARK SHEET
   * =====================================================
   */

  const [
    sheetOpen,
    setSheetOpen,
  ] =
    useState(
      false,
    );

  const [
    activeAssignment,
    setActiveAssignment,
  ] =
    useState<
      TeachingAssignment |
      null
    >(
      null,
    );

  const [
    semester,
    setSemester,
  ] =
    useState<
      SemesterMode
    >(
      'first',
    );

  const [
    semesterPickerOpen,
    setSemesterPickerOpen,
  ] =
    useState(
      false,
    );

  const [
    sheetLoading,
    setSheetLoading,
  ] =
    useState(
      false,
    );

  const [
    students,
    setStudents,
  ] =
    useState<
      Student[]
    >([]);

  const [
    scores,
    setScores,
  ] =
    useState<
      Record<
        string,
        ScoreInputs
      >
    >({});

  const [
    rawMaxes,
    setRawMaxes,
  ] =
    useState<
      RawMaxInputs
    >({
      ...DEFAULT_RAW_MAXES,
    });

  const [
    finalResults,
    setFinalResults,
  ] =
    useState<
      Record<
        string,
        FinalStudentResult
      >
    >({});

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    exporting,
    setExporting,
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

  /*
   * Prevent old async requests from overwriting
   * a newer semester/class.
   */
  const sheetLoadRequest =
    useRef(
      0,
    );

  /*
   * =====================================================
   * TOAST
   * =====================================================
   */

  const [
    toastMessage,
    setToastMessage,
  ] =
    useState('');

  const [
    toastType,
    setToastType,
  ] =
    useState<
      ToastType
    >(
      'success',
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
      > |
      null
    >(
      null,
    );

  useEffect(
    () => {
      return () => {
        if (
          toastTimer.current
        ) {
          clearTimeout(
            toastTimer.current,
          );
        }

        toastY.stopAnimation();
      };
    },
    [
      toastY,
    ],
  );

  function hideToastImmediately() {
    if (
      toastTimer.current
    ) {
      clearTimeout(
        toastTimer.current,
      );

      toastTimer.current =
        null;
    }

    toastY.stopAnimation();

    toastY.setValue(
      -120,
    );

    setToastMessage(
      '',
    );
  }

  function showToast(
    message: string,

    type:
      ToastType =
        'success',
  ) {
    if (
      toastTimer.current
    ) {
      clearTimeout(
        toastTimer.current,
      );

      toastTimer.current =
        null;
    }

    toastY.stopAnimation();

    setToastMessage(
      message,
    );

    setToastType(
      type,
    );

    toastY.setValue(
      -120,
    );

    Animated.spring(
      toastY,
      {
        toValue: 0,

        damping: 18,

        stiffness: 220,

        mass: 0.8,

        useNativeDriver:
          true,
      },
    ).start();

    toastTimer.current =
      setTimeout(
        () => {
          Animated.timing(
            toastY,
            {
              toValue:
                -120,

              duration:
                220,

              useNativeDriver:
                true,
            },
          ).start(
            () => {
              setToastMessage(
                '',
              );
            },
          );
        },
        2400,
      );
  }

  /*
   * =====================================================
   * LOAD ASSIGNMENTS
   * =====================================================
   */

  useFocusEffect(
    useCallback(
      () => {
        void loadAssignments();
      },
      [],
    ),
  );

  async function loadAssignments() {
    try {
      setAssignmentsLoading(
        true,
      );

      const {
        data:
          userData,
        error:
          userError,
      } =
        await supabase.auth
          .getUser();

      if (
        userError ||
        !userData.user
      ) {
        throw new Error(
          'Teacher account could not be loaded.',
        );
      }

      const teacherUserId =
        userData.user.id;

      const {
        data:
          assignmentRows,
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
            teacherUserId,
          );

      if (
        assignmentError
      ) {
        throw assignmentError;
      }

      const classIds =
        Array.from(
          new Set(
            (
              assignmentRows ??
              []
            ).map(
              (
                row,
              ) =>
                String(
                  row.class_id,
                ),
            ),
          ),
        );

      if (
        classIds.length ===
        0
      ) {
        setAssignments(
          [],
        );

        return;
      }

      const {
        data:
          classRows,
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
          .in(
            'id',
            classIds,
          );

      if (
        classError
      ) {
        throw classError;
      }

      const classMap =
        new Map<
          string,
          {
            id: string;

            category:
              TeachingAssignment['category'];

            gradeLabel: string;

            section: string;

            className: string;
          }
        >();

      for (
        const classroom of
        classRows ??
        []
      ) {
        classMap.set(
          String(
            classroom.id,
          ),
          {
            id:
              String(
                classroom.id,
              ),

            category:
              classroom.category as
                TeachingAssignment['category'],

            gradeLabel:
              String(
                classroom.grade_label,
              ),

            section:
              String(
                classroom.section,
              ),

            className:
              String(
                classroom.class_name,
              ),
          },
        );
      }

      const mapped:
        TeachingAssignment[] =
        [];

      const seen =
        new Set<
          string
        >();

      for (
        const row of
        assignmentRows ??
        []
      ) {
        const classroom =
          classMap.get(
            String(
              row.class_id,
            ),
          );

        if (
          !classroom
        ) {
          continue;
        }

        const subjectRows =
          Array.isArray(
            row.subjects,
          )
            ? row.subjects
            : [];

        for (
          const rawSubject of
          subjectRows
        ) {
          const subject =
            String(
              rawSubject,
            ).trim();

          if (
            !subject
          ) {
            continue;
          }

          const key =
            `${classroom.id}:${subject.toLowerCase()}`;

          if (
            seen.has(
              key,
            )
          ) {
            continue;
          }

          seen.add(
            key,
          );

          mapped.push({
            classId:
              classroom.id,

            className:
              classroom.className,

            category:
              classroom.category,

            gradeLabel:
              classroom.gradeLabel,

            section:
              classroom.section,

            subject,
          });
        }
      }

      mapped.sort(
        (
          a,
          b,
        ) => {
          const subjectCompare =
            a.subject.localeCompare(
              b.subject,
            );

          if (
            subjectCompare !==
            0
          ) {
            return subjectCompare;
          }

          return a.className.localeCompare(
            b.className,
            undefined,
            {
              numeric:
                true,
            },
          );
        },
      );

      setAssignments(
        mapped,
      );
    } catch (
      error
    ) {
      console.log(
        'LOAD MARK ASSIGNMENTS:',
        error,
      );

      setAssignments(
        [],
      );

      showToast(
        error instanceof
        Error
          ? error.message
          : 'Could not load mark sheets.',
        'error',
      );
    } finally {
      setAssignmentsLoading(
        false,
      );
    }
  }

  /*
   * =====================================================
   * GROUP BY SUBJECT
   * =====================================================
   */

  const groupedAssignments =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            TeachingAssignment[]
          >();

        for (
          const item of
          assignments
        ) {
          const existing =
            groups.get(
              item.subject,
            ) ??
            [];

          existing.push(
            item,
          );

          groups.set(
            item.subject,
            existing,
          );
        }

        return Array.from(
          groups.entries(),
        );
      },
      [
        assignments,
      ],
    );

  /*
   * =====================================================
   * STUDENTS
   * =====================================================
   */

async function loadStudents(
  assignment: TeachingAssignment,
) {
  const {
    data,
    error,
  } = await supabase.rpc(
    'get_mark_sheet_students',
    {
      p_class_id:
        assignment.classId,

      p_subject:
        assignment.subject,
    },
  );

  if (error) {
    console.log(
      'LOAD MARK SHEET STUDENTS:',
      error,
    );

    throw error;
  }

  const rows =
    (data ?? []) as
      MarkSheetStudentRow[];

  return rows.map(
    (
      student:
        MarkSheetStudentRow,
    ): Student => ({
      userId:
        String(
          student.user_id,
        ),

      fullName:
        String(
          student.full_name ??
            '',
        ),

      firstName:
        student.first_name
          ? String(
              student.first_name,
            )
          : null,

      lastName:
        student.last_name
          ? String(
              student.last_name,
            )
          : null,

      studentId:
        student.student_id
          ? String(
              student.student_id,
            )
          : null,
    }),
  );
}

  /*
   * =====================================================
   * OPEN SHEET
   * =====================================================
   */

  async function openSheet(
    assignment:
      TeachingAssignment,
  ) {
    hideToastImmediately();

    /*
     * Clear old classroom data immediately.
     * This prevents old marks flashing for a second.
     */

    setStudents(
      [],
    );

    setScores(
      {},
    );

    setFinalResults(
      {},
    );

    setRawMaxes({
      ...DEFAULT_RAW_MAXES,
    });

    setActiveAssignment(
      assignment,
    );

    setSemester(
      'first',
    );

    setSemesterPickerOpen(
      false,
    );

    setDirty(
      false,
    );

    setSheetOpen(
      true,
    );

    await loadSheet(
      assignment,
      'first',
    );
  }

  /*
   * =====================================================
   * FETCH FINAL RESULTS
   * =====================================================
   */

  async function fetchFinalResults(
    assignment:
      TeachingAssignment,
  ) {
    const {
      data:
        sheets,
      error:
        sheetError,
    } =
      await supabase
        .from(
          'mark_sheets',
        )
        .select(`
          id,
          semester
        `)
        .eq(
          'class_id',
          assignment.classId,
        )
        .eq(
          'subject_key',
          assignment.subject
            .trim()
            .toLowerCase(),
        )
        .eq(
          'school_year',
          schoolYear,
        )
        .in(
          'semester',
          [
            1,
            2,
          ],
        );

    if (
      sheetError
    ) {
      throw sheetError;
    }

    const sheetRows =
      sheets ??
      [];

    if (
      sheetRows.length ===
      0
    ) {
      return {};
    }

    const sheetIds =
      sheetRows.map(
        (
          sheet,
        ) =>
          String(
            sheet.id,
          ),
      );

    const semesterMap =
      new Map<
        string,
        number
      >();

    for (
      const sheet of
      sheetRows
    ) {
      semesterMap.set(
        String(
          sheet.id,
        ),
        Number(
          sheet.semester,
        ),
      );
    }

    const {
      data:
        entries,
      error:
        entryError,
    } =
      await supabase
        .from(
          'mark_sheet_entries',
        )
        .select(`
          mark_sheet_id,
          student_user_id,
          total_score
        `)
        .in(
          'mark_sheet_id',
          sheetIds,
        );

    if (
      entryError
    ) {
      throw entryError;
    }

    const result:
      Record<
        string,
        FinalStudentResult
      > = {};

    for (
      const entry of
      entries ??
      []
    ) {
      const studentId =
        String(
          entry.student_user_id,
        );

      if (
        !result[
          studentId
        ]
      ) {
        result[
          studentId
        ] = {
          first:
            null,

          second:
            null,

          final:
            null,
        };
      }

      const sem =
        semesterMap.get(
          String(
            entry.mark_sheet_id,
          ),
        );

      const total =
        entry.total_score ===
          null ||
        entry.total_score ===
          undefined
          ? null
          : Number(
              entry.total_score,
            );

      if (
        sem === 1
      ) {
        result[
          studentId
        ].first =
          total;
      }

      if (
        sem === 2
      ) {
        result[
          studentId
        ].second =
          total;
      }
    }

    for (
      const studentId of
      Object.keys(
        result,
      )
    ) {
      const first =
        result[
          studentId
        ].first;

      const second =
        result[
          studentId
        ].second;

      if (
        first !== null &&
        second !== null
      ) {
        result[
          studentId
        ].final =
          Math.round(
            (
              (
                first +
                second
              ) /
              2
            ) *
              100,
          ) /
          100;
      }
    }

    return result;
  }

  /*
   * =====================================================
   * LOAD SHEET
   *
   * Uses request id so an older request can NEVER replace
   * a newer selected semester/class.
   * =====================================================
   */

  async function loadSheet(
    assignment:
      TeachingAssignment,

    mode:
      SemesterMode,
  ) {
    const requestId =
      ++sheetLoadRequest.current;

    try {
      setSheetLoading(
        true,
      );

      setSemesterPickerOpen(
        false,
      );

      const studentRows =
        await loadStudents(
          assignment,
        );

      if (
        requestId !==
        sheetLoadRequest.current
      ) {
        return;
      }

      /*
       * FINAL
       */

      if (
        mode ===
        'final'
      ) {
        const result =
          await fetchFinalResults(
            assignment,
          );

        if (
          requestId !==
          sheetLoadRequest.current
        ) {
          return;
        }

        setStudents(
          studentRows,
        );

        setScores(
          {},
        );

        setFinalResults(
          result,
        );

        setDirty(
          false,
        );

        return;
      }

      /*
       * SEMESTER
       */

      const sem =
        semesterNumber(
          mode,
        );

      const {
        data:
          sheet,
        error:
          sheetError,
      } =
        await supabase
          .from(
            'mark_sheets',
          )
          .select(`
            id,
            test_raw_max,
            mid_raw_max,
            assignment_raw_max,
            final_exam_raw_max
          `)
          .eq(
            'class_id',
            assignment.classId,
          )
          .eq(
            'subject_key',
            assignment.subject
              .trim()
              .toLowerCase(),
          )
          .eq(
            'school_year',
            schoolYear,
          )
          .eq(
            'semester',
            sem,
          )
          .maybeSingle();

      if (
        sheetError
      ) {
        throw sheetError;
      }

      if (
        requestId !==
        sheetLoadRequest.current
      ) {
        return;
      }

      /*
       * NO SAVED SHEET
       */

      if (
        !sheet
      ) {
        const blank:
          Record<
            string,
            ScoreInputs
          > = {};

        for (
          const student of
          studentRows
        ) {
          blank[
            student.userId
          ] =
            emptyScore();
        }

        setStudents(
          studentRows,
        );

        setScores(
          blank,
        );

        setFinalResults(
          {},
        );

        setRawMaxes({
          ...DEFAULT_RAW_MAXES,
        });

        setDirty(
          false,
        );

        return;
      }

      const {
        data:
          entries,
        error:
          entriesError,
      } =
        await supabase
          .from(
            'mark_sheet_entries',
          )
          .select(`
            student_user_id,
            test_raw_score,
            mid_raw_score,
            assignment_raw_score,
            final_exam_raw_score
          `)
          .eq(
            'mark_sheet_id',
            sheet.id,
          );

      if (
        entriesError
      ) {
        throw entriesError;
      }

      if (
        requestId !==
        sheetLoadRequest.current
      ) {
        return;
      }

      const entryMap =
        new Map(
          (
            entries ??
            []
          ).map(
            (
              entry,
            ) => [
              String(
                entry.student_user_id,
              ),

              entry,
            ],
          ),
        );

      const loaded:
        Record<
          string,
          ScoreInputs
        > = {};

      for (
        const student of
        studentRows
      ) {
        const entry =
          entryMap.get(
            student.userId,
          );

        loaded[
          student.userId
        ] = {
          test:
            entry?.test_raw_score ===
              null ||
            entry?.test_raw_score ===
              undefined
              ? ''
              : String(
                  entry.test_raw_score,
                ),

          mid:
            entry?.mid_raw_score ===
              null ||
            entry?.mid_raw_score ===
              undefined
              ? ''
              : String(
                  entry.mid_raw_score,
                ),

          assignment:
            entry
              ?.assignment_raw_score ===
              null ||
            entry
              ?.assignment_raw_score ===
              undefined
              ? ''
              : String(
                  entry
                    .assignment_raw_score,
                ),

          finalExam:
            entry
              ?.final_exam_raw_score ===
              null ||
            entry
              ?.final_exam_raw_score ===
              undefined
              ? ''
              : String(
                  entry
                    .final_exam_raw_score,
                ),
        };
      }

      setStudents(
        studentRows,
      );

      setScores(
        loaded,
      );

      setFinalResults(
        {},
      );

      setRawMaxes({
        test:
          String(
            sheet.test_raw_max,
          ),

        mid:
          String(
            sheet.mid_raw_max,
          ),

        assignment:
          String(
            sheet.assignment_raw_max,
          ),

        finalExam:
          String(
            sheet.final_exam_raw_max,
          ),
      });

      setDirty(
        false,
      );
    } catch (
      error
    ) {
      if (
        requestId !==
        sheetLoadRequest.current
      ) {
        return;
      }

      console.log(
        'LOAD MARK SHEET:',
        error,
      );

      showToast(
        error instanceof
        Error
          ? error.message
          : 'Could not load mark sheet.',
        'error',
      );
    } finally {
      if (
        requestId ===
        sheetLoadRequest.current
      ) {
        setSheetLoading(
          false,
        );
      }
    }
  }

  /*
   * =====================================================
   * CHANGE SEMESTER
   * =====================================================
   */

  async function selectSemester(
    next:
      SemesterMode,
  ) {
    if (
      !activeAssignment ||
      sheetLoading ||
      saving
    ) {
      return;
    }

    if (
      next ===
      semester
    ) {
      setSemesterPickerOpen(
        false,
      );

      return;
    }

    if (
      dirty
    ) {
      showToast(
        'Save your changes before switching semester.',
        'error',
      );

      return;
    }

    setSemesterPickerOpen(
      false,
    );

    setSemester(
      next,
    );

    await loadSheet(
      activeAssignment,
      next,
    );
  }

  /*
   * =====================================================
   * SCORE INPUTS
   * =====================================================
   */

  function changeScore(
    studentUserId:
      string,

    field:
      ScoreField,

    value:
      string,
  ) {
    const clean =
      cleanNumericInput(
        value,
      );

    setScores(
      (
        current,
      ) => ({
        ...current,

        [
          studentUserId
        ]: {
          ...(
            current[
              studentUserId
            ] ??
            emptyScore()
          ),

          [
            field
          ]:
            clean,
        },
      }),
    );

    setDirty(
      true,
    );
  }

  /*
   * RAW MAXIMUMS STAY EDITABLE.
   */

  function changeRawMax(
    field:
      ScoreField,

    value:
      string,
  ) {
    const clean =
      cleanNumericInput(
        value,
      );

    setRawMaxes(
      (
        current,
      ) => ({
        ...current,

        [
          field
        ]:
          clean,
      }),
    );

    setDirty(
      true,
    );
  }

  /*
   * =====================================================
   * CALCULATE STUDENT
   * =====================================================
   */

  function calculateStudent(
    studentUserId:
      string,
  ) {
    const row =
      scores[
        studentUserId
      ] ??
      emptyScore();

    const test =
      normalizeScore(
        row.test,
        rawMaxes.test,
        SCORE_WEIGHTS.test,
      );

    const mid =
      normalizeScore(
        row.mid,
        rawMaxes.mid,
        SCORE_WEIGHTS.mid,
      );

    const assignment =
      normalizeScore(
        row.assignment,
        rawMaxes.assignment,
        SCORE_WEIGHTS.assignment,
      );

    const finalExam =
      normalizeScore(
        row.finalExam,
        rawMaxes.finalExam,
        SCORE_WEIGHTS.finalExam,
      );

    const complete =
      test !== null &&
      mid !== null &&
      assignment !== null &&
      finalExam !== null;

    return {
      test,

      mid,

      assignment,

      finalExam,

      total:
        complete
          ? Math.round(
              (
                test +
                mid +
                assignment +
                finalExam
              ) *
                100,
            ) /
            100
          : null,

      complete,
    };
  }

  /*
   * =====================================================
   * CURRENT SEMESTER RANK
   * =====================================================
   */

  const semesterRanks =
    useMemo(
      () => {
        return buildCompetitionRanks(
          students.map(
            (
              student,
            ) => ({
              userId:
                student.userId,

              total:
                calculateStudent(
                  student.userId,
                ).total,
            }),
          ),
        );
      },
      [
        students,
        scores,
        rawMaxes,
      ],
    );

  /*
   * =====================================================
   * FINAL RANK
   * =====================================================
   */

  const finalRanks =
    useMemo(
      () => {
        return buildCompetitionRanks(
          students.map(
            (
              student,
            ) => ({
              userId:
                student.userId,

              total:
                finalResults[
                  student.userId
                ]?.final ??
                null,
            }),
          ),
        );
      },
      [
        students,
        finalResults,
      ],
    );

  /*
   * =====================================================
   * MISSING MARKS
   * =====================================================
   */

  const fieldStarted =
    useMemo(
      () => {
        const result:
          Record<
            ScoreField,
            boolean
          > = {
          test:
            false,

          mid:
            false,

          assignment:
            false,

          finalExam:
            false,
        };

        for (
          const student of
          students
        ) {
          const row =
            scores[
              student.userId
            ] ??
            emptyScore();

          for (
            const field of
            SCORE_FIELDS
          ) {
            if (
              row[
                field
              ].trim()
            ) {
              result[
                field
              ] =
                true;
            }
          }
        }

        return result;
      },
      [
        scores,
        students,
      ],
    );

  function isMissing(
    studentUserId:
      string,

    field:
      ScoreField,
  ) {
    if (
      !fieldStarted[
        field
      ]
    ) {
      return false;
    }

    const row =
      scores[
        studentUserId
      ] ??
      emptyScore();

    return !row[
      field
    ].trim();
  }

  const missingCount =
    useMemo(
      () => {
        let count =
          0;

        for (
          const student of
          students
        ) {
          for (
            const field of
            SCORE_FIELDS
          ) {
            if (
              isMissing(
                student.userId,
                field,
              )
            ) {
              count +=
                1;
            }
          }
        }

        return count;
      },
      [
        students,
        scores,
        fieldStarted,
      ],
    );

  const completedStudents =
    useMemo(
      () =>
        students.filter(
          (
            student,
          ) =>
            calculateStudent(
              student.userId,
            ).complete,
        ).length,
      [
        students,
        scores,
        rawMaxes,
      ],
    );

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async function calculateAndSave() {
    if (
      !activeAssignment ||
      saving
    ) {
      return;
    }

    const sem =
      semesterNumber(
        semester,
      );

    if (
      !sem
    ) {
      return;
    }

    const testMax =
      parsePositive(
        rawMaxes.test,
      );

    const midMax =
      parsePositive(
        rawMaxes.mid,
      );

    const assignmentMax =
      parsePositive(
        rawMaxes.assignment,
      );

    const finalMax =
      parsePositive(
        rawMaxes.finalExam,
      );

    if (
      testMax === null ||
      midMax === null ||
      assignmentMax === null ||
      finalMax === null
    ) {
      showToast(
        'All maximum scores must be greater than 0.',
        'error',
      );

      return;
    }

    let hasScore =
      false;

    const marks =
      [];

    for (
      const student of
      students
    ) {
      const row =
        scores[
          student.userId
        ] ??
        emptyScore();

      const test =
        parseNumber(
          row.test,
        );

      const mid =
        parseNumber(
          row.mid,
        );

      const assignment =
        parseNumber(
          row.assignment,
        );

      const finalExam =
        parseNumber(
          row.finalExam,
        );

      if (
        test !== null ||
        mid !== null ||
        assignment !== null ||
        finalExam !== null
      ) {
        hasScore =
          true;
      }

      if (
        test !== null &&
        (
          test < 0 ||
          test > testMax
        )
      ) {
        showToast(
          `${student.fullName}: Test must be between 0 and ${testMax}.`,
          'error',
        );

        return;
      }

      if (
        mid !== null &&
        (
          mid < 0 ||
          mid > midMax
        )
      ) {
        showToast(
          `${student.fullName}: Mid must be between 0 and ${midMax}.`,
          'error',
        );

        return;
      }

      if (
        assignment !== null &&
        (
          assignment < 0 ||
          assignment >
            assignmentMax
        )
      ) {
        showToast(
          `${student.fullName}: Assignment must be between 0 and ${assignmentMax}.`,
          'error',
        );

        return;
      }

      if (
        finalExam !== null &&
        (
          finalExam < 0 ||
          finalExam >
            finalMax
        )
      ) {
        showToast(
          `${student.fullName}: Final exam must be between 0 and ${finalMax}.`,
          'error',
        );

        return;
      }

      marks.push({
        studentUserId:
          student.userId,

        testScore:
          test,

        midScore:
          mid,

        assignmentScore:
          assignment,

        finalExamScore:
          finalExam,
      });
    }

    if (
      !hasScore
    ) {
      showToast(
        'Enter at least one student mark first.',
        'error',
      );

      return;
    }

    try {
      setSaving(
        true,
      );

      const {
        error,
      } =
        await supabase.rpc(
          'save_mark_sheet',
          {
            p_class_id:
              activeAssignment.classId,

            p_subject:
              activeAssignment.subject,

            p_school_year:
              schoolYear,

            p_semester:
              sem,

            p_test_raw_max:
              testMax,

            p_mid_raw_max:
              midMax,

            p_assignment_raw_max:
              assignmentMax,

            p_final_exam_raw_max:
              finalMax,

            p_marks:
              marks,
          },
        );

      if (
        error
      ) {
        throw error;
      }

      setDirty(
        false,
      );

      await loadSheet(
        activeAssignment,
        semester,
      );

      showToast(
        `${activeAssignment.className} ${activeAssignment.subject} saved successfully.`,
        'success',
      );
    } catch (
      error
    ) {
      console.log(
        'SAVE MARK SHEET:',
        error,
      );

      showToast(
        error instanceof
        Error
          ? error.message
          : 'Could not save marks.',
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
   * EXPORT SEMESTER DATA
   * =====================================================
   */

  async function fetchSemesterForExport(
    assignment:
      TeachingAssignment,

    semesterValue:
      number,
  ): Promise<
    ExportSemesterData
  > {
    const {
      data:
        sheet,
      error:
        sheetError,
    } =
      await supabase
        .from(
          'mark_sheets',
        )
        .select(`
          id,
          test_raw_max,
          mid_raw_max,
          assignment_raw_max,
          final_exam_raw_max
        `)
        .eq(
          'class_id',
          assignment.classId,
        )
        .eq(
          'subject_key',
          assignment.subject
            .trim()
            .toLowerCase(),
        )
        .eq(
          'school_year',
          schoolYear,
        )
        .eq(
          'semester',
          semesterValue,
        )
        .maybeSingle();

    if (
      sheetError
    ) {
      throw sheetError;
    }

    if (
      !sheet
    ) {
      return {
        exists:
          false,

        testMax:
          10,

        midMax:
          30,

        assignmentMax:
          20,

        finalExamMax:
          40,

        marks:
          new Map(),
      };
    }

    const {
      data:
        entries,
      error:
        entryError,
    } =
      await supabase
        .from(
          'mark_sheet_entries',
        )
        .select(`
          student_user_id,
          test_raw_score,
          mid_raw_score,
          assignment_raw_score,
          final_exam_raw_score,
          test_score,
          mid_score,
          assignment_score,
          final_exam_score,
          total_score
        `)
        .eq(
          'mark_sheet_id',
          sheet.id,
        );

    if (
      entryError
    ) {
      throw entryError;
    }

    const map =
      new Map<
        string,
        StoredMark
      >();

    for (
      const entry of
      entries ??
      []
    ) {
      map.set(
        String(
          entry.student_user_id,
        ),
        {
          student_user_id:
            String(
              entry.student_user_id,
            ),

          test_raw_score:
            entry.test_raw_score ===
              null
              ? null
              : Number(
                  entry.test_raw_score,
                ),

          mid_raw_score:
            entry.mid_raw_score ===
              null
              ? null
              : Number(
                  entry.mid_raw_score,
                ),

          assignment_raw_score:
            entry
              .assignment_raw_score ===
              null
              ? null
              : Number(
                  entry
                    .assignment_raw_score,
                ),

          final_exam_raw_score:
            entry
              .final_exam_raw_score ===
              null
              ? null
              : Number(
                  entry
                    .final_exam_raw_score,
                ),

          test_score:
            entry.test_score ===
              null
              ? null
              : Number(
                  entry.test_score,
                ),

          mid_score:
            entry.mid_score ===
              null
              ? null
              : Number(
                  entry.mid_score,
                ),

          assignment_score:
            entry.assignment_score ===
              null
              ? null
              : Number(
                  entry.assignment_score,
                ),

          final_exam_score:
            entry.final_exam_score ===
              null
              ? null
              : Number(
                  entry.final_exam_score,
                ),

          total_score:
            entry.total_score ===
              null
              ? null
              : Number(
                  entry.total_score,
                ),
        },
      );
    }

    return {
      exists:
        true,

      testMax:
        Number(
          sheet.test_raw_max,
        ),

      midMax:
        Number(
          sheet.mid_raw_max,
        ),

      assignmentMax:
        Number(
          sheet.assignment_raw_max,
        ),

      finalExamMax:
        Number(
          sheet.final_exam_raw_max,
        ),

      marks:
        map,
    };
  }

  /*
   * =====================================================
   * EXPORT
   * =====================================================
   */

  async function exportWorkbook() {
    if (
      !activeAssignment ||
      exporting
    ) {
      return;
    }

    if (
      dirty
    ) {
      showToast(
        'Save your changes before downloading.',
        'error',
      );

      return;
    }

    try {
      setExporting(
        true,
      );

      let exportStudents =
        students;

      if (
        exportStudents.length ===
        0
      ) {
        exportStudents =
          await loadStudents(
            activeAssignment,
          );
      }

      const [
        first,
        second,
      ] =
        await Promise.all([
          fetchSemesterForExport(
            activeAssignment,
            1,
          ),

          fetchSemesterForExport(
            activeAssignment,
            2,
          ),
        ]);

      const workbook =
        XLSX.utils
          .book_new();

      function createSemesterSheet(
        title: string,

        data:
          ExportSemesterData,
      ) {
        const rankMap =
          buildCompetitionRanks(
            exportStudents.map(
              (
                student,
              ) => ({
                userId:
                  student.userId,

                total:
                  data.marks.get(
                    student.userId,
                  )?.total_score ??
                  null,
              }),
            ),
          );

        const rows:
          (
            string |
            number
          )[][] = [
          [
            `${activeAssignment?.subject ?? ''} - ${activeAssignment?.className ?? ''}`,
          ],

          [
            title,
          ],

          [
            `School Year: ${schoolYear}`,
          ],

          [],

          [
            'No',

            'Student Name',

            'Student ID',

            `Test Raw /${data.testMax}`,

            'Test /10',

            `Mid Raw /${data.midMax}`,

            'Mid /30',

            `Assignment Raw /${data.assignmentMax}`,

            'Assignment /20',

            `Final Raw /${data.finalExamMax}`,

            'Final /40',

            'Total /100',

            'Rank',
          ],
        ];

        exportStudents.forEach(
          (
            student,
            index,
          ) => {
            const mark =
              data.marks.get(
                student.userId,
              );

            rows.push([
              index +
                1,

              student.fullName,

              student.studentId ??
                '',

              mark
                ?.test_raw_score ??
                '',

              mark
                ?.test_score ??
                '',

              mark
                ?.mid_raw_score ??
                '',

              mark
                ?.mid_score ??
                '',

              mark
                ?.assignment_raw_score ??
                '',

              mark
                ?.assignment_score ??
                '',

              mark
                ?.final_exam_raw_score ??
                '',

              mark
                ?.final_exam_score ??
                '',

              mark
                ?.total_score ??
                '',

              rankMap.get(
                student.userId,
              ) ??
                '',
            ]);
          },
        );

        const sheet =
          XLSX.utils
            .aoa_to_sheet(
              rows,
            );

        sheet[
          '!cols'
        ] = [
          {
            wch: 6,
          },

          {
            wch: 28,
          },

          {
            wch: 18,
          },

          {
            wch: 16,
          },

          {
            wch: 12,
          },

          {
            wch: 16,
          },

          {
            wch: 12,
          },

          {
            wch: 19,
          },

          {
            wch: 16,
          },

          {
            wch: 16,
          },

          {
            wch: 12,
          },

          {
            wch: 14,
          },

          {
            wch: 9,
          },
        ];

        return sheet;
      }

      XLSX.utils
        .book_append_sheet(
          workbook,

          createSemesterSheet(
            'First Semester',
            first,
          ),

          'First Semester',
        );

      XLSX.utils
        .book_append_sheet(
          workbook,

          createSemesterSheet(
            'Second Semester',
            second,
          ),

          'Second Semester',
        );

      /*
       * =================================================
       * FINAL EXPORT + RANK
       * =================================================
       */

      const finalScores =
        exportStudents.map(
          (
            student,
          ) => {
            const firstTotal =
              first.marks.get(
                student.userId,
              )?.total_score ??
              null;

            const secondTotal =
              second.marks.get(
                student.userId,
              )?.total_score ??
              null;

            const average =
              firstTotal !==
                null &&
              secondTotal !==
                null
                ? Math.round(
                    (
                      (
                        firstTotal +
                        secondTotal
                      ) /
                      2
                    ) *
                      100,
                  ) /
                  100
                : null;

            return {
              student,

              firstTotal,

              secondTotal,

              average,
            };
          },
        );

      const finalExportRanks =
        buildCompetitionRanks(
          finalScores.map(
            (
              item,
            ) => ({
              userId:
                item.student
                  .userId,

              total:
                item.average,
            }),
          ),
        );

      const finalRows:
        (
          string |
          number
        )[][] = [
        [
          `${activeAssignment.subject} - ${activeAssignment.className}`,
        ],

        [
          'Final Result',
        ],

        [
          `School Year: ${schoolYear}`,
        ],

        [],

        [
          'No',

          'Student Name',

          'Student ID',

          'First Semester /100',

          'Second Semester /100',

          'Final Average /100',

          'Rank',
        ],
      ];

      finalScores.forEach(
        (
          item,
          index,
        ) => {
          finalRows.push([
            index +
              1,

            item.student
              .fullName,

            item.student
              .studentId ??
              '',

            item.firstTotal ??
              '',

            item.secondTotal ??
              '',

            item.average ??
              '',

            finalExportRanks.get(
              item.student
                .userId,
            ) ??
              '',
          ]);
        },
      );

      const finalSheet =
        XLSX.utils
          .aoa_to_sheet(
            finalRows,
          );

      finalSheet[
        '!cols'
      ] = [
        {
          wch: 6,
        },

        {
          wch: 28,
        },

        {
          wch: 18,
        },

        {
          wch: 22,
        },

        {
          wch: 23,
        },

        {
          wch: 20,
        },

        {
          wch: 9,
        },
      ];

      XLSX.utils
        .book_append_sheet(
          workbook,

          finalSheet,

          'Final Result',
        );

      const base64 =
        XLSX.write(
          workbook,
          {
            type:
              'base64',

            bookType:
              'xlsx',
          },
        );

      const directory =
        FileSystem
          .documentDirectory;

      if (
        !directory
      ) {
        throw new Error(
          'Device file storage is unavailable.',
        );
      }

      const fileName =
        `${safeFileName(
          activeAssignment.subject,
        )}-${safeFileName(
          activeAssignment.className,
        )}-${schoolYear}-marks.xlsx`;

      const fileUri =
        `${directory}${fileName}`;

      await FileSystem
        .writeAsStringAsync(
          fileUri,
          base64,
          {
            encoding:
              FileSystem
                .EncodingType
                .Base64,
          },
        );

      const available =
        await Sharing
          .isAvailableAsync();

      if (
        !available
      ) {
        throw new Error(
          'Sharing is unavailable on this device.',
        );
      }

      await Sharing
        .shareAsync(
          fileUri,
          {
            mimeType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

            dialogTitle:
              'Save Mark Sheet',
          },
        );

      showToast(
        'Excel mark sheet created.',
        'success',
      );
    } catch (
      error
    ) {
      console.log(
        'EXPORT MARK SHEET:',
        error,
      );

      showToast(
        error instanceof
        Error
          ? error.message
          : 'Could not export mark sheet.',
        'error',
      );
    } finally {
      setExporting(
        false,
      );
    }
  }

  /*
   * =====================================================
   * CLOSE SHEET
   * =====================================================
   */

  function closeSheet() {
    if (
      dirty
    ) {
      showToast(
        'Save your changes before leaving.',
        'error',
      );

      return;
    }

    /*
     * Cancel any request still running.
     */

    sheetLoadRequest.current +=
      1;

    setSheetLoading(
      false,
    );

    setSemesterPickerOpen(
      false,
    );

    setSheetOpen(
      false,
    );

    setStudents(
      [],
    );

    setScores(
      {},
    );

    setFinalResults(
      {},
    );

    setActiveAssignment(
      null,
    );

    hideToastImmediately();
  }

  /*
   * =====================================================
   * TOAST UI
   *
   * Only ONE copy is visible:
   *
   * Main screen -> main toast
   * Modal open  -> modal toast
   *
   * This prevents the duplicate/ghost toast glitch.
   * =====================================================
   */

  function ToastBanner() {
    if (
      !toastMessage
    ) {
      return null;
    }

    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,

          {
            transform: [
              {
                translateY:
                  toastY,
              },
            ],

            backgroundColor:
              toastType ===
              'success'
                ? '#16A34A'
                : colors.danger,
          },
        ]}
      >
        <Ionicons
          name={
            toastType ===
            'success'
              ? 'checkmark-circle'
              : 'alert-circle'
          }
          size={19}
          color="#FFFFFF"
        />

        <Text
          numberOfLines={
            2
          }
          style={
            styles.toastText
          }
        >
          {
            toastMessage
          }
        </Text>
      </Animated.View>
    );
  }

  /*
   * =====================================================
   * MAIN
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
      {!sheetOpen ? (
        <ToastBanner />
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.pageContent
        }
      >
        <View
          style={
            styles.pageHeading
          }
        >
          <View
            style={[
              styles.headingIcon,

              {
                backgroundColor:
                  colors.primarySoft,
              },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
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
              style={[
                styles.pageTitle,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              Mark Sheets
            </Text>

            <Text
              style={[
                styles.pageSubtitle,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Record, calculate and export student marks.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.yearBadge,

            {
              backgroundColor:
                colors.primarySoft,
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={
              colors.primary
            }
          />

          <Text
            style={[
              styles.yearText,

              {
                color:
                  colors.primary,
              },
            ]}
          >
            {
              schoolYear
            }
          </Text>
        </View>

        {assignmentsLoading ? (
          <View
            style={
              styles.loadingArea
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
              Loading mark sheets...
            </Text>
          </View>
        ) : groupedAssignments.length ===
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
                name="documents-outline"
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
              No mark sheets
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
              Your assigned classroom subjects will appear here.
            </Text>
          </View>
        ) : (
          groupedAssignments.map(
            (
              [
                subject,
                subjectAssignments,
              ],
            ) => (
              <View
                key={
                  subject
                }
                style={
                  styles.subjectSection
                }
              >
                <View
                  style={
                    styles.subjectHeader
                  }
                >
                  <View>
                    <Text
                      style={[
                        styles.subjectName,

                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      {
                        subject
                      }
                    </Text>

                    <Text
                      style={[
                        styles.subjectCount,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {
                        subjectAssignments.length
                      } class
                      {
                        subjectAssignments.length ===
                        1
                          ? ''
                          : 'es'
                      }
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.subjectIcon,

                      {
                        backgroundColor:
                          colors.primarySoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name="book-outline"
                      size={18}
                      color={
                        colors.primary
                      }
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.sheetList
                  }
                >
                  {subjectAssignments.map(
                    (
                      assignment,
                    ) => (
                      <Pressable
                        key={
                          `${assignment.classId}-${assignment.subject}`
                        }
                        onPress={() =>
                          void openSheet(
                            assignment,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.sheetCard,

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
                        <View
                          style={[
                            styles.sheetIcon,

                            {
                              backgroundColor:
                                colors.primarySoft,
                            },
                          ]}
                        >
                          <Ionicons
                            name="grid-outline"
                            size={20}
                            color={
                              colors.primary
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.sheetInfo
                          }
                        >
                          <Text
                            style={[
                              styles.sheetTitle,

                              {
                                color:
                                  colors.text,
                              },
                            ]}
                          >
                            {
                              assignment.className
                            } Mark Sheet
                          </Text>

                          <Text
                            style={[
                              styles.sheetMeta,

                              {
                                color:
                                  colors.textMuted,
                              },
                            ]}
                          >
                            {categoryLabel(
                              assignment.category,
                            )}

                            {' • '}

                            {
                              assignment.subject
                            }
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
                </View>
              </View>
            ),
          )
        )}
      </ScrollView>

      {/* ================================================= */}
      {/* MARK SHEET MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          sheetOpen
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={
          closeSheet
        }
      >
        <KeyboardAvoidingView
          style={[
            styles.modalScreen,

            {
              backgroundColor:
                colors.background,
            },
          ]}
          behavior={
            Platform.OS ===
            'ios'
              ? 'padding'
              : undefined
          }
        >
          <StatusBar
            style={
              resolvedTheme ===
              'dark'
                ? 'light'
                : 'dark'
            }
          />

          {sheetOpen ? (
            <ToastBanner />
          ) : null}

          {/* HEADER */}

          <View
            style={[
              styles.modalHeader,

              {
                backgroundColor:
                  colors.surface,

                borderBottomColor:
                  colors.border,
              },
            ]}
          >
            <Pressable
              onPress={
                closeSheet
              }
              disabled={
                saving
              }
              style={
                styles.headerButton
              }
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={
                  colors.text
                }
              />
            </Pressable>

            <View
              style={
                styles.modalHeaderCenter
              }
            >
              <Text
                numberOfLines={
                  1
                }
                style={[
                  styles.modalTitle,

                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {
                  activeAssignment
                    ?.subject
                }
              </Text>

              <Text
                style={[
                  styles.modalSubtitle,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  activeAssignment
                    ?.className
                }

                {' • '}

                {
                  schoolYear
                }
              </Text>
            </View>

            <Pressable
              disabled={
                exporting ||
                saving
              }
              onPress={() =>
                void exportWorkbook()
              }
              style={[
                styles.downloadHeader,

                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              {exporting ? (
                <ActivityIndicator
                  size="small"
                  color={
                    colors.primary
                  }
                />
              ) : (
                <Ionicons
                  name="download-outline"
                  size={19}
                  color={
                    colors.primary
                  }
                />
              )}
            </Pressable>
          </View>

          {sheetLoading ? (
            <View
              style={
                styles.loadingArea
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
                Loading students...
              </Text>
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.markContent
              }
            >
              {/* SEMESTER */}

              <Text
                style={[
                  styles.fieldLabel,

                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                MARK SHEET
              </Text>

              <Pressable
                disabled={
                  sheetLoading ||
                  saving
                }
                onPress={() =>
                  setSemesterPickerOpen(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
                style={[
                  styles.semesterSelector,

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
                    styles.semesterIcon,

                    {
                      backgroundColor:
                        colors.primarySoft,
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
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
                    style={[
                      styles.semesterTitle,

                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    {
                      semesterLabel(
                        semester,
                      )
                    }
                  </Text>

                  <Text
                    style={[
                      styles.semesterSubtext,

                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    {semester ===
                    'final'
                      ? 'Average of both semesters'
                      : 'Student score sheet'}
                  </Text>
                </View>

                <Ionicons
                  name={
                    semesterPickerOpen
                      ? 'chevron-up'
                      : 'chevron-down'
                  }
                  size={18}
                  color={
                    colors.textMuted
                  }
                />
              </Pressable>

              {semesterPickerOpen ? (
                <View
                  style={[
                    styles.semesterDropdown,

                    {
                      backgroundColor:
                        colors.card,

                      borderColor:
                        colors.border,
                    },
                  ]}
                >
                  {(
                    [
                      'first',
                      'second',
                      'final',
                    ] as
                      SemesterMode[]
                  ).map(
                    (
                      item,
                    ) => {
                      const selected =
                        item ===
                        semester;

                      return (
                        <Pressable
                          key={
                            item
                          }
                          onPress={() =>
                            void selectSemester(
                              item,
                            )
                          }
                          style={[
                            styles.semesterOption,

                            selected && {
                              backgroundColor:
                                colors.primarySoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.semesterOptionText,

                              {
                                color:
                                  selected
                                    ? colors.primary
                                    : colors.text,
                              },
                            ]}
                          >
                            {
                              semesterLabel(
                                item,
                              )
                            }
                          </Text>

                          {selected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={
                                colors.primary
                              }
                            />
                          ) : null}
                        </Pressable>
                      );
                    },
                  )}
                </View>
              ) : null}

              {/* ================================================= */}
              {/* NORMAL SEMESTER */}
              {/* ================================================= */}

              {semester !==
              'final' ? (
                <>
                  {/* SCORE SETUP */}

                  <View
                    style={
                      styles.sectionHeading
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
                      Score Setup
                    </Text>

                    <Text
                      style={[
                        styles.sectionDescription,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      Enter the actual raw maximum. The app converts it to the official weight.
                    </Text>
                  </View>

                  <View
                    style={
                      styles.maxGrid
                    }
                  >
                    <MaxInput
                      title="Test"
                      weight={
                        10
                      }
                      value={
                        rawMaxes.test
                      }
                      onChange={(
                        value,
                      ) =>
                        changeRawMax(
                          'test',
                          value,
                        )
                      }
                      colors={
                        colors
                      }
                      styles={
                        styles
                      }
                    />

                    <MaxInput
                      title="Mid"
                      weight={
                        30
                      }
                      value={
                        rawMaxes.mid
                      }
                      onChange={(
                        value,
                      ) =>
                        changeRawMax(
                          'mid',
                          value,
                        )
                      }
                      colors={
                        colors
                      }
                      styles={
                        styles
                      }
                    />

                    <MaxInput
                      title="Assignment & Other"
                      weight={
                        20
                      }
                      value={
                        rawMaxes.assignment
                      }
                      onChange={(
                        value,
                      ) =>
                        changeRawMax(
                          'assignment',
                          value,
                        )
                      }
                      colors={
                        colors
                      }
                      styles={
                        styles
                      }
                    />

                    <MaxInput
                      title="Final Exam"
                      weight={
                        40
                      }
                      value={
                        rawMaxes.finalExam
                      }
                      onChange={(
                        value,
                      ) =>
                        changeRawMax(
                          'finalExam',
                          value,
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

                  {/* STATUS */}

                  <View
                    style={
                      styles.statRow
                    }
                  >
                    <View
                      style={[
                        styles.statCard,

                        {
                          backgroundColor:
                            colors.card,

                          borderColor:
                            colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statNumber,

                          {
                            color:
                              colors.primary,
                          },
                        ]}
                      >
                        {
                          completedStudents
                        }/
                        {
                          students.length
                        }
                      </Text>

                      <Text
                        style={[
                          styles.statLabel,

                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Complete
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statCard,

                        {
                          backgroundColor:
                            missingCount >
                            0
                              ? 'rgba(239,68,68,0.07)'
                              : colors.card,

                          borderColor:
                            missingCount >
                            0
                              ? colors.danger
                              : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statNumber,

                          {
                            color:
                              missingCount >
                              0
                                ? colors.danger
                                : colors.text,
                          },
                        ]}
                      >
                        {
                          missingCount
                        }
                      </Text>

                      <Text
                        style={[
                          styles.statLabel,

                          {
                            color:
                              colors.textMuted,
                          },
                        ]}
                      >
                        Missing marks
                      </Text>
                    </View>
                  </View>

                  {missingCount >
                  0 ? (
                    <View
                      style={
                        styles.missingNotice
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
                        style={[
                          styles.missingNoticeText,

                          {
                            color:
                              colors.danger,
                          },
                        ]}
                      >
                        Red cells show a student missing a mark that other students already have.
                      </Text>
                    </View>
                  ) : null}

                  {/* TABLE */}

                  <View
                    style={
                      styles.sectionHeading
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
                      {
                        activeAssignment
                          ?.className
                      } Mark Sheet
                    </Text>

                    <Text
                      style={[
                        styles.sectionDescription,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      Students are alphabetical. Rank uses completed /100 totals.
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    keyboardShouldPersistTaps="handled"
                    style={[
                      styles.tableOuter,

                      {
                        borderColor:
                          colors.border,
                      },
                    ]}
                  >
                    <View>
                      {/* TABLE HEADER */}

                      <View
                        style={[
                          styles.tableHeader,

                          {
                            backgroundColor:
                              colors.surfaceSecondary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.noHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          No.
                        </Text>

                        <Text
                          style={[
                            styles.nameHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Student Name
                        </Text>

                        <Text
                          style={[
                            styles.scoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Test /10
                        </Text>

                        <Text
                          style={[
                            styles.scoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Mid /30
                        </Text>

                        <Text
                          style={[
                            styles.scoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Assign /20
                        </Text>

                        <Text
                          style={[
                            styles.scoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Final /40
                        </Text>

                        <Text
                          style={[
                            styles.totalHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Total /100
                        </Text>

                        <Text
                          style={[
                            styles.rankHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Rank
                        </Text>
                      </View>

                      {/* STUDENT ROWS */}

                      {students.map(
                        (
                          student,
                          index,
                        ) => {
                          const row =
                            scores[
                              student.userId
                            ] ??
                            emptyScore();

                          const calculated =
                            calculateStudent(
                              student.userId,
                            );

                          const rank =
                            semesterRanks.get(
                              student.userId,
                            );

                          return (
                            <View
                              key={
                                student.userId
                              }
                              style={[
                                styles.tableRow,

                                {
                                  backgroundColor:
                                    colors.card,

                                  borderTopColor:
                                    colors.border,
                                },
                              ]}
                            >
                              <View
                                style={
                                  styles.noCell
                                }
                              >
                                <Text
                                  style={[
                                    styles.rowNumber,

                                    {
                                      color:
                                        colors.textMuted,
                                    },
                                  ]}
                                >
                                  {
                                    index +
                                    1
                                  }
                                </Text>
                              </View>

                              <View
                                style={
                                  styles.nameCell
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
                                    student.fullName
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
                                  {
                                    student.studentId ??
                                    'Student'
                                  }
                                </Text>
                              </View>

                              <ScoreCell
                                value={
                                  row.test
                                }
                                normalized={
                                  calculated.test
                                }
                                rawMax={
                                  rawMaxes.test
                                }
                                weight={
                                  10
                                }
                                missing={
                                  isMissing(
                                    student.userId,
                                    'test',
                                  )
                                }
                                onChange={(
                                  value,
                                ) =>
                                  changeScore(
                                    student.userId,
                                    'test',
                                    value,
                                  )
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />

                              <ScoreCell
                                value={
                                  row.mid
                                }
                                normalized={
                                  calculated.mid
                                }
                                rawMax={
                                  rawMaxes.mid
                                }
                                weight={
                                  30
                                }
                                missing={
                                  isMissing(
                                    student.userId,
                                    'mid',
                                  )
                                }
                                onChange={(
                                  value,
                                ) =>
                                  changeScore(
                                    student.userId,
                                    'mid',
                                    value,
                                  )
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />

                              <ScoreCell
                                value={
                                  row.assignment
                                }
                                normalized={
                                  calculated.assignment
                                }
                                rawMax={
                                  rawMaxes.assignment
                                }
                                weight={
                                  20
                                }
                                missing={
                                  isMissing(
                                    student.userId,
                                    'assignment',
                                  )
                                }
                                onChange={(
                                  value,
                                ) =>
                                  changeScore(
                                    student.userId,
                                    'assignment',
                                    value,
                                  )
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />

                              <ScoreCell
                                value={
                                  row.finalExam
                                }
                                normalized={
                                  calculated.finalExam
                                }
                                rawMax={
                                  rawMaxes.finalExam
                                }
                                weight={
                                  40
                                }
                                missing={
                                  isMissing(
                                    student.userId,
                                    'finalExam',
                                  )
                                }
                                onChange={(
                                  value,
                                ) =>
                                  changeScore(
                                    student.userId,
                                    'finalExam',
                                    value,
                                  )
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />

                              {/* TOTAL */}

                              <View
                                style={
                                  styles.totalCell
                                }
                              >
                                <View
                                  style={[
                                    styles.totalBadge,

                                    {
                                      backgroundColor:
                                        calculated.complete
                                          ? colors.primarySoft
                                          : colors.surfaceSecondary,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.totalText,

                                      {
                                        color:
                                          calculated.complete
                                            ? colors.primary
                                            : colors.textMuted,
                                      },
                                    ]}
                                  >
                                    {
                                      formatScore(
                                        calculated.total,
                                      )
                                    }
                                  </Text>
                                </View>
                              </View>

                              {/* RANK */}

                              <RankCell
                                rank={
                                  rank
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />
                            </View>
                          );
                        },
                      )}

                      {students.length ===
                      0 ? (
                        <View
                          style={[
                            styles.noStudents,

                            {
                              backgroundColor:
                                colors.card,
                            },
                          ]}
                        >
                          <Text
                            style={{
                              color:
                                colors.textMuted,
                            }}
                          >
                            No students found in this classroom.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </ScrollView>

                  {/* SAVE */}

                  <Pressable
                    disabled={
                      saving ||
                      students.length ===
                        0
                    }
                    onPress={() =>
                      void calculateAndSave()
                    }
                    style={[
                      styles.saveButton,

                      {
                        backgroundColor:
                          colors.primary,

                        opacity:
                          saving ||
                          students.length ===
                            0
                            ? 0.55
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
                          name="calculator-outline"
                          size={19}
                          color="#FFFFFF"
                        />

                        <Text
                          style={
                            styles.saveButtonText
                          }
                        >
                          Calculate & Save
                        </Text>
                      </>
                    )}
                  </Pressable>

                  {dirty ? (
                    <Text
                      style={[
                        styles.unsavedText,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      Unsaved changes
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  {/* ================================================= */}
                  {/* FINAL RESULT */}
                  {/* ================================================= */}

                  <View
                    style={[
                      styles.finalInfo,

                      {
                        backgroundColor:
                          colors.primarySoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name="calculator-outline"
                      size={20}
                      color={
                        colors.primary
                      }
                    />

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={[
                          styles.finalInfoTitle,

                          {
                            color:
                              colors.primary,
                          },
                        ]}
                      >
                        Final Average
                      </Text>

                      <Text
                        style={[
                          styles.finalInfoText,

                          {
                            color:
                              colors.textSecondary,
                          },
                        ]}
                      >
                        (First Semester + Second Semester) ÷ 2
                      </Text>
                    </View>
                  </View>

                  <View
                    style={
                      styles.finalRankHint
                    }
                  >
                    <Ionicons
                      name="trophy-outline"
                      size={16}
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={[
                        styles.finalRankHintText,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      Final rank is based on the final average for this subject and class.
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator
                    style={[
                      styles.tableOuter,

                      {
                        borderColor:
                          colors.border,
                      },
                    ]}
                  >
                    <View>
                      <View
                        style={[
                          styles.finalTableHeader,

                          {
                            backgroundColor:
                              colors.surfaceSecondary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.noHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          No.
                        </Text>

                        <Text
                          style={[
                            styles.nameHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Student Name
                        </Text>

                        <Text
                          style={[
                            styles.finalScoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          1st /100
                        </Text>

                        <Text
                          style={[
                            styles.finalScoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          2nd /100
                        </Text>

                        <Text
                          style={[
                            styles.finalScoreHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Final /100
                        </Text>

                        <Text
                          style={[
                            styles.rankHeader,

                            styles.tableHeaderText,

                            {
                              color:
                                colors.textSecondary,
                            },
                          ]}
                        >
                          Rank
                        </Text>
                      </View>

                      {students.map(
                        (
                          student,
                          index,
                        ) => {
                          const result =
                            finalResults[
                              student.userId
                            ] ?? {
                              first:
                                null,

                              second:
                                null,

                              final:
                                null,
                            };

                          const rank =
                            finalRanks.get(
                              student.userId,
                            );

                          return (
                            <View
                              key={
                                student.userId
                              }
                              style={[
                                styles.finalTableRow,

                                {
                                  backgroundColor:
                                    colors.card,

                                  borderTopColor:
                                    colors.border,
                                },
                              ]}
                            >
                              <View
                                style={
                                  styles.noCell
                                }
                              >
                                <Text
                                  style={[
                                    styles.rowNumber,

                                    {
                                      color:
                                        colors.textMuted,
                                    },
                                  ]}
                                >
                                  {
                                    index +
                                    1
                                  }
                                </Text>
                              </View>

                              <View
                                style={
                                  styles.nameCell
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
                                    student.fullName
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
                                  {
                                    student.studentId ??
                                    'Student'
                                  }
                                </Text>
                              </View>

                              <FinalCell
                                value={
                                  result.first
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />

                              <FinalCell
                                value={
                                  result.second
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
                                  styles.finalScoreCell
                                }
                              >
                                <View
                                  style={[
                                    styles.finalBadge,

                                    {
                                      backgroundColor:
                                        result.final !==
                                        null
                                          ? colors.primarySoft
                                          : colors.surfaceSecondary,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.finalBadgeText,

                                      {
                                        color:
                                          result.final !==
                                          null
                                            ? colors.primary
                                            : colors.textMuted,
                                      },
                                    ]}
                                  >
                                    {
                                      formatScore(
                                        result.final,
                                      )
                                    }
                                  </Text>
                                </View>
                              </View>

                              <RankCell
                                rank={
                                  rank
                                }
                                colors={
                                  colors
                                }
                                styles={
                                  styles
                                }
                              />
                            </View>
                          );
                        },
                      )}
                    </View>
                  </ScrollView>

                  <Pressable
                    disabled={
                      exporting
                    }
                    onPress={() =>
                      void exportWorkbook()
                    }
                    style={[
                      styles.exportButton,

                      {
                        backgroundColor:
                          colors.primarySoft,
                      },
                    ]}
                  >
                    {exporting ? (
                      <ActivityIndicator
                        color={
                          colors.primary
                        }
                      />
                    ) : (
                      <Ionicons
                        name="download-outline"
                        size={19}
                        color={
                          colors.primary
                        }
                      />
                    )}

                    <Text
                      style={[
                        styles.exportText,

                        {
                          color:
                            colors.primary,
                        },
                      ]}
                    >
                      Export All 3 Sheets
                    </Text>
                  </Pressable>
                </>
              )}

              <View
                style={{
                  height: 45,
                }}
              />
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

/*
 * =========================================================
 * TYPES FOR COMPONENT STYLES
 * =========================================================
 */

type ScreenStyles =
  ReturnType<
    typeof createStyles
  >;

/*
 * =========================================================
 * MAX INPUT
 *
 * KEEPING THIS EDITABLE.
 * =========================================================
 */

function MaxInput({
  title,
  weight,
  value,
  onChange,
  colors,
  styles,
}: {
  title: string;

  weight: number;

  value: string;

  onChange:
    (
      value:
        string,
    ) => void;

  colors:
    AppThemeColors;

  styles:
    ScreenStyles;
}) {
  return (
    <View
      style={[
        styles.maxCard,

        {
          backgroundColor:
            colors.card,

          borderColor:
            colors.border,
        },
      ]}
    >
      <Text
        numberOfLines={
          1
        }
        style={[
          styles.maxTitle,

          {
            color:
              colors.text,
          },
        ]}
      >
        {
          title
        }
      </Text>

      <Text
        style={[
          styles.maxWeight,

          {
            color:
              colors.primary,
          },
        ]}
      >
        Counts /{
          weight
        }
      </Text>

      <View
        style={[
          styles.maxInputWrap,

          {
            backgroundColor:
              colors.input,

            borderColor:
              colors.border,
          },
        ]}
      >
        <Text
          style={{
            color:
              colors.textMuted,
          }}
        >
          /
        </Text>

        <TextInput
          value={
            value
          }
          onChangeText={
            onChange
          }
          keyboardType="decimal-pad"
          placeholder="10"
          placeholderTextColor={
            colors.textMuted
          }
          selectionColor={
            colors.primary
          }
          style={[
            styles.maxInput,

            {
              color:
                colors.text,
            },
          ]}
        />
      </View>
    </View>
  );
}

/*
 * =========================================================
 * SCORE CELL
 * =========================================================
 */

function ScoreCell({
  value,
  normalized,
  rawMax,
  weight,
  missing,
  onChange,
  colors,
  styles,
}: {
  value: string;

  normalized:
    | number
    | null;

  rawMax: string;

  weight: number;

  missing: boolean;

  onChange:
    (
      value:
        string,
    ) => void;

  colors:
    AppThemeColors;

  styles:
    ScreenStyles;
}) {
  return (
    <View
      style={
        styles.scoreCell
      }
    >
      <View
        style={[
          styles.scoreInputWrap,

          {
            backgroundColor:
              missing
                ? 'rgba(239,68,68,0.08)'
                : colors.input,

            borderColor:
              missing
                ? colors.danger
                : colors.border,
          },
        ]}
      >
        <TextInput
          value={
            value
          }
          onChangeText={
            onChange
          }
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={
            missing
              ? colors.danger
              : colors.textMuted
          }
          selectionColor={
            colors.primary
          }
          style={[
            styles.scoreInput,

            {
              color:
                colors.text,
            },
          ]}
        />

        <Text
          style={[
            styles.rawMaxText,

            {
              color:
                missing
                  ? colors.danger
                  : colors.textMuted,
            },
          ]}
        >
          /{
            rawMax ||
            '?'
          }
        </Text>
      </View>

      <Text
        style={[
          styles.normalizedText,

          {
            color:
              missing
                ? colors.danger
                : colors.textMuted,
          },
        ]}
      >
        {normalized ===
        null
          ? '—'
          : `${formatScore(
              normalized,
            )}/${weight}`}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * FINAL CELL
 * =========================================================
 */

function FinalCell({
  value,
  colors,
  styles,
}: {
  value:
    | number
    | null;

  colors:
    AppThemeColors;

  styles:
    ScreenStyles;
}) {
  return (
    <View
      style={
        styles.finalScoreCell
      }
    >
      <Text
        style={[
          styles.finalCellText,

          {
            color:
              value ===
              null
                ? colors.textMuted
                : colors.text,
          },
        ]}
      >
        {
          formatScore(
            value,
          )
        }
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * RANK CELL
 * =========================================================
 */

function RankCell({
  rank,
  colors,
  styles,
}: {
  rank:
    | number
    | undefined;

  colors:
    AppThemeColors;

  styles:
    ScreenStyles;
}) {
  return (
    <View
      style={
        styles.rankCell
      }
    >
      {rank ? (
        <View
          style={[
            styles.rankBadge,

            {
              backgroundColor:
                colors.primarySoft,
            },
          ]}
        >
          {rank <= 3 ? (
            <Ionicons
              name="trophy-outline"
              size={12}
              color={
                colors.primary
              }
            />
          ) : null}

          <Text
            style={[
              styles.rankText,

              {
                color:
                  colors.primary,
              },
            ]}
          >
            #{rank}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.rankEmpty,

            {
              color:
                colors.textMuted,
            },
          ]}
        >
          —
        </Text>
      )}
    </View>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },

    /*
     * MAIN PAGE
     */

    pageContent: {
      paddingHorizontal:
        16,

      paddingTop:
        18,

      paddingBottom:
        110,
    },

    pageHeading: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 11,
    },

    headingIcon: {
      width: 46,

      height: 46,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    pageTitle: {
      fontSize: 20,

      fontWeight:
        '800',
    },

    pageSubtitle: {
      marginTop: 3,

      fontSize:
        11.5,
    },

    yearBadge: {
      alignSelf:
        'flex-start',

      marginTop: 15,

      minHeight: 31,

      paddingHorizontal:
        10,

      borderRadius:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,
    },

    yearText: {
      fontSize:
        10.5,

      fontWeight:
        '700',
    },

    /*
     * LOADING / EMPTY
     */

    loadingArea: {
      flex: 1,

      minHeight:
        300,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 8,
    },

    loadingText: {
      fontSize: 11,
    },

    emptyCard: {
      marginTop: 25,

      minHeight:
        250,

      padding: 25,

      borderWidth: 1,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyIcon: {
      width: 56,

      height: 56,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop: 12,

      fontSize: 15,

      fontWeight:
        '800',
    },

    emptyText: {
      marginTop: 5,

      maxWidth:
        230,

      textAlign:
        'center',

      fontSize: 11,

      lineHeight: 16,
    },

    /*
     * SUBJECT LIST
     */

    subjectSection: {
      marginTop: 25,
    },

    subjectHeader: {
      marginBottom:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    subjectName: {
      fontSize: 17,

      fontWeight:
        '800',
    },

    subjectCount: {
      marginTop: 2,

      fontSize: 10,
    },

    subjectIcon: {
      width: 35,

      height: 35,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    sheetList: {
      gap: 8,
    },

    sheetCard: {
      minHeight: 72,

      paddingHorizontal:
        12,

      paddingVertical:
        10,

      borderWidth: 1,

      borderRadius:
        17,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    sheetIcon: {
      width: 43,

      height: 43,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    sheetInfo: {
      flex: 1,

      marginLeft: 11,
    },

    sheetTitle: {
      fontSize:
        13.5,

      fontWeight:
        '700',
    },

    sheetMeta: {
      marginTop: 4,

      fontSize: 10,
    },

    /*
     * MODAL
     */

    modalScreen: {
      flex: 1,
    },

    modalHeader: {
      minHeight: 60,

      paddingHorizontal:
        11,

      borderBottomWidth:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    headerButton: {
      width: 42,

      height: 42,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    modalHeaderCenter: {
      flex: 1,

      alignItems:
        'center',
    },

    modalTitle: {
      fontSize:
        14.5,

      fontWeight:
        '800',
    },

    modalSubtitle: {
      marginTop: 2,

      fontSize:
        9.5,
    },

    downloadHeader: {
      width: 40,

      height: 40,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    markContent: {
      padding: 16,

      paddingBottom:
        60,
    },

    /*
     * SEMESTER
     */

    fieldLabel: {
      marginBottom: 6,

      fontSize: 9,

      fontWeight:
        '800',

      letterSpacing:
        0.5,
    },

    semesterSelector: {
      minHeight: 58,

      paddingHorizontal:
        11,

      borderWidth: 1,

      borderRadius:
        16,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 10,
    },

    semesterIcon: {
      width: 38,

      height: 38,

      borderRadius:
        12,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    semesterTitle: {
      fontSize: 13,

      fontWeight:
        '700',
    },

    semesterSubtext: {
      marginTop: 2,

      fontSize:
        9.5,
    },

    semesterDropdown: {
      marginTop: 6,

      padding: 6,

      borderWidth: 1,

      borderRadius:
        15,
    },

    semesterOption: {
      minHeight: 46,

      paddingHorizontal:
        11,

      borderRadius:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    semesterOptionText: {
      fontSize: 12,

      fontWeight:
        '600',
    },

    /*
     * SECTION
     */

    sectionHeading: {
      marginTop: 24,

      marginBottom:
        10,
    },

    sectionTitle: {
      fontSize: 15,

      fontWeight:
        '800',
    },

    sectionDescription: {
      marginTop: 3,

      fontSize: 10,

      lineHeight: 14,
    },

    /*
     * RAW MAX
     */

    maxGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap: 8,
    },

    maxCard: {
      width:
        '48.5%',

      minHeight:
        105,

      padding: 10,

      borderWidth: 1,

      borderRadius:
        15,
    },

    maxTitle: {
      fontSize: 11,

      fontWeight:
        '700',
    },

    maxWeight: {
      marginTop: 2,

      fontSize:
        9.5,

      fontWeight:
        '600',
    },

    maxInputWrap: {
      marginTop: 10,

      height: 37,

      paddingHorizontal:
        9,

      borderWidth: 1,

      borderRadius:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 3,
    },

    maxInput: {
      flex: 1,

      height: 36,

      fontSize: 12,

      fontWeight:
        '600',
    },

    /*
     * STATS
     */

    statRow: {
      marginTop: 14,

      flexDirection:
        'row',

      gap: 8,
    },

    statCard: {
      flex: 1,

      minHeight: 64,

      borderWidth: 1,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    statNumber: {
      fontSize: 17,

      fontWeight:
        '800',
    },

    statLabel: {
      marginTop: 2,

      fontSize:
        9.5,
    },

    missingNotice: {
      marginTop: 10,

      padding: 10,

      borderWidth: 1,

      borderColor:
        colors.danger,

      borderRadius:
        12,

      backgroundColor:
        'rgba(239,68,68,0.06)',

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,
    },

    missingNoticeText: {
      flex: 1,

      fontSize:
        9.5,

      lineHeight: 14,
    },

    /*
     * TABLE
     */

    tableOuter: {
      borderWidth: 1,

      borderRadius:
        15,

      overflow:
        'hidden',
    },

    tableHeader: {
      height: 48,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    finalTableHeader: {
      height: 48,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    tableHeaderText: {
      fontSize:
        9.5,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    noHeader: {
      width: 46,
    },

    nameHeader: {
      width: 170,

      paddingLeft: 10,

      textAlign:
        'left',
    },

    scoreHeader: {
      width: 115,
    },

    totalHeader: {
      width: 100,
    },

    rankHeader: {
      width: 80,
    },

    finalScoreHeader: {
      width: 120,
    },

    tableRow: {
      minHeight: 76,

      borderTopWidth:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    finalTableRow: {
      minHeight: 66,

      borderTopWidth:
        1,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    noCell: {
      width: 46,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    rowNumber: {
      fontSize: 11,

      fontWeight:
        '700',
    },

    nameCell: {
      width: 170,

      paddingHorizontal:
        10,

      justifyContent:
        'center',
    },

    studentName: {
      fontSize: 11,

      fontWeight:
        '700',
    },

    studentId: {
      marginTop: 3,

      fontSize:
        8.5,
    },

    /*
     * SCORE CELL
     */

    scoreCell: {
      width: 115,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    scoreInputWrap: {
      width: 82,

      height: 38,

      paddingHorizontal:
        5,

      borderWidth: 1,

      borderRadius:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    scoreInput: {
      flex: 1,

      height: 36,

      textAlign:
        'center',

      fontSize: 11,

      fontWeight:
        '700',
    },

    rawMaxText: {
      fontSize:
        7.5,
    },

    normalizedText: {
      marginTop: 3,

      fontSize: 8,
    },

    /*
     * TOTAL
     */

    totalCell: {
      width: 100,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    totalBadge: {
      minWidth: 58,

      height: 34,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    totalText: {
      fontSize: 12,

      fontWeight:
        '800',
    },

    /*
     * RANK
     */

    rankCell: {
      width: 80,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    rankBadge: {
      minWidth: 50,

      height: 32,

      paddingHorizontal:
        7,

      borderRadius:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 4,
    },

    rankText: {
      fontSize: 11,

      fontWeight:
        '800',
    },

    rankEmpty: {
      fontSize: 12,

      fontWeight:
        '600',
    },

    noStudents: {
      width: 856,

      height: 90,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    /*
     * SAVE
     */

    saveButton: {
      height: 52,

      marginTop: 18,

      borderRadius:
        16,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 7,
    },

    saveButtonText: {
      color:
        '#FFFFFF',

      fontSize: 13,

      fontWeight:
        '800',
    },

    unsavedText: {
      marginTop: 7,

      textAlign:
        'center',

      fontSize:
        9.5,
    },

    /*
     * FINAL
     */

    finalInfo: {
      marginTop: 20,

      marginBottom:
        10,

      padding: 13,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 10,
    },

    finalInfoTitle: {
      fontSize: 12,

      fontWeight:
        '800',
    },

    finalInfoText: {
      marginTop: 3,

      fontSize:
        9.5,
    },

    finalRankHint: {
      marginBottom:
        14,

      paddingHorizontal:
        4,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,
    },

    finalRankHintText: {
      flex: 1,

      fontSize:
        9.5,

      lineHeight: 14,
    },

    finalScoreCell: {
      width: 120,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    finalCellText: {
      fontSize: 12,

      fontWeight:
        '700',
    },

    finalBadge: {
      minWidth: 65,

      height: 35,

      paddingHorizontal:
        8,

      borderRadius:
        10,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    finalBadgeText: {
      fontSize: 12,

      fontWeight:
        '800',
    },

    /*
     * EXPORT
     */

    exportButton: {
      height: 50,

      marginTop: 18,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 7,
    },

    exportText: {
      fontSize: 12,

      fontWeight:
        '800',
    },

    /*
     * TOAST
     *
     * Positioned below header instead of over it.
     * =====================================================
     */

    toast: {
      position:
        'absolute',

      top: 68,

      left: 16,

      right: 16,

      minHeight: 50,

      paddingHorizontal:
        13,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 8,

      zIndex:
        9999,

      elevation:
        30,

      shadowColor:
        '#000000',

      shadowOpacity:
        0.16,

      shadowRadius:
        10,

      shadowOffset: {
        width: 0,

        height: 5,
      },
    },

    toastText: {
      flex: 1,

      color:
        '#FFFFFF',

      fontSize: 11,

      fontWeight:
        '700',

      lineHeight: 15,
    },
  });
}