import React, {
  useState,
} from 'react';

import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  type Href,
  useRouter,
} from 'expo-router';

import Ionicons from '@expo/vector-icons/Ionicons';

import {
  SafeAreaView,
} from 'react-native-safe-area-context';

import { supabase } from '../lib/supabase';

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(null);

  async function handleSave() {
    setError(null);

    if (password.length < 6) {
      setError(
        'Use at least 6 characters.'
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        'Passwords do not match.'
      );

      return;
    }

    try {
      setLoading(true);

      const {
        error: passwordError,
      } =
        await supabase.auth.updateUser({
          password,
        });

      if (passwordError) {
        setError(
          passwordError.message
        );

        return;
      }

      const {
        error: profileError,
      } =
        await supabase.rpc(
          'complete_first_login'
        );

      if (profileError) {
        setError(
          profileError.message
        );

        return;
      }

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace(
          '/' as Href
        );

        return;
      }

      const {
        data: profile,
      } = await supabase
        .from('profiles')
        .select('role')
        .eq(
          'user_id',
          user.id
        )
        .single();

      if (!profile) {
        router.replace(
          '/' as Href
        );

        return;
      }

      router.replace(
        `/${profile.role}` as Href
      );
    } catch {
      setError(
        'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <View
          style={styles.content}
        >
          <View
            style={styles.icon}
          >
            <Ionicons
              name="lock-closed-outline"
              size={26}
              color="#1671F5"
            />
          </View>

          <Text
            style={styles.title}
          >
            New password
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Change your temporary password.
          </Text>

          <View
            style={styles.form}
          >
            <View
              style={
                styles.passwordInput
              }
            >
              <TextInput
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setError(null);
                }}
                placeholder="New password"
                placeholderTextColor="#9AA7B8"
                secureTextEntry={
                  !showPassword
                }
                style={
                  styles.passwordTextInput
                }
              />

              <Pressable
                onPress={() =>
                  setShowPassword(
                    (value) =>
                      !value
                  )
                }
              >
                <Ionicons
                  name={
                    showPassword
                      ? 'eye-off-outline'
                      : 'eye-outline'
                  }
                  size={20}
                  color="#8291A5"
                />
              </Pressable>
            </View>

            <TextInput
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(
                  text
                );
                setError(null);
              }}
              placeholder="Confirm password"
              placeholderTextColor="#9AA7B8"
              secureTextEntry={
                !showPassword
              }
              style={styles.input}
            />

            {error && (
              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            )}

            <Pressable
              disabled={loading}
              onPress={handleSave}
              style={({ pressed }) => [
                styles.button,

                pressed &&
                  styles.buttonPressed,

                loading &&
                  styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Save password
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: '#FBFDFF',
    },

    container: {
      flex: 1,
    },

    content: {
      flex: 1,
      justifyContent: 'center',

      paddingHorizontal: 24,
      paddingBottom: 70,
    },

    icon: {
      width: 58,
      height: 58,

      borderRadius: 18,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor: '#EAF3FF',

      marginBottom: 20,
    },

    title: {
      fontSize: 26,
      fontWeight: '800',
      color: '#102B59',
    },

    subtitle: {
      marginTop: 6,

      fontSize: 14,
      color: '#8190A5',
    },

    form: {
      marginTop: 28,
      gap: 13,
    },

    input: {
      height: 54,

      paddingHorizontal: 16,

      borderRadius: 16,

      backgroundColor: '#FFFFFF',

      borderWidth: 1,
      borderColor: '#E1E8F0',

      fontSize: 15,
      color: '#102B59',
    },

    passwordInput: {
      height: 54,

      paddingHorizontal: 16,

      borderRadius: 16,

      backgroundColor: '#FFFFFF',

      borderWidth: 1,
      borderColor: '#E1E8F0',

      flexDirection: 'row',
      alignItems: 'center',
    },

    passwordTextInput: {
      flex: 1,

      fontSize: 15,
      color: '#102B59',
    },

    errorText: {
      fontSize: 13,
      color: '#E5484D',
    },

    button: {
      height: 54,

      marginTop: 5,

      borderRadius: 16,

      alignItems: 'center',
      justifyContent: 'center',

      backgroundColor: '#1671F5',
    },

    buttonPressed: {
      opacity: 0.85,
    },

    buttonDisabled: {
      opacity: 0.7,
    },

    buttonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });