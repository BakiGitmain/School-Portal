import React, { useMemo } from 'react';

import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  type AppThemeColors,
  useAppSettings,
} from '../../context/AppSettingsContext';

import {
  formatMinute,
  WEEK_DAYS,
  type PeriodSlot,
  type TimeDisplay,
  type TimetableBreak,
} from './time';

export type TimetableGridEntry = {
  id?: string;
  classId: string;
  teacherUserId: string;
  subject: string;
  dayOfWeek: number;
  periodIndex: number;
  teacherName?: string;
  className?: string;
};

type Props = {
  activeDays: number[];
  slots: PeriodSlot[];
  breaks: TimetableBreak[];
  timeDisplay: TimeDisplay;
  entries: TimetableGridEntry[];
  mode: 'admin' | 'teacher' | 'student';
  onCellPress?: (day: number, period: number, entry?: TimetableGridEntry) => void;
};

export default function WeeklyTimetableGrid({
  activeDays,
  slots,
  breaks,
  timeDisplay,
  entries,
  mode,
  onCellPress,
}: Props) {
  const { colors } = useAppSettings();
  const { width } = useWindowDimensions();
  const cellWidth = Math.max(116, Math.min(148, width * 0.35));
  const dayWidth = Math.max(62, Math.min(76, width * 0.19));
  const styles = useMemo(() => createStyles(colors, cellWidth, dayWidth), [colors, cellWidth, dayWidth]);

  const entryMap = useMemo(
    () => new Map(entries.map(item => [`${item.dayOfWeek}:${item.periodIndex}`, item])),
    [entries],
  );

  return (
    <View style={styles.shell}>
      <View style={styles.dayColumn}>
        <View style={styles.corner}><Text style={styles.cornerText}>DAY</Text></View>
        {WEEK_DAYS.map(day => {
          const active = activeDays.includes(day.id);
          return (
            <View key={day.id} style={[styles.dayCell, !active && styles.inactiveCell]}>
              <Text style={[styles.dayText, !active && styles.inactiveText]}>{day.short}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.periods}>
        <View>
          <View style={styles.headerRow}>
            {slots.map(slot => {
              const after = breaks.filter(item => item.afterPeriod === slot.periodIndex);
              return (
                <View key={slot.periodIndex} style={styles.periodHeader}>
                  <Text style={styles.periodTitle}>P{slot.periodIndex}</Text>
                  <Text style={styles.periodTime}>{formatMinute(slot.startMinute, timeDisplay)}</Text>
                  <Text style={styles.periodTime}>{formatMinute(slot.endMinute, timeDisplay)}</Text>
                  {after.length > 0 ? (
                    <Text style={styles.breakText}>{after.map(item => `${item.label} ${item.durationMinutes}m`).join(' · ')}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>

          {WEEK_DAYS.map(day => {
            const active = activeDays.includes(day.id);
            return (
              <View key={day.id} style={styles.row}>
                {slots.map(slot => {
                  const entry = entryMap.get(`${day.id}:${slot.periodIndex}`);
                  const editable = mode === 'admin' && active;
                  const content = entry
                    ? mode === 'teacher'
                      ? [entry.className, entry.subject]
                      : mode === 'student'
                        ? [entry.subject, entry.teacherName]
                        : [entry.subject, entry.teacherName]
                    : [];

                  return (
                    <Pressable
                      key={slot.periodIndex}
                      disabled={!editable}
                      onPress={() => onCellPress?.(day.id, slot.periodIndex, entry)}
                      style={({ pressed }) => [
                        styles.lessonCell,
                        !active && styles.inactiveCell,
                        entry && active && styles.assignedCell,
                        pressed && editable && styles.pressedCell,
                      ]}
                    >
                      {entry ? (
                        <>
                          <Text numberOfLines={2} style={styles.subjectText}>{content[0]}</Text>
                          <Text numberOfLines={2} style={styles.detailText}>{content[1]}</Text>
                        </>
                      ) : (
                        <Text style={[styles.emptyText, !active && styles.inactiveText]}>
                          {editable ? '+' : '—'}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: AppThemeColors, cellWidth: number, dayWidth: number) {
  const headerHeight = 82;
  const rowHeight = 80;
  return StyleSheet.create({
    shell: { flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card },
    dayColumn: { width: dayWidth, zIndex: 2, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.card },
    corner: { height: headerHeight, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    cornerText: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
    dayCell: { height: rowHeight, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
    dayText: { color: colors.text, fontSize: 14, fontWeight: '700' },
    periods: { minWidth: '100%' },
    headerRow: { flexDirection: 'row', height: headerHeight },
    periodHeader: { width: cellWidth, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surfaceSecondary },
    periodTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
    periodTime: { marginTop: 2, color: colors.textSecondary, fontSize: 11, lineHeight: 13, fontWeight: '600', textAlign: 'center' },
    breakText: { marginTop: 2, color: colors.primary, fontSize: 10, fontWeight: '700', textAlign: 'center' },
    row: { flexDirection: 'row', height: rowHeight },
    lessonCell: { width: cellWidth, height: rowHeight, padding: 8, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: colors.border, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.card },
    assignedCell: { backgroundColor: colors.primarySoft },
    pressedCell: { opacity: 0.65 },
    inactiveCell: { backgroundColor: colors.surfaceSecondary },
    inactiveText: { color: colors.textMuted },
    subjectText: { color: colors.text, fontSize: 15, lineHeight: 19, fontWeight: '700', textAlign: 'center' },
    detailText: { marginTop: 4, color: colors.textSecondary, fontSize: 13, lineHeight: 16, fontWeight: '600', textAlign: 'center' },
    emptyText: { color: colors.primary, fontSize: 25, lineHeight: 30, fontWeight: '500' },
  });
}
