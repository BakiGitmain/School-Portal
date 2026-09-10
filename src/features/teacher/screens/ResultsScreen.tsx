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
  type Href,
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

type TeachingAssignment = {
  classId: string;
  className: string;

  category:
    | 'elementary'
    | 'high_school';

  gradeLabel: string;
  section: string;
  subject: string;
};

function currentSchoolYear() {
  const now =
    new Date();

  const startYear =
    now.getMonth() >= 8
      ? now.getFullYear()
      : now.getFullYear() - 1;

  return `${startYear}-${startYear + 1}`;
}

function categoryLabel(
  category:
    TeachingAssignment['category'],
) {
  return category ===
    'elementary'
    ? 'Elementary'
    : 'High School';
}

export default function ResultsScreen() {
  const router =
    useRouter();

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
    assignments,
    setAssignments,
  ] =
    useState<
      TeachingAssignment[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('');

  useFocusEffect(
    useCallback(
      () => {
        void loadAssignments();
      },
      [],
    ),
  );

  async function loadAssignments() {
    try {
      setLoading(
        true,
      );

      setErrorMessage(
        '',
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
        throw new Error(
          'Teacher account could not be loaded.',
        );
      }

      const teacherUserId =
        userData.user.id;

      const {
        data:
          assignmentRows,

        error:
          assignmentError,
      } =
        await supabase
          .from(
            'teacher_class_assignments',
          )
          .select(`
            class_id,
            subjects
          `)
          .eq(
            'teacher_user_id',
            teacherUserId,
          );

      if (
        assignmentError
      ) {
        throw assignmentError;
      }

      const classIds =
        Array.from(
          new Set(
            (
              assignmentRows ??
              []
            ).map(
              row =>
                String(
                  row.class_id,
                ),
            ),
          ),
        );

      if (
        classIds.length ===
        0
      ) {
        setAssignments(
          [],
        );

        return;
      }

      const {
        data:
          classRows,

        error:
          classError,
      } =
        await supabase
          .from(
            'school_classes',
          )
          .select(`
            id,
            category,
            grade_label,
            section,
            class_name
          `)
          .in(
            'id',
            classIds,
          );

      if (
        classError
      ) {
        throw classError;
      }

      const classMap =
        new Map<
          string,
          {
            id: string;

            category:
              TeachingAssignment['category'];

            gradeLabel:
              string;

            section:
              string;

            className:
              string;
          }
        >();

      for (
        const classroom of
        classRows ??
        []
      ) {
        classMap.set(
          String(
            classroom.id,
          ),
          {
            id:
              String(
                classroom.id,
              ),

            category:
              classroom.category as
                TeachingAssignment['category'],

            gradeLabel:
              String(
                classroom.grade_label,
              ),

            section:
              String(
                classroom.section,
              ),

            className:
              String(
                classroom.class_name,
              ),
          },
        );
      }

      const mapped:
        TeachingAssignment[] =
        [];

      const seen =
        new Set<
          string
        >();

      for (
        const row of
        assignmentRows ??
        []
      ) {
        const classroom =
          classMap.get(
            String(
              row.class_id,
            ),
          );

        if (
          !classroom
        ) {
          continue;
        }

        const subjectRows =
          Array.isArray(
            row.subjects,
          )
            ? row.subjects
            : [];

        for (
          const rawSubject of
          subjectRows
        ) {
          const subject =
            String(
              rawSubject,
            ).trim();

          if (
            !subject
          ) {
            continue;
          }

          const key =
            `${classroom.id}:${subject.toLowerCase()}`;

          if (
            seen.has(
              key,
            )
          ) {
            continue;
          }

          seen.add(
            key,
          );

          mapped.push({
            classId:
              classroom.id,

            className:
              classroom.className,

            category:
              classroom.category,

            gradeLabel:
              classroom.gradeLabel,

            section:
              classroom.section,

            subject,
          });
        }
      }

      mapped.sort(
        (
          a,
          b,
        ) => {
          const subjectCompare =
            a.subject.localeCompare(
              b.subject,
            );

          if (
            subjectCompare !==
            0
          ) {
            return subjectCompare;
          }

          return a.className.localeCompare(
            b.className,
            undefined,
            {
              numeric:
                true,
            },
          );
        },
      );

      setAssignments(
        mapped,
      );
    } catch (
      error
    ) {
      console.log(
        'LOAD MARK ASSIGNMENTS:',
        error,
      );

      setAssignments(
        [],
      );

      setErrorMessage(
        error instanceof
        Error
          ? error.message
          : 'Could not load mark sheets.',
      );
    } finally {
      setLoading(
        false,
      );
    }
  }

  const groupedAssignments =
    useMemo(
      () => {
        const groups =
          new Map<
            string,
            TeachingAssignment[]
          >();

        for (
          const item of
          assignments
        ) {
          const existing =
            groups.get(
              item.subject,
            ) ??
            [];

          existing.push(
            item,
          );

          groups.set(
            item.subject,
            existing,
          );
        }

        return Array.from(
          groups.entries(),
        );
      },
      [
        assignments,
      ],
    );

  function openMarkSheet(
    assignment:
      TeachingAssignment,
  ) {
    const href =
      `/teacher/mark-sheet/${encodeURIComponent(
        assignment.classId,
      )}?subject=${encodeURIComponent(
        assignment.subject,
      )}` as Href;

    router.push(
      href,
    );
  }

  return (
    <View
      style={[
        styles.screen,

        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.pageContent
        }
      >
        <View
          style={
            styles.pageHeading
          }
        >
          <View
            style={[
              styles.headingIcon,

              {
                backgroundColor:
                  colors.primarySoft,
              },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={22}
              color={
                colors.primary
              }
            />
          </View>

          <View
            style={
              styles.headingText
            }
          >
            <Text
              style={[
                styles.pageTitle,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              Mark Sheets
            </Text>

            <Text
              style={[
                styles.pageSubtitle,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Open a class to record, calculate and export marks.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.yearBadge,

            {
              backgroundColor:
                colors.primarySoft,
            },
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
            style={[
              styles.yearText,

              {
                color:
                  colors.primary,
              },
            ]}
          >
            {
              schoolYear
            }
          </Text>
        </View>

        {errorMessage ? (
          <View
            style={[
              styles.errorBox,

              {
                backgroundColor:
                  colors.dangerSoft,

                borderColor:
                  colors.danger,
              },
            ]}
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color={
                colors.danger
              }
            />

            <Text
              style={[
                styles.errorText,

                {
                  color:
                    colors.danger,
                },
              ]}
            >
              {
                errorMessage
              }
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View
            style={
              styles.loadingArea
            }
          >
            <ActivityIndicator
              color={
                colors.primary
              }
            />

            <Text
              style={[
                styles.loadingText,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Loading mark sheets...
            </Text>
          </View>
        ) : groupedAssignments.length ===
          0 ? (
          <View
            style={[
              styles.emptyCard,

              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.emptyIcon,

                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name="documents-outline"
                size={27}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={[
                styles.emptyTitle,

                {
                  color:
                    colors.text,
                },
              ]}
            >
              No mark sheets
            </Text>

            <Text
              style={[
                styles.emptyText,

                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              Your assigned classroom subjects will appear here.
            </Text>
          </View>
        ) : (
          groupedAssignments.map(
            (
              [
                subject,
                subjectAssignments,
              ],
            ) => (
              <View
                key={
                  subject
                }
                style={
                  styles.subjectSection
                }
              >
                <View
                  style={
                    styles.subjectHeader
                  }
                >
                  <View
                    style={
                      styles.subjectHeadingText
                    }
                  >
                    <Text
                      style={[
                        styles.subjectName,

                        {
                          color:
                            colors.text,
                        },
                      ]}
                    >
                      {
                        subject
                      }
                    </Text>

                    <Text
                      style={[
                        styles.subjectCount,

                        {
                          color:
                            colors.textMuted,
                        },
                      ]}
                    >
                      {
                        subjectAssignments.length
                      }{' '}
                      class
                      {
                        subjectAssignments.length ===
                        1
                          ? ''
                          : 'es'
                      }
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.subjectIcon,

                      {
                        backgroundColor:
                          colors.primarySoft,
                      },
                    ]}
                  >
                    <Ionicons
                      name="book-outline"
                      size={18}
                      color={
                        colors.primary
                      }
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.sheetList
                  }
                >
                  {subjectAssignments.map(
                    assignment => (
                      <Pressable
                        key={
                          `${assignment.classId}-${assignment.subject}`
                        }
                        onPress={() =>
                          openMarkSheet(
                            assignment,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.sheetCard,

                          {
                            backgroundColor:
                              colors.card,

                            borderColor:
                              colors.border,

                            opacity:
                              pressed
                                ? 0.68
                                : 1,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.sheetIcon,

                            {
                              backgroundColor:
                                colors.primarySoft,
                            },
                          ]}
                        >
                          <Ionicons
                            name="grid-outline"
                            size={20}
                            color={
                              colors.primary
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.sheetInfo
                          }
                        >
                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.sheetTitle,

                              {
                                color:
                                  colors.text,
                              },
                            ]}
                          >
                            {
                              assignment.className
                            }{' '}
                            Mark Sheet
                          </Text>

                          <Text
                            numberOfLines={
                              1
                            }
                            style={[
                              styles.sheetMeta,

                              {
                                color:
                                  colors.textMuted,
                              },
                            ]}
                          >
                            {categoryLabel(
                              assignment.category,
                            )}

                            {' • '}

                            {
                              assignment.subject
                            }
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={20}
                          color={
                            colors.textMuted
                          }
                        />
                      </Pressable>
                    ),
                  )}
                </View>
              </View>
            ),
          )
        )}
      </ScrollView>
    </View>
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
    },

    pageContent: {
      paddingHorizontal:
        16,

      paddingTop:
        18,

      paddingBottom:
        120,
    },

    pageHeading: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        11,
    },

    headingIcon: {
      width:
        46,

      height:
        46,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink:
        0,
    },

    headingText: {
      flex:
        1,

      minWidth:
        0,
    },

    pageTitle: {
      fontSize:
        20,

      lineHeight:
        25,

      fontWeight:
        '900',
    },

    pageSubtitle: {
      marginTop:
        3,

      fontSize:
        12,

      lineHeight:
        17,

      fontWeight:
        '600',
    },

    yearBadge: {
      alignSelf:
        'flex-start',

      marginTop:
        15,

      minHeight:
        32,

      paddingHorizontal:
        10,

      borderRadius:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        6,
    },

    yearText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    errorBox: {
      marginTop:
        16,

      minHeight:
        50,

      paddingHorizontal:
        13,

      paddingVertical:
        10,

      borderWidth:
        1,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        8,
    },

    errorText: {
      flex:
        1,

      fontSize:
        12,

      lineHeight:
        17,

      fontWeight:
        '700',
    },

    loadingArea: {
      minHeight:
        300,

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,
    },

    loadingText: {
      fontSize:
        12,

      fontWeight:
        '600',
    },

    emptyCard: {
      marginTop:
        25,

      minHeight:
        250,

      padding:
        25,

      borderWidth:
        1,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyIcon: {
      width:
        56,

      height:
        56,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop:
        12,

      fontSize:
        16,

      lineHeight:
        21,

      fontWeight:
        '900',
    },

    emptyText: {
      marginTop:
        5,

      maxWidth:
        250,

      textAlign:
        'center',

      fontSize:
        12,

      lineHeight:
        17,

      fontWeight:
        '600',
    },

    subjectSection: {
      marginTop:
        25,
    },

    subjectHeader: {
      marginBottom:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    subjectHeadingText: {
      flex:
        1,

      minWidth:
        0,

      paddingRight:
        10,
    },

    subjectName: {
      fontSize:
        17,

      lineHeight:
        22,

      fontWeight:
        '900',
    },

    subjectCount: {
      marginTop:
        2,

      fontSize:
        11,

      fontWeight:
        '600',
    },

    subjectIcon: {
      width:
        36,

      height:
        36,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    sheetList: {
      gap:
        8,
    },

    sheetCard: {
      minHeight:
        76,

      paddingHorizontal:
        13,

      paddingVertical:
        11,

      borderWidth:
        1,

      borderRadius:
        18,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    sheetIcon: {
      width:
        44,

      height:
        44,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      flexShrink:
        0,
    },

    sheetInfo: {
      flex:
        1,

      minWidth:
        0,

      marginLeft:
        11,

      marginRight:
        8,
    },

    sheetTitle: {
      fontSize:
        14,

      lineHeight:
        19,

      fontWeight:
        '800',
    },

    sheetMeta: {
      marginTop:
        4,

      fontSize:
        11,

      lineHeight:
        15,

      fontWeight:
        '600',
    },
  });
}