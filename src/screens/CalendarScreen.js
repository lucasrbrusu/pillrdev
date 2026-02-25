import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { Card } from '../components';
import {
  colors,
  shadows,
  borderRadius,
  spacing,
  typography,
} from '../utils/theme';
import {
  DEFAULT_TASK_DURATION_MINUTES,
  formatTaskTimeRangeLabel,
  getTaskOverlapPairs,
} from '../utils/taskScheduling';

const CalendarScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    tasks,
    toggleTaskCompletion,
    themeColors,
    ensureTasksLoaded,
    userSettings,
    importTasksFromDeviceCalendar,
    exportTasksToDeviceCalendar,
    undoImportedCalendarTasks,
  } = useApp();
  const styles = useMemo(() => createStyles(), [themeColors]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [showSettings, setShowSettings] = useState(false);
  const [calendarSyncAction, setCalendarSyncAction] = useState(null);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getWeekDays = () => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const weekDays = getWeekDays();

  useEffect(() => {
    ensureTasksLoaded();
  }, [ensureTasksLoaded]);

  const selectedDateTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.date) return false;
      const dateVal = new Date(task.date);
      if (isNaN(dateVal)) return false;
      return dateVal.toDateString() === selectedDate.toDateString();
    });
  }, [tasks, selectedDate]);

  const selectedDateOverlapPairs = useMemo(
    () =>
      getTaskOverlapPairs(selectedDateTasks, {
        includeCompleted: false,
        fallbackDurationMinutes: DEFAULT_TASK_DURATION_MINUTES,
      }),
    [selectedDateTasks]
  );

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleImportCalendarEvents = async () => {
    if (calendarSyncAction) return;
    if (!userSettings?.calendarSyncEnabled) {
      Alert.alert(
        'Calendar access required',
        'Enable calendar import/export in Settings -> Permissions first.'
      );
      return;
    }
    try {
      setCalendarSyncAction('import');
      const result = await importTasksFromDeviceCalendar();
      Alert.alert(
        'Import complete',
        `Scanned ${result.scanned} events.\nImported ${result.imported} tasks.\nUpdated ${result.updated} tasks.\nSkipped ${result.skipped}.\nOverlaps detected ${result.overlaps || 0}.`
      );
    } catch (err) {
      Alert.alert('Import failed', err?.message || 'Unable to import calendar events.');
    } finally {
      setCalendarSyncAction(null);
    }
  };

  const handleExportTasksToCalendar = async () => {
    if (calendarSyncAction) return;
    if (!userSettings?.calendarSyncEnabled) {
      Alert.alert(
        'Calendar access required',
        'Enable calendar import/export in Settings -> Permissions first.'
      );
      return;
    }
    try {
      setCalendarSyncAction('export');
      const result = await exportTasksToDeviceCalendar();
      Alert.alert(
        'Export complete',
        `Processed ${result.total} tasks.\nCreated ${result.exported} events.\nUpdated ${result.updated} events.\nSkipped ${result.skipped}.`
      );
    } catch (err) {
      Alert.alert('Export failed', err?.message || 'Unable to export tasks to calendar.');
    } finally {
      setCalendarSyncAction(null);
    }
  };

  const runUndoImportedTasks = async () => {
    if (calendarSyncAction) return;
    try {
      setCalendarSyncAction('undo');
      const result = await undoImportedCalendarTasks();
      Alert.alert(
        'Undo import complete',
        `Tracked ${result.tracked} imported tasks.\nRemoved ${result.removed} tasks.\nMissing ${result.missing}.`
      );
    } catch (err) {
      Alert.alert('Undo failed', err?.message || 'Unable to undo imported calendar tasks.');
    } finally {
      setCalendarSyncAction(null);
    }
  };

  const handleUndoImportedTasks = () => {
    if (calendarSyncAction) return;
    Alert.alert(
      'Undo calendar import',
      'This removes all tasks created by calendar import from Tasks and Calendar. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Undo import', style: 'destructive', onPress: runUndoImportedTasks },
      ]
    );
  };

  const hasTasksOnDate = (date) => {
    return tasks.some((task) => {
      if (!task.date) return false;
      const dateVal = new Date(task.date);
      if (isNaN(dateVal)) return false;
      return dateVal.toDateString() === date.toDateString();
    });
  };

  const isToday = (date) => {
    return date.toDateString() === new Date().toDateString();
  };

  const isSelected = (date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const formatTime = (time) => {
    if (!time) return '';
    return time;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return colors.danger;
      case 'medium':
        return colors.warning;
      case 'low':
        return colors.textLight;
      default:
        return colors.textLight;
    }
  };

  const timeSlots = [];
  for (let i = 0; i < 24; i++) {
    timeSlots.push(`${i.toString().padStart(2, '0')}:00`);
  }

  const upcomingDatedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.date && !isNaN(new Date(task.date)))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [tasks]);

  const undatedTasks = useMemo(
    () => tasks.filter((task) => !task.date || isNaN(new Date(task.date))),
    [tasks]
  );

  const formatListDate = (dateStr) => {
    const dateVal = new Date(dateStr);
    if (isNaN(dateVal)) return 'No date';
    return dateVal.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const parseHour = (timeString) => {
    if (!timeString) return null;
    const trimmed = timeString.trim();
    // Handle formats like "08:00", "8:30 PM"
    const match12 = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(trimmed);
    if (match12) {
      let hour = parseInt(match12[1], 10) % 12;
      const minutes = parseInt(match12[2], 10);
      if (match12[3].toLowerCase() === 'pm') hour += 12;
      return { hour, minutes };
    }
    const match24 = /^(\d{1,2}):(\d{2})/.exec(trimmed);
    if (match24) {
      return { hour: parseInt(match24[1], 10), minutes: parseInt(match24[2], 10) };
    }
    return null;
  };

  const handleTaskPress = (task) => {
    navigation.navigate('Tasks', { taskId: task.id });
  };

  const handleToggleTaskCompletion = async (taskId, evt) => {
    evt?.stopPropagation?.();
    await toggleTaskCompletion(taskId);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendar</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setShowSettings((prev) => !prev)}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Month/Year Header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={goToPreviousWeek} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {months[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={goToNextWeek} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {showSettings && (
        <View style={styles.settingsWrap}>
          <Card style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>Calendar Settings</Text>
            <Text style={styles.settingsSubtitle}>
              Import and export your calendar events with tasks.
            </Text>
            <Text style={styles.settingsStatusText}>
              {userSettings?.calendarSyncEnabled
                ? 'Calendar sync is enabled.'
                : 'Enable calendar sync in Settings -> Permissions first.'}
            </Text>

            <TouchableOpacity
              style={[
                styles.settingsActionButton,
                calendarSyncAction && styles.settingsActionDisabled,
              ]}
              onPress={handleImportCalendarEvents}
              disabled={Boolean(calendarSyncAction)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={calendarSyncAction === 'import' ? 'hourglass-outline' : 'download-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.settingsActionText}>
                {calendarSyncAction === 'import' ? 'Importing...' : 'Import Calendar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingsActionButton,
                calendarSyncAction && styles.settingsActionDisabled,
              ]}
              onPress={handleExportTasksToCalendar}
              disabled={Boolean(calendarSyncAction)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={calendarSyncAction === 'export' ? 'hourglass-outline' : 'upload-outline'}
                size={18}
                color={colors.primary}
              />
              <Text style={styles.settingsActionText}>
                {calendarSyncAction === 'export' ? 'Exporting...' : 'Export Calendar'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.settingsActionButton,
                styles.settingsActionDangerButton,
                calendarSyncAction && styles.settingsActionDisabled,
              ]}
              onPress={handleUndoImportedTasks}
              disabled={Boolean(calendarSyncAction)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={calendarSyncAction === 'undo' ? 'hourglass-outline' : 'trash-outline'}
                size={18}
                color={colors.danger}
              />
              <Text style={[styles.settingsActionText, styles.settingsActionDangerText]}>
                {calendarSyncAction === 'undo' ? 'Undoing...' : 'Undo import'}
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}

      {/* Week View */}
      <View style={styles.weekContainer}>
        {weekDays.map((day, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.dayColumn,
              isSelected(day) && styles.dayColumnSelected,
            ]}
            onPress={() => setSelectedDate(day)}
          >
            <Text
              style={[
                styles.dayName,
                isSelected(day) && styles.dayNameSelected,
              ]}
            >
              {daysOfWeek[day.getDay()]}
            </Text>
            <View
              style={[
                styles.dayNumber,
                isToday(day) && styles.dayNumberToday,
                isSelected(day) && styles.dayNumberSelected,
              ]}
            >
              <Text
                style={[
                  styles.dayNumberText,
                  isToday(day) && styles.dayNumberTextToday,
                  isSelected(day) && styles.dayNumberTextSelected,
                ]}
              >
                {day.getDate()}
              </Text>
            </View>
            {hasTasksOnDate(day) && (
              <View style={styles.taskIndicator} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Selected Date Tasks */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.selectedDateTitle}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>

        {selectedDateOverlapPairs.length > 0 && (
          <Card style={styles.overlapWarningCard}>
            <View style={styles.overlapWarningHeader}>
              <Ionicons name="warning-outline" size={16} color={colors.warning} />
              <Text style={styles.overlapWarningTitle}>Overlap warning</Text>
            </View>
            <Text style={styles.overlapWarningText}>
              {selectedDateOverlapPairs.length} overlapping schedule pair
              {selectedDateOverlapPairs.length === 1 ? '' : 's'} on this day.
            </Text>
            {selectedDateOverlapPairs.slice(0, 2).map((pair) => (
              <Text
                key={`${pair.a?.id || 'a'}-${pair.b?.id || 'b'}`}
                style={styles.overlapWarningText}
              >
                {pair.a?.title || 'Task'} overlaps {pair.b?.title || 'Task'}
              </Text>
            ))}
          </Card>
        )}

        {selectedDateTasks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyState}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={colors.primaryLight}
              />
              <Text style={styles.emptyText}>No tasks for this day</Text>
            </View>
          </Card>
        ) : (
          <Card style={styles.tasksCard}>
            {selectedDateTasks.map((task) => (
              <View key={task.id} style={styles.taskItemRow}>
                <TouchableOpacity
                  style={styles.taskItem}
                  onPress={() => handleTaskPress(task)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      task.completed && styles.checkboxChecked,
                    ]}
                  >
                    {task.completed && (
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    )}
                  </View>
                  <View style={styles.taskContent}>
                    <Text
                      style={[
                        styles.taskTitle,
                        task.completed && styles.taskTitleCompleted,
                      ]}
                    >
                      {task.title}
                    </Text>
                    <View style={styles.taskMeta}>
                      {task.time && (
                        <View style={styles.timeTag}>
                          <Ionicons
                            name="time-outline"
                            size={12}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.timeText}>{formatTaskTimeRangeLabel(task)}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.priorityTag,
                          { backgroundColor: `${getPriorityColor(task.priority)}20` },
                        ]}
                      >
                        <Text
                          style={[
                            styles.priorityText,
                            { color: getPriorityColor(task.priority) },
                          ]}
                        >
                          {task.priority}
                        </Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.completeButton,
                    task.completed && styles.completeButtonCompleted,
                  ]}
                  onPress={(evt) => handleToggleTaskCompletion(task.id, evt)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.completeButtonText,
                      task.completed && styles.completeButtonTextCompleted,
                    ]}
                  >
                    {task.completed ? 'Mark as uncomplete' : 'Mark complete'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}

        {/* Time Slots View */}
        <Card style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Day Timeline</Text>
          {timeSlots.map((time) => {
            const slotHour = parseInt(time.split(':')[0], 10);
            const tasksAtTime = selectedDateTasks.filter((task) => {
              const parsed = parseHour(task.time);
              if (!parsed) return false;
              return parsed.hour === slotHour;
            });
            return (
              <View key={time} style={styles.timeSlot}>
                <Text style={styles.timeLabel}>{time}</Text>
                <View style={styles.timeSlotContent}>
                  {tasksAtTime.map((task) => (
                    <View
                      key={task.id}
                      style={[
                        styles.timeSlotTask,
                        { borderLeftColor: getPriorityColor(task.priority) },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => handleTaskPress(task)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.timeSlotTaskTitle} numberOfLines={1}>
                          {task.title}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.completeButton,
                          task.completed && styles.completeButtonCompleted,
                        ]}
                        onPress={(evt) => handleToggleTaskCompletion(task.id, evt)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.completeButtonText,
                            task.completed && styles.completeButtonTextCompleted,
                          ]}
                        >
                          {task.completed ? 'Mark as uncomplete' : 'Mark complete'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </Card>

        {/* Upcoming Tasks */}
        <Card style={styles.tasksCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.timelineTitle}>Upcoming Tasks</Text>
          </View>
          {upcomingDatedTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={32} color={colors.primaryLight} />
              <Text style={styles.emptyText}>No upcoming tasks</Text>
            </View>
          ) : (
            upcomingDatedTasks.map((task) => (
              <View key={task.id} style={styles.listTaskItem}>
                <View style={styles.listTaskInfo}>
                  <Text style={styles.taskTitle} numberOfLines={1}>
                    {task.title}
                  </Text>
                  <Text style={styles.listTaskMeta}>
                    {formatListDate(task.date)}
                    {task.time ? ` | ${formatTaskTimeRangeLabel(task)}` : ''}
                  </Text>
                </View>
                <View
                  style={[
                    styles.priorityTag,
                    { backgroundColor: `${colors.primary}15` },
                  ]}
                >
                  <Text style={[styles.priorityText, { color: colors.primary }]}>
                    {task.priority || '—'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </Card>

        {/* Undated Tasks */}
        {undatedTasks.length > 0 && (
          <Card style={styles.tasksCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.timelineTitle}>Undated</Text>
            </View>
            {undatedTasks.map((task) => (
              <View key={task.id} style={styles.listTaskItem}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {task.title}
                </Text>
                <Text style={styles.listTaskMeta}>No date</Text>
              </View>
            ))}
          </Card>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
  },
  todayButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  todayText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  settingsWrap: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  settingsCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  settingsTitle: {
    ...typography.h3,
    marginBottom: spacing.xs,
    color: colors.text,
  },
  settingsSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  settingsStatusText: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  settingsActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.inputBackground,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  settingsActionDangerButton: {
    borderColor: `${colors.danger}55`,
    backgroundColor: `${colors.danger}10`,
  },
  settingsActionDisabled: {
    opacity: 0.6,
  },
  settingsActionText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  settingsActionDangerText: {
    color: colors.danger,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthTitle: {
    ...typography.h3,
  },
  weekContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  dayColumn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginHorizontal: 2,
    borderRadius: borderRadius.md,
  },
  dayColumnSelected: {
    backgroundColor: colors.primaryLight,
  },
  dayName: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  dayNameSelected: {
    color: colors.primary,
  },
  dayNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumberToday: {
    backgroundColor: colors.text,
  },
  dayNumberSelected: {
    backgroundColor: colors.primary,
  },
  dayNumberText: {
    ...typography.body,
    fontWeight: '600',
  },
  dayNumberTextToday: {
    color: '#FFFFFF',
  },
  dayNumberTextSelected: {
    color: '#FFFFFF',
  },
  taskIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  selectedDateTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  overlapWarningCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.warning}66`,
    backgroundColor: `${colors.warning}12`,
  },
  overlapWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  overlapWarningTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.warning,
    marginLeft: spacing.xs,
  },
  overlapWarningText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  emptyCard: {
    marginBottom: spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  tasksCard: {
    marginBottom: spacing.lg,
  },
  taskItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: spacing.sm,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    ...typography.body,
    marginBottom: spacing.xs,
  },
  taskTitleCompleted: {
    textDecorationLine: 'line-through',
    color: colors.textLight,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timeText: {
    ...typography.caption,
    marginLeft: spacing.xs,
  },
  priorityTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timelineCard: {
    marginBottom: spacing.xxxl,
  },
  timelineTitle: {
    ...typography.h3,
    marginBottom: spacing.md,
  },
  timeSlot: {
    flexDirection: 'row',
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  timeLabel: {
    width: 50,
    ...typography.caption,
    color: colors.textLight,
    paddingTop: spacing.sm,
  },
  timeSlotContent: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  timeSlotTask: {
    backgroundColor: colors.inputBackground,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderLeftWidth: 3,
    marginBottom: spacing.xs,
  },
  timeSlotTaskTitle: {
    ...typography.bodySmall,
  },
  completeButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
    alignSelf: 'flex-start',
  },
  completeButtonCompleted: {
    backgroundColor: `${colors.success}22`,
  },
  completeButtonText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '700',
  },
  completeButtonTextCompleted: {
    color: colors.success,
  },
  listTaskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  listTaskInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  listTaskMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});

export default CalendarScreen;
