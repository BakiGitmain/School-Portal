import {
  Ionicons,
} from '@expo/vector-icons';

import {
  router,
  useFocusEffect,
  type Href,
} from 'expo-router';

import * as ImagePicker from 'expo-image-picker';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
  useAppSettings,
} from '../../../context/AppSettingsContext';

import {
  supabase,
} from '../../../lib/supabase';

type Gender =
  | 'male'
  | 'female';

type PasswordSource =
  | 'mother'
  | 'father';

type ResetPasswordTo =
  | 'none'
  | 'mother'
  | 'father';

type SchoolClass = {
  id: string;

  category:
    | 'elementary'
    | 'high_school';

  grade_label: string;

  section: string;

  class_name: string;
};

type Student = {
  id: string;

  user_id: string;

  full_name: string;

  first_name: string;

  last_name: string;

  username:
    | string
    | null;

  student_id:
    | string
    | null;

  avatar_url:
    | string
    | null;

  gender:
    | Gender
    | null;

  age:
    | number
    | null;

  mother_phone:
    | string
    | null;

  father_phone:
    | string
    | null;

  location:
    | string
    | null;

  special_case:
    | string
    | null;

  class_id:
    | string
    | null;

  created_at: string;
};

type PickedPhoto = {
  uri: string;

  mimeType?:
    | string
    | null;
};

type ToastType =
  | 'success'
  | 'error'
  | 'info';

type ToastState = {
  title: string;

  message: string;

  type: ToastType;
} | null;

function generatedAvatar(
  name: string,
) {
  return (
    'https://api.dicebear.com/9.x/personas/png?seed=' +
    encodeURIComponent(
      name.trim() ||
        'Student',
    )
  );
}

function getClassCode(
  schoolClass:
    | SchoolClass
    | null,
) {
  if (!schoolClass) {
    return 'CLASS';
  }

  const grade =
    schoolClass.grade_label;

  const section =
    schoolClass.section.toUpperCase();

  if (
    grade === 'Nursery'
  ) {
    return (
      'NE' +
      section
    );
  }

  if (
    grade === 'LKG'
  ) {
    return (
      'LK' +
      section
    );
  }

  if (
    grade === 'UKG'
  ) {
    return (
      'UK' +
      section
    );
  }

  const numeric =
    Number(grade);

  if (
    Number.isInteger(
      numeric,
    ) &&
    numeric >= 1 &&
    numeric <= 9
  ) {
    return (
      String(
        numeric,
      ).padStart(
        2,
        '0',
      ) +
      section
    );
  }

  return (
    grade +
    section
  );
}

function getErrorMessage(
  error: unknown,
) {
  if (
    error &&
    typeof error ===
      'object'
  ) {
    const value =
      error as {
        message?: string;

        details?: string;

        hint?: string;
      };

    return (
      value.message ??
      value.details ??
      value.hint ??
      'Something went wrong.'
    );
  }

  if (
    typeof error ===
    'string'
  ) {
    return error;
  }

  return 'Something went wrong.';
}

async function getFunctionError(
  error: unknown,
) {
  try {
    const possible =
      error as {
        context?:
          Response;

        message?:
          string;
      };

    if (
      possible.context &&
      typeof possible.context.json ===
        'function'
    ) {
      const body =
        await possible.context.json();

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

export default function StudentsScreen() {
  const {
    colors,
  } =
    useAppSettings();

  const [
    schoolClass,
    setSchoolClass,
  ] =
    useState<SchoolClass | null>(
      null,
    );

  const [
    students,
    setStudents,
  ] =
    useState<Student[]>(
      [],
    );

  const [
    teacherUserId,
    setTeacherUserId,
  ] =
    useState('');

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    formOpen,
    setFormOpen,
  ] =
    useState(false);

  const [
    editingStudent,
    setEditingStudent,
  ] =
    useState<Student | null>(
      null,
    );

  const [
    deleteStudentTarget,
    setDeleteStudentTarget,
  ] =
    useState<Student | null>(
      null,
    );

  const [
    deleting,
    setDeleting,
  ] =
    useState(false);

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

  const [
    firstName,
    setFirstName,
  ] =
    useState('');

  const [
    lastName,
    setLastName,
  ] =
    useState('');

  const [
    gender,
    setGender,
  ] =
    useState<Gender | null>(
      null,
    );

  const [
    age,
    setAge,
  ] =
    useState('');

  const [
    motherPhone,
    setMotherPhone,
  ] =
    useState('');

  const [
    fatherPhone,
    setFatherPhone,
  ] =
    useState('');

  const [
    location,
    setLocation,
  ] =
    useState('');

  const [
    specialCase,
    setSpecialCase,
  ] =
    useState('');

  const [
    passwordSource,
    setPasswordSource,
  ] =
    useState<PasswordSource>(
      'mother',
    );

  const [
    resetPasswordTo,
    setResetPasswordTo,
  ] =
    useState<ResetPasswordTo>(
      'none',
    );

  const [
    photo,
    setPhoto,
  ] =
    useState<PickedPhoto | null>(
      null,
    );

  const [
    existingAvatar,
    setExistingAvatar,
  ] =
    useState<
      string | null
    >(null);

  const [
    toast,
    setToast,
  ] =
    useState<ToastState>(
      null,
    );

  const toastY =
    useRef(
      new Animated.Value(
        -120,
      ),
    ).current;

  const toastTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null);

  const hideToast =
    useCallback(() => {
      if (
        toastTimer.current
      ) {
        clearTimeout(
          toastTimer.current,
        );

        toastTimer.current =
          null;
      }

      Animated.timing(
        toastY,
        {
          toValue:
            -120,

          duration:
            180,

          easing:
            Easing.in(
              Easing.cubic,
            ),

          useNativeDriver:
            true,
        },
      ).start(
        ({
          finished,
        }) => {
          if (
            finished
          ) {
            setToast(
              null,
            );
          }
        },
      );
    }, [
      toastY,
    ]);

  const showToast =
    useCallback(
      (
        title: string,
        message: string,
        type: ToastType,
      ) => {
        if (
          toastTimer.current
        ) {
          clearTimeout(
            toastTimer.current,
          );
        }

        setToast({
          title,
          message,
          type,
        });

        toastY.setValue(
          -120,
        );

        Animated.spring(
          toastY,
          {
            toValue: 0,

            damping: 19,

            stiffness: 210,

            mass: 0.7,

            useNativeDriver:
              true,
          },
        ).start();

        toastTimer.current =
          setTimeout(
            hideToast,
            3200,
          );
      },
      [
        hideToast,
        toastY,
      ],
    );

  useEffect(() => {
    return () => {
      if (
        toastTimer.current
      ) {
        clearTimeout(
          toastTimer.current,
        );
      }
    };
  }, []);

  const loadStudents =
    useCallback(
      async () => {
        try {
          setLoading(
            true,
          );

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
            throw new Error(
              'Your teacher account could not be loaded.',
            );
          }

          const userId =
            authData.user.id;

          setTeacherUserId(
            userId,
          );

          const {
            data:
              classData,
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
              .eq(
                'homeroom_teacher_user_id',
                userId,
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
            classError
          ) {
            throw classError;
          }

          if (
            !classData
          ) {
            setSchoolClass(
              null,
            );

            setStudents(
              [],
            );

            return;
          }

          const classRow: SchoolClass =
            {
              id:
                classData.id,

              category:
                classData.category as
                  SchoolClass['category'],

              grade_label:
                classData.grade_label,

              section:
                classData.section,

              class_name:
                classData.class_name,
            };

          setSchoolClass(
            classRow,
          );

          const {
            data:
              studentData,
            error:
              studentsError,
          } =
            await supabase
              .from(
                'profiles',
              )
              .select(`
                id,
                user_id,
                full_name,
                first_name,
                last_name,
                username,
                student_id,
                avatar_url,
                gender,
                age,
                mother_phone,
                father_phone,
                location,
                special_case,
                class_id,
                created_at
              `)
              .eq(
                'role',
                'student',
              )
              .eq(
                'class_id',
                classRow.id,
              )
              .order(
                'first_name',
                {
                  ascending:
                    true,
                },
              )
              .order(
                'last_name',
                {
                  ascending:
                    true,
                },
              );

          if (
            studentsError
          ) {
            throw studentsError;
          }

          const rows: Student[] =
            (
              studentData ??
              []
            ).map(
              (item) => ({
                id:
                  item.id,

                user_id:
                  item.user_id,

                full_name:
                  item.full_name,

                first_name:
                  item.first_name ??
                  '',

                last_name:
                  item.last_name ??
                  '',

                username:
                  item.username,

                student_id:
                  item.student_id,

                avatar_url:
                  item.avatar_url,

                gender:
                  item.gender as
                    Gender | null,

                age:
                  item.age,

                mother_phone:
                  item.mother_phone,

                father_phone:
                  item.father_phone,

                location:
                  item.location,

                special_case:
                  item.special_case,

                class_id:
                  item.class_id,

                created_at:
                  item.created_at,
              }),
            );

          setStudents(
            rows,
          );
        } catch (error) {
          console.log(
            'LOAD STUDENTS ERROR:',
            error,
          );

          showToast(
            'Unable to load students',
            getErrorMessage(
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
      [
        showToast,
      ],
    );

  useFocusEffect(
    useCallback(() => {
      void loadStudents();
    }, [
      loadStudents,
    ]),
  );

  const filteredStudents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return students;
      }

      return students.filter(
        (
          student,
        ) => {
          const text =
            [
              student.first_name,
              student.last_name,
              student.full_name,
              student.student_id ??
                '',
            ]
              .join(' ')
              .toLowerCase();

          return text.includes(
            query,
          );
        },
      );
    }, [
      search,
      students,
    ]);

  const formFullName =
    `${firstName.trim()} ${lastName.trim()}`
      .trim();

  const avatarPreview =
    photo?.uri ??
    existingAvatar ??
    generatedAvatar(
      formFullName ||
        'Student',
    );

  const idPreview =
    `ST-###-${getClassCode(
      schoolClass,
    )}`;

  function resetForm() {
    setEditingStudent(
      null,
    );

    setFirstName(
      '',
    );

    setLastName(
      '',
    );

    setGender(
      null,
    );

    setAge(
      '',
    );

    setMotherPhone(
      '',
    );

    setFatherPhone(
      '',
    );

    setLocation(
      '',
    );

    setSpecialCase(
      '',
    );

    setPasswordSource(
      'mother',
    );

    setResetPasswordTo(
      'none',
    );

    setPhoto(
      null,
    );

    setExistingAvatar(
      null,
    );

    setFormError(
      '',
    );
  }

  function openCreate() {
    if (
      !schoolClass
    ) {
      showToast(
        'No classroom assigned',
        'You need a homeroom class before adding students.',
        'info',
      );

      return;
    }

    resetForm();

    setFormOpen(
      true,
    );
  }

  function openEdit(
    student: Student,
  ) {
    setEditingStudent(
      student,
    );

    setFirstName(
      student.first_name ||
        student.full_name
          .split(' ')[0] ||
        '',
    );

    setLastName(
      student.last_name ||
        student.full_name
          .split(' ')
          .slice(1)
          .join(' '),
    );

    setGender(
      student.gender,
    );

    setAge(
      student.age
        ? String(
            student.age,
          )
        : '',
    );

    setMotherPhone(
      student.mother_phone ??
        '',
    );

    setFatherPhone(
      student.father_phone ??
        '',
    );

    setLocation(
      student.location ??
        '',
    );

    setSpecialCase(
      student.special_case ??
        '',
    );

    setExistingAvatar(
      student.avatar_url,
    );

    setPhoto(
      null,
    );

    setPasswordSource(
      'mother',
    );

    setResetPasswordTo(
      'none',
    );

    setFormError(
      '',
    );

    setFormOpen(
      true,
    );
  }

  function closeForm() {
    if (saving) {
      return;
    }

    setFormOpen(
      false,
    );

    resetForm();
  }

  async function choosePhoto() {
    const {
      status,
    } =
      await ImagePicker
        .requestMediaLibraryPermissionsAsync();

    if (
      status !==
      'granted'
    ) {
      setFormError(
        'Photo library permission is required.',
      );

      return;
    }

    const result =
      await ImagePicker
        .launchImageLibraryAsync({
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
            0.8,
        });

    if (
      !result.canceled &&
      result.assets[0]
    ) {
      setPhoto({
        uri:
          result.assets[0].uri,

        mimeType:
          result.assets[0].mimeType,
      });
    }
  }

  async function takePhoto() {
    const {
      status,
    } =
      await ImagePicker
        .requestCameraPermissionsAsync();

    if (
      status !==
      'granted'
    ) {
      setFormError(
        'Camera permission is required.',
      );

      return;
    }

    const result =
      await ImagePicker
        .launchCameraAsync({
          allowsEditing:
            true,

          aspect: [
            1,
            1,
          ],

          quality:
            0.8,
        });

    if (
      !result.canceled &&
      result.assets[0]
    ) {
      setPhoto({
        uri:
          result.assets[0].uri,

        mimeType:
          result.assets[0].mimeType,
      });
    }
  }

  async function uploadPhoto(
    picked:
      PickedPhoto,
  ) {
    const response =
      await fetch(
        picked.uri,
      );

    const bytes =
      await response
        .arrayBuffer();

    let extension =
      'jpg';

    let contentType =
      picked.mimeType ??
      'image/jpeg';

    if (
      contentType.includes(
        'png',
      )
    ) {
      extension =
        'png';
    }

    const path =
      `students/${teacherUserId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

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
          bytes,
          {
            contentType,

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
      data:
        publicData,
    } =
      supabase.storage
        .from(
          'avatars',
        )
        .getPublicUrl(
          path,
        );

    return (
      publicData.publicUrl
    );
  }

  function validateForm() {
    if (
      !firstName.trim()
    ) {
      return 'First name is required.';
    }

    if (
      !lastName.trim()
    ) {
      return 'Last name is required.';
    }

    if (!gender) {
      return 'Choose Male or Female.';
    }

    const parsedAge =
      Number(age);

    if (
      !Number.isInteger(
        parsedAge,
      ) ||
      parsedAge < 2 ||
      parsedAge > 25
    ) {
      return 'Enter a valid age.';
    }

    if (
      !motherPhone.trim()
    ) {
      return "Mother's phone is required.";
    }

    if (
      !fatherPhone.trim()
    ) {
      return "Father's phone is required.";
    }

    return '';
  }

  async function saveStudent() {
    if (
      !schoolClass
    ) {
      return;
    }

    const validation =
      validateForm();

    if (validation) {
      setFormError(
        validation,
      );

      return;
    }

    setFormError(
      '',
    );

    try {
      setSaving(
        true,
      );

/*
 * Always save an avatar URL.
 *
 * If the teacher selected/took a photo:
 * -> upload and save that photo.
 *
 * If no photo was chosen:
 * -> permanently save the generated avatar.
 *
 * This means the same PFP appears in:
 * - Students list
 * - Student dashboard
 * - Account switcher
 * - Student profile
 */
let avatarUrl =
  existingAvatar ??
  generatedAvatar(
    formFullName ||
      'Student',
  );

if (photo) {
  avatarUrl =
    await uploadPhoto(
      photo,
    );
}

      if (
        editingStudent
      ) {
        const {
          data,
          error:
            functionError,
        } =
          await supabase.functions
            .invoke(
              'update-student',
              {
                body: {
                  studentUserId:
                    editingStudent.user_id,

                  firstName:
                    firstName.trim(),

                  lastName:
                    lastName.trim(),

                  gender,

                  age:
                    Number(
                      age,
                    ),

                  motherPhone:
                    motherPhone.trim(),

                  fatherPhone:
                    fatherPhone.trim(),

                  location:
                    location.trim(),

                  specialCase:
                    specialCase.trim(),

                  avatarUrl,

                  resetPasswordTo:
                    resetPasswordTo ===
                    'none'
                      ? null
                      : resetPasswordTo,
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
          !data?.success
        ) {
          throw new Error(
            data?.error ??
              'Could not update student.',
          );
        }

        setFormOpen(
          false,
        );

        resetForm();

        await loadStudents();

        showToast(
          'Student updated',
          data.passwordReset
            ? `Student information was saved and the password was reset to the ${data.passwordSource}'s phone number.`
            : 'Student information was saved successfully.',
          'success',
        );

        return;
      }

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions
          .invoke(
            'create-student',
            {
              body: {
                classId:
                  schoolClass.id,

                firstName:
                  firstName.trim(),

                lastName:
                  lastName.trim(),

                gender,

                age:
                  Number(
                    age,
                  ),

                motherPhone:
                  motherPhone.trim(),

                fatherPhone:
                  fatherPhone.trim(),

                location:
                  location.trim(),

                specialCase:
                  specialCase.trim(),

                avatarUrl,

                passwordSource,
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
        !data?.success
      ) {
        throw new Error(
          data?.error ??
            'Could not create student.',
        );
      }

      setFormOpen(
        false,
      );

      resetForm();

      await loadStudents();

      showToast(
        'Student created',
        `${data.studentId} was created. The first password is the ${data.passwordSource}'s phone number.`,
        'success',
      );
    } catch (error) {
      console.log(
        'SAVE STUDENT ERROR:',
        error,
      );

      setFormError(
        getErrorMessage(
          error,
        ),
      );
    } finally {
      setSaving(
        false,
      );
    }
  }

  async function deleteStudent() {
    if (
      !deleteStudentTarget
    ) {
      return;
    }

    const student =
      deleteStudentTarget;

    try {
      setDeleting(
        true,
      );

      const {
        data,
        error:
          functionError,
      } =
        await supabase.functions
          .invoke(
            'delete-student',
            {
              body: {
                studentUserId:
                  student.user_id,
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
        !data?.success
      ) {
        throw new Error(
          data?.error ??
            'Could not delete student.',
        );
      }

      setDeleteStudentTarget(
        null,
      );

      await loadStudents();

      showToast(
        'Student deleted',
        `${student.full_name} was deleted successfully.`,
        'success',
      );
    } catch (error) {
      showToast(
        'Could not delete student',
        getErrorMessage(
          error,
        ),
        'error',
      );
    } finally {
      setDeleting(
        false,
      );
    }
  }

function renderStudent(
  student: Student,
  index: number,
) {
  const avatar =
    student.avatar_url ??
    generatedAvatar(
      student.full_name,
    );

  return (
    <Pressable
      key={
        student.user_id
      }
      onPress={() =>
        router.push(
          `/teacher/student/${student.user_id}` as Href,
        )
      }
      style={({
        pressed,
      }) => [
        styles.studentCard,

        {
          backgroundColor:
            colors.card,

          borderColor:
            colors.border,

          opacity:
            pressed
              ? 0.8
              : 1,
        },
      ]}
    >
      <View
        style={[
          styles.numberCircle,

          {
            backgroundColor:
              colors.primarySoft,
          },
        ]}
      >
        <Text
          style={[
            styles.numberText,

            {
              color:
                colors.primary,
            },
          ]}
        >
          {
            index + 1
          }
        </Text>
      </View>

      <Image
        source={{
          uri:
            avatar,
        }}
        style={
          styles.studentAvatar
        }
      />

      <View
        style={
          styles.studentInfo
        }
      >
        <Text
          numberOfLines={
            1
          }
          style={[
            styles.studentName,

            {
              color:
                colors.text,
            },
          ]}
        >
          {student.first_name}{' '}
          {student.last_name}
        </Text>

        <Text
          style={[
            styles.studentId,

            {
              color:
                colors.textMuted,
            },
          ]}
        >
          {student.student_id ??
            'Student'}
        </Text>

        {student.special_case ? (
          <View
            style={
              styles.specialBadge
            }
          >
            <Text
              style={
                styles.specialBadgeText
              }
            >
              Special case
            </Text>
          </View>
        ) : null}
      </View>

      <View
        style={
          styles.studentActions
        }
      >
        {/* EDIT */}

        <Pressable
          onPress={(
            event,
          ) => {
            event.stopPropagation();

            openEdit(
              student,
            );
          }}
          style={[
            styles.smallAction,

            {
              backgroundColor:
                colors.primarySoft,
            },
          ]}
        >
          <Ionicons
            name="create-outline"
            size={17}
            color={
              colors.primary
            }
          />
        </Pressable>

        {/* DELETE */}

        <Pressable
          onPress={(
            event,
          ) => {
            event.stopPropagation();

            setDeleteStudentTarget(
              student,
            );
          }}
          style={[
            styles.smallAction,

            {
              backgroundColor:
                '#FEE2E2',
            },
          ]}
        >
          <Ionicons
            name="trash-outline"
            size={17}
            color="#DC2626"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

  const toastIcon =
    toast?.type ===
    'success'
      ? 'checkmark'
      : toast?.type ===
          'error'
        ? 'close'
        : 'information';

  const toastIconColor =
    toast?.type ===
    'success'
      ? '#16A34A'
      : toast?.type ===
          'error'
        ? '#DC2626'
        : colors.primary;

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
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={
          styles.content
        }
      >
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
              Loading your class...
            </Text>
          </View>
        ) : !schoolClass ? (
          <View
            style={[
              styles.noClassCard,
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
                styles.bigIcon,
                {
                  backgroundColor:
                    colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name="school-outline"
                size={28}
                color={
                  colors.primary
                }
              />
            </View>

            <Text
              style={[
                styles.noClassTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              No classroom assigned
            </Text>

            <Text
              style={[
                styles.noClassText,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              The President needs to assign you as a homeroom teacher first.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.classCard,
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
                  styles.classIcon,
                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <Ionicons
                  name="school"
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
                  style={[
                    styles.className,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  {
                    schoolClass.class_name
                  }
                </Text>

                <Text
                  style={[
                    styles.classSubtitle,
                    {
                      color:
                        colors.textMuted,
                    },
                  ]}
                >
                  Your homeroom class
                </Text>
              </View>

              <View
                style={[
                  styles.classCount,
                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.classCountText,
                    {
                      color:
                        colors.primary,
                    },
                  ]}
                >
                  {
                    students.length
                  }
                </Text>
              </View>
            </View>

            <View
              style={
                styles.searchRow
              }
            >
              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,
                  },
                ]}
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
                  placeholder="Search student or ID"
                  placeholderTextColor={
                    colors.textMuted
                  }
                  style={[
                    styles.searchInput,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                />

                {search.length >
                  0 && (
                  <Pressable
                    onPress={() =>
                      setSearch(
                        '',
                      )
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
                )}
              </View>

              <Pressable
                onPress={
                  openCreate
                }
                style={[
                  styles.addSquare,
                  {
                    backgroundColor:
                      colors.primary,
                  },
                ]}
              >
                <Ionicons
                  name="add"
                  size={24}
                  color="#FFFFFF"
                />
              </Pressable>
            </View>

            <Pressable
              onPress={
                openCreate
              }
              style={[
                styles.addStudentButton,
                {
                  backgroundColor:
                    colors.primary,
                },
              ]}
            >
              <Ionicons
                name="person-add-outline"
                size={19}
                color="#FFFFFF"
              />

              <Text
                style={
                  styles.addStudentText
                }
              >
                Add Student
              </Text>
            </Pressable>

            <View
              style={
                styles.listHeader
              }
            >
              <Text
                style={[
                  styles.listTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                Students
              </Text>

              <Text
                style={[
                  styles.resultText,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  filteredStudents.length
                }{' '}
                student
                {filteredStudents.length ===
                1
                  ? ''
                  : 's'}
              </Text>
            </View>

            {students.length ===
            0 ? (
              <View
                style={[
                  styles.emptyStudents,
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
                    styles.bigIcon,
                    {
                      backgroundColor:
                        colors.primarySoft,
                    },
                  ]}
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
                  style={[
                    styles.emptyTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  No students yet
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
                  Add the first student to {schoolClass.class_name}.
                </Text>
              </View>
            ) : filteredStudents.length ===
              0 ? (
              <View
                style={[
                  styles.emptyStudents,
                  {
                    backgroundColor:
                      colors.card,

                    borderColor:
                      colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={28}
                  color={
                    colors.textMuted
                  }
                />

                <Text
                  style={[
                    styles.emptyTitle,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  No students found
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.studentList
                }
              >
                {filteredStudents.map(
                  renderStudent,
                )}
              </View>
            )}
          </>
        )}

        <View
          style={{
            height:
              80,
          }}
        />
      </ScrollView>

      {/* CREATE / EDIT STUDENT */}

      <Modal
        visible={
          formOpen
        }
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={
          closeForm
        }
      >
        <SafeAreaView
          style={[
            styles.modalScreen,
            {
              backgroundColor:
                colors.background,
            },
          ]}
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
            <View
              style={[
                styles.modalHeader,
                {
                  borderBottomColor:
                    colors.border,
                },
              ]}
            >
              <Pressable
                onPress={
                  closeForm
                }
                disabled={
                  saving
                }
                style={[
                  styles.backButton,
                  {
                    backgroundColor:
                      colors.surfaceSecondary,
                  },
                ]}
              >
                <Ionicons
                  name="close"
                  size={21}
                  color={
                    colors.text
                  }
                />
              </Pressable>

              <Text
                style={[
                  styles.modalTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {editingStudent
                  ? 'Edit Student'
                  : 'Add Student'}
              </Text>

              <View
                style={{
                  width:
                    38,
                }}
              />
            </View>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={
                styles.formContent
              }
            >
              <Image
                source={{
                  uri:
                    avatarPreview,
                }}
                style={
                  styles.formAvatar
                }
              />

              <Text
                style={[
                  styles.photoHelper,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {photo ||
                existingAvatar
                  ? 'Profile photo'
                  : 'Generated avatar'}
              </Text>

              <View
                style={
                  styles.photoButtons
                }
              >
                <Pressable
                  onPress={
                    choosePhoto
                  }
                  style={[
                    styles.photoButton,
                    {
                      backgroundColor:
                        colors.card,

                      borderColor:
                        colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="images-outline"
                    size={19}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.photoButtonText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Choose Photo
                  </Text>
                </Pressable>

                <Pressable
                  onPress={
                    takePhoto
                  }
                  style={[
                    styles.photoButton,
                    {
                      backgroundColor:
                        colors.card,

                      borderColor:
                        colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="camera-outline"
                    size={19}
                    color={
                      colors.primary
                    }
                  />

                  <Text
                    style={[
                      styles.photoButtonText,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Take Photo
                  </Text>
                </Pressable>
              </View>

              <View
                style={[
                  styles.idPreview,
                  {
                    backgroundColor:
                      colors.primarySoft,
                  },
                ]}
              >
                <View>
                  <Text
                    style={[
                      styles.idLabel,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    Student ID
                  </Text>

                  <Text
                    style={[
                      styles.idValue,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    {editingStudent
                      ?.student_id ??
                      idPreview}
                  </Text>
                </View>

                {!editingStudent && (
                  <Text
                    style={[
                      styles.autoText,
                      {
                        color:
                          colors.primary,
                      },
                    ]}
                  >
                    Auto
                  </Text>
                )}
              </View>

              <View
                style={
                  styles.twoColumns
                }
              >
                <View
                  style={
                    styles.column
                  }
                >
                  <FieldLabel
                    label="First Name"
                    color={
                      colors.textSecondary
                    }
                  />

                  <TextInput
                    value={
                      firstName
                    }
                    onChangeText={
                      setFirstName
                    }
                    placeholder="First Name"
                    placeholderTextColor={
                      colors.textMuted
                    }
                    style={[
                      styles.input,
                      {
                        backgroundColor:
                          colors.input,

                        borderColor:
                          colors.border,

                        color:
                          colors.text,
                      },
                    ]}
                  />
                </View>

                <View
                  style={
                    styles.column
                  }
                >
                  <FieldLabel
                    label="Last Name"
                    color={
                      colors.textSecondary
                    }
                  />

                  <TextInput
                    value={
                      lastName
                    }
                    onChangeText={
                      setLastName
                    }
                    placeholder="Last Name"
                    placeholderTextColor={
                      colors.textMuted
                    }
                    style={[
                      styles.input,
                      {
                        backgroundColor:
                          colors.input,

                        borderColor:
                          colors.border,

                        color:
                          colors.text,
                      },
                    ]}
                  />
                </View>
              </View>

              <FieldLabel
                label="Gender"
                color={
                  colors.textSecondary
                }
              />

              <View
                style={
                  styles.genderRow
                }
              >
                <Pressable
                  onPress={() =>
                    setGender(
                      'male',
                    )
                  }
                  style={[
                    styles.genderButton,
                    {
                      backgroundColor:
                        gender ===
                        'male'
                          ? colors.primary
                          : colors.card,

                      borderColor:
                        gender ===
                        'male'
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="male"
                    size={17}
                    color={
                      gender ===
                      'male'
                        ? '#FFFFFF'
                        : colors.textMuted
                    }
                  />

                  <Text
                    style={[
                      styles.genderText,
                      {
                        color:
                          gender ===
                          'male'
                            ? '#FFFFFF'
                            : colors.text,
                      },
                    ]}
                  >
                    Male
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() =>
                    setGender(
                      'female',
                    )
                  }
                  style={[
                    styles.genderButton,
                    {
                      backgroundColor:
                        gender ===
                        'female'
                          ? colors.primary
                          : colors.card,

                      borderColor:
                        gender ===
                        'female'
                          ? colors.primary
                          : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="female"
                    size={17}
                    color={
                      gender ===
                      'female'
                        ? '#FFFFFF'
                        : colors.textMuted
                    }
                  />

                  <Text
                    style={[
                      styles.genderText,
                      {
                        color:
                          gender ===
                          'female'
                            ? '#FFFFFF'
                            : colors.text,
                      },
                    ]}
                  >
                    Female
                  </Text>
                </Pressable>
              </View>

              <FieldLabel
                label="Age"
                color={
                  colors.textSecondary
                }
              />

              <TextInput
                value={
                  age
                }
                onChangeText={(
                  value,
                ) =>
                  setAge(
                    value.replace(
                      /\D/g,
                      '',
                    ),
                  )
                }
                keyboardType="number-pad"
                placeholder="16"
                placeholderTextColor={
                  colors.textMuted
                }
                style={[
                  styles.input,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,

                    color:
                      colors.text,
                  },
                ]}
              />

              <FieldLabel
                label="Mother's Phone"
                color={
                  colors.textSecondary
                }
              />

              <TextInput
                value={
                  motherPhone
                }
                onChangeText={
                  setMotherPhone
                }
                keyboardType="phone-pad"
                placeholder="0912345678"
                placeholderTextColor={
                  colors.textMuted
                }
                style={[
                  styles.input,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,

                    color:
                      colors.text,
                  },
                ]}
              />

              <FieldLabel
                label="Father's Phone"
                color={
                  colors.textSecondary
                }
              />

              <TextInput
                value={
                  fatherPhone
                }
                onChangeText={
                  setFatherPhone
                }
                keyboardType="phone-pad"
                placeholder="0912345678"
                placeholderTextColor={
                  colors.textMuted
                }
                style={[
                  styles.input,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,

                    color:
                      colors.text,
                  },
                ]}
              />

              <FieldLabel
                label="Location"
                optional
                color={
                  colors.textSecondary
                }
              />

              <TextInput
                value={
                  location
                }
                onChangeText={
                  setLocation
                }
                placeholder="Adama"
                placeholderTextColor={
                  colors.textMuted
                }
                style={[
                  styles.input,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,

                    color:
                      colors.text,
                  },
                ]}
              />

              <FieldLabel
                label="Special Case"
                optional
                color={
                  colors.textSecondary
                }
              />

              <TextInput
                value={
                  specialCase
                }
                onChangeText={
                  setSpecialCase
                }
                placeholder="Medical, learning or other note"
                placeholderTextColor={
                  colors.textMuted
                }
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.largeInput,
                  {
                    backgroundColor:
                      colors.input,

                    borderColor:
                      colors.border,

                    color:
                      colors.text,
                  },
                ]}
              />

              {!editingStudent ? (
                <>
                  <View
                    style={
                      styles.sectionDivider
                    }
                  />

                  <Text
                    style={[
                      styles.passwordTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    First Password
                  </Text>

                  <Text
                    style={[
                      styles.passwordDescription,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    Choose which parent's phone number the student will use as their first password.
                  </Text>

                  <PasswordChoice
                    title="Mother's phone"
                    selected={
                      passwordSource ===
                      'mother'
                    }
                    onPress={() =>
                      setPasswordSource(
                        'mother',
                      )
                    }
                    colors={
                      colors
                    }
                  />

                  <PasswordChoice
                    title="Father's phone"
                    selected={
                      passwordSource ===
                      'father'
                    }
                    onPress={() =>
                      setPasswordSource(
                        'father',
                      )
                    }
                    colors={
                      colors
                    }
                  />
                </>
              ) : (
                <>
                  <View
                    style={
                      styles.sectionDivider
                    }
                  />

                  <Text
                    style={[
                      styles.passwordTitle,
                      {
                        color:
                          colors.text,
                      },
                    ]}
                  >
                    Reset Password
                  </Text>

                  <Text
                    style={[
                      styles.passwordDescription,
                      {
                        color:
                          colors.textMuted,
                      },
                    ]}
                  >
                    Only choose this when the student forgot their password or a parent changed phone number.
                  </Text>

                  <PasswordChoice
                    title="Don't reset password"
                    selected={
                      resetPasswordTo ===
                      'none'
                    }
                    onPress={() =>
                      setResetPasswordTo(
                        'none',
                      )
                    }
                    colors={
                      colors
                    }
                  />

                  <PasswordChoice
                    title="Reset to Mother's phone"
                    selected={
                      resetPasswordTo ===
                      'mother'
                    }
                    onPress={() =>
                      setResetPasswordTo(
                        'mother',
                      )
                    }
                    colors={
                      colors
                    }
                  />

                  <PasswordChoice
                    title="Reset to Father's phone"
                    selected={
                      resetPasswordTo ===
                      'father'
                    }
                    onPress={() =>
                      setResetPasswordTo(
                        'father',
                      )
                    }
                    colors={
                      colors
                    }
                  />
                </>
              )}

              {formError ? (
                <View
                  style={
                    styles.formErrorBox
                  }
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={17}
                    color="#DC2626"
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
                disabled={
                  saving
                }
                onPress={
                  saveStudent
                }
                style={[
                  styles.saveButton,
                  {
                    backgroundColor:
                      colors.primary,

                    opacity:
                      saving
                        ? 0.7
                        : 1,
                  },
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
                        editingStudent
                          ? 'checkmark-circle-outline'
                          : 'person-add-outline'
                      }
                      size={20}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.saveText
                      }
                    >
                      {editingStudent
                        ? 'Save Changes'
                        : 'Create Student'}
                    </Text>
                  </>
                )}
              </Pressable>

              <View
                style={{
                  height:
                    40,
                }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* DELETE CONFIRMATION */}

      <Modal
        visible={
          deleteStudentTarget !==
          null
        }
        transparent
        animationType="fade"
        onRequestClose={() =>
          !deleting &&
          setDeleteStudentTarget(
            null,
          )
        }
      >
        <View
          style={
            styles.deleteOverlay
          }
        >
          <View
            style={[
              styles.deleteCard,
              {
                backgroundColor:
                  colors.card,

                borderColor:
                  colors.border,
              },
            ]}
          >
            <View
              style={
                styles.deleteIcon
              }
            >
              <Ionicons
                name="trash-outline"
                size={26}
                color="#DC2626"
              />
            </View>

            <Text
              style={[
                styles.deleteTitle,
                {
                  color:
                    colors.text,
                },
              ]}
            >
              Delete student?
            </Text>

            <Text
              style={[
                styles.deleteDescription,
                {
                  color:
                    colors.textMuted,
                },
              ]}
            >
              {deleteStudentTarget
                ?.full_name}{' '}
              and their login account will be permanently deleted.
            </Text>

            <View
              style={
                styles.deleteActions
              }
            >
              <Pressable
                disabled={
                  deleting
                }
                onPress={() =>
                  setDeleteStudentTarget(
                    null,
                  )
                }
                style={[
                  styles.cancelButton,
                  {
                    backgroundColor:
                      colors.surfaceSecondary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cancelText,
                    {
                      color:
                        colors.text,
                    },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  deleting
                }
                onPress={
                  deleteStudent
                }
                style={
                  styles.deleteButton
                }
              >
                {deleting ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.deleteText
                      }
                    >
                      Delete
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SLIDE DOWN NOTIFICATION */}

      {toast && (
        <Animated.View
          style={[
            styles.toastWrapper,
            {
              transform: [
                {
                  translateY:
                    toastY,
                },
              ],
            },
          ]}
        >
          <Pressable
            onPress={
              hideToast
            }
            style={[
              styles.toastCard,
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
                styles.toastIcon,
                {
                  backgroundColor:
                    toast.type ===
                    'success'
                      ? '#DCFCE7'
                      : toast.type ===
                          'error'
                        ? '#FEE2E2'
                        : colors.primarySoft,
                },
              ]}
            >
              <Ionicons
                name={
                  toastIcon
                }
                size={19}
                color={
                  toastIconColor
                }
              />
            </View>

            <View
              style={
                styles.toastInfo
              }
            >
              <Text
                style={[
                  styles.toastTitle,
                  {
                    color:
                      colors.text,
                  },
                ]}
              >
                {
                  toast.title
                }
              </Text>

              <Text
                numberOfLines={
                  2
                }
                style={[
                  styles.toastMessage,
                  {
                    color:
                      colors.textMuted,
                  },
                ]}
              >
                {
                  toast.message
                }
              </Text>
            </View>

            <Ionicons
              name="close"
              size={17}
              color={
                colors.textMuted
              }
            />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

function FieldLabel({
  label,
  optional = false,
  color,
}: {
  label: string;

  optional?: boolean;

  color: string;
}) {
  return (
    <View
      style={
        styles.fieldLabelRow
      }
    >
      <Text
        style={[
          styles.fieldLabel,
          {
            color,
          },
        ]}
      >
        {label}
      </Text>

      {optional && (
        <Text
          style={
            styles.optionalText
          }
        >
          Optional
        </Text>
      )}
    </View>
  );
}

function PasswordChoice({
  title,
  selected,
  onPress,
  colors,
}: {
  title: string;

  selected: boolean;

  onPress:
    () => void;

  colors: {
    primary: string;
    primarySoft: string;
    card: string;
    border: string;
    text: string;
  };
}) {
  return (
    <Pressable
      onPress={
        onPress
      }
      style={[
        styles.passwordChoice,
        {
          backgroundColor:
            selected
              ? colors.primarySoft
              : colors.card,

          borderColor:
            selected
              ? colors.primary
              : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.radio,
          {
            borderColor:
              selected
                ? colors.primary
                : colors.border,
          },
        ]}
      >
        {selected && (
          <View
            style={[
              styles.radioInner,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
          />
        )}
      </View>

      <Text
        style={[
          styles.passwordChoiceText,
          {
            color:
              colors.text,
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
    },

    content: {
      paddingHorizontal:
        16,

      paddingTop:
        16,

      paddingBottom:
        100,
    },

    loadingArea: {
      paddingTop:
        120,

      alignItems:
        'center',

      gap:
        10,
    },

    loadingText: {
      fontSize:
        13,

      fontWeight:
        '500',
    },

    noClassCard: {
      marginTop:
        100,

      borderWidth:
        1,

      borderRadius:
        24,

      padding:
        28,

      alignItems:
        'center',
    },

    bigIcon: {
      width:
        58,

      height:
        58,

      borderRadius:
        19,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    noClassTitle: {
      marginTop:
        15,

      fontSize:
        18,

      fontWeight:
        '800',
    },

    noClassText: {
      marginTop:
        7,

      maxWidth:
        280,

      textAlign:
        'center',

      fontSize:
        13,

      lineHeight:
        19,
    },

    classCard: {
      minHeight:
        82,

      borderWidth:
        1,

      borderRadius:
        20,

      padding:
        14,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    classIcon: {
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
    },

    classInfo: {
      flex:
        1,

      marginLeft:
        12,
    },

    className: {
      fontSize:
        19,

      fontWeight:
        '800',
    },

    classSubtitle: {
      marginTop:
        3,

      fontSize:
        11,

      fontWeight:
        '500',
    },

    classCount: {
      minWidth:
        36,

      height:
        36,

      paddingHorizontal:
        10,

      borderRadius:
        18,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    classCountText: {
      fontSize:
        13,

      fontWeight:
        '800',
    },

    searchRow: {
      marginTop:
        16,

      flexDirection:
        'row',

      gap:
        9,
    },

    searchBar: {
      flex:
        1,

      height:
        50,

      borderWidth:
        1,

      borderRadius:
        16,

      paddingHorizontal:
        13,

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
        6,

      fontSize:
        13,
    },

    addSquare: {
      width:
        50,

      height:
        50,

      borderRadius:
        16,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    addStudentButton: {
      height:
        50,

      marginTop:
        10,

      borderRadius:
        16,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    addStudentText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    listHeader: {
      marginTop:
        25,

      marginBottom:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    listTitle: {
      fontSize:
        19,

      fontWeight:
        '800',
    },

    resultText: {
      fontSize:
        11,

      fontWeight:
        '600',
    },

    studentList: {
      gap:
        9,
    },

    studentCard: {
      minHeight:
        78,

      borderWidth:
        1,

      borderRadius:
        19,

      padding:
        11,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    numberCircle: {
      width:
        28,

      height:
        28,

      borderRadius:
        14,

      alignItems:
        'center',

      justifyContent:
        'center',

      marginRight:
        9,
    },

    numberText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    studentAvatar: {
      width:
        46,

      height:
        46,

      borderRadius:
        23,
    },

    studentInfo: {
      flex:
        1,

      marginLeft:
        11,
    },

    studentName: {
      fontSize:
        14,

      fontWeight:
        '700',
    },

    studentId: {
      marginTop:
        3,

      fontSize:
        10.5,

      fontWeight:
        '500',
    },

    specialBadge: {
      marginTop:
        5,

      alignSelf:
        'flex-start',

      paddingHorizontal:
        7,

      paddingVertical:
        3,

      borderRadius:
        7,

      backgroundColor:
        '#FFF4CC',
    },

    specialBadgeText: {
      color:
        '#9A6700',

      fontSize:
        9,

      fontWeight:
        '700',
    },

    studentActions: {
      marginLeft:
        6,

      gap:
        6,
    },

    smallAction: {
      width:
        33,

      height:
        33,

      borderRadius:
        11,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    emptyStudents: {
      borderWidth:
        1,

      borderRadius:
        22,

      padding:
        30,

      alignItems:
        'center',
    },

    emptyTitle: {
      marginTop:
        13,

      fontSize:
        17,

      fontWeight:
        '700',
    },

    emptyText: {
      marginTop:
        6,

      textAlign:
        'center',

      fontSize:
        12,

      lineHeight:
        18,
    },

    modalScreen: {
      flex:
        1,
    },

    modalHeader: {
      minHeight:
        62,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      paddingHorizontal:
        16,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    backButton: {
      width:
        38,

      height:
        38,

      borderRadius:
        19,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    modalTitle: {
      fontSize:
        16,

      fontWeight:
        '800',
    },

    formContent: {
      paddingHorizontal:
        18,

      paddingTop:
        22,

      paddingBottom:
        50,
    },

    formAvatar: {
      width:
        104,

      height:
        104,

      borderRadius:
        52,

      alignSelf:
        'center',
    },

    photoHelper: {
      marginTop:
        8,

      textAlign:
        'center',

      fontSize:
        11,
    },

    photoButtons: {
      marginTop:
        14,

      marginBottom:
        20,

      flexDirection:
        'row',

      gap:
        9,
    },

    photoButton: {
      flex:
        1,

      minHeight:
        47,

      borderWidth:
        1,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        6,
    },

    photoButtonText: {
      fontSize:
        12,

      fontWeight:
        '600',
    },

    idPreview: {
      minHeight:
        65,

      marginBottom:
        20,

      borderRadius:
        18,

      paddingHorizontal:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',
    },

    idLabel: {
      fontSize:
        10,

      fontWeight:
        '600',
    },

    idValue: {
      marginTop:
        3,

      fontSize:
        17,

      fontWeight:
        '800',
    },

    autoText: {
      fontSize:
        11,

      fontWeight:
        '800',
    },

    twoColumns: {
      flexDirection:
        'row',

      gap:
        10,
    },

    column: {
      flex:
        1,
    },

    fieldLabelRow: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        7,
    },

    fieldLabel: {
      fontSize:
        12,

      fontWeight:
        '600',
    },

    optionalText: {
      color:
        '#94A3B8',

      fontSize:
        10,

      fontWeight:
        '500',
    },

    input: {
      minHeight:
        52,

      borderWidth:
        1,

      borderRadius:
        15,

      paddingHorizontal:
        14,

      marginBottom:
        16,

      fontSize:
        14,
    },

    largeInput: {
      minHeight:
        92,

      paddingTop:
        13,
    },

    genderRow: {
      flexDirection:
        'row',

      gap:
        9,

      marginBottom:
        16,
    },

    genderButton: {
      flex:
        1,

      height:
        50,

      borderWidth:
        1,

      borderRadius:
        15,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        7,
    },

    genderText: {
      fontSize:
        13,

      fontWeight:
        '700',
    },

    sectionDivider: {
      height:
        1,

      marginVertical:
        22,

      backgroundColor:
        '#E8EEF5',
    },

    passwordTitle: {
      fontSize:
        17,

      fontWeight:
        '800',
    },

    passwordDescription: {
      marginTop:
        5,

      marginBottom:
        13,

      fontSize:
        12,

      lineHeight:
        18,
    },

    passwordChoice: {
      minHeight:
        52,

      borderWidth:
        1,

      borderRadius:
        15,

      paddingHorizontal:
        14,

      marginBottom:
        9,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    radio: {
      width:
        20,

      height:
        20,

      borderRadius:
        10,

      borderWidth:
        2,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    radioInner: {
      width:
        10,

      height:
        10,

      borderRadius:
        5,
    },

    passwordChoiceText: {
      marginLeft:
        11,

      fontSize:
        13,

      fontWeight:
        '600',
    },

    formErrorBox: {
      marginTop:
        14,

      borderRadius:
        13,

      padding:
        11,

      flexDirection:
        'row',

      alignItems:
        'flex-start',

      gap:
        7,

      backgroundColor:
        '#FEF2F2',
    },

    formErrorText: {
      flex:
        1,

      color:
        '#DC2626',

      fontSize:
        12,

      lineHeight:
        17,
    },

    saveButton: {
      height:
        54,

      marginTop:
        18,

      borderRadius:
        17,

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        8,
    },

    saveText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    deleteOverlay: {
      flex:
        1,

      paddingHorizontal:
        24,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        'rgba(15,23,42,0.38)',
    },

    deleteCard: {
      width:
        '100%',

      maxWidth:
        360,

      borderWidth:
        1,

      borderRadius:
        24,

      padding:
        22,

      alignItems:
        'center',
    },

    deleteIcon: {
      width:
        56,

      height:
        56,

      borderRadius:
        28,

      alignItems:
        'center',

      justifyContent:
        'center',

      backgroundColor:
        '#FEE2E2',
    },

    deleteTitle: {
      marginTop:
        14,

      fontSize:
        19,

      fontWeight:
        '800',
    },

    deleteDescription: {
      marginTop:
        7,

      textAlign:
        'center',

      fontSize:
        12,

      lineHeight:
        18,
    },

    deleteActions: {
      width:
        '100%',

      marginTop:
        20,

      flexDirection:
        'row',

      gap:
        9,
    },

    cancelButton: {
      flex:
        1,

      height:
        48,

      borderRadius:
        15,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    cancelText: {
      fontSize:
        13,

      fontWeight:
        '700',
    },

    deleteButton: {
      flex:
        1,

      height:
        48,

      borderRadius:
        15,

      backgroundColor:
        '#DC2626',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        6,
    },

    deleteText: {
      color:
        '#FFFFFF',

      fontSize:
        13,

      fontWeight:
        '700',
    },

    toastWrapper: {
      position:
        'absolute',

      top:
        10,

      left:
        12,

      right:
        12,

      zIndex:
        9999,

      elevation:
        30,
    },

    toastCard: {
      minHeight:
        70,

      borderWidth:
        1,

      borderRadius:
        20,

      padding:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      elevation:
        12,

      shadowColor:
        '#000000',

      shadowOffset: {
        width:
          0,

        height:
          6,
      },

      shadowOpacity:
        0.12,

      shadowRadius:
        14,
    },

    toastIcon: {
      width:
        40,

      height:
        40,

      borderRadius:
        20,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    toastInfo: {
      flex:
        1,

      marginLeft:
        11,

      marginRight:
        8,
    },

    toastTitle: {
      fontSize:
        13,

      fontWeight:
        '700',
    },

    toastMessage: {
      marginTop:
        2,

      fontSize:
        11,

      lineHeight:
        16,
    },
  });