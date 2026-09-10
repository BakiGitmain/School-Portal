import React, {
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  View,
} from 'react-native';

import {
  Redirect,
  type Href,
} from 'expo-router';

import {
  supabase,
} from '../lib/supabase';

import {
  LoginScreen,
} from '../features/auth/screens/LoginScreen';

type UserRole =
  | 'admin'
  | 'teacher'
  | 'student';

type Profile = {
  role:
    UserRole;

  must_change_password:
    boolean;
};

/*
 * =========================================================
 * ROOT PAGE
 *
 * /
 *
 * This page decides where the current account should go:
 *
 * admin   -> /admin
 * teacher -> /teacher
 * student -> /student
 *
 * If there is no session, show LoginScreen.
 * =========================================================
 */

export default function RootPage() {
  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    hasSession,
    setHasSession,
  ] =
    useState(
      false,
    );

  const [
    profile,
    setProfile,
  ] =
    useState<
      Profile |
      null
    >(
      null,
    );

  /*
   * =====================================================
   * LOAD CURRENT ACCOUNT
   * =====================================================
   */

  useEffect(
    () => {
      let mounted =
        true;

      /*
       * ---------------------------------------------
       * LOAD SESSION + PROFILE
       * ---------------------------------------------
       */

      async function loadCurrentAccount() {
        try {
          if (
            mounted
          ) {
            setLoading(
              true,
            );
          }

          /*
           * Get currently active Supabase session.
           */

          const {
            data:
              sessionData,
            error:
              sessionError,
          } =
            await supabase.auth
              .getSession();

          if (
            !mounted
          ) {
            return;
          }

          /*
           * No active account.
           */

          if (
            sessionError ||
            !sessionData.session
          ) {
            setHasSession(
              false,
            );

            setProfile(
              null,
            );

            return;
          }

          setHasSession(
            true,
          );

          const userId =
            sessionData
              .session
              .user
              .id;

          /*
           * Load profile for the account
           * that is currently active.
           */

          const {
            data:
              profileData,
            error:
              profileError,
          } =
            await supabase
              .from(
                'profiles',
              )
              .select(`
                role,
                must_change_password
              `)
              .eq(
                'user_id',
                userId,
              )
              .single();

          if (
            !mounted
          ) {
            return;
          }

          /*
           * Session exists but profile
           * could not be loaded.
           */

          if (
            profileError ||
            !profileData
          ) {
            console.log(
              'ROOT PROFILE ERROR:',
              profileError,
            );

            setProfile(
              null,
            );

            return;
          }

          const role =
            profileData.role as
              UserRole;

          /*
           * Make sure role is valid.
           */

          if (
            role !==
              'admin' &&
            role !==
              'teacher' &&
            role !==
              'student'
          ) {
            console.log(
              'INVALID ROLE:',
              role,
            );

            setProfile(
              null,
            );

            return;
          }

          setProfile({
            role,

            must_change_password:
              Boolean(
                profileData
                  .must_change_password,
              ),
          });
        } catch (
          error
        ) {
          console.log(
            'ROOT LOAD ERROR:',
            error,
          );

          if (
            mounted
          ) {
            setHasSession(
              false,
            );

            setProfile(
              null,
            );
          }
        } finally {
          if (
            mounted
          ) {
            setLoading(
              false,
            );
          }
        }
      }

      /*
       * Initial load.
       */

      void loadCurrentAccount();

      /*
       * =================================================
       * AUTH LISTENER
       *
       * Important when switching:
       *
       * President -> Student
       * Teacher   -> Student
       * Student   -> President
       * =================================================
       */

      const {
        data:
          authListener,
      } =
        supabase.auth
          .onAuthStateChange(
            (
              event,
            ) => {
              console.log(
                'ROOT AUTH EVENT:',
                event,
              );

              void loadCurrentAccount();
            },
          );

      /*
       * Cleanup.
       */

      return () => {
        mounted =
          false;

        authListener
          .subscription
          .unsubscribe();
      };
    },
    [],
  );

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <LoadingScreen />
    );
  }

  /*
   * =====================================================
   * NOT LOGGED IN
   * =====================================================
   */

  if (
    !hasSession
  ) {
    return (
      <LoginScreen />
    );
  }

  /*
   * =====================================================
   * SESSION EXISTS BUT PROFILE NOT READY
   * =====================================================
   */

  if (
    !profile
  ) {
    return (
      <LoadingScreen />
    );
  }

  /*
   * =====================================================
   * MUST CHANGE PASSWORD
   * =====================================================
   */

  if (
    profile.must_change_password
  ) {
    return (
      <Redirect
        href={
          '/change-password' as Href
        }
      />
    );
  }

  /*
   * =====================================================
   * PRESIDENT
   * =====================================================
   */

  if (
    profile.role ===
    'admin'
  ) {
    return (
      <Redirect
        href={
          '/admin' as Href
        }
      />
    );
  }

  /*
   * =====================================================
   * TEACHER
   * =====================================================
   */

  if (
    profile.role ===
    'teacher'
  ) {
    return (
      <Redirect
        href={
          '/teacher' as Href
        }
      />
    );
  }

  /*
   * =====================================================
   * STUDENT
   * =====================================================
   *
   * Your folder now exists at:
   *
   * src/app/student/index.tsx
   *
   * So this is the correct route.
   * =====================================================
   */

  return (
    <Redirect
      href={
        '/student' as Href
      }
    />
  );
}

/*
 * =========================================================
 * LOADING SCREEN
 * =========================================================
 */

function LoadingScreen() {
  return (
    <View
      style={{
        flex:
          1,

        alignItems:
          'center',

        justifyContent:
          'center',

        backgroundColor:
          '#F7FAFE',
      }}
    >
      <ActivityIndicator
        size="large"
        color="#1671F5"
      />
    </View>
  );
}