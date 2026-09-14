import React, {
  useCallback,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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

type BehaviorType =
  | 'positive'
  | 'reminder'
  | 'concern';

type HomeroomClass = {
  id: string;
  class_name: string;
};

type HomeroomStudent = {
  user_id: string;
  full_name: string;
  student_id: string | null;
  avatar_url: string | null;
  class_id: string;
  class_name: string;
};

type BehaviorRecord = {
  id: string;
  student_user_id: string;
  student_name: string;
  student_id: string | null;
  class_id: string;
  behavior_type: BehaviorType;
  reason: string;
  note: string | null;
  behavior_date: string;
  created_at: string;
};

type BehaviorRpcResponse = {
  classes?: unknown;
  students?: unknown;
  records?: unknown;
};

/* =========================================================
 * PARSERS
 * ======================================================= */

function parseClasses(
  value: unknown,
): HomeroomClass[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (
        item: unknown,
      ): HomeroomClass | null => {
        if (
          !item ||
          typeof item !== 'object'
        ) {
          return null;
        }

        const row =
          item as Record<
            string,
            unknown
          >;

        if (!row.id) {
          return null;
        }

        return {
          id: String(row.id),

          class_name: String(
            row.class_name ??
              'Class',
          ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is HomeroomClass =>
        item !== null,
    );
}

function parseStudents(
  value: unknown,
): HomeroomStudent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (
        item: unknown,
      ): HomeroomStudent | null => {
        if (
          !item ||
          typeof item !== 'object'
        ) {
          return null;
        }

        const row =
          item as Record<
            string,
            unknown
          >;

        if (
          !row.user_id ||
          !row.class_id
        ) {
          return null;
        }

        return {
          user_id:
            String(
              row.user_id,
            ),

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

          avatar_url:
            row.avatar_url
              ? String(
                  row.avatar_url,
                )
              : null,

          class_id:
            String(
              row.class_id,
            ),

          class_name:
            String(
              row.class_name ??
                'Class',
            ),
        };
      },
    )
    .filter(
      (
        item,
      ): item is HomeroomStudent =>
        item !== null,
    );
}

function parseRecords(
  value: unknown,
): BehaviorRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(
      (
        item: unknown,
      ): BehaviorRecord | null => {
        if (
          !item ||
          typeof item !== 'object'
        ) {
          return null;
        }

        const row =
          item as Record<
            string,
            unknown
          >;

        const behaviorType =
          String(
            row.behavior_type ??
              '',
          );

        if (
          !row.id ||
          !row.student_user_id ||
          !row.class_id ||
          (
            behaviorType !==
              'positive' &&
            behaviorType !==
              'reminder' &&
            behaviorType !==
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

          student_user_id:
            String(
              row.student_user_id,
            ),

          student_name:
            String(
              row.student_name ??
                'Student',
            ),

          student_id:
            row.student_id
              ? String(
                  row.student_id,
                )
              : null,

          class_id:
            String(
              row.class_id,
            ),

          behavior_type:
            behaviorType as BehaviorType,

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
        };
      },
    )
    .filter(
      (
        item,
      ): item is BehaviorRecord =>
        item !== null,
    );
}

/* =========================================================
 * HELPERS
 * ======================================================= */

function behaviorLabel(
  type: BehaviorType,
) {
  if (
    type === 'positive'
  ) {
    return 'Positive';
  }

  if (
    type === 'reminder'
  ) {
    return 'Reminder';
  }

  return 'Concern';
}

function readableDate(
  value: string,
) {
  if (!value) {
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

  if (
    !year ||
    !month ||
    !day
  ) {
    return value;
  }

  const date =
    new Date(
      year,
      month - 1,
      day,
    );

  return date.toLocaleDateString(
    undefined,
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    },
  );
}

/* =========================================================
 * SCREEN
 * ======================================================= */

export default function HomeroomBehaviorScreen() {
  const router =
    useRouter();

  const {
    width,
  } =
    useWindowDimensions();

  const {
    colors,
    resolvedTheme,
  } =
    useAppSettings();

  /*
   * Small phones such as 320-360px
   * get a slightly tighter layout.
   */
  const compact =
    width < 370;

  const tablet =
    width >= 700;

  const styles =
    useMemo(
      () =>
        createStyles(
          colors,
          compact,
          tablet,
        ),
      [
        colors,
        compact,
        tablet,
      ],
    );

  const [
    classes,
    setClasses,
  ] =
    useState<
      HomeroomClass[]
    >([]);

  const [
    students,
    setStudents,
  ] =
    useState<
      HomeroomStudent[]
    >([]);

  const [
    records,
    setRecords,
  ] =
    useState<
      BehaviorRecord[]
    >([]);

  const [
    selectedClassId,
    setSelectedClassId,
  ] =
    useState<
      string | null
    >(null);

  const [
    search,
    setSearch,
  ] =
    useState('');

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
    useState('');

  /* =====================================================
   * MODAL
   * =================================================== */

  const [
    selectedStudent,
    setSelectedStudent,
  ] =
    useState<
      HomeroomStudent | null
    >(null);

  const [
    addOpen,
    setAddOpen,
  ] =
    useState(false);

  const [
    behaviorType,
    setBehaviorType,
  ] =
    useState<BehaviorType>(
      'positive',
    );

  const [
    reason,
    setReason,
  ] =
    useState('');

  const [
    note,
    setNote,
  ] =
    useState('');

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    formError,
    setFormError,
  ] =
    useState('');

  /* =====================================================
   * LOAD
   * =================================================== */

  const loadData =
    useCallback(
      async (
        refresh = false,
      ) => {
        try {
          if (refresh) {
            setRefreshing(true);
          } else {
            setLoading(true);
          }

          setError('');

          const {
            data,
            error:
              loadError,
          } =
            await supabase.rpc(
              'get_my_homeroom_behavior',
            );

          if (loadError) {
            throw loadError;
          }

          const response =
            (
              data ??
              {}
            ) as BehaviorRpcResponse;

          const nextClasses =
            parseClasses(
              response.classes,
            );

          const nextStudents =
            parseStudents(
              response.students,
            );

          const nextRecords =
            parseRecords(
              response.records,
            );

          setClasses(
            nextClasses,
          );

          setStudents(
            nextStudents,
          );

          setRecords(
            nextRecords,
          );

          setSelectedClassId(
            current => {
              if (
                current &&
                nextClasses.some(
                  item =>
                    item.id ===
                    current,
                )
              ) {
                return current;
              }

              return (
                nextClasses[0]
                  ?.id ??
                null
              );
            },
          );
        } catch (
          loadError
        ) {
          console.log(
            'LOAD HOMEROOM BEHAVIOR:',
            loadError,
          );

          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Could not load student behavior.',
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [],
    );

  useFocusEffect(
    useCallback(
      () => {
        void loadData();
      },
      [
        loadData,
      ],
    ),
  );

  /* =====================================================
   * DATA
   * =================================================== */

  const selectedClass =
    useMemo(
      () =>
        classes.find(
          classroom =>
            classroom.id ===
            selectedClassId,
        ) ??
        null,
      [
        classes,
        selectedClassId,
      ],
    );

  const classStudents =
    useMemo(
      () =>
        students.filter(
          student =>
            student.class_id ===
            selectedClassId,
        ),
      [
        students,
        selectedClassId,
      ],
    );

  const visibleStudents =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        return classStudents.filter(
          student => {
            if (!query) {
              return true;
            }

            return (
              `${student.full_name} ${student.student_id ?? ''}`
                .toLowerCase()
                .includes(
                  query,
                )
            );
          },
        );
      },
      [
        classStudents,
        search,
      ],
    );

  const classRecords =
    useMemo(
      () =>
        records.filter(
          record =>
            record.class_id ===
            selectedClassId,
        ),
      [
        records,
        selectedClassId,
      ],
    );

  const recentRecords =
    classRecords.slice(
      0,
      8,
    );

  function latestRecordFor(
    studentUserId: string,
  ) {
    return (
      classRecords.find(
        record =>
          record.student_user_id ===
          studentUserId,
      ) ??
      null
    );
  }

  function recordCountFor(
    studentUserId: string,
  ) {
    return classRecords.filter(
      record =>
        record.student_user_id ===
        studentUserId,
    ).length;
  }

  /* =====================================================
   * MODAL
   * =================================================== */

  function openStudent(
    student:
      HomeroomStudent,
  ) {
    setSelectedStudent(
      student,
    );

    setBehaviorType(
      'positive',
    );

    setReason('');
    setNote('');
    setFormError('');

    setAddOpen(true);
  }

  function closeAdd() {
    if (saving) {
      return;
    }

    setAddOpen(false);

    setSelectedStudent(
      null,
    );

    setFormError('');
  }

  /* =====================================================
   * SAVE
   * =================================================== */

  async function saveBehavior() {
    if (
      !selectedStudent ||
      saving
    ) {
      return;
    }

    const cleanReason =
      reason.trim();

    const cleanNote =
      note.trim();

    setFormError('');

    if (
      cleanReason.length <
      2
    ) {
      setFormError(
        'Enter a short reason.',
      );

      return;
    }

    if (
      cleanReason.length >
      120
    ) {
      setFormError(
        'Reason is too long.',
      );

      return;
    }

    try {
      setSaving(true);

      const {
        error:
          saveError,
      } =
        await supabase.rpc(
          'add_my_homeroom_behavior',
          {
            p_student_user_id:
              selectedStudent.user_id,

            p_behavior_type:
              behaviorType,

            p_reason:
              cleanReason,

            p_note:
              cleanNote ||
              null,
          },
        );

      if (saveError) {
        throw saveError;
      }

      setAddOpen(false);

      setSelectedStudent(
        null,
      );

      setReason('');
      setNote('');

      await loadData();
    } catch (
      saveError
    ) {
      console.log(
        'SAVE HOMEROOM BEHAVIOR:',
        saveError,
      );

      setFormError(
        saveError instanceof Error
          ? saveError.message
          : 'Could not save behavior record.',
      );
    } finally {
      setSaving(false);
    }
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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              void loadData(
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
            Student Behavior
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Record behavior for your homeroom students.
          </Text>
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
              size={20}
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
              Loading students...
            </Text>
          </View>
        ) : null}

        {/* NO HOMEROOM */}

        {!loading &&
        !error &&
        classes.length === 0 ? (
          <View
            style={
              styles.noClassCard
            }
          >
            <View
              style={
                styles.noClassIcon
              }
            >
              <Ionicons
                name="people-outline"
                size={28}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={
                styles.noClassTitle
              }
            >
              No homeroom class
            </Text>

            <Text
              style={
                styles.noClassText
              }
            >
              Student Behavior is available only to homeroom teachers.
            </Text>
          </View>
        ) : null}

        {!loading &&
        selectedClass ? (
          <>
            {/* CLASS */}

            <View
              style={
                styles.classCard
              }
            >
              <View
                style={
                  styles.classIcon
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
                  styles.classInfo
                }
              >
                <Text
                  style={
                    styles.classLabel
                  }
                >
                  Homeroom Class
                </Text>

                <Text
                  style={
                    styles.className
                  }
                >
                  {
                    selectedClass.class_name
                  }
                </Text>
              </View>

              <View
                style={
                  styles.studentCount
                }
              >
                <Text
                  style={
                    styles.studentCountNumber
                  }
                >
                  {
                    classStudents.length
                  }
                </Text>

                <Text
                  style={
                    styles.studentCountLabel
                  }
                >
                  Students
                </Text>
              </View>
            </View>

            {/* MULTIPLE CLASSES */}

            {classes.length >
            1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  styles.classTabs
                }
              >
                {classes.map(
                  classroom => {
                    const active =
                      classroom.id ===
                      selectedClassId;

                    return (
                      <Pressable
                        key={
                          classroom.id
                        }
                        onPress={() =>
                          setSelectedClassId(
                            classroom.id,
                          )
                        }
                        style={[
                          styles.classTab,

                          active &&
                            styles.classTabActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.classTabText,

                            active &&
                              styles.classTabTextActive,
                          ]}
                        >
                          {
                            classroom.class_name
                          }
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </ScrollView>
            ) : null}

            {/* STUDENTS HEADER */}

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
                Students
              </Text>

              <View
                style={
                  styles.sectionCountBadge
                }
              >
                <Text
                  style={
                    styles.sectionCountText
                  }
                >
                  {
                    visibleStudents.length
                  }
                </Text>
              </View>
            </View>

            {/* SEARCH */}

            <View
              style={
                styles.searchBox
              }
            >
              <Ionicons
                name="search-outline"
                size={20}
                color={
                  colors.textMuted
                }
              />

              <TextInput
                value={
                  search
                }
                onChangeText={
                  setSearch
                }
                placeholder="Search student"
                placeholderTextColor={
                  colors.textMuted
                }
                style={
                  styles.searchInput
                }
              />

              {search ? (
                <Pressable
                  onPress={() =>
                    setSearch('')
                  }
                  hitSlop={10}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={
                      colors.textMuted
                    }
                  />
                </Pressable>
              ) : null}
            </View>

            {/* STUDENT LIST */}

            <View
              style={
                styles.studentList
              }
            >
              {visibleStudents.length ===
              0 ? (
                <View
                  style={
                    styles.emptyStudents
                  }
                >
                  <Text
                    style={
                      styles.emptyStudentsText
                    }
                  >
                    No students found.
                  </Text>
                </View>
              ) : (
                visibleStudents.map(
                  student => {
                    const latest =
                      latestRecordFor(
                        student.user_id,
                      );

                    const count =
                      recordCountFor(
                        student.user_id,
                      );

                    return (
                      <Pressable
                        key={
                          student.user_id
                        }
                        onPress={() =>
                          openStudent(
                            student,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.studentRow,

                          pressed &&
                            styles.studentRowPressed,
                        ]}
                      >
                        <StudentAvatar
                          student={
                            student
                          }
                          styles={
                            styles
                          }
                          colors={
                            colors
                          }
                        />

                        <View
                          style={
                            styles.studentMain
                          }
                        >
                          <View
                            style={
                              styles.studentTopRow
                            }
                          >
                            <View
                              style={
                                styles.studentInfo
                              }
                            >
                              <Text
                                style={
                                  styles.studentName
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  student.full_name
                                }
                              </Text>

                              <Text
                                style={
                                  styles.studentId
                                }
                              >
                                {student.student_id ??
                                  'Student'}
                              </Text>
                            </View>

                            <Ionicons
                              name="add-circle-outline"
                              size={25}
                              color={
                                colors.primary
                              }
                            />
                          </View>

                          <View
                            style={
                              styles.studentBottomRow
                            }
                          >
                            {latest ? (
                              <BehaviorBadge
                                type={
                                  latest.behavior_type
                                }
                                styles={
                                  styles
                                }
                              />
                            ) : (
                              <Text
                                style={
                                  styles.noRecordText
                                }
                              >
                                No behavior records
                              </Text>
                            )}

                            {count >
                            0 ? (
                              <Text
                                style={
                                  styles.recordCountText
                                }
                              >
                                {count}{' '}
                                {count ===
                                1
                                  ? 'record'
                                  : 'records'}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Pressable>
                    );
                  },
                )
              )}
            </View>

            {/* RECENT */}

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
                Recent Activity
              </Text>
            </View>

            {recentRecords.length ===
            0 ? (
              <View
                style={
                  styles.noActivityCard
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={27}
                  color={
                    colors.textMuted
                  }
                />

                <Text
                  style={
                    styles.noActivityText
                  }
                >
                  No behavior records yet.
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.activityList
                }
              >
                {recentRecords.map(
                  record => (
                    <View
                      key={
                        record.id
                      }
                      style={
                        styles.activityCard
                      }
                    >
                      <View
                        style={
                          styles.activityTop
                        }
                      >
                        <View
                          style={
                            styles.activityNameArea
                          }
                        >
                          <Text
                            style={
                              styles.activityName
                            }
                            numberOfLines={
                              1
                            }
                          >
                            {
                              record.student_name
                            }
                          </Text>

                          <Text
                            style={
                              styles.activityDate
                            }
                          >
                            {
                              readableDate(
                                record.behavior_date,
                              )
                            }
                          </Text>
                        </View>

                        <BehaviorBadge
                          type={
                            record.behavior_type
                          }
                          styles={
                            styles
                          }
                        />
                      </View>

                      <Text
                        style={
                          styles.activityReason
                        }
                      >
                        {
                          record.reason
                        }
                      </Text>

                      {record.note ? (
                        <Text
                          style={
                            styles.activityNote
                          }
                        >
                          {
                            record.note
                          }
                        </Text>
                      ) : null}
                    </View>
                  ),
                )}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>

      {/* ================================================= */}
      {/* ADD MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          addOpen
        }
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={
          closeAdd
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.modalScroll
            }
            keyboardShouldPersistTaps="handled"
          >
            <View
              style={
                styles.modalCard
              }
            >
              {/* HEADER */}

              <View
                style={
                  styles.modalHeader
                }
              >
                <View
                  style={
                    styles.modalTitleArea
                  }
                >
                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    Add Behavior
                  </Text>

                  <Text
                    style={
                      styles.modalStudent
                    }
                    numberOfLines={1}
                  >
                    {selectedStudent
                      ?.full_name ??
                      'Student'}
                  </Text>
                </View>

                <Pressable
                  onPress={
                    closeAdd
                  }
                  disabled={
                    saving
                  }
                  style={
                    styles.closeButton
                  }
                >
                  <Ionicons
                    name="close"
                    size={22}
                    color={
                      colors.text
                    }
                  />
                </Pressable>
              </View>

              {/* TYPE */}

              <Text
                style={
                  styles.fieldLabel
                }
              >
                Behavior type
              </Text>

              <View
                style={
                  compact
                    ? styles.behaviorChoicesCompact
                    : styles.behaviorChoices
                }
              >
                <BehaviorChoice
                  title="Positive"
                  icon="checkmark-circle-outline"
                  type="positive"
                  selected={
                    behaviorType ===
                    'positive'
                  }
                  onPress={() =>
                    setBehaviorType(
                      'positive',
                    )
                  }
                  styles={
                    styles
                  }
                />

                <BehaviorChoice
                  title="Reminder"
                  icon="notifications-outline"
                  type="reminder"
                  selected={
                    behaviorType ===
                    'reminder'
                  }
                  onPress={() =>
                    setBehaviorType(
                      'reminder',
                    )
                  }
                  styles={
                    styles
                  }
                />

                <BehaviorChoice
                  title="Concern"
                  icon="alert-circle-outline"
                  type="concern"
                  selected={
                    behaviorType ===
                    'concern'
                  }
                  onPress={() =>
                    setBehaviorType(
                      'concern',
                    )
                  }
                  styles={
                    styles
                  }
                />
              </View>

              {/* REASON */}

              <Text
                style={[
                  styles.fieldLabel,
                  styles.fieldSpacing,
                ]}
              >
                Reason
              </Text>

              <TextInput
                value={
                  reason
                }
                onChangeText={
                  setReason
                }
                placeholder={
                  behaviorType ===
                  'positive'
                    ? 'Example: Helped another student'
                    : behaviorType ===
                        'reminder'
                      ? 'Example: Talking during class'
                      : 'Example: Repeated classroom issue'
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
                  styles.fieldLabel,
                  styles.fieldSpacing,
                ]}
              >
                Note
              </Text>

              <TextInput
                value={
                  note
                }
                onChangeText={
                  setNote
                }
                placeholder="Optional details"
                placeholderTextColor={
                  colors.textMuted
                }
                maxLength={500}
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.noteInput,
                ]}
              />

              {formError ? (
                <View
                  style={
                    styles.formError
                  }
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={18}
                    color={
                      colors.danger
                    }
                  />

                  <Text
                    style={
                      styles.formErrorText
                    }
                  >
                    {
                      formError
                    }
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() =>
                  void saveBehavior()
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
                      name="checkmark"
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.saveButtonText
                      }
                    >
                      Save Record
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================================================
 * STUDENT AVATAR
 * ======================================================= */

function StudentAvatar({
  student,
  styles,
  colors,
}: {
  student:
    HomeroomStudent;

  styles:
    ReturnType<
      typeof createStyles
    >;

  colors:
    AppThemeColors;
}) {
  const initial =
    student.full_name
      .trim()
      .charAt(0)
      .toUpperCase() ||
    'S';

  return (
    <View
      style={
        styles.avatar
      }
    >
      {student.avatar_url ? (
        <Image
          source={{
            uri:
              student.avatar_url,
          }}
          style={
            styles.avatarImage
          }
        />
      ) : (
        <Text
          style={[
            styles.avatarInitial,

            {
              color:
                colors.primary,
            },
          ]}
        >
          {initial}
        </Text>
      )}
    </View>
  );
}

/* =========================================================
 * BADGE
 * ======================================================= */

function BehaviorBadge({
  type,
  styles,
}: {
  type:
    BehaviorType;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  return (
    <View
      style={[
        styles.behaviorBadge,

        type ===
          'positive' &&
          styles.positiveBadge,

        type ===
          'reminder' &&
          styles.reminderBadge,

        type ===
          'concern' &&
          styles.concernBadge,
      ]}
    >
      <View
        style={[
          styles.behaviorDot,

          type ===
            'positive' &&
            styles.positiveDot,

          type ===
            'reminder' &&
            styles.reminderDot,

          type ===
            'concern' &&
            styles.concernDot,
        ]}
      />

      <Text
        style={[
          styles.behaviorBadgeText,

          type ===
            'positive' &&
            styles.positiveText,

          type ===
            'reminder' &&
            styles.reminderText,

          type ===
            'concern' &&
            styles.concernText,
        ]}
      >
        {
          behaviorLabel(
            type,
          )
        }
      </Text>
    </View>
  );
}

/* =========================================================
 * BEHAVIOR CHOICE
 * ======================================================= */

function BehaviorChoice({
  title,
  icon,
  type,
  selected,
  onPress,
  styles,
}: {
  title: string;

  icon:
    | 'checkmark-circle-outline'
    | 'notifications-outline'
    | 'alert-circle-outline';

  type:
    BehaviorType;

  selected:
    boolean;

  onPress:
    () => void;

  styles:
    ReturnType<
      typeof createStyles
    >;
}) {
  const color =
    type ===
    'positive'
      ? '#239D68'
      : type ===
          'reminder'
        ? '#B77900'
        : '#DD4658';

  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.behaviorChoice,

        selected &&
          styles.behaviorChoiceSelected,

        selected &&
        type ===
          'positive' &&
          styles.behaviorChoicePositive,

        selected &&
        type ===
          'reminder' &&
          styles.behaviorChoiceReminder,

        selected &&
        type ===
          'concern' &&
          styles.behaviorChoiceConcern,
      ]}
    >
      <Ionicons
        name={
          icon
        }
        size={21}
        color={
          color
        }
      />

      <Text
        style={
          styles.behaviorChoiceText
        }
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

  compact:
    boolean,

  tablet:
    boolean,
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
      width:
        '100%',

      maxWidth:
        tablet
          ? 760
          : undefined,

      alignSelf:
        'center',

      paddingHorizontal:
        compact
          ? 12
          : 16,

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

      minHeight: 44,

      paddingHorizontal: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,

      borderRadius: 13,

      backgroundColor:
        colors.surfaceSecondary,
    },

    backText: {
      fontSize: 14,

      fontWeight:
        '700',

      color:
        colors.text,
    },

    /* TITLE */

    titleArea: {
      marginTop: 20,

      marginBottom: 18,
    },

    title: {
      fontSize:
        compact
          ? 22
          : 24,

      lineHeight:
        compact
          ? 27
          : 30,

      fontWeight:
        '800',

      letterSpacing:
        -0.4,

      color:
        colors.text,
    },

    subtitle: {
      marginTop: 4,

      fontSize:
        compact
          ? 12
          : 13,

      lineHeight: 18,

      fontWeight:
        '500',

      color:
        colors.textMuted,
    },

    /* ERROR */

    errorCard: {
      minHeight: 56,

      marginBottom: 12,

      padding: 12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 9,

      borderRadius: 15,

      backgroundColor:
        '#FFF0F2',
    },

    errorText: {
      flex: 1,

      fontSize: 12,

      lineHeight: 17,

      fontWeight:
        '700',

      color:
        colors.danger,
    },

    /* LOADING */

    loadingCard: {
      minHeight: 190,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 21,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    loadingText: {
      marginTop: 11,

      fontSize: 13,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* NO CLASS */

    noClassCard: {
      minHeight: 220,

      paddingHorizontal: 28,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 21,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    noClassIcon: {
      width: 60,

      height: 60,

      borderRadius: 19,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    noClassTitle: {
      marginTop: 14,

      fontSize: 17,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    noClassText: {
      marginTop: 6,

      textAlign:
        'center',

      fontSize: 12,

      lineHeight: 18,

      color:
        colors.textMuted,
    },

    /* CLASS */

    classCard: {
      minHeight: 88,

      paddingHorizontal: 14,

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

    classIcon: {
      width:
        compact
          ? 46
          : 50,

      height:
        compact
          ? 46
          : 50,

      borderRadius: 15,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    classInfo: {
      flex: 1,

      minWidth: 0,

      marginLeft: 12,
    },

    classLabel: {
      fontSize: 11,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    className: {
      marginTop: 3,

      fontSize: 16,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    studentCount: {
      minWidth: 60,

      alignItems:
        'center',
    },

    studentCountNumber: {
      fontSize: 21,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    studentCountLabel: {
      marginTop: 2,

      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* CLASS TABS */

    classTabs: {
      paddingTop: 10,

      gap: 8,
    },

    classTab: {
      minHeight: 38,

      paddingHorizontal: 14,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius: 12,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    classTabActive: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    classTabText: {
      fontSize: 12,

      fontWeight:
        '700',

      color:
        colors.textMuted,
    },

    classTabTextActive: {
      color:
        colors.primary,

      fontWeight:
        '800',
    },

    /* SECTION */

    sectionHeader: {
      marginTop: 26,

      marginBottom: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    sectionTitle: {
      fontSize: 16,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    sectionCountBadge: {
      minWidth: 31,

      height: 31,

      paddingHorizontal: 8,

      borderRadius: 10,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    sectionCountText: {
      fontSize: 11,

      fontWeight:
        '800',

      color:
        colors.primary,
    },

    /* SEARCH */

    searchBox: {
      minHeight: 52,

      paddingHorizontal: 13,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 9,

      borderRadius: 15,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.input,
    },

    searchInput: {
      flex: 1,

      height: 50,

      fontSize: 14,

      fontWeight:
        '500',

      color:
        colors.text,
    },

    /* STUDENTS */

    studentList: {
      marginTop: 10,

      overflow:
        'hidden',

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    studentRow: {
      minHeight:
        compact
          ? 86
          : 90,

      paddingHorizontal: 12,

      paddingVertical: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.border,
    },

    studentRowPressed: {
      backgroundColor:
        colors.surfaceSecondary,
    },

    avatar: {
      width:
        compact
          ? 46
          : 50,

      height:
        compact
          ? 46
          : 50,

      borderRadius: 25,

      overflow:
        'hidden',

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    avatarImage: {
      width:
        '100%',

      height:
        '100%',
    },

    avatarInitial: {
      fontSize: 17,

      fontWeight:
        '800',
    },

    studentMain: {
      flex: 1,

      minWidth: 0,

      marginLeft: 11,
    },

    studentTopRow: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    studentInfo: {
      flex: 1,

      minWidth: 0,

      marginRight: 8,
    },

    studentName: {
      fontSize:
        compact
          ? 13
          : 14,

      lineHeight: 19,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    studentId: {
      marginTop: 3,

      fontSize: 10.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    studentBottomRow: {
      minHeight: 27,

      marginTop: 7,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    noRecordText: {
      fontSize: 10.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    recordCountText: {
      marginLeft: 8,

      fontSize: 9.5,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    emptyStudents: {
      minHeight: 105,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyStudentsText: {
      fontSize: 12,

      color:
        colors.textMuted,
    },

    /* BADGE */

    behaviorBadge: {
      minHeight: 27,

      paddingHorizontal: 8,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 5,

      borderRadius: 9,
    },

    behaviorDot: {
      width: 6,

      height: 6,

      borderRadius: 3,
    },

    behaviorBadgeText: {
      fontSize: 9.5,

      fontWeight:
        '800',
    },

    positiveBadge: {
      backgroundColor:
        '#E8F8F0',
    },

    positiveDot: {
      backgroundColor:
        '#239D68',
    },

    positiveText: {
      color:
        '#23845B',
    },

    reminderBadge: {
      backgroundColor:
        '#FFF6DF',
    },

    reminderDot: {
      backgroundColor:
        '#E0A116',
    },

    reminderText: {
      color:
        '#A86A00',
    },

    concernBadge: {
      backgroundColor:
        '#FFF0F2',
    },

    concernDot: {
      backgroundColor:
        '#E5485A',
    },

    concernText: {
      color:
        '#D83C50',
    },

    /* ACTIVITY */

    activityList: {
      gap: 10,
    },

    activityCard: {
      padding: 14,

      borderRadius: 18,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    activityTop: {
      flexDirection:
        'row',

      alignItems:
        'center',
    },

    activityNameArea: {
      flex: 1,

      minWidth: 0,

      marginRight: 8,
    },

    activityName: {
      fontSize: 13,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    activityDate: {
      marginTop: 3,

      fontSize: 10,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    activityReason: {
      marginTop: 11,

      fontSize: 13,

      lineHeight: 19,

      fontWeight:
        '700',

      color:
        colors.textSecondary,
    },

    activityNote: {
      marginTop: 5,

      fontSize: 11.5,

      lineHeight: 17,

      color:
        colors.textMuted,
    },

    noActivityCard: {
      minHeight: 120,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 9,

      borderRadius: 19,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    noActivityText: {
      fontSize: 12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    /* MODAL */

    modalOverlay: {
      flex: 1,

      backgroundColor:
        'rgba(0,0,0,0.46)',
    },

    modalScroll: {
      flexGrow: 1,

      paddingHorizontal:
        compact
          ? 12
          : 18,

      paddingVertical: 28,

      justifyContent:
        'center',
    },

    modalCard: {
      width:
        '100%',

      maxWidth: 430,

      alignSelf:
        'center',

      padding:
        compact
          ? 15
          : 18,

      borderRadius: 23,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.card,
    },

    modalHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    modalTitleArea: {
      flex: 1,

      minWidth: 0,

      marginRight: 10,
    },

    modalTitle: {
      fontSize: 19,

      fontWeight:
        '800',

      color:
        colors.text,
    },

    modalStudent: {
      marginTop: 3,

      fontSize: 12,

      fontWeight:
        '600',

      color:
        colors.textMuted,
    },

    closeButton: {
      width: 42,

      height: 42,

      borderRadius: 13,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.surfaceSecondary,
    },

    fieldLabel: {
      marginTop: 20,

      marginBottom: 8,

      fontSize: 12,

      fontWeight:
        '800',

      color:
        colors.textSecondary,
    },

    fieldSpacing: {
      marginTop: 17,
    },

    behaviorChoices: {
      flexDirection:
        'row',

      gap: 8,
    },

    behaviorChoicesCompact: {
      flexDirection:
        'column',

      gap: 8,
    },

    behaviorChoice: {
      flex: 1,

      minHeight: 62,

      paddingHorizontal: 8,

      flexDirection:
        compact
          ? 'row'
          : 'column',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 6,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.surfaceSecondary,
    },

    behaviorChoiceSelected: {
      borderWidth: 1.5,
    },

    behaviorChoicePositive: {
      borderColor:
        '#71C79B',

      backgroundColor:
        '#EAF8F1',
    },

    behaviorChoiceReminder: {
      borderColor:
        '#E6BF62',

      backgroundColor:
        '#FFF8E7',
    },

    behaviorChoiceConcern: {
      borderColor:
        '#EFA6B0',

      backgroundColor:
        '#FFF1F3',
    },

    behaviorChoiceText: {
      fontSize: 11,

      fontWeight:
        '800',

      color:
        colors.textSecondary,
    },

    input: {
      minHeight: 52,

      paddingHorizontal: 13,

      borderRadius: 14,

      borderWidth: 1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.input,

      fontSize: 14,

      fontWeight:
        '500',

      color:
        colors.text,
    },

    noteInput: {
      minHeight: 95,

      paddingTop: 12,

      paddingBottom: 12,
    },

    formError: {
      minHeight: 45,

      marginTop: 11,

      paddingHorizontal: 10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap: 7,

      borderRadius: 12,

      backgroundColor:
        '#FFF0F2',
    },

    formErrorText: {
      flex: 1,

      fontSize: 11,

      lineHeight: 16,

      fontWeight:
        '700',

      color:
        colors.danger,
    },

    saveButton: {
      height: 54,

      marginTop: 18,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap: 7,

      borderRadius: 16,

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
  });
}