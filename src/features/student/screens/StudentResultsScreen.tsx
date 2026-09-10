import React, {
  ComponentProps,
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

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
} from 'expo-router';

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

type SemesterMode =
  | 'first'
  | 'second'
  | 'final';

type AssessmentMode =
  | 'test'
  | 'mid'
  | 'finalExam';

type IoniconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type ResultRpcRow = {
  class_id: string;
  class_name: string;
  subject: string;

  first_test:
    number | string | null;

  first_mid:
    number | string | null;

  first_assignment:
    number | string | null;

  first_final_exam:
    number | string | null;

  first_total:
    number | string | null;

  second_test:
    number | string | null;

  second_mid:
    number | string | null;

  second_assignment:
    number | string | null;

  second_final_exam:
    number | string | null;

  second_total:
    number | string | null;

  final_total:
    number | string | null;
};

type SemesterScores = {
  test: number | null;
  mid: number | null;
  assignment: number | null;
  finalExam: number | null;
  total: number | null;
};

type ResultRow = {
  classId: string;
  className: string;
  subject: string;

  first:
    SemesterScores;

  second:
    SemesterScores;

  finalTotal:
    number | null;
};

/*
 * =========================================================
 * HELPERS
 * =========================================================
 */

function currentSchoolYear() {
  const now =
    new Date();

  const startYear =
    now.getMonth() >= 8
      ? now.getFullYear()
      : now.getFullYear() - 1;

  return `${startYear}-${startYear + 1}`;
}

function numberOrNull(
  value:
    number |
    string |
    null |
    undefined,
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

function displayNumber(
  value:
    number | null,
) {
  if (
    value === null
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
      1,
    )
    .replace(
      /\.0$/,
      '',
    );
}

/*
 * This is only the displayed grade.
 * It does NOT change the saved mark.
 */

function gradeForPercentage(
  percentage:
    number | null,
) {
  if (
    percentage === null
  ) {
    return '—';
  }

  if (
    percentage >= 90
  ) {
    return 'A+';
  }

  if (
    percentage >= 80
  ) {
    return 'A';
  }

  if (
    percentage >= 70
  ) {
    return 'B';
  }

  if (
    percentage >= 60
  ) {
    return 'C';
  }

  if (
    percentage >= 50
  ) {
    return 'D';
  }

  return 'F';
}

function scorePercentage(
  score:
    number | null,

  max:
    number,
) {
  if (
    score === null ||
    max <= 0
  ) {
    return null;
  }

  return (
    score /
    max
  ) * 100;
}

function subjectIcon(
  subject:
    string,
): IoniconName {
  const value =
    subject
      .trim()
      .toLowerCase();

  if (
    value.includes(
      'math',
    )
  ) {
    return 'calculator-outline';
  }

  if (
    value.includes(
      'english',
    )
  ) {
    return 'book-outline';
  }

  if (
    value.includes(
      'amharic',
    )
  ) {
    return 'language-outline';
  }

  if (
    value.includes(
      'chem',
    )
  ) {
    return 'flask-outline';
  }

  if (
    value.includes(
      'physics',
    )
  ) {
    return 'planet-outline';
  }

  if (
    value.includes(
      'biology',
    )
  ) {
    return 'leaf-outline';
  }

  if (
    value.includes(
      'science',
    )
  ) {
    return 'beaker-outline';
  }

  if (
    value.includes(
      'computer',
    ) ||
    value.includes(
      'ict',
    )
  ) {
    return 'laptop-outline';
  }

  if (
    value.includes(
      'history',
    )
  ) {
    return 'time-outline';
  }

  if (
    value.includes(
      'geograph',
    )
  ) {
    return 'earth-outline';
  }

  if (
    value.includes(
      'econom',
    )
  ) {
    return 'trending-up-outline';
  }

  if (
    value.includes(
      'business',
    )
  ) {
    return 'briefcase-outline';
  }

  if (
    value.includes(
      'civic',
    )
  ) {
    return 'people-outline';
  }

  if (
    value.includes(
      'art',
    )
  ) {
    return 'brush-outline';
  }

  return 'school-outline';
}

function semesterLabel(
  semester:
    SemesterMode,
) {
  if (
    semester ===
    'first'
  ) {
    return 'Semester 1';
  }

  if (
    semester ===
    'second'
  ) {
    return 'Semester 2';
  }

  return 'Final Result';
}

function assessmentLabel(
  assessment:
    AssessmentMode,
) {
  if (
    assessment ===
    'test'
  ) {
    return 'Test';
  }

  if (
    assessment ===
    'mid'
  ) {
    return 'Mid';
  }

  return 'Final Exam';
}

function assessmentMax(
  assessment:
    AssessmentMode,
) {
  if (
    assessment ===
    'test'
  ) {
    return 10;
  }

  if (
    assessment ===
    'mid'
  ) {
    return 30;
  }

  return 40;
}

/*
 * =========================================================
 * SCREEN
 * =========================================================
 */

export default function StudentResultsScreen() {
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

  const schoolYear =
    useMemo(
      () =>
        currentSchoolYear(),
      [],
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
    assessment,
    setAssessment,
  ] =
    useState<
      AssessmentMode
    >(
      'test',
    );

  const [
    results,
    setResults,
  ] =
    useState<
      ResultRow[]
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
    useState<
      string | null
    >(
      null,
    );

  /*
   * =====================================================
   * LOAD RESULTS
   * =====================================================
   */

  const loadResults =
    useCallback(
      async (
        refresh =
          false,
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

          setError(
            null,
          );

          const {
            data,
            error:
              resultError,
          } =
            await supabase.rpc(
              'get_my_results',
              {
                p_school_year:
                  schoolYear,
              },
            );

          if (
            resultError
          ) {
            throw resultError;
          }

          const rows =
            (
              data ??
              []
            ) as
              ResultRpcRow[];

          const mapped =
            rows.map(
              (
                row,
              ): ResultRow => ({
                classId:
                  String(
                    row.class_id,
                  ),

                className:
                  String(
                    row.class_name ??
                      '',
                  ),

                subject:
                  String(
                    row.subject ??
                      '',
                  ),

                first: {
                  test:
                    numberOrNull(
                      row.first_test,
                    ),

                  mid:
                    numberOrNull(
                      row.first_mid,
                    ),

                  assignment:
                    numberOrNull(
                      row.first_assignment,
                    ),

                  finalExam:
                    numberOrNull(
                      row.first_final_exam,
                    ),

                  total:
                    numberOrNull(
                      row.first_total,
                    ),
                },

                second: {
                  test:
                    numberOrNull(
                      row.second_test,
                    ),

                  mid:
                    numberOrNull(
                      row.second_mid,
                    ),

                  assignment:
                    numberOrNull(
                      row.second_assignment,
                    ),

                  finalExam:
                    numberOrNull(
                      row.second_final_exam,
                    ),

                  total:
                    numberOrNull(
                      row.second_total,
                    ),
                },

                finalTotal:
                  numberOrNull(
                    row.final_total,
                  ),
              }),
            );

          setResults(
            mapped,
          );
        } catch (
          loadError
        ) {
          console.log(
            'STUDENT RESULTS:',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Could not load results.',
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
        schoolYear,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadResults();
      },
      [
        loadResults,
      ],
    ),
  );

  /*
   * =====================================================
   * CURRENT SCORE
   * =====================================================
   */

  function getSemesterScores(
    row:
      ResultRow,
  ) {
    return semester ===
      'first'
      ? row.first
      : row.second;
  }

  function scoreForResult(
    row:
      ResultRow,
  ) {
    /*
     * Final result mode.
     */

    if (
      semester ===
      'final'
    ) {
      return {
        score:
          row.finalTotal,

        max:
          100,
      };
    }

    const scores =
      getSemesterScores(
        row,
      );

    if (
      assessment ===
      'test'
    ) {
      return {
        score:
          scores.test,

        max:
          10,
      };
    }

    if (
      assessment ===
      'mid'
    ) {
      return {
        score:
          scores.mid,

        max:
          30,
      };
    }

    return {
      score:
        scores.finalExam,

      max:
        40,
    };
  }

  /*
   * =====================================================
   * OVERALL AVERAGE
   * =====================================================
   */

  const overall =
    useMemo(
      () => {
        const percentages:
          number[] =
          [];

        for (
          const result of
          results
        ) {
          const {
            score,
            max,
          } =
            scoreForResult(
              result,
            );

          const percentage =
            scorePercentage(
              score,
              max,
            );

          if (
            percentage !==
            null
          ) {
            percentages.push(
              percentage,
            );
          }
        }

        if (
          percentages.length ===
          0
        ) {
          return null;
        }

        return (
          percentages.reduce(
            (
              total,
              value,
            ) =>
              total +
              value,
            0,
          ) /
          percentages.length
        );
      },
      [
        results,
        semester,
        assessment,
      ],
    );

  const className =
    results[
      0
    ]?.className ??
    '';

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
        style={
          styles.center
        }
      >
        <ActivityIndicator
          size="small"
          color={
            colors.primary
          }
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading results...
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
            void loadResults(
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
      {/* HEADER */}

      <Text
        style={
          styles.title
        }
      >
        Results
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        {className
          ? `${className} • `
          : ''}
        {schoolYear}
      </Text>

      {/* ERROR */}

      {error ? (
        <View
          style={
            styles.errorCard
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={
              20
            }
            color="#E5484D"
          />

          <Text
            style={
              styles.errorText
            }
          >
            {
              error
            }
          </Text>
        </View>
      ) : null}

      {/* ================================================= */}
      {/* SEMESTER SELECTOR */}
      {/* ================================================= */}

      <View
        style={
          styles.semesterTabs
        }
      >
        <SemesterButton
          title="Semester 1"
          active={
            semester ===
            'first'
          }
          onPress={() =>
            setSemester(
              'first',
            )
          }
          styles={
            styles
          }
        />

        <SemesterButton
          title="Semester 2"
          active={
            semester ===
            'second'
          }
          onPress={() =>
            setSemester(
              'second',
            )
          }
          styles={
            styles
          }
        />

        <SemesterButton
          title="Final"
          active={
            semester ===
            'final'
          }
          onPress={() =>
            setSemester(
              'final',
            )
          }
          styles={
            styles
          }
        />
      </View>

      {/* ================================================= */}
      {/* ASSESSMENT SELECTOR */}
      {/* ================================================= */}

      {semester !==
      'final' ? (
        <>
          <View
            style={
              styles.sectionRow
            }
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Assessment
            </Text>

            <Text
              style={
                styles.sectionHint
              }
            >
              {
                semesterLabel(
                  semester,
                )
              }
            </Text>
          </View>

          <View
            style={
              styles.assessmentTabs
            }
          >
            <AssessmentButton
              title="Test"
              icon="document-text-outline"
              active={
                assessment ===
                'test'
              }
              onPress={() =>
                setAssessment(
                  'test',
                )
              }
              styles={
                styles
              }
            />

            <AssessmentButton
              title="Mid"
              icon="reader-outline"
              active={
                assessment ===
                'mid'
              }
              onPress={() =>
                setAssessment(
                  'mid',
                )
              }
              styles={
                styles
              }
            />

            <AssessmentButton
              title="Final Exam"
              icon="ribbon-outline"
              active={
                assessment ===
                'finalExam'
              }
              onPress={() =>
                setAssessment(
                  'finalExam',
                )
              }
              styles={
                styles
              }
            />
          </View>
        </>
      ) : (
        <View
          style={
            styles.finalInfo
          }
        >
          <View
            style={
              styles.finalInfoIcon
            }
          >
            <Ionicons
              name="ribbon-outline"
              size={
                20
              }
              color={
                colors.primary
              }
            />
          </View>

          <View
            style={
              styles.finalInfoText
            }
          >
            <Text
              style={
                styles.finalInfoTitle
              }
            >
              Final Result
            </Text>

            <Text
              style={
                styles.finalInfoSubtitle
              }
            >
              Average of Semester 1 and Semester 2
            </Text>
          </View>
        </View>
      )}

      {/* ================================================= */}
      {/* SUBJECTS HEADER */}
      {/* ================================================= */}

      <View
        style={
          styles.subjectHeader
        }
      >
        <View>
          <Text
            style={
              styles.subjectHeaderTitle
            }
          >
            {semester ===
            'final'
              ? 'Final Results'
              : assessmentLabel(
                  assessment,
                )}
          </Text>

          <Text
            style={
              styles.subjectHeaderSub
            }
          >
            {results.length}{' '}
            {results.length ===
            1
              ? 'subject'
              : 'subjects'}
          </Text>
        </View>

        {semester !==
        'final' ? (
          <View
            style={
              styles.maxBadge
            }
          >
            <Text
              style={
                styles.maxBadgeText
              }
            >
              /{
                assessmentMax(
                  assessment,
                )
              }
            </Text>
          </View>
        ) : null}
      </View>

      {/* ================================================= */}
      {/* RESULT LIST */}
      {/* ================================================= */}

      {results.length ===
      0 ? (
        <View
          style={
            styles.emptyCard
          }
        >
          <View
            style={
              styles.emptyIcon
            }
          >
            <Ionicons
              name="ribbon-outline"
              size={
                29
              }
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={
              styles.emptyTitle
            }
          >
            No subjects yet
          </Text>

          <Text
            style={
              styles.emptyText
            }
          >
            Subjects assigned to this class will appear here.
          </Text>
        </View>
      ) : (
        <View
          style={
            styles.resultList
          }
        >
          {results.map(
            (
              result,
            ) => {
              const {
                score,
                max,
              } =
                scoreForResult(
                  result,
                );

              const percentage =
                scorePercentage(
                  score,
                  max,
                );

              const grade =
                gradeForPercentage(
                  percentage,
                );

              const empty =
                score ===
                null;

              return (
                <View
                  key={
                    result.subject
                  }
                  style={
                    styles.resultCard
                  }
                >
                  {/* ICON */}

                  <View
                    style={
                      styles.subjectIcon
                    }
                  >
                    <Ionicons
                      name={
                        subjectIcon(
                          result.subject,
                        )
                      }
                      size={
                        22
                      }
                      color={
                        colors.primary
                      }
                    />
                  </View>

                  {/* SUBJECT */}

                  <View
                    style={
                      styles.subjectInfo
                    }
                  >
                    <Text
                      style={
                        styles.subjectName
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {
                        result.subject
                      }
                    </Text>

                    <Text
                      style={
                        styles.subjectStatus
                      }
                    >
                      {empty
                        ? 'Not graded yet'
                        : semester ===
                            'final'
                          ? 'Final average'
                          : `${semesterLabel(
                              semester,
                            )} • ${assessmentLabel(
                              assessment,
                            )}`}
                    </Text>
                  </View>

                  {/* SCORE */}

                  <View
                    style={
                      styles.scoreArea
                    }
                  >
                    <Text
                      style={[
                        styles.scoreText,

                        empty &&
                          styles.emptyScore,
                      ]}
                    >
                      {displayNumber(
                        score,
                      )}
                    </Text>

                    {!empty ? (
                      <Text
                        style={
                          styles.scoreMax
                        }
                      >
                        /{max}
                      </Text>
                    ) : null}
                  </View>

                  {/* GRADE */}

                  <View
                    style={[
                      styles.gradeBadge,

                      empty &&
                        styles.emptyGrade,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradeText,

                        empty &&
                          styles.emptyGradeText,
                      ]}
                    >
                      {
                        grade
                      }
                    </Text>
                  </View>
                </View>
              );
            },
          )}
        </View>
      )}

      {/* ================================================= */}
      {/* OVERALL */}
      {/* ================================================= */}

      <View
        style={
          styles.overallCard
        }
      >
        <View
          style={
            styles.overallIcon
          }
        >
          <Ionicons
            name="stats-chart-outline"
            size={
              23
            }
            color={
              colors.primary
            }
          />
        </View>

        <View
          style={
            styles.overallInfo
          }
        >
          <Text
            style={
              styles.overallLabel
            }
          >
            Overall Average
          </Text>

          <Text
            style={
              styles.overallSmall
            }
          >
            {semester ===
            'final'
              ? 'All final subject results'
              : `${semesterLabel(
                  semester,
                )} • ${assessmentLabel(
                  assessment,
                )}`}
          </Text>
        </View>

        <View
          style={
            styles.overallScore
          }
        >
          <Text
            style={
              styles.overallScoreText
            }
          >
            {overall ===
            null
              ? '—'
              : `${Math.round(
                  overall,
                )}%`}
          </Text>
        </View>

        <View
          style={
            styles.overallGrade
          }
        >
          <Text
            style={
              styles.overallGradeText
            }
          >
            {gradeForPercentage(
              overall,
            )}
          </Text>
        </View>
      </View>

      {/* ================================================= */}
      {/* SMALL INFO */}
      {/* ================================================= */}

      <View
        style={
          styles.infoCard
        }
      >
        <View
          style={
            styles.infoIcon
          }
        >
          <Ionicons
            name="information-circle-outline"
            size={
              21
            }
            color={
              colors.primary
            }
          />
        </View>

        <Text
          style={
            styles.infoText
          }
        >
          Results shown here are saved directly by your subject teachers.
        </Text>
      </View>
    </ScrollView>
  );
}

/*
 * =========================================================
 * SEMESTER BUTTON
 * =========================================================
 */

function SemesterButton({
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
        styles.semesterTab,

        active &&
          styles.semesterTabActive,
      ]}
    >
      <Text
        style={[
          styles.semesterTabText,

          active &&
            styles.semesterTabTextActive,
        ]}
        numberOfLines={
          1
        }
      >
        {
          title
        }
      </Text>
    </Pressable>
  );
}

/*
 * =========================================================
 * ASSESSMENT BUTTON
 * =========================================================
 */

function AssessmentButton({
  title,
  icon,
  active,
  onPress,
  styles,
}: {
  title:
    string;

  icon:
    IoniconName;

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
        styles.assessmentButton,

        active &&
          styles.assessmentButtonActive,
      ]}
    >
      <Ionicons
        name={
          icon
        }
        size={
          18
        }
        color={
          active
            ? '#FFFFFF'
            : styles
                .assessmentIconColor
                .color
        }
      />

      <Text
        style={[
          styles.assessmentText,

          active &&
            styles.assessmentTextActive,
        ]}
      >
        {
          title
        }
      </Text>
    </Pressable>
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

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        10,

      paddingTop:
        14,

      paddingBottom:
        130,
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
      marginTop:
        10,

      fontSize:
        12,

      color:
        colors.textMuted,
    },

    /*
     * ============================================
     * TITLE
     * ============================================
     */

    title: {
      fontSize:
        21,

      lineHeight:
        27,

      fontWeight:
        '800',

      letterSpacing:
        -0.45,

      color:
        colors.text,
    },

    subtitle: {
      marginTop:
        2,

      fontSize:
        10.5,

      color:
        colors.textMuted,
    },

    /*
     * ============================================
     * SEMESTER
     * ============================================
     */

    semesterTabs: {
      height:
        48,

      marginTop:
        17,

      padding:
        4,

      flexDirection:
        'row',

      borderRadius:
        16,

      backgroundColor:
        colors.surfaceSecondary,
    },

    semesterTab: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        4,

      borderRadius:
        13,
    },

    semesterTabActive: {
      backgroundColor:
        colors.primary,

      shadowColor:
        colors.primary,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity:
        0.18,

      shadowRadius:
        8,

      elevation:
        3,
    },

    semesterTabText: {
      fontSize:
        10.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    semesterTabTextActive: {
      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },

    /*
     * ============================================
     * SECTION
     * ============================================
     */

    sectionRow: {
      marginTop:
        18,

      marginBottom:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize:
        13,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    sectionHint: {
      fontSize:
        9.5,

      color:
        colors.textMuted,
    },

    /*
     * ============================================
     * ASSESSMENT PICKER
     * ============================================
     */

    assessmentTabs: {
      flexDirection:
        'row',

      gap:
        7,
    },

    assessmentButton: {
      flex: 1,

      minHeight:
        51,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        5,

      paddingHorizontal:
        6,

      borderRadius:
        15,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    assessmentButtonActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primary,
    },

    assessmentText: {
      fontSize:
        10.5,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    assessmentTextActive: {
      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },

    assessmentIconColor: {
      color:
        colors.primary,
    },

    /*
     * ============================================
     * FINAL RESULT INFO
     * ============================================
     */

    finalInfo: {
      minHeight:
        65,

      marginTop:
        17,

      paddingHorizontal:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    finalInfoIcon: {
      width:
        40,

      height:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        13,

      backgroundColor:
        colors.primarySoft,
    },

    finalInfoText: {
      flex: 1,

      marginLeft:
        10,
    },

    finalInfoTitle: {
      fontSize:
        12.5,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    finalInfoSubtitle: {
      marginTop:
        2,

      fontSize:
        9.5,

      color:
        colors.textMuted,
    },

    /*
     * ============================================
     * SUBJECT HEADER
     * ============================================
     */

    subjectHeader: {
      marginTop:
        21,

      marginBottom:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    subjectHeaderTitle: {
      fontSize:
        14,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    subjectHeaderSub: {
      marginTop:
        2,

      fontSize:
        9.5,

      color:
        colors.textMuted,
    },

    maxBadge: {
      minWidth:
        42,

      height:
        27,

      paddingHorizontal:
        9,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        10,

      backgroundColor:
        colors.primarySoft,
    },

    maxBadgeText: {
      fontSize:
        10,

      fontWeight:
        '700',

      color:
        colors.primary,
    },

    /*
     * ============================================
     * RESULT CARDS
     * ============================================
     */

    resultList: {
      gap:
        7,
    },

    resultCard: {
      minHeight:
        66,

      paddingHorizontal:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    subjectIcon: {
      width:
        40,

      height:
        40,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        13,

      backgroundColor:
        colors.primarySoft,
    },

    subjectInfo: {
      flex: 1,

      minWidth:
        0,

      marginLeft:
        10,
    },

    subjectName: {
      fontSize:
        12,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    subjectStatus: {
      marginTop:
        3,

      fontSize:
        8.8,

      color:
        colors.textMuted,
    },

    scoreArea: {
      minWidth:
        48,

      marginLeft:
        6,

      flexDirection:
        'row',

      alignItems:
        'baseline',

      justifyContent:
        'flex-end',
    },

    scoreText: {
      fontSize:
        16,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    emptyScore: {
      color:
        colors.textMuted,
    },

    scoreMax: {
      marginLeft:
        1,

      fontSize:
        8,

      color:
        colors.textMuted,
    },

    gradeBadge: {
      minWidth:
        38,

      height:
        38,

      marginLeft:
        7,

      paddingHorizontal:
        6,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      backgroundColor:
        '#E3F8EF',
    },

    gradeText: {
      fontSize:
        12,

      fontWeight:
        '800',

      color:
        '#158B68',
    },

    emptyGrade: {
      backgroundColor:
        colors.surfaceSecondary,
    },

    emptyGradeText: {
      color:
        colors.textMuted,
    },

    /*
     * ============================================
     * OVERALL
     * ============================================
     */

    overallCard: {
      minHeight:
        76,

      marginTop:
        14,

      paddingHorizontal:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        18,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    overallIcon: {
      width:
        42,

      height:
        42,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        13,

      backgroundColor:
        colors.primarySoft,
    },

    overallInfo: {
      flex: 1,

      marginLeft:
        10,
    },

    overallLabel: {
      fontSize:
        11.5,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    overallSmall: {
      marginTop:
        2,

      fontSize:
        8.8,

      color:
        colors.textMuted,
    },

    overallScore: {
      marginRight:
        8,
    },

    overallScoreText: {
      fontSize:
        16,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    overallGrade: {
      minWidth:
        40,

      height:
        40,

      paddingHorizontal:
        6,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        13,

      backgroundColor:
        '#E3F8EF',
    },

    overallGradeText: {
      fontSize:
        12.5,

      fontWeight:
        '800',

      color:
        '#158B68',
    },

    /*
     * ============================================
     * INFO
     * ============================================
     */

    infoCard: {
      minHeight:
        59,

      marginTop:
        11,

      paddingHorizontal:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    infoIcon: {
      width:
        36,

      height:
        36,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,
    },

    infoText: {
      flex: 1,

      marginLeft:
        9,

      fontSize:
        9.5,

      lineHeight:
        14,

      color:
        colors.textMuted,
    },

    /*
     * ============================================
     * EMPTY / ERROR
     * ============================================
     */

    emptyCard: {
      paddingVertical:
        36,

      paddingHorizontal:
        20,

      alignItems:
        'center',

      borderRadius:
        18,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    emptyIcon: {
      width:
        52,

      height:
        52,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        17,

      backgroundColor:
        colors.primarySoft,
    },

    emptyTitle: {
      marginTop:
        11,

      fontSize:
        13,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    emptyText: {
      marginTop:
        4,

      textAlign:
        'center',

      fontSize:
        10,

      lineHeight:
        15,

      color:
        colors.textMuted,
    },

    errorCard: {
      marginTop:
        12,

      padding:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        7,

      borderRadius:
        14,

      backgroundColor:
        '#FFF0F0',
    },

    errorText: {
      flex: 1,

      fontSize:
        10.5,

      color:
        '#C73C42',
    },
  });
}