import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  supabase,
} from '../lib/supabase';

import type {
  UserRole,
} from '../constants/roleNavigation';

/*
 * =========================================================
 * PROFILE TYPE
 * =========================================================
 */

export type CurrentProfile = {
  id: string;

  user_id: string;

  full_name: string;

  username:
    | string
    | null;

  role:
    UserRole;

  teacher_id:
    | string
    | null;

  student_id:
    | string
    | null;

  avatar_url:
    | string
    | null;

  must_change_password:
    boolean;

  created_at:
    string;
};

/*
 * =========================================================
 * PROFILE COLUMNS
 * =========================================================
 */

export const PROFILE_COLUMNS = `
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
`;

/*
 * =========================================================
 * ROLE CHECK
 * =========================================================
 */

export function isUserRole(
  role:
    unknown,
): role is UserRole {
  return (
    role ===
      'admin' ||
    role ===
      'teacher' ||
    role ===
      'student'
  );
}

/*
 * =========================================================
 * CURRENT PROFILE HOOK
 * =========================================================
 */

export function useCurrentProfile() {
  const [
    profile,
    setProfile,
  ] =
    useState<
      CurrentProfile |
      null
    >(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
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
    userId,
    setUserId,
  ] =
    useState<
      string |
      null
    >(
      null,
    );

  /*
   * Used to ignore an older request
   * after an account switch.
   */

  const requestId =
    useRef(
      0,
    );

  /*
   * =====================================================
   * LOAD PROFILE
   * =====================================================
   */

  const loadProfile =
    useCallback(
      async (
        knownUserId?:
          string |
          null,
      ) => {
        const currentRequest =
          ++requestId.current;

        try {
          setLoading(
            true,
          );

          setError(
            null,
          );

          let currentUserId =
            knownUserId;

          /*
           * If we were not given a user ID,
           * ask Supabase for the authenticated user.
           */

          if (
            currentUserId ===
            undefined
          ) {
            const {
              data:
                userData,

              error:
                userError,
            } =
              await supabase.auth
                .getUser();

            if (
              userError
            ) {
              throw userError;
            }

            currentUserId =
              userData.user
                ?.id ??
              null;
          }

          /*
           * Ignore this request if a newer
           * account-switch request started.
           */

          if (
            currentRequest !==
            requestId.current
          ) {
            return;
          }

          setUserId(
            currentUserId ??
              null,
          );

          /*
           * Not logged in.
           */

          if (
            !currentUserId
          ) {
            setProfile(
              null,
            );

            return;
          }

          /*
           * Load the profile belonging to
           * the authenticated Supabase user.
           */

          const {
            data,
            error:
              profileError,
          } =
            await supabase
              .from(
                'profiles',
              )
              .select(
                PROFILE_COLUMNS,
              )
              .eq(
                'user_id',
                currentUserId,
              )
              .single();

          if (
            profileError
          ) {
            throw profileError;
          }

          if (
            !data
          ) {
            throw new Error(
              'Your profile could not be loaded.',
            );
          }

          if (
            !isUserRole(
              data.role,
            )
          ) {
            throw new Error(
              'This account does not have a valid profile role.',
            );
          }

          /*
           * Account may have switched while
           * this request was running.
           */

          if (
            currentRequest !==
            requestId.current
          ) {
            return;
          }

          setProfile(
            data as
              CurrentProfile,
          );
        } catch (
          loadError
        ) {
          if (
            currentRequest !==
            requestId.current
          ) {
            return;
          }

          const message =
            loadError instanceof
            Error
              ? loadError.message
              : 'Your profile could not be loaded.';

          console.log(
            'PROFILE ERROR:',
            message,
          );

          setProfile(
            null,
          );

          setError(
            message,
          );
        } finally {
          if (
            currentRequest ===
            requestId.current
          ) {
            /*
             * IMPORTANT:
             *
             * Loading ALWAYS ends.
             * The app cannot remain on the
             * loading screen forever.
             */

            setLoading(
              false,
            );
          }
        }
      },
      [],
    );

  /*
   * =====================================================
   * INITIAL LOAD + AUTH CHANGES
   * =====================================================
   */

  useEffect(
    () => {
      /*
       * Load account when app starts.
       */

      void loadProfile();

      /*
       * Listen for:
       *
       * login
       * logout
       * account switching
       * token refresh
       */

      const {
        data: {
          subscription,
        },
      } =
        supabase.auth
          .onAuthStateChange(
            (
              event,
              session,
            ) => {
              /*
               * Don't run another Supabase request
               * inside the auth callback itself.
               */

              const nextUserId =
                session
                  ?.user
                  .id ??
                null;

              if (
                event ===
                  'TOKEN_REFRESHED'
              ) {
                return;
              }

              setTimeout(
                () => {
                  void loadProfile(
                    nextUserId,
                  );
                },
                0,
              );
            },
          );

      return () => {
        /*
         * Cancel any older profile request.
         */

        requestId.current +=
          1;

        subscription
          .unsubscribe();
      };
    },
    [
      loadProfile,
    ],
  );

  /*
   * =====================================================
   * MANUAL RELOAD
   * =====================================================
   */

  const reload =
    useCallback(
      () => {
        void loadProfile();
      },
      [
        loadProfile,
      ],
    );

  return {
    profile,

    loading,

    error,

    userId,

    reload,
  };
}