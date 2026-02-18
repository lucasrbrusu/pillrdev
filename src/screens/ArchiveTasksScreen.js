import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, PlatformScrollView } from '../components';
import { useApp } from '../context/AppContext';
import { buildDateWithTime } from '../utils/notifications';
import { borderRadius, spacing, typography } from '../utils/theme';

const TASK_ARCHIVE_WINDOW_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDueMs = (task) => {
  const due = buildDateWithTime(task?.date, task?.time, 23, 59);
  if (due instanceof Date && !Number.isNaN(due.getTime())) return due.getTime();
  const created = new Date(task?.createdAt || 0).getTime();
  return Number.isFinite(created) ? created : 0;
};

const isTaskPastArchiveWindow = (task, nowMs = Date.now()) => {
  const due = buildDateWithTime(task?.date, task?.time, 23, 59);
  if (!(due instanceof Date) || Number.isNaN(due.getTime())) return false;
  return nowMs - due.getTime() >= TASK_ARCHIVE_WINDOW_MS;
};

const buildMonthCells = (monthAnchor) => {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push({ type: 'spacer', key: `s-${i}` });
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ type: 'day', key: `d-${day}`, day, dateKey: toDateKey(date) });
  }
  return cells;
};

const formatSelectedDate = (dateKey) => {
  if (!dateKey) return 'No date selected';
  const date = new Date(dateKey);
  if (Number.isNaN(date.getTime())) return 'No date selected';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTaskTime = (task) => {
  const due = buildDateWithTime(task?.date, task?.time, 23, 59);
  if (!(due instanceof Date) || Number.isNaN(due.getTime())) return 'No time';
  return due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const ArchiveTasksScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { tasks, archivedTasks, themeName, themeColors, ensureTasksLoaded } = useApp();

  const isDark = themeName === 'dark';
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const archiveTheme = useMemo(
    () => ({
      background: isDark ? '#120F1B' : '#F6F2FB',
      calendarBg: isDark ? '#342257' : '#5D3A8D',
      calendarBorder: 'rgba(255,255,255,0.12)',
      calendarTitle: '#EAF2FF',
      calendarMonth: '#EAF2FF',
      calendarWeek: 'rgba(234,242,255,0.7)',
      dotActive: isDark ? '#A855F7' : '#8B5CF6',
      dotIdle: 'rgba(255,255,255,0.1)',
      taskCardBg: isDark ? '#2D2540' : '#FFFFFF',
      taskCardBorder: isDark ? '#4A3D67' : '#E8DDF7',
      taskTitle: isDark ? '#E9D5FF' : '#5B21B6',
      taskMeta: isDark ? '#C4B5FD' : themeColors.textSecondary,
      taskItemBg: isDark ? '#3B3054' : '#F8F1FF',
      taskItemBorder: isDark ? 'rgba(192,132,252,0.35)' : '#E7D7FF',
    }),
    [isDark, themeColors]
  );

  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    ensureTasksLoaded();
  }, [ensureTasksLoaded]);

  const archiveItems = useMemo(() => {
    const nowMs = Date.now();
    const byId = new Map();

    (archivedTasks || []).forEach((task) => {
      if (task?.id) byId.set(task.id, task);
    });

    (tasks || []).forEach((task) => {
      if (!task?.id) return;
      if (isTaskPastArchiveWindow(task, nowMs)) {
        byId.set(task.id, task);
      }
    });

    return Array.from(byId.values()).sort((a, b) => getDueMs(b) - getDueMs(a));
  }, [archivedTasks, tasks]);

  const monthCells = useMemo(() => buildMonthCells(monthAnchor), [monthAnchor]);
  const archivedDateKeys = useMemo(
    () => new Set(archiveItems.map((task) => task?.date).filter(Boolean)),
    [archiveItems]
  );
  const selectedDateTasks = useMemo(
    () =>
      archiveItems
        .filter((task) => task?.date === selectedDateKey)
        .sort((a, b) => getDueMs(a) - getDueMs(b)),
    [archiveItems, selectedDateKey]
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: archiveTheme.background, paddingTop: insets.top + spacing.sm },
      ]}
    >
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.backButton, { borderColor: themeColors.border }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>Task Archive</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              Completed and pending tasks older than 24 hours
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.calendarCard,
            {
              backgroundColor: archiveTheme.calendarBg,
              borderColor: archiveTheme.calendarBorder,
            },
          ]}
        >
          <View style={styles.calendarHeader}>
            <Text style={[styles.calendarTitle, { color: archiveTheme.calendarTitle }]}>
              Monthly Progress
            </Text>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                style={styles.calendarNavBtn}
                onPress={() =>
                  setMonthAnchor(
                    new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthText, { color: archiveTheme.calendarMonth }]}>
                {monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity
                style={styles.calendarNavBtn}
                onPress={() =>
                  setMonthAnchor(
                    new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1)
                  )
                }
              >
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.calendarWeekRow}>
            {WEEK_DAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={[styles.calendarWeekDayText, { color: archiveTheme.calendarWeek }]}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {monthCells.map((cell) => {
              if (cell.type === 'spacer') return <View key={cell.key} style={styles.calendarCell} />;
              const hasTasks = archivedDateKeys.has(cell.dateKey);
              const selected = cell.dateKey === selectedDateKey;
              return (
                <TouchableOpacity
                  key={cell.key}
                  style={styles.calendarCell}
                  onPress={() => setSelectedDateKey(cell.dateKey)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.calendarDot,
                      {
                        backgroundColor: hasTasks ? archiveTheme.dotActive : archiveTheme.dotIdle,
                        borderWidth: selected ? 2 : 0,
                        borderColor: selected ? '#FFFFFF' : 'transparent',
                      },
                    ]}
                  >
                    <Text style={styles.calendarDotText}>{cell.day}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Card
          style={[
            styles.tasksCard,
            {
              backgroundColor: archiveTheme.taskCardBg,
              borderColor: archiveTheme.taskCardBorder,
            },
          ]}
        >
          <Text style={[styles.selectedDateLabel, { color: archiveTheme.taskTitle }]}>
            {formatSelectedDate(selectedDateKey)}
          </Text>

          {selectedDateTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="archive-outline" size={42} color={archiveTheme.taskMeta} />
              <Text style={[styles.emptyTitle, { color: archiveTheme.taskMeta }]}>
                No archived tasks on this date
              </Text>
            </View>
          ) : (
            selectedDateTasks.map((task) => (
              <View
                key={task.id}
                style={[
                  styles.taskItem,
                  {
                    backgroundColor: archiveTheme.taskItemBg,
                    borderColor: archiveTheme.taskItemBorder,
                  },
                ]}
              >
                <View style={styles.taskItemHeader}>
                  <Text style={[styles.taskTitle, { color: themeColors.text }]} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: task.completed
                          ? 'rgba(16,185,129,0.2)'
                          : 'rgba(239,68,68,0.2)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: task.completed ? '#10B981' : '#EF4444' },
                      ]}
                    >
                      {task.completed ? 'Completed' : 'Uncompleted'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.taskMeta, { color: archiveTheme.taskMeta }]}>
                  Due at {formatTaskTime(task)}
                </Text>
                {task.description ? (
                  <Text style={[styles.taskDescription, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </Card>
      </PlatformScrollView>
    </View>
  );
};

const createStyles = (themeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg },
    headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
      backgroundColor: themeColors.card,
    },
    headerTextWrap: { flex: 1 },
    pageTitle: { ...typography.h2, fontWeight: '700' },
    pageSubtitle: { ...typography.bodySmall, marginTop: 2 },
    calendarCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    calendarHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    calendarTitle: { ...typography.body, fontWeight: '700' },
    calendarNav: { flexDirection: 'row', alignItems: 'center' },
    calendarMonthText: {
      ...typography.bodySmall,
      fontWeight: '700',
      marginHorizontal: spacing.sm,
    },
    calendarNavBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.14)',
    },
    calendarWeekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      paddingHorizontal: 2,
    },
    calendarWeekDayText: {
      ...typography.caption,
      width: '14.2%',
      textAlign: 'center',
      fontWeight: '600',
    },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: {
      width: '14.2%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    calendarDot: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    calendarDotText: { ...typography.caption, fontWeight: '700', color: '#F8FAFF' },
    tasksCard: {
      borderWidth: 1,
      borderRadius: borderRadius.xl,
      padding: spacing.md,
      marginBottom: spacing.xl,
    },
    selectedDateLabel: {
      ...typography.body,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
    },
    emptyTitle: {
      ...typography.body,
      marginTop: spacing.sm,
    },
    taskItem: {
      borderWidth: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    taskItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    taskTitle: {
      ...typography.body,
      fontWeight: '700',
      flex: 1,
      marginRight: spacing.sm,
    },
    statusBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: borderRadius.full,
    },
    statusText: {
      ...typography.caption,
      fontWeight: '700',
    },
    taskMeta: {
      ...typography.bodySmall,
      marginBottom: spacing.xs,
    },
    taskDescription: {
      ...typography.bodySmall,
      lineHeight: 18,
    },
  });

export default ArchiveTasksScreen;
