import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { type AppThemeColors, useAppSettings } from '../../../context/AppSettingsContext';
import { supabase } from '../../../lib/supabase';
import WeeklyTimetableGrid, { type TimetableGridEntry } from '../../timetable/WeeklyTimetableGrid';
import { buildPeriodSlots, formatMinute, getDayLabel, getTimeDisplayLabel, shiftMinute, WEEK_DAYS, type TimeDisplay, type TimetableBreak } from '../../timetable/time';

type ClassOption = { id: string; name: string };
type TeacherOption = { id: string; name: string };
type Assignment = { teacherUserId: string; classId: string; subjects: string[] };
type ManualEntry = TimetableGridEntry & { startMinute: number; endMinute: number };
type VersionStatus = 'draft' | 'published' | null;
type EditingCell = { day: number; period: number } | null;
type Notice = { text: string; kind: 'success' | 'error' } | null;

const DEFAULT_DAYS = [1, 2, 3, 4, 5];

function cleanSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).map(item => item.trim()).filter(Boolean))];
}

export default function TimetableBuilderScreen() {
  const { colors } = useAppSettings();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => createStyles(colors, width, height, insets.top, insets.bottom),
    [colors, height, insets.bottom, insets.top, width],
  );
  const operationLock = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [activeDays, setActiveDays] = useState<number[]>(DEFAULT_DAYS);
  const [startMinute, setStartMinute] = useState(480);
  const [periodsPerDay, setPeriodsPerDay] = useState(7);
  const [periodMinutes, setPeriodMinutes] = useState(45);
  const [timeDisplay, setTimeDisplay] = useState<TimeDisplay>('12h');
  const [restEnabled, setRestEnabled] = useState(true);
  const [restAfter, setRestAfter] = useState(2);
  const [restDuration, setRestDuration] = useState(15);
  const [lunchEnabled, setLunchEnabled] = useState(true);
  const [lunchAfter, setLunchAfter] = useState(4);
  const [lunchDuration, setLunchDuration] = useState(45);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [loadedVersionId, setLoadedVersionId] = useState<string | null>(null);
  const [loadedVersionStatus, setLoadedVersionStatus] = useState<VersionStatus>(null);
  const [dirty, setDirty] = useState(false);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [editorMessage, setEditorMessage] = useState<string | null>(null);

  const breaks = useMemo<TimetableBreak[]>(() => {
    const value: TimetableBreak[] = [];
    if (restEnabled) value.push({ kind: 'rest', label: 'Rest', afterPeriod: restAfter, durationMinutes: restDuration });
    if (lunchEnabled) value.push({ kind: 'lunch', label: 'Lunch', afterPeriod: lunchAfter, durationMinutes: lunchDuration });
    return value;
  }, [restEnabled, restAfter, restDuration, lunchEnabled, lunchAfter, lunchDuration]);
  const periodPlan = useMemo(() => buildPeriodSlots({ startMinute, periodsPerDay, periodMinutes, breaks }), [startMinute, periodsPerDay, periodMinutes, breaks]);
  const classMap = useMemo(() => new Map(classes.map(item => [item.id, item.name])), [classes]);
  const teacherMap = useMemo(() => new Map(teachers.map(item => [item.id, item.name])), [teachers]);
  const selectedClass = useMemo(() => classes.find(item => item.id === selectedClassId) ?? null, [classes, selectedClassId]);
  const classEntries = useMemo(() => entries.filter(item => item.classId === selectedClassId), [entries, selectedClassId]);
  const classAssignments = useMemo(() => assignments.filter(item => item.classId === selectedClassId), [assignments, selectedClassId]);
  const classSubjects = useMemo(
    () => [...new Set(classAssignments.flatMap(item => item.subjects))].sort((a, b) => a.localeCompare(b)),
    [classAssignments],
  );
  const availableTeachers = useMemo(
    () => selectedSubject
      ? teachers.filter(teacher => classAssignments.some(item => item.teacherUserId === teacher.id && item.subjects.includes(selectedSubject)))
      : [],
    [classAssignments, selectedSubject, teachers],
  );

  function showNotice(text: string, kind: 'success' | 'error' = 'success') { setNotice({ text, kind }); }
  function markChanged() { setDirty(true); setNotice(null); }

  const loadBuilder = useCallback(async () => {
    try {
      setLoading(true);
      setNotice(null);
      const { data: settings, error: settingsError } = await supabase.from('timetable_settings').select('*').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (settingsError) throw settingsError;
      const [classesResult, teachersResult, assignmentsResult] = await Promise.all([
        supabase.from('school_classes').select('id,class_name').order('class_name'),
        supabase.from('profiles').select('user_id,full_name').eq('role', 'teacher').order('full_name'),
        supabase.from('teacher_class_assignments').select('teacher_user_id,class_id,subjects'),
      ]);
      if (classesResult.error) throw classesResult.error;
      if (teachersResult.error) throw teachersResult.error;
      if (assignmentsResult.error) throw assignmentsResult.error;
      const nextClasses = (classesResult.data ?? []).map(row => ({ id: String(row.id), name: String(row.class_name) }));
      const nextTeachers = (teachersResult.data ?? []).map(row => ({ id: String(row.user_id), name: String(row.full_name) }));
      const nextAssignments = (assignmentsResult.data ?? []).map(row => ({ teacherUserId: String(row.teacher_user_id), classId: String(row.class_id), subjects: cleanSubjects(row.subjects) }));
      setClasses(nextClasses);
      setTeachers(nextTeachers);
      setAssignments(nextAssignments);
      setSelectedClassId(current => current && nextClasses.some(item => item.id === current) ? current : nextClasses[0]?.id ?? null);

      let nextSettingsId: string | null = null;
      if (settings) {
        nextSettingsId = String(settings.id);
        setSettingsId(nextSettingsId);
        setActiveDays(Array.isArray(settings.active_days) ? settings.active_days.map(Number) : DEFAULT_DAYS);
        setStartMinute(Number(settings.start_minute));
        setPeriodsPerDay(Number(settings.periods_per_day));
        setPeriodMinutes(Number(settings.period_minutes));
        setTimeDisplay((settings.time_display ?? '12h') as TimeDisplay);
        const { data: breakRows, error: breaksError } = await supabase.from('timetable_breaks').select('*').eq('settings_id', settings.id).order('sort_order');
        if (breaksError) throw breaksError;
        const nextBreaks: TimetableBreak[] = (breakRows ?? []).map(row => ({ kind: row.kind as TimetableBreak['kind'], label: String(row.label), afterPeriod: Number(row.after_period), durationMinutes: Number(row.duration_minutes) }));
        const rest = nextBreaks.find(item => item.kind === 'rest');
        const lunch = nextBreaks.find(item => item.kind === 'lunch');
        setRestEnabled(Boolean(rest));
        if (rest) { setRestAfter(rest.afterPeriod); setRestDuration(rest.durationMinutes); }
        setLunchEnabled(Boolean(lunch));
        if (lunch) { setLunchAfter(lunch.afterPeriod); setLunchDuration(lunch.durationMinutes); }
      }
      if (!nextSettingsId) {
        setEntries([]); setLoadedVersionId(null); setLoadedVersionStatus(null); setDirty(false); return;
      }
      let { data: version, error: versionError } = await supabase.from('timetable_versions').select('id,status').eq('settings_id', nextSettingsId).eq('source_type', 'manual').eq('status', 'draft').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (versionError) throw versionError;
      if (!version) {
        const publishedResult = await supabase.from('timetable_versions').select('id,status').eq('settings_id', nextSettingsId).eq('status', 'published').maybeSingle();
        if (publishedResult.error) throw publishedResult.error;
        version = publishedResult.data;
      }
      if (!version) {
        setEntries([]); setLoadedVersionId(null); setLoadedVersionStatus(null);
      } else {
        const { data: rows, error: entryError } = await supabase.from('timetable_entries').select('id,class_id,teacher_user_id,subject,day_of_week,period_index,start_minute,end_minute').eq('version_id', version.id);
        if (entryError) throw entryError;
        const nextClassMap = new Map(nextClasses.map(item => [item.id, item.name]));
        const nextTeacherMap = new Map(nextTeachers.map(item => [item.id, item.name]));
        setEntries((rows ?? []).map(row => ({ id: String(row.id), classId: String(row.class_id), teacherUserId: String(row.teacher_user_id), subject: String(row.subject), dayOfWeek: Number(row.day_of_week), periodIndex: Number(row.period_index), startMinute: Number(row.start_minute), endMinute: Number(row.end_minute), className: nextClassMap.get(String(row.class_id)) ?? 'Class', teacherName: nextTeacherMap.get(String(row.teacher_user_id)) ?? 'Teacher' })));
        setLoadedVersionId(String(version.id));
        setLoadedVersionStatus(version.status as VersionStatus);
      }
      setDirty(false);
    } catch (caught) {
      console.log('LOAD MANUAL TIMETABLE:', caught);
      showNotice(friendlyError(caught, 'Could not load the timetable. Check your connection and try again.'), 'error');
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadBuilder(); }, [loadBuilder]));

  function setPeriods(next: number) {
    const value = Math.max(1, Math.min(20, next));
    setPeriodsPerDay(value);
    if (value === 1) { setRestEnabled(false); setLunchEnabled(false); }
    else { setRestAfter(current => Math.min(current, value - 1)); setLunchAfter(current => Math.min(current, value - 1)); }
    markChanged();
  }
  function toggleDay(day: number) {
    if (activeDays.includes(day)) {
      if (activeDays.length === 1) { showNotice('At least one school day must remain active.', 'error'); return; }
      setActiveDays(current => current.filter(item => item !== day));
    } else setActiveDays(current => [...current, day].sort((a, b) => a - b));
    markChanged();
  }
  function openCell(day: number, period: number, entry?: TimetableGridEntry) {
    if (saving || publishing || !selectedClassId || !activeDays.includes(day)) return;
    setEditingCell({ day, period }); setEditorMessage(null); setSelectedTeacherId(entry?.teacherUserId ?? null); setSelectedSubject(entry?.subject ?? null);
  }
  function chooseSubject(subject: string) {
    const teacherStillMatches = classAssignments.some(item => item.teacherUserId === selectedTeacherId && item.subjects.includes(subject));
    const matchingTeachers = teachers.filter(teacher => classAssignments.some(item => item.teacherUserId === teacher.id && item.subjects.includes(subject)));
    setSelectedSubject(subject);
    setSelectedTeacherId(teacherStillMatches ? selectedTeacherId : matchingTeachers.length === 1 ? matchingTeachers[0].id : null);
    setEditorMessage(null);
  }
  function chooseTeacher(teacherId: string) {
    setSelectedTeacherId(teacherId); setEditorMessage(null);
  }
  function assignLesson() {
    if (!editingCell || !selectedClassId || !selectedTeacherId || !selectedSubject) { setEditorMessage('Choose a subject and teacher.'); return; }
    const classroom = classes.find(item => item.id === selectedClassId);
    const teacher = teachers.find(item => item.id === selectedTeacherId);
    const assignment = assignments.find(item => item.classId === selectedClassId && item.teacherUserId === selectedTeacherId);
    const slot = periodPlan.slots.find(item => item.periodIndex === editingCell.period);
    if (!classroom || !teacher || !assignment || !assignment.subjects.includes(selectedSubject) || !slot) { setEditorMessage('This teacher, class, subject, or period is no longer available.'); return; }
    const collision = entries.find(item => item.teacherUserId === selectedTeacherId && item.dayOfWeek === editingCell.day && item.periodIndex === editingCell.period && item.classId !== selectedClassId);
    if (collision) { setEditorMessage(`${teacher.name} is already teaching ${classMap.get(collision.classId) ?? 'another class'} during ${getDayLabel(editingCell.day)} Period ${editingCell.period}.`); return; }
    const next: ManualEntry = { classId: selectedClassId, teacherUserId: selectedTeacherId, subject: selectedSubject, dayOfWeek: editingCell.day, periodIndex: editingCell.period, startMinute: slot.startMinute, endMinute: slot.endMinute, className: classroom.name, teacherName: teacher.name };
    setEntries(current => {
      const index = current.findIndex(item => item.classId === selectedClassId && item.dayOfWeek === editingCell.day && item.periodIndex === editingCell.period);
      if (index < 0) return [...current, next];
      const copy = [...current]; copy[index] = { ...next, id: current[index].id }; return copy;
    });
    markChanged(); setEditingCell(null);
  }
  function removeLesson() {
    if (!editingCell || !selectedClassId) return;
    setEntries(current => current.filter(item => !(item.classId === selectedClassId && item.dayOfWeek === editingCell.day && item.periodIndex === editingCell.period)));
    markChanged(); setEditingCell(null);
  }

  function validateSchedule() {
    if (!activeDays.length) throw new Error('Choose at least one active school day.');
    if (periodsPerDay < 1 || periodsPerDay > 20) throw new Error('Periods per day must be between 1 and 20.');
    if (periodMinutes < 10 || periodMinutes > 180) throw new Error('Period duration must be between 10 and 180 minutes.');
    if (restEnabled && (restAfter < 1 || restAfter >= periodsPerDay)) throw new Error('Rest must be after a valid period.');
    if (lunchEnabled && (lunchAfter < 1 || lunchAfter >= periodsPerDay)) throw new Error('Lunch must be after a valid period.');
    if (restEnabled && lunchEnabled && restAfter === lunchAfter) throw new Error('Rest and lunch cannot be after the same period.');
    if (periodPlan.dayEndMinute > 1439) throw new Error('The configured school day reaches or passes midnight. Choose an earlier start or shorter day.');
    const occupiedClasses = new Set<string>();
    const occupiedTeachers = new Set<string>();
    for (const entry of entries) {
      if (!classMap.has(entry.classId)) throw new Error('A scheduled class no longer exists. Remove that lesson before saving.');
      if (!teacherMap.has(entry.teacherUserId)) throw new Error('A scheduled teacher no longer exists. Remove that lesson before saving.');
      const assignment = assignments.find(item => item.classId === entry.classId && item.teacherUserId === entry.teacherUserId);
      if (!assignment || !assignment.subjects.includes(entry.subject)) throw new Error(`${entry.teacherName ?? 'A teacher'} is no longer assigned to teach ${entry.subject} in ${entry.className ?? 'that class'}.`);
      if (!activeDays.includes(entry.dayOfWeek)) throw new Error(`${getDayLabel(entry.dayOfWeek)} is inactive but still has a lesson. Remove it or reactivate the day.`);
      if (entry.periodIndex < 1 || entry.periodIndex > periodsPerDay) throw new Error(`A lesson uses Period ${entry.periodIndex}, which is outside the current settings.`);
      const classKey = `${entry.classId}:${entry.dayOfWeek}:${entry.periodIndex}`;
      const teacherKey = `${entry.teacherUserId}:${entry.dayOfWeek}:${entry.periodIndex}`;
      if (occupiedClasses.has(classKey)) throw new Error(`${entry.className ?? 'A class'} has two lessons in the same period.`);
      if (occupiedTeachers.has(teacherKey)) throw new Error(`${entry.teacherName ?? 'A teacher'} has two lessons in the same period.`);
      occupiedClasses.add(classKey); occupiedTeachers.add(teacherKey);
    }
  }

  async function saveSettings(userId: string): Promise<string> {
    const payload = { active_days: activeDays, start_minute: startMinute, periods_per_day: periodsPerDay, period_minutes: periodMinutes, time_display: timeDisplay, no_assignment_back_to_back: false, max_teacher_consecutive: 10 };
    let nextId = settingsId;
    if (nextId) {
      const { error } = await supabase.from('timetable_settings').update(payload).eq('id', nextId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from('timetable_settings').insert({ ...payload, name: 'Main Schedule', created_by: userId }).select('id').single();
      if (error || !data) throw error ?? new Error('Could not create timetable settings.');
      nextId = String(data.id); setSettingsId(nextId);
    }
    const { error: deleteError } = await supabase.from('timetable_breaks').delete().eq('settings_id', nextId);
    if (deleteError) throw deleteError;
    if (breaks.length) {
      const { error: breakError } = await supabase.from('timetable_breaks').insert(breaks.map((item, index) => ({ settings_id: nextId, kind: item.kind, label: item.label, after_period: item.afterPeriod, duration_minutes: item.durationMinutes, sort_order: index })));
      if (breakError) throw breakError;
    }
    return nextId;
  }
  async function saveSchedule(options: { quiet?: boolean } = {}): Promise<string> {
    validateSchedule();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) throw authError ?? new Error('President account could not be loaded.');
    const nextSettingsId = await saveSettings(authData.user.id);
    const canonicalBreaks = breaks.map(item => ({
      kind: item.kind,
      label: item.label,
      after_period: item.afterPeriod,
      duration_minutes: item.durationMinutes,
    }));
    const { data: version, error: versionError } = await supabase.from('timetable_versions').insert({ settings_id: nextSettingsId, title: 'Manual Schedule', source_type: 'manual', status: 'draft', created_by: authData.user.id, generator_score: null, config_snapshot: { active_days: activeDays, start_minute: startMinute, periods_per_day: periodsPerDay, period_minutes: periodMinutes, time_display: timeDisplay, breaks: canonicalBreaks, no_assignment_back_to_back: false, max_teacher_consecutive: 10 } }).select('id').single();
    if (versionError || !version) throw versionError ?? new Error('Could not create the draft schedule.');
    const versionId = String(version.id);
    const slotMap = new Map(periodPlan.slots.map(slot => [slot.periodIndex, slot]));
    if (entries.length) {
      const { data: savedEntries, error: entryError } = await supabase.from('timetable_entries').insert(entries.map(entry => {
        const slot = slotMap.get(entry.periodIndex);
        if (!slot) throw new Error(`Period ${entry.periodIndex} has no configured time.`);
        return { version_id: versionId, requirement_id: null, teacher_user_id: entry.teacherUserId, class_id: entry.classId, subject: entry.subject, day_of_week: entry.dayOfWeek, period_index: entry.periodIndex, start_minute: slot.startMinute, end_minute: slot.endMinute };
      })).select('id,class_id,teacher_user_id,subject,day_of_week,period_index,start_minute,end_minute');
      if (entryError) {
        await supabase.from('timetable_versions').delete().eq('id', versionId).eq('status', 'draft');
        if (entryError.code === '23505') throw new Error('A class or teacher is already assigned in one of these periods. Review the conflicting cells and try again.');
        throw entryError;
      }
      setEntries((savedEntries ?? []).map(row => ({ id: String(row.id), classId: String(row.class_id), teacherUserId: String(row.teacher_user_id), subject: String(row.subject), dayOfWeek: Number(row.day_of_week), periodIndex: Number(row.period_index), startMinute: Number(row.start_minute), endMinute: Number(row.end_minute), className: classMap.get(String(row.class_id)) ?? 'Class', teacherName: teacherMap.get(String(row.teacher_user_id)) ?? 'Teacher' })));
    }
    setLoadedVersionId(versionId); setLoadedVersionStatus('draft'); setDirty(false);
    if (!options.quiet) showNotice('Draft schedule saved.');
    return versionId;
  }
  async function handleSave() {
    if (operationLock.current) return;
    operationLock.current = true;
    try { setSaving(true); setNotice(null); await saveSchedule(); }
    catch (caught) { console.log('SAVE MANUAL TIMETABLE:', caught); showNotice(friendlyError(caught, 'Could not save the schedule. Please try again.'), 'error'); }
    finally { operationLock.current = false; setSaving(false); }
  }
  async function handlePublish() {
    if (operationLock.current) return;
    operationLock.current = true;
    try {
      setPublishing(true); setNotice(null);
      // Always rebuild a fresh draft so every stored time is derived from the
      // current day/period configuration, including drafts saved by older code.
      const versionId = await saveSchedule({ quiet: true });
      const { error } = await supabase.rpc('publish_manual_timetable', { p_version_id: versionId });
      if (error) throw error;
      setLoadedVersionStatus('published'); setDirty(false); showNotice('Schedule published. Teachers and students can now see it.');
    } catch (caught) { console.log('PUBLISH MANUAL TIMETABLE:', caught); showNotice(friendlyError(caught, 'Could not publish the schedule. Please try again.'), 'error'); }
    finally { operationLock.current = false; setPublishing(false); }
  }

  const existingEditorEntry = editingCell && selectedClassId ? entries.find(item => item.classId === selectedClassId && item.dayOfWeek === editingCell.day && item.periodIndex === editingCell.period) : undefined;
  const editorSlot = editingCell ? periodPlan.slots.find(item => item.periodIndex === editingCell.period) : undefined;

  if (loading) return <SafeAreaView style={styles.screen} edges={['top']}><View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={styles.loadingText}>Loading timetable…</Text></View></SafeAreaView>;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace('/admin/more')} style={styles.iconButton}><Ionicons name="chevron-back" size={23} color={colors.text} /></Pressable>
        <View style={styles.headerText}><Text style={styles.headerTitle}>Timetable</Text><Text style={styles.headerSubtitle}>{loadedVersionStatus === 'published' ? 'Published schedule' : loadedVersionStatus === 'draft' ? 'Draft schedule' : 'New schedule'}{dirty ? ' · Unsaved changes' : ''}</Text></View>
        <Pressable disabled={saving || publishing} onPress={() => void loadBuilder()} style={[styles.iconButton, (saving || publishing) && styles.disabled]}><Ionicons name="refresh" size={20} color={colors.primary} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {notice ? <View style={[styles.notice, notice.kind === 'error' ? styles.errorNotice : styles.successNotice]}><Text style={[styles.noticeText, notice.kind === 'error' && styles.errorText]}>{notice.text}</Text></View> : null}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule Configuration</Text>
          <Text style={styles.label}>Active school days</Text>
          <View style={styles.chips}>{WEEK_DAYS.map(day => <Chip key={day.id} label={day.short} selected={activeDays.includes(day.id)} onPress={() => toggleDay(day.id)} colors={colors} styles={styles} />)}</View>
          <View style={styles.settingGrid}>
            <SettingRow label="Start time" value={formatMinute(startMinute, timeDisplay)} onMinus={() => { setStartMinute(value => shiftMinute(value, -15)); markChanged(); }} onPlus={() => { setStartMinute(value => shiftMinute(value, 15)); markChanged(); }} colors={colors} styles={styles} />
            <SettingRow label="Periods / day" value={String(periodsPerDay)} onMinus={() => setPeriods(periodsPerDay - 1)} onPlus={() => setPeriods(periodsPerDay + 1)} minusDisabled={periodsPerDay <= 1} plusDisabled={periodsPerDay >= 20} colors={colors} styles={styles} />
            <SettingRow label="Period duration" value={`${periodMinutes} min`} onMinus={() => { setPeriodMinutes(value => Math.max(10, value - 5)); markChanged(); }} onPlus={() => { setPeriodMinutes(value => Math.min(180, value + 5)); markChanged(); }} minusDisabled={periodMinutes <= 10} plusDisabled={periodMinutes >= 180} colors={colors} styles={styles} />
          </View>
          <Text style={styles.label}>Time display</Text>
          <View style={styles.chips}>{(['12h', '24h', 'ethiopian'] as TimeDisplay[]).map(value => <Chip key={value} label={value === '12h' ? 'USA / 12-hour' : value === '24h' ? '24-hour' : 'Ethiopian'} selected={timeDisplay === value} onPress={() => { setTimeDisplay(value); markChanged(); }} colors={colors} styles={styles} />)}</View>
          <BreakEditor title="Rest break" enabled={restEnabled} after={restAfter} duration={restDuration} maxAfter={Math.max(1, periodsPerDay - 1)} onToggle={() => { setRestEnabled(value => !value); markChanged(); }} onAfter={value => { setRestAfter(value); markChanged(); }} onDuration={value => { setRestDuration(value); markChanged(); }} colors={colors} styles={styles} />
          <BreakEditor title="Lunch break" enabled={lunchEnabled} after={lunchAfter} duration={lunchDuration} maxAfter={Math.max(1, periodsPerDay - 1)} onToggle={() => { setLunchEnabled(value => !value); markChanged(); }} onAfter={value => { setLunchAfter(value); markChanged(); }} onDuration={value => { setLunchDuration(value); markChanged(); }} colors={colors} styles={styles} />
          <Text style={styles.dayEnd}>School day ends at {formatMinute(periodPlan.dayEndMinute, timeDisplay)} · {getTimeDisplayLabel(timeDisplay)}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Classes</Text>
          {classes.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classRow}>{classes.map(item => <Chip key={item.id} label={item.name} selected={selectedClassId === item.id} onPress={() => setSelectedClassId(item.id)} colors={colors} styles={styles} />)}</ScrollView> : <Text style={styles.emptyText}>Create a class before building the timetable.</Text>}
        </View>
        {selectedClass ? <View style={styles.gridSection}>
          <View style={styles.gridHeading}><View><Text style={styles.sectionTitle}>{selectedClass.name}</Text><Text style={styles.gridHint}>Tap any active cell to assign or edit a lesson.</Text></View><Text style={styles.lessonCount}>{classEntries.length} lessons</Text></View>
          <WeeklyTimetableGrid activeDays={activeDays} slots={periodPlan.slots} breaks={breaks} timeDisplay={timeDisplay} entries={classEntries} mode="admin" onCellPress={openCell} />
        </View> : null}
        <View style={styles.actions}>
          <Pressable disabled={saving || publishing} onPress={() => void handleSave()} style={({ pressed }) => [styles.secondaryButton, (saving || publishing) && styles.disabled, pressed && styles.pressed]}>{saving ? <ActivityIndicator size="small" color={colors.primary} /> : null}<Text style={styles.secondaryButtonText}>{saving ? 'Saving…' : 'Save Schedule'}</Text></Pressable>
          <Pressable disabled={saving || publishing || (loadedVersionStatus === 'published' && !dirty)} onPress={() => void handlePublish()} style={({ pressed }) => [styles.primaryButton, (saving || publishing || (loadedVersionStatus === 'published' && !dirty)) && styles.disabled, pressed && styles.pressed]}>{publishing ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}<Text style={styles.primaryButtonText}>{publishing ? 'Publishing…' : 'Publish Schedule'}</Text></Pressable>
        </View>
      </ScrollView>
      <Modal visible={Boolean(editingCell)} transparent animationType="slide" onRequestClose={() => setEditingCell(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditingCell(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}><View style={styles.modalHeaderText}><Text style={styles.modalTitle}>{existingEditorEntry ? 'Edit Lesson' : 'Assign Lesson'}</Text><Text style={styles.modalMeta}>{editingCell ? `${getDayLabel(editingCell.day)} · Period ${editingCell.period}` : ''}</Text>{editorSlot ? <Text style={styles.modalMeta}>{formatMinute(editorSlot.startMinute, timeDisplay)} – {formatMinute(editorSlot.endMinute, timeDisplay)}</Text> : null}<Text style={styles.modalClass}>{selectedClass?.name}</Text></View><Pressable onPress={() => setEditingCell(null)} style={styles.iconButton}><Ionicons name="close" size={23} color={colors.text} /></Pressable></View>
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Choose Subject</Text>
              {classSubjects.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionChips}>{classSubjects.map(subject => <Chip key={subject} label={subject} selected={selectedSubject === subject} onPress={() => chooseSubject(subject)} colors={colors} styles={styles} />)}</ScrollView> : <Text style={styles.emptyText}>No subjects are assigned to this class yet.</Text>}
              {selectedSubject ? <><Text style={styles.label}>Choose Teacher</Text>{availableTeachers.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionChips}>{availableTeachers.map(item => <Chip key={item.id} label={item.name} selected={selectedTeacherId === item.id} onPress={() => chooseTeacher(item.id)} colors={colors} styles={styles} />)}</ScrollView> : <Text style={styles.emptyText}>No teacher is assigned to {selectedSubject} for this class.</Text>}</> : null}
              {editorMessage ? <Text style={styles.editorError}>{editorMessage}</Text> : null}
              <Pressable disabled={!selectedTeacherId || !selectedSubject} onPress={assignLesson} style={({ pressed }) => [styles.primaryButton, (!selectedTeacherId || !selectedSubject) && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{existingEditorEntry ? 'Save Changes' : 'Assign'}</Text></Pressable>
              {existingEditorEntry ? <Pressable onPress={removeLesson} style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}><Ionicons name="trash-outline" size={18} color={colors.danger} /><Text style={styles.removeText}>Remove Lesson</Text></Pressable> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress, colors, styles }: { label: string; selected: boolean; onPress: () => void; colors: AppThemeColors; styles: ReturnType<typeof createStyles> }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, selected && { backgroundColor: colors.primary, borderColor: colors.primary }, pressed && styles.pressed]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}
function SettingRow({ label, value, onMinus, onPlus, minusDisabled, plusDisabled, colors, styles }: { label: string; value: string; onMinus: () => void; onPlus: () => void; minusDisabled?: boolean; plusDisabled?: boolean; colors: AppThemeColors; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.settingRow}><Text style={styles.settingLabel}>{label}</Text><View style={styles.stepper}><Pressable disabled={minusDisabled} onPress={onMinus} style={[styles.stepButton, minusDisabled && styles.disabled]}><Ionicons name="remove" size={18} color={colors.primary} /></Pressable><Text style={styles.stepValue}>{value}</Text><Pressable disabled={plusDisabled} onPress={onPlus} style={[styles.stepButton, plusDisabled && styles.disabled]}><Ionicons name="add" size={18} color={colors.primary} /></Pressable></View></View>;
}
function BreakEditor({ title, enabled, after, duration, maxAfter, onToggle, onAfter, onDuration, colors, styles }: { title: string; enabled: boolean; after: number; duration: number; maxAfter: number; onToggle: () => void; onAfter: (value: number) => void; onDuration: (value: number) => void; colors: AppThemeColors; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.breakBox}><View style={styles.breakHeader}><Text style={styles.settingLabel}>{title}</Text><Pressable onPress={onToggle} style={[styles.toggle, enabled && { backgroundColor: colors.primary }]}><View style={[styles.toggleKnob, enabled && styles.toggleKnobOn]} /></Pressable></View>{enabled ? <View style={styles.settingGrid}><SettingRow label="After period" value={String(after)} onMinus={() => onAfter(Math.max(1, after - 1))} onPlus={() => onAfter(Math.min(maxAfter, after + 1))} minusDisabled={after <= 1} plusDisabled={after >= maxAfter} colors={colors} styles={styles} /><SettingRow label="Duration" value={`${duration} min`} onMinus={() => onDuration(Math.max(1, duration - 5))} onPlus={() => onDuration(Math.min(180, duration + 5))} minusDisabled={duration <= 1} plusDisabled={duration >= 180} colors={colors} styles={styles} /></View> : null}</View>;
}

function friendlyError(error: unknown, fallback: string) {
  const value = error as { code?: unknown; message?: unknown };
  const message = typeof value?.message === 'string' ? value.message : '';
  if (value?.code === '23505') return 'A class or teacher is already assigned during one of these periods.';
  if (value?.code === '42501') return 'Your account cannot make this timetable change.';
  if (message.includes('Lesson times do not match')) return 'Schedule times changed. The draft was refreshed. Please try publishing again.';
  if (error instanceof Error && !value?.code) return error.message;
  return fallback;
}

function createStyles(colors: AppThemeColors, width: number, height: number, topInset: number, bottomInset: number) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background }, header: { height: 62, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card }, iconButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, headerText: { flex: 1, marginHorizontal: 4 }, headerTitle: { color: colors.text, fontSize: 20, fontWeight: '700' }, headerSubtitle: { marginTop: 1, color: colors.textMuted, fontSize: 12, fontWeight: '600' }, content: { padding: width < 390 ? 10 : 14, paddingBottom: Math.max(96, bottomInset + 76), gap: 11 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loadingText: { marginTop: 10, color: colors.textSecondary, fontSize: 14, fontWeight: '600' }, notice: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 }, successNotice: { backgroundColor: colors.successSoft }, errorNotice: { backgroundColor: colors.dangerSoft }, noticeText: { color: colors.success, fontSize: 13, lineHeight: 18, fontWeight: '700' }, errorText: { color: colors.danger }, section: { padding: width < 360 ? 11 : 13, borderRadius: 17, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card }, gridSection: { gap: 9 }, sectionTitle: { color: colors.text, fontSize: 18, lineHeight: 23, fontWeight: '700' }, label: { marginTop: 12, marginBottom: 7, color: colors.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, optionChips: { gap: 8, paddingRight: 14 }, chip: { minHeight: 42, maxWidth: 220, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }, chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' }, chipTextSelected: { color: '#FFFFFF' }, settingGrid: { marginTop: 9, gap: 7 }, settingRow: { minHeight: 48, paddingLeft: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 13, backgroundColor: colors.surfaceSecondary }, settingLabel: { color: colors.text, fontSize: 14, fontWeight: '700' }, stepper: { flexDirection: 'row', alignItems: 'center' }, stepButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primarySoft }, stepValue: { minWidth: width < 350 ? 68 : 78, paddingHorizontal: 5, color: colors.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }, breakBox: { marginTop: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.border }, breakHeader: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toggle: { width: 48, height: 28, padding: 3, justifyContent: 'center', borderRadius: 16, backgroundColor: colors.textMuted }, toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }, toggleKnobOn: { alignSelf: 'flex-end' }, dayEnd: { marginTop: 10, color: colors.textSecondary, fontSize: 12, fontWeight: '600' }, classRow: { paddingTop: 10, gap: 7 }, emptyText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: '600' }, gridHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }, gridHint: { marginTop: 2, color: colors.textMuted, fontSize: 12, fontWeight: '600' }, lessonCount: { color: colors.primary, fontSize: 12, fontWeight: '700' }, actions: { flexDirection: width < 370 ? 'column' : 'row', gap: 9 }, primaryButton: { minHeight: 50, flex: 1, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.primary }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' }, secondaryButton: { minHeight: 50, flex: 1, paddingHorizontal: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.card }, secondaryButtonText: { color: colors.primary, fontSize: 15, fontWeight: '700' }, disabled: { opacity: 0.38 }, pressed: { opacity: 0.7 }, modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }, modalSheet: { maxHeight: Math.max(320, height - topInset - 16), paddingTop: 8, paddingBottom: Math.max(bottomInset, 8), borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.card }, modalHandle: { width: 40, height: 5, alignSelf: 'center', borderRadius: 3, backgroundColor: colors.border }, modalHeader: { paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border }, modalHeaderText: { flex: 1, minWidth: 0, paddingRight: 8 }, modalTitle: { color: colors.text, fontSize: 20, fontWeight: '700' }, modalMeta: { marginTop: 3, color: colors.textSecondary, fontSize: 13, lineHeight: 17, fontWeight: '600' }, modalClass: { marginTop: 5, color: colors.text, fontSize: 15, lineHeight: 19, fontWeight: '700' }, modalScroll: { flexGrow: 0 }, modalContent: { padding: 16, paddingBottom: 24 }, editorError: { marginVertical: 12, padding: 11, borderRadius: 12, color: colors.danger, backgroundColor: colors.dangerSoft, fontSize: 13, lineHeight: 18, fontWeight: '700' }, removeButton: { minHeight: 48, marginTop: 10, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: colors.dangerSoft }, removeText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  });
}
