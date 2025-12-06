import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

const CalendarScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { tasks, toggleTaskCompletion } = useApp();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'

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

  const selectedDateTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.date) return false;
      const dateVal = new Date(task.date);
      if (isNaN(dateVal)) return false;
      return dateVal.toDateString() === selectedDate.toDateString();
    });
  }, [tasks, selectedDate]);

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
  for (let i = 6; i <= 22; i++) {
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
        <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
          <Text style={styles.todayText}>Today</Text>
        </TouchableOpacity>
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
              <TouchableOpacity
                key={task.id}
                style={styles.taskItem}
                onPress={() => toggleTaskCompletion(task.id)}
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
                        <Text style={styles.timeText}>{task.time}</Text>
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
            ))}
          </Card>
        )}

        {/* Time Slots View */}
        <Card style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Day Timeline</Text>
          {timeSlots.map((time) => {
            const tasksAtTime = selectedDateTasks.filter(
              (task) => task.time && task.time.startsWith(time.split(':')[0])
            );
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
                      <Text style={styles.timeSlotTaskTitle} numberOfLines={1}>
                        {task.title}
                      </Text>
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
                    {task.time ? ` • ${task.time}` : ''}
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

const styles = StyleSheet.create({
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
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
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
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
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
