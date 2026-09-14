import type { Href } from 'expo-router';

import type { UserRole } from '../constants/roleNavigation';

export type NotificationAction =
  | 'calendar'
  | 'attendance'
  | 'behavior'
  | 'results'
  | 'schedule'
  | 'notifications';

export function isNotificationAction(value: unknown): value is NotificationAction {
  return value === 'calendar'
    || value === 'attendance'
    || value === 'behavior'
    || value === 'results'
    || value === 'schedule'
    || value === 'notifications';
}

export function getNotificationRoute(role: UserRole, action?: unknown): Href {
  if (action === 'calendar') return `/${role}/more/calendar` as Href;
  if (action === 'schedule') return role === 'admin' ? '/admin/more/timetable' : `/${role}/more/schedule` as Href;
  if (action === 'attendance') return role === 'admin' ? '/admin/reports' : `/${role}/attendance` as Href;
  if (action === 'behavior') return role === 'admin' ? '/admin/notifications' : `/${role}/more/behavior` as Href;
  if (action === 'results') return role === 'admin' ? '/admin/reports' : `/${role}/results` as Href;
  return `/${role}/notifications` as Href;
}
