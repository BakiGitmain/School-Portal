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

/*
 * =========================================================
 * SUBJECT LIST
 *
 * IMPORTANT:
 * Every subject appears ONLY ONCE.
 *
 * We do not repeat Mathematics for:
 * Primary
 * Middle
 * Secondary
 *
 * because the teacher's CLASSROOM selection now tells us
 * which grades/classes they teach.
 * =========================================================
 */

const SUBJECTS: string[] = [
  'Afaan Oromo',
  'Amharic',
  'English',

  'Mathematics',

  'Environmental Science',
  'General Science',

  'Biology',
  'Chemistry',
  'Physics',

  'Social Studies',
  'Citizenship Education',
  'Moral Education',

  'Geography',
  'History',
  'Economics',

  'Computer Science',
  'ICT / Information Technology',

  'Health & Physical Education',
  'Performing & Visual Arts',
];

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

type Props = {
  value: string[];

  onChange:
    (
      value: string[],
    ) => void;

  disabled?: boolean;
};

/*
 * =========================================================
 * CLEAN SUBJECT
 * =========================================================
 */

function cleanSubject(
  value: string,
) {
  return value
    .trim()
    .replace(
      /\s+/g,
      ' ',
    );
}

/*
 * =========================================================
 * COMPONENT
 * =========================================================
 */

export default function SubjectMultiSelect({
  value,
  onChange,
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

  /*
   * =====================================================
   * CLEAN CURRENT VALUE
   *
   * This also protects old data if Mathematics was somehow
   * saved twice before.
   * =====================================================
   */

  const selectedSubjects =
    useMemo(
      () => {
        const unique =
          new Map<
            string,
            string
          >();

        for (
          const subject of
          value
        ) {
          const clean =
            cleanSubject(
              subject,
            );

          if (
            !clean
          ) {
            continue;
          }

          const key =
            clean.toLowerCase();

          if (
            !unique.has(
              key,
            )
          ) {
            unique.set(
              key,
              clean,
            );
          }
        }

        return Array.from(
          unique.values(),
        );
      },
      [
        value,
      ],
    );

  /*
   * Fast selected-name lookup.
   */

  const selectedKeys =
    useMemo(
      () =>
        new Set(
          selectedSubjects.map(
            (
              subject,
            ) =>
              subject.toLowerCase(),
          ),
        ),
      [
        selectedSubjects,
      ],
    );

  /*
   * =====================================================
   * UNIQUE AVAILABLE SUBJECTS
   * =====================================================
   */

  const allSubjects =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            string
          >();

        /*
         * Built-in subjects.
         */

        for (
          const subject of
          SUBJECTS
        ) {
          const clean =
            cleanSubject(
              subject,
            );

          map.set(
            clean.toLowerCase(),
            clean,
          );
        }

        /*
         * Also include custom subjects that were
         * previously selected/saved.
         */

        for (
          const subject of
          selectedSubjects
        ) {
          const clean =
            cleanSubject(
              subject,
            );

          if (
            !map.has(
              clean.toLowerCase(),
            )
          ) {
            map.set(
              clean.toLowerCase(),
              clean,
            );
          }
        }

        return Array.from(
          map.values(),
        ).sort(
          (
            a,
            b,
          ) =>
            a.localeCompare(
              b,
            ),
        );
      },
      [
        selectedSubjects,
      ],
    );

  /*
   * =====================================================
   * SEARCH
   * =====================================================
   */

  const searchTerm =
    search
      .trim()
      .toLowerCase();

  const filteredSubjects =
    useMemo(
      () => {
        if (
          !searchTerm
        ) {
          return allSubjects;
        }

        return allSubjects.filter(
          (
            subject,
          ) =>
            subject
              .toLowerCase()
              .includes(
                searchTerm,
              ),
        );
      },
      [
        allSubjects,
        searchTerm,
      ],
    );

  /*
   * =====================================================
   * CUSTOM SUBJECT
   * =====================================================
   */

  const cleanSearch =
    cleanSubject(
      search,
    );

  const exactSubjectExists =
    allSubjects.some(
      (
        subject,
      ) =>
        subject.toLowerCase() ===
        cleanSearch.toLowerCase(),
    );

  const canAddCustom =
    cleanSearch.length >
      1 &&
    !exactSubjectExists;

  /*
   * =====================================================
   * TOGGLE
   * =====================================================
   */

  function toggleSubject(
    subject: string,
  ) {
    const clean =
      cleanSubject(
        subject,
      );

    if (
      !clean
    ) {
      return;
    }

    const key =
      clean.toLowerCase();

    /*
     * Remove.
     */

    if (
      selectedKeys.has(
        key,
      )
    ) {
      onChange(
        selectedSubjects.filter(
          (
            item,
          ) =>
            item.toLowerCase() !==
            key,
        ),
      );

      return;
    }

    /*
     * Add.
     */

    onChange([
      ...selectedSubjects,
      clean,
    ]);
  }

  /*
   * =====================================================
   * REMOVE CHIP
   * =====================================================
   */

  function removeSubject(
    subject: string,
  ) {
    const key =
      subject.toLowerCase();

    onChange(
      selectedSubjects.filter(
        (
          item,
        ) =>
          item.toLowerCase() !==
          key,
      ),
    );
  }

  /*
   * =====================================================
   * ADD CUSTOM
   * =====================================================
   */

  function addCustomSubject() {
    if (
      !canAddCustom
    ) {
      return;
    }

    const key =
      cleanSearch.toLowerCase();

    if (
      selectedKeys.has(
        key,
      )
    ) {
      return;
    }

    onChange([
      ...selectedSubjects,
      cleanSearch,
    ]);

    setSearch('');
  }

  /*
   * =====================================================
   * CLOSE
   * =====================================================
   */

  function close() {
    setOpen(
      false,
    );

    setSearch('');
  }

  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <>
      {/* ================================================= */}
      {/* MAIN SELECT BUTTON */}
      {/* ================================================= */}

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
            name="book-outline"
            size={19}
            color={
              colors.primary
            }
          />
        </View>

        <Text
          style={[
            styles.selectorText,

            selectedSubjects.length ===
              0 &&
              styles.placeholder,
          ]}
          numberOfLines={
            1
          }
        >
          {selectedSubjects.length ===
          0
            ? 'Choose subjects'
            : `${selectedSubjects.length} subject${
                selectedSubjects.length ===
                1
                  ? ''
                  : 's'
              } selected`}
        </Text>

        <Ionicons
          name="chevron-down"
          size={18}
          color={
            colors.textMuted
          }
        />
      </Pressable>

      {/* ================================================= */}
      {/* SELECTED SUBJECT CHIPS */}
      {/* ================================================= */}

      {selectedSubjects.length >
      0 ? (
        <View
          style={
            styles.chips
          }
        >
          {selectedSubjects.map(
            (
              subject,
            ) => (
              <Pressable
                key={
                  subject.toLowerCase()
                }
                onPress={() =>
                  removeSubject(
                    subject,
                  )
                }
                style={({
                  pressed,
                }) => [
                  styles.chip,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <Text
                  style={
                    styles.chipText
                  }
                  numberOfLines={
                    1
                  }
                >
                  {subject}
                </Text>

                <Ionicons
                  name="close"
                  size={14}
                  color={
                    colors.primary
                  }
                />
              </Pressable>
            ),
          )}
        </View>
      ) : null}

      {/* ================================================= */}
      {/* SUBJECT SELECT SCREEN */}
      {/* ================================================= */}

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

          {/* HEADER */}

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
              style={({
                pressed,
              }) => [
                styles.headerButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={24}
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
                Subjects
              </Text>

              <Text
                style={
                  styles.headerSubtitle
                }
              >
                {
                  selectedSubjects.length
                }{' '}
                selected
              </Text>
            </View>

            <Pressable
              onPress={
                close
              }
              style={({
                pressed,
              }) => [
                styles.doneButton,

                pressed &&
                  styles.pressed,
              ]}
            >
              <Text
                style={
                  styles.doneText
                }
              >
                Done
              </Text>
            </Pressable>
          </View>

          {/* SEARCH */}

          <View
            style={
              styles.searchContainer
            }
          >
            <Ionicons
              name="search-outline"
              size={19}
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
              placeholder="Search subject"
              placeholderTextColor={
                colors.textMuted
              }
              autoCapitalize="words"
              autoCorrect={
                false
              }
              style={
                styles.searchInput
              }
            />

            {search.length >
            0 ? (
              <Pressable
                onPress={() =>
                  setSearch('')
                }
                hitSlop={
                  8
                }
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={
                    colors.textMuted
                  }
                />
              </Pressable>
            ) : null}
          </View>

          {/* SUBJECT LIST */}

          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={
              styles.content
            }
          >
            {canAddCustom ? (
              <Pressable
                onPress={
                  addCustomSubject
                }
                style={({
                  pressed,
                }) => [
                  styles.addCustom,

                  pressed &&
                    styles.pressed,
                ]}
              >
                <View
                  style={
                    styles.addCustomIcon
                  }
                >
                  <Ionicons
                    name="add"
                    size={19}
                    color={
                      colors.primary
                    }
                  />
                </View>

                <View
                  style={
                    styles.addCustomTextArea
                  }
                >
                  <Text
                    style={
                      styles.addCustomTitle
                    }
                  >
                    Add "{cleanSearch}"
                  </Text>

                  <Text
                    style={
                      styles.addCustomSubtitle
                    }
                  >
                    Custom subject
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {filteredSubjects.length >
            0 ? (
              <View
                style={
                  styles.subjectList
                }
              >
                {filteredSubjects.map(
                  (
                    subject,
                  ) => {
                    const selected =
                      selectedKeys.has(
                        subject.toLowerCase(),
                      );

                    return (
                      <Pressable
                        key={
                          subject.toLowerCase()
                        }
                        onPress={() =>
                          toggleSubject(
                            subject,
                          )
                        }
                        style={({
                          pressed,
                        }) => [
                          styles.subjectRow,

                          selected &&
                            styles.subjectRowSelected,

                          pressed &&
                            styles.pressed,
                        ]}
                      >
                        {/* CHECKBOX */}

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
                              size={15}
                              color="#FFFFFF"
                            />
                          ) : null}
                        </View>

                        {/* NAME */}

                        <Text
                          style={[
                            styles.subjectName,

                            selected &&
                              styles.subjectNameSelected,
                          ]}
                        >
                          {subject}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </View>
            ) : !canAddCustom ? (
              <View
                style={
                  styles.empty
                }
              >
                <View
                  style={
                    styles.emptyIcon
                  }
                >
                  <Ionicons
                    name="search-outline"
                    size={25}
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
                  No subjects found
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  Search another subject.
                </Text>
              </View>
            ) : null}

            <View
              style={{
                height:
                  30,
              }}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
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
    /*
     * MAIN SELECTOR
     */

    selector: {
      minHeight:
        52,

      paddingHorizontal:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderWidth:
        1,

      borderColor:
        colors.border,

      borderRadius:
        15,

      backgroundColor:
        colors.input,
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

    selectorText: {
      flex:
        1,

      marginLeft:
        10,

      marginRight:
        8,

      color:
        colors.text,

      fontSize:
        13,

      fontWeight:
        '600',
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

    /*
     * CHIPS
     */

    chips: {
      marginTop:
        8,

      flexDirection:
        'row',

      flexWrap:
        'wrap',

      gap:
        7,
    },

    chip: {
      maxWidth:
        '100%',

      minHeight:
        30,

      paddingHorizontal:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        5,

      borderRadius:
        9,

      borderWidth:
        1,

      borderColor:
        colors.border,

      backgroundColor:
        colors.primarySoft,
    },

    chipText: {
      color:
        colors.primary,

      fontSize:
        11,

      fontWeight:
        '700',
    },

    /*
     * FULL SCREEN
     */

    safeArea: {
      flex:
        1,

      backgroundColor:
        colors.background,
    },

    header: {
      minHeight:
        60,

      paddingHorizontal:
        13,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderBottomWidth:
        1,

      borderBottomColor:
        colors.border,

      backgroundColor:
        colors.surface,
    },

    headerButton: {
      width:
        42,

      height:
        42,

      borderRadius:
        21,

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
        16,

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
        50,

      height:
        38,

      paddingHorizontal:
        7,

      alignItems:
        'center',

      justifyContent:
        'center',

      borderRadius:
        12,
    },

    doneText: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '800',
    },

    /*
     * SEARCH
     */

    searchContainer: {
      height:
        48,

      marginHorizontal:
        16,

      marginTop:
        13,

      paddingHorizontal:
        12,

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
        colors.input,
    },

    searchInput: {
      flex:
        1,

      height:
        46,

      marginLeft:
        8,

      marginRight:
        8,

      color:
        colors.text,

      fontSize:
        13,
    },

    /*
     * CONTENT
     */

    content: {
      paddingHorizontal:
        16,

      paddingTop:
        14,

      paddingBottom:
        30,
    },

    subjectList: {
      gap:
        4,
    },

    /*
     * SUBJECT
     */

    subjectRow: {
      minHeight:
        52,

      paddingHorizontal:
        10,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        13,
    },

    subjectRowSelected: {
      backgroundColor:
        colors.primarySoft,
    },

    checkbox: {
      width:
        24,

      height:
        24,

      marginRight:
        11,

      borderRadius:
        7,

      borderWidth:
        1.5,

      borderColor:
        colors.border,

      backgroundColor:
        colors.input,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    checkboxSelected: {
      borderColor:
        colors.primary,

      backgroundColor:
        colors.primary,
    },

    subjectName: {
      flex:
        1,

      color:
        colors.textSecondary,

      fontSize:
        13,

      fontWeight:
        '500',
    },

    subjectNameSelected: {
      color:
        colors.text,

      fontWeight:
        '700',
    },

    /*
     * ADD CUSTOM
     */

    addCustom: {
      minHeight:
        60,

      marginBottom:
        10,

      paddingHorizontal:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      borderRadius:
        15,

      borderWidth:
        1,

      borderColor:
        colors.primary,

      backgroundColor:
        colors.primarySoft,
    },

    addCustomIcon: {
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

      backgroundColor:
        colors.card,
    },

    addCustomTextArea: {
      flex:
        1,

      marginLeft:
        10,
    },

    addCustomTitle: {
      color:
        colors.primary,

      fontSize:
        13,

      fontWeight:
        '700',
    },

    addCustomSubtitle: {
      marginTop:
        2,

      color:
        colors.textMuted,

      fontSize:
        10,
    },

    /*
     * EMPTY
     */

    empty: {
      minHeight:
        250,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        30,
    },

    emptyIcon: {
      width:
        54,

      height:
        54,

      borderRadius:
        17,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        colors.primarySoft,
    },

    emptyTitle: {
      marginTop:
        12,

      color:
        colors.text,

      fontSize:
        15,

      fontWeight:
        '700',
    },

    emptyText: {
      marginTop:
        5,

      color:
        colors.textMuted,

      fontSize:
        11,
    },
  });
}