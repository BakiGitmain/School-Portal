import * as SecureStore from 'expo-secure-store';

import type {
  UserRole,
} from '../constants/roleNavigation';

/*
 * =========================================================
 * STORAGE KEYS
 * =========================================================
 */

const ACCOUNTS_KEY =
  'eduportal.saved.accounts';

function getSessionKey(
  userId: string,
) {
  return `eduportal.session.${userId}`;
}

/*
 * =========================================================
 * TYPES
 * =========================================================
 */

export type SavedAccount = {
  userId: string;

  loginId: string;

  fullName: string;

  role: UserRole;

  avatarUrl:
    | string
    | null;

  teacherId:
    | string
    | null;

  studentId:
    | string
    | null;
};

type SavedSession = {
  accessToken: string;

  refreshToken: string;
};

type SessionLike = {
  access_token: string;

  refresh_token: string;
};

/*
 * =========================================================
 * GET SAVED ACCOUNTS
 * =========================================================
 */

export async function getSavedAccounts(): Promise<
  SavedAccount[]
> {
  try {
    const raw =
      await SecureStore
        .getItemAsync(
          ACCOUNTS_KEY,
        );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(
        raw,
      );

    if (
      !Array.isArray(
        parsed,
      )
    ) {
      return [];
    }

    return parsed.filter(
      (
        account,
      ) =>
        account &&
        typeof account ===
          'object' &&
        typeof account.userId ===
          'string' &&
        typeof account.loginId ===
          'string' &&
        typeof account.fullName ===
          'string' &&
        (
          account.role ===
            'admin' ||
          account.role ===
            'teacher' ||
          account.role ===
            'student'
        ),
    );
  } catch (
    error
  ) {
    console.log(
      'GET SAVED ACCOUNTS ERROR:',
      error,
    );

    return [];
  }
}

/*
 * =========================================================
 * SAVE ACCOUNT
 * =========================================================
 */

export async function saveAccount(
  account:
    SavedAccount,

  session:
    SessionLike,
) {
  const current =
    await getSavedAccounts();

  /*
   * Put the most recently used
   * account first.
   */

  const next = [
    account,

    ...current.filter(
      (
        saved,
      ) =>
        saved.userId !==
        account.userId,
    ),
  ];

  await SecureStore
    .setItemAsync(
      ACCOUNTS_KEY,

      JSON.stringify(
        next,
      ),
    );

  const savedSession:
    SavedSession = {
    accessToken:
      session.access_token,

    refreshToken:
      session.refresh_token,
  };

  await SecureStore
    .setItemAsync(
      getSessionKey(
        account.userId,
      ),

      JSON.stringify(
        savedSession,
      ),
    );
}

/*
 * =========================================================
 * GET SAVED SESSION
 * =========================================================
 */

export async function getSavedSession(
  userId:
    string,
): Promise<
  SavedSession |
  null
> {
  try {
    const raw =
      await SecureStore
        .getItemAsync(
          getSessionKey(
            userId,
          ),
        );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(
        raw,
      );

    if (
      !parsed ||
      typeof parsed !==
        'object' ||
      typeof parsed.accessToken !==
        'string' ||
      typeof parsed.refreshToken !==
        'string'
    ) {
      return null;
    }

    return {
      accessToken:
        parsed.accessToken,

      refreshToken:
        parsed.refreshToken,
    };
  } catch (
    error
  ) {
    console.log(
      'GET SAVED SESSION ERROR:',
      error,
    );

    return null;
  }
}

/*
 * =========================================================
 * REMOVE ACCOUNT
 * =========================================================
 */

export async function removeSavedAccount(
  userId:
    string,
) {
  try {
    const current =
      await getSavedAccounts();

    const next =
      current.filter(
        (
          account,
        ) =>
          account.userId !==
          userId,
      );

    await SecureStore
      .setItemAsync(
        ACCOUNTS_KEY,

        JSON.stringify(
          next,
        ),
      );

    await SecureStore
      .deleteItemAsync(
        getSessionKey(
          userId,
        ),
      );
  } catch (
    error
  ) {
    console.log(
      'REMOVE SAVED ACCOUNT ERROR:',
      error,
    );

    throw error;
  }
}