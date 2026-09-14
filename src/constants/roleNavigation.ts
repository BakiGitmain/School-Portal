import type { ComponentProps } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';

export type UserRole =
  | 'admin'
  | 'teacher'
  | 'student';

type IconName =
  ComponentProps<typeof Ionicons>['name'];

export type NavigationItem = {
  route: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
};

export const ROLE_LABELS: Record<
  UserRole,
  string
> = {
  admin: 'President',
  teacher: 'Teacher',
  student: 'Student',
};

export const ROLE_NAVIGATION: Record<
  UserRole,
  NavigationItem[]
> = {
  // =====================================
  // PRESIDENT
  // =====================================

  admin: [
    {
      route: 'index',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      route: 'teachers',
      label: 'Teachers',
      icon: 'people-outline',
      activeIcon: 'people',
    },
    {
      route: 'classes',
      label: 'Classes',
      icon: 'school-outline',
      activeIcon: 'school',
    },
    {
      route: 'reports',
      label: 'Reports',
      icon: 'stats-chart-outline',
      activeIcon: 'stats-chart',
    },
    {
      route: 'more',
      label: 'More',
      icon: 'grid-outline',
      activeIcon: 'grid',
    },
  ],

  // =====================================
  // TEACHER
  // =====================================

  teacher: [
    {
      route: 'index',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      route: 'students',
      label: 'Students',
      icon: 'people-outline',
      activeIcon: 'people',
    },
    {
      route: 'results',
      label: 'Results',
      icon: 'clipboard-outline',
      activeIcon: 'clipboard',
    },
    {
      route: 'attendance',
      label: 'Attendance',
      icon: 'calendar-outline',
      activeIcon: 'calendar',
    },
    {
      route: 'more',
      label: 'More',
      icon: 'grid-outline',
      activeIcon: 'grid',
    },
  ],

  // =====================================
  // STUDENT
  // =====================================

  student: [
    {
      route: 'index',
      label: 'Home',
      icon: 'home-outline',
      activeIcon: 'home',
    },
    {
      route: 'results',
      label: 'Results',
      icon: 'bar-chart-outline',
      activeIcon: 'bar-chart',
    },
    {
      route: 'attendance',
      label: 'Attendance',
      icon: 'calendar-outline',
      activeIcon: 'calendar',
    },
    {
      route: 'more',
      label: 'More',
      icon: 'grid-outline',
      activeIcon: 'grid',
    },
  ],
};

export function getPageTitle(
  role: UserRole,
  routeName: string
) {
  if (routeName === 'index') {
    return `${ROLE_LABELS[role]} Dashboard`;
  }

  if (routeName === 'profile') {
    return 'Profile';
  }

  if (routeName === 'settings') {
    return 'Settings';
  }

  const item = ROLE_NAVIGATION[role].find(
    (navigationItem) =>
      navigationItem.route === routeName
  );

  return item?.label ?? 'EduPortal';
}
