import React, {
  useCallback,
  useMemo,
  useState,
  type ComponentProps,
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

import Ionicons from '@expo/vector-icons/Ionicons';

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

type DateStatus =
  | 'exact'
  | 'estimated';

type EventType =
  | 'holiday'
  | 'meeting'
  | 'special_occasion'
  | 'other';

type CalendarEvent = {
  id: string;

  event_date: string;

  date_status:
    DateStatus;

  event_type:
    EventType;

  title: string;

  notes:
    string | null;

  is_closed:
    boolean;

  created_at:
    string;

  updated_at:
    string;
};

type IoniconName =
  ComponentProps<
    typeof Ionicons
  >['name'];

type EventTypeInfo = {
  title: string;

  icon:
    IoniconName;
};

/* =========================================================
 * CONSTANTS
 * ======================================================= */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/*
 * The viewer stays inside one calendar year.
 *
 * Students and teachers can switch months,
 * but cannot switch the year.
 */
const FIXED_YEAR =
  new Date().getFullYear();

/* =========================================================
 * DATE HELPERS
 * ======================================================= */

function pad2(
  value:
    number,
) {
  return String(
    value,
  ).padStart(
    2,
    '0',
  );
}

function dateKey(
  date:
    Date,
) {
  return `${date.getFullYear()}-${pad2(
    date.getMonth() + 1,
  )}-${pad2(
    date.getDate(),
  )}`;
}

function dateFromKey(
  value:
    string,
) {
  const [
    year,
    month,
    day,
  ] =
    value
      .split('-')
      .map(Number);

  return new Date(
    year,
    month - 1,
    day,
  );
}

function monthRange(
  year:
    number,
  month:
    number,
) {
  const first =
    new Date(
      year,
      month,
      1,
    );

  const last =
    new Date(
      year,
      month + 1,
      0,
    );

  return {
    first:
      dateKey(
        first,
      ),

    last:
      dateKey(
        last,
      ),
  };
}

function getDayNumber(
  value:
    string,
) {
  return dateFromKey(
    value,
  ).getDate();
}

function getWeekday(
  value:
    string,
) {
  return dateFromKey(
    value,
  )
    .toLocaleDateString(
      undefined,
      {
        weekday:
          'short',
      },
    )
    .toUpperCase();
}

function fullDate(
  value:
    string,
) {
  return dateFromKey(
    value,
  ).toLocaleDateString(
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

/* =========================================================
 * EVENT HELPERS
 * ======================================================= */

function getEventInfo(
  type:
    EventType,
): EventTypeInfo {
  if (
    type ===
    'holiday'
  ) {
    return {
      title:
        'Holiday',

      icon:
        'sunny-outline',
    };
  }

  if (
    type ===
    'meeting'
  ) {
    return {
      title:
        'Meeting',

      icon:
        'people-outline',
    };
  }

  if (
    type ===
    'special_occasion'
  ) {
    return {
      title:
        'Special Occasion',

      icon:
        'star-outline',
    };
  }

  return {
    title:
      'Other',

    icon:
      'information-circle-outline',
  };
}

/* =========================================================
 * SCREEN
 * ======================================================= */

export default function SchoolCalendarViewerScreen() {
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

  const currentDate =
    useMemo(
      () =>
        new Date(),
      [],
    );

  /*
   * If we're inside FIXED_YEAR,
   * start at the current month.
   *
   * Otherwise start January.
   */
  const startingMonth =
    currentDate.getFullYear() ===
    FIXED_YEAR
      ? currentDate.getMonth()
      : 0;

  const [
    selectedMonth,
    setSelectedMonth,
  ] =
    useState(
      startingMonth,
    );

  const [
    events,
    setEvents,
  ] =
    useState<
      CalendarEvent[]
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

  /*
   * =====================================================
   * LOAD MONTH
   * =====================================================
   */

  const loadEvents =
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

          const range =
            monthRange(
              FIXED_YEAR,
              selectedMonth,
            );

          const {
            data,
            error:
              loadError,
          } =
            await supabase
              .from(
                'school_calendar_events',
              )
              .select(`
                id,
                event_date,
                date_status,
                event_type,
                title,
                notes,
                is_closed,
                created_at,
                updated_at
              `)
              .gte(
                'event_date',
                range.first,
              )
              .lte(
                'event_date',
                range.last,
              )
              .order(
                'event_date',
                {
                  ascending:
                    true,
                },
              );

          if (
            loadError
          ) {
            throw loadError;
          }

          setEvents(
            (
              data ??
              []
            ) as CalendarEvent[],
          );
        } catch (
          loadError
        ) {
          console.log(
            'LOAD SCHOOL CALENDAR VIEWER ERROR:',
            loadError,
          );

          setEvents(
            [],
          );

          setError(
            loadError instanceof
            Error
              ? loadError.message
              : 'Could not load school calendar.',
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
        selectedMonth,
      ],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadEvents();
      },
      [
        loadEvents,
      ],
    ),
  );

  /*
   * =====================================================
   * MONTH CONTROL
   * =====================================================
   */

  const canGoPrevious =
    selectedMonth >
    0;

  const canGoNext =
    selectedMonth <
    11;

  function previousMonth() {
    if (
      !canGoPrevious
    ) {
      return;
    }

    setSelectedMonth(
      current =>
        current - 1,
    );
  }

  function nextMonth() {
    if (
      !canGoNext
    ) {
      return;
    }

    setSelectedMonth(
      current =>
        current + 1,
    );
  }

  function goToCurrentMonth() {
    if (
      currentDate.getFullYear() !==
      FIXED_YEAR
    ) {
      return;
    }

    setSelectedMonth(
      currentDate.getMonth(),
    );
  }

  const isCurrentMonth =
    currentDate.getFullYear() ===
      FIXED_YEAR &&
    currentDate.getMonth() ===
      selectedMonth;

  /*
   * =====================================================
   * UI
   * =====================================================
   */

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
              void loadEvents(
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
        {/* ================================================= */}
        {/* BACK */}
        {/* ================================================= */}

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

        {/* ================================================= */}
        {/* TITLE */}
        {/* ================================================= */}

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
            School Calendar
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Important school dates and closures.
          </Text>
        </View>

        {/* ================================================= */}
        {/* MONTH + YEAR */}
        {/* ================================================= */}

        <View
          style={
            styles.calendarHeaderCard
          }
        >
          <View
            style={
              styles.monthArea
            }
          >
            <Pressable
              disabled={
                !canGoPrevious
              }
              onPress={
                previousMonth
              }
              style={({
                pressed,
              }) => [
                styles.monthArrow,

                !canGoPrevious &&
                  styles.arrowDisabled,

                pressed &&
                  canGoPrevious &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={21}
                color={
                  canGoPrevious
                    ? colors.text
                    : colors.textMuted
                }
              />
            </Pressable>

            <View
              style={
                styles.monthTextArea
              }
            >
              <Text
                style={
                  styles.monthName
                }
              >
                {
                  MONTHS[
                    selectedMonth
                  ]
                }
              </Text>

              {isCurrentMonth ? (
                <Text
                  style={
                    styles.currentMonthText
                  }
                >
                  Current month
                </Text>
              ) : (
                <Text
                  style={
                    styles.monthHelper
                  }
                >
                  School calendar
                </Text>
              )}
            </View>

            <Pressable
              disabled={
                !canGoNext
              }
              onPress={
                nextMonth
              }
              style={({
                pressed,
              }) => [
                styles.monthArrow,

                !canGoNext &&
                  styles.arrowDisabled,

                pressed &&
                  canGoNext &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={21}
                color={
                  canGoNext
                    ? colors.text
                    : colors.textMuted
                }
              />
            </Pressable>
          </View>

          {/* YEAR IS DISPLAY ONLY */}

          <View
            style={
              styles.yearBox
            }
          >
            <Ionicons
              name="lock-closed-outline"
              size={14}
              color={
                colors.textMuted
              }
            />

            <Text
              style={
                styles.yearText
              }
            >
              {
                FIXED_YEAR
              }
            </Text>
          </View>
        </View>

        {!isCurrentMonth &&
        currentDate.getFullYear() ===
          FIXED_YEAR ? (
          <Pressable
            onPress={
              goToCurrentMonth
            }
            style={({
              pressed,
            }) => [
              styles.currentMonthButton,

              pressed &&
                styles.pressed,
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
              style={
                styles.currentMonthButtonText
              }
            >
              Current month
            </Text>
          </Pressable>
        ) : null}

        {/* ================================================= */}
        {/* MONTH TITLE */}
        {/* ================================================= */}

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
              {
                MONTHS[
                  selectedMonth
                ]
              }{' '}
              events
            </Text>

            <Text
              style={
                styles.sectionSubtitle
              }
            >
              Special dates announced by the school
            </Text>
          </View>

          {!loading ? (
            <View
              style={
                styles.countBadge
              }
            >
              <Text
                style={
                  styles.countText
                }
              >
                {
                  events.length
                }
              </Text>
            </View>
          ) : null}
        </View>

        {/* ================================================= */}
        {/* ERROR */}
        {/* ================================================= */}

        {error ? (
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
                size={21}
                color={
                  colors.danger
                }
              />
            </View>

            <View
              style={
                styles.errorTextArea
              }
            >
              <Text
                style={
                  styles.errorTitle
                }
              >
                Calendar unavailable
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
                void loadEvents()
              }
              style={({
                pressed,
              }) => [
                styles.retryButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="refresh"
                size={18}
                color={
                  colors.primary
                }
              />
            </Pressable>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* LOADING */}
        {/* ================================================= */}

        {loading ? (
          <View
            style={
              styles.loadingCard
            }
          >
            <ActivityIndicator
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading calendar...
            </Text>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* EMPTY MONTH */}
        {/* ================================================= */}

        {!loading &&
        !error &&
        events.length ===
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
                name="calendar-clear-outline"
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
              No special dates
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              There are no school events or closures for{' '}
              {
                MONTHS[
                  selectedMonth
                ]
              }.
            </Text>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* EVENTS */}
        {/* ================================================= */}

        {!loading &&
          !error &&
          events.map(
            (
              event,
            ) => (
              <CalendarEventCard
                key={
                  event.id
                }
                event={
                  event
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
      </ScrollView>
    </SafeAreaView>
  );
}

/* =========================================================
 * EVENT CARD
 *
 * This is intentionally a VIEW.
 * It is NOT clickable.
 * ======================================================= */

function CalendarEventCard({
  event,
  colors,
  styles,
}: {
  event:
    CalendarEvent;

  colors:
    AppThemeColors;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  const info =
    getEventInfo(
      event.event_type,
    );

  const note =
    event.notes
      ?.trim() ??
    '';

  return (
    <View
      style={
        styles.eventCard
      }
    >
      {/* DATE */}

      <View
        style={
          styles.dateBox
        }
      >
        <Text
          style={
            styles.dayNumber
          }
        >
          {
            getDayNumber(
              event.event_date,
            )
          }
        </Text>

        <Text
          style={
            styles.weekDay
          }
        >
          {
            getWeekday(
              event.event_date,
            )
          }
        </Text>
      </View>

      {/* CONTENT */}

      <View
        style={
          styles.eventContent
        }
      >
        <Text
          style={
            styles.eventTitle
          }
        >
          {
            event.title
          }
        </Text>

        <Text
          style={
            styles.eventDate
          }
        >
          {
            fullDate(
              event.event_date,
            )
          }
        </Text>

        {/* BADGES */}

        <View
          style={
            styles.badges
          }
        >
          {/* EVENT TYPE */}

          <View
            style={
              styles.typeBadge
            }
          >
            <Ionicons
              name={
                info.icon
              }
              size={13}
              color={
                colors.primary
              }
            />

            <Text
              style={
                styles.typeBadgeText
              }
            >
              {
                info.title
              }
            </Text>
          </View>

          {/* CLOSED / OPEN */}

          {event.is_closed ? (
            <View
              style={
                styles.closedBadge
              }
            >
              <View
                style={
                  styles.closedDot
                }
              />

              <Text
                style={
                  styles.closedText
                }
              >
                School Closed
              </Text>
            </View>
          ) : (
            <View
              style={
                styles.openBadge
              }
            >
              <View
                style={
                  styles.openDot
                }
              />

              <Text
                style={
                  styles.openText
                }
              >
                School Open
              </Text>
            </View>
          )}

          {/* ONLY SHOW WHEN ESTIMATED */}

          {event.date_status ===
          'estimated' ? (
            <View
              style={
                styles.estimatedBadge
              }
            >
              <Ionicons
                name="time-outline"
                size={12}
                color="#A86A00"
              />

              <Text
                style={
                  styles.estimatedText
                }
              >
                Estimated date
              </Text>
            </View>
          ) : null}
        </View>

        {/* OPTIONAL NOTE */}

        {note ? (
          <View
            style={
              styles.noteArea
            }
          >
            <Ionicons
              name="information-circle-outline"
              size={15}
              color={
                colors.textMuted
              }
            />

            <Text
              style={
                styles.noteText
              }
            >
              {note}
            </Text>
          </View>
        ) : null}
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

      paddingBottom: 135,
    },

    pressed: {
      opacity: 0.7,
    },

    /* BACK */

    backButton: {
      alignSelf:
        'flex-start',

      minHeight: 42,

      paddingHorizontal: 10,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 7,

      borderRadius: 12,

      backgroundColor:
        colors.surfaceSecondary,
    },

    backText: {
      fontSize: 13,

      fontWeight: '800',

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

      letterSpacing: -0.3,

      fontWeight: '800',

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 3,

      fontSize: 12,

      lineHeight: 17,

      fontWeight: '500',

      color:
        colors.textMuted,
    },

    /* MONTH HEADER */

    calendarHeaderCard: {
      minHeight: 83,

      paddingHorizontal: 12,

      flexDirection: 'row',

      alignItems: 'center',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    monthArea: {
      flex: 1,

      minWidth: 0,

      flexDirection: 'row',

      alignItems: 'center',
    },

    monthArrow: {
      width: 40,

      height: 40,

      alignItems: 'center',

      justifyContent: 'center',

      borderRadius: 13,

      backgroundColor:
        colors.surfaceSecondary,
    },

    arrowDisabled: {
      opacity: 0.35,
    },

    monthTextArea: {
      flex: 1,

      minWidth: 0,

      alignItems: 'center',

      justifyContent: 'center',

      paddingHorizontal: 6,
    },

    monthName: {
      fontSize: 17,

      lineHeight: 22,

      fontWeight: '800',

      color:
        colors.text,
    },

    currentMonthText: {
      marginTop: 2,

      fontSize: 9.5,

      fontWeight: '700',

      color:
        colors.primary,
    },

    monthHelper: {
      marginTop: 2,

      fontSize: 9.5,

      fontWeight: '600',

      color:
        colors.textMuted,
    },

    /* YEAR - NOT CLICKABLE */

    yearBox: {
      minWidth: 70,

      height: 40,

      marginLeft: 9,

      paddingHorizontal: 10,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent: 'center',

      gap: 5,

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    yearText: {
      fontSize: 12,

      fontWeight: '800',

      color:
        colors.textSecondary,
    },

    currentMonthButton: {
      alignSelf:
        'flex-start',

      minHeight: 34,

      marginTop: 8,

      paddingHorizontal: 10,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 5,

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    currentMonthButtonText: {
      fontSize: 10,

      fontWeight: '800',

      color:
        colors.primary,
    },

    /* SECTION */

    sectionHeader: {
      marginTop: 23,

      marginBottom: 10,

      paddingHorizontal: 2,

      flexDirection: 'row',

      alignItems: 'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize: 15,

      lineHeight: 20,

      fontWeight: '800',

      color:
        colors.text,
    },

    sectionSubtitle: {
      marginTop: 2,

      fontSize: 10,

      lineHeight: 14,

      fontWeight: '500',

      color:
        colors.textMuted,
    },

    countBadge: {
      minWidth: 30,

      height: 30,

      paddingHorizontal: 8,

      alignItems: 'center',

      justifyContent: 'center',

      borderRadius: 10,

      backgroundColor:
        colors.primarySoft,
    },

    countText: {
      fontSize: 11,

      fontWeight: '800',

      color:
        colors.primary,
    },

    /* LOADING */

    loadingCard: {
      minHeight: 150,

      alignItems: 'center',

      justifyContent: 'center',

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

      fontWeight: '600',

      color:
        colors.textMuted,
    },

    /* EMPTY */

    emptyCard: {
      minHeight: 170,

      paddingHorizontal: 25,

      alignItems: 'center',

      justifyContent: 'center',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    emptyIcon: {
      width: 54,

      height: 54,

      alignItems: 'center',

      justifyContent: 'center',

      borderRadius: 17,

      backgroundColor:
        colors.primarySoft,
    },

    emptyTitle: {
      marginTop: 12,

      fontSize: 15,

      fontWeight: '800',

      color:
        colors.text,
    },

    emptyText: {
      marginTop: 4,

      textAlign: 'center',

      fontSize: 11,

      lineHeight: 17,

      fontWeight: '500',

      color:
        colors.textMuted,
    },

    /* ERROR */

    errorCard: {
      minHeight: 80,

      padding: 12,

      flexDirection: 'row',

      alignItems: 'center',

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        '#F4CCD1',

      backgroundColor:
        '#FFF4F5',
    },

    errorIcon: {
      width: 40,

      height: 40,

      alignItems: 'center',

      justifyContent: 'center',

      borderRadius: 13,

      backgroundColor:
        '#FFE5E8',
    },

    errorTextArea: {
      flex: 1,

      minWidth: 0,

      marginHorizontal: 10,
    },

    errorTitle: {
      fontSize: 12,

      fontWeight: '800',

      color:
        colors.danger,
    },

    errorText: {
      marginTop: 2,

      fontSize: 10,

      lineHeight: 15,

      fontWeight: '500',

      color:
        colors.danger,
    },

    retryButton: {
      width: 38,

      height: 38,

      borderRadius: 12,

      alignItems: 'center',

      justifyContent: 'center',

      backgroundColor:
        colors.primarySoft,
    },

    /* EVENT CARD */

    eventCard: {
      minHeight: 130,

      marginBottom: 10,

      padding: 13,

      flexDirection: 'row',

      alignItems: 'flex-start',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    dateBox: {
      width: 56,

      minHeight: 68,

      paddingVertical: 8,

      alignItems: 'center',

      justifyContent: 'center',

      borderRadius: 16,

      backgroundColor:
        colors.primarySoft,
    },

    dayNumber: {
      fontSize: 23,

      lineHeight: 27,

      fontWeight: '800',

      color:
        colors.primary,
    },

    weekDay: {
      marginTop: 1,

      fontSize: 9,

      letterSpacing: 0.5,

      fontWeight: '800',

      color:
        colors.primary,
    },

    eventContent: {
      flex: 1,

      minWidth: 0,

      marginLeft: 12,
    },

    eventTitle: {
      fontSize: 15,

      lineHeight: 20,

      fontWeight: '800',

      color:
        colors.text,
    },

    eventDate: {
      marginTop: 2,

      fontSize: 10,

      lineHeight: 14,

      fontWeight: '600',

      color:
        colors.textMuted,
    },

    /* BADGES */

    badges: {
      marginTop: 9,

      flexDirection: 'row',

      flexWrap: 'wrap',

      gap: 5,
    },

    typeBadge: {
      minHeight: 27,

      paddingHorizontal: 8,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,

      borderRadius: 9,

      backgroundColor:
        colors.primarySoft,
    },

    typeBadgeText: {
      fontSize: 9.5,

      fontWeight: '800',

      color:
        colors.primary,
    },

    closedBadge: {
      minHeight: 27,

      paddingHorizontal: 8,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 5,

      borderRadius: 9,

      backgroundColor:
        '#FFF0F2',
    },

    closedDot: {
      width: 6,

      height: 6,

      borderRadius: 3,

      backgroundColor:
        '#E84D61',
    },

    closedText: {
      fontSize: 9.5,

      fontWeight: '800',

      color:
        '#D94256',
    },

    openBadge: {
      minHeight: 27,

      paddingHorizontal: 8,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 5,

      borderRadius: 9,

      backgroundColor:
        '#EAF8F2',
    },

    openDot: {
      width: 6,

      height: 6,

      borderRadius: 3,

      backgroundColor:
        '#25A36F',
    },

    openText: {
      fontSize: 9.5,

      fontWeight: '800',

      color:
        '#23845F',
    },

    estimatedBadge: {
      minHeight: 27,

      paddingHorizontal: 8,

      flexDirection: 'row',

      alignItems: 'center',

      gap: 4,

      borderRadius: 9,

      backgroundColor:
        '#FFF6DF',
    },

    estimatedText: {
      fontSize: 9.5,

      fontWeight: '800',

      color:
        '#A86A00',
    },

    /* NOTE */

    noteArea: {
      marginTop: 9,

      paddingTop: 8,

      flexDirection: 'row',

      alignItems: 'flex-start',

      gap: 5,

      borderTopWidth: 1,

      borderTopColor:
        colors.border,
    },

    noteText: {
      flex: 1,

      fontSize: 10.5,

      lineHeight: 16,

      fontWeight: '500',

      color:
        colors.textSecondary,
    },
  });
}