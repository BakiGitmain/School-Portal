import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AppThemeColors, useAppSettings } from '../../context/AppSettingsContext';
import { supabase } from '../../lib/supabase';
import WeeklyTimetableGrid, { type TimetableGridEntry } from './WeeklyTimetableGrid';
import { buildPeriodSlots, getTimeDisplayLabel, type TimeDisplay, type TimetableBreak } from './time';

type Props = { role: 'teacher' | 'student' };
type Row = Record<string, unknown>;

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

function asRecord(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Row : null;
}

function readBreaks(value: unknown): TimetableBreak[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const row = asRecord(item) ?? {};
    return {
      kind: String(row.kind ?? 'custom') as TimetableBreak['kind'],
      label: String(row.label ?? 'Break'),
      afterPeriod: Number(row.after_period ?? row.afterPeriod),
      durationMinutes: Number(row.duration_minutes ?? row.durationMinutes),
    };
  }).filter(item => Number.isInteger(item.afterPeriod) && Number.isInteger(item.durationMinutes));
}

export default function PublishedScheduleScreen({ role }: Props) {
  const { colors } = useAppSettings();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.bottom), [colors, insets.bottom]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPublishedVersion, setHasPublishedVersion] = useState(false);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [scopeName, setScopeName] = useState('');
  const [activeDays, setActiveDays] = useState<number[]>(DEFAULT_DAYS);
  const [startMinute, setStartMinute] = useState(480);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [periodMinutes, setPeriodMinutes] = useState(45);
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>('12h');
  const [breaks, setBreaks] = useState<TimetableBreak[]>([]);
  const [entries, setEntries] = useState<TimetableGridEntry[]>([]);

  const loadSchedule = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setEmptyReason(null);
      const { data, error: rpcError } = await supabase.rpc('my_published_timetable_v1');
      if (rpcError) throw rpcError;
      const payload = asRecord(data);
      if (!payload) throw new Error('Invalid published schedule response.');
      const version = asRecord(payload.version);
      if (!version) {
        setHasPublishedVersion(false);
        setEntries([]);
        return;
      }

      const snapshot = asRecord(version.config_snapshot) ?? {};
      const nextDays = Array.isArray(snapshot.active_days) ? snapshot.active_days.map(Number).filter(Number.isInteger) : DEFAULT_DAYS;
      setActiveDays(nextDays.length ? nextDays : DEFAULT_DAYS);
      setStartMinute(Number(snapshot.start_minute ?? 480));
      setPeriodsPerDay(Number(snapshot.periods_per_day ?? 7));
      setPeriodMinutes(Number(snapshot.period_minutes ?? 45));
      setTimeDisplay((snapshot.time_display ?? '12h') as TimeDisplay);
      setBreaks(readBreaks(snapshot.breaks));
      setHasPublishedVersion(true);

      const classId = typeof payload.class_id === 'string' ? payload.class_id : null;
      const className = typeof payload.class_name === 'string' ? payload.class_name : '';
      if (role === 'student' && !classId) {
        setScopeName('No class assigned');
        setEmptyReason('Your account is not assigned to a class yet.');
        setEntries([]);
        return;
      }

      const rows = Array.isArray(payload.entries) ? payload.entries.map(asRecord).filter((item): item is Row => Boolean(item)) : [];
      setScopeName(role === 'student' ? className || 'My Class' : 'My Lessons');
      setEntries(rows.map(row => ({
        id: String(row.id ?? ''),
        classId: String(row.class_id ?? ''),
        teacherUserId: String(row.teacher_user_id ?? ''),
        subject: String(row.subject ?? 'Lesson'),
        dayOfWeek: Number(row.day_of_week),
        periodIndex: Number(row.period_index),
        teacherName: String(row.teacher_name ?? 'Teacher'),
        className: String(row.class_name ?? 'Class'),
      })).filter(item => Number.isInteger(item.dayOfWeek) && Number.isInteger(item.periodIndex)));
    } catch (caught) {
      console.log('LOAD PUBLISHED TIMETABLE:', caught);
      setError('The published schedule could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useFocusEffect(useCallback(() => { void loadSchedule(); }, [loadSchedule]));
  const plan = useMemo(() => buildPeriodSlots({ startMinute, periodsPerDay, periodMinutes, breaks }), [startMinute, periodsPerDay, periodMinutes, breaks]);
  const noPublishedText = role === 'teacher' ? 'No published teaching schedule yet.' : 'No published class schedule yet.';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace(`/${role}/more`)} style={styles.headerButton}><Ionicons name="chevron-back" size={23} color={colors.text} /></Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>{role === 'teacher' ? 'Teaching Schedule' : 'Class Schedule'}</Text>
          <Text style={styles.subtitle}>{scopeName || 'Published timetable'}</Text>
        </View>
        <Pressable disabled={loading} onPress={() => void loadSchedule()} style={[styles.headerButton, loading && styles.disabled]}><Ionicons name="refresh" size={20} color={colors.primary} /></Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.message}>Loading schedule…</Text></View>
      ) : error ? (
        <View style={styles.center}><Text style={styles.error}>{error}</Text><Pressable style={styles.retry} onPress={() => void loadSchedule()}><Text style={styles.retryText}>Try Again</Text></Pressable></View>
      ) : !hasPublishedVersion ? (
        <View style={styles.center}><Ionicons name="calendar-outline" size={40} color={colors.textMuted} /><Text style={styles.message}>{noPublishedText}</Text></View>
      ) : emptyReason ? (
        <View style={styles.center}><Ionicons name="school-outline" size={40} color={colors.textMuted} /><Text style={styles.message}>{emptyReason}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.timeMode}>{getTimeDisplayLabel(timeDisplay)}</Text>
          <WeeklyTimetableGrid activeDays={activeDays} slots={plan.slots} breaks={breaks} timeDisplay={timeDisplay} entries={entries} mode={role} />
          {entries.length === 0 ? <Text style={styles.emptyNote}>{noPublishedText}</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: AppThemeColors, bottomInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: { height: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
    headerText: { flex: 1, marginHorizontal: 4 },
    title: { color: colors.text, fontSize: 20, fontWeight: '700' },
    subtitle: { marginTop: 1, color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    content: { padding: 12, paddingBottom: Math.max(92, bottomInset + 68) },
    timeMode: { marginBottom: 9, color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
    center: { flex: 1, padding: 28, alignItems: 'center', justifyContent: 'center' },
    message: { marginTop: 12, color: colors.textSecondary, fontSize: 15, lineHeight: 21, fontWeight: '600', textAlign: 'center' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
    retry: { marginTop: 16, minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary },
    retryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    emptyNote: { marginTop: 12, color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'center' },
    disabled: { opacity: 0.4 },
  });
}
