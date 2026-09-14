import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  useRouter,
  type Href,
} from 'expo-router';

import * as ImagePicker from 'expo-image-picker';

import {
  supabase,
} from '../../../lib/supabase';

import SubjectMultiSelect from '../../../components/common/SubjectMultiSelect';

import ClassroomMultiSelect, {
  type ClassroomAssignment,
  type ClassroomOption,
} from '../../../components/common/ClassroomMultiSelect';

import {
  useAppSettings,
  type AppThemeColors,
} from '../../../context/AppSettingsContext';

type Teacher = {
  id: string;
  user_id: string;
  full_name: string;
  username: string | null;
  teacher_id: string | null;
  avatar_url: string | null;
  location: string | null;
  phone_number: string | null;
  subjects: string[];
  created_at: string;
};

type CreatedLogin = {
  teacherId: string;
  password: string;
};

function defaultAvatar(
  name: string,
) {
  return (
    'https://api.dicebear.com/9.x/personas/png?seed=' +
    encodeURIComponent(
      name ||
        'Teacher',
    )
  );
}

function normalizePhone(
  value: string,
) {
  const clean =
    value
      .trim()
      .replace(
        /[\s()-]/g,
        '',
      );

  if (
    /^0[79]\d{8}$/.test(
      clean,
    )
  ) {
    return (
      '+251' +
      clean.slice(
        1,
      )
    );
  }

  if (
    /^[79]\d{8}$/.test(
      clean,
    )
  ) {
    return (
      '+251' +
      clean
    );
  }

  return clean;
}

async function getFunctionError(
  error: unknown,
) {
  try {
    const possible =
      error as {
        context?: Response;
        message?: string;
      };

    if (
      possible.context &&
      typeof possible.context
        .json ===
        'function'
    ) {
      const body =
        await possible.context
          .json();

      if (
        body?.error
      ) {
        return String(
          body.error,
        );
      }
    }

    if (
      possible.message
    ) {
      return possible.message;
    }
  } catch {}

  return 'Something went wrong.';
}

export default function TeachersScreen() {
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
    teachers,
    setTeachers,
  ] =
    useState<
      Teacher[]
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
    search,
    setSearch,
  ] =
    useState('');

  const [
    sortByName,
    setSortByName,
  ] =
    useState(
      false,
    );

  const [
    addOpen,
    setAddOpen,
  ] =
    useState(
      false,
    );

  const [
    fullName,
    setFullName,
  ] =
    useState('');

  const [
    username,
    setUsername,
  ] =
    useState('');

  const [
    teacherId,
    setTeacherId,
  ] =
    useState('');

  const [
    location,
    setLocation,
  ] =
    useState('');

  const [
    phoneNumber,
    setPhoneNumber,
  ] =
    useState('');

  const [
    subjects,
    setSubjects,
  ] =
    useState<
      string[]
    >([]);

  const [
    classAssignments,
    setClassAssignments,
  ] =
    useState<
      ClassroomAssignment[]
    >([]);

  const [
    classroomOptions,
    setClassroomOptions,
  ] =
    useState<
      ClassroomOption[]
    >([]);

  const [
    classroomsLoading,
    setClassroomsLoading,
  ] =
    useState(
      false,
    );

  const [
    password,
    setPassword,
  ] =
    useState(
      '123456',
    );

  const [
    selectedImage,
    setSelectedImage,
  ] =
    useState<
      ImagePicker.ImagePickerAsset |
      null
    >(
      null,
    );

  const [
    creating,
    setCreating,
  ] =
    useState(
      false,
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
    createdLogin,
    setCreatedLogin,
  ] =
    useState<
      CreatedLogin |
      null
    >(
      null,
    );

  useEffect(
    () => {
      void loadTeachers();
      void loadClassrooms();
    },
    [],
  );

  async function loadTeachers() {
    try {
      setError(
        null,
      );

      const {
        data,
        error:
          loadError,
      } =
        await supabase
          .from(
            'profiles',
          )
          .select(`
            id,
            user_id,
            full_name,
            username,
            teacher_id,
            avatar_url,
            location,
            phone_number,
            subjects,
            created_at
          `)
          .eq(
            'role',
            'teacher',
          )
          .order(
            'created_at',
            {
              ascending:
                false,
            },
          );

      if (
        loadError
      ) {
        throw loadError;
      }

      setTeachers(
        (
          data ??
          []
        ).map(
          (
            teacher,
          ) => ({
            id:
              teacher.id,

            user_id:
              teacher.user_id,

            full_name:
              teacher.full_name,

            username:
              teacher.username,

            teacher_id:
              teacher.teacher_id,

            avatar_url:
              teacher.avatar_url,

            location:
              teacher.location,

            phone_number:
              teacher.phone_number,

            subjects:
              Array.isArray(
                teacher.subjects,
              )
                ? teacher.subjects
                : [],

            created_at:
              teacher.created_at,
          }),
        ) as
          Teacher[],
      );
    } catch (
      loadError
    ) {
      console.log(
        'LOAD TEACHERS:',
        loadError,
      );

      setError(
        'Could not load teachers.',
      );
    } finally {
      setLoading(
        false,
      );

      setRefreshing(
        false,
      );
    }
  }

  async function loadClassrooms() {
    try {
      setClassroomsLoading(
        true,
      );

      const {
        data,
        error:
          loadError,
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
            class_name,
            created_at
          `)
          .order(
            'created_at',
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

      setClassroomOptions(
        (
          data ??
          []
        ).map(
          (
            classroom,
          ) => ({
            id:
              classroom.id,

            category:
              classroom.category as
                ClassroomOption['category'],

            grade_label:
              classroom.grade_label,

            section:
              classroom.section,

            class_name:
              classroom.class_name,
          }),
        ),
      );
    } catch (
      loadError
    ) {
      console.log(
        'LOAD CLASSROOMS:',
        loadError,
      );

      setClassroomOptions(
        [],
      );
    } finally {
      setClassroomsLoading(
        false,
      );
    }
  }

  function getNextTeacherId() {
    let biggest =
      0;

    for (
      const teacher of
      teachers
    ) {
      const match =
        teacher.teacher_id
          ?.match(
            /^TR-(\d+)$/,
          );

      if (
        match
      ) {
        biggest =
          Math.max(
            biggest,
            Number(
              match[1],
            ),
          );
      }
    }

    return `TR-${String(
      biggest +
        1,
    ).padStart(
      3,
      '0',
    )}`;
  }

  function openAddTeacher() {
    setFullName('');
    setUsername('');

    setTeacherId(
      getNextTeacherId(),
    );

    setLocation('');
    setPhoneNumber('');

    setSubjects([]);

    setClassAssignments(
      [],
    );

    setPassword(
      '123456',
    );

    setSelectedImage(
      null,
    );

    setError(
      null,
    );

    void loadClassrooms();

    setAddOpen(
      true,
    );
  }

  function handleSubjectsChange(
    nextSubjects:
      string[],
  ) {
    setSubjects(
      nextSubjects,
    );

    const allowed =
      new Set(
        nextSubjects.map(
          (
            subject,
          ) =>
            subject.toLowerCase(),
        ),
      );

    setClassAssignments(
      (
        current,
      ) =>
        current.map(
          (
            assignment,
          ) => ({
            ...assignment,

            subjects:
              assignment.subjects.filter(
                (
                  subject,
                ) =>
                  allowed.has(
                    subject.toLowerCase(),
                  ),
              ),
          }),
        ),
    );
  }

  function openTeacher(
    teacher:
      Teacher,
  ) {
    router.push(
      `/admin/teacher/${teacher.id}` as Href,
    );
  }

  async function chooseGallery() {
    setError(
      null,
    );

    const permission =
      await ImagePicker
        .requestMediaLibraryPermissionsAsync();

    if (
      !permission.granted
    ) {
      setError(
        'Photo permission is required.',
      );

      return;
    }

    const result =
      await ImagePicker
        .launchImageLibraryAsync(
          {
            mediaTypes: [
              'images',
            ],

            allowsEditing:
              true,

            aspect: [
              1,
              1,
            ],

            quality:
              0.75,
          },
        );

    if (
      !result.canceled &&
      result.assets[0]
    ) {
      setSelectedImage(
        result.assets[0],
      );
    }
  }

  async function takePhoto() {
    setError(
      null,
    );

    const permission =
      await ImagePicker
        .requestCameraPermissionsAsync();

    if (
      !permission.granted
    ) {
      setError(
        'Camera permission is required.',
      );

      return;
    }

    const result =
      await ImagePicker
        .launchCameraAsync(
          {
            allowsEditing:
              true,

            aspect: [
              1,
              1,
            ],

            quality:
              0.75,
          },
        );

    if (
      !result.canceled &&
      result.assets[0]
    ) {
      setSelectedImage(
        result.assets[0],
      );
    }
  }

  async function uploadAvatar() {
    if (
      !selectedImage
    ) {
      return defaultAvatar(
        fullName,
      );
    }

    const response =
      await fetch(
        selectedImage.uri,
      );

    const arrayBuffer =
      await response.arrayBuffer();

    const mimeType =
      selectedImage.mimeType ??
      'image/jpeg';

    const extension =
      selectedImage.fileName
        ?.split('.')
        .pop()
        ?.toLowerCase() ??
      mimeType.split('/')[1] ??
      'jpg';

    const safeUsername =
      username
        .trim()
        .toLowerCase()
        .replace(
          /[^a-z0-9_-]/g,
          '',
        );

    const path =
      `teachers/${Date.now()}-${safeUsername}.${extension}`;

    const {
      error:
        uploadError,
    } =
      await supabase.storage
        .from(
          'avatars',
        )
        .upload(
          path,
          arrayBuffer,
          {
            contentType:
              mimeType,

            upsert:
              false,
          },
        );

    if (
      uploadError
    ) {
      throw uploadError;
    }

    const {
      data,
    } =
      supabase.storage
        .from(
          'avatars',
        )
        .getPublicUrl(
          path,
        );

    return data.publicUrl;
  }

  async function createTeacher() {
    const cleanName =
      fullName.trim();

    const cleanUsername =
      username
        .trim()
        .toLowerCase();

    const cleanTeacherId =
      teacherId
        .trim()
        .toUpperCase();

    const cleanLocation =
      location.trim();

    const cleanPhone =
      normalizePhone(
        phoneNumber,
      );

    setError(
      null,
    );

    if (
      !cleanName
    ) {
      setError(
        'Name is required.',
      );

      return;
    }

    if (
      !/^[a-z0-9._-]{3,30}$/.test(
        cleanUsername,
      )
    ) {
      setError(
        'Enter a valid username.',
      );

      return;
    }

    if (
      !/^TR-\d{3,}$/.test(
        cleanTeacherId,
      )
    ) {
      setError(
        'Use a Teacher ID like TR-001.',
      );

      return;
    }

    if (
      !cleanLocation
    ) {
      setError(
        'Location is required.',
      );

      return;
    }

    if (
      !/^\+251[79]\d{8}$/.test(
        cleanPhone,
      )
    ) {
      setError(
        'Enter a valid Ethiopian phone number.',
      );

      return;
    }

    if (
      subjects.length ===
      0
    ) {
      setError(
        'Choose at least one subject.',
      );

      return;
    }

    if (
      classAssignments.length ===
      0
    ) {
      setError(
        'Choose at least one classroom.',
      );

      return;
    }

    const missingSubject =
      classAssignments.find(
        (
          assignment,
        ) =>
          assignment.subjects.length ===
          0,
      );

    if (
      missingSubject
    ) {
      const classroom =
        classroomOptions.find(
          (
            option,
          ) =>
            option.id ===
            missingSubject.classId,
        );

      setError(
        `Choose at least one subject for ${
          classroom
            ?.class_name ??
          'each classroom'
        }.`,
      );

      return;
    }

    if (
      password.length <
      6
    ) {
      setError(
        'Password needs 6 characters.',
      );

      return;
    }

    try {
      setCreating(
        true,
      );

      const avatarUrl =
        await uploadAvatar();

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions
          .invoke(
            'create-teacher',
            {
              body: {
                fullName:
                  cleanName,

                username:
                  cleanUsername,

                teacherId:
                  cleanTeacherId,

                location:
                  cleanLocation,

                phoneNumber:
                  cleanPhone,

                subjects,

                classAssignments,

                password,

                avatarUrl,
              },
            },
          );

      if (
        functionError
      ) {
        throw new Error(
          await getFunctionError(
            functionError,
          ),
        );
      }

      if (
        !data?.teacher
      ) {
        throw new Error(
          data?.error ??
            'Could not create teacher.',
        );
      }

      setAddOpen(
        false,
      );

      setCreatedLogin({
        teacherId:
          cleanTeacherId,

        password,
      });

      await loadTeachers();
    } catch (
      createError
    ) {
      setError(
        createError instanceof
        Error
          ? createError.message
          : 'Could not create teacher.',
      );
    } finally {
      setCreating(
        false,
      );
    }
  }

  async function refresh() {
    setRefreshing(
      true,
    );

    await Promise.all([
      loadTeachers(),
      loadClassrooms(),
    ]);
  }

  const filteredTeachers =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();

        let result = [
          ...teachers,
        ];

        if (
          term
        ) {
          result =
            result.filter(
              (
                teacher,
              ) =>
                teacher.full_name
                  .toLowerCase()
                  .includes(
                    term,
                  ) ||

                teacher.username
                  ?.toLowerCase()
                  .includes(
                    term,
                  ) ||

                teacher.teacher_id
                  ?.toLowerCase()
                  .includes(
                    term,
                  ) ||

                teacher.subjects.some(
                  (
                    subject,
                  ) =>
                    subject
                      .toLowerCase()
                      .includes(
                        term,
                      ),
                ),
            );
        }

        if (
          sortByName
        ) {
          result.sort(
            (
              a,
              b,
            ) =>
              a.full_name.localeCompare(
                b.full_name,
              ),
          );
        }

        return result;
      },
      [
        teachers,
        search,
        sortByName,
      ],
    );

  return (
    <>
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
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={
              refresh
            }
            tintColor={
              colors.primary
            }
          />
        }
      >
        <View
          style={
            styles.searchRow
          }
        >
          <View
            style={
              styles.searchBox
            }
          >
            <Ionicons
              name="search-outline"
              size={
                20
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
              placeholder="Search teacher"
              placeholderTextColor={
                colors.textMuted
              }
              style={
                styles.searchInput
              }
            />
          </View>

          <Pressable
            onPress={() =>
              setSortByName(
                (
                  current,
                ) =>
                  !current,
              )
            }
            style={[
              styles.filterButton,

              sortByName &&
                styles.filterActive,
            ]}
          >
            <Ionicons
              name="filter-outline"
              size={
                20
              }
              color={
                sortByName
                  ? colors.primary
                  : colors.textMuted
              }
            />
          </Pressable>
        </View>

        <Pressable
          onPress={
            openAddTeacher
          }
          style={
            styles.addButton
          }
        >
          <Ionicons
            name="add"
            size={
              21
            }
            color="#FFFFFF"
          />

          <Text
            style={
              styles.addButtonText
            }
          >
            Add Teacher
          </Text>
        </Pressable>

        {loading ? (
          <ActivityIndicator
            style={{
              marginTop:
                50,
            }}
            color={
              colors.primary
            }
          />
        ) : (
          <View
            style={
              styles.teacherList
            }
          >
            {filteredTeachers.map(
              (
                teacher,
              ) => (
                <Pressable
                  key={
                    teacher.id
                  }
                  onPress={() =>
                    openTeacher(
                      teacher,
                    )
                  }
                  style={
                    styles.teacherCard
                  }
                >
                  <Image
                    source={{
                      uri:
                        teacher.avatar_url ??
                        defaultAvatar(
                          teacher.full_name,
                        ),
                    }}
                    style={
                      styles.avatar
                    }
                  />

                  <View
                    style={
                      styles.teacherInfo
                    }
                  >
                    <Text
                      style={
                        styles.teacherName
                      }
                    >
                      {
                        teacher.full_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.teacherMeta
                      }
                    >
                      {
                        teacher.teacher_id
                      }

                      {teacher.location
                        ? ` • ${teacher.location}`
                        : ''}
                    </Text>

                    <Text
                      style={
                        styles.subjectPreview
                      }
                      numberOfLines={
                        1
                      }
                    >
                      {teacher.subjects.join(
                        ' • ',
                      )}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={
                      18
                    }
                    color={
                      colors.textMuted
                    }
                  />
                </Pressable>
              ),
            )}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={
          addOpen
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() =>
          !creating &&
          setAddOpen(
            false,
          )
        }
      >
        <SafeAreaView
          style={
            styles.modalSafe
          }
        >
          <KeyboardAvoidingView
            style={{
              flex:
                1,
            }}
            behavior={
              Platform.OS ===
              'ios'
                ? 'padding'
                : undefined
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Pressable
                onPress={() =>
                  setAddOpen(
                    false,
                  )
                }
                style={
                  styles.backButton
                }
              >
                <Ionicons
                  name="chevron-back"
                  size={
                    25
                  }
                  color={
                    colors.text
                  }
                />
              </Pressable>

              <Text
                style={
                  styles.modalTitle
                }
              >
                Add Teacher
              </Text>

              <View
                style={{
                  width:
                    42,
                }}
              />
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.formContent
              }
            >
              <View
                style={
                  styles.photoArea
                }
              >
                <Image
                  source={{
                    uri:
                      selectedImage
                        ?.uri ??
                      defaultAvatar(
                        fullName,
                      ),
                  }}
                  style={
                    styles.profileImage
                  }
                />

                <View
                  style={
                    styles.photoButtons
                  }
                >
                  <Pressable
                    onPress={
                      chooseGallery
                    }
                    style={
                      styles.photoButton
                    }
                  >
                    <Ionicons
                      name="images-outline"
                      size={
                        17
                      }
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={
                        styles.photoButtonText
                      }
                    >
                      Gallery
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={
                      takePhoto
                    }
                    style={
                      styles.photoButton
                    }
                  >
                    <Ionicons
                      name="camera-outline"
                      size={
                        17
                      }
                      color={
                        colors.primary
                      }
                    />

                    <Text
                      style={
                        styles.photoButtonText
                      }
                    >
                      Camera
                    </Text>
                  </Pressable>
                </View>
              </View>

              <Label
                text="Name"
                styles={
                  styles
                }
              />

              <TextInput
                value={
                  fullName
                }
                onChangeText={
                  setFullName
                }
                placeholder="Full name"
                placeholderTextColor={
                  colors.textMuted
                }
                style={
                  styles.input
                }
              />

              <Label
                text="Username"
                styles={
                  styles
                }
              />

              <TextInput
                value={
                  username
                }
                onChangeText={(
                  text,
                ) =>
                  setUsername(
                    text
                      .toLowerCase()
                      .replace(
                        /\s/g,
                        '',
                      ),
                  )
                }
                placeholder="john"
                placeholderTextColor={
                  colors.textMuted
                }
                autoCapitalize="none"
                style={
                  styles.input
                }
              />

              <Label
                text="Teacher ID"
                styles={
                  styles
                }
              />

              <TextInput
                value={
                  teacherId
                }
                onChangeText={(
                  text,
                ) =>
                  setTeacherId(
                    text.toUpperCase(),
                  )
                }
                style={
                  styles.input
                }
              />

              <Label
                text="Location"
                styles={
                  styles
                }
              />

              <TextInput
                value={
                  location
                }
                onChangeText={
                  setLocation
                }
                placeholder="e.g. Goro"
                placeholderTextColor={
                  colors.textMuted
                }
                style={
                  styles.input
                }
              />

              <Label
                text="Phone"
                styles={
                  styles
                }
              />

              <TextInput
                value={
                  phoneNumber
                }
                onChangeText={
                  setPhoneNumber
                }
                keyboardType="phone-pad"
                placeholder="0912345678"
                placeholderTextColor={
                  colors.textMuted
                }
                style={
                  styles.input
                }
              />

              <Label
                text="Subjects"
                styles={
                  styles
                }
              />

              <SubjectMultiSelect
                value={
                  subjects
                }
                onChange={
                  handleSubjectsChange
                }
              />

              <View
                style={
                  styles.gap
                }
              />

              <Label
                text="Classrooms & Subjects"
                styles={
                  styles
                }
              />

              {classroomsLoading ? (
                <ActivityIndicator
                  color={
                    colors.primary
                  }
                />
              ) : (
                <ClassroomMultiSelect
                  value={
                    classAssignments
                  }
                  onChange={
                    setClassAssignments
                  }
                  options={
                    classroomOptions
                  }
                  subjects={
                    subjects
                  }
                  disabled={
                    subjects.length ===
                    0
                  }
                />
              )}

              <Text
                style={
                  styles.hint
                }
              >
                Choose the classroom, then choose which of this teacher's subjects they teach in that classroom.
              </Text>

              <View
                style={
                  styles.gap
                }
              />

              <Label
                text="Temporary password"
                styles={
                  styles
                }
              />

              <TextInput
                value={
                  password
                }
                onChangeText={
                  setPassword
                }
                style={
                  styles.input
                }
              />

              {error ? (
                <Text
                  style={
                    styles.error
                  }
                >
                  {error}
                </Text>
              ) : null}

              <Pressable
                disabled={
                  creating
                }
                onPress={
                  createTeacher
                }
                style={
                  styles.createButton
                }
              >
                {creating ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.createText
                    }
                  >
                    Create Teacher
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={
          createdLogin !==
          null
        }
        transparent
        animationType="fade"
      >
        <View
          style={
            styles.overlay
          }
        >
          <View
            style={
              styles.successCard
            }
          >
            <View
              style={
                styles.successIcon
              }
            >
              <Ionicons
                name="checkmark"
                size={
                  28
                }
                color="#FFFFFF"
              />
            </View>

            <Text
              style={
                styles.successTitle
              }
            >
              Teacher added
            </Text>

            <Text
              style={
                styles.loginValue
              }
            >
              {
                createdLogin
                  ?.teacherId
              }
            </Text>

            <Text
              style={
                styles.loginValue
              }
            >
              {
                createdLogin
                  ?.password
              }
            </Text>

            <Pressable
              onPress={() =>
                setCreatedLogin(
                  null,
                )
              }
              style={
                styles.doneButton
              }
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
        </View>
      </Modal>
    </>
  );
}

type Styles =
  ReturnType<
    typeof createStyles
  >;

function Label({
  text,
  styles,
}: {
  text: string;
  styles: Styles;
}) {
  return (
    <Text
      style={
        styles.label
      }
    >
      {text}
    </Text>
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

    content: {
      padding:
        18,
      paddingBottom:
        110,
    },

    searchRow: {
      flexDirection:
        'row',
      gap:
        9,
    },

    searchBox: {
      flex:
        1,
      height:
        48,
      paddingHorizontal:
        13,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        8,
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
      color:
        colors.text,
    },

    filterButton: {
      width:
        48,
      height:
        48,
      borderRadius:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.card,
    },

    filterActive: {
      backgroundColor:
        colors.primarySoft,
      borderColor:
        colors.primary,
    },

    addButton: {
      marginTop:
        11,
      height:
        49,
      borderRadius:
        15,
      backgroundColor:
        colors.primary,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'center',
      gap:
        6,
    },

    addButtonText: {
      color:
        '#FFFFFF',
      fontWeight:
        '700',
    },

    teacherList: {
      marginTop:
        12,
      gap:
        8,
    },

    teacherCard: {
      minHeight:
        74,
      padding:
        10,
      flexDirection:
        'row',
      alignItems:
        'center',
      borderRadius:
        16,
      borderWidth:
        1,
      borderColor:
        colors.border,
      backgroundColor:
        colors.card,
    },

    avatar: {
      width:
        48,
      height:
        48,
      borderRadius:
        24,
    },

    teacherInfo: {
      flex:
        1,
      marginLeft:
        10,
    },

    teacherName: {
      color:
        colors.text,
      fontWeight:
        '700',
      fontSize:
        13.5,
    },

    teacherMeta: {
      marginTop:
        2,
      color:
        colors.textMuted,
      fontSize:
        10.5,
    },

    subjectPreview: {
      marginTop:
        3,
      color:
        colors.primary,
      fontSize:
        10.5,
    },

    modalSafe: {
      flex:
        1,
      backgroundColor:
        colors.background,
    },

    modalHeader: {
      height:
        58,
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

    backButton: {
      width:
        42,
      height:
        42,
      alignItems:
        'center',
      justifyContent:
        'center',
    },

    modalTitle: {
      flex:
        1,
      textAlign:
        'center',
      color:
        colors.text,
      fontSize:
        16,
      fontWeight:
        '800',
    },

    formContent: {
      padding:
        22,
      paddingBottom:
        50,
    },

    photoArea: {
      alignItems:
        'center',
      marginBottom:
        24,
    },

    profileImage: {
      width:
        96,
      height:
        96,
      borderRadius:
        48,
    },

    photoButtons: {
      marginTop:
        10,
      flexDirection:
        'row',
      gap:
        8,
    },

    photoButton: {
      paddingHorizontal:
        12,
      height:
        37,
      borderRadius:
        11,
      flexDirection:
        'row',
      alignItems:
        'center',
      gap:
        5,
      backgroundColor:
        colors.primarySoft,
    },

    photoButtonText: {
      color:
        colors.primary,
      fontSize:
        11,
      fontWeight:
        '700',
    },

    label: {
      marginBottom:
        7,
      color:
        colors.textSecondary,
      fontSize:
        11,
      fontWeight:
        '600',
    },

    input: {
      height:
        52,
      paddingHorizontal:
        14,
      marginBottom:
        15,
      borderWidth:
        1,
      borderColor:
        colors.border,
      borderRadius:
        15,
      backgroundColor:
        colors.input,
      color:
        colors.text,
    },

    gap: {
      height:
        16,
    },

    hint: {
      marginTop:
        6,
      color:
        colors.textMuted,
      fontSize:
        9.5,
      lineHeight:
        14,
    },

    error: {
      marginTop:
        12,
      color:
        colors.danger,
      fontSize:
        11,
    },

    createButton: {
      marginTop:
        20,
      height:
        52,
      borderRadius:
        15,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.primary,
    },

    createText: {
      color:
        '#FFFFFF',
      fontWeight:
        '700',
    },

    overlay: {
      flex:
        1,
      alignItems:
        'center',
      justifyContent:
        'center',
      padding:
        24,
      backgroundColor:
        colors.overlay,
    },

    successCard: {
      width:
        '100%',
      maxWidth:
        330,
      padding:
        22,
      alignItems:
        'center',
      borderRadius:
        20,
      backgroundColor:
        colors.card,
    },

    successIcon: {
      width:
        52,
      height:
        52,
      borderRadius:
        26,
      alignItems:
        'center',
      justifyContent:
        'center',
      backgroundColor:
        colors.primary,
    },

    successTitle: {
      marginTop:
        10,
      marginBottom:
        14,
      color:
        colors.text,
      fontWeight:
        '800',
      fontSize:
        18,
    },

    loginValue: {
      marginTop:
        5,
      color:
        colors.text,
      fontWeight:
        '700',
    },

    doneButton: {
      marginTop:
        18,
      width:
        '100%',
      height:
        47,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius:
        14,
      backgroundColor:
        colors.primary,
    },

    doneText: {
      color:
        '#FFFFFF',
      fontWeight:
        '700',
    },
  });
}