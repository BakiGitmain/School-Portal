import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  router,
  type Href,
  useFocusEffect,
} from 'expo-router';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  supabase,
} from '../../../lib/supabase';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

import {
  buildPeriodSlots,
  formatMinute,
  getTimeDisplayLabel,
  WEEK_DAYS,
  type TimeDisplay,
  type TimetableBreak,
} from '../../timetable/time';

type Props = {
  classId: string;

  versionId: string;
};

type Entry = {
  teacher_user_id:
    string;

  subject:
    string;

  day_of_week:
    number;

  period_index:
    number;

  start_minute:
    number;

  end_minute:
    number;
};

type DisplayEntry = Entry & {
  teacherName:
    string;
};

type Snapshot = {
  active_days?:
    number[];

  start_minute?:
    number;

  periods_per_day?:
    number;

  period_minutes?:
    number;

  time_display?:
    TimeDisplay;

  breaks?:
    TimetableBreak[];
};

const DAY_WIDTH =
  86;

const CELL_WIDTH =
  142;

const HEADER_HEIGHT =
  78;

const ROW_HEIGHT =
  88;

export default function ClassTimetableScreen({
  classId,
  versionId,
}: Props) {
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
      string |
      null
    >(
      null,
    );

  const [
    className,
    setClassName,
  ] =
    useState(
      'Class',
    );

  const [
    versionStatus,
    setVersionStatus,
  ] =
    useState(
      'draft',
    );

  const [
    snapshot,
    setSnapshot,
  ] =
    useState<
      Snapshot
    >({});

  const [
    entries,
    setEntries,
  ] =
    useState<
      DisplayEntry[]
    >([]);

  const loadPage =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          if (
            !classId ||
            !versionId
          ) {
            throw new Error(
              'This timetable link is invalid.',
            );
          }

          const [
            classResult,
            versionResult,
            entriesResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'school_classes',
                )
                .select(`
                  id,
                  class_name,
                  grade_label,
                  section
                `)
                .eq(
                  'id',
                  classId,
                )
                .single(),

              supabase
                .from(
                  'timetable_versions',
                )
                .select(`
                  id,
                  status,
                  config_snapshot
                `)
                .eq(
                  'id',
                  versionId,
                )
                .single(),

              supabase
                .from(
                  'timetable_entries',
                )
                .select(`
                  teacher_user_id,
                  subject,
                  day_of_week,
                  period_index,
                  start_minute,
                  end_minute
                `)
                .eq(
                  'version_id',
                  versionId,
                )
                .eq(
                  'class_id',
                  classId,
                ),
            ]);

          if (
            classResult.error
          ) {
            throw classResult.error;
          }

          if (
            versionResult.error
          ) {
            throw versionResult.error;
          }

          if (
            entriesResult.error
          ) {
            throw entriesResult.error;
          }

          const classroom =
            classResult.data;

          setClassName(
            String(
              classroom.class_name ??
              classroom.grade_label ??
              'Class',
            ),
          );

          setVersionStatus(
            String(
              versionResult.data.status,
            ),
          );

          const rawSnapshot =
            (
              versionResult.data
                .config_snapshot ??
              {}
            ) as
              Record<
                string,
                unknown
              >;

          const nextSnapshot:
            Snapshot =
            {
              active_days:
                Array.isArray(
                  rawSnapshot.active_days,
                )
                  ? rawSnapshot.active_days.map(
                      Number,
                    )
                  : [
                      1,
                      2,
                      3,
                      4,
                      5,
                    ],

              start_minute:
                Number(
                  rawSnapshot.start_minute ??
                  480,
                ),

              periods_per_day:
                Number(
                  rawSnapshot.periods_per_day ??
                  7,
                ),

              period_minutes:
                Number(
                  rawSnapshot.period_minutes ??
                  45,
                ),

              time_display:
                (
                  rawSnapshot.time_display ??
                  '12h'
                ) as
                  TimeDisplay,

              breaks:
                Array.isArray(
                  rawSnapshot.breaks,
                )
                  ? (
                      rawSnapshot.breaks as
                        TimetableBreak[]
                    )
                  : [],
            };

          setSnapshot(
            nextSnapshot,
          );

          const entryRows =
            (
              entriesResult.data ??
              []
            ) as
              Entry[];

          const teacherIds =
            [
              ...new Set(
                entryRows.map(
                  item =>
                    String(
                      item.teacher_user_id,
                    ),
                ),
              ),
            ];

          let teacherMap =
            new Map<
              string,
              string
            >();

          if (
            teacherIds.length >
            0
          ) {
            const {
              data:
                teacherRows,

              error:
                teacherError,
            } =
              await supabase
                .from(
                  'profiles',
                )
                .select(`
                  user_id,
                  full_name
                `)
                .in(
                  'user_id',
                  teacherIds,
                );

            if (
              teacherError
            ) {
              throw teacherError;
            }

            teacherMap =
              new Map(
                (
                  teacherRows ??
                  []
                ).map(
                  teacher => [
                    String(
                      teacher.user_id,
                    ),

                    String(
                      teacher.full_name ??
                      'Teacher',
                    ),
                  ],
                ),
              );
          }

          setEntries(
            entryRows.map(
              item => ({
                ...item,

                teacherName:
                  teacherMap.get(
                    String(
                      item.teacher_user_id,
                    ),
                  ) ??
                  'Teacher',
              }),
            ),
          );
        } catch (
          loadError
        ) {
          console.log(
            'CLASS TIMETABLE:',
            loadError,
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Could not load timetable.',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        classId,
        versionId,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadPage();
      },
      [
        loadPage,
      ],
    ),
  );

  const activeDays =
    snapshot.active_days ??
    [
      1,
      2,
      3,
      4,
      5,
    ];

  const periodsPerDay =
    snapshot.periods_per_day ??
    7;

  const timeDisplay =
    snapshot.time_display ??
    '12h';

  const plan =
    useMemo(
      () =>
        buildPeriodSlots({
          startMinute:
            snapshot.start_minute ??
            480,

          periodsPerDay,

          periodMinutes:
            snapshot.period_minutes ??
            45,

          breaks:
            snapshot.breaks ??
            [],
        }),
      [
        snapshot.start_minute,
        snapshot.period_minutes,
        snapshot.breaks,
        periodsPerDay,
      ],
    );

  function findEntry(
    day:
      number,

    period:
      number,
  ) {
    return entries.find(
      item =>
        Number(
          item.day_of_week,
        ) ===
          day &&
        Number(
          item.period_index,
        ) ===
          period,
    );
  }

  function breakAfter(
    period:
      number,
  ) {
    return plan.breaks.find(
      item =>
        item.afterPeriod ===
        period,
    );
  }

  if (
    loading
  ) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          styles.center,
        ]}
      >
        <ActivityIndicator
          color={
            colors.primary
          }
        />

        <Text
          style={
            styles.loading
          }
        >
          Loading {className}...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    error
  ) {
    return (
      <SafeAreaView
        style={[
          styles.screen,
          styles.center,
        ]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={34}
          color={
            colors.primary
          }
        />

        <Text
          style={
            styles.errorTitle
          }
        >
          Could not open schedule
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          {error}
        </Text>

        <Pressable
          onPress={() =>
            router.replace(
              '/admin/more/timetable' as Href,
            )
          }
          style={
            styles.backMain
          }
        >
          <Text
            style={
              styles.backMainText
            }
          >
            Go Back
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.screen
      }
    >
      {/* HEADER */}

      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={() =>
            router.replace(
              '/admin/more/timetable' as Href,
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

        <View
          style={{
            flex:
              1,
          }}
        >
          <Text
            style={
              styles.title
            }
          >
            {className}
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Weekly Class Schedule
          </Text>
        </View>

        <View
          style={[
            styles.status,

            versionStatus ===
              'published' &&
              styles.statusLive,
          ]}
        >
          <Text
            style={[
              styles.statusText,

              versionStatus ===
                'published' && {
                color:
                  '#15803D',
              },
            ]}
          >
            {versionStatus ===
              'published'
              ? 'LIVE'
              : 'DRAFT'}
          </Text>
        </View>
      </View>

      {/* INFO */}

      <View
        style={
          styles.infoCard
        }
      >
        <View
          style={
            styles.infoItem
          }
        >
          <Ionicons
            name="calendar-outline"
            size={18}
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.infoText
            }
          >
            {activeDays.length} school days
          </Text>
        </View>

        <View
          style={
            styles.infoItem
          }
        >
          <Ionicons
            name="time-outline"
            size={18}
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.infoText
            }
          >
            {getTimeDisplayLabel(
              timeDisplay,
            )}
          </Text>
        </View>

        <View
          style={
            styles.infoItem
          }
        >
          <Ionicons
            name="list-outline"
            size={18}
            color={
              colors.primary
            }
          />

          <Text
            style={
              styles.infoText
            }
          >
            {periodsPerDay} periods
          </Text>
        </View>
      </View>

      <Text
        style={
          styles.swipeHint
        }
      >
        Swipe left/right to see all periods →
      </Text>

      {/* TABLE */}

      <ScrollView
        style={{
          flex:
            1,
        }}
        contentContainerStyle={
          styles.verticalContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View
          style={
            styles.tableCard
          }
        >
          <View
            style={
              styles.tableLayout
            }
          >
            {/* FIXED DAY COLUMN */}

            <View
              style={{
                width:
                  DAY_WIDTH,
              }}
            >
              <View
                style={[
                  styles.dayHeaderCell,

                  {
                    height:
                      HEADER_HEIGHT,
                  },
                ]}
              >
                <Text
                  style={
                    styles.dayHeaderText
                  }
                >
                  DAY
                </Text>
              </View>

              {WEEK_DAYS.map(
                day => {
                  const active =
                    activeDays.includes(
                      day.id,
                    );

                  return (
                    <View
                      key={
                        day.id
                      }
                      style={[
                        styles.dayCell,

                        {
                          height:
                            ROW_HEIGHT,
                        },

                        !active &&
                          styles.inactiveDay,
                      ]}
                    >
                      <Text
                        style={
                          styles.dayName
                        }
                      >
                        {day.short}
                      </Text>

                      <Text
                        style={
                          styles.dayFull
                        }
                      >
                        {day.label}
                      </Text>
                    </View>
                  );
                },
              )}
            </View>

            {/* PERIOD COLUMNS */}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              bounces
            >
              <View>
                {/* COLUMN HEADERS */}

                <View
                  style={
                    styles.periodHeaderRow
                  }
                >
                  {plan.slots.map(
                    slot => {
                      const afterBreak =
                        breakAfter(
                          slot.periodIndex,
                        );

                      return (
                        <View
                          key={
                            slot.periodIndex
                          }
                          style={[
                            styles.periodHeaderCell,

                            {
                              width:
                                CELL_WIDTH,

                              height:
                                HEADER_HEIGHT,
                            },
                          ]}
                        >
                          <Text
                            style={
                              styles.periodHeaderTitle
                            }
                          >
                            P{slot.periodIndex}
                          </Text>

                          <Text
                            style={
                              styles.periodHeaderTime
                            }
                          >
                            {formatMinute(
                              slot.startMinute,
                              timeDisplay,
                            )}
                          </Text>

                          <Text
                            style={
                              styles.periodHeaderTime
                            }
                          >
                            {formatMinute(
                              slot.endMinute,
                              timeDisplay,
                            )}
                          </Text>

                          {afterBreak && (
                            <View
                              style={
                                styles.breakBadge
                              }
                            >
                              <Text
                                style={
                                  styles.breakBadgeText
                                }
                              >
                                {afterBreak.label} after
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    },
                  )}
                </View>

                {/* DAY ROWS */}

                {WEEK_DAYS.map(
                  day => {
                    const active =
                      activeDays.includes(
                        day.id,
                      );

                    return (
                      <View
                        key={
                          day.id
                        }
                        style={
                          styles.periodRow
                        }
                      >
                        {plan.slots.map(
                          slot => {
                            const lesson =
                              active
                                ? findEntry(
                                    day.id,
                                    slot.periodIndex,
                                  )
                                : undefined;

                            return (
                              <View
                                key={`${day.id}-${slot.periodIndex}`}
                                style={[
                                  styles.lessonCell,

                                  {
                                    width:
                                      CELL_WIDTH,

                                    height:
                                      ROW_HEIGHT,
                                  },

                                  !active &&
                                    styles.inactiveLesson,
                                ]}
                              >
                                {!active ? (
                                  <>
                                    <Ionicons
                                      name="moon-outline"
                                      size={18}
                                      color={
                                        colors.textMuted
                                      }
                                    />

                                    <Text
                                      style={
                                        styles.noSchoolText
                                      }
                                    >
                                      No School
                                    </Text>
                                  </>
                                ) : lesson ? (
                                  <>
                                    <Text
                                      numberOfLines={2}
                                      style={
                                        styles.subject
                                      }
                                    >
                                      {lesson.subject}
                                    </Text>

                                    <View
                                      style={
                                        styles.teacherRow
                                      }
                                    >
                                      <Ionicons
                                        name="person-outline"
                                        size={12}
                                        color={
                                          colors.textMuted
                                        }
                                      />

                                      <Text
                                        numberOfLines={1}
                                        style={
                                          styles.teacher
                                        }
                                      >
                                        {lesson.teacherName}
                                      </Text>
                                    </View>
                                  </>
                                ) : (
                                  <>
                                    <Text
                                      style={
                                        styles.free
                                      }
                                    >
                                      Free Period
                                    </Text>

                                    <Text
                                      style={
                                        styles.freeSmall
                                      }
                                    >
                                      No subject assigned
                                    </Text>
                                  </>
                                )}
                              </View>
                            );
                          },
                        )}
                      </View>
                    );
                  },
                )}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* BREAK DETAILS */}

        {plan.breaks.length >
          0 && (
          <View
            style={
              styles.breakCard
            }
          >
            <Text
              style={
                styles.breakTitle
              }
            >
              Break Times
            </Text>

            {plan.breaks.map(
              item => (
                <View
                  key={`${item.kind}-${item.afterPeriod}`}
                  style={
                    styles.breakRow
                  }
                >
                  <View
                    style={
                      styles.breakIcon
                    }
                  >
                    <Ionicons
                      name={
                        item.kind ===
                        'lunch'
                          ? 'restaurant-outline'
                          : 'cafe-outline'
                      }
                      size={18}
                      color="#A16207"
                    />
                  </View>

                  <View
                    style={{
                      flex:
                        1,
                    }}
                  >
                    <Text
                      style={
                        styles.breakName
                      }
                    >
                      {item.label}
                    </Text>

                    <Text
                      style={
                        styles.breakDescription
                      }
                    >
                      After Period {item.afterPeriod}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.breakTime
                    }
                  >
                    {formatMinute(
                      item.startMinute,
                      timeDisplay,
                    )}
                    {' - '}
                    {formatMinute(
                      item.endMinute,
                      timeDisplay,
                    )}
                  </Text>
                </View>
              ),
            )}
          </View>
        )}

        <View
          style={{
            height:
              70,
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

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

    center: {
      alignItems:
        'center',

      justifyContent:
        'center',

      padding:
        24,
    },

    loading: {
      marginTop:
        10,

      color:
        colors.textMuted,

      fontWeight:
        '600',
    },

    header: {
      minHeight:
        70,

      paddingHorizontal:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        11,

      borderBottomWidth:
        1,

      borderBottomColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    headerButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.surfaceSecondary,
    },

    title: {
      color:
        colors.text,

      fontSize:
        19,

      fontWeight:
        '900',
    },

    subtitle: {
      marginTop:
        2,

      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    status: {
      height:
        31,

      paddingHorizontal:
        10,

      borderRadius:
        10,

      backgroundColor:
        colors.primarySoft,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    statusLive: {
      backgroundColor:
        '#DCFCE7',
    },

    statusText: {
      color:
        colors.primary,

      fontSize:
        9,

      fontWeight:
        '900',
    },

    infoCard: {
      margin:
        14,

      padding:
        12,

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,

      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        12,
    },

    infoItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },

    infoText: {
      color:
        colors.textSecondary,

      fontSize:
        9,

      fontWeight:
        '700',
    },

    swipeHint: {
      marginHorizontal:
        15,

      marginBottom:
        8,

      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    verticalContent: {
      paddingHorizontal:
        12,
    },

    tableCard: {
      overflow:
        'hidden',

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    tableLayout: {
      flexDirection:
        'row',
    },

    dayHeaderCell: {
      borderRightWidth:
        1,

      borderBottomWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    dayHeaderText: {
      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '900',

      letterSpacing:
        0.8,
    },

    dayCell: {
      paddingHorizontal:
        8,

      borderRightWidth:
        1,

      borderBottomWidth:
        1,

      borderColor:
        colors.border,

      justifyContent:
        'center',

      backgroundColor:
        colors.card,
    },

    inactiveDay: {
      backgroundColor:
        colors.surfaceSecondary,
    },

    dayName: {
      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '900',
    },

    dayFull: {
      marginTop:
        2,

      color:
        colors.textMuted,

      fontSize:
        7,

      fontWeight:
        '600',
    },

    periodHeaderRow: {
      flexDirection:
        'row',
    },

    periodHeaderCell: {
      padding:
        7,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRightWidth:
        1,

      borderBottomWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    periodHeaderTitle: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '900',
    },

    periodHeaderTime: {
      marginTop:
        1,

      color:
        colors.textMuted,

      fontSize:
        7,

      fontWeight:
        '700',
    },

    breakBadge: {
      marginTop:
        4,

      paddingHorizontal:
        5,

      paddingVertical:
        2,

      borderRadius:
        5,

      backgroundColor:
        '#FFF3CD',
    },

    breakBadgeText: {
      color:
        '#A16207',

      fontSize:
        6,

      fontWeight:
        '800',
    },

    periodRow: {
      flexDirection:
        'row',
    },

    lessonCell: {
      padding:
        9,

      borderRightWidth:
        1,

      borderBottomWidth:
        1,

      borderColor:
        colors.border,

      justifyContent:
        'center',

      backgroundColor:
        colors.card,
    },

    inactiveLesson: {
      alignItems:
        'center',

      backgroundColor:
        colors.surfaceSecondary,
    },

    subject: {
      color:
        colors.text,

      fontSize:
        11,

      lineHeight:
        14,

      fontWeight:
        '900',
    },

    teacherRow: {
      marginTop:
        6,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        4,
    },

    teacher: {
      flex:
        1,

      color:
        colors.textMuted,

      fontSize:
        8,

      fontWeight:
        '600',
    },

    free: {
      color:
        colors.textMuted,

      fontSize:
        10,

      fontWeight:
        '800',
    },

    freeSmall: {
      marginTop:
        3,

      color:
        colors.textMuted,

      fontSize:
        7,

      fontWeight:
        '500',
    },

    noSchoolText: {
      marginTop:
        4,

      color:
        colors.textMuted,

      fontSize:
        8,

      fontWeight:
        '700',
    },

    breakCard: {
      marginTop:
        12,

      padding:
        13,

      borderRadius:
        16,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    breakTitle: {
      marginBottom:
        8,

      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '900',
    },

    breakRow: {
      minHeight:
        55,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    breakIcon: {
      width:
        36,

      height:
        36,

      borderRadius:
        11,

      backgroundColor:
        '#FFF8E7',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    breakName: {
      color:
        colors.text,

      fontSize:
        11,

      fontWeight:
        '900',
    },

    breakDescription: {
      marginTop:
        2,

      color:
        colors.textMuted,

      fontSize:
        8,

      fontWeight:
        '600',
    },

    breakTime: {
      color:
        '#A16207',

      fontSize:
        9,

      fontWeight:
        '800',
    },

    errorTitle: {
      marginTop:
        12,

      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    errorText: {
      marginTop:
        5,

      color:
        colors.textMuted,

      textAlign:
        'center',
    },

    backMain: {
      height:
        46,

      marginTop:
        18,

      paddingHorizontal:
        20,

      borderRadius:
        14,

      backgroundColor:
        colors.primary,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    backMainText: {
      color:
        '#FFFFFF',

      fontWeight:
        '900',
    },
  });
}