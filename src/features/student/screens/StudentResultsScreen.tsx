import React, {
  ComponentProps,
  useCallback,
  useEffect,
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
  | 'finalExam'
  | 'total';

type IoniconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type ResultRpcRow = {
  class_id:
    string;

  class_name:
    string;

  subject:
    string;

  first_test:
    number | string | null;

  first_mid:
    number | string | null;

  first_final_exam:
    number | string | null;

  first_total:
    number | string | null;

  second_test:
    number | string | null;

  second_mid:
    number | string | null;

  second_final_exam:
    number | string | null;

  second_total:
    number | string | null;

  final_total:
    number | string | null;

  first_test_published:
    boolean;

  first_mid_published:
    boolean;

  first_final_exam_published:
    boolean;

  first_total_published:
    boolean;

  second_test_published:
    boolean;

  second_mid_published:
    boolean;

  second_final_exam_published:
    boolean;

  second_total_published:
    boolean;

  final_published:
    boolean;
};

type SemesterScores = {
  test:
    number | null;

  mid:
    number | null;

  finalExam:
    number | null;

  total:
    number | null;
};

type ResultRow = {
  classId:
    string;

  className:
    string;

  subject:
    string;

  first:
    SemesterScores;

  second:
    SemesterScores;

  finalTotal:
    number | null;
};

type PublicationState = {
  first: {
    test:
      boolean;

    mid:
      boolean;

    finalExam:
      boolean;

    total:
      boolean;
  };

  second: {
    test:
      boolean;

    mid:
      boolean;

    finalExam:
      boolean;

    total:
      boolean;
  };

  final:
    boolean;
};

type SubjectRank = {
  subject:
    string;

  rank:
    number;

  rankedStudents:
    number;
};

type RankData = {
  overallRank:
    number | null;

  rankedStudents:
    number;

  classSize:
    number;

  subjects:
    SubjectRank[];
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
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ''
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
    value ===
    null
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
    .toFixed(1)
    .replace(
      /\.0$/,
      '',
    );
}

function gradeForPercentage(
  percentage:
    number | null,
) {
  if (
    percentage ===
    null
  ) {
    return '—';
  }

  if (
    percentage >=
    90
  ) {
    return 'A+';
  }

  if (
    percentage >=
    80
  ) {
    return 'A';
  }

  if (
    percentage >=
    70
  ) {
    return 'B';
  }

  if (
    percentage >=
    60
  ) {
    return 'C';
  }

  if (
    percentage >=
    50
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
    score ===
      null ||
    max <=
      0
  ) {
    return null;
  }

  return (
    score /
    max
  ) *
    100;
}

function normalizeSubject(
  subject:
    string,
) {
  return subject
    .trim()
    .toLowerCase();
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

  if (
    assessment ===
    'finalExam'
  ) {
    return 'Final Exam';
  }

  return 'Total';
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

  if (
    assessment ===
    'finalExam'
  ) {
    return 40;
  }

  return 100;
}

const EMPTY_PUBLICATIONS:
  PublicationState = {
  first: {
    test:
      false,

    mid:
      false,

    finalExam:
      false,

    total:
      false,
  },

  second: {
    test:
      false,

    mid:
      false,

    finalExam:
      false,

    total:
      false,
  },

  final:
    false,
};

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
    publications,
    setPublications,
  ] =
    useState<
      PublicationState
    >(
      EMPTY_PUBLICATIONS,
    );

  const [
    rankData,
    setRankData,
  ] =
    useState<
      RankData | null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    rankLoading,
    setRankLoading,
  ] =
    useState(
      false,
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

          setError('');

          const {
            data,
            error:
              resultError,
          } =
            await supabase.rpc(
              'get_my_published_results',
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

          const mapped:
            ResultRow[] =
            rows.map(
              row => ({
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

          const first =
            rows[0];

          if (
            first
          ) {
            setPublications({
              first: {
                test:
                  Boolean(
                    first.first_test_published,
                  ),

                mid:
                  Boolean(
                    first.first_mid_published,
                  ),

                finalExam:
                  Boolean(
                    first.first_final_exam_published,
                  ),

                total:
                  Boolean(
                    first.first_total_published,
                  ),
              },

              second: {
                test:
                  Boolean(
                    first.second_test_published,
                  ),

                mid:
                  Boolean(
                    first.second_mid_published,
                  ),

                finalExam:
                  Boolean(
                    first.second_final_exam_published,
                  ),

                total:
                  Boolean(
                    first.second_total_published,
                  ),
              },

              final:
                Boolean(
                  first.final_published,
                ),
            });
          } else {
            setPublications(
              EMPTY_PUBLICATIONS,
            );
          }
        } catch (
          loadError
        ) {
          console.log(
            'STUDENT PUBLISHED RESULTS:',
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
   * CURRENT PUBLICATION
   * =====================================================
   */

  const selectedPublished =
    useMemo(
      () => {
        if (
          semester ===
          'final'
        ) {
          return publications.final;
        }

        return publications[
          semester
        ][
          assessment
        ];
      },
      [
        assessment,
        publications,
        semester,
      ],
    );

  /*
   * =====================================================
   * RANK VISIBILITY
   * =====================================================
   */

  const rankAllowed =
    selectedPublished &&
    (
      semester ===
        'final' ||
      assessment ===
        'total'
    );

  /*
   * =====================================================
   * LOAD RANK
   * =====================================================
   */

  useEffect(
    () => {
      let active =
        true;

      async function loadRank() {
        if (
          !rankAllowed
        ) {
          setRankData(
            null,
          );

          return;
        }

        try {
          setRankLoading(
            true,
          );

          const {
            data,
            error:
              rankError,
          } =
            await supabase.rpc(
              'get_my_published_ranks',
              {
                p_school_year:
                  schoolYear,

                p_period:
                  semester,
              },
            );

          if (
            rankError
          ) {
            throw rankError;
          }

          if (
            !active
          ) {
            return;
          }

          const raw =
            (
              data ??
              {}
            ) as {
              overallRank?:
                number | null;

              rankedStudents?:
                number;

              classSize?:
                number;

              subjects?:
                Array<{
                  subject:
                    string;

                  rank:
                    number;

                  rankedStudents:
                    number;
                }>;
            };

          setRankData({
            overallRank:
              raw.overallRank ??
              null,

            rankedStudents:
              Number(
                raw.rankedStudents ??
                  0,
              ),

            classSize:
              Number(
                raw.classSize ??
                  0,
              ),

            subjects:
              Array.isArray(
                raw.subjects,
              )
                ? raw.subjects.map(
                    item => ({
                      subject:
                        String(
                          item.subject,
                        ),

                      rank:
                        Number(
                          item.rank,
                        ),

                      rankedStudents:
                        Number(
                          item.rankedStudents,
                        ),
                    }),
                  )
                : [],
          });
        } catch (
          rankError
        ) {
          console.log(
            'STUDENT RANK:',
            rankError,
          );

          if (
            active
          ) {
            setRankData(
              null,
            );
          }
        } finally {
          if (
            active
          ) {
            setRankLoading(
              false,
            );
          }
        }
      }

      void loadRank();

      return () => {
        active =
          false;
      };
    },
    [
      rankAllowed,
      schoolYear,
      semester,
    ],
  );

  /*
   * =====================================================
   * SUBJECT RANK MAP
   * =====================================================
   */

  const subjectRankMap =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            SubjectRank
          >();

        for (
          const rank of
          rankData
            ?.subjects ??
          []
        ) {
          map.set(
            normalizeSubject(
              rank.subject,
            ),
            rank,
          );
        }

        return map;
      },
      [
        rankData,
      ],
    );

  /*
   * =====================================================
   * SCORE
   * =====================================================
   */

  function scoreForResult(
    result:
      ResultRow,
  ) {
    if (
      semester ===
      'final'
    ) {
      return {
        score:
          result.finalTotal,

        max:
          100,
      };
    }

    const scores =
      semester ===
      'first'
        ? result.first
        : result.second;

    return {
      score:
        scores[
          assessment
        ],

      max:
        assessmentMax(
          assessment,
        ),
    };
  }

  /*
   * =====================================================
   * OVERALL
   * =====================================================
   */

  const overall =
    useMemo(
      () => {
        if (
          !selectedPublished
        ) {
          return null;
        }

        const values:
          number[] =
          [];

        for (
          const result of
          results
        ) {
          let score:
            number | null;

          let max:
            number;

          if (
            semester ===
            'final'
          ) {
            score =
              result.finalTotal;

            max =
              100;
          } else {
            const scores =
              semester ===
              'first'
                ? result.first
                : result.second;

            score =
              scores[
                assessment
              ];

            max =
              assessmentMax(
                assessment,
              );
          }

          const percent =
            scorePercentage(
              score,
              max,
            );

          if (
            percent !==
            null
          ) {
            values.push(
              percent,
            );
          }
        }

        if (
          values.length ===
          0
        ) {
          return null;
        }

        return (
          values.reduce(
            (
              sum,
              value,
            ) =>
              sum +
              value,
            0,
          ) /
          values.length
        );
      },
      [
        assessment,
        results,
        selectedPublished,
        semester,
      ],
    );

  const className =
    results[0]
      ?.className ??
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
      {/* TITLE */}

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
            size={18}
            color="#EF5D6C"
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

      {/* ================================================= */}
      {/* SEMESTER */}
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
          onPress={() => {
            setSemester(
              'first',
            );

            setAssessment(
              'test',
            );
          }}
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
          onPress={() => {
            setSemester(
              'second',
            );

            setAssessment(
              'test',
            );
          }}
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
      {/* ASSESSMENT */}
      {/* ================================================= */}

      {semester !==
      'final' ? (
        <>
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
              Assessment
            </Text>

            <Text
              style={
                styles.sectionSmall
              }
            >
              {semester ===
              'first'
                ? 'Semester 1'
                : 'Semester 2'}
            </Text>
          </View>

          <View
            style={
              styles.assessmentGrid
            }
          >
            <AssessmentButton
              title="Test"
              icon="document-text-outline"
              active={
                assessment ===
                'test'
              }
              published={
                publications[
                  semester
                ].test
              }
              onPress={() =>
                setAssessment(
                  'test',
                )
              }
              styles={
                styles
              }
              colors={
                colors
              }
            />

            <AssessmentButton
              title="Mid"
              icon="reader-outline"
              active={
                assessment ===
                'mid'
              }
              published={
                publications[
                  semester
                ].mid
              }
              onPress={() =>
                setAssessment(
                  'mid',
                )
              }
              styles={
                styles
              }
              colors={
                colors
              }
            />

            <AssessmentButton
              title="Final Exam"
              icon="ribbon-outline"
              active={
                assessment ===
                'finalExam'
              }
              published={
                publications[
                  semester
                ].finalExam
              }
              onPress={() =>
                setAssessment(
                  'finalExam',
                )
              }
              styles={
                styles
              }
              colors={
                colors
              }
            />

            <AssessmentButton
              title="Total"
              icon="stats-chart-outline"
              active={
                assessment ===
                'total'
              }
              published={
                publications[
                  semester
                ].total
              }
              onPress={() =>
                setAssessment(
                  'total',
                )
              }
              styles={
                styles
              }
              colors={
                colors
              }
            />
          </View>
        </>
      ) : null}

      {/* ================================================= */}
      {/* NOT PUBLISHED */}
      {/* ================================================= */}

      {!selectedPublished ? (
        <View
          style={
            styles.lockedCard
          }
        >
          <View
            style={
              styles.lockedIcon
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={22}
              color={
                colors.primary
              }
            />
          </View>

          <Text
            style={
              styles.lockedTitle
            }
          >
            Not published yet
          </Text>

          <Text
            style={
              styles.lockedText
            }
          >
            This result will appear after the President publishes it.
          </Text>
        </View>
      ) : (
        <>
          {/* ============================================= */}
          {/* RANK — TOTAL / FINAL ONLY */}
          {/* ============================================= */}

          {rankAllowed ? (
            <View
              style={
                styles.rankCard
              }
            >
              <View
                style={
                  styles.rankIcon
                }
              >
                <Ionicons
                  name="trophy-outline"
                  size={24}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.rankInfo
                }
              >
                <Text
                  style={
                    styles.rankTitle
                  }
                >
                  Class Rank
                </Text>

                <Text
                  style={
                    styles.rankSubtitle
                  }
                >
                  {semester ===
                  'final'
                    ? 'Final result'
                    : 'Semester total /100'}
                </Text>
              </View>

              <View
                style={
                  styles.rankValueBox
                }
              >
                {rankLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />
                ) : rankData
                    ?.overallRank ? (
                  <>
                    <Text
                      style={
                        styles.rankValue
                      }
                    >
                      #
                      {
                        rankData
                          .overallRank
                      }
                    </Text>

                    <Text
                      style={
                        styles.rankOf
                      }
                    >
                      of{' '}
                      {
                        rankData
                          .rankedStudents
                      }
                    </Text>
                  </>
                ) : (
                  <Text
                    style={
                      styles.rankEmpty
                    }
                  >
                    —
                  </Text>
                )}
              </View>
            </View>
          ) : null}

          {/* ============================================= */}
          {/* RESULTS HEADER */}
          {/* ============================================= */}

          <View
            style={
              styles.resultsHeader
            }
          >
            <View>
              <Text
                style={
                  styles.resultsHeaderTitle
                }
              >
                {semester ===
                'final'
                  ? 'Final Result'
                  : assessmentLabel(
                      assessment,
                    )}
              </Text>

              <Text
                style={
                  styles.resultsHeaderCount
                }
              >
                {
                  results.length
                }{' '}
                {results.length ===
                1
                  ? 'subject'
                  : 'subjects'}
              </Text>
            </View>

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
                /
                {semester ===
                'final'
                  ? 100
                  : assessmentMax(
                      assessment,
                    )}
              </Text>
            </View>
          </View>

          {/* ============================================= */}
          {/* SUBJECTS */}
          {/* ============================================= */}

          <View
            style={
              styles.subjectList
            }
          >
            {results.map(
              result => {
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

                const rank =
                  rankAllowed
                    ? subjectRankMap.get(
                        normalizeSubject(
                          result.subject,
                        ),
                      )
                    : undefined;

                return (
                  <View
                    key={
                      result.subject
                    }
                    style={
                      styles.subjectCard
                    }
                  >
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
                        size={21}
                        color={
                          colors.primary
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.subjectInfo
                      }
                    >
                      <Text
                        style={
                          styles.subjectName
                        }
                        numberOfLines={1}
                      >
                        {
                          result.subject
                        }
                      </Text>

                      {score ===
                      null ? (
                        <Text
                          style={
                            styles.subjectSub
                          }
                        >
                          No score
                        </Text>
                      ) : rank ? (
                        <View
                          style={
                            styles.subjectRank
                          }
                        >
                          <Ionicons
                            name="podium-outline"
                            size={10}
                            color={
                              colors.primary
                            }
                          />

                          <Text
                            style={
                              styles.subjectRankText
                            }
                          >
                            Rank #
                            {
                              rank.rank
                            }{' '}
                            of{' '}
                            {
                              rank.rankedStudents
                            }
                          </Text>
                        </View>
                      ) : (
                        <Text
                          style={
                            styles.subjectSub
                          }
                        >
                          {semester ===
                          'final'
                            ? 'Final'
                            : assessmentLabel(
                                assessment,
                              )}
                        </Text>
                      )}
                    </View>

                    <View
                      style={
                        styles.scoreArea
                      }
                    >
                      <Text
                        style={
                          styles.score
                        }
                      >
                        {
                          displayNumber(
                            score,
                          )
                        }
                      </Text>

                      {score !==
                      null ? (
                        <Text
                          style={
                            styles.scoreMax
                          }
                        >
                          /{max}
                        </Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.gradeBox,

                        score ===
                          null &&
                          styles.gradeBoxEmpty,
                      ]}
                    >
                      <Text
                        style={[
                          styles.gradeText,

                          score ===
                            null &&
                            styles.gradeTextEmpty,
                        ]}
                      >
                        {grade}
                      </Text>
                    </View>
                  </View>
                );
              },
            )}
          </View>

          {/* ============================================= */}
          {/* OVERALL */}
          {/* ============================================= */}

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
                size={22}
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
                  styles.overallTitle
                }
              >
                Overall Average
              </Text>

              <Text
                style={
                  styles.overallSub
                }
              >
                {semester ===
                'final'
                  ? 'Final'
                  : assessment ===
                      'total'
                    ? 'All subjects /100'
                    : assessmentLabel(
                        assessment,
                      )}
              </Text>
            </View>

            <Text
              style={
                styles.overallScore
              }
            >
              {overall ===
              null
                ? '—'
                : `${Math.round(
                    overall,
                  )}%`}
            </Text>

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
                {
                  gradeForPercentage(
                    overall,
                  )
                }
              </Text>
            </View>
          </View>
        </>
      )}
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
        styles.semesterButton,

        active &&
          styles.semesterButtonActive,
      ]}
    >
      <Text
        style={[
          styles.semesterText,

          active &&
            styles.semesterTextActive,
        ]}
      >
        {title}
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
  published,
  onPress,
  styles,
  colors,
}: {
  title:
    string;

  icon:
    IoniconName;

  active:
    boolean;

  published:
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
        size={16}
        color={
          active
            ? '#FFFFFF'
            : colors.primary
        }
      />

      <Text
        style={[
          styles.assessmentText,

          active &&
            styles.assessmentTextActive,
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>

      {!published ? (
        <Ionicons
          name="lock-closed"
          size={8}
          color={
            active
              ? '#FFFFFF'
              : colors.textMuted
          }
        />
      ) : null}
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
      flex:
        1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal:
        8,

      paddingTop:
        13,

      paddingBottom:
        125,
    },

    center: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.background,
    },

    loadingText: {
      marginTop:
        9,

      fontSize:
        10,

      color:
        colors.textMuted,
    },

    title: {
      fontSize:
        21,

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
        9.5,

      color:
        colors.textMuted,
    },

    errorCard: {
      marginTop:
        10,

      padding:
        10,

      flexDirection:
        'row',

      gap:
        7,

      alignItems:
        'center',

      borderRadius:
        13,

      backgroundColor:
        '#FFECEF',
    },

    errorText: {
      flex:
        1,

      fontSize:
        9,

      color:
        '#D84D60',
    },

    /*
     * SEMESTER
     */

    semesterTabs: {
      height:
        43,

      marginTop:
        15,

      padding:
        3,

      flexDirection:
        'row',

      borderRadius:
        14,

      backgroundColor:
        colors.surfaceSecondary,
    },

    semesterButton: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        11,
    },

    semesterButtonActive: {
      backgroundColor:
        colors.primary,
    },

    semesterText: {
      fontSize:
        8.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    semesterTextActive: {
      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },

    /*
     * ASSESSMENT
     */

    sectionHeader: {
      marginTop:
        15,

      marginBottom:
        8,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize:
        11,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    sectionSmall: {
      fontSize:
        7,

      color:
        colors.textMuted,
    },

    assessmentGrid: {
      flexDirection:
        'row',

      gap:
        5,
    },

    assessmentButton: {
      flex:
        1,

      minHeight:
        43,

      paddingHorizontal:
        4,

      flexDirection:
        'row',

      gap:
        3,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

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
        7.5,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    assessmentTextActive: {
      color:
        '#FFFFFF',
    },

    /*
     * LOCKED
     */

    lockedCard: {
      marginTop:
        15,

      paddingVertical:
        30,

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

    lockedIcon: {
      width:
        46,

      height:
        46,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        15,

      backgroundColor:
        colors.primarySoft,
    },

    lockedTitle: {
      marginTop:
        10,

      fontSize:
        12,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    lockedText: {
      marginTop:
        4,

      maxWidth:
        220,

      textAlign:
        'center',

      fontSize:
        8.5,

      lineHeight:
        13,

      color:
        colors.textMuted,
    },

    /*
     * RANK
     */

    rankCard: {
      minHeight:
        76,

      marginTop:
        14,

      paddingHorizontal:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    rankIcon: {
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

    rankInfo: {
      flex:
        1,

      marginLeft:
        9,
    },

    rankTitle: {
      fontSize:
        11.5,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    rankSubtitle: {
      marginTop:
        2,

      fontSize:
        7.5,

      color:
        colors.textMuted,
    },

    rankValueBox: {
      minWidth:
        57,

      height:
        51,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        14,

      backgroundColor:
        colors.primarySoft,
    },

    rankValue: {
      fontSize:
        20,

      lineHeight:
        22,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    rankOf: {
      fontSize:
        6.5,

      color:
        colors.textMuted,
    },

    rankEmpty: {
      fontSize:
        19,

      color:
        colors.textMuted,
    },

    /*
     * RESULT HEADER
     */

    resultsHeader: {
      marginTop:
        17,

      marginBottom:
        8,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    resultsHeaderTitle: {
      fontSize:
        12,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    resultsHeaderCount: {
      marginTop:
        2,

      fontSize:
        7,

      color:
        colors.textMuted,
    },

    maxBadge: {
      minWidth:
        38,

      height:
        25,

      paddingHorizontal:
        7,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        9,

      backgroundColor:
        colors.primarySoft,
    },

    maxBadgeText: {
      fontSize:
        8,

      fontWeight:
        '700',

      color:
        colors.primary,
    },

    /*
     * SUBJECTS
     */

    subjectList: {
      gap:
        6,
    },

    subjectCard: {
      minHeight:
        64,

      paddingHorizontal:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        15,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    subjectIcon: {
      width:
        38,

      height:
        38,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,
    },

    subjectInfo: {
      flex:
        1,

      minWidth:
        0,

      marginLeft:
        9,
    },

    subjectName: {
      fontSize:
        10,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    subjectSub: {
      marginTop:
        2,

      fontSize:
        6.8,

      color:
        colors.textMuted,
    },

    subjectRank: {
      marginTop:
        3,

      flexDirection:
        'row',

      gap:
        3,

      alignItems:
        'center',
    },

    subjectRankText: {
      fontSize:
        6.8,

      fontWeight:
        '700',

      color:
        colors.primary,
    },

    scoreArea: {
      minWidth:
        43,

      marginLeft:
        5,

      flexDirection:
        'row',

      alignItems:
        'baseline',

      justifyContent:
        'flex-end',
    },

    score: {
      fontSize:
        14,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    scoreMax: {
      marginLeft:
        1,

      fontSize:
        6.5,

      color:
        colors.textMuted,
    },

    gradeBox: {
      minWidth:
        34,

      height:
        34,

      marginLeft:
        6,

      paddingHorizontal:
        5,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        11,

      backgroundColor:
        '#E4F7EE',
    },

    gradeBoxEmpty: {
      backgroundColor:
        colors.surfaceSecondary,
    },

    gradeText: {
      fontSize:
        9,

      fontWeight:
        '800',

      color:
        '#198B66',
    },

    gradeTextEmpty: {
      color:
        colors.textMuted,
    },

    /*
     * OVERALL
     */

    overallCard: {
      minHeight:
        70,

      marginTop:
        12,

      paddingHorizontal:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    overallIcon: {
      width:
        39,

      height:
        39,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,
    },

    overallInfo: {
      flex:
        1,

      marginLeft:
        9,
    },

    overallTitle: {
      fontSize:
        10,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    overallSub: {
      marginTop:
        2,

      fontSize:
        6.8,

      color:
        colors.textMuted,
    },

    overallScore: {
      marginRight:
        7,

      fontSize:
        14,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    overallGrade: {
      minWidth:
        36,

      height:
        36,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        11,

      backgroundColor:
        '#E4F7EE',
    },

    overallGradeText: {
      fontSize:
        9.5,

      fontWeight:
        '800',

      color:
        '#198B66',
    },
  });
}