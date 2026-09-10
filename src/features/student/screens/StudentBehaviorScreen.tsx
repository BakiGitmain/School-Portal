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
  useFocusEffect,
  useRouter,
} from 'expo-router';

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

type BehaviorType =
  | 'positive'
  | 'reminder'
  | 'concern';

type RecordFilter =
  | 'all'
  | BehaviorType;

type CountSummary = {
  total: number;

  positive: number;

  reminder: number;

  concern: number;
};

type StudentInfo = {
  full_name: string;

  student_id:
    string | null;

  class_id:
    string | null;

  class_name:
    string | null;
};

type MonthData = {
  month_key: string;

  month_label: string;

  positive: number;

  reminder: number;

  concern: number;

  total: number;
};

type BehaviorRecord = {
  id: string;

  behavior_type:
    BehaviorType;

  reason: string;

  note:
    string | null;

  behavior_date: string;

  created_at: string;

  teacher_name: string;
};

type BehaviorResponse = {
  student?: unknown;

  summary?: unknown;

  this_month?: unknown;

  months?: unknown;

  records?: unknown;
};

/* =========================================================
 * HELPERS
 * ======================================================= */

function safeNumber(
  value:
    unknown,
) {
  const number =
    Number(
      value,
    );

  return Number.isFinite(
    number,
  )
    ? number
    : 0;
}

function parseSummary(
  value:
    unknown,
): CountSummary {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return {
      total: 0,
      positive: 0,
      reminder: 0,
      concern: 0,
    };
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  return {
    total:
      safeNumber(
        row.total,
      ),

    positive:
      safeNumber(
        row.positive,
      ),

    reminder:
      safeNumber(
        row.reminder,
      ),

    concern:
      safeNumber(
        row.concern,
      ),
  };
}

function parseStudent(
  value:
    unknown,
): StudentInfo | null {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  return {
    full_name:
      String(
        row.full_name ??
          'Student',
      ),

    student_id:
      row.student_id
        ? String(
            row.student_id,
          )
        : null,

    class_id:
      row.class_id
        ? String(
            row.class_id,
          )
        : null,

    class_name:
      row.class_name
        ? String(
            row.class_name,
          )
        : null,
  };
}

function parseMonths(
  value:
    unknown,
): MonthData[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item:
          unknown,
      ) => {
        if (
          !item ||
          typeof item !==
            'object'
        ) {
          return null;
        }

        const row =
          item as Record<
            string,
            unknown
          >;

        return {
          month_key:
            String(
              row.month_key ??
                '',
            ),

          month_label:
            String(
              row.month_label ??
                '',
            ),

          positive:
            safeNumber(
              row.positive,
            ),

          reminder:
            safeNumber(
              row.reminder,
            ),

          concern:
            safeNumber(
              row.concern,
            ),

          total:
            safeNumber(
              row.total,
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        MonthData =>
        Boolean(
          item,
        ),
    );
}

function parseRecords(
  value:
    unknown,
): BehaviorRecord[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item:
          unknown,
      ) => {
        if (
          !item ||
          typeof item !==
            'object'
        ) {
          return null;
        }

        const row =
          item as Record<
            string,
            unknown
          >;

        const type =
          String(
            row.behavior_type ??
              '',
          );

        if (
          !row.id ||
          (
            type !==
              'positive' &&
            type !==
              'reminder' &&
            type !==
              'concern'
          )
        ) {
          return null;
        }

        return {
          id:
            String(
              row.id,
            ),

          behavior_type:
            type as
              BehaviorType,

          reason:
            String(
              row.reason ??
                '',
            ),

          note:
            row.note
              ? String(
                  row.note,
                )
              : null,

          behavior_date:
            String(
              row.behavior_date ??
                '',
            ),

          created_at:
            String(
              row.created_at ??
                '',
            ),

          teacher_name:
            String(
              row.teacher_name ??
                'Homeroom Teacher',
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is
        BehaviorRecord =>
        Boolean(
          item,
        ),
    );
}

function behaviorTitle(
  type:
    BehaviorType,
) {
  if (
    type ===
    'positive'
  ) {
    return 'Positive';
  }

  if (
    type ===
    'reminder'
  ) {
    return 'Reminder';
  }

  return 'Concern';
}

function behaviorIcon(
  type:
    BehaviorType,
):
  | 'checkmark-circle-outline'
  | 'notifications-outline'
  | 'alert-circle-outline' {
  if (
    type ===
    'positive'
  ) {
    return 'checkmark-circle-outline';
  }

  if (
    type ===
    'reminder'
  ) {
    return 'notifications-outline';
  }

  return 'alert-circle-outline';
}

function readableDate(
  value:
    string,
) {
  if (
    !value
  ) {
    return '';
  }

  const [
    year,
    month,
    day,
  ] =
    value
      .split('-')
      .map(Number);

  const date =
    new Date(
      year,
      month - 1,
      day,
    );

  return date.toLocaleDateString(
    undefined,
    {
      month:
        'short',

      day:
        'numeric',

      year:
        'numeric',
    },
  );
}

/* =========================================================
 * SCREEN
 * ======================================================= */

export default function StudentBehaviorScreen() {
  const router =
    useRouter();

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

  const [
    student,
    setStudent,
  ] =
    useState<
      StudentInfo | null
    >(null);

  const [
    summary,
    setSummary,
  ] =
    useState<CountSummary>({
      total: 0,
      positive: 0,
      reminder: 0,
      concern: 0,
    });

  const [
    thisMonth,
    setThisMonth,
  ] =
    useState<CountSummary>({
      total: 0,
      positive: 0,
      reminder: 0,
      concern: 0,
    });

  const [
    months,
    setMonths,
  ] =
    useState<
      MonthData[]
    >([]);

  const [
    records,
    setRecords,
  ] =
    useState<
      BehaviorRecord[]
    >([]);

  const [
    filter,
    setFilter,
  ] =
    useState<RecordFilter>(
      'all',
    );

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

  /* =====================================================
   * LOAD
   * =================================================== */

  const loadBehavior =
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
              loadError,
          } =
            await supabase.rpc(
              'get_my_behavior',
            );

          if (
            loadError
          ) {
            throw loadError;
          }

          const response =
            (
              data ??
              {}
            ) as
              BehaviorResponse;

          setStudent(
            parseStudent(
              response.student,
            ),
          );

          setSummary(
            parseSummary(
              response.summary,
            ),
          );

          setThisMonth(
            parseSummary(
              response.this_month,
            ),
          );

          setMonths(
            parseMonths(
              response.months,
            ),
          );

          setRecords(
            parseRecords(
              response.records,
            ),
          );
        } catch (
          loadError
        ) {
          console.log(
            'LOAD MY BEHAVIOR:',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Could not load your behavior records.',
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
        void loadBehavior();
      },
      [
        loadBehavior,
      ],
    ),
  );

  /* =====================================================
   * FILTER
   * =================================================== */

  const filteredRecords =
    useMemo(
      () => {
        if (
          filter ===
          'all'
        ) {
          return records;
        }

        return records.filter(
          record =>
            record.behavior_type ===
            filter,
        );
      },
      [
        filter,
        records,
      ],
    );

  /* =====================================================
   * CHART
   * =================================================== */

  const maxChartValue =
    useMemo(
      () =>
        Math.max(
          1,

          ...months.flatMap(
            month => [
              month.positive,
              month.reminder,
              month.concern,
            ],
          ),
        ),
      [
        months,
      ],
    );

  function barHeight(
    value:
      number,
  ) {
    if (
      value <=
      0
    ) {
      return 0;
    }

    return Math.max(
      6,
      Math.round(
        (
          value /
          maxChartValue
        ) *
          92,
      ),
    );
  }

  /* =====================================================
   * UI
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
              void loadBehavior(
                true,
              )
            }
            colors={[
              colors.primary,
            ]}
            tintColor={
              colors.primary
            }
          />
        }
      >
        {/* BACK */}

        <Pressable
          onPress={() =>
            router.back()
          }
          style={({
            pressed,
          }) => [
            styles.backButton,

            pressed &&
              styles.pressed,
          ]}
        >
          <Ionicons
            name="arrow-back"
            size={20}
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

        {/* TITLE */}

        <View
          style={
            styles.titleArea
          }
        >
          <Text
            style={
              styles.title
            }
          >
            My Behavior
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Track your classroom behavior and recent records.
          </Text>
        </View>

        {/* LOADING */}

        {loading ? (
          <View
            style={
              styles.loadingCard
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
              Loading behavior...
            </Text>
          </View>
        ) : null}

        {/* ERROR */}

        {!loading &&
        error ? (
          <View
            style={
              styles.errorCard
            }
          >
            <View
              style={
                styles.errorIcon
              }
            >
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={
                  colors.danger
                }
              />
            </View>

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
                Could not load
              </Text>

              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            </View>

            <Pressable
              onPress={() =>
                void loadBehavior()
              }
              style={
                styles.retryButton
              }
            >
              <Ionicons
                name="refresh"
                size={19}
                color={
                  colors.primary
                }
              />
            </Pressable>
          </View>
        ) : null}

        {!loading &&
        !error ? (
          <>
            {/* ============================================= */}
            {/* STUDENT INFO */}
            {/* ============================================= */}

            <View
              style={
                styles.studentCard
              }
            >
              <View
                style={
                  styles.studentIcon
                }
              >
                <Ionicons
                  name="school-outline"
                  size={24}
                  color={
                    colors.primary
                  }
                />
              </View>

              <View
                style={
                  styles.studentInfo
                }
              >
                <Text
                  style={
                    styles.studentName
                  }
                >
                  {student
                    ?.full_name ??
                    'Student'}
                </Text>

                <Text
                  style={
                    styles.studentClass
                  }
                >
                  {student
                    ?.class_name ??
                    'No class assigned'}
                  {student
                    ?.student_id
                    ? `  •  ${student.student_id}`
                    : ''}
                </Text>
              </View>

              <View
                style={
                  styles.totalBadge
                }
              >
                <Text
                  style={
                    styles.totalNumber
                  }
                >
                  {
                    summary.total
                  }
                </Text>

                <Text
                  style={
                    styles.totalLabel
                  }
                >
                  Total
                </Text>
              </View>
            </View>

            {/* ============================================= */}
            {/* THIS MONTH */}
            {/* ============================================= */}

            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  This Month
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Your recorded behavior this month
                </Text>
              </View>

              <View
                style={
                  styles.monthTotalBadge
                }
              >
                <Text
                  style={
                    styles.monthTotalText
                  }
                >
                  {
                    thisMonth.total
                  }
                </Text>
              </View>
            </View>

            <View
              style={
                styles.summaryGrid
              }
            >
              <SummaryCard
                title="Positive"
                count={
                  thisMonth.positive
                }
                icon="checkmark-circle-outline"
                type="positive"
                styles={
                  styles
                }
              />

              <SummaryCard
                title="Reminder"
                count={
                  thisMonth.reminder
                }
                icon="notifications-outline"
                type="reminder"
                styles={
                  styles
                }
              />

              <SummaryCard
                title="Concern"
                count={
                  thisMonth.concern
                }
                icon="alert-circle-outline"
                type="concern"
                styles={
                  styles
                }
              />
            </View>

            {/* ============================================= */}
            {/* GRAPH */}
            {/* ============================================= */}

            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  6 Month Trend
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Behavior records over time
                </Text>
              </View>
            </View>

            <View
              style={
                styles.chartCard
              }
            >
              {/* LEGEND */}

              <View
                style={
                  styles.legend
                }
              >
                <LegendItem
                  title="Positive"
                  type="positive"
                  styles={
                    styles
                  }
                />

                <LegendItem
                  title="Reminder"
                  type="reminder"
                  styles={
                    styles
                  }
                />

                <LegendItem
                  title="Concern"
                  type="concern"
                  styles={
                    styles
                  }
                />
              </View>

              {/* CHART */}

              <View
                style={
                  styles.chart
                }
              >
                {months.map(
                  month => (
                    <View
                      key={
                        month.month_key
                      }
                      style={
                        styles.monthColumn
                      }
                    >
                      <View
                        style={
                          styles.barArea
                        }
                      >
                        <View
                          style={
                            styles.barGroup
                          }
                        >
                          <View
                            style={[
                              styles.chartBar,
                              styles.positiveBar,

                              {
                                height:
                                  barHeight(
                                    month.positive,
                                  ),
                              },
                            ]}
                          />

                          <View
                            style={[
                              styles.chartBar,
                              styles.reminderBar,

                              {
                                height:
                                  barHeight(
                                    month.reminder,
                                  ),
                              },
                            ]}
                          />

                          <View
                            style={[
                              styles.chartBar,
                              styles.concernBar,

                              {
                                height:
                                  barHeight(
                                    month.concern,
                                  ),
                              },
                            ]}
                          />
                        </View>
                      </View>

                      <Text
                        style={
                          styles.monthLabel
                        }
                      >
                        {
                          month.month_label
                        }
                      </Text>
                    </View>
                  ),
                )}
              </View>

              {summary.total ===
              0 ? (
                <Text
                  style={
                    styles.noChartData
                  }
                >
                  Your graph will appear as behavior records are added.
                </Text>
              ) : null}
            </View>

            {/* ============================================= */}
            {/* HISTORY */}
            {/* ============================================= */}

            <View
              style={
                styles.sectionHeader
              }
            >
              <View>
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  History
                </Text>

                <Text
                  style={
                    styles.sectionSubtitle
                  }
                >
                  Recent records from your homeroom teacher
                </Text>
              </View>
            </View>

            {/* FILTER */}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.filters
              }
            >
              <FilterButton
                title="All"
                active={
                  filter ===
                  'all'
                }
                onPress={() =>
                  setFilter(
                    'all',
                  )
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
              />

              <FilterButton
                title="Positive"
                active={
                  filter ===
                  'positive'
                }
                onPress={() =>
                  setFilter(
                    'positive',
                  )
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
              />

              <FilterButton
                title="Reminder"
                active={
                  filter ===
                  'reminder'
                }
                onPress={() =>
                  setFilter(
                    'reminder',
                  )
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
              />

              <FilterButton
                title="Concern"
                active={
                  filter ===
                  'concern'
                }
                onPress={() =>
                  setFilter(
                    'concern',
                  )
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
              />
            </ScrollView>

            {/* RECORDS */}

            {filteredRecords.length ===
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
                    name="sparkles-outline"
                    size={27}
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
                  No records
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  There are no behavior records in this section yet.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.historyList
                }
              >
                {filteredRecords.map(
                  record => (
                    <BehaviorRecordCard
                      key={
                        record.id
                      }
                      record={
                        record
                      }
                      colors={
                        colors
                      }
                      styles={
                        styles
                      }
                    />
                  ),
                )}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
 * SUMMARY CARD
 * ======================================================= */

function SummaryCard({
  title,
  count,
  icon,
  type,
  styles,
}: {
  title:
    string;

  count:
    number;

  icon:
    | 'checkmark-circle-outline'
    | 'notifications-outline'
    | 'alert-circle-outline';

  type:
    BehaviorType;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  const color =
    type ===
    'positive'
      ? '#249867'
      : type ===
          'reminder'
        ? '#B47700'
        : '#D84355';

  return (
    <View
      style={
        styles.summaryCard
      }
    >
      <View
        style={[
          styles.summaryIcon,

          type ===
            'positive' &&
            styles.positiveSoft,

          type ===
            'reminder' &&
            styles.reminderSoft,

          type ===
            'concern' &&
            styles.concernSoft,
        ]}
      >
        <Ionicons
          name={
            icon
          }
          size={20}
          color={
            color
          }
        />
      </View>

      <Text
        style={[
          styles.summaryNumber,
          {
            color,
          },
        ]}
      >
        {count}
      </Text>

      <Text
        style={
          styles.summaryLabel
        }
      >
        {title}
      </Text>
    </View>
  );
}

/* =========================================================
 * LEGEND
 * ======================================================= */

function LegendItem({
  title,
  type,
  styles,
}: {
  title:
    string;

  type:
    BehaviorType;

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
      <View
        style={[
          styles.legendDot,

          type ===
            'positive' &&
            styles.positiveBar,

          type ===
            'reminder' &&
            styles.reminderBar,

          type ===
            'concern' &&
            styles.concernBar,
        ]}
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
 * FILTER
 * ======================================================= */

function FilterButton({
  title,
  active,
  onPress,
  colors,
  styles,
}: {
  title:
    string;

  active:
    boolean;

  onPress:
    () => void;

  colors:
    AppThemeColors;

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
        styles.filterButton,

        active &&
          styles.filterButtonActive,
      ]}
    >
      <Text
        style={[
          styles.filterText,

          {
            color:
              active
                ? '#FFFFFF'
                : colors.textSecondary,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* =========================================================
 * RECORD
 * ======================================================= */

function BehaviorRecordCard({
  record,
  colors,
  styles,
}: {
  record:
    BehaviorRecord;

  colors:
    AppThemeColors;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  const type =
    record.behavior_type;

  const color =
    type ===
    'positive'
      ? '#249867'
      : type ===
          'reminder'
        ? '#B47700'
        : '#D84355';

  return (
    <View
      style={
        styles.recordCard
      }
    >
      <View
        style={
          styles.recordTop
        }
      >
        <View
          style={[
            styles.recordIcon,

            type ===
              'positive' &&
              styles.positiveSoft,

            type ===
              'reminder' &&
              styles.reminderSoft,

            type ===
              'concern' &&
              styles.concernSoft,
          ]}
        >
          <Ionicons
            name={
              behaviorIcon(
                type,
              )
            }
            size={20}
            color={
              color
            }
          />
        </View>

        <View
          style={
            styles.recordHeading
          }
        >
          <Text
            style={
              styles.recordReason
            }
          >
            {
              record.reason
            }
          </Text>

          <Text
            style={
              styles.recordDate
            }
          >
            {
              readableDate(
                record.behavior_date,
              )
            }
          </Text>
        </View>

        <View
          style={[
            styles.typeBadge,

            type ===
              'positive' &&
              styles.positiveSoft,

            type ===
              'reminder' &&
              styles.reminderSoft,

            type ===
              'concern' &&
              styles.concernSoft,
          ]}
        >
          <Text
            style={[
              styles.typeBadgeText,

              {
                color,
              },
            ]}
          >
            {
              behaviorTitle(
                type,
              )
            }
          </Text>
        </View>
      </View>

      {record.note ? (
        <Text
          style={
            styles.recordNote
          }
        >
          {
            record.note
          }
        </Text>
      ) : null}

      <View
        style={
          styles.recordFooter
        }
      >
        <Ionicons
          name="person-outline"
          size={13}
          color={
            colors.textMuted
          }
        />

        <Text
          style={
            styles.teacherName
          }
        >
          {
            record.teacher_name
          }
        </Text>
      </View>
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

    screen: {
      flex: 1,

      backgroundColor:
        colors.background,
    },

    content: {
      paddingHorizontal: 15,

      paddingTop: 14,

      paddingBottom: 140,
    },

    pressed: {
      opacity: 0.72,
    },

    /* BACK */

    backButton: {
      alignSelf:
        'flex-start',

      minHeight: 42,

      paddingHorizontal: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,

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

    titleArea: {
      marginTop: 18,

      marginBottom: 15,
    },

    title: {
      fontSize: 23,

      lineHeight: 29,

      fontWeight:
        '800',

      letterSpacing:
        -0.3,

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 3,

      fontSize: 12,

      lineHeight: 17,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    /* LOADING */

    loadingCard: {
      minHeight: 200,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    loadingText: {
      marginTop: 10,

      fontSize: 11,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* ERROR */

    errorCard: {
      minHeight: 82,

      padding: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        '#F0C8CE',

      backgroundColor:
        '#FFF2F4',
    },

    errorIcon: {
      width: 42,

      height: 42,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      backgroundColor:
        '#FFE4E8',
    },

    errorContent: {
      flex: 1,

      marginHorizontal: 10,
    },

    errorTitle: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.danger,
    },

    errorText: {
      marginTop: 2,

      fontSize: 10,

      lineHeight: 15,

      fontWeight:
        '500',

      color:
        colors.danger,
    },

    retryButton: {
      width: 40,

      height: 40,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 12,

      backgroundColor:
        colors.primarySoft,
    },

    /* STUDENT */

    studentCard: {
      minHeight: 84,

      paddingHorizontal: 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    studentIcon: {
      width: 47,

      height: 47,

      borderRadius: 15,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    studentInfo: {
      flex: 1,

      minWidth: 0,

      marginLeft: 11,
    },

    studentName: {
      fontSize: 15,

      lineHeight: 20,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    studentClass: {
      marginTop: 3,

      fontSize: 10.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    totalBadge: {
      minWidth: 54,

      alignItems:
        'center',
    },

    totalNumber: {
      fontSize: 20,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    totalLabel: {
      marginTop: 1,

      fontSize: 8.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* SECTION */

    sectionHeader: {
      marginTop: 24,

      marginBottom: 10,

      paddingHorizontal: 2,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize: 16,

      lineHeight: 21,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    sectionSubtitle: {
      marginTop: 2,

      fontSize: 10.5,

      lineHeight: 15,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    monthTotalBadge: {
      minWidth: 32,

      height: 32,

      paddingHorizontal: 8,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    monthTotalText: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    /* SUMMARY */

    summaryGrid: {
      flexDirection:
        'row',

      gap: 8,
    },

    summaryCard: {
      flex: 1,

      minHeight: 118,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    summaryIcon: {
      width: 36,

      height: 36,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 12,
    },

    summaryNumber: {
      marginTop: 7,

      fontSize: 22,

      lineHeight: 26,

      fontWeight:
        '800',
    },

    summaryLabel: {
      marginTop: 2,

      fontSize: 10.5,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    positiveSoft: {
      backgroundColor:
        '#EAF8F1',
    },

    reminderSoft: {
      backgroundColor:
        '#FFF6DF',
    },

    concernSoft: {
      backgroundColor:
        '#FFF0F2',
    },

    /* GRAPH */

    chartCard: {
      paddingHorizontal: 12,

      paddingTop: 13,

      paddingBottom: 12,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    legend: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 14,
    },

    legendItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,
    },

    legendDot: {
      width: 8,

      height: 8,

      borderRadius: 3,
    },

    legendText: {
      fontSize: 9,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    chart: {
      height: 135,

      marginTop: 14,

      paddingTop: 8,

      borderBottomWidth: 1,

      borderBottomColor:
        colors.border,

      flexDirection:
        'row',

      alignItems:
        'flex-end',
    },

    monthColumn: {
      flex: 1,

      height:
        '100%',

      alignItems:
        'center',

      justifyContent:
        'flex-end',
    },

    barArea: {
      flex: 1,

      width:
        '100%',

      alignItems:
        'center',

      justifyContent:
        'flex-end',
    },

    barGroup: {
      height: 98,

      flexDirection:
        'row',

      alignItems:
        'flex-end',

      justifyContent:
        'center',

      gap: 3,
    },

    chartBar: {
      width: 7,

      borderTopLeftRadius: 3,

      borderTopRightRadius: 3,
    },

    positiveBar: {
      backgroundColor:
        '#35A873',
    },

    reminderBar: {
      backgroundColor:
        '#E4A51B',
    },

    concernBar: {
      backgroundColor:
        '#E55264',
    },

    monthLabel: {
      height: 23,

      marginTop: 5,

      fontSize: 9,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    noChartData: {
      marginTop: 10,

      textAlign:
        'center',

      fontSize: 10,

      lineHeight: 15,

      color:
        colors.textMuted,
    },

    /* FILTER */

    filters: {
      gap: 7,

      paddingBottom: 2,
    },

    filterButton: {
      minHeight: 36,

      paddingHorizontal: 13,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 11,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    filterButtonActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primary,
    },

    filterText: {
      fontSize: 10.5,

      fontWeight:
        '800',
    },

    /* HISTORY */

    historyList: {
      marginTop: 10,

      gap: 9,
    },

    recordCard: {
      padding: 13,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    recordTop: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    recordIcon: {
      width: 40,

      height: 40,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,
    },

    recordHeading: {
      flex: 1,

      minWidth: 0,

      marginLeft: 10,

      marginRight: 7,
    },

    recordReason: {
      fontSize: 13,

      lineHeight: 18,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    recordDate: {
      marginTop: 2,

      fontSize: 9.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    typeBadge: {
      minHeight: 27,

      paddingHorizontal: 8,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 9,
    },

    typeBadgeText: {
      fontSize: 9,

      fontWeight:
        '800',
    },

    recordNote: {
      marginTop: 10,

      paddingTop: 9,

      borderTopWidth: 1,

      borderTopColor:
        colors.border,

      fontSize: 11,

      lineHeight: 17,

      fontWeight:
        '500',

      color:
        colors.textSecondary,
    },

    recordFooter: {
      marginTop: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,
    },

    teacherName: {
      fontSize: 9.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* EMPTY */

    emptyCard: {
      minHeight: 155,

      marginTop: 10,

      paddingHorizontal: 25,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    emptyIcon: {
      width: 52,

      height: 52,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 17,

      backgroundColor:
        colors.primarySoft,
    },

    emptyTitle: {
      marginTop: 11,

      fontSize: 14,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    emptyText: {
      marginTop: 4,

      textAlign:
        'center',

      fontSize: 10.5,

      lineHeight: 16,

      color:
        colors.textMuted,
    },
  });
}