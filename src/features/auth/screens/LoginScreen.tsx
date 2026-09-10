import {
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
  SafeAreaView,
} from 'react-native-safe-area-context';

import {
  LinearGradient,
} from 'expo-linear-gradient';

import {
  StatusBar,
} from 'expo-status-bar';

import {
  useRouter,
  type Href,
} from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  supabase,
} from '../../../lib/supabase';

import {
  saveAccount,
} from '../../../lib/accountStore';

import type {
  UserRole,
} from '../../../constants/roleNavigation';

type Props = {
  showBack?:
    boolean;
};

/*
 * =========================================================
 * ROLE ROUTE
 * =========================================================
 */

function getRoleRoute(
  role:
    UserRole,
): Href {
  if (
    role ===
    'admin'
  ) {
    return '/admin' as Href;
  }

  if (
    role ===
    'teacher'
  ) {
    return '/teacher' as Href;
  }

  return '/student' as Href;
}

/*
 * =========================================================
 * LOGIN SCREEN
 * =========================================================
 */

export function LoginScreen({
  showBack =
    false,
}: Props) {
  const router =
    useRouter();

  const [
    userId,
    setUserId,
  ] =
    useState('');

  const [
    password,
    setPassword,
  ] =
    useState('');

  const [
    showPassword,
    setShowPassword,
  ] =
    useState(
      false,
    );

  const [
    isLoading,
    setIsLoading,
  ] =
    useState(
      false,
    );

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('');

  const {
    width,
    height,
  } =
    useWindowDimensions();

  const isSmallPhone =
    height <
    720;

  const isVerySmallPhone =
    height <
    650;

  const horizontalPadding =
    Math.max(
      22,

      Math.min(
        30,
        width *
          0.072,
      ),
    );

  /*
   * =====================================================
   * INPUT
   * =====================================================
   */

  function handleUserIdChange(
    text:
      string,
  ) {
    setUserId(
      text,
    );

    if (
      errorMessage
    ) {
      setErrorMessage(
        '',
      );
    }
  }

  function handlePasswordChange(
    text:
      string,
  ) {
    setPassword(
      text,
    );

    if (
      errorMessage
    ) {
      setErrorMessage(
        '',
      );
    }
  }

  /*
   * =====================================================
   * BACK
   * =====================================================
   */

  function handleBack() {
    if (
      isLoading
    ) {
      return;
    }

    router.back();
  }

  /*
   * =====================================================
   * LOGIN
   * =====================================================
   */

  async function handleLogin() {
    if (
      isLoading
    ) {
      return;
    }

    const loginId =
      userId
        .trim()
        .toLowerCase();

    setErrorMessage(
      '',
    );

    if (
      !loginId &&
      !password
    ) {
      setErrorMessage(
        'Please enter your User ID and password.',
      );

      return;
    }

    if (
      !loginId
    ) {
      setErrorMessage(
        'Please enter your User ID.',
      );

      return;
    }

    if (
      !password
    ) {
      setErrorMessage(
        'Please enter your password.',
      );

      return;
    }

    try {
      setIsLoading(
        true,
      );

      /*
       * User types:
       *
       * President
       * TR-001
       * ST-001-10A
       *
       * Supabase Auth actually uses:
       *
       * president@school.local
       * tr-001@school.local
       * st-001-10a@school.local
       */

      const email =
        `${loginId}@school.local`;

      const {
        data:
          authData,

        error:
          authError,
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password,
          });

      if (
        authError
      ) {
        console.log(
          'LOGIN ERROR:',
          authError.message,
        );

        setErrorMessage(
          'User ID or password is incorrect.',
        );

        return;
      }

      if (
        !authData.user ||
        !authData.session
      ) {
        setErrorMessage(
          'Unable to open this account.',
        );

        return;
      }

      /*
       * ===========================================
       * LOAD PROFILE
       * ===========================================
       */

      const {
        data:
          profile,

        error:
          profileError,
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
            role,
            teacher_id,
            student_id,
            avatar_url,
            must_change_password,
            created_at
          `)
          .eq(
            'user_id',
            authData.user.id,
          )
          .single();

      if (
        profileError ||
        !profile
      ) {
        console.log(
          'PROFILE ERROR:',
          profileError?.message,
        );

        setErrorMessage(
          'Your profile could not be loaded.',
        );

        return;
      }

      const role =
        profile.role as
          UserRole;

      if (
        role !==
          'admin' &&
        role !==
          'teacher' &&
        role !==
          'student'
      ) {
        setErrorMessage(
          'This account does not have a valid role.',
        );

        return;
      }

      /*
       * ===========================================
       * SAVE ACCOUNT
       *
       * Password is NEVER saved.
       *
       * Only Supabase session tokens are stored.
       * ===========================================
       */

      await saveAccount(
        {
          userId:
            authData.user.id,

          loginId:
            userId
              .trim()
              .toUpperCase(),

          fullName:
            profile.full_name,

          role,

          avatarUrl:
            profile.avatar_url ??
            null,

          teacherId:
            profile.teacher_id ??
            null,

          studentId:
            profile.student_id ??
            null,
        },

        authData.session,
      );

      console.log(
        'LOGIN SUCCESS',
      );

      console.log(
        'ROLE:',
        role,
      );

      /*
       * ===========================================
       * FIRST LOGIN
       * ===========================================
       */

      if (
        profile
          .must_change_password
      ) {
        router.replace(
          '/change-password' as Href,
        );

        return;
      }

      /*
       * ===========================================
       * OPEN ROLE
       * ===========================================
       */

      router.replace(
        getRoleRoute(
          role,
        ),
      );
    } catch (
      error
    ) {
      console.log(
        'UNEXPECTED LOGIN ERROR:',
        error,
      );

      setErrorMessage(
        'Something went wrong. Please try again.',
      );
    } finally {
      setIsLoading(
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
        'top',
        'left',
        'right',
        'bottom',
      ]}
    >
      <StatusBar
        style="dark"
      />

      {/* ADD ACCOUNT HEADER */}

      {showBack ? (
        <View
          style={
            styles.topHeader
          }
        >
          <Pressable
            onPress={
              handleBack
            }
            disabled={
              isLoading
            }
            hitSlop={
              12
            }
            style={({
              pressed,
            }) => [
              styles.backButton,

              pressed &&
                styles.backButtonPressed,
            ]}
          >
            <Ionicons
              name="chevron-back"
              size={
                25
              }
              color="#102B59"
            />
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Add account
          </Text>

          <View
            style={
              styles.headerSpacer
            }
          />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={
          styles.keyboardView
        }
        behavior={
          Platform.OS ===
          'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
          bounces={
            false
          }
          contentContainerStyle={[
            styles.scrollContent,

            {
              paddingHorizontal:
                horizontalPadding,
            },
          ]}
        >
          {/* BRAND */}

          <View
            style={[
              styles.brand,

              {
                marginTop:
                  showBack
                    ? isSmallPhone
                      ? 30
                      : 55
                    : isVerySmallPhone
                      ? 45
                      : isSmallPhone
                        ? 65
                        : 95,
              },
            ]}
          >
            <LinearGradient
              colors={[
                '#F3F8FF',
                '#E2F0FF',
              ]}
              start={{
                x: 0,
                y: 0,
              }}
              end={{
                x: 1,
                y: 1,
              }}
              style={[
                styles.logo,

                isSmallPhone &&
                  styles.logoSmall,
              ]}
            >
              <Ionicons
                name="school-outline"
                size={
                  isSmallPhone
                    ? 45
                    : 53
                }
                color="#1671F5"
              />
            </LinearGradient>

            <Text
              style={[
                styles.title,

                isSmallPhone &&
                  styles.titleSmall,
              ]}
            >
              EduPortal
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Your School. Your Future.
            </Text>
          </View>

          {/* FORM */}

          <View
            style={[
              styles.form,

              {
                marginTop:
                  isSmallPhone
                    ? 40
                    : 52,
              },
            ]}
          >
            {/* USER ID */}

            <View
              style={
                styles.inputContainer
              }
            >
              <Ionicons
                name="person-outline"
                size={
                  20
                }
                color="#7187A4"
              />

              <TextInput
                value={
                  userId
                }
                onChangeText={
                  handleUserIdChange
                }
                placeholder="User ID"
                placeholderTextColor="#8295AD"
                autoCapitalize="characters"
                autoCorrect={
                  false
                }
                selectionColor="#1671F5"
                style={
                  styles.input
                }
                returnKeyType="next"
                editable={
                  !isLoading
                }
              />
            </View>

            {/* PASSWORD */}

            <View
              style={
                styles.inputContainer
              }
            >
              <Ionicons
                name="lock-closed-outline"
                size={
                  20
                }
                color="#7187A4"
              />

              <TextInput
                value={
                  password
                }
                onChangeText={
                  handlePasswordChange
                }
                placeholder="Password"
                placeholderTextColor="#8295AD"
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
                autoCorrect={
                  false
                }
                selectionColor="#1671F5"
                style={
                  styles.input
                }
                returnKeyType="done"
                editable={
                  !isLoading
                }
                onSubmitEditing={
                  handleLogin
                }
              />

              <Pressable
                onPress={() =>
                  setShowPassword(
                    (
                      current,
                    ) =>
                      !current,
                  )
                }
                disabled={
                  isLoading
                }
                hitSlop={
                  12
                }
                style={
                  styles.eyeButton
                }
              >
                <Ionicons
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={
                    21
                  }
                  color="#7187A4"
                />
              </Pressable>
            </View>

            {/* ERROR */}

            {errorMessage ? (
              <View
                style={
                  styles.errorContainer
                }
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={
                    17
                  }
                  color="#E5484D"
                />

                <Text
                  style={
                    styles.errorText
                  }
                >
                  {
                    errorMessage
                  }
                </Text>
              </View>
            ) : null}

            {/* SIGN IN */}

            <Pressable
              onPress={
                handleLogin
              }
              disabled={
                isLoading
              }
              style={({
                pressed,
              }) => [
                styles.buttonShadow,

                pressed &&
                  !isLoading &&
                  styles.buttonPressed,

                isLoading &&
                  styles.buttonDisabled,
              ]}
            >
              <LinearGradient
                colors={[
                  '#31B5F8',
                  '#1474F5',
                ]}
                start={{
                  x: 0,
                  y: 0.5,
                }}
                end={{
                  x: 1,
                  y: 0.5,
                }}
                style={
                  styles.button
                }
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator
                      size="small"
                      color="#FFFFFF"
                    />

                    <Text
                      style={
                        styles.buttonText
                      }
                    >
                      Signing In...
                    </Text>
                  </>
                ) : (
                  <>
                    <Text
                      style={
                        styles.buttonText
                      }
                    >
                      Sign In
                    </Text>

                    <Ionicons
                      name="arrow-forward"
                      size={
                        20
                      }
                      color="#FFFFFF"
                    />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </ScrollView>

        <Text
          pointerEvents="none"
          style={
            styles.footer
          }
        >
          A brighter tomorrow together
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/*
 * =========================================================
 * STYLES
 * =========================================================
 */

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,

      backgroundColor:
        '#FBFDFF',
    },

    keyboardView: {
      flex: 1,

      backgroundColor:
        '#FBFDFF',
    },

    topHeader: {
      height: 56,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        12,

      borderBottomWidth:
        1,

      borderBottomColor:
        '#EDF1F6',

      backgroundColor:
        '#FBFDFF',
    },

    backButton: {
      width: 42,

      height: 42,

      borderRadius:
        21,

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    backButtonPressed: {
      backgroundColor:
        '#EEF4FA',
    },

    headerTitle: {
      flex: 1,

      textAlign:
        'center',

      fontSize: 16,

      fontWeight:
        '700',

      color:
        '#102B59',
    },

    headerSpacer: {
      width: 42,
    },

    scrollContent: {
      flexGrow: 1,

      paddingBottom:
        100,
    },

    brand: {
      alignItems:
        'center',
    },

    logo: {
      width: 102,

      height: 102,

      borderRadius:
        29,

      justifyContent:
        'center',

      alignItems:
        'center',

      shadowColor:
        '#1570EF',

      shadowOffset: {
        width: 0,
        height: 8,
      },

      shadowOpacity:
        0.08,

      shadowRadius:
        18,

      elevation: 3,
    },

    logoSmall: {
      width: 88,

      height: 88,

      borderRadius:
        25,
    },

    title: {
      marginTop:
        16,

      fontSize:
        30,

      fontWeight:
        '800',

      letterSpacing:
        -0.8,

      color:
        '#102B59',
    },

    titleSmall: {
      marginTop:
        13,

      fontSize:
        27,
    },

    subtitle: {
      marginTop: 3,

      fontSize: 14,

      fontWeight:
        '500',

      color:
        '#6A809E',
    },

    form: {
      width:
        '100%',
    },

    inputContainer: {
      height: 58,

      flexDirection:
        'row',

      alignItems:
        'center',

      paddingHorizontal:
        18,

      borderRadius:
        18,

      backgroundColor:
        '#FFFFFF',

      borderWidth: 1,

      borderColor:
        '#E5EDF6',

      marginBottom:
        15,

      shadowColor:
        '#526B8D',

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity:
        0.055,

      shadowRadius:
        10,

      elevation: 2,
    },

    input: {
      flex: 1,

      height:
        '100%',

      marginLeft:
        13,

      paddingVertical:
        0,

      fontSize:
        15,

      fontWeight:
        '500',

      color:
        '#173454',
    },

    eyeButton: {
      width: 40,

      height: 44,

      justifyContent:
        'center',

      alignItems:
        'flex-end',
    },

    errorContainer: {
      flexDirection:
        'row',

      alignItems:
        'center',

      marginTop:
        -2,

      marginBottom:
        13,

      paddingHorizontal:
        3,

      gap: 6,
    },

    errorText: {
      flex: 1,

      color:
        '#E5484D',

      fontSize: 13,

      fontWeight:
        '500',

      lineHeight: 18,
    },

    buttonShadow: {
      marginTop: 5,

      borderRadius:
        19,

      shadowColor:
        '#1474F5',

      shadowOffset: {
        width: 0,
        height: 8,
      },

      shadowOpacity:
        0.22,

      shadowRadius:
        14,

      elevation: 6,
    },

    buttonPressed: {
      transform: [
        {
          scale:
            0.985,
        },
      ],

      opacity:
        0.92,
    },

    buttonDisabled: {
      opacity:
        0.72,
    },

    button: {
      height: 58,

      borderRadius:
        19,

      flexDirection:
        'row',

      justifyContent:
        'center',

      alignItems:
        'center',

      gap: 11,
    },

    buttonText: {
      color:
        '#FFFFFF',

      fontSize: 16,

      fontWeight:
        '700',
    },

    footer: {
      position:
        'absolute',

      bottom: 26,

      alignSelf:
        'center',

      color:
        '#6486AD',

      fontSize:
        11.5,

      fontWeight:
        '500',
    },
  });