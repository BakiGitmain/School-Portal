import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  Ionicons,
} from '@expo/vector-icons';

import {
  useFocusEffect,
  useRouter,
} from 'expo-router';

import {
  StatusBar,
} from 'expo-status-bar';

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

type CalendarEventRow = {
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

type CalendarCell = {
  key: string;

  date:
    Date | null;

  day:
    number | null;

  isCurrentMonth:
    boolean;
};

/* =========================================================
 * CONSTANTS
 * ======================================================= */

const WEEK_DAYS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
];

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
  return [
    date.getFullYear(),
    pad2(
      date.getMonth() +
        1,
    ),
    pad2(
      date.getDate(),
    ),
  ].join('-');
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

function sameDay(
  first:
    Date,
  second:
    Date,
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

function readableDate(
  value:
    string,
) {
  const date =
    dateFromKey(
      value,
    );

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

/* =========================================================
 * CALENDAR GRID
 * ======================================================= */

function createCalendarCells(
  year:
    number,
  month:
    number,
): CalendarCell[] {
  const firstDay =
    new Date(
      year,
      month,
      1,
    );

  /*
   * JS:
   * Sunday = 0
   *
   * We want:
   * Monday = 0
   */

  const startOffset =
    (
      firstDay.getDay() +
      6
    ) %
    7;

  const totalDays =
    new Date(
      year,
      month + 1,
      0,
    ).getDate();

  const cells:
    CalendarCell[] =
    [];

  for (
    let index = 0;
    index < 42;
    index += 1
  ) {
    const day =
      index -
      startOffset +
      1;

    if (
      day < 1 ||
      day > totalDays
    ) {
      cells.push({
        key:
          `empty-${index}`,

        date:
          null,

        day:
          null,

        isCurrentMonth:
          false,
      });

      continue;
    }

    const date =
      new Date(
        year,
        month,
        day,
      );

    cells.push({
      key:
        dateKey(
          date,
        ),

      date,

      day,

      isCurrentMonth:
        true,
    });
  }

  return cells;
}

/* =========================================================
 * EVENT HELPERS
 * ======================================================= */

function eventTypeTitle(
  type:
    EventType,
) {
  if (
    type ===
    'holiday'
  ) {
    return 'Holiday';
  }

  if (
    type ===
    'meeting'
  ) {
    return 'Meeting';
  }

  if (
    type ===
    'special_occasion'
  ) {
    return 'Special Occasion';
  }

  return 'Other';
}

function titlePlaceholder(
  type:
    EventType,
) {
  if (
    type ===
    'holiday'
  ) {
    return 'Holiday name';
  }

  if (
    type ===
    'meeting'
  ) {
    return 'Meeting name';
  }

  if (
    type ===
    'special_occasion'
  ) {
    return 'Occasion name';
  }

  return 'Reason or event name';
}

/* =========================================================
 * SCREEN
 * ======================================================= */

export default function SchoolCalendarScreen() {
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

  const today =
    useMemo(
      () =>
        new Date(),
      [],
    );

  const [
    visibleYear,
    setVisibleYear,
  ] =
    useState(
      today.getFullYear(),
    );

  const [
    visibleMonth,
    setVisibleMonth,
  ] =
    useState(
      today.getMonth(),
    );

  const [
    selectedDate,
    setSelectedDate,
  ] =
    useState(
      dateKey(
        today,
      ),
    );

  const [
    events,
    setEvents,
  ] =
    useState<
      CalendarEventRow[]
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
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    deleting,
    setDeleting,
  ] =
    useState(
      false,
    );

  const [
    deleteOpen,
    setDeleteOpen,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState('');

  const [
    success,
    setSuccess,
  ] =
    useState('');

  /*
   * =====================================================
   * FORM
   * =====================================================
   */

  const [
    dateStatus,
    setDateStatus,
  ] =
    useState<DateStatus>(
      'exact',
    );

  const [
    eventType,
    setEventType,
  ] =
    useState<EventType>(
      'holiday',
    );

  const [
    eventTitle,
    setEventTitle,
  ] =
    useState('');

  const [
    notes,
    setNotes,
  ] =
    useState('');

  const [
    isClosed,
    setIsClosed,
  ] =
    useState(
      true,
    );

  /*
   * =====================================================
   * CALENDAR DATA
   * =====================================================
   */

  const calendarCells =
    useMemo(
      () =>
        createCalendarCells(
          visibleYear,
          visibleMonth,
        ),
      [
        visibleMonth,
        visibleYear,
      ],
    );

  const eventMap =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            CalendarEventRow
          >();

        for (
          const event of
          events
        ) {
          map.set(
            event.event_date,
            event,
          );
        }

        return map;
      },
      [
        events,
      ],
    );

  const selectedEvent =
    useMemo(
      () =>
        eventMap.get(
          selectedDate,
        ) ??
        null,
      [
        eventMap,
        selectedDate,
      ],
    );

  /*
   * =====================================================
   * LOAD EVENTS
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
              visibleYear,
              visibleMonth,
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
            ) as CalendarEventRow[],
          );
        } catch (
          loadError
        ) {
          console.log(
            'LOAD SCHOOL CALENDAR:',
            loadError,
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
        visibleMonth,
        visibleYear,
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
   * LOAD SELECTED EVENT INTO FORM
   * =====================================================
   */

  useEffect(
    () => {
      setError('');
      setSuccess('');

      if (
        !selectedEvent
      ) {
        setDateStatus(
          'exact',
        );

        setEventType(
          'holiday',
        );

        setEventTitle('');

        setNotes('');

        setIsClosed(
          true,
        );

        return;
      }

      setDateStatus(
        selectedEvent.date_status,
      );

      setEventType(
        selectedEvent.event_type,
      );

      setEventTitle(
        selectedEvent.title,
      );

      setNotes(
        selectedEvent.notes ??
          '',
      );

      setIsClosed(
        selectedEvent.is_closed,
      );
    },
    [
      selectedEvent,
      selectedDate,
    ],
  );

  /*
   * =====================================================
   * PREVIOUS MONTH
   * =====================================================
   */

  function previousMonth() {
    let year =
      visibleYear;

    let month =
      visibleMonth -
      1;

    if (
      month < 0
    ) {
      month = 11;
      year -= 1;
    }

    setVisibleYear(
      year,
    );

    setVisibleMonth(
      month,
    );

    setSelectedDate(
      dateKey(
        new Date(
          year,
          month,
          1,
        ),
      ),
    );
  }

  /*
   * =====================================================
   * NEXT MONTH
   * =====================================================
   */

  function nextMonth() {
    let year =
      visibleYear;

    let month =
      visibleMonth +
      1;

    if (
      month > 11
    ) {
      month = 0;
      year += 1;
    }

    setVisibleYear(
      year,
    );

    setVisibleMonth(
      month,
    );

    setSelectedDate(
      dateKey(
        new Date(
          year,
          month,
          1,
        ),
      ),
    );
  }

  /*
   * =====================================================
   * GO TODAY
   * =====================================================
   */

  function goToday() {
    const now =
      new Date();

    setVisibleYear(
      now.getFullYear(),
    );

    setVisibleMonth(
      now.getMonth(),
    );

    setSelectedDate(
      dateKey(
        now,
      ),
    );
  }

  /*
   * =====================================================
   * SELECT DATE
   * =====================================================
   */

  function chooseDate(
    date:
      Date,
  ) {
    setSelectedDate(
      dateKey(
        date,
      ),
    );
  }

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async function saveEvent() {
    if (
      saving
    ) {
      return;
    }

    const cleanTitle =
      eventTitle.trim();

    const cleanNotes =
      notes.trim();

    setError('');
    setSuccess('');

    if (
      !cleanTitle
    ) {
      setError(
        eventType ===
          'holiday'
          ? 'Enter the holiday name.'
          : 'Enter a name for this calendar event.',
      );

      return;
    }

    if (
      cleanTitle.length <
      2
    ) {
      setError(
        'The event name is too short.',
      );

      return;
    }

    try {
      setSaving(
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
        throw (
          userError ??
          new Error(
            'Not authenticated.',
          )
        );
      }

      const {
        data,
        error:
          saveError,
      } =
        await supabase
          .from(
            'school_calendar_events',
          )
          .upsert(
            {
              event_date:
                selectedDate,

              date_status:
                dateStatus,

              event_type:
                eventType,

              title:
                cleanTitle,

              notes:
                cleanNotes ||
                null,

              is_closed:
                isClosed,

              updated_by:
                userData.user.id,
            },
            {
              onConflict:
                'event_date',
            },
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
          .single();

      if (
        saveError
      ) {
        throw saveError;
      }

      const saved =
        data as
          CalendarEventRow;

      setEvents(
        current => {
          const withoutOld =
            current.filter(
              event =>
                event.event_date !==
                saved.event_date,
            );

          return [
            ...withoutOld,
            saved,
          ].sort(
            (
              first,
              second,
            ) =>
              first.event_date.localeCompare(
                second.event_date,
              ),
          );
        },
      );

      setSuccess(
        selectedEvent
          ? 'Calendar event updated.'
          : 'Calendar event saved.',
      );
    } catch (
      saveError
    ) {
      console.log(
        'SAVE SCHOOL CALENDAR:',
        saveError,
      );

      setError(
        saveError instanceof
        Error
          ? saveError.message
          : 'Could not save calendar event.',
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  async function deleteEvent() {
    if (
      !selectedEvent ||
      deleting
    ) {
      return;
    }

    try {
      setDeleting(
        true,
      );

      setError('');

      const {
        error:
          deleteError,
      } =
        await supabase
          .from(
            'school_calendar_events',
          )
          .delete()
          .eq(
            'id',
            selectedEvent.id,
          );

      if (
        deleteError
      ) {
        throw deleteError;
      }

      setEvents(
        current =>
          current.filter(
            event =>
              event.id !==
              selectedEvent.id,
          ),
      );

      setDeleteOpen(
        false,
      );

      setDateStatus(
        'exact',
      );

      setEventType(
        'holiday',
      );

      setEventTitle('');

      setNotes('');

      setIsClosed(
        true,
      );

      setSuccess(
        'Calendar event removed.',
      );
    } catch (
      deleteError
    ) {
      console.log(
        'DELETE SCHOOL CALENDAR:',
        deleteError,
      );

      setDeleteOpen(
        false,
      );

      setError(
        deleteError instanceof
        Error
          ? deleteError.message
          : 'Could not delete calendar event.',
      );
    } finally {
      setDeleting(
        false,
      );
    }
  }

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
        keyboardShouldPersistTaps="handled"
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
            styles.titleRow
          }
        >
          <View
            style={
              styles.titleTextArea
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
              Manage important school dates.
            </Text>
          </View>

          <Pressable
            onPress={
              goToday
            }
            style={({
              pressed,
            }) => [
              styles.todayButton,

              pressed &&
                styles.pressed,
            ]}
          >
            <Text
              style={
                styles.todayText
              }
            >
              Today
            </Text>
          </Pressable>
        </View>

        {/* ================================================= */}
        {/* CALENDAR */}
        {/* ================================================= */}

        <View
          style={
            styles.calendarCard
          }
        >
          {/* MONTH */}

          <View
            style={
              styles.monthHeader
            }
          >
            <Pressable
              onPress={
                previousMonth
              }
              style={({
                pressed,
              }) => [
                styles.monthButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={21}
                color={
                  colors.text
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
                  styles.monthTitle
                }
              >
                {
                  MONTHS[
                    visibleMonth
                  ]
                }
              </Text>

              <Text
                style={
                  styles.monthYear
                }
              >
                {
                  visibleYear
                }
              </Text>
            </View>

            <Pressable
              onPress={
                nextMonth
              }
              style={({
                pressed,
              }) => [
                styles.monthButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={21}
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
              day => (
                <View
                  key={
                    day
                  }
                  style={
                    styles.weekCell
                  }
                >
                  <Text
                    style={
                      styles.weekText
                    }
                  >
                    {day}
                  </Text>
                </View>
              ),
            )}
          </View>

          {/* LOADING */}

          {loading ? (
            <View
              style={
                styles.calendarLoading
              }
            >
              <ActivityIndicator
                color={
                  colors.primary
                }
              />
            </View>
          ) : (
            <View
              style={
                styles.daysGrid
              }
            >
              {calendarCells.map(
                cell => {
                  if (
                    !cell.date ||
                    cell.day ===
                      null
                  ) {
                    return (
                      <View
                        key={
                          cell.key
                        }
                        style={
                          styles.dayCell
                        }
                      />
                    );
                  }

                  const key =
                    dateKey(
                      cell.date,
                    );

                  const event =
                    eventMap.get(
                      key,
                    );

                  const selected =
                    key ===
                    selectedDate;

                  const isToday =
                    sameDay(
                      cell.date,
                      today,
                    );

                  return (
                    <Pressable
                      key={
                        cell.key
                      }
                      onPress={() =>
                        chooseDate(
                          cell.date!,
                        )
                      }
                      style={
                        styles.dayCell
                      }
                    >
                      <View
                        style={[
                          styles.dayInner,

                          isToday &&
                            !selected &&
                            styles.todayDay,

                          selected &&
                            styles.selectedDay,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,

                            isToday &&
                              !selected &&
                              styles.todayDayText,

                            selected &&
                              styles.selectedDayText,
                          ]}
                        >
                          {
                            cell.day
                          }
                        </Text>

                        {event ? (
                          <View
                            style={[
                              styles.eventDot,

                              event.is_closed
                                ? styles.closedDot
                                : styles.eventOpenDot,

                              selected &&
                                styles.selectedDot,
                            ]}
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                },
              )}
            </View>
          )}

          {/* LEGEND */}

          <View
            style={
              styles.calendarLegend
            }
          >
            <View
              style={
                styles.legendItem
              }
            >
              <View
                style={[
                  styles.legendDot,
                  styles.closedDot,
                ]}
              />

              <Text
                style={
                  styles.legendText
                }
              >
                Closed
              </Text>
            </View>

            <View
              style={
                styles.legendItem
              }
            >
              <View
                style={[
                  styles.legendDot,
                  styles.eventOpenDot,
                ]}
              />

              <Text
                style={
                  styles.legendText
                }
              >
                Event
              </Text>
            </View>
          </View>
        </View>

        {/* ================================================= */}
        {/* SELECTED DATE */}
        {/* ================================================= */}

        <View
          style={
            styles.selectedDateCard
          }
        >
          <View
            style={
              styles.selectedDateIcon
            }
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color={
                colors.primary
              }
            />
          </View>

          <View
            style={
              styles.selectedDateText
            }
          >
            <Text
              style={
                styles.selectedDateLabel
              }
            >
              Selected day
            </Text>

            <Text
              style={
                styles.selectedDateValue
              }
            >
              {
                readableDate(
                  selectedDate,
                )
              }
            </Text>
          </View>

          {selectedEvent ? (
            <View
              style={
                styles.savedBadge
              }
            >
              <Ionicons
                name="checkmark"
                size={13}
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.savedBadgeText
                }
              >
                Saved
              </Text>
            </View>
          ) : null}
        </View>

        {/* ================================================= */}
        {/* MESSAGE */}
        {/* ================================================= */}

        {error ? (
          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={
                colors.danger
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

        {success ? (
          <View
            style={
              styles.successCard
            }
          >
            <Ionicons
              name="checkmark-circle-outline"
              size={19}
              color="#239B67"
            />

            <Text
              style={
                styles.successText
              }
            >
              {success}
            </Text>
          </View>
        ) : null}

        {/* ================================================= */}
        {/* FORM */}
        {/* ================================================= */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Day Settings
        </Text>

        <View
          style={
            styles.formCard
          }
        >
          {/* CLOSED */}

          <View
            style={
              styles.closedRow
            }
          >
            <View
              style={
                styles.formIcon
              }
            >
              <Ionicons
                name={
                  isClosed
                    ? 'lock-closed-outline'
                    : 'school-outline'
                }
                size={21}
                color={
                  colors.primary
                }
              />
            </View>

            <View
              style={
                styles.closedTextArea
              }
            >
              <Text
                style={
                  styles.fieldTitle
                }
              >
                School closed
              </Text>

              <Text
                style={
                  styles.fieldDescription
                }
              >
                Students do not attend school on this day.
              </Text>
            </View>

            <Switch
              value={
                isClosed
              }
              onValueChange={
                setIsClosed
              }
              trackColor={{
                false:
                  colors.border,

                true:
                  colors.primary,
              }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View
            style={
              styles.divider
            }
          />

          {/* DATE STATUS */}

          <Text
            style={
              styles.label
            }
          >
            Date
          </Text>

          <View
            style={
              styles.twoOptionRow
            }
          >
            <ChoiceButton
              title="Exact"
              icon="checkmark-circle-outline"
              active={
                dateStatus ===
                'exact'
              }
              onPress={() =>
                setDateStatus(
                  'exact',
                )
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <ChoiceButton
              title="Estimated"
              icon="time-outline"
              active={
                dateStatus ===
                'estimated'
              }
              onPress={() =>
                setDateStatus(
                  'estimated',
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

          {/* REASON */}

          <Text
            style={[
              styles.label,
              styles.labelSpacing,
            ]}
          >
            Reason
          </Text>

          <View
            style={
              styles.reasonGrid
            }
          >
            <ReasonButton
              title="Holiday"
              icon="sunny-outline"
              active={
                eventType ===
                'holiday'
              }
              onPress={() =>
                setEventType(
                  'holiday',
                )
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <ReasonButton
              title="Meeting"
              icon="people-outline"
              active={
                eventType ===
                'meeting'
              }
              onPress={() =>
                setEventType(
                  'meeting',
                )
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <ReasonButton
              title="Special"
              icon="sparkles-outline"
              active={
                eventType ===
                'special_occasion'
              }
              onPress={() =>
                setEventType(
                  'special_occasion',
                )
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <ReasonButton
              title="Other"
              icon="ellipsis-horizontal-outline"
              active={
                eventType ===
                'other'
              }
              onPress={() =>
                setEventType(
                  'other',
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

          {/* NAME */}

          <Text
            style={[
              styles.label,
              styles.labelSpacing,
            ]}
          >
            {eventTypeTitle(
              eventType,
            )}{' '}
            name
          </Text>

          <TextInput
            value={
              eventTitle
            }
            onChangeText={
              setEventTitle
            }
            placeholder={
              titlePlaceholder(
                eventType,
              )
            }
            placeholderTextColor={
              colors.textMuted
            }
            maxLength={120}
            style={
              styles.input
            }
          />

          {/* NOTE */}

          <Text
            style={[
              styles.label,
              styles.labelSpacing,
            ]}
          >
            Note
          </Text>

          <TextInput
            value={
              notes
            }
            onChangeText={
              setNotes
            }
            placeholder="Optional note"
            placeholderTextColor={
              colors.textMuted
            }
            maxLength={300}
            multiline
            textAlignVertical="top"
            style={[
              styles.input,
              styles.noteInput,
            ]}
          />

          {/* SAVE */}

          <Pressable
            onPress={() =>
              void saveEvent()
            }
            disabled={
              saving
            }
            style={({
              pressed,
            }) => [
              styles.saveButton,

              saving &&
                styles.disabled,

              pressed &&
                !saving &&
                styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name={
                    selectedEvent
                      ? 'checkmark-circle-outline'
                      : 'add-circle-outline'
                  }
                  size={20}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  {selectedEvent
                    ? 'Update Day'
                    : 'Save Day'}
                </Text>
              </>
            )}
          </Pressable>

          {/* DELETE */}

          {selectedEvent ? (
            <Pressable
              onPress={() =>
                setDeleteOpen(
                  true,
                )
              }
              style={({
                pressed,
              }) => [
                styles.deleteButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={
                  colors.danger
                }
              />

              <Text
                style={[
                  styles.deleteButtonText,
                  {
                    color:
                      colors.danger,
                  },
                ]}
              >
                Remove from Calendar
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* ================================================= */}
      {/* DELETE MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          deleteOpen
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() =>
          setDeleteOpen(
            false,
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalIcon
              }
            >
              <Ionicons
                name="trash-outline"
                size={26}
                color={
                  colors.danger
                }
              />
            </View>

            <Text
              style={
                styles.modalTitle
              }
            >
              Remove event?
            </Text>

            <Text
              style={
                styles.modalText
              }
            >
              {selectedEvent
                ? `${selectedEvent.title} will be removed from ${readableDate(
                    selectedEvent.event_date,
                  )}.`
                : 'This event will be removed.'}
            </Text>

            <View
              style={
                styles.modalActions
              }
            >
              <Pressable
                onPress={() =>
                  setDeleteOpen(
                    false,
                  )
                }
                disabled={
                  deleting
                }
                style={({
                  pressed,
                }) => [
                  styles.cancelButton,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.cancelButtonText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  void deleteEvent()
                }
                disabled={
                  deleting
                }
                style={({
                  pressed,
                }) => [
                  styles.confirmDeleteButton,

                  pressed &&
                    styles.pressed,

                  deleting &&
                    styles.disabled,
                ]}
              >
                {deleting ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmDeleteText
                    }
                  >
                    Remove
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
 * CHOICE BUTTON
 * ======================================================= */

function ChoiceButton({
  title,
  icon,
  active,
  onPress,
  colors,
  styles,
}: {
  title:
    string;

  icon:
    'checkmark-circle-outline' |
    'time-outline';

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
        styles.choiceButton,

        active &&
          styles.choiceButtonActive,
      ]}
    >
      <Ionicons
        name={
          icon
        }
        size={18}
        color={
          active
            ? '#FFFFFF'
            : colors.primary
        }
      />

      <Text
        style={[
          styles.choiceButtonText,

          active &&
            styles.choiceButtonTextActive,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/* =========================================================
 * REASON BUTTON
 * ======================================================= */

function ReasonButton({
  title,
  icon,
  active,
  onPress,
  colors,
  styles,
}: {
  title:
    string;

  icon:
    | 'sunny-outline'
    | 'people-outline'
    | 'sparkles-outline'
    | 'ellipsis-horizontal-outline';

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
        styles.reasonButton,

        active &&
          styles.reasonButtonActive,
      ]}
    >
      <Ionicons
        name={
          icon
        }
        size={19}
        color={
          active
            ? colors.primary
            : colors.textMuted
        }
      />

      <Text
        style={[
          styles.reasonButtonText,

          active &&
            styles.reasonButtonTextActive,
        ]}
      >
        {title}
      </Text>
    </Pressable>
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
      paddingHorizontal: 14,

      paddingTop: 14,

      paddingBottom: 140,
    },

    pressed: {
      opacity: 0.72,
    },

    disabled: {
      opacity: 0.55,
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

    titleRow: {
      marginTop: 17,

      marginBottom: 14,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    titleTextArea: {
      flex: 1,

      minWidth: 0,
    },

    title: {
      fontSize: 23,

      lineHeight: 29,

      fontWeight:
        '800',

      letterSpacing:
        -0.4,

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

    todayButton: {
      minHeight: 37,

      marginLeft: 10,

      paddingHorizontal: 13,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 11,

      backgroundColor:
        colors.primarySoft,
    },

    todayText: {
      fontSize: 11,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    /* CALENDAR */

    calendarCard: {
      padding: 12,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    monthHeader: {
      minHeight: 47,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    monthButton: {
      width: 39,

      height: 39,

      borderRadius: 12,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.surfaceSecondary,
    },

    monthTextArea: {
      alignItems:
        'center',
    },

    monthTitle: {
      fontSize: 16,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    monthYear: {
      marginTop: 1,

      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    weekRow: {
      marginTop: 11,

      flexDirection:
        'row',
    },

    weekCell: {
      width:
        '14.285714%',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    weekText: {
      fontSize: 10,

      fontWeight:
        '800',

      color:
        colors.textMuted,
    },

    daysGrid: {
      marginTop: 6,

      flexDirection:
        'row',

      flexWrap:
        'wrap',
    },

    dayCell: {
      width:
        '14.285714%',

      aspectRatio: 1,

      padding: 2,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    dayInner: {
      width:
        '100%',

      height:
        '100%',

      borderRadius: 11,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderWidth: 1,

      borderColor:
        'transparent',
    },

    dayText: {
      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    todayDay: {
      borderColor:
        colors.primary,
    },

    todayDayText: {
      color:
        colors.primary,

      fontWeight:
        '800',
    },

    selectedDay: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primary,
    },

    selectedDayText: {
      color:
        '#FFFFFF',

      fontWeight:
        '800',
    },

    eventDot: {
      position:
        'absolute',

      bottom: 5,

      width: 5,

      height: 5,

      borderRadius: 3,
    },

    closedDot: {
      backgroundColor:
        '#EF5D6C',
    },

    eventOpenDot: {
      backgroundColor:
        '#E6A400',
    },

    selectedDot: {
      backgroundColor:
        '#FFFFFF',
    },

    calendarLoading: {
      minHeight: 250,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    calendarLegend: {
      marginTop: 10,

      paddingTop: 10,

      flexDirection:
        'row',

      justifyContent:
        'center',

      gap: 18,

      borderTopWidth: 1,

      borderTopColor:
        colors.border,
    },

    legendItem: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,
    },

    legendDot: {
      width: 7,

      height: 7,

      borderRadius: 4,
    },

    legendText: {
      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* SELECTED */

    selectedDateCard: {
      minHeight: 74,

      marginTop: 12,

      paddingHorizontal: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius: 17,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    selectedDateIcon: {
      width: 43,

      height: 43,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      backgroundColor:
        colors.primarySoft,
    },

    selectedDateText: {
      flex: 1,

      minWidth: 0,

      marginLeft: 10,
    },

    selectedDateLabel: {
      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    selectedDateValue: {
      marginTop: 2,

      fontSize: 13,

      lineHeight: 18,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    savedBadge: {
      minHeight: 29,

      marginLeft: 7,

      paddingHorizontal: 8,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 3,

      borderRadius: 9,

      backgroundColor:
        colors.primarySoft,
    },

    savedBadgeText: {
      fontSize: 9,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    /* MESSAGES */

    errorCard: {
      minHeight: 48,

      marginTop: 10,

      paddingHorizontal: 11,

      paddingVertical: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 8,

      borderRadius: 13,

      backgroundColor:
        '#FFF0F1',
    },

    errorText: {
      flex: 1,

      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '700',

      color:
        colors.danger,
    },

    successCard: {
      minHeight: 48,

      marginTop: 10,

      paddingHorizontal: 11,

      paddingVertical: 9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 8,

      borderRadius: 13,

      backgroundColor:
        '#E9F8F1',
    },

    successText: {
      flex: 1,

      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '700',

      color:
        '#23845C',
    },

    /* FORM */

    sectionTitle: {
      marginTop: 22,

      marginBottom: 9,

      marginLeft: 3,

      fontSize: 14,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    formCard: {
      padding: 14,

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    closedRow: {
      minHeight: 62,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    formIcon: {
      width: 42,

      height: 42,

      borderRadius: 13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    closedTextArea: {
      flex: 1,

      minWidth: 0,

      marginHorizontal: 10,
    },

    fieldTitle: {
      fontSize: 14,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    fieldDescription: {
      marginTop: 3,

      fontSize: 10.5,

      lineHeight: 15,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    divider: {
      height: 1,

      marginVertical: 14,

      backgroundColor:
        colors.border,
    },

    label: {
      marginBottom: 7,

      fontSize: 11,

      fontWeight:
        '800',

      color:
        colors.textSecondary,
    },

    labelSpacing: {
      marginTop: 17,
    },

    twoOptionRow: {
      flexDirection:
        'row',

      gap: 8,
    },

    choiceButton: {
      flex: 1,

      height: 46,

      flexDirection:
        'row',

      gap: 6,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    choiceButtonActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primary,
    },

    choiceButtonText: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.textSecondary,
    },

    choiceButtonTextActive: {
      color:
        '#FFFFFF',
    },

    /* REASONS */

    reasonGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      justifyContent:
        'space-between',

      rowGap: 8,
    },

    reasonButton: {
      width:
        '48.5%',

      minHeight: 48,

      paddingHorizontal: 8,

      flexDirection:
        'row',

      gap: 6,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    reasonButtonActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    reasonButtonText: {
      fontSize: 11,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    reasonButtonTextActive: {
      color:
        colors.primary,

      fontWeight:
        '800',
    },

    /* INPUTS */

    input: {
      minHeight: 50,

      paddingHorizontal: 13,

      borderRadius: 13,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.input,

      fontSize: 13,

      fontWeight:
        '600',

      color:
        colors.text,
    },

    noteInput: {
      minHeight: 92,

      paddingTop: 12,

      paddingBottom: 12,
    },

    /* SAVE */

    saveButton: {
      height: 53,

      marginTop: 19,

      flexDirection:
        'row',

      gap: 7,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 15,

      backgroundColor:
        colors.primary,
    },

    saveButtonText: {
      fontSize: 14,

      fontWeight:
        '800',

      color:
        '#FFFFFF',
    },

    deleteButton: {
      height: 46,

      marginTop: 9,

      flexDirection:
        'row',

      gap: 6,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      borderWidth: 1,

      borderColor:
        '#F2C6CC',

      backgroundColor:
        '#FFF4F5',
    },

    deleteButtonText: {
      fontSize: 12,

      fontWeight:
        '800',
    },

    /* MODAL */

    modalOverlay: {
      flex: 1,

      paddingHorizontal: 22,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(0,0,0,0.42)',
    },

    modalCard: {
      width:
        '100%',

      maxWidth: 390,

      padding: 20,

      alignItems:
        'center',

      borderRadius: 22,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    modalIcon: {
      width: 54,

      height: 54,

      borderRadius: 17,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FFF0F1',
    },

    modalTitle: {
      marginTop: 13,

      fontSize: 17,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    modalText: {
      marginTop: 5,

      paddingHorizontal: 6,

      textAlign:
        'center',

      fontSize: 12,

      lineHeight: 18,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    modalActions: {
      width:
        '100%',

      marginTop: 19,

      flexDirection:
        'row',

      gap: 9,
    },

    cancelButton: {
      flex: 1,

      height: 47,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      backgroundColor:
        colors.surfaceSecondary,
    },

    cancelButtonText: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    confirmDeleteButton: {
      flex: 1,

      height: 47,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 13,

      backgroundColor:
        colors.danger,
    },

    confirmDeleteText: {
      fontSize: 12,

      fontWeight:
        '800',

      color:
        '#FFFFFF',
    },
  });
}