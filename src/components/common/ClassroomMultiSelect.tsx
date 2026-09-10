import React, {
  useMemo,
  useState,
} from 'react';

import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  useAppSettings,
  type AppThemeColors,
} from '../../context/AppSettingsContext';

export type ClassroomOption = {
  id: string;

  category:
    | 'elementary'
    | 'high_school';

  grade_label: string;

  section: string;

  class_name: string;
};

export type ClassroomAssignment = {
  classId: string;

  subjects: string[];
};

type Props = {
  value: ClassroomAssignment[];

  onChange:
    (
      value:
        ClassroomAssignment[],
    ) => void;

  options:
    ClassroomOption[];

  subjects:
    string[];

  disabled?: boolean;
};

function categoryLabel(
  category:
    ClassroomOption['category'],
) {
  return category ===
    'elementary'
    ? 'Elementary'
    : 'High School';
}

function gradeLabel(
  grade: string,
) {
  if (
    grade === 'Nursery' ||
    grade === 'LKG' ||
    grade === 'UKG'
  ) {
    return grade;
  }

  return `Grade ${grade}`;
}

function gradeOrder(
  grade: string,
) {
  if (
    grade === 'Nursery'
  ) {
    return 0;
  }

  if (
    grade === 'LKG'
  ) {
    return 1;
  }

  if (
    grade === 'UKG'
  ) {
    return 2;
  }

  const numeric =
    Number(
      grade,
    );

  if (
    Number.isFinite(
      numeric,
    )
  ) {
    return (
      10 +
      numeric
    );
  }

  return 999;
}

function uniqueSubjects(
  values: string[],
) {
  const map =
    new Map<
      string,
      string
    >();

  for (
    const value of
    values
  ) {
    const clean =
      value.trim();

    if (
      !clean
    ) {
      continue;
    }

    const key =
      clean.toLowerCase();

    if (
      !map.has(
        key,
      )
    ) {
      map.set(
        key,
        clean,
      );
    }
  }

  return Array.from(
    map.values(),
  );
}

export default function ClassroomMultiSelect({
  value,
  onChange,
  options,
  subjects,
  disabled = false,
}: Props) {
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
    open,
    setOpen,
  ] =
    useState(
      false,
    );

  const [
    search,
    setSearch,
  ] =
    useState('');

  const availableSubjects =
    useMemo(
      () =>
        uniqueSubjects(
          subjects,
        ),
      [
        subjects,
      ],
    );

  const assignmentMap =
    useMemo(
      () =>
        new Map(
          value.map(
            (
              assignment,
            ) => [
              assignment.classId,
              assignment,
            ],
          ),
        ),
      [
        value,
      ],
    );

  const sortedOptions =
    useMemo(
      () =>
        [...options].sort(
          (
            a,
            b,
          ) => {
            const categoryA =
              a.category ===
              'elementary'
                ? 0
                : 1;

            const categoryB =
              b.category ===
              'elementary'
                ? 0
                : 1;

            if (
              categoryA !==
              categoryB
            ) {
              return (
                categoryA -
                categoryB
              );
            }

            const gradeA =
              gradeOrder(
                a.grade_label,
              );

            const gradeB =
              gradeOrder(
                b.grade_label,
              );

            if (
              gradeA !==
              gradeB
            ) {
              return (
                gradeA -
                gradeB
              );
            }

            return a.section.localeCompare(
              b.section,
            );
          },
        ),
      [
        options,
      ],
    );

  const filteredOptions =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();

        if (
          !term
        ) {
          return sortedOptions;
        }

        return sortedOptions.filter(
          (
            option,
          ) =>
            [
              option.class_name,
              option.grade_label,
              option.section,
              categoryLabel(
                option.category,
              ),
            ]
              .join(' ')
              .toLowerCase()
              .includes(
                term,
              ),
        );
      },
      [
        search,
        sortedOptions,
      ],
    );

  const elementary =
    filteredOptions.filter(
      (
        option,
      ) =>
        option.category ===
        'elementary',
    );

  const highSchool =
    filteredOptions.filter(
      (
        option,
      ) =>
        option.category ===
        'high_school',
    );

  const selectedOptions =
    sortedOptions.filter(
      (
        option,
      ) =>
        assignmentMap.has(
          option.id,
        ),
    );

  const incomplete =
    value.some(
      (
        assignment,
      ) =>
        assignment.subjects.length ===
        0,
    );

  const totalMappedSubjects =
    value.reduce(
      (
        total,
        assignment,
      ) =>
        total +
        assignment.subjects.length,
      0,
    );

  function toggleClass(
    classId: string,
  ) {
    const existing =
      assignmentMap.get(
        classId,
      );

    if (
      existing
    ) {
      onChange(
        value.filter(
          (
            assignment,
          ) =>
            assignment.classId !==
            classId,
        ),
      );

      return;
    }

    onChange([
      ...value,

      {
        classId,

        subjects: [],
      },
    ]);
  }

  function toggleSubject(
    classId: string,
    subject: string,
  ) {
    onChange(
      value.map(
        (
          assignment,
        ) => {
          if (
            assignment.classId !==
            classId
          ) {
            return assignment;
          }

          const selected =
            assignment.subjects.some(
              (
                current,
              ) =>
                current.toLowerCase() ===
                subject.toLowerCase(),
            );

          if (
            selected
          ) {
            return {
              ...assignment,

              subjects:
                assignment.subjects.filter(
                  (
                    current,
                  ) =>
                    current.toLowerCase() !==
                    subject.toLowerCase(),
                ),
            };
          }

          return {
            ...assignment,

            subjects: [
              ...assignment.subjects,
              subject,
            ],
          };
        },
      ),
    );
  }

  function removeClass(
    classId: string,
  ) {
    onChange(
      value.filter(
        (
          assignment,
        ) =>
          assignment.classId !==
          classId,
      ),
    );
  }

  function close() {
    setOpen(
      false,
    );

    setSearch('');
  }

  function renderSection(
    title: string,

    items:
      ClassroomOption[],
  ) {
    if (
      items.length ===
      0
    ) {
      return null;
    }

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

        <View
          style={
            styles.optionList
          }
        >
          {items.map(
            (
              option,
            ) => {
              const assignment =
                assignmentMap.get(
                  option.id,
                );

              const selected =
                Boolean(
                  assignment,
                );

              return (
                <View
                  key={
                    option.id
                  }
                  style={[
                    styles.classCard,

                    selected &&
                      styles.classCardSelected,
                  ]}
                >
                  <Pressable
                    onPress={() =>
                      toggleClass(
                        option.id,
                      )
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.classTopRow,

                      pressed &&
                        styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.classIcon,

                        selected &&
                          styles.classIconSelected,
                      ]}
                    >
                      <Ionicons
                        name="school-outline"
                        size={
                          19
                        }
                        color={
                          selected
                            ? colors.primary
                            : colors.textMuted
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
                          styles.className
                        }
                      >
                        {
                          option.class_name
                        }
                      </Text>

                      <Text
                        style={
                          styles.classMeta
                        }
                      >
                        {categoryLabel(
                          option.category,
                        )}

                        {' • '}

                        {gradeLabel(
                          option.grade_label,
                        )}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.checkbox,

                        selected &&
                          styles.checkboxSelected,
                      ]}
                    >
                      {selected ? (
                        <Ionicons
                          name="checkmark"
                          size={
                            15
                          }
                          color="#FFFFFF"
                        />
                      ) : null}
                    </View>
                  </Pressable>

                  {selected ? (
                    <View
                      style={
                        styles.subjectArea
                      }
                    >
                      <View
                        style={
                          styles.subjectHeader
                        }
                      >
                        <Text
                          style={
                            styles.subjectTitle
                          }
                        >
                          Subjects in {
                            option.class_name
                          }
                        </Text>

                        <Text
                          style={
                            styles.subjectCount
                          }
                        >
                          {
                            assignment
                              ?.subjects
                              .length ??
                            0
                          } selected
                        </Text>
                      </View>

                      {availableSubjects.length ===
                      0 ? (
                        <View
                          style={
                            styles.noSubjectsBox
                          }
                        >
                          <Ionicons
                            name="information-circle-outline"
                            size={
                              17
                            }
                            color={
                              colors.textMuted
                            }
                          />

                          <Text
                            style={
                              styles.noSubjectsText
                            }
                          >
                            Choose the teacher's subjects first.
                          </Text>
                        </View>
                      ) : (
                        <View
                          style={
                            styles.subjectGrid
                          }
                        >
                          {availableSubjects.map(
                            (
                              subject,
                            ) => {
                              const subjectSelected =
                                assignment
                                  ?.subjects
                                  .some(
                                    (
                                      current,
                                    ) =>
                                      current.toLowerCase() ===
                                      subject.toLowerCase(),
                                  ) ??
                                false;

                              return (
                                <Pressable
                                  key={
                                    subject
                                  }
                                  onPress={() =>
                                    toggleSubject(
                                      option.id,
                                      subject,
                                    )
                                  }
                                  style={({
                                    pressed,
                                  }) => [
                                    styles.subjectButton,

                                    subjectSelected &&
                                      styles.subjectButtonSelected,

                                    pressed &&
                                      styles.pressed,
                                  ]}
                                >
                                  <View
                                    style={[
                                      styles.subjectCheck,

                                      subjectSelected &&
                                        styles.subjectCheckSelected,
                                    ]}
                                  >
                                    {subjectSelected ? (
                                      <Ionicons
                                        name="checkmark"
                                        size={
                                          12
                                        }
                                        color="#FFFFFF"
                                      />
                                    ) : null}
                                  </View>

                                  <Text
                                    style={[
                                      styles.subjectButtonText,

                                      subjectSelected &&
                                        styles.subjectButtonTextSelected,
                                    ]}
                                  >
                                    {
                                      subject
                                    }
                                  </Text>
                                </Pressable>
                              );
                            },
                          )}
                        </View>
                      )}

                      {assignment
                        ?.subjects
                        .length ===
                      0 ? (
                        <View
                          style={
                            styles.warningRow
                          }
                        >
                          <Ionicons
                            name="alert-circle-outline"
                            size={
                              15
                            }
                            color={
                              colors.danger
                            }
                          />

                          <Text
                            style={
                              styles.warningText
                            }
                          >
                            Choose at least one subject for this classroom.
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            },
          )}
        </View>
      </View>
    );
  }

  return (
    <>
      <Pressable
        disabled={
          disabled
        }
        onPress={() =>
          setOpen(
            true,
          )
        }
        style={({
          pressed,
        }) => [
          styles.selector,

          disabled &&
            styles.disabled,

          pressed &&
            !disabled &&
            styles.pressed,
        ]}
      >
        <View
          style={
            styles.selectorIcon
          }
        >
          <Ionicons
            name="school-outline"
            size={
              18
            }
            color={
              colors.primary
            }
          />
        </View>

        <View
          style={
            styles.selectorTextArea
          }
        >
          <Text
            style={[
              styles.selectorText,

              value.length ===
                0 &&
                styles.placeholder,
            ]}
            numberOfLines={
              1
            }
          >
            {subjects.length ===
            0
              ? 'Choose subjects first'
              : options.length ===
                  0
                ? 'No classrooms created yet'
                : value.length ===
                    0
                  ? 'Choose classrooms'
                  : `${value.length} classroom${
                      value.length ===
                      1
                        ? ''
                        : 's'
                    } selected`}
          </Text>

          {value.length >
          0 ? (
            <Text
              style={
                styles.selectorSubtext
              }
            >
              {
                totalMappedSubjects
              } subject assignment{
                totalMappedSubjects ===
                1
                  ? ''
                  : 's'
              }
            </Text>
          ) : null}
        </View>

        <Ionicons
          name="chevron-down"
          size={
            18
          }
          color={
            colors.textMuted
          }
        />
      </Pressable>

      {selectedOptions.length >
      0 ? (
        <View
          style={
            styles.selectedList
          }
        >
          {selectedOptions.map(
            (
              option,
            ) => {
              const assignment =
                assignmentMap.get(
                  option.id,
                );

              return (
                <View
                  key={
                    option.id
                  }
                  style={
                    styles.selectedChip
                  }
                >
                  <View
                    style={{
                      flex:
                        1,
                    }}
                  >
                    <Text
                      style={
                        styles.selectedChipTitle
                      }
                    >
                      {
                        option.class_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.selectedChipSubjects
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {assignment
                        ?.subjects
                        .length
                        ? assignment.subjects.join(
                            ', ',
                          )
                        : 'Choose subject'}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() =>
                      removeClass(
                        option.id,
                      )
                    }
                    hitSlop={
                      8
                    }
                  >
                    <Ionicons
                      name="close"
                      size={
                        16
                      }
                      color={
                        colors.textMuted
                      }
                    />
                  </Pressable>
                </View>
              );
            },
          )}
        </View>
      ) : null}

      <Modal
        visible={
          open
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={
          close
        }
      >
        <SafeAreaView
          style={
            styles.safeArea
          }
        >
          <StatusBar
            style={
              resolvedTheme ===
              'dark'
                ? 'light'
                : 'dark'
            }
          />

          <View
            style={
              styles.header
            }
          >
            <Pressable
              onPress={
                close
              }
              hitSlop={
                10
              }
              style={
                styles.headerButton
              }
            >
              <Ionicons
                name="chevron-back"
                size={
                  23
                }
                color={
                  colors.text
                }
              />
            </Pressable>

            <View
              style={
                styles.headerCenter
              }
            >
              <Text
                style={
                  styles.headerTitle
                }
              >
                Choose Classrooms
              </Text>

              <Text
                style={
                  styles.headerSubtitle
                }
              >
                {
                  value.length
                } classroom{
                  value.length ===
                  1
                    ? ''
                    : 's'
                } selected
              </Text>
            </View>

            <Pressable
              disabled={
                incomplete
              }
              onPress={
                close
              }
              style={[
                styles.doneButton,

                incomplete &&
                  styles.doneButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.doneText,

                  incomplete &&
                    styles.doneTextDisabled,
                ]}
              >
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={
              styles.searchWrap
            }
          >
            <Ionicons
              name="search-outline"
              size={
                19
              }
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
              placeholder="Search classroom"
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
              >
                <Ionicons
                  name="close-circle"
                  size={
                    19
                  }
                  color={
                    colors.textMuted
                  }
                />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.content
            }
          >
            {renderSection(
              'Elementary',
              elementary,
            )}

            {renderSection(
              'High School',
              highSchool,
            )}

            {filteredOptions.length ===
            0 ? (
              <View
                style={
                  styles.empty
                }
              >
                <Ionicons
                  name="search-outline"
                  size={
                    28
                  }
                  color={
                    colors.textMuted
                  }
                />

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No classrooms found
                </Text>
              </View>
            ) : null}

            <View
              style={{
                height:
                  40,
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

function createStyles(
  colors:
    AppThemeColors,
) {
  return StyleSheet.create({
    selector: {
      minHeight:
        54,
      paddingHorizontal:
        13,
      borderRadius:
        15,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.input,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    selectorIcon: {
      width:
        34,
      height:
        34,
      borderRadius:
        10,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.primarySoft,
    },

    selectorTextArea: {
      flex:
        1,
      marginLeft:
        10,
    },

    selectorText: {
      color:
        colors.text,
      fontSize:
        13,
      fontWeight:
        '600',
    },

    selectorSubtext: {
      marginTop:
        2,
      color:
        colors.textMuted,
      fontSize:
        9.5,
    },

    placeholder: {
      color:
        colors.textMuted,
      fontWeight:
        '500',
    },

    disabled: {
      opacity:
        0.5,
    },

    pressed: {
      opacity:
        0.72,
    },

    selectedList: {
      marginTop:
        8,
      gap:
        6,
    },

    selectedChip: {
      minHeight:
        46,
      paddingHorizontal:
        10,
      paddingVertical:
        7,
      borderRadius:
        11,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.primarySoft,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        8,
    },

    selectedChipTitle: {
      color:
        colors.primary,
      fontSize:
        11.5,
      fontWeight:
        '800',
    },

    selectedChipSubjects: {
      marginTop:
        2,
      color:
        colors.textSecondary,
      fontSize:
        9.5,
    },

    safeArea: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },

    header: {
      minHeight:
        62,
      paddingHorizontal:
        13,
      borderBottomWidth:
        1,
      borderBottomColor:
        colors.border,
      backgroundColor:
        colors.surface,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    headerButton: {
      width:
        42,
      height:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    headerCenter: {
      flex:
        1,
      alignItems:
        'center',
    },

    headerTitle: {
      color:
        colors.text,
      fontSize:
        15,
      fontWeight:
        '800',
    },

    headerSubtitle: {
      marginTop:
        2,
      color:
        colors.textMuted,
      fontSize:
        9,
    },

    doneButton: {
      minWidth:
        52,
      height:
        36,
      paddingHorizontal:
        10,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.primarySoft,
    },

    doneButtonDisabled: {
      opacity:
        0.45,
    },

    doneText: {
      color:
        colors.primary,
      fontSize:
        12,
      fontWeight:
        '800',
    },

    doneTextDisabled: {
      color:
        colors.textMuted,
    },

    searchWrap: {
      height:
        50,
      marginHorizontal:
        16,
      marginTop:
        14,
      paddingHorizontal:
        13,
      borderRadius:
        15,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.input,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    searchInput: {
      flex:
        1,
      height:
        48,
      marginLeft:
        8,
      marginRight:
        8,
      color:
        colors.text,
      fontSize:
        13,
    },

    content: {
      paddingHorizontal:
        16,
      paddingTop:
        18,
    },

    section: {
      marginBottom:
        22,
    },

    sectionTitle: {
      marginBottom:
        9,
      marginLeft:
        2,
      color:
        colors.textSecondary,
      fontSize:
        10,
      fontWeight:
        '800',
      textTransform:
        'uppercase',
      letterSpacing:
        0.4,
    },

    optionList: {
      gap:
        9,
    },

    classCard: {
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        17,
      backgroundColor:
        colors.card,
      overflow:
        'hidden',
    },

    classCardSelected: {
      borderColor:
        colors.primary,
    },

    classTopRow: {
      minHeight:
        66,
      paddingHorizontal:
        12,
      paddingVertical:
        9,
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    classIcon: {
      width:
        40,
      height:
        40,
      borderRadius:
        12,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.surfaceSecondary,
    },

    classIconSelected: {
      backgroundColor:
        colors.primarySoft,
    },

    classInfo: {
      flex:
        1,
      marginLeft:
        11,
      marginRight:
        10,
    },

    className: {
      color:
        colors.text,
      fontSize:
        13.5,
      fontWeight:
        '700',
    },

    classMeta: {
      marginTop:
        3,
      color:
        colors.textMuted,
      fontSize:
        10,
    },

    checkbox: {
      width:
        24,
      height:
        24,
      borderRadius:
        8,
      borderWidth:
        1.5,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.input,
    },

    checkboxSelected: {
      borderColor:
        colors.primary,
      backgroundColor:
        colors.primary,
    },

    subjectArea: {
      paddingHorizontal:
        12,
      paddingTop:
        11,
      paddingBottom:
        13,
      borderTopWidth:
        1,
      borderTopColor:
        colors.border,
      backgroundColor:
        colors.surfaceSecondary,
    },

    subjectHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      gap:
        8,
    },

    subjectTitle: {
      flex:
        1,
      color:
        colors.textSecondary,
      fontSize:
        10.5,
      fontWeight:
        '700',
    },

    subjectCount: {
      color:
        colors.textMuted,
      fontSize:
        9,
    },

    subjectGrid: {
      marginTop:
        9,
      flexDirection:
        'row',
      flexWrap:
        'wrap',
      gap:
        7,
    },

    subjectButton: {
      minHeight:
        35,
      paddingHorizontal:
        9,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        10,
      backgroundColor:
        colors.card,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        6,
    },

    subjectButtonSelected: {
      borderColor:
        colors.primary,
      backgroundColor:
        colors.primarySoft,
    },

    subjectCheck: {
      width:
        17,
      height:
        17,
      borderRadius:
        5,
      borderWidth:
        1,
      borderColor:
        colors.border,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    subjectCheckSelected: {
      borderColor:
        colors.primary,
      backgroundColor:
        colors.primary,
    },

    subjectButtonText: {
      color:
        colors.textSecondary,
      fontSize:
        10.5,
      fontWeight:
        '600',
    },

    subjectButtonTextSelected: {
      color:
        colors.primary,
      fontWeight:
        '700',
    },

    noSubjectsBox: {
      marginTop:
        9,
      minHeight:
        38,
      paddingHorizontal:
        10,
      borderRadius:
        10,
      backgroundColor:
        colors.card,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        7,
    },

    noSubjectsText: {
      flex:
        1,
      color:
        colors.textMuted,
      fontSize:
        10,
    },

    warningRow: {
      marginTop:
        9,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
    },

    warningText: {
      flex:
        1,
      color:
        colors.danger,
      fontSize:
        9.5,
    },

    empty: {
      minHeight:
        250,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    emptyTitle: {
      marginTop:
        8,
      color:
        colors.textMuted,
      fontSize:
        12,
    },
  });
}