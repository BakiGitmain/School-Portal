import React, {
  memo,
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

import Svg, {
  Circle,
} from 'react-native-svg';

import { supabase } from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'pending';

type ViewMode =
  | 'month'
  | 'semester';

type Semester =
  | 1
  | 2;

type AttendanceRpcRow = {
  class_id: string;
  class_name: string;
  attendance_date: string;
  status: string;
};

type AttendanceRecord = {
  classId: string;
  className: string;
  date: string;
  status: AttendanceStatus;
};

/*
 * =========================================================
 * COLORS
 * =========================================================
 */

const PRESENT_COLOR = '#84D22A';
const PRESENT_SOFT = '#EAF8D6';
const PRESENT_BORDER = '#A6D866';
const PRESENT_TEXT = '#4A791D';

const ABSENT_COLOR = '#FF3B5F';
const ABSENT_SOFT = '#FFE7EC';
const ABSENT_BORDER = '#F5A4B3';
const ABSENT_TEXT = '#C5485E';

const QUEUE_COLOR = '#F4AA18';
const QUEUE_SOFT = '#FFF3CC';
const QUEUE_BORDER = '#E6C45C';
const QUEUE_TEXT = '#AA7D0C';

const UPCOMING_COLOR = '#B8C3D0';
const UPCOMING_SOFT = '#F2F5F8';

const EMPTY_RING_COLOR = '#E7ECF2';

/*
 * =========================================================
 * DATE HELPERS
 * =========================================================
 */

function today() {
  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
}

function dateKey(
  date: Date,
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      '0',
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    );

  return `${year}-${month}-${day}`;
}

function parseDateKey(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] = value
    .slice(0, 10)
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day,
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

function addMonth(
  date: Date,
  amount: number,
) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1,
  );
}

function currentSchoolYear() {
  const now = new Date();

  const startYear =
    now.getMonth() >= 8
      ? now.getFullYear()
      : now.getFullYear() - 1;

  return {
    label:
      `${startYear}-${startYear + 1}`,

    startYear,

    from:
      new Date(
        startYear,
        8,
        1,
      ),

    to:
      new Date(
        startYear + 1,
        7,
        31,
      ),
  };
}

function semesterRange(
  startYear: number,
  semester: Semester,
) {
  if (
    semester === 1
  ) {
    return {
      from:
        new Date(
          startYear,
          8,
          1,
        ),

      to:
        new Date(
          startYear,
          11,
          31,
        ),
    };
  }

  return {
    from:
      new Date(
        startYear + 1,
        0,
        1,
      ),

    to:
      new Date(
        startYear + 1,
        7,
        31,
      ),
  };
}

function normalizeStatus(
  value: string,
): AttendanceStatus | null {
  if (
    value === 'present' ||
    value === 'absent' ||
    value === 'pending'
  ) {
    return value;
  }

  return null;
}

function statusName(
  status:
    AttendanceStatus | null,
) {
  if (
    status === 'present'
  ) {
    return 'Present';
  }

  if (
    status === 'absent'
  ) {
    return 'Absent';
  }

  if (
    status === 'pending'
  ) {
    return 'Queue';
  }

  return 'No record';
}

/*
 * =========================================================
 * MAIN SCREEN
 * =========================================================
 */

export default function StudentAttendanceScreen() {
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
    records,
    setRecords,
  ] =
    useState<
      AttendanceRecord[]
    >([]);

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
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);

  const [
    mode,
    setMode,
  ] =
    useState<ViewMode>(
      'month',
    );

  const [
    semester,
    setSemester,
  ] =
    useState<Semester>(
      1,
    );

  const [
    viewMonth,
    setViewMonth,
  ] =
    useState(
      new Date(
        today().getFullYear(),
        today().getMonth(),
        1,
      ),
    );

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState<
      string | null
    >(
      dateKey(
        today(),
      ),
    );

  /*
   * =====================================================
   * LOAD
   * =====================================================
   */

  const loadAttendance =
    useCallback(
      async (
        refresh = false,
      ) => {
        try {
          if (
            refresh
          ) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError(null);

          const current =
            today();

          const safeTo =
            schoolYear.to >
            current
              ? current
              : schoolYear.to;

          const {
            data,
            error:
              attendanceError,
          } =
            await supabase.rpc(
              'get_my_attendance',
              {
                p_from:
                  dateKey(
                    schoolYear.from,
                  ),

                p_to:
                  dateKey(
                    safeTo,
                  ),
              },
            );

          if (
            attendanceError
          ) {
            throw attendanceError;
          }

          const rows =
            (
              data ?? []
            ) as AttendanceRpcRow[];

          const next:
            AttendanceRecord[] =
            [];

          for (
            const row of rows
          ) {
            const status =
              normalizeStatus(
                row.status,
              );

            if (
              !status
            ) {
              continue;
            }

            next.push({
              classId:
                String(
                  row.class_id,
                ),

              className:
                String(
                  row.class_name ??
                    '',
                ),

              date:
                String(
                  row.attendance_date,
                ).slice(
                  0,
                  10,
                ),

              status,
            });
          }

          setRecords(
            next,
          );
        } catch (
          loadError
        ) {
          console.log(
            'STUDENT ATTENDANCE:',
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load attendance.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        schoolYear,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadAttendance();
      },
      [
        loadAttendance,
      ],
    ),
  );

  /*
   * =====================================================
   * ATTENDANCE MAP
   * =====================================================
   */

  const attendanceMap =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            AttendanceStatus
          >();

        for (
          const record of
          records
        ) {
          map.set(
            record.date,
            record.status,
          );
        }

        return map;
      },
      [
        records,
      ],
    );

  /*
   * =====================================================
   * FILTER
   * =====================================================
   */

  const displayedRecords =
    useMemo(
      () => {
        if (
          mode === 'month'
        ) {
          return records.filter(
            record =>
              sameMonth(
                parseDateKey(
                  record.date,
                ),
                viewMonth,
              ),
          );
        }

        const range =
          semesterRange(
            schoolYear.startYear,
            semester,
          );

        return records.filter(
          record => {
            const date =
              parseDateKey(
                record.date,
              );

            return (
              date >=
                range.from &&
              date <=
                range.to
            );
          },
        );
      },
      [
        mode,
        records,
        semester,
        schoolYear.startYear,
        viewMonth,
      ],
    );

  /*
   * =====================================================
   * STATS
   * =====================================================
   */

  const stats =
    useMemo(
      () => {
        let present = 0;
        let absent = 0;
        let pending = 0;

        for (
          const record of
          displayedRecords
        ) {
          if (
            record.status ===
            'present'
          ) {
            present += 1;
          } else if (
            record.status ===
            'absent'
          ) {
            absent += 1;
          } else if (
            record.status ===
            'pending'
          ) {
            pending += 1;
          }
        }

        const finalized =
          present + absent;

        const percentage =
          finalized === 0
            ? 0
            : Math.round(
                (
                  present /
                  finalized
                ) *
                  100,
              );

        return {
          present,
          absent,
          pending,

          percentage,

          total:
            present +
            absent +
            pending,
        };
      },
      [
        displayedRecords,
      ],
    );

  /*
   * =====================================================
   * CALENDAR CELLS
   * =====================================================
   */

  const calendarCells =
    useMemo(
      () => {
        const year =
          viewMonth
            .getFullYear();

        const month =
          viewMonth
            .getMonth();

        const firstDay =
          new Date(
            year,
            month,
            1,
          );

        const daysInMonth =
          new Date(
            year,
            month + 1,
            0,
          ).getDate();

        const leading =
          (
            firstDay.getDay() +
            6
          ) %
          7;

        const cells:
          (
            | number
            | null
          )[] =
          [];

        for (
          let i = 0;
          i < leading;
          i += 1
        ) {
          cells.push(null);
        }

        for (
          let day = 1;
          day <=
          daysInMonth;
          day += 1
        ) {
          cells.push(day);
        }

        return cells;
      },
      [
        viewMonth,
      ],
    );

  /*
   * =====================================================
   * NAVIGATION
   * =====================================================
   */

  const currentMonth =
    new Date(
      today().getFullYear(),
      today().getMonth(),
      1,
    );

  const firstSchoolMonth =
    new Date(
      schoolYear.from
        .getFullYear(),

      schoolYear.from
        .getMonth(),

      1,
    );

  const canPrevious =
    viewMonth >
    firstSchoolMonth;

  const canNext =
    viewMonth <
    currentMonth;

  const selectedStatus =
    selectedDate
      ? attendanceMap.get(
          selectedDate,
        ) ?? null
      : null;

  const className =
    records[0]
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
          Loading attendance...
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
            void loadAttendance(
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
        Attendance
      </Text>

      <Text
        style={
          styles.subtitle
        }
      >
        {className
          ? `${className} • `
          : ''}

        {schoolYear.label}
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
            color={
              ABSENT_COLOR
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

      {/* MODE */}

      <View
        style={
          styles.segment
        }
      >
        <Pressable
          onPress={() =>
            setMode(
              'month',
            )
          }
          style={[
            styles.segmentButton,

            mode ===
              'month' &&
              styles.segmentButtonActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,

              mode ===
                'month' &&
                styles.segmentTextActive,
            ]}
          >
            Month
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            setMode(
              'semester',
            )
          }
          style={[
            styles.segmentButton,

            mode ===
              'semester' &&
              styles.segmentButtonActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,

              mode ===
                'semester' &&
                styles.segmentTextActive,
            ]}
          >
            Semester
          </Text>
        </Pressable>
      </View>

      {/* ================================================= */}
      {/* MONTH */}
      {/* ================================================= */}

      {mode ===
      'month' ? (
        <View
          style={
            styles.calendarCard
          }
        >
          {/* MONTH HEADER */}

          <View
            style={
              styles.monthHeader
            }
          >
            <Pressable
              disabled={
                !canPrevious
              }
              onPress={() =>
                setViewMonth(
                  current =>
                    addMonth(
                      current,
                      -1,
                    ),
                )
              }
              style={[
                styles.arrowButton,

                !canPrevious &&
                  styles.arrowDisabled,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={18}
                color={
                  colors.primary
                }
              />
            </Pressable>

            <View
              style={
                styles.monthCenter
              }
            >
              <Text
                style={
                  styles.monthName
                }
              >
                {viewMonth
                  .toLocaleDateString(
                    undefined,
                    {
                      month:
                        'long',
                    },
                  )}
              </Text>

              <Text
                style={
                  styles.monthYear
                }
              >
                {viewMonth
                  .getFullYear()}
              </Text>
            </View>

            <Pressable
              disabled={
                !canNext
              }
              onPress={() =>
                setViewMonth(
                  current =>
                    addMonth(
                      current,
                      1,
                    ),
                )
              }
              style={[
                styles.arrowButton,

                !canNext &&
                  styles.arrowDisabled,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={
                  colors.primary
                }
              />
            </Pressable>
          </View>

          {/* WEEK */}

          <View
            style={
              styles.weekRow
            }
          >
            {[
              'Mon',
              'Tue',
              'Wed',
              'Thu',
              'Fri',
              'Sat',
              'Sun',
            ].map(
              day => (
                <Text
                  key={day}
                  style={
                    styles.weekDay
                  }
                >
                  {day}
                </Text>
              ),
            )}
          </View>

          {/* CALENDAR */}

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
                  day === null
                ) {
                  return (
                    <View
                      key={
                        `blank-${index}`
                      }
                      style={
                        styles.daySlot
                      }
                    />
                  );
                }

                const date =
                  new Date(
                    viewMonth.getFullYear(),
                    viewMonth.getMonth(),
                    day,
                  );

                const key =
                  dateKey(
                    date,
                  );

                const status =
                  attendanceMap.get(
                    key,
                  );

                const future =
                  date >
                  today();

                const selected =
                  key ===
                  selectedDate;

                return (
                  <View
                    key={key}
                    style={
                      styles.daySlot
                    }
                  >
                    <Pressable
                      disabled={
                        future
                      }
                      onPress={() =>
                        setSelectedDate(
                          key,
                        )
                      }
                      style={({
                        pressed,
                      }) => [
                        styles.dayTile,

                        !status &&
                          !future &&
                          styles.normalDay,

                        status ===
                          'present' &&
                          !future &&
                          styles.presentDay,

                        status ===
                          'absent' &&
                          !future &&
                          styles.absentDay,

                        status ===
                          'pending' &&
                          !future &&
                          styles.pendingDay,

                        future &&
                          styles.futureDay,

                        selected &&
                          styles.selectedDay,

                        pressed &&
                          !future && {
                            opacity:
                              0.7,
                          },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,

                          status ===
                            'present' &&
                            styles.presentDayText,

                          status ===
                            'absent' &&
                            styles.absentDayText,

                          status ===
                            'pending' &&
                            styles.pendingDayText,

                          future &&
                            styles.futureDayText,

                          selected &&
                            styles.selectedDayText,
                        ]}
                      >
                        {day}
                      </Text>
                    </Pressable>
                  </View>
                );
              },
            )}
          </View>

          {/* SELECTED */}

          <View
            style={
              styles.selectedRow
            }
          >
            <View>
              <Text
                style={
                  styles.selectedLabel
                }
              >
                Selected day
              </Text>

              <Text
                style={
                  styles.selectedDate
                }
              >
                {selectedDate
                  ? parseDateKey(
                      selectedDate,
                    ).toLocaleDateString(
                      undefined,
                      {
                        month:
                          'short',

                        day:
                          'numeric',

                        year:
                          'numeric',
                      },
                    )
                  : '—'}
              </Text>
            </View>

            <StatusPill
              status={
                selectedStatus
              }
              styles={
                styles
              }
            />
          </View>

          {/* LEGEND */}

          <View
            style={
              styles.legendRow
            }
          >
            <LegendItem
              title="Present"
              color={
                PRESENT_COLOR
              }
              styles={
                styles
              }
            />

            <LegendItem
              title="Absent"
              color={
                ABSENT_COLOR
              }
              styles={
                styles
              }
            />

            <LegendItem
              title="Queue"
              color={
                QUEUE_COLOR
              }
              styles={
                styles
              }
            />

            <LegendItem
              title="Upcoming"
              color={
                UPCOMING_COLOR
              }
              styles={
                styles
              }
            />
          </View>
        </View>
      ) : (
        /* ================================================= */
        /* SEMESTER */
        /* ================================================= */

        <View
          style={
            styles.semesterCard
          }
        >
          <View
            style={
              styles.semesterHeader
            }
          >
            <View
              style={
                styles.semesterHeaderIcon
              }
            >
              <Ionicons
                name="calendar-outline"
                size={19}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.semesterHeaderText
              }
            >
              <Text
                style={
                  styles.semesterTitle
                }
              >
                Semester attendance
              </Text>

              <Text
                style={
                  styles.semesterSubtitle
                }
              >
                Review attendance across the semester.
              </Text>
            </View>
          </View>

          <View
            style={
              styles.semesterOptions
            }
          >
            <Pressable
              onPress={() =>
                setSemester(1)
              }
              style={[
                styles.semesterOption,

                semester ===
                  1 &&
                  styles.semesterOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.semesterOptionTitle,

                  semester ===
                    1 &&
                    styles.semesterOptionTitleActive,
                ]}
              >
                Semester 1
              </Text>

              <Text
                style={
                  styles.semesterOptionSub
                }
              >
                September – December
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                setSemester(2)
              }
              style={[
                styles.semesterOption,

                semester ===
                  2 &&
                  styles.semesterOptionActive,
              ]}
            >
              <Text
                style={[
                  styles.semesterOptionTitle,

                  semester ===
                    2 &&
                    styles.semesterOptionTitleActive,
                ]}
              >
                Semester 2
              </Text>

              <Text
                style={
                  styles.semesterOptionSub
                }
              >
                January – August
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ================================================= */}
      {/* SUMMARY */}
      {/* ================================================= */}

      <View
        style={
          styles.summaryCard
        }
      >
        <AttendanceDonut
          present={
            stats.present
          }
          absent={
            stats.absent
          }
          pending={
            stats.pending
          }
          percentage={
            stats.percentage
          }
          colors={
            colors
          }
        />

        <View
          style={
            styles.summaryRight
          }
        >
          <View
            style={
              styles.summaryHeader
            }
          >
            <View>
              <Text
                style={
                  styles.summaryTitle
                }
              >
                Attendance summary
              </Text>

              <Text
                style={
                  styles.summarySubtitle
                }
              >
                {mode ===
                'month'
                  ? viewMonth
                      .toLocaleDateString(
                        undefined,
                        {
                          month:
                            'long',

                          year:
                            'numeric',
                        },
                      )
                  : semester ===
                      1
                    ? 'Semester 1'
                    : 'Semester 2'}
              </Text>
            </View>

            <View
              style={
                styles.totalBadge
              }
            >
              <Text
                style={
                  styles.totalBadgeNumber
                }
              >
                {stats.total}
              </Text>

              <Text
                style={
                  styles.totalBadgeLabel
                }
              >
                days
              </Text>
            </View>
          </View>

          <View
            style={
              styles.summaryRows
            }
          >
            <SummaryRow
              title="Present"
              value={
                stats.present
              }
              color={
                PRESENT_COLOR
              }
              styles={
                styles
              }
            />

            <SummaryRow
              title="Absent"
              value={
                stats.absent
              }
              color={
                ABSENT_COLOR
              }
              styles={
                styles
              }
            />

            <SummaryRow
              title="Queue"
              value={
                stats.pending
              }
              color={
                QUEUE_COLOR
              }
              styles={
                styles
              }
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/*
 * =========================================================
 * NORMAL DONUT
 * =========================================================
 *
 * No fake slices.
 * No gaps.
 * No rounded ends.
 *
 * Just a normal proportional donut.
 */

const AttendanceDonut =
  memo(
    function AttendanceDonut({
      present,
      absent,
      pending,
      percentage,
      colors,
    }: {
      present: number;
      absent: number;
      pending: number;
      percentage: number;
      colors: AppThemeColors;
    }) {
      const SIZE =
        112;

      const CENTER =
        SIZE / 2;

      const RADIUS =
        39;

      const STROKE =
        16;

      const circumference =
        2 *
        Math.PI *
        RADIUS;

      const total =
        present +
        absent +
        pending;

      const segments =
        useMemo(
          () => {
            if (
              total === 0
            ) {
              return [];
            }

            return [
              {
                key:
                  'present',

                value:
                  present,

                color:
                  PRESENT_COLOR,
              },

              {
                key:
                  'absent',

                value:
                  absent,

                color:
                  ABSENT_COLOR,
              },

              {
                key:
                  'pending',

                value:
                  pending,

                color:
                  QUEUE_COLOR,
              },
            ].filter(
              item =>
                item.value >
                0,
            );
          },
          [
            absent,
            pending,
            present,
            total,
          ],
        );

      let accumulated =
        0;

      return (
        <View
          style={
            donutStyles.wrapper
          }
        >
          <Svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
          >
            {/* BACKGROUND */}

            <Circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={
                EMPTY_RING_COLOR
              }
              strokeWidth={
                STROKE
              }
            />

            {/* SEGMENTS */}

            {segments.map(
              segment => {
                const length =
                  (
                    segment.value /
                    total
                  ) *
                  circumference;

                const offset =
                  -accumulated;

                accumulated +=
                  length;

                return (
                  <Circle
                    key={
                      segment.key
                    }
                    cx={CENTER}
                    cy={CENTER}
                    r={RADIUS}
                    fill="none"
                    stroke={
                      segment.color
                    }
                    strokeWidth={
                      STROKE
                    }
                    strokeLinecap="butt"
                    strokeDasharray={`${length} ${circumference - length}`}
                    strokeDashoffset={
                      offset
                    }
                    transform={`rotate(-90 ${CENTER} ${CENTER})`}
                  />
                );
              },
            )}
          </Svg>

          <View
            pointerEvents="none"
            style={
              donutStyles.center
            }
          >
            <Text
              style={[
                donutStyles.percentage,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              {percentage}%
            </Text>

            <Text
              style={[
                donutStyles.label,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Present
            </Text>
          </View>
        </View>
      );
    },
  );

/*
 * =========================================================
 * SUMMARY ROW
 * =========================================================
 */

function SummaryRow({
  title,
  value,
  color,
  styles,
}: {
  title: string;
  value: number;
  color: string;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.summaryRow
      }
    >
      <View
        style={[
          styles.summaryIndicator,

          {
            backgroundColor:
              color,
          },
        ]}
      />

      <Text
        style={
          styles.summaryRowTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.summaryRowValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * STATUS
 * =========================================================
 */

function StatusPill({
  status,
  styles,
}: {
  status:
    AttendanceStatus | null;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  let background =
    '#F1F4F8';

  let dot =
    UPCOMING_COLOR;

  if (
    status === 'present'
  ) {
    background =
      PRESENT_SOFT;

    dot =
      PRESENT_COLOR;
  }

  if (
    status === 'absent'
  ) {
    background =
      ABSENT_SOFT;

    dot =
      ABSENT_COLOR;
  }

  if (
    status === 'pending'
  ) {
    background =
      QUEUE_SOFT;

    dot =
      QUEUE_COLOR;
  }

  return (
    <View
      style={[
        styles.statusPill,

        {
          backgroundColor:
            background,
        },
      ]}
    >
      {status ? (
        <View
          style={[
            styles.statusDot,

            {
              backgroundColor:
                dot,
            },
          ]}
        />
      ) : null}

      <Text
        style={
          styles.statusText
        }
      >
        {statusName(
          status,
        )}
      </Text>
    </View>
  );
}

/*
 * =========================================================
 * LEGEND
 * =========================================================
 */

function LegendItem({
  title,
  color,
  styles,
}: {
  title: string;
  color: string;

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

          {
            backgroundColor:
              color,
          },
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

/*
 * =========================================================
 * DONUT STYLES
 * =========================================================
 */

const donutStyles =
  StyleSheet.create({
    wrapper: {
      width: 112,
      height: 112,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    center: {
      position:
        'absolute',

      width: 56,
      height: 56,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    percentage: {
      fontSize: 17,

      lineHeight: 20,

      fontWeight:
        '800',

      letterSpacing:
        -0.4,
    },

    label: {
      marginTop: 1,

      fontSize: 6.5,

      fontWeight:
        '600',
    },
  });

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
      paddingHorizontal: 8,
      paddingTop: 12,
      paddingBottom: 125,
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
      marginTop: 9,

      fontSize: 11,

      color:
        colors.textMuted,
    },

    title: {
      fontSize: 21,

      fontWeight:
        '800',

      letterSpacing:
        -0.5,

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 2,

      fontSize: 9.5,

      color:
        colors.textMuted,
    },

    segment: {
      height: 43,

      marginTop: 16,

      padding: 3,

      flexDirection:
        'row',

      borderRadius: 14,

      backgroundColor:
        colors.surfaceSecondary,
    },

    segmentButton: {
      flex: 1,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 11,
    },

    segmentButtonActive: {
      backgroundColor:
        colors.primary,
    },

    segmentText: {
      fontSize: 10.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    segmentTextActive: {
      color:
        '#FFFFFF',

      fontWeight:
        '700',
    },

    calendarCard: {
      marginTop: 10,

      paddingHorizontal: 9,
      paddingTop: 10,
      paddingBottom: 10,

      borderRadius: 19,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    monthHeader: {
      height: 46,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    arrowButton: {
      width: 34,
      height: 34,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 11,

      backgroundColor:
        colors.surfaceSecondary,
    },

    arrowDisabled: {
      opacity: 0.28,
    },

    monthCenter: {
      alignItems:
        'center',
    },

    monthName: {
      fontSize: 15,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    monthYear: {
      marginTop: 1,

      fontSize: 8,

      color:
        colors.textMuted,
    },

    weekRow: {
      marginTop: 2,
      marginBottom: 5,

      flexDirection:
        'row',
    },

    weekDay: {
      width:
        '14.2857%',

      textAlign:
        'center',

      fontSize: 7.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    calendarGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',
    },

    daySlot: {
      width:
        '14.2857%',

      height: 43,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    dayTile: {
      width: 35,
      height: 35,

      borderRadius: 11,

      borderWidth: 1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    normalDay: {
      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    presentDay: {
      borderColor:
        PRESENT_BORDER,

      backgroundColor:
        PRESENT_SOFT,
    },

    presentDayText: {
      color:
        PRESENT_TEXT,
    },

    absentDay: {
      borderColor:
        ABSENT_BORDER,

      backgroundColor:
        ABSENT_SOFT,
    },

    absentDayText: {
      color:
        ABSENT_TEXT,
    },

    pendingDay: {
      borderColor:
        QUEUE_BORDER,

      backgroundColor:
        QUEUE_SOFT,
    },

    pendingDayText: {
      color:
        QUEUE_TEXT,
    },

    futureDay: {
      borderColor:
        '#E2E8EF',

      backgroundColor:
        UPCOMING_SOFT,
    },

    futureDayText: {
      color:
        '#B8C3CF',
    },

    selectedDay: {
      borderWidth: 2,

      borderColor:
        colors.primary,
    },

    selectedDayText: {
      fontWeight:
        '800',
    },

    dayText: {
      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    selectedRow: {
      marginTop: 8,

      paddingTop: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderTopWidth: 1,

      borderTopColor:
        colors.border,
    },

    selectedLabel: {
      fontSize: 7.5,

      color:
        colors.textMuted,
    },

    selectedDate: {
      marginTop: 2,

      fontSize: 10,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    statusPill: {
      minHeight: 28,

      paddingHorizontal: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,

      borderRadius: 10,
    },

    statusDot: {
      width: 5,
      height: 5,

      borderRadius: 3,
    },

    statusText: {
      fontSize: 8,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    legendRow: {
      marginTop: 12,

      paddingTop: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      borderTopWidth: 1,

      borderTopColor:
        colors.border,
    },

    legendItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 4,
    },

    legendDot: {
      width: 5,
      height: 5,

      borderRadius: 3,
    },

    legendText: {
      fontSize: 6.8,

      color:
        colors.textMuted,
    },

    semesterCard: {
      marginTop: 10,

      padding: 14,

      borderRadius: 19,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    semesterHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    semesterHeaderIcon: {
      width: 38,
      height: 38,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 12,

      backgroundColor:
        colors.primarySoft,
    },

    semesterHeaderText: {
      flex: 1,

      marginLeft: 10,
    },

    semesterTitle: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    semesterSubtitle: {
      marginTop: 2,

      fontSize: 8,

      color:
        colors.textMuted,
    },

    semesterOptions: {
      marginTop: 13,

      flexDirection:
        'row',

      gap: 8,
    },

    semesterOption: {
      flex: 1,

      minHeight: 61,

      padding: 10,

      justifyContent:
        'center',

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    semesterOptionActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    semesterOptionTitle: {
      fontSize: 10,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    semesterOptionTitleActive: {
      color:
        colors.primary,
    },

    semesterOptionSub: {
      marginTop: 3,

      fontSize: 7.5,

      color:
        colors.textMuted,
    },

    /*
     * SUMMARY
     */

    summaryCard: {
      minHeight: 135,

      marginTop: 11,

      paddingHorizontal: 12,
      paddingVertical: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 19,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    summaryRight: {
      flex: 1,

      minWidth: 0,

      marginLeft: 9,
    },

    summaryHeader: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      justifyContent:
        'space-between',
    },

    summaryTitle: {
      fontSize: 11.5,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    summarySubtitle: {
      marginTop: 2,

      fontSize: 7.5,

      color:
        colors.textMuted,
    },

    totalBadge: {
      minWidth: 34,

      marginLeft: 5,

      paddingHorizontal: 6,
      paddingVertical: 5,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 10,

      backgroundColor:
        colors.surfaceSecondary,
    },

    totalBadgeNumber: {
      fontSize: 10,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    totalBadgeLabel: {
      marginTop: 1,

      fontSize: 6.3,

      color:
        colors.textMuted,
    },

    summaryRows: {
      marginTop: 10,

      gap: 7,
    },

    summaryRow: {
      minHeight: 23,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    summaryIndicator: {
      width: 8,
      height: 8,

      borderRadius: 2,
    },

    summaryRowTitle: {
      flex: 1,

      marginLeft: 7,

      fontSize: 9,

      fontWeight:
        '600',

      color:
        colors.textSecondary,
    },

    summaryRowValue: {
      marginLeft: 8,

      fontSize: 10,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    errorCard: {
      marginTop: 10,

      padding: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,

      borderRadius: 13,

      backgroundColor:
        ABSENT_SOFT,
    },

    errorText: {
      flex: 1,

      fontSize: 9,

      color:
        ABSENT_TEXT,
    },
  });
}