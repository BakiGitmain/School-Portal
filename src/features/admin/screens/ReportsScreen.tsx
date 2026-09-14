import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';

import { supabase } from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

/* =========================================================
 * TYPES
 * ======================================================= */

type Period =
  | 'first'
  | 'second'
  | 'final';

type Category =
  | 'elementary'
  | 'high_school';

type StageKey =
  | 'test'
  | 'mid'
  | 'finalExam'
  | 'total'
  | 'finalResult';

type MarkStatus =
  | 'complete'
  | 'incomplete'
  | 'not_started';

type ReportStudent = {
  userId: string;
  fullName: string;
  studentId: string | null;

  stages: Partial<
    Record<
      StageKey,
      MarkStatus
    >
  >;
};

type ReportAssignment = {
  teacherUserId: string;
  teacherName: string;
  teacherId: string | null;

  classId: string;
  className: string;

  category: Category;

  subject: string;

  studentCount: number;

  stages: Partial<
    Record<
      StageKey,
      MarkStatus
    >
  >;

  students: ReportStudent[];
};

type ReportData = {
  assignments:
    ReportAssignment[];

  /*
   * started:
   *
   * Test/Mid/Final:
   * true once ANY teacher has entered
   * at least one mark.
   *
   * Total:
   * true only once at least ONE complete
   * teacher/class/subject markbook exists.
   */
  started: Partial<
    Record<
      StageKey,
      boolean
    >
  >;

  /*
   * ready:
   * true only when EVERY required
   * mark is complete.
   */
  ready: Partial<
    Record<
      StageKey,
      boolean
    >
  >;

  publications: Partial<
    Record<
      StageKey,
      boolean
    >
  >;
};

type TeacherGroup = {
  teacherUserId: string;
  teacherName: string;
  teacherId: string | null;

  assignments:
    ReportAssignment[];
};

type ScreenMode =
  | 'overview'
  | 'teacher'
  | 'students';

/* =========================================================
 * COLORS
 * ======================================================= */

const GREEN = '#249F66';
const GREEN_SOFT = '#E7F8F0';
const GREEN_BORDER = '#B9E8D1';

const RED = '#E54858';
const RED_SOFT = '#FFECEF';
const RED_BORDER = '#F3BBC2';

const GRAY = '#8D99A6';
const GRAY_SOFT = '#EEF2F6';

/* =========================================================
 * HELPERS
 * ======================================================= */

function schoolYear() {
  const now =
    new Date();

  const start =
    now.getMonth() >= 8
      ? now.getFullYear()
      : now.getFullYear() - 1;

  return `${start}-${start + 1}`;
}

function periodSemester(
  period: Period,
) {
  if (
    period === 'first'
  ) {
    return 1;
  }

  if (
    period === 'second'
  ) {
    return 2;
  }

  return 0;
}

function periodTitle(
  period: Period,
) {
  if (
    period === 'first'
  ) {
    return 'Semester 1';
  }

  if (
    period === 'second'
  ) {
    return 'Semester 2';
  }

  return 'Final';
}

function stageTitle(
  stage: StageKey,
) {
  if (
    stage === 'test'
  ) {
    return 'Test';
  }

  if (
    stage === 'mid'
  ) {
    return 'Mid';
  }

  if (
    stage === 'finalExam'
  ) {
    return 'Final';
  }

  if (
    stage === 'total'
  ) {
    return 'Total';
  }

  return 'Final';
}

function stageDbName(
  stage: StageKey,
) {
  if (
    stage === 'finalExam'
  ) {
    return 'final_exam';
  }

  if (
    stage === 'finalResult'
  ) {
    return 'final_result';
  }

  return stage;
}

function stagesForPeriod(
  period: Period,
): StageKey[] {
  if (
    period === 'final'
  ) {
    return [
      'finalResult',
    ];
  }

  return [
    'test',
    'mid',
    'finalExam',
    'total',
  ];
}

/* =========================================================
 * SAFE RPC RESULT
 * ======================================================= */

function safeReport(
  value: unknown,
): ReportData {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return {
      assignments: [],
      started: {},
      ready: {},
      publications: {},
    };
  }

  const data =
    value as Partial<ReportData>;

  return {
    assignments:
      Array.isArray(
        data.assignments,
      )
        ? data.assignments
        : [],

    started:
      data.started ?? {},

    ready:
      data.ready ?? {},

    publications:
      data.publications ?? {},
  };
}

/* =========================================================
 * TEACHER OVERALL STATUS
 * ======================================================= */

function aggregateStatus(
  assignments:
    ReportAssignment[],

  stage:
    StageKey,
): MarkStatus {
  const statuses =
    assignments.map(
      assignment =>
        assignment.stages[
          stage
        ] ??
        'not_started',
    );

  if (
    statuses.length === 0
  ) {
    return 'not_started';
  }

  /*
   * Everything gray.
   */
  if (
    statuses.every(
      status =>
        status ===
        'not_started',
    )
  ) {
    return 'not_started';
  }

  /*
   * Everything complete.
   */
  if (
    statuses.every(
      status =>
        status ===
        'complete',
    )
  ) {
    return 'complete';
  }

  /*
   * At least something started,
   * but not everything is complete.
   */
  return 'incomplete';
}

/* =========================================================
 * GROUP ASSIGNMENTS BY TEACHER
 * ======================================================= */

function groupTeachers(
  assignments:
    ReportAssignment[],

  category:
    Category,
) {
  const map =
    new Map<
      string,
      TeacherGroup
    >();

  for (
    const assignment of
    assignments
  ) {
    if (
      assignment.category !==
      category
    ) {
      continue;
    }

    const existing =
      map.get(
        assignment.teacherUserId,
      );

    if (
      existing
    ) {
      existing.assignments.push(
        assignment,
      );

      continue;
    }

    map.set(
      assignment.teacherUserId,
      {
        teacherUserId:
          assignment.teacherUserId,

        teacherName:
          assignment.teacherName,

        teacherId:
          assignment.teacherId,

        assignments: [
          assignment,
        ],
      },
    );
  }

  return Array.from(
    map.values(),
  ).sort(
    (
      first,
      second,
    ) =>
      first.teacherName.localeCompare(
        second.teacherName,
      ),
  );
}

/* =========================================================
 * SCREEN
 * ======================================================= */

export default function ReportsScreen() {
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

  const year =
    useMemo(
      () =>
        schoolYear(),
      [],
    );

  const [
    period,
    setPeriod,
  ] =
    useState<Period>(
      'first',
    );

  const [
    data,
    setData,
  ] =
    useState<ReportData>({
      assignments: [],
      started: {},
      ready: {},
      publications: {},
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    publishing,
    setPublishing,
  ] =
    useState<
      StageKey | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    mode,
    setMode,
  ] =
    useState<ScreenMode>(
      'overview',
    );

  const [
    selectedTeacherId,
    setSelectedTeacherId,
  ] =
    useState<
      string | null
    >(null);

  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState<
      Category | null
    >(null);

  const [
    selectedAssignmentKey,
    setSelectedAssignmentKey,
  ] =
    useState<
      string | null
    >(null);

  /* =====================================================
   * LOAD REPORT
   * =================================================== */

  const loadReport =
    useCallback(
      async (
        refresh = false,
      ) => {
        try {
          if (
            refresh
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

          const {
            data:
              report,

            error:
              reportError,
          } =
            await supabase.rpc(
              'get_admin_mark_report',
              {
                p_school_year:
                  year,

                p_semester:
                  periodSemester(
                    period,
                  ),
              },
            );

          if (
            reportError
          ) {
            throw reportError;
          }

          setData(
            safeReport(
              report,
            ),
          );
        } catch (
          loadError
        ) {
          console.log(
            'ADMIN MARK REPORT:',
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load mark report.',
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
      [
        period,
        year,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadReport();
      },
      [
        loadReport,
      ],
    ),
  );

  /* =====================================================
   * PERIOD
   * =================================================== */

  function changePeriod(
    next: Period,
  ) {
    setMode(
      'overview',
    );

    setSelectedTeacherId(
      null,
    );

    setSelectedCategory(
      null,
    );

    setSelectedAssignmentKey(
      null,
    );

    setError('');

    setPeriod(
      next,
    );
  }

  /* =====================================================
   * PUBLISH / UNPUBLISH
   * =================================================== */

  async function togglePublication(
    stage: StageKey,
  ) {
    try {
      const currentlyPublished =
        Boolean(
          data.publications[
            stage
          ],
        );

      const hasStarted =
        Boolean(
          data.started[
            stage
          ],
        );

      /*
       * =================================================
       * NEW RULE
       * =================================================
       *
       * GRAY:
       * not started
       * -> CANNOT publish.
       *
       * RED:
       * started but incomplete
       * -> CAN publish.
       *
       * GREEN:
       * everybody complete
       * -> CAN publish.
       *
       * Published:
       * -> can always unpublish.
       */

      if (
        !currentlyPublished &&
        !hasStarted
      ) {
        setError(
          stage === 'total'
            ? 'Total is still waiting. At least one teacher must completely finish Test, Mid, Assignment and Final Exam for every student in one mark sheet first.'
            : `${stageTitle(stage)} has not been started by any teacher yet.`,
        );

        return;
      }

      setPublishing(
        stage,
      );

      setError('');

      const {
        error:
          publishError,
      } =
        await supabase.rpc(
          'set_result_publication',
          {
            p_school_year:
              year,

            p_semester:
              periodSemester(
                period,
              ),

            p_stage:
              stageDbName(
                stage,
              ),

            p_publish:
              !currentlyPublished,
          },
        );

      if (
        publishError
      ) {
        throw publishError;
      }

      await loadReport();
    } catch (
      publishError
    ) {
      console.log(
        'PUBLISH RESULT:',
        publishError,
      );

      setError(
        publishError instanceof Error
          ? publishError.message
          : 'Could not update publication.',
      );
    } finally {
      setPublishing(
        null,
      );
    }
  }

  /* =====================================================
   * TEACHERS
   * =================================================== */

  const elementaryTeachers =
    useMemo(
      () =>
        groupTeachers(
          data.assignments,
          'elementary',
        ),
      [
        data.assignments,
      ],
    );

  const highSchoolTeachers =
    useMemo(
      () =>
        groupTeachers(
          data.assignments,
          'high_school',
        ),
      [
        data.assignments,
      ],
    );

  /* =====================================================
   * SELECTED TEACHER
   * =================================================== */

  const selectedTeacher =
    useMemo(
      () => {
        if (
          !selectedTeacherId
        ) {
          return null;
        }

        const assignment =
          data.assignments.find(
            item =>
              item.teacherUserId ===
                selectedTeacherId &&
              (
                !selectedCategory ||
                item.category ===
                  selectedCategory
              ),
          );

        if (
          !assignment
        ) {
          return null;
        }

        return {
          teacherUserId:
            assignment.teacherUserId,

          teacherName:
            assignment.teacherName,

          teacherId:
            assignment.teacherId,

          assignments:
            data.assignments.filter(
              item =>
                item.teacherUserId ===
                  selectedTeacherId &&
                (
                  !selectedCategory ||
                  item.category ===
                    selectedCategory
                ),
            ),
        } satisfies TeacherGroup;
      },
      [
        data.assignments,
        selectedCategory,
        selectedTeacherId,
      ],
    );

  /* =====================================================
   * SELECTED CLASS + SUBJECT
   * =================================================== */

  const selectedAssignment =
    useMemo(
      () => {
        if (
          !selectedAssignmentKey
        ) {
          return null;
        }

        return (
          data.assignments.find(
            item =>
              `${item.classId}:${item.subject.toLowerCase()}` ===
              selectedAssignmentKey,
          ) ??
          null
        );
      },
      [
        data.assignments,
        selectedAssignmentKey,
      ],
    );

  /* =====================================================
   * OPEN TEACHER
   * =================================================== */

  function openTeacher(
    teacher:
      TeacherGroup,

    category:
      Category,
  ) {
    setSelectedTeacherId(
      teacher.teacherUserId,
    );

    setSelectedCategory(
      category,
    );

    setSelectedAssignmentKey(
      null,
    );

    setMode(
      'teacher',
    );
  }

  /* =====================================================
   * OPEN CLASS/SUBJECT
   * =================================================== */

  function openAssignment(
    assignment:
      ReportAssignment,
  ) {
    setSelectedAssignmentKey(
      `${assignment.classId}:${assignment.subject.toLowerCase()}`,
    );

    setMode(
      'students',
    );
  }

  /* =====================================================
   * BACK
   * =================================================== */

  function goBack() {
    if (
      mode === 'students'
    ) {
      setMode(
        'teacher',
      );

      setSelectedAssignmentKey(
        null,
      );

      return;
    }

    setMode(
      'overview',
    );

    setSelectedTeacherId(
      null,
    );

    setSelectedCategory(
      null,
    );

    setSelectedAssignmentKey(
      null,
    );
  }

  /* =====================================================
   * LOADING
   * =================================================== */

  if (
    loading
  ) {
    return (
      <View
        style={
          styles.center
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
          Loading report...
        </Text>
      </View>
    );
  }

  /* =====================================================
   * UI
   * =================================================== */

  return (
    <ScrollView
      style={
        styles.screen
      }
      contentContainerStyle={
        styles.content
      }
      showsVerticalScrollIndicator={
        false
      }
      refreshControl={
        <RefreshControl
          refreshing={
            refreshing
          }
          onRefresh={() =>
            void loadReport(
              true,
            )
          }
          tintColor={
            colors.primary
          }
          colors={[
            colors.primary,
          ]}
        />
      }
    >
      {/* BACK */}

      {mode !==
      'overview' ? (
        <Pressable
          onPress={
            goBack
          }
          style={
            styles.backButton
          }
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
      ) : null}

      {/* TITLE */}

      <Text
        style={
          styles.title
        }
      >
        {mode ===
        'overview'
          ? 'Mark Reports'
          : mode ===
              'teacher'
            ? selectedTeacher
                ?.teacherName ??
              'Teacher'
            : selectedAssignment
                ?.className ??
              'Class'}
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        {mode ===
        'overview'
          ? year
          : mode ===
              'teacher'
            ? selectedTeacher
                ?.teacherId ??
              'Teacher'
            : selectedAssignment
              ? `${selectedAssignment.subject} • ${selectedAssignment.studentCount} students`
              : ''}
      </Text>

      {/* =================================================
       * PERIOD SELECTOR
       * =============================================== */}

      <View
        style={
          styles.periodTabs
        }
      >
        <PeriodButton
          title="Semester 1"
          active={
            period ===
            'first'
          }
          onPress={() =>
            changePeriod(
              'first',
            )
          }
          styles={
            styles
          }
        />

        <PeriodButton
          title="Semester 2"
          active={
            period ===
            'second'
          }
          onPress={() =>
            changePeriod(
              'second',
            )
          }
          styles={
            styles
          }
        />

        <PeriodButton
          title="Final"
          active={
            period ===
            'final'
          }
          onPress={() =>
            changePeriod(
              'final',
            )
          }
          styles={
            styles
          }
        />
      </View>

      {/* ERROR */}

      {error ? (
        <View
          style={
            styles.errorCard
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={21}
            color={
              RED
            }
          />

          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        </View>
      ) : null}

      {/* =================================================
       * RELEASE RESULTS
       * =============================================== */}

      {mode ===
      'overview' ? (
        <View
          style={
            styles.publishCard
          }
        >
          <View
            style={
              styles.publishHeader
            }
          >
            <View
              style={
                styles.publishIcon
              }
            >
              <Ionicons
                name="cloud-upload-outline"
                size={23}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.publishHeaderText
              }
            >
              <Text
                style={
                  styles.publishTitle
                }
              >
                Release results
              </Text>

              <Text
                style={
                  styles.publishPeriod
                }
              >
                {
                  periodTitle(
                    period,
                  )
                }
              </Text>
            </View>
          </View>

          <View
            style={
              styles.publishButtons
            }
          >
            {stagesForPeriod(
              period,
            ).map(
              stage => (
                <PublishButton
                  key={
                    stage
                  }

                  title={
                    stageTitle(
                      stage,
                    )
                  }

                  started={
                    Boolean(
                      data.started[
                        stage
                      ],
                    )
                  }

                  ready={
                    Boolean(
                      data.ready[
                        stage
                      ],
                    )
                  }

                  published={
                    Boolean(
                      data.publications[
                        stage
                      ],
                    )
                  }

                  loading={
                    publishing ===
                    stage
                  }

                  onPress={() =>
                    void togglePublication(
                      stage,
                    )
                  }

                  styles={
                    styles
                  }

                  colors={
                    colors
                  }
                />
              ),
            )}
          </View>
        </View>
      ) : null}

      {/* =================================================
       * OVERVIEW
       * =============================================== */}

      {mode ===
      'overview' ? (
        <>
          <CategorySection
            title="Elementary"
            category="elementary"
            teachers={
              elementaryTeachers
            }
            period={
              period
            }
            onTeacherPress={
              openTeacher
            }
            styles={
              styles
            }
            colors={
              colors
            }
          />

          <CategorySection
            title="High School"
            category="high_school"
            teachers={
              highSchoolTeachers
            }
            period={
              period
            }
            onTeacherPress={
              openTeacher
            }
            styles={
              styles
            }
            colors={
              colors
            }
          />
        </>
      ) : null}

      {/* =================================================
       * TEACHER DETAILS
       * =============================================== */}

      {mode ===
        'teacher' &&
      selectedTeacher ? (
        <>
          <View
            style={
              styles.detailSummary
            }
          >
            <View
              style={
                styles.teacherAvatar
              }
            >
              <Text
                style={
                  styles.teacherAvatarText
                }
              >
                {selectedTeacher
                  .teacherName
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={
                styles.detailSummaryText
              }
            >
              <Text
                style={
                  styles.detailSummaryTitle
                }
              >
                {
                  selectedTeacher
                    .assignments
                    .length
                }{' '}
                mark sheets
              </Text>

              <Text
                style={
                  styles.detailSummarySub
                }
              >
                Tap a class to check missing marks.
              </Text>
            </View>
          </View>

          <StageHeader
            period={
              period
            }
            firstLabel="Class"
            styles={
              styles
            }
          />

          <View
            style={
              styles.listCard
            }
          >
            {selectedTeacher.assignments.map(
              assignment => (
                <Pressable
                  key={`${assignment.classId}:${assignment.subject}`}
                  onPress={() =>
                    openAssignment(
                      assignment,
                    )
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.classRow,

                    pressed &&
                      styles.rowPressed,
                  ]}
                >
                  <View
                    style={
                      styles.classMain
                    }
                  >
                    <Text
                      style={
                        styles.className
                      }
                      numberOfLines={1}
                    >
                      {
                        assignment.className
                      }
                    </Text>

                    <Text
                      style={
                        styles.classSubject
                      }
                      numberOfLines={1}
                    >
                      {
                        assignment.subject
                      }
                    </Text>
                  </View>

                  <View
                    style={
                      styles.statusColumns
                    }
                  >
                    {stagesForPeriod(
                      period,
                    ).map(
                      stage => (
                        <View
                          key={
                            stage
                          }
                          style={
                            styles.statusColumn
                          }
                        >
                          <StatusCircle
                            status={
                              assignment
                                .stages[
                                stage
                              ] ??
                              'not_started'
                            }
                            size={28}
                          />
                        </View>
                      ),
                    )}
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={
                      colors.textMuted
                    }
                  />
                </Pressable>
              ),
            )}
          </View>
        </>
      ) : null}

      {/* =================================================
       * STUDENT DETAILS
       * =============================================== */}

      {mode ===
        'students' &&
      selectedAssignment ? (
        <>
          <View
            style={
              styles.detailSummary
            }
          >
            <View
              style={
                styles.classIcon
              }
            >
              <Ionicons
                name="school-outline"
                size={23}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.detailSummaryText
              }
            >
              <Text
                style={
                  styles.detailSummaryTitle
                }
              >
                {
                  selectedAssignment.subject
                }
              </Text>

              <Text
                style={
                  styles.detailSummarySub
                }
              >
                {
                  selectedAssignment.teacherName
                }
              </Text>
            </View>
          </View>

          <StageHeader
            period={
              period
            }
            firstLabel="Student"
            styles={
              styles
            }
          />

          <View
            style={
              styles.listCard
            }
          >
            {selectedAssignment
              .students
              .length ===
            0 ? (
              <View
                style={
                  styles.emptyBox
                }
              >
                <Text
                  style={
                    styles.emptyText
                  }
                >
                  No students in this class.
                </Text>
              </View>
            ) : (
              selectedAssignment.students.map(
                student => (
                  <View
                    key={
                      student.userId
                    }
                    style={
                      styles.studentRow
                    }
                  >
                    <View
                      style={
                        styles.studentMain
                      }
                    >
                      <Text
                        style={
                          styles.studentName
                        }
                        numberOfLines={1}
                      >
                        {
                          student.fullName
                        }
                      </Text>

                      <Text
                        style={
                          styles.studentId
                        }
                        numberOfLines={1}
                      >
                        {student.studentId ??
                          'Student'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.statusColumns
                      }
                    >
                      {stagesForPeriod(
                        period,
                      ).map(
                        stage => (
                          <View
                            key={
                              stage
                            }
                            style={
                              styles.statusColumn
                            }
                          >
                            <StatusCircle
                              status={
                                student
                                  .stages[
                                  stage
                                ] ??
                                'not_started'
                              }
                              size={28}
                            />
                          </View>
                        ),
                      )}
                    </View>
                  </View>
                ),
              )
            )}
          </View>
        </>
      ) : null}

      {/* =================================================
       * LEGEND
       * =============================================== */}

      <View
        style={
          styles.legendCard
        }
      >
        <Legend
          status="complete"
          title="Complete"
          styles={
            styles
          }
        />

        <Legend
          status="incomplete"
          title="Missing"
          styles={
            styles
          }
        />

        <Legend
          status="not_started"
          title="Not started"
          styles={
            styles
          }
        />
      </View>
    </ScrollView>
  );
}

/* =========================================================
 * CATEGORY SECTION
 * ======================================================= */

function CategorySection({
  title,
  category,
  teachers,
  period,
  onTeacherPress,
  styles,
  colors,
}: {
  title: string;

  category:
    Category;

  teachers:
    TeacherGroup[];

  period:
    Period;

  onTeacherPress:
    (
      teacher:
        TeacherGroup,

      category:
        Category,
    ) => void;

  styles:
    ReturnType<
      typeof createStyles
    >;

  colors:
    AppThemeColors;
}) {
  return (
    <View
      style={
        styles.section
      }
    >
      <View
        style={
          styles.sectionHeader
        }
      >
        <Text
          style={
            styles.sectionTitle
          }
        >
          {title}
        </Text>

        <View
          style={
            styles.teacherCount
          }
        >
          <Text
            style={
              styles.teacherCountText
            }
          >
            {
              teachers.length
            }
          </Text>
        </View>
      </View>

      <StageHeader
        period={
          period
        }
        firstLabel="Teacher"
        styles={
          styles
        }
      />

      <View
        style={
          styles.listCard
        }
      >
        {teachers.length ===
        0 ? (
          <View
            style={
              styles.emptyBox
            }
          >
            <Text
              style={
                styles.emptyText
              }
            >
              No teachers assigned.
            </Text>
          </View>
        ) : (
          teachers.map(
            teacher => (
              <Pressable
                key={
                  teacher.teacherUserId
                }
                onPress={() =>
                  onTeacherPress(
                    teacher,
                    category,
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.teacherRow,

                  pressed &&
                    styles.rowPressed,
                ]}
              >
                <View
                  style={
                    styles.teacherAvatarSmall
                  }
                >
                  <Text
                    style={
                      styles.teacherAvatarSmallText
                    }
                  >
                    {teacher
                      .teacherName
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>

                <View
                  style={
                    styles.teacherMain
                  }
                >
                  <Text
                    style={
                      styles.teacherName
                    }
                    numberOfLines={1}
                  >
                    {
                      teacher.teacherName
                    }
                  </Text>

                  <Text
                    style={
                      styles.teacherId
                    }
                    numberOfLines={1}
                  >
                    {teacher.teacherId ??
                      `${teacher.assignments.length} sheets`}
                  </Text>
                </View>

                <View
                  style={
                    styles.statusColumns
                  }
                >
                  {stagesForPeriod(
                    period,
                  ).map(
                    stage => (
                      <View
                        key={
                          stage
                        }
                        style={
                          styles.statusColumn
                        }
                      >
                        <StatusCircle
                          status={
                            aggregateStatus(
                              teacher.assignments,
                              stage,
                            )
                          }
                          size={28}
                        />
                      </View>
                    ),
                  )}
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={
                    colors.textMuted
                  }
                />
              </Pressable>
            ),
          )
        )}
      </View>
    </View>
  );
}

/* =========================================================
 * STAGE HEADER
 * ======================================================= */

function StageHeader({
  period,
  firstLabel,
  styles,
}: {
  period:
    Period;

  firstLabel:
    string;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.columnHeader
      }
    >
      <Text
        style={
          styles.columnFirst
        }
      >
        {firstLabel}
      </Text>

      <View
        style={
          styles.statusColumns
        }
      >
        {stagesForPeriod(
          period,
        ).map(
          stage => (
            <View
              key={
                stage
              }
              style={
                styles.statusColumn
              }
            >
              <Text
                style={
                  styles.columnStageText
                }
                numberOfLines={1}
              >
                {
                  stageTitle(
                    stage,
                  )
                }
              </Text>
            </View>
          ),
        )}
      </View>

      <View
        style={{
          width: 18,
        }}
      />
    </View>
  );
}

/* =========================================================
 * STATUS CIRCLE
 * ======================================================= */

function StatusCircle({
  status,
  size,
}: {
  status:
    MarkStatus;

  size:
    number;
}) {
  const complete =
    status ===
    'complete';

  const incomplete =
    status ===
    'incomplete';

  const backgroundColor =
    complete
      ? GREEN_SOFT
      : incomplete
        ? RED_SOFT
        : GRAY_SOFT;

  const color =
    complete
      ? GREEN
      : incomplete
        ? RED
        : GRAY;

  return (
    <View
      style={{
        width:
          size,

        height:
          size,

        borderRadius:
          size / 2,

        backgroundColor,

        alignItems:
          'center',

        justifyContent:
          'center',
      }}
    >
      <Ionicons
        name={
          complete
            ? 'checkmark'
            : incomplete
              ? 'close'
              : 'remove'
        }
        size={
          size * 0.55
        }
        color={
          color
        }
      />
    </View>
  );
}

/* =========================================================
 * PERIOD BUTTON
 * ======================================================= */

function PeriodButton({
  title,
  active,
  onPress,
  styles,
}: {
  title:
    string;

  active:
    boolean;

  onPress:
    () => void;

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
      style={[
        styles.periodButton,

        active &&
          styles.periodButtonActive,
      ]}
    >
      <Text
        style={[
          styles.periodButtonText,

          active &&
            styles.periodButtonTextActive,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* =========================================================
 * PUBLISH BUTTON
 * ======================================================= */

function PublishButton({
  title,
  started,
  ready,
  published,
  loading,
  onPress,
  styles,
  colors,
}: {
  title:
    string;

  started:
    boolean;

  ready:
    boolean;

  published:
    boolean;

  loading:
    boolean;

  onPress:
    () => void;

  styles:
    ReturnType<
      typeof createStyles
    >;

  colors:
    AppThemeColors;
}) {
  /*
   * ---------------------------------------------
   * STATE RULE
   *
   * NOT STARTED
   * gray + disabled
   *
   * STARTED BUT MISSING
   * red + enabled
   *
   * EVERYTHING COMPLETE
   * green + enabled
   *
   * ALREADY PUBLISHED
   * green + enabled so President can unpublish
   * ---------------------------------------------
   */

  const disabled =
    loading ||
    (
      !published &&
      !started
    );

  const missing =
    started &&
    !ready;

  let iconName:
    React.ComponentProps<
      typeof Ionicons
    >['name'] =
    'time-outline';

  let iconColor =
    colors.textMuted;

  let stateText =
    'Waiting for teachers';

  if (
    missing
  ) {
    iconName =
      'alert-circle-outline';

    iconColor =
      RED;

    stateText =
      'Some marks are missing';
  }

  if (
    ready
  ) {
    iconName =
      'checkmark-circle-outline';

    iconColor =
      GREEN;

    stateText =
      'All marks complete';
  }

  if (
    published
  ) {
    iconName =
      'eye-outline';

    iconColor =
      GREEN;

    stateText =
      ready
        ? 'Published • Complete'
        : 'Published • Some marks missing';
  }

  return (
    <Pressable
      disabled={
        disabled
      }
      onPress={
        onPress
      }
      style={({
        pressed,
      }) => [
        styles.publishButton,

        missing &&
          !published &&
          styles.publishButtonWarning,

        ready &&
          !published &&
          styles.publishButtonReady,

        published &&
          styles.publishButtonPublished,

        disabled &&
          styles.publishButtonDisabled,

        pressed &&
          !disabled && {
            opacity: 0.78,
          },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            published ||
            ready
              ? GREEN
              : colors.primary
          }
        />
      ) : (
        <View
          style={[
            styles.publishStateIcon,

            missing &&
              !published &&
              styles.publishStateIconWarning,

            ready &&
              !published &&
              styles.publishStateIconReady,

            published &&
              styles.publishStateIconReady,
          ]}
        >
          <Ionicons
            name={
              iconName
            }
            size={19}
            color={
              iconColor
            }
          />
        </View>
      )}

      <View
        style={
          styles.publishButtonTextArea
        }
      >
        <Text
          style={[
            styles.publishButtonTitle,

            missing &&
              !published &&
              styles.publishButtonTitleWarning,

            (
              ready ||
              published
            ) &&
              styles.publishButtonTitlePublished,
          ]}
          numberOfLines={1}
        >
          {published
            ? `Unpublish ${title}`
            : `Publish ${title}`}
        </Text>

        <Text
          style={[
            styles.publishButtonState,

            missing &&
              !published &&
              styles.publishButtonStateWarning,

            (
              ready ||
              published
            ) &&
              styles.publishButtonStateReady,
          ]}
        >
          {stateText}
        </Text>
      </View>

      {!disabled &&
      !loading ? (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={
            published ||
            ready
              ? GREEN
              : RED
          }
        />
      ) : null}
    </Pressable>
  );
}

/* =========================================================
 * LEGEND
 * ======================================================= */

function Legend({
  status,
  title,
  styles,
}: {
  status:
    MarkStatus;

  title:
    string;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.legendItem
      }
    >
      <StatusCircle
        status={
          status
        }
        size={22}
      />

      <Text
        style={
          styles.legendText
        }
      >
        {title}
      </Text>
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
    /* SCREEN */

    screen: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 12,

      paddingTop: 18,

      paddingBottom: 130,
    },

    center: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.background,
    },

    loadingText: {
      marginTop: 12,

      fontSize: 14,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    /* BACK */

    backButton: {
      alignSelf:
        'flex-start',

      minHeight: 42,

      paddingHorizontal: 11,

      marginBottom: 10,

      flexDirection:
        'row',

      gap: 7,

      alignItems:
        'center',

      borderRadius: 12,

      backgroundColor:
        colors.surfaceSecondary,
    },

    backText: {
      fontSize: 13,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    /* TITLE */

    title: {
      fontSize: 24,

      lineHeight: 30,

      fontWeight:
        '800',

      letterSpacing:
        -0.5,

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 4,

      fontSize: 13,

      lineHeight: 18,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    /* PERIOD */

    periodTabs: {
      height: 52,

      marginTop: 18,

      padding: 4,

      flexDirection:
        'row',

      borderRadius: 16,

      backgroundColor:
        colors.surfaceSecondary,
    },

    periodButton: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,
    },

    periodButtonActive: {
      backgroundColor:
        colors.primary,
    },

    periodButtonText: {
      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    periodButtonTextActive: {
      color: '#FFFFFF',

      fontWeight:
        '800',
    },

    /* ERROR */

    errorCard: {
      marginTop: 12,

      padding: 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 9,

      borderRadius: 15,

      backgroundColor:
        RED_SOFT,
    },

    errorText: {
      flex: 1,

      fontSize: 12,

      lineHeight: 17,

      fontWeight:
        '700',

      color:
        RED,
    },

    /* =====================================================
     * PUBLISH CARD
     * =================================================== */

    publishCard: {
      marginTop: 14,

      padding: 14,

      borderRadius: 19,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    publishHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    publishIcon: {
      width: 46,

      height: 46,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 14,

      backgroundColor:
        colors.primarySoft,
    },

    publishHeaderText: {
      flex: 1,

      marginLeft: 11,
    },

    publishTitle: {
      fontSize: 15,

      lineHeight: 20,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    publishPeriod: {
      marginTop: 3,

      fontSize: 11,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    publishButtons: {
      marginTop: 13,

      gap: 8,
    },

    publishButton: {
      minHeight: 64,

      paddingHorizontal: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 10,

      borderRadius: 15,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    /*
     * RED:
     * Started but missing.
     * Still clickable.
     */

    publishButtonWarning: {
      borderColor:
        RED_BORDER,

      backgroundColor:
        RED_SOFT,
    },

    /*
     * GREEN:
     * All marks complete.
     */

    publishButtonReady: {
      borderColor:
        GREEN_BORDER,

      backgroundColor:
        GREEN_SOFT,
    },

    /*
     * PUBLISHED.
     */

    publishButtonPublished: {
      borderColor:
        GREEN_BORDER,

      backgroundColor:
        GREEN_SOFT,
    },

    /*
     * GRAY:
     * Nobody has started.
     */

    publishButtonDisabled: {
      opacity: 0.58,
    },

    publishStateIcon: {
      width: 36,

      height: 36,

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        GRAY_SOFT,
    },

    publishStateIconWarning: {
      backgroundColor:
        '#FFDDE2',
    },

    publishStateIconReady: {
      backgroundColor:
        '#D6F3E4',
    },

    publishButtonTextArea: {
      flex: 1,

      minWidth: 0,
    },

    publishButtonTitle: {
      fontSize: 13,

      lineHeight: 18,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    publishButtonTitleWarning: {
      color:
        '#B83748',
    },

    publishButtonTitlePublished: {
      color:
        '#187D50',
    },

    publishButtonState: {
      marginTop: 3,

      fontSize: 10.5,

      lineHeight: 14,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    publishButtonStateWarning: {
      color:
        RED,
    },

    publishButtonStateReady: {
      color:
        GREEN,
    },

    /* =====================================================
     * SECTION
     * =================================================== */

    section: {
      marginTop: 23,
    },

    sectionHeader: {
      marginBottom: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize: 17,

      lineHeight: 22,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    teacherCount: {
      minWidth: 31,

      height: 31,

      paddingHorizontal: 9,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    teacherCountText: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    /* =====================================================
     * TABLE HEADER
     * =================================================== */

    columnHeader: {
      minHeight: 40,

      paddingHorizontal: 8,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    columnFirst: {
      flex: 1,

      fontSize: 10.5,

      fontWeight:
        '800',

      color:
        colors.textSecondary,
    },

    statusColumns: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    /*
     * Four columns must fit
     * on smaller phones.
     */

    statusColumn: {
      width: 38,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    columnStageText: {
      fontSize: 9,

      lineHeight: 12,

      fontWeight:
        '800',

      color:
        colors.textSecondary,

      textAlign:
        'center',
    },

    /* =====================================================
     * LIST
     * =================================================== */

    listCard: {
      overflow:
        'hidden',

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    teacherRow: {
      minHeight: 72,

      paddingHorizontal: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    classRow: {
      minHeight: 72,

      paddingHorizontal: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    studentRow: {
      minHeight: 68,

      paddingHorizontal: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    rowPressed: {
      backgroundColor:
        colors.surfaceSecondary,
    },

    /* =====================================================
     * TEACHER
     * =================================================== */

    teacherAvatarSmall: {
      width: 40,

      height: 40,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 20,

      backgroundColor:
        colors.primarySoft,
    },

    teacherAvatarSmallText: {
      fontSize: 14,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    teacherMain: {
      flex: 1,

      minWidth: 0,

      marginLeft: 9,

      paddingRight: 3,
    },

    teacherName: {
      fontSize: 13,

      lineHeight: 17,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    teacherId: {
      marginTop: 3,

      fontSize: 10,

      lineHeight: 14,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    /* =====================================================
     * CLASS
     * =================================================== */

    classMain: {
      flex: 1,

      minWidth: 0,

      paddingRight: 4,
    },

    className: {
      fontSize: 13,

      lineHeight: 17,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    classSubject: {
      marginTop: 3,

      fontSize: 10,

      lineHeight: 14,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    /* =====================================================
     * STUDENT
     * =================================================== */

    studentMain: {
      flex: 1,

      minWidth: 0,

      paddingRight: 4,
    },

    studentName: {
      fontSize: 13,

      lineHeight: 17,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    studentId: {
      marginTop: 3,

      fontSize: 10,

      lineHeight: 14,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    /* =====================================================
     * DETAIL
     * =================================================== */

    detailSummary: {
      minHeight: 78,

      marginTop: 15,

      paddingHorizontal: 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    teacherAvatar: {
      width: 48,

      height: 48,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 24,

      backgroundColor:
        colors.primarySoft,
    },

    teacherAvatarText: {
      fontSize: 17,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    classIcon: {
      width: 48,

      height: 48,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 15,

      backgroundColor:
        colors.primarySoft,
    },

    detailSummaryText: {
      flex: 1,

      marginLeft: 11,
    },

    detailSummaryTitle: {
      fontSize: 14,

      lineHeight: 19,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    detailSummarySub: {
      marginTop: 3,

      fontSize: 11,

      lineHeight: 15,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    /* =====================================================
     * EMPTY
     * =================================================== */

    emptyBox: {
      minHeight: 95,

      paddingHorizontal: 15,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyText: {
      fontSize: 12,

      lineHeight: 17,

      fontWeight:
        '600',

      textAlign:
        'center',

      color:
        colors.textSecondary,
    },

    /* =====================================================
     * LEGEND
     * =================================================== */

    legendCard: {
      minHeight: 62,

      marginTop: 18,

      paddingHorizontal: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-around',

      borderRadius: 16,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    legendItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 6,
    },

    legendText: {
      fontSize: 10.5,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },
  });
}