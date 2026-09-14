import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router, useFocusEffect } from 'expo-router';

import type { UserRole } from '../../constants/roleNavigation';
import { type AppThemeColors, useAppSettings } from '../../context/AppSettingsContext';
import { useCurrentProfile } from '../../hooks/useCurrentProfile';
import { supabase } from '../../lib/supabase';
import { useNotificationCenter } from '../../context/NotificationCenterContext';

type Row = Record<string, unknown>;
type Lesson = {
  id: string;
  subject: string;
  className: string;
  teacherName: string;
  classId: string;
  startMinute: number;
  endMinute: number;
};
type DashboardData = {
  todayLessons: Lesson[];
  attendancePending: string | null;
  attendanceRate: number | null;
  publishedSubjects: number;
  teachers: number;
  students: number;
  classes: number;
  schedulePublished: boolean;
};

const EMPTY_DATA: DashboardData = {
  todayLessons: [],
  attendancePending: null,
  attendanceRate: null,
  publishedSubjects: 0,
  teachers: 0,
  students: 0,
  classes: 0,
  schedulePublished: false,
};

function asRecord(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function currentSchoolYear() {
  const now = new Date();
  const start = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function formatMinute(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function parseTodayLessons(payload: unknown): Lesson[] {
  const root = asRecord(payload);
  const day = new Date().getDay() || 7;
  if (!root || !Array.isArray(root.entries)) return [];
  return root.entries
    .map(asRecord)
    .filter((row): row is Row => row !== null && Number(row.day_of_week) === day)
    .map(row => ({
      id: String(row.id ?? ''),
      subject: String(row.subject ?? 'Lesson'),
      className: String(row.class_name ?? 'Class'),
      teacherName: String(row.teacher_name ?? 'Teacher'),
      classId: String(row.class_id ?? ''),
      startMinute: Number(row.start_minute ?? 0),
      endMinute: Number(row.end_minute ?? 0),
    }))
    .sort((a, b) => a.startMinute - b.startMinute);
}

export default function RoleDashboardScreen({ role }: { role: UserRole }) {
  const { colors } = useAppSettings();
  const { width } = useWindowDimensions();
  const { profile } = useCurrentProfile();
  const { unreadCount } = useNotificationCenter();
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const requestId = useRef(0);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (refresh = false) => {
    const currentRequest = ++requestId.current;
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      if (role === 'admin') {
        const [teachersResult, studentsResult, classesResult, versionResult] = await Promise.all([
          supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'teacher'),
          supabase.from('profiles').select('user_id', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('school_classes').select('id', { count: 'exact', head: true }),
          supabase.from('timetable_versions').select('id').eq('status', 'published').limit(1).maybeSingle(),
        ]);
        const firstError = teachersResult.error ?? studentsResult.error ?? classesResult.error ?? versionResult.error;
        if (firstError) throw firstError;
        if (currentRequest !== requestId.current) return;
        setData({
          ...EMPTY_DATA,
          teachers: teachersResult.count ?? 0,
          students: studentsResult.count ?? 0,
          classes: classesResult.count ?? 0,
          schedulePublished: Boolean(versionResult.data),
        });
        return;
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const scheduleResult = await supabase.rpc('my_published_timetable_v1');
      if (scheduleResult.error) throw scheduleResult.error;
      const todayLessons = parseTodayLessons(scheduleResult.data);
      let attendancePending: string | null = null;
      let attendanceRate: number | null = null;
      let publishedSubjects = 0;

      if (role === 'teacher' && profile?.user_id) {
        const { data: classroom, error: classError } = await supabase
          .from('school_classes')
          .select('id,class_name')
          .eq('homeroom_teacher_user_id', profile.user_id)
          .limit(1)
          .maybeSingle();
        if (classError) throw classError;
        if (classroom && todayLessons.some(lesson => lesson.classId === classroom.id)) {
          const { data: session, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('id')
            .eq('class_id', classroom.id)
            .eq('attendance_date', dateKey(new Date()))
            .limit(1)
            .maybeSingle();
          if (sessionError) throw sessionError;
          if (!session) attendancePending = String(classroom.class_name);
        }
      }

      if (role === 'student') {
        const [attendanceResult, resultsResult] = await Promise.all([
          supabase.rpc('get_my_attendance', { p_from: dateKey(thirtyDaysAgo), p_to: dateKey(new Date()) }),
          supabase.rpc('get_my_published_results', { p_school_year: currentSchoolYear() }),
        ]);
        if (attendanceResult.error) throw attendanceResult.error;
        if (resultsResult.error) throw resultsResult.error;
        const attendanceRows = Array.isArray(attendanceResult.data) ? attendanceResult.data.map(asRecord).filter((item): item is Row => Boolean(item)) : [];
        const counted = attendanceRows.filter(row => row.status === 'present' || row.status === 'absent');
        attendanceRate = counted.length ? Math.round(counted.filter(row => row.status === 'present').length / counted.length * 100) : null;
        publishedSubjects = Array.isArray(resultsResult.data) ? resultsResult.data.length : 0;
      }

      if (currentRequest !== requestId.current) return;
      setData({ ...EMPTY_DATA, todayLessons, attendancePending, attendanceRate, publishedSubjects });
    } catch (caught) {
      console.log('LOAD DASHBOARD ERROR:', caught);
      if (currentRequest === requestId.current) setError('Your dashboard could not be loaded. Check your connection and try again.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [profile, role]);

  useFocusEffect(useCallback(() => {
    void loadDashboard();
    return () => { requestId.current += 1; };
  }, [loadDashboard]));

  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const nextLesson = data.todayLessons.find(lesson => lesson.endMinute >= minutesNow) ?? null;
  const actions = role === 'admin'
    ? [
        ['Teachers', 'people-outline', '/admin/teachers'],
        ['Classes', 'school-outline', '/admin/classes'],
        ['Timetable', 'calendar-outline', '/admin/more/timetable'],
        ['Reports', 'stats-chart-outline', '/admin/reports'],
      ]
    : role === 'teacher'
      ? [
          ['My Class', 'people-outline', '/teacher/students'],
          ['Attendance', 'checkbox-outline', '/teacher/attendance'],
          ['Results', 'ribbon-outline', '/teacher/results'],
          ['Schedule', 'calendar-outline', '/teacher/more/schedule'],
        ]
      : [
          ['Schedule', 'calendar-outline', '/student/more/schedule'],
          ['Attendance', 'checkbox-outline', '/student/attendance'],
          ['Results', 'ribbon-outline', '/student/results'],
          ['Updates', 'notifications-outline', '/student/notifications'],
        ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadDashboard(true)} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Welcome, {profile?.full_name?.split(' ')[0] || (role === 'admin' ? 'President' : role === 'teacher' ? 'Teacher' : 'Student')}</Text>
      <Text style={styles.subtitle}>{role === 'admin' ? 'A clear view of your school today.' : 'Here is what matters today.'}</Text>

      {loading ? <View style={styles.state}><ActivityIndicator color={colors.primary} /><Text style={styles.stateText}>Loading dashboard…</Text></View> : null}
      {!loading && error ? <View style={styles.state}><Ionicons name="cloud-offline-outline" size={30} color={colors.danger} /><Text style={styles.errorText}>{error}</Text><Pressable onPress={() => void loadDashboard()} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}

      {!loading && !error ? <>
        <View style={styles.statsGrid}>
          {role === 'admin' ? <>
            <StatCard icon="people" value={String(data.teachers)} label="Teachers" colors={colors} styles={styles} />
            <StatCard icon="people-circle" value={String(data.students)} label="Students" colors={colors} styles={styles} />
            <StatCard icon="school" value={String(data.classes)} label="Classes" colors={colors} styles={styles} />
            <StatCard icon="calendar" value={data.schedulePublished ? 'Live' : 'Draft'} label="Timetable" colors={colors} styles={styles} />
          </> : <>
            <StatCard icon="calendar" value={String(data.todayLessons.length)} label="Classes today" colors={colors} styles={styles} />
            <StatCard icon="notifications" value={String(unreadCount)} label="Unread updates" colors={colors} styles={styles} />
            {role === 'teacher' ? <StatCard icon="checkbox" value={data.attendancePending ? 'Pending' : 'Done'} label="Attendance" colors={colors} styles={styles} /> : <>
              <StatCard icon="checkmark-circle" value={data.attendanceRate === null ? '—' : `${data.attendanceRate}%`} label="30-day attendance" colors={colors} styles={styles} />
              <StatCard icon="ribbon" value={String(data.publishedSubjects)} label="Published subjects" colors={colors} styles={styles} />
            </>}
          </>}
        </View>

        {role !== 'admin' ? <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today</Text>
          {nextLesson ? <View style={styles.nextCard}>
            <View style={styles.nextIcon}><Ionicons name="time-outline" size={21} color={colors.primary} /></View>
            <View style={styles.nextText}><Text style={styles.nextLabel}>{minutesNow >= nextLesson.startMinute ? 'Happening now' : 'Next class'}</Text><Text style={styles.nextTitle}>{role === 'teacher' ? `${nextLesson.className} · ${nextLesson.subject}` : nextLesson.subject}</Text><Text style={styles.nextMeta}>{formatMinute(nextLesson.startMinute)} – {formatMinute(nextLesson.endMinute)}{role === 'student' ? ` · ${nextLesson.teacherName}` : ''}</Text></View>
          </View> : <Text style={styles.emptyText}>No more classes scheduled today.</Text>}
          {role === 'teacher' && data.attendancePending ? <Pressable onPress={() => router.push('/teacher/attendance')} style={styles.reminder}><Ionicons name="alert-circle-outline" size={21} color={colors.danger} /><Text style={styles.reminderText}>Attendance for {data.attendancePending} still needs to be completed.</Text></Pressable> : null}
        </View> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick actions</Text>
          <View style={styles.actionGrid}>{actions.map(([label, icon, route]) => <Pressable key={route} onPress={() => router.push(route as Href)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><Ionicons name={icon as React.ComponentProps<typeof Ionicons>['name']} size={22} color={colors.primary} /><Text style={styles.actionText}>{label}</Text></Pressable>)}</View>
        </View>
      </> : null}
    </ScrollView>
  );
}

function StatCard({ icon, value, label, colors, styles }: { icon: React.ComponentProps<typeof Ionicons>['name']; value: string; label: string; colors: AppThemeColors; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.statCard}><View style={styles.statIcon}><Ionicons name={icon} size={20} color={colors.primary} /></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function createStyles(colors: AppThemeColors, width: number) {
  const compact = width < 350;
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: compact ? 12 : 16, paddingTop: 18, paddingBottom: 120 },
    title: { color: colors.text, fontSize: compact ? 22 : 24, lineHeight: 30, fontWeight: '700' },
    subtitle: { marginTop: 3, marginBottom: 17, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '500' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statCard: { width: compact ? '100%' : '48%', minHeight: 104, flexGrow: 1, padding: 13, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    statIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primarySoft },
    statValue: { marginTop: 10, color: colors.text, fontSize: 19, lineHeight: 24, fontWeight: '700' },
    statLabel: { marginTop: 2, color: colors.textMuted, fontSize: 12, lineHeight: 17, fontWeight: '600' },
    section: { marginTop: 18 },
    sectionTitle: { marginBottom: 9, color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: '700' },
    nextCard: { minHeight: 82, padding: 13, flexDirection: 'row', alignItems: 'center', borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    nextIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primarySoft },
    nextText: { flex: 1, minWidth: 0, marginLeft: 12 },
    nextLabel: { color: colors.primary, fontSize: 11, lineHeight: 15, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    nextTitle: { marginTop: 2, color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
    nextMeta: { marginTop: 2, color: colors.textSecondary, fontSize: 12, lineHeight: 17, fontWeight: '600' },
    reminder: { marginTop: 9, minHeight: 54, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 15, backgroundColor: colors.dangerSoft },
    reminderText: { flex: 1, color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: '600' },
    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    action: { width: compact ? '100%' : '48%', minHeight: 58, flexGrow: 1, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    actionText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
    state: { minHeight: 220, padding: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.card },
    stateText: { marginTop: 10, color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
    errorText: { marginTop: 10, color: colors.danger, fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
    retry: { marginTop: 14, minHeight: 44, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary },
    retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
    emptyText: { paddingVertical: 15, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
    pressed: { opacity: 0.7 },
  });
}
