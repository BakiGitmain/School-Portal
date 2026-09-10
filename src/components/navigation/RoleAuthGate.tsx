import {
  Fragment,
  type ReactNode,
} from 'react';

import {
  Redirect,
  type Href,
} from 'expo-router';

import type {
  UserRole,
} from '../../constants/roleNavigation';

import {
  useCurrentProfile,
} from '../../hooks/useCurrentProfile';

import AppLoadingScreen from '../common/AppLoadingScreen';

type Props = {
  role: UserRole;
  children: ReactNode;
};

export default function RoleAuthGate({
  role,
  children,
}: Props) {
  const {
    profile,
    loading,
  } = useCurrentProfile();

  // Only show loading while we're ACTUALLY loading.
  if (loading) {
    return (
      <AppLoadingScreen
        role={role}
      />
    );
  }

  // Loading finished but no profile.
  // Do NOT keep spinning forever.
  if (!profile) {
    return (
      <Redirect
        href={'/' as Href}
      />
    );
  }

  // First login password change.
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

  // Wrong dashboard for this role.
  if (
    profile.role !== role
  ) {
    return (
      <Redirect
        href={
          `/${profile.role}` as Href
        }
      />
    );
  }

  // Key changes when switching accounts,
  // so old account screen state is discarded.
  return (
    <Fragment
      key={profile.user_id}
    >
      {children}
    </Fragment>
  );
}