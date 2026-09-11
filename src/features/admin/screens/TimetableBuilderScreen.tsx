import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

import * as Print from 'expo-print';

import * as Sharing from 'expo-sharing';

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
  getDayLabel,
  getTimeDisplayLabel,
  shiftMinute,
  WEEK_DAYS,
  type TimeDisplay,
  type TimetableBreak,
} from '../../timetable/time';

import {
  generateTimetable,
  parseSmartConditionText,
  type GeneratedScheduleEntry,
  type SolverRequirement,
} from '../../timetable/solver';

type RequirementDraft = {
  id: string | null;

  key: string;

  teacherUserId: string;

  teacherName: string;

  classId: string;

  className: string;

  subject: string;

  periodsPerWeek: number;

  maxPerDay: number;

  allowBackToBack: boolean;

  enabled: boolean;
};

type PreviewEntry =
  GeneratedScheduleEntry & {
    startMinute: number;

    endMinute: number;
  };

type ClassOption = {
  id: string;

  name: string;
};

const DEFAULT_DAYS = [
  1,
  2,
  3,
  4,
  5,
];

function requirementKey(
  teacherUserId: string,
  classId: string,
  subject: string,
) {
  return [
    teacherUserId,
    classId,
    subject
      .trim()
      .toLowerCase(),
  ].join(':');
}

function errorMessage(
  error: unknown,
) {
  if (
    error instanceof
    Error
  ) {
    return error.message;
  }

  if (
    error &&
    typeof error ===
      'object' &&
    'message' in
      error
  ) {
    return String(
      (
        error as {
          message?: unknown;
        }
      ).message ??
        'Something went wrong.',
    );
  }

  return 'Something went wrong.';
}

function escapeHtml(
  value: string,
) {
  return value
    .replace(
      /&/g,
      '&amp;',
    )
    .replace(
      /</g,
      '&lt;',
    )
    .replace(
      />/g,
      '&gt;',
    )
    .replace(
      /"/g,
      '&quot;',
    )
    .replace(
      /'/g,
      '&#039;',
    );
}

export default function TimetableBuilderScreen() {
  const {
    colors,
  } =
    useAppSettings();

  const {
    width,
  } =
    useWindowDimensions();

  const compact =
    width <
    380;

  const styles =
    useMemo(
      () =>
        createStyles(
          colors,
          compact,
        ),
      [
        colors,
        compact,
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
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    generating,
    setGenerating,
  ] =
    useState(
      false,
    );

  const [
    applying,
    setApplying,
  ] =
    useState(
      false,
    );

  const [
    downloading,
    setDownloading,
  ] =
    useState(
      false,
    );

  const [
    settingsId,
    setSettingsId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    persistedRequirementIds,
    setPersistedRequirementIds,
  ] =
    useState<
      string[]
    >([]);

  const [
    activeDays,
    setActiveDays,
  ] =
    useState<
      number[]
    >(
      DEFAULT_DAYS,
    );

  const [
    startMinute,
    setStartMinute,
  ] =
    useState(
      8 *
      60,
    );

  const [
    periodsPerDay,
    setPeriodsPerDay,
  ] =
    useState(
      7,
    );

  const [
    periodMinutes,
    setPeriodMinutes,
  ] =
    useState(
      45,
    );

  const [
    timeDisplay,
    setTimeDisplay,
  ] =
    useState<
      TimeDisplay
    >(
      '12h',
    );

  const [
    noBackToBack,
    setNoBackToBack,
  ] =
    useState(
      true,
    );

  const [
    maxTeacherConsecutive,
    setMaxTeacherConsecutive,
  ] =
    useState(
      3,
    );

  const [
    restEnabled,
    setRestEnabled,
  ] =
    useState(
      true,
    );

  const [
    restAfter,
    setRestAfter,
  ] =
    useState(
      3,
    );

  const [
    restDuration,
    setRestDuration,
  ] =
    useState(
      20,
    );

  const [
    lunchEnabled,
    setLunchEnabled,
  ] =
    useState(
      true,
    );

  const [
    lunchAfter,
    setLunchAfter,
  ] =
    useState(
      5,
    );

  const [
    lunchDuration,
    setLunchDuration,
  ] =
    useState(
      45,
    );

  const [
    smartCondition,
    setSmartCondition,
  ] =
    useState('');

  const [
    requirements,
    setRequirements,
  ] =
    useState<
      RequirementDraft[]
    >([]);

  /*
   * Requirement class filter
   */

  const [
    requirementClassId,
    setRequirementClassId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    requirementClassPickerOpen,
    setRequirementClassPickerOpen,
  ] =
    useState(
      false,
    );

  const [
    preview,
    setPreview,
  ] =
    useState<
      PreviewEntry[]
    >([]);

  const [
    previewScore,
    setPreviewScore,
  ] =
    useState<
      number |
      null
    >(
      null,
    );

  const [
    draftVersionId,
    setDraftVersionId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  const [
    published,
    setPublished,
  ] =
    useState(
      false,
    );

  const [
    toast,
    setToast,
  ] =
    useState<{
      message: string;

      type:
        | 'success'
        | 'error';
    } | null>(
      null,
    );

  function showToast(
    message: string,

    type:
      | 'success'
      | 'error' =
        'success',
  ) {
    setToast({
      message,
      type,
    });

    setTimeout(
      () => {
        setToast(
          null,
        );
      },
      3000,
    );
  }

  /*
   * =====================================================
   * BREAKS
   * =====================================================
   */

  const breaks =
    useMemo<
      TimetableBreak[]
    >(
      () => {
        const list:
          TimetableBreak[] =
          [];

        if (
          restEnabled
        ) {
          list.push({
            kind:
              'rest',

            label:
              'Rest',

            afterPeriod:
              restAfter,

            durationMinutes:
              restDuration,
          });
        }

        if (
          lunchEnabled
        ) {
          list.push({
            kind:
              'lunch',

            label:
              'Lunch',

            afterPeriod:
              lunchAfter,

            durationMinutes:
              lunchDuration,
          });
        }

        return list;
      },
      [
        restEnabled,
        restAfter,
        restDuration,
        lunchEnabled,
        lunchAfter,
        lunchDuration,
      ],
    );

  const periodPlan =
    useMemo(
      () =>
        buildPeriodSlots({
          startMinute,

          periodsPerDay,

          periodMinutes,

          breaks,
        }),
      [
        startMinute,
        periodsPerDay,
        periodMinutes,
        breaks,
      ],
    );

  /*
   * =====================================================
   * LOAD
   * =====================================================
   */

  const loadBuilder =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

          const {
            data:
              settingsRow,

            error:
              settingsError,
          } =
            await supabase
              .from(
                'timetable_settings',
              )
              .select(
                '*',
              )
              .order(
                'created_at',
                {
                  ascending:
                    true,
                },
              )
              .limit(
                1,
              )
              .maybeSingle();

          if (
            settingsError
          ) {
            throw settingsError;
          }

          if (
            settingsRow
          ) {
            setSettingsId(
              String(
                settingsRow.id,
              ),
            );

            setActiveDays(
              Array.isArray(
                settingsRow.active_days,
              )
                ? settingsRow.active_days.map(
                    Number,
                  )
                : DEFAULT_DAYS,
            );

            setStartMinute(
              Number(
                settingsRow.start_minute,
              ),
            );

            setPeriodsPerDay(
              Number(
                settingsRow.periods_per_day,
              ),
            );

            setPeriodMinutes(
              Number(
                settingsRow.period_minutes,
              ),
            );

            setTimeDisplay(
              settingsRow.time_display as
                TimeDisplay,
            );

            setNoBackToBack(
              Boolean(
                settingsRow.no_assignment_back_to_back,
              ),
            );

            setMaxTeacherConsecutive(
              Number(
                settingsRow.max_teacher_consecutive,
              ),
            );

            const [
              breaksResult,
              rulesResult,
            ] =
              await Promise.all([
                supabase
                  .from(
                    'timetable_breaks',
                  )
                  .select(
                    '*',
                  )
                  .eq(
                    'settings_id',
                    settingsRow.id,
                  ),

                supabase
                  .from(
                    'timetable_rules',
                  )
                  .select(
                    '*',
                  )
                  .eq(
                    'settings_id',
                    settingsRow.id,
                  )
                  .order(
                    'created_at',
                    {
                      ascending:
                        false,
                    },
                  ),
              ]);

            if (
              breaksResult.error
            ) {
              throw breaksResult.error;
            }

            if (
              rulesResult.error
            ) {
              throw rulesResult.error;
            }

            const breakRows =
              breaksResult.data ??
              [];

            const rest =
              breakRows.find(
                item =>
                  item.kind ===
                  'rest',
              );

            const lunch =
              breakRows.find(
                item =>
                  item.kind ===
                  'lunch',
              );

            setRestEnabled(
              Boolean(
                rest,
              ),
            );

            if (
              rest
            ) {
              setRestAfter(
                Number(
                  rest.after_period,
                ),
              );

              setRestDuration(
                Number(
                  rest.duration_minutes,
                ),
              );
            }

            setLunchEnabled(
              Boolean(
                lunch,
              ),
            );

            if (
              lunch
            ) {
              setLunchAfter(
                Number(
                  lunch.after_period,
                ),
              );

              setLunchDuration(
                Number(
                  lunch.duration_minutes,
                ),
              );
            }

            const smartRule =
              (
                rulesResult.data ??
                []
              ).find(
                item =>
                  item.rule_type ===
                  'smart_text',
              );

            if (
              smartRule
                ?.rule_text
            ) {
              setSmartCondition(
                String(
                  smartRule.rule_text,
                ),
              );
            }
          }

          const [
            classesResult,
            teachersResult,
            assignmentsResult,
            requirementResult,
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
                  section,
                  category
                `),

              supabase
                .from(
                  'profiles',
                )
                .select(`
                  user_id,
                  full_name,
                  teacher_id
                `)
                .eq(
                  'role',
                  'teacher',
                ),

              supabase
                .from(
                  'teacher_class_assignments',
                )
                .select(`
                  teacher_user_id,
                  class_id,
                  subjects
                `),

              supabase
                .from(
                  'timetable_requirements',
                )
                .select(
                  '*',
                ),
            ]);

          if (
            classesResult.error
          ) {
            throw classesResult.error;
          }

          if (
            teachersResult.error
          ) {
            throw teachersResult.error;
          }

          if (
            assignmentsResult.error
          ) {
            throw assignmentsResult.error;
          }

          if (
            requirementResult.error
          ) {
            throw requirementResult.error;
          }

          const classes =
            classesResult.data ??
            [];

          const teachers =
            teachersResult.data ??
            [];

          const assignments =
            assignmentsResult.data ??
            [];

          const persisted =
            requirementResult.data ??
            [];

          setPersistedRequirementIds(
            persisted.map(
              item =>
                String(
                  item.id,
                ),
            ),
          );

          const classMap =
            new Map(
              classes.map(
                item => [
                  String(
                    item.id,
                  ),

                  item,
                ],
              ),
            );

          const teacherMap =
            new Map(
              teachers.map(
                item => [
                  String(
                    item.user_id,
                  ),

                  item,
                ],
              ),
            );

          const persistedMap =
            new Map(
              persisted.map(
                item => [
                  requirementKey(
                    String(
                      item.teacher_user_id,
                    ),

                    String(
                      item.class_id,
                    ),

                    String(
                      item.subject,
                    ),
                  ),

                  item,
                ],
              ),
            );

          const result =
            new Map<
              string,
              RequirementDraft
            >();

          for (
            const assignment of
            assignments
          ) {
            const teacherUserId =
              String(
                assignment.teacher_user_id,
              );

            const classId =
              String(
                assignment.class_id,
              );

            const classroom =
              classMap.get(
                classId,
              );

            const teacher =
              teacherMap.get(
                teacherUserId,
              );

            if (
              !classroom ||
              !teacher
            ) {
              continue;
            }

            const subjects =
              Array.isArray(
                assignment.subjects,
              )
                ? assignment.subjects
                : [];

            for (
              const subjectValue of
              subjects
            ) {
              const subject =
                String(
                  subjectValue,
                ).trim();

              if (
                !subject
              ) {
                continue;
              }

              const key =
                requirementKey(
                  teacherUserId,
                  classId,
                  subject,
                );

              if (
                result.has(
                  key,
                )
              ) {
                continue;
              }

              const saved =
                persistedMap.get(
                  key,
                );

              result.set(
                key,
                {
                  id:
                    saved?.id
                      ? String(
                          saved.id,
                        )
                      : null,

                  key,

                  teacherUserId,

                  teacherName:
                    String(
                      teacher.full_name ??
                      'Teacher',
                    ),

                  classId,

                  className:
                    String(
                      classroom.class_name ??
                      classroom.grade_label ??
                      'Class',
                    ),

                  subject,

                  periodsPerWeek:
                    saved
                      ? Number(
                          saved.periods_per_week,
                        )
                      : 3,

                  maxPerDay:
                    saved
                      ? Number(
                          saved.max_per_day,
                        )
                      : 2,

                  allowBackToBack:
                    saved
                      ? Boolean(
                          saved.allow_back_to_back,
                        )
                      : false,

                  enabled:
                    saved
                      ? Boolean(
                          saved.enabled,
                        )
                      : true,
                },
              );
            }
          }

          const sorted =
            [
              ...result.values(),
            ].sort(
              (
                first,
                second,
              ) =>
                first.className.localeCompare(
                  second.className,
                ) ||
                first.subject.localeCompare(
                  second.subject,
                ) ||
                first.teacherName.localeCompare(
                  second.teacherName,
                ),
            );

          setRequirements(
            sorted,
          );

          setRequirementClassId(
            current => {
              if (
                current &&
                sorted.some(
                  item =>
                    item.classId ===
                    current,
                )
              ) {
                return current;
              }

              return (
                sorted[0]
                  ?.classId ??
                null
              );
            },
          );
        } catch (
          error
        ) {
          console.log(
            'LOAD TIMETABLE:',
            error,
          );

          showToast(
            errorMessage(
              error,
            ),
            'error',
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadBuilder();
      },
      [
        loadBuilder,
      ],
    ),
  );

  /*
   * =====================================================
   * REQUIREMENT CLASSES
   * =====================================================
   */

  const requirementClasses =
    useMemo<
      ClassOption[]
    >(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (
          const item of
          requirements
        ) {
          map.set(
            item.classId,
            item.className,
          );
        }

        return [
          ...map.entries(),
        ]
          .map(
            (
              [
                id,
                name,
              ],
            ) => ({
              id,
              name,
            }),
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.name.localeCompare(
                second.name,
              ),
          );
      },
      [
        requirements,
      ],
    );

  const selectedRequirementClass =
    useMemo(
      () =>
        requirementClasses.find(
          item =>
            item.id ===
            requirementClassId,
        ) ??
        null,
      [
        requirementClasses,
        requirementClassId,
      ],
    );

  const visibleRequirements =
    useMemo(
      () =>
        requirements.filter(
          item =>
            item.classId ===
            requirementClassId,
        ),
      [
        requirements,
        requirementClassId,
      ],
    );

  /*
   * =====================================================
   * GENERATED CLASSES
   * =====================================================
   */

  const previewClasses =
    useMemo<
      ClassOption[]
    >(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        for (
          const item of
          preview
        ) {
          map.set(
            item.classId,
            item.className,
          );
        }

        return [
          ...map.entries(),
        ]
          .map(
            (
              [
                id,
                name,
              ],
            ) => ({
              id,
              name,
            }),
          )
          .sort(
            (
              first,
              second,
            ) =>
              first.name.localeCompare(
                second.name,
              ),
          );
      },
      [
        preview,
      ],
    );

  function toggleDay(
    day: number,
  ) {
    setActiveDays(
      current => {
        if (
          current.includes(
            day,
          )
        ) {
          return current.filter(
            item =>
              item !==
              day,
          );
        }

        return [
          ...current,
          day,
        ].sort(
          (
            first,
            second,
          ) =>
            first -
            second,
        );
      },
    );
  }

  function updateRequirement(
    key: string,

    patch:
      Partial<
        RequirementDraft
      >,
  ) {
    setRequirements(
      current =>
        current.map(
          item =>
            item.key ===
            key
              ? {
                  ...item,
                  ...patch,
                }
              : item,
        ),
    );
  }

  function applySmartCondition() {
    const parsed =
      parseSmartConditionText(
        smartCondition,
      );

    if (
      parsed.applied.length ===
      0
    ) {
      showToast(
        'This local rule parser does not understand that condition yet.',
        'error',
      );

      return;
    }

    if (
      parsed
        .noAssignmentBackToBack !==
      undefined
    ) {
      setNoBackToBack(
        parsed.noAssignmentBackToBack,
      );
    }

    if (
      parsed
        .maxTeacherConsecutive !==
      undefined
    ) {
      setMaxTeacherConsecutive(
        parsed.maxTeacherConsecutive,
      );
    }

    showToast(
      parsed.applied.join(
        ' • ',
      ),
    );
  }

  function validateConfiguration() {
    if (
      activeDays.length ===
      0
    ) {
      throw new Error(
        'Choose at least one school day.',
      );
    }

    if (
      periodsPerDay <
        1 ||
      periodsPerDay >
        20
    ) {
      throw new Error(
        'Periods per day must be between 1 and 20.',
      );
    }

    if (
      periodMinutes <
        10 ||
      periodMinutes >
        180
    ) {
      throw new Error(
        'Period length must be between 10 and 180 minutes.',
      );
    }

    if (
      restEnabled &&
      (
        restAfter <
          1 ||
        restAfter >=
          periodsPerDay
      )
    ) {
      throw new Error(
        'Rest must be after a valid period.',
      );
    }

    if (
      lunchEnabled &&
      (
        lunchAfter <
          1 ||
        lunchAfter >=
          periodsPerDay
      )
    ) {
      throw new Error(
        'Lunch must be after a valid period.',
      );
    }

    if (
      restEnabled &&
      lunchEnabled &&
      restAfter ===
        lunchAfter
    ) {
      throw new Error(
        'Rest and lunch cannot be after the same period.',
      );
    }

    if (
      periodPlan.dayEndMinute >
      1440
    ) {
      throw new Error(
        'The school day goes past midnight.',
      );
    }
  }

  /*
   * =====================================================
   * SAVE
   * =====================================================
   */

  async function saveConfiguration({
    quiet =
      false,
  }: {
    quiet?: boolean;
  } = {}) {
    validateConfiguration();

    const {
      data:
        authData,

      error:
        authError,
    } =
      await supabase.auth
        .getUser();

    if (
      authError ||
      !authData.user
    ) {
      throw (
        authError ??
        new Error(
          'President account could not be loaded.',
        )
      );
    }

    const settingsPayload = {
      active_days:
        activeDays,

      start_minute:
        startMinute,

      periods_per_day:
        periodsPerDay,

      period_minutes:
        periodMinutes,

      time_display:
        timeDisplay,

      no_assignment_back_to_back:
        noBackToBack,

      max_teacher_consecutive:
        maxTeacherConsecutive,
    };

    let nextSettingsId =
      settingsId;

    if (
      nextSettingsId
    ) {
      const {
        error,
      } =
        await supabase
          .from(
            'timetable_settings',
          )
          .update(
            settingsPayload,
          )
          .eq(
            'id',
            nextSettingsId,
          );

      if (
        error
      ) {
        throw error;
      }
    } else {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            'timetable_settings',
          )
          .insert({
            ...settingsPayload,

            name:
              'Main Schedule',

            created_by:
              authData.user.id,
          })
          .select(
            'id',
          )
          .single();

      if (
        error ||
        !data
      ) {
        throw (
          error ??
          new Error(
            'Could not create timetable settings.',
          )
        );
      }

      nextSettingsId =
        String(
          data.id,
        );

      setSettingsId(
        nextSettingsId,
      );
    }

    const {
      error:
        deleteBreakError,
    } =
      await supabase
        .from(
          'timetable_breaks',
        )
        .delete()
        .eq(
          'settings_id',
          nextSettingsId,
        );

    if (
      deleteBreakError
    ) {
      throw deleteBreakError;
    }

    if (
      breaks.length >
      0
    ) {
      const {
        error:
          breakError,
      } =
        await supabase
          .from(
            'timetable_breaks',
          )
          .insert(
            breaks.map(
              (
                item,
                index,
              ) => ({
                settings_id:
                  nextSettingsId,

                kind:
                  item.kind,

                label:
                  item.label,

                after_period:
                  item.afterPeriod,

                duration_minutes:
                  item.durationMinutes,

                sort_order:
                  index,
              }),
            ),
          );

      if (
        breakError
      ) {
        throw breakError;
      }
    }

    const {
      error:
        deleteRulesError,
    } =
      await supabase
        .from(
          'timetable_rules',
        )
        .delete()
        .eq(
          'settings_id',
          nextSettingsId,
        );

    if (
      deleteRulesError
    ) {
      throw deleteRulesError;
    }

    if (
      smartCondition.trim()
    ) {
      const parsed =
        parseSmartConditionText(
          smartCondition,
        );

      const {
        error:
          ruleError,
      } =
        await supabase
          .from(
            'timetable_rules',
          )
          .insert({
            settings_id:
              nextSettingsId,

            rule_type:
              'smart_text',

            hard_rule:
              true,

            enabled:
              true,

            rule_text:
              smartCondition.trim(),

            config: {
              parsed:
                parsed.applied,

              no_assignment_back_to_back:
                noBackToBack,

              max_teacher_consecutive:
                maxTeacherConsecutive,
            },
          });

      if (
        ruleError
      ) {
        throw ruleError;
      }
    }

    let savedRequirements:
      RequirementDraft[] =
      requirements;

    if (
      requirements.length >
      0
    ) {
      const {
        data:
          savedRows,

        error:
          requirementError,
      } =
        await supabase
          .from(
            'timetable_requirements',
          )
          .upsert(
            requirements.map(
              item => ({
                teacher_user_id:
                  item.teacherUserId,

                class_id:
                  item.classId,

                subject:
                  item.subject,

                periods_per_week:
                  item.periodsPerWeek,

                max_per_day:
                  item.maxPerDay,

                allow_back_to_back:
                  item.allowBackToBack,

                enabled:
                  item.enabled,
              }),
            ),
            {
              onConflict:
                'teacher_user_id,class_id,subject_key',
            },
          )
          .select(`
            id,
            teacher_user_id,
            class_id,
            subject,
            periods_per_week,
            max_per_day,
            allow_back_to_back,
            enabled
          `);

      if (
        requirementError
      ) {
        throw requirementError;
      }

      const rowMap =
        new Map(
          (
            savedRows ??
            []
          ).map(
            row => [
              requirementKey(
                String(
                  row.teacher_user_id,
                ),

                String(
                  row.class_id,
                ),

                String(
                  row.subject,
                ),
              ),

              row,
            ],
          ),
        );

      savedRequirements =
        requirements.map(
          item => {
            const saved =
              rowMap.get(
                item.key,
              );

            return {
              ...item,

              id:
                saved?.id
                  ? String(
                      saved.id,
                    )
                  : item.id,
            };
          },
        );

      const activeSavedIds =
        new Set(
          savedRequirements
            .map(
              item =>
                item.id,
            )
            .filter(
              (
                id,
              ): id is string =>
                Boolean(
                  id,
                ),
            ),
        );

      const staleIds =
        persistedRequirementIds.filter(
          id =>
            !activeSavedIds.has(
              id,
            ),
        );

      if (
        staleIds.length >
        0
      ) {
        const {
          error:
            staleError,
        } =
          await supabase
            .from(
              'timetable_requirements',
            )
            .update({
              enabled:
                false,
            })
            .in(
              'id',
              staleIds,
            );

        if (
          staleError
        ) {
          throw staleError;
        }
      }

      setRequirements(
        savedRequirements,
      );

      setPersistedRequirementIds(
        [
          ...new Set([
            ...persistedRequirementIds,

            ...[
              ...activeSavedIds,
            ],
          ]),
        ],
      );
    }

    if (
      !quiet
    ) {
      showToast(
        'Schedule settings saved.',
      );
    }

    return {
      settingsId:
        nextSettingsId,

      requirements:
        savedRequirements,

      userId:
        authData.user.id,
    };
  }

  async function handleSave() {
    try {
      setSaving(
        true,
      );

      await saveConfiguration();
    } catch (
      error
    ) {
      showToast(
        errorMessage(
          error,
        ),
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
   * GENERATE
   * =====================================================
   */

  async function generate() {
    if (
      generating
    ) {
      return;
    }

    try {
      setGenerating(
        true,
      );

      setPublished(
        false,
      );

      const saved =
        await saveConfiguration({
          quiet:
            true,
        });

      const solverRequirements:
        SolverRequirement[] =
        saved.requirements
          .filter(
            item =>
              item.enabled,
          )
          .map(
            item => {
              if (
                !item.id
              ) {
                throw new Error(
                  `${item.className} ${item.subject} could not be saved.`,
                );
              }

              return {
                id:
                  item.id,

                teacherUserId:
                  item.teacherUserId,

                teacherName:
                  item.teacherName,

                classId:
                  item.classId,

                className:
                  item.className,

                subject:
                  item.subject,

                periodsPerWeek:
                  item.periodsPerWeek,

                maxPerDay:
                  item.maxPerDay,

                allowBackToBack:
                  item.allowBackToBack,

                enabled:
                  item.enabled,
              };
            },
          );

      const result =
        generateTimetable({
          requirements:
            solverRequirements,

          settings: {
            activeDays,

            periodsPerDay,

            noAssignmentBackToBack:
              noBackToBack,

            maxTeacherConsecutive,
          },
        });

      if (
        !result.success
      ) {
        throw new Error(
          result.message,
        );
      }

      if (
        draftVersionId
      ) {
        await supabase
          .from(
            'timetable_versions',
          )
          .delete()
          .eq(
            'id',
            draftVersionId,
          )
          .eq(
            'status',
            'draft',
          );
      }

      const {
        data:
          version,

        error:
          versionError,
      } =
        await supabase
          .from(
            'timetable_versions',
          )
          .insert({
            settings_id:
              saved.settingsId,

            title:
              'Smart Generated Schedule',

            status:
              'draft',

            created_by:
              saved.userId,

            generator_score:
              result.score,

            config_snapshot: {
              active_days:
                activeDays,

              start_minute:
                startMinute,

              periods_per_day:
                periodsPerDay,

              period_minutes:
                periodMinutes,

              time_display:
                timeDisplay,

              breaks,

              no_assignment_back_to_back:
                noBackToBack,

              max_teacher_consecutive:
                maxTeacherConsecutive,
            },
          })
          .select(
            'id',
          )
          .single();

      if (
        versionError ||
        !version
      ) {
        throw (
          versionError ??
          new Error(
            'Could not create timetable draft.',
          )
        );
      }

      const slotMap =
        new Map(
          periodPlan.slots.map(
            slot => [
              slot.periodIndex,
              slot,
            ],
          ),
        );

      const previewEntries:
        PreviewEntry[] =
        result.entries.map(
          entry => {
            const slot =
              slotMap.get(
                entry.periodIndex,
              );

            if (
              !slot
            ) {
              throw new Error(
                `Period ${entry.periodIndex} has no time.`,
              );
            }

            return {
              ...entry,

              startMinute:
                slot.startMinute,

              endMinute:
                slot.endMinute,
            };
          },
        );

      const {
        error:
          entryError,
      } =
        await supabase
          .from(
            'timetable_entries',
          )
          .insert(
            previewEntries.map(
              item => ({
                version_id:
                  version.id,

                requirement_id:
                  item.requirementId,

                teacher_user_id:
                  item.teacherUserId,

                class_id:
                  item.classId,

                subject:
                  item.subject,

                day_of_week:
                  item.dayOfWeek,

                period_index:
                  item.periodIndex,

                start_minute:
                  item.startMinute,

                end_minute:
                  item.endMinute,
              }),
            ),
          );

      if (
        entryError
      ) {
        await supabase
          .from(
            'timetable_versions',
          )
          .delete()
          .eq(
            'id',
            version.id,
          );

        throw entryError;
      }

      setDraftVersionId(
        String(
          version.id,
        ),
      );

      setPreview(
        previewEntries,
      );

      setPreviewScore(
        result.score,
      );

      showToast(
        'Schedule generated. Open a class to review it.',
      );
    } catch (
      error
    ) {
      console.log(
        'GENERATE TIMETABLE:',
        error,
      );

      showToast(
        errorMessage(
          error,
        ),
        'error',
      );
    } finally {
      setGenerating(
        false,
      );
    }
  }

  /*
   * =====================================================
   * PUBLISH
   * =====================================================
   */

  async function applySchedule() {
    if (
      !draftVersionId
    ) {
      return;
    }

    try {
      setApplying(
        true,
      );

      const {
        error,
      } =
        await supabase.rpc(
          'publish_timetable',
          {
            p_version_id:
              draftVersionId,
          },
        );

      if (
        error
      ) {
        throw error;
      }

      setPublished(
        true,
      );

      showToast(
        'Schedule published successfully.',
      );
    } catch (
      error
    ) {
      showToast(
        errorMessage(
          error,
        ),
        'error',
      );
    } finally {
      setApplying(
        false,
      );
    }
  }

  /*
   * =====================================================
   * OPEN CLASS
   * =====================================================
   */

  function openClassSchedule(
    classroom:
      ClassOption,
  ) {
    if (
      !draftVersionId
    ) {
      return;
    }

    router.push(
      (
        `/admin/more/timetable/${encodeURIComponent(
          classroom.id,
        )}` +
        `?version=${encodeURIComponent(
          draftVersionId,
        )}`
      ) as Href,
    );
  }

  /*
   * =====================================================
   * DOWNLOAD ALL
   * =====================================================
   */

  async function downloadAllClassesPdf() {
    if (
      downloading ||
      preview.length ===
        0
    ) {
      return;
    }

    try {
      setDownloading(
        true,
      );

      const classSections =
        previewClasses
          .map(
            (
              classroom,
              classIndex,
            ) => {
              const classEntries =
                preview.filter(
                  item =>
                    item.classId ===
                    classroom.id,
                );

              const dayHtml =
                WEEK_DAYS.map(
                  day => {
                    const active =
                      activeDays.includes(
                        day.id,
                      );

                    if (
                      !active
                    ) {
                      return `
                        <div class="day">
                          <h3>${day.label}</h3>
                          <div class="closed">No School</div>
                        </div>
                      `;
                    }

                    let rows =
                      '';

                    for (
                      const slot of
                      periodPlan.slots
                    ) {
                      const lesson =
                        classEntries.find(
                          item =>
                            item.dayOfWeek ===
                              day.id &&
                            item.periodIndex ===
                              slot.periodIndex,
                        );

                      rows += `
                        <tr>
                          <td>P${slot.periodIndex}</td>

                          <td>
                            ${escapeHtml(
                              formatMinute(
                                slot.startMinute,
                                timeDisplay,
                              ),
                            )}
                            -
                            ${escapeHtml(
                              formatMinute(
                                slot.endMinute,
                                timeDisplay,
                              ),
                            )}
                          </td>

                          <td>
                            ${
                              lesson
                                ? escapeHtml(
                                    lesson.subject,
                                  )
                                : 'Free Period'
                            }
                          </td>

                          <td>
                            ${
                              lesson
                                ? escapeHtml(
                                    lesson.teacherName,
                                  )
                                : '—'
                            }
                          </td>
                        </tr>
                      `;

                      for (
                        const item of
                        periodPlan.breaks.filter(
                          breakItem =>
                            breakItem.afterPeriod ===
                            slot.periodIndex,
                        )
                      ) {
                        rows += `
                          <tr class="break">
                            <td>—</td>

                            <td>
                              ${escapeHtml(
                                formatMinute(
                                  item.startMinute,
                                  timeDisplay,
                                ),
                              )}
                              -
                              ${escapeHtml(
                                formatMinute(
                                  item.endMinute,
                                  timeDisplay,
                                ),
                              )}
                            </td>

                            <td colspan="2">
                              ${escapeHtml(
                                item.label,
                              )}
                            </td>
                          </tr>
                        `;
                      }
                    }

                    return `
                      <div class="day">
                        <h3>${day.label}</h3>

                        <table>
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>Time</th>
                              <th>Subject</th>
                              <th>Teacher</th>
                            </tr>
                          </thead>

                          <tbody>
                            ${rows}
                          </tbody>
                        </table>
                      </div>
                    `;
                  },
                ).join('');

              return `
                <section class="${
                  classIndex >
                  0
                    ? 'page-break'
                    : ''
                }">

                  <div class="top-label">
                    SCHOOL TIMETABLE
                  </div>

                  <h1>
                    ${escapeHtml(
                      classroom.name,
                    )}
                  </h1>

                  <p class="sub">
                    ${escapeHtml(
                      getTimeDisplayLabel(
                        timeDisplay,
                      ),
                    )}
                    • ${periodMinutes} minute periods
                    • ${
                      published
                        ? 'Published'
                        : 'Draft'
                    }
                  </p>

                  ${dayHtml}
                </section>
              `;
            },
          )
          .join('');

      const html = `
        <html>
          <head>
            <meta charset="utf-8">

            <style>
              @page {
                size: A4;
                margin: 24px;
              }

              body {
                font-family:
                  Arial,
                  sans-serif;

                color:
                  #102B59;
              }

              .page-break {
                page-break-before:
                  always;
              }

              .top-label {
                color:
                  #1671F5;

                font-size:
                  10px;

                font-weight:
                  800;

                letter-spacing:
                  2px;
              }

              h1 {
                margin:
                  5px 0;

                font-size:
                  26px;
              }

              .sub {
                color:
                  #52657D;

                font-size:
                  10px;

                margin-bottom:
                  16px;
              }

              h3 {
                margin:
                  12px 0 5px;

                font-size:
                  14px;
              }

              table {
                width:
                  100%;

                border-collapse:
                  collapse;
              }

              th {
                background:
                  #F1F5F9;

                color:
                  #52657D;

                font-size:
                  8px;

                text-align:
                  left;

                padding:
                  7px;

                border:
                  1px solid #E4EBF3;
              }

              td {
                font-size:
                  9px;

                padding:
                  7px;

                border:
                  1px solid #E4EBF3;
              }

              .break td {
                background:
                  #FFF7DF;

                color:
                  #A16207;

                font-weight:
                  700;
              }

              .closed {
                padding:
                  10px;

                border:
                  1px dashed #D6DEE8;

                color:
                  #8898AC;
              }

              .day {
                page-break-inside:
                  avoid;
              }
            </style>
          </head>

          <body>
            ${classSections}
          </body>
        </html>
      `;

      const {
        uri,
      } =
        await Print
          .printToFileAsync({
            html,
          });

      const available =
        await Sharing
          .isAvailableAsync();

      if (
        !available
      ) {
        throw new Error(
          'Sharing is unavailable.',
        );
      }

      await Sharing
        .shareAsync(
          uri,
          {
            mimeType:
              'application/pdf',

            dialogTitle:
              'School Timetable',

            UTI:
              'com.adobe.pdf',
          },
        );
    } catch (
      error
    ) {
      showToast(
        errorMessage(
          error,
        ),
        'error',
      );
    } finally {
      setDownloading(
        false,
      );
    }
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
          Loading timetable...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      edges={[
        'left',
        'right',
      ]}
      style={
        styles.screen
      }
    >
      <KeyboardAvoidingView
        style={{
          flex: 1,
        }}
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            styles.content
          }
        >
          <View
            style={
              styles.header
            }
          >
            <Pressable
              onPress={() =>
                router.replace(
                  '/admin/more' as Href,
                )
              }
              style={
                styles.backButton
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

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.headerTitle
                }
              >
                Smart Schedule
              </Text>

              <Text
                style={
                  styles.headerSubtitle
                }
              >
                Build the complete school timetable
              </Text>
            </View>
          </View>

          <Section
            title="School Days"
            subtitle="Choose which days are active."
            styles={
              styles
            }
          >
            <View
              style={
                styles.chips
              }
            >
              {WEEK_DAYS.map(
                day => (
                  <Chip
                    key={
                      day.id
                    }
                    label={
                      day.short
                    }
                    selected={
                      activeDays.includes(
                        day.id,
                      )
                    }
                    onPress={() =>
                      toggleDay(
                        day.id,
                      )
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
          </Section>

          <Section
            title="Time System"
            subtitle="Choose how timetable times are displayed."
            styles={
              styles
            }
          >
            <View
              style={
                styles.chips
              }
            >
              <Chip
                label="USA / 12H"
                selected={
                  timeDisplay ===
                  '12h'
                }
                onPress={() =>
                  setTimeDisplay(
                    '12h',
                  )
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
              />

              <Chip
                label="24 Hour"
                selected={
                  timeDisplay ===
                  '24h'
                }
                onPress={() =>
                  setTimeDisplay(
                    '24h',
                  )
                }
                colors={
                  colors
                }
                styles={
                  styles
                }
              />

              <Chip
                label="Ethiopian"
                selected={
                  timeDisplay ===
                  'ethiopian'
                }
                onPress={() =>
                  setTimeDisplay(
                    'ethiopian',
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

            <Text
              style={
                styles.label
              }
            >
              Start Time
            </Text>

            <View
              style={
                styles.timeRow
              }
            >
              <TimeButton
                label="-1h"
                onPress={() =>
                  setStartMinute(
                    current =>
                      shiftMinute(
                        current,
                        -60,
                      ),
                  )
                }
                styles={
                  styles
                }
              />

              <TimeButton
                label="-5m"
                onPress={() =>
                  setStartMinute(
                    current =>
                      shiftMinute(
                        current,
                        -5,
                      ),
                  )
                }
                styles={
                  styles
                }
              />

              <View
                style={
                  styles.timeValue
                }
              >
                <Text
                  style={
                    styles.timeValueText
                  }
                >
                  {formatMinute(
                    startMinute,
                    timeDisplay,
                  )}
                </Text>
              </View>

              <TimeButton
                label="+5m"
                onPress={() =>
                  setStartMinute(
                    current =>
                      shiftMinute(
                        current,
                        5,
                      ),
                  )
                }
                styles={
                  styles
                }
              />

              <TimeButton
                label="+1h"
                onPress={() =>
                  setStartMinute(
                    current =>
                      shiftMinute(
                        current,
                        60,
                      ),
                  )
                }
                styles={
                  styles
                }
              />
            </View>
          </Section>

          <Section
            title="Periods"
            subtitle="Configure the normal school period."
            styles={
              styles
            }
          >
            <View
              style={
                styles.twoColumn
              }
            >
              <Stepper
                label="Periods / Day"
                value={
                  periodsPerDay
                }
                minimum={1}
                maximum={20}
                step={1}
                onChange={
                  setPeriodsPerDay
                }
                styles={
                  styles
                }
              />

              <Stepper
                label="Minutes / Period"
                value={
                  periodMinutes
                }
                minimum={10}
                maximum={180}
                step={5}
                onChange={
                  setPeriodMinutes
                }
                styles={
                  styles
                }
              />
            </View>
          </Section>

          <Section
            title="Rest & Lunch"
            subtitle="Breaks are inserted automatically."
            styles={
              styles
            }
          >
            <ToggleLine
              title="Rest"
              value={
                restEnabled
              }
              onChange={
                setRestEnabled
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            {restEnabled && (
              <View
                style={
                  styles.twoColumn
                }
              >
                <Stepper
                  label="After Period"
                  value={
                    restAfter
                  }
                  minimum={1}
                  maximum={
                    Math.max(
                      1,
                      periodsPerDay -
                        1,
                    )
                  }
                  step={1}
                  onChange={
                    setRestAfter
                  }
                  styles={
                    styles
                  }
                />

                <Stepper
                  label="Rest Minutes"
                  value={
                    restDuration
                  }
                  minimum={5}
                  maximum={120}
                  step={5}
                  onChange={
                    setRestDuration
                  }
                  styles={
                    styles
                  }
                />
              </View>
            )}

            <View
              style={
                styles.divider
              }
            />

            <ToggleLine
              title="Lunch"
              value={
                lunchEnabled
              }
              onChange={
                setLunchEnabled
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            {lunchEnabled && (
              <View
                style={
                  styles.twoColumn
                }
              >
                <Stepper
                  label="After Period"
                  value={
                    lunchAfter
                  }
                  minimum={1}
                  maximum={
                    Math.max(
                      1,
                      periodsPerDay -
                        1,
                    )
                  }
                  step={1}
                  onChange={
                    setLunchAfter
                  }
                  styles={
                    styles
                  }
                />

                <Stepper
                  label="Lunch Minutes"
                  value={
                    lunchDuration
                  }
                  minimum={5}
                  maximum={180}
                  step={5}
                  onChange={
                    setLunchDuration
                  }
                  styles={
                    styles
                  }
                />
              </View>
            )}
          </Section>

          <Section
            title="Smart Conditions"
            subtitle="Additional rules for the generator."
            styles={
              styles
            }
          >
            <View
              style={
                styles.protection
              }
            >
              <Ionicons
                name="shield-checkmark"
                size={20}
                color="#16A34A"
              />

              <Text
                style={
                  styles.protectionText
                }
              >
                Teacher and class collisions are automatically blocked.
              </Text>
            </View>

            <TextInput
              value={
                smartCondition
              }
              onChangeText={
                setSmartCondition
              }
              multiline
              placeholder="Write scheduling conditions..."
              placeholderTextColor={
                colors.textMuted
              }
              style={
                styles.prompt
              }
            />

            <Pressable
              onPress={
                applySmartCondition
              }
              style={
                styles.promptButton
              }
            >
              <Ionicons
                name="sparkles-outline"
                size={18}
                color={
                  colors.primary
                }
              />

              <Text
                style={
                  styles.promptButtonText
                }
              >
                Apply Condition
              </Text>
            </Pressable>

            <ToggleLine
              title="Avoid Back-to-Back"
              value={
                noBackToBack
              }
              onChange={
                setNoBackToBack
              }
              colors={
                colors
              }
              styles={
                styles
              }
            />

            <Stepper
              label="Max Consecutive / Teacher"
              value={
                maxTeacherConsecutive
              }
              minimum={1}
              maximum={10}
              step={1}
              onChange={
                setMaxTeacherConsecutive
              }
              styles={
                styles
              }
            />
          </Section>

          {/* ================================================= */}
          {/* TEACHING REQUIREMENTS */}
          {/* ================================================= */}

          <Text
            style={
              styles.bigTitle
            }
          >
            Teaching Requirements
          </Text>

          <Text
            style={
              styles.bigSubtitle
            }
          >
            Choose one class to edit its subjects.
          </Text>

          <View
            style={
              styles.classFilter
            }
          >
            <Pressable
              onPress={() =>
                setRequirementClassPickerOpen(
                  current =>
                    !current,
                )
              }
              style={
                styles.classFilterButton
              }
            >
              <View
                style={
                  styles.classFilterIcon
                }
              >
                <Ionicons
                  name="school"
                  size={21}
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
                  style={
                    styles.classFilterLabel
                  }
                >
                  SELECT CLASS
                </Text>

                <Text
                  style={
                    styles.classFilterName
                  }
                >
                  {selectedRequirementClass
                    ?.name ??
                    'Choose class'}
                </Text>
              </View>

              <Ionicons
                name={
                  requirementClassPickerOpen
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={20}
                color={
                  colors.textMuted
                }
              />
            </Pressable>

            {requirementClassPickerOpen && (
              <View
                style={
                  styles.classFilterOptions
                }
              >
                {requirementClasses.map(
                  classroom => (
                    <Pressable
                      key={
                        classroom.id
                      }
                      onPress={() => {
                        setRequirementClassId(
                          classroom.id,
                        );

                        setRequirementClassPickerOpen(
                          false,
                        );
                      }}
                      style={[
                        styles.classFilterOption,

                        requirementClassId ===
                          classroom.id &&
                          styles.classFilterSelected,
                      ]}
                    >
                      <Text
                        style={
                          styles.classFilterOptionText
                        }
                      >
                        {classroom.name}
                      </Text>

                      {requirementClassId ===
                        classroom.id && (
                        <Ionicons
                          name="checkmark-circle"
                          size={19}
                          color={
                            colors.primary
                          }
                        />
                      )}
                    </Pressable>
                  ),
                )}
              </View>
            )}
          </View>

          {visibleRequirements.map(
            item => (
              <View
                key={
                  item.key
                }
                style={[
                  styles.requirementCard,

                  !item.enabled && {
                    opacity:
                      0.55,
                  },
                ]}
              >
                <View
                  style={
                    styles.requirementTop
                  }
                >
                  <View
                    style={{
                      flex: 1,
                    }}
                  >
                    <Text
                      style={
                        styles.requirementSubject
                      }
                    >
                      {item.subject}
                    </Text>

                    <Text
                      style={
                        styles.requirementTeacher
                      }
                    >
                      Teacher: {item.teacherName}
                    </Text>
                  </View>

                  <SmallToggle
                    value={
                      item.enabled
                    }
                    onChange={
                      value =>
                        updateRequirement(
                          item.key,
                          {
                            enabled:
                              value,
                          },
                        )
                    }
                    colors={
                      colors
                    }
                  />
                </View>

                <View
                  style={
                    styles.twoColumn
                  }
                >
                  <Stepper
                    label="Periods / Week"
                    value={
                      item.periodsPerWeek
                    }
                    minimum={1}
                    maximum={30}
                    step={1}
                    onChange={
                      value =>
                        updateRequirement(
                          item.key,
                          {
                            periodsPerWeek:
                              value,
                          },
                        )
                    }
                    styles={
                      styles
                    }
                  />

                  <Stepper
                    label="Max / Day"
                    value={
                      item.maxPerDay
                    }
                    minimum={1}
                    maximum={10}
                    step={1}
                    onChange={
                      value =>
                        updateRequirement(
                          item.key,
                          {
                            maxPerDay:
                              value,
                          },
                        )
                    }
                    styles={
                      styles
                    }
                  />
                </View>

                <ToggleLine
                  title="Allow Back-to-Back"
                  value={
                    item.allowBackToBack
                  }
                  onChange={
                    value =>
                      updateRequirement(
                        item.key,
                        {
                          allowBackToBack:
                            value,
                        },
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
            ),
          )}

          <Pressable
            onPress={() =>
              void handleSave()
            }
            disabled={
              saving
            }
            style={
              styles.secondaryButton
            }
          >
            {saving ? (
              <ActivityIndicator
                color={
                  colors.primary
                }
              />
            ) : (
              <>
                <Ionicons
                  name="save-outline"
                  size={20}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Save Configuration
                </Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              void generate()
            }
            disabled={
              generating
            }
            style={
              styles.generateButton
            }
          >
            {generating ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <>
                <Ionicons
                  name="sparkles"
                  size={21}
                  color="#FFFFFF"
                />

                <Text
                  style={
                    styles.generateText
                  }
                >
                  Generate Smart Schedule
                </Text>
              </>
            )}
          </Pressable>

          {/* ================================================= */}
          {/* GENERATED */}
          {/* ================================================= */}

          {preview.length >
            0 && (
            <>
              <View
                style={
                  styles.generatedHeader
                }
              >
                <View>
                  <Text
                    style={
                      styles.generatedTitle
                    }
                  >
                    Generated Draft
                  </Text>

                  <Text
                    style={
                      styles.generatedSubtitle
                    }
                  >
                    Open a class to review its timetable
                  </Text>
                </View>

                <View
                  style={
                    styles.score
                  }
                >
                  <Text
                    style={
                      styles.scoreText
                    }
                  >
                    {published
                      ? 'LIVE'
                      : `${previewScore ?? 0}%`}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() =>
                  void downloadAllClassesPdf()
                }
                disabled={
                  downloading
                }
                style={
                  styles.downloadButton
                }
              >
                <View
                  style={
                    styles.downloadIcon
                  }
                >
                  <Ionicons
                    name="document-text-outline"
                    size={21}
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
                    style={
                      styles.downloadTitle
                    }
                  >
                    Download All Classes
                  </Text>

                  <Text
                    style={
                      styles.downloadSubtitle
                    }
                  >
                    One professional PDF with every timetable
                  </Text>
                </View>

                {downloading ? (
                  <ActivityIndicator
                    color={
                      colors.primary
                    }
                  />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={21}
                    color={
                      colors.primary
                    }
                  />
                )}
              </Pressable>

              <Text
                style={
                  styles.classListTitle
                }
              >
                All Classes
              </Text>

              <Text
                style={
                  styles.classListSubtitle
                }
              >
                Tap a class to open its weekly table
              </Text>

              <View
                style={
                  styles.classGrid
                }
              >
                {previewClasses.map(
                  classroom => {
                    const classLessons =
                      preview.filter(
                        item =>
                          item.classId ===
                          classroom.id,
                      ).length;

                    return (
                      <Pressable
                        key={
                          classroom.id
                        }
                        onPress={() =>
                          openClassSchedule(
                            classroom,
                          )
                        }
                        style={
                          styles.generatedClassCard
                        }
                      >
                        <View
                          style={
                            styles.generatedClassIcon
                          }
                        >
                          <Ionicons
                            name="school"
                            size={23}
                            color={
                              colors.primary
                            }
                          />
                        </View>

                        <Text
                          style={
                            styles.generatedClassName
                          }
                        >
                          {classroom.name}
                        </Text>

                        <Text
                          style={
                            styles.generatedClassLessons
                          }
                        >
                          {classLessons} lessons
                        </Text>

                        <View
                          style={
                            styles.openClass
                          }
                        >
                          <Text
                            style={
                              styles.openClassText
                            }
                          >
                            View Schedule
                          </Text>

                          <Ionicons
                            name="arrow-forward"
                            size={15}
                            color={
                              colors.primary
                            }
                          />
                        </View>
                      </Pressable>
                    );
                  },
                )}
              </View>

              {!published && (
                <Pressable
                  onPress={() =>
                    void applySchedule()
                  }
                  disabled={
                    applying
                  }
                  style={
                    styles.applyButton
                  }
                >
                  {applying ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#FFFFFF"
                      />

                      <Text
                        style={
                          styles.applyText
                        }
                      >
                        Apply Schedule
                      </Text>
                    </>
                  )}
                </Pressable>
              )}

              <Pressable
                onPress={() =>
                  void generate()
                }
                style={
                  styles.regenerate
                }
              >
                <Ionicons
                  name="refresh-outline"
                  size={19}
                  color={
                    colors.primary
                  }
                />

                <Text
                  style={
                    styles.regenerateText
                  }
                >
                  Regenerate
                </Text>
              </Pressable>
            </>
          )}

          <View
            style={{
              height:
                100,
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {toast && (
        <View
          style={[
            styles.toast,

            toast.type ===
              'error'
              ? styles.toastError
              : styles.toastSuccess,
          ]}
        >
          <Text
            style={{
              flex:
                1,

              color:
                toast.type ===
                'error'
                  ? '#B91C1C'
                  : '#15803D',

              fontWeight:
                '700',
            }}
          >
            {toast.message}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * SMALL COMPONENTS
 * =========================================================
 */

function Section({
  title,
  subtitle,
  children,
  styles,
}: {
  title: string;

  subtitle: string;

  children: React.ReactNode;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.section
      }
    >
      <Text
        style={
          styles.sectionTitle
        }
      >
        {title}
      </Text>

      <Text
        style={
          styles.sectionSubtitle
        }
      >
        {subtitle}
      </Text>

      <View
        style={{
          marginTop:
            14,
        }}
      >
        {children}
      </View>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
  colors,
  styles,
}: {
  label: string;

  selected: boolean;

  onPress: () => void;

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
        styles.chip,

        {
          backgroundColor:
            selected
              ? colors.primary
              : colors.surfaceSecondary,

          borderColor:
            selected
              ? colors.primary
              : colors.border,
        },
      ]}
    >
      <Text
        style={{
          color:
            selected
              ? '#FFFFFF'
              : colors.text,

          fontWeight:
            '800',

          fontSize:
            11,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function TimeButton({
  label,
  onPress,
  styles,
}: {
  label: string;

  onPress: () => void;

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
      style={
        styles.timeButton
      }
    >
      <Text
        style={
          styles.timeButtonText
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({
  label,
  value,
  minimum,
  maximum,
  step,
  onChange,
  styles,
}: {
  label: string;

  value: number;

  minimum: number;

  maximum: number;

  step: number;

  onChange:
    (
      value:
        number,
    ) => void;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.stepper
      }
    >
      <Text
        style={
          styles.stepperLabel
        }
      >
        {label}
      </Text>

      <View
        style={
          styles.stepperRow
        }
      >
        <Pressable
          onPress={() =>
            onChange(
              Math.max(
                minimum,
                value -
                  step,
              ),
            )
          }
          style={
            styles.stepperButton
          }
        >
          <Ionicons
            name="remove"
            size={18}
            color="#1671F5"
          />
        </Pressable>

        <Text
          style={
            styles.stepperValue
          }
        >
          {value}
        </Text>

        <Pressable
          onPress={() =>
            onChange(
              Math.min(
                maximum,
                value +
                  step,
              ),
            )
          }
          style={
            styles.stepperButton
          }
        >
          <Ionicons
            name="add"
            size={18}
            color="#1671F5"
          />
        </Pressable>
      </View>
    </View>
  );
}

function SmallToggle({
  value,
  onChange,
  colors,
}: {
  value: boolean;

  onChange:
    (
      value:
        boolean,
    ) => void;

  colors:
    AppThemeColors;
}) {
  return (
    <Pressable
      onPress={() =>
        onChange(
          !value,
        )
      }
      style={{
        width:
          48,

        height:
          28,

        padding:
          3,

        borderRadius:
          14,

        justifyContent:
          'center',

        backgroundColor:
          value
            ? colors.primary
            : colors.border,
      }}
    >
      <View
        style={{
          width:
            22,

          height:
            22,

          borderRadius:
            11,

          backgroundColor:
            '#FFFFFF',

          alignSelf:
            value
              ? 'flex-end'
              : 'flex-start',
        }}
      />
    </Pressable>
  );
}

function ToggleLine({
  title,
  value,
  onChange,
  colors,
  styles,
}: {
  title: string;

  value: boolean;

  onChange:
    (
      value:
        boolean,
    ) => void;

  colors:
    AppThemeColors;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={
        styles.toggleLine
      }
    >
      <Text
        style={
          styles.toggleTitle
        }
      >
        {title}
      </Text>

      <SmallToggle
        value={
          value
        }
        onChange={
          onChange
        }
        colors={
          colors
        }
      />
    </View>
  );
}

/*
 * =========================================================
 * STYLE
 * =========================================================
 */

function createStyles(
  colors:
    AppThemeColors,

  compact:
    boolean,
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
    },

    content: {
      padding:
        compact
          ? 12
          : 16,
    },

    loading: {
      marginTop:
        10,

      color:
        colors.textMuted,
    },

    header: {
      minHeight:
        64,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        12,

      marginBottom:
        14,
    },

    backButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    headerTitle: {
      color:
        colors.text,

      fontSize:
        22,

      fontWeight:
        '900',
    },

    headerSubtitle: {
      marginTop:
        2,

      color:
        colors.textMuted,

      fontSize:
        10,

      fontWeight:
        '600',
    },

    section: {
      marginBottom:
        14,

      padding:
        15,

      borderRadius:
        20,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    sectionTitle: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    sectionSubtitle: {
      marginTop:
        3,

      color:
        colors.textMuted,

      fontSize:
        10,

      lineHeight:
        15,

      fontWeight:
        '600',
    },

    chips: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        7,
    },

    chip: {
      minHeight:
        38,

      paddingHorizontal:
        12,

      borderRadius:
        12,

      borderWidth:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    label: {
      marginTop:
        16,

      marginBottom:
        7,

      color:
        colors.textSecondary,

      fontSize:
        10,

      fontWeight:
        '700',
    },

    timeRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },

    timeButton: {
      width:
        42,

      height:
        43,

      borderRadius:
        11,

      borderWidth:
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

    timeButtonText: {
      color:
        colors.text,

      fontSize:
        9,

      fontWeight:
        '800',
    },

    timeValue: {
      flex:
        1,

      height:
        46,

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    timeValueText: {
      color:
        colors.primary,

      fontSize:
        16,

      fontWeight:
        '900',
    },

    twoColumn: {
      flexDirection:
        compact
          ? 'column'
          : 'row',

      gap:
        9,

      marginTop:
        9,
    },

    stepper: {
      flex:
        1,

      padding:
        11,

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    stepperLabel: {
      marginBottom:
        8,

      color:
        colors.textSecondary,

      fontSize:
        9,

      fontWeight:
        '700',
    },

    stepperRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    stepperButton: {
      width:
        31,

      height:
        31,

      borderRadius:
        10,

      backgroundColor:
        colors.card,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    stepperValue: {
      color:
        colors.text,

      fontSize:
        14,

      fontWeight:
        '900',
    },

    divider: {
      height:
        StyleSheet.hairlineWidth,

      backgroundColor:
        colors.border,

      marginVertical:
        10,
    },

    toggleLine: {
      minHeight:
        50,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      gap:
        10,
    },

    toggleTitle: {
      flex:
        1,

      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    protection: {
      padding:
        11,

      marginBottom:
        10,

      borderRadius:
        13,

      backgroundColor:
        '#F0FDF4',

      borderWidth:
        1,

      borderColor:
        '#BBF7D0',

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        9,
    },

    protectionText: {
      flex:
        1,

      color:
        '#15803D',

      fontSize:
        9,

      lineHeight:
        14,

      fontWeight:
        '700',
    },

    prompt: {
      minHeight:
        80,

      padding:
        11,

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        13,

      backgroundColor:
        colors.input,

      color:
        colors.text,

      textAlignVertical:
        'top',
    },

    promptButton: {
      height:
        43,

      marginTop:
        8,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,
    },

    promptButtonText: {
      color:
        colors.primary,

      fontSize:
        11,

      fontWeight:
        '900',
    },

    bigTitle: {
      marginTop:
        4,

      color:
        colors.text,

      fontSize:
        20,

      fontWeight:
        '900',
    },

    bigSubtitle: {
      marginTop:
        3,

      marginBottom:
        11,

      color:
        colors.textMuted,

      fontSize:
        10,

      fontWeight:
        '600',
    },

    classFilter: {
      padding:
        12,

      marginBottom:
        11,

      borderRadius:
        18,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    classFilterButton: {
      minHeight:
        62,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,

      padding:
        9,

      borderRadius:
        13,

      backgroundColor:
        colors.surfaceSecondary,
    },

    classFilterIcon: {
      width:
        41,

      height:
        41,

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    classFilterLabel: {
      color:
        colors.textMuted,

      fontSize:
        8,

      fontWeight:
        '800',

      letterSpacing:
        0.8,
    },

    classFilterName: {
      marginTop:
        2,

      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    classFilterOptions: {
      marginTop:
        8,

      gap:
        5,
    },

    classFilterOption: {
      minHeight:
        45,

      paddingHorizontal:
        11,

      borderRadius:
        11,

      borderWidth:
        1,

      borderColor:
        colors.border,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    classFilterSelected: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    classFilterOptionText: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '800',
    },

    requirementCard: {
      padding:
        13,

      marginBottom:
        9,

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    requirementTop: {
      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        10,
    },

    requirementSubject: {
      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '900',
    },

    requirementTeacher: {
      marginTop:
        3,

      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    secondaryButton: {
      height:
        50,

      marginTop:
        9,

      borderRadius:
        15,

      borderWidth:
        1,

      borderColor:
        colors.primary,

      backgroundColor:
        colors.card,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    secondaryButtonText: {
      color:
        colors.primary,

      fontSize:
        12,

      fontWeight:
        '900',
    },

    generateButton: {
      height:
        55,

      marginTop:
        9,

      borderRadius:
        16,

      backgroundColor:
        colors.primary,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,
    },

    generateText: {
      color:
        '#FFFFFF',

      fontSize:
        13,

      fontWeight:
        '900',
    },

    generatedHeader: {
      marginTop:
        26,

      marginBottom:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    generatedTitle: {
      color:
        colors.text,

      fontSize:
        21,

      fontWeight:
        '900',
    },

    generatedSubtitle: {
      marginTop:
        3,

      color:
        colors.textMuted,

      fontSize:
        10,

      fontWeight:
        '600',
    },

    score: {
      minWidth:
        64,

      height:
        36,

      paddingHorizontal:
        10,

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    scoreText: {
      color:
        colors.primary,

      fontWeight:
        '900',

      fontSize:
        11,
    },

    downloadButton: {
      minHeight:
        68,

      padding:
        11,

      marginBottom:
        15,

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.primary,

      backgroundColor:
        colors.card,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        10,
    },

    downloadIcon: {
      width:
        42,

      height:
        42,

      borderRadius:
        12,

      backgroundColor:
        colors.primarySoft,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    downloadTitle: {
      color:
        colors.text,

      fontSize:
        12,

      fontWeight:
        '900',
    },

    downloadSubtitle: {
      marginTop:
        2,

      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    classListTitle: {
      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    classListSubtitle: {
      marginTop:
        2,

      marginBottom:
        10,

      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    classGrid: {
      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        9,
    },

    generatedClassCard: {
      width:
        compact
          ? '100%'
          : '48.5%',

      minHeight:
        150,

      padding:
        13,

      borderRadius:
        17,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    generatedClassIcon: {
      width:
        43,

      height:
        43,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    generatedClassName: {
      marginTop:
        10,

      color:
        colors.text,

      fontSize:
        17,

      fontWeight:
        '900',
    },

    generatedClassLessons: {
      marginTop:
        3,

      color:
        colors.textMuted,

      fontSize:
        9,

      fontWeight:
        '600',
    },

    openClass: {
      marginTop:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,
    },

    openClassText: {
      color:
        colors.primary,

      fontSize:
        9,

      fontWeight:
        '900',
    },

    applyButton: {
      height:
        55,

      marginTop:
        14,

      borderRadius:
        16,

      backgroundColor:
        '#16A34A',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,
    },

    applyText: {
      color:
        '#FFFFFF',

      fontWeight:
        '900',
    },

    regenerate: {
      height:
        48,

      marginTop:
        8,

      borderRadius:
        14,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        6,
    },

    regenerateText: {
      color:
        colors.primary,

      fontSize:
        11,

      fontWeight:
        '900',
    },

    toast: {
      position:
        'absolute',

      left:
        15,

      right:
        15,

      bottom:
        20,

      minHeight:
        52,

      padding:
        13,

      borderRadius:
        15,

      borderWidth:
        1,
    },

    toastSuccess: {
      backgroundColor:
        '#F0FDF4',

      borderColor:
        '#BBF7D0',
    },

    toastError: {
      backgroundColor:
        '#FEF2F2',

      borderColor:
        '#FECACA',
    },
  });
}