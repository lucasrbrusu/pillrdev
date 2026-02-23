import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../utils/theme';
import { useNavigation } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import { buildDateWithTime, formatFriendlyDateTime } from '../utils/notifications';
import {
  ROUTINE_REPEAT,
  getRoutineScheduleLabel,
  normalizeRoutineDays,
  normalizeRoutineSchedule,
} from '../utils/routineSchedule';

const formatTimeAgo = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

const groupNotifications = (items) => {
  const now = new Date();
  const isSameDay = (d1, d2) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const buckets = {
    today: [],
    earlierToday: [],
    yesterday: [],
    lastWeek: [],
    older: [],
  };

  items.forEach((item) => {
    const date = item.timestamp ? new Date(item.timestamp) : null;
    if (!date || Number.isNaN(date.getTime())) return;

    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= 14) {
      buckets.older.push(item);
    } else if (diffDays >= 7) {
      buckets.lastWeek.push(item);
    } else if (!isSameDay(now, date) && diffHours >= 6) {
      // crossed midnight and older than 6h
      buckets.yesterday.push(item);
    } else if (isSameDay(now, date) && diffHours >= 6) {
      buckets.earlierToday.push(item);
    } else {
      buckets.today.push(item);
    }
  });

  const ordered = [];
  if (buckets.today.length) ordered.push({ label: 'Today', data: buckets.today });
  if (buckets.earlierToday.length) ordered.push({ label: 'Earlier Today', data: buckets.earlierToday });
  if (buckets.yesterday.length) ordered.push({ label: 'Yesterday', data: buckets.yesterday });
  if (buckets.lastWeek.length) ordered.push({ label: 'Last Week', data: buckets.lastWeek });
  if (buckets.older.length) ordered.push({ label: 'Older Notifications', data: buckets.older });
  return ordered;
};

const DAY_INDEX_TO_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_INDEX_BY_LABEL = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const DEFAULT_EVENT_TIME = { hour: 9, minute: 0 };

const toStartOfDay = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toUtcDayNumber = (value) => {
  const date = toStartOfDay(value);
  if (!date) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
};

const parseDateOnly = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]) - 1;
      const day = Number(isoMatch[3]);
      const parsed = new Date(year, month, day);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return toStartOfDay(parsed);
};

const normalizeWeekdayToken = (value) => {
  const token = String(value || '')
    .trim()
    .slice(0, 3)
    .toLowerCase();
  const map = {
    sun: 'Sun',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
  };
  return map[token] || null;
};

const extractWeekdaySet = (values = []) => {
  const set = new Set();
  (values || []).forEach((value) => {
    const weekday = normalizeWeekdayToken(value);
    if (weekday) set.add(weekday);
  });
  return set;
};

const extractMonthDaySet = (habit = {}) => {
  const values = [
    ...(Array.isArray(habit?.monthDays) ? habit.monthDays : []),
    ...(Array.isArray(habit?.days) ? habit.days : []),
  ];
  const set = new Set();
  values.forEach((value) => {
    const day = Math.trunc(Number(value));
    if (Number.isFinite(day) && day >= 1 && day <= 31) set.add(day);
  });
  return set;
};

const isHabitScheduledForDate = (habit, dateValue = new Date()) => {
  if (!habit) return false;
  const targetDate = toStartOfDay(dateValue);
  if (!targetDate) return false;
  const targetDayNumber = toUtcDayNumber(targetDate);
  if (!Number.isFinite(targetDayNumber)) return false;

  const startDate = parseDateOnly(habit.startDate) || parseDateOnly(habit.createdAt);
  const endDate = parseDateOnly(habit.endDate);
  const startDayNumber = toUtcDayNumber(startDate);
  const endDayNumber = toUtcDayNumber(endDate);
  if (Number.isFinite(startDayNumber) && targetDayNumber < startDayNumber) return false;
  if (Number.isFinite(endDayNumber) && targetDayNumber > endDayNumber) return false;

  const taskDaysMode = habit.taskDaysMode || 'every_day';
  if (taskDaysMode === 'specific_weekdays') {
    const weekdaySet = extractWeekdaySet(habit.days || []);
    if (!weekdaySet.size) return true;
    return weekdaySet.has(DAY_INDEX_TO_LABEL[targetDate.getDay()]);
  }
  if (taskDaysMode === 'specific_month_days') {
    const monthDaySet = extractMonthDaySet(habit);
    if (!monthDaySet.size) return true;
    return monthDaySet.has(targetDate.getDate());
  }

  const repeat = String(habit.repeat || '').toLowerCase();
  if (repeat === 'weekly') {
    const weekdaySet = extractWeekdaySet(habit.days || []);
    if (weekdaySet.size) return weekdaySet.has(DAY_INDEX_TO_LABEL[targetDate.getDay()]);
    if (startDate) return startDate.getDay() === targetDate.getDay();
  }
  if (repeat === 'monthly') {
    const monthDaySet = extractMonthDaySet(habit);
    if (monthDaySet.size) return monthDaySet.has(targetDate.getDate());
    if (startDate) return startDate.getDate() === targetDate.getDate();
  }

  return true;
};

const parseClockMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const suffix = (match[3] || '').toUpperCase();
  const hasSuffix = suffix === 'AM' || suffix === 'PM';

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (minute < 0 || minute > 59) return null;

  if (hasSuffix) {
    if (hour < 1 || hour > 12) return null;
    if (suffix === 'PM' && hour < 12) hour += 12;
    if (suffix === 'AM' && hour === 12) hour = 0;
  } else if (hour < 0 || hour > 23) {
    return null;
  }

  return hour * 60 + minute;
};

const getNextDailyOccurrence = (hour, minute, now = new Date()) => {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

const getNextWeeklyOccurrence = (weekday, hour, minute, now = new Date()) => {
  const currentWeekday = now.getDay();
  let daysAhead = weekday - currentWeekday;
  if (daysAhead < 0) daysAhead += 7;
  const next = new Date(now);
  next.setDate(next.getDate() + daysAhead);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
};

const getNextMonthlyOccurrence = (day, hour, minute, now = new Date()) => {
  const normalizedDay = Math.min(31, Math.max(1, Number(day) || 1));
  const next = new Date(now);
  next.setDate(1);
  next.setHours(hour, minute, 0, 0);

  const currentMonthDays = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(normalizedDay, currentMonthDays));

  if (next.getTime() <= now.getTime()) {
    next.setMonth(next.getMonth() + 1);
    const nextMonthDays = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(normalizedDay, nextMonthDays));
  }

  return next;
};

const getRoutineNextOccurrence = (routine, now = new Date()) => {
  if (!routine) return null;
  const startValue =
    routine?.startTime ||
    routine?.start_time ||
    (Array.isArray(routine?.scheduledTimes) ? routine.scheduledTimes[0] : null) ||
    (Array.isArray(routine?.scheduled_times) ? routine.scheduled_times[0] : null);
  const startMinutes = parseClockMinutes(startValue);
  if (!Number.isFinite(startMinutes)) return null;

  const hour = Math.floor(startMinutes / 60);
  const minute = startMinutes % 60;
  const schedule = normalizeRoutineSchedule(routine);

  if (schedule.repeat === ROUTINE_REPEAT.WEEKLY) {
    const weekdayLabels = normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.WEEKLY);
    const weekdayIndexes = weekdayLabels
      .map((label) => WEEKDAY_INDEX_BY_LABEL[label])
      .filter((value) => Number.isInteger(value));
    if (!weekdayIndexes.length) return getNextDailyOccurrence(hour, minute, now);
    const nextDates = weekdayIndexes.map((weekday) =>
      getNextWeeklyOccurrence(weekday, hour, minute, now)
    );
    nextDates.sort((a, b) => a.getTime() - b.getTime());
    return nextDates[0] || null;
  }

  if (schedule.repeat === ROUTINE_REPEAT.MONTHLY) {
    const monthDays = normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.MONTHLY)
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
    if (!monthDays.length) return getNextDailyOccurrence(hour, minute, now);
    const nextDates = monthDays.map((day) =>
      getNextMonthlyOccurrence(day, hour, minute, now)
    );
    nextDates.sort((a, b) => a.getTime() - b.getTime());
    return nextDates[0] || null;
  }

  return getNextDailyOccurrence(hour, minute, now);
};

const isRoutineScheduledForDate = (routine, dateValue = new Date()) => {
  const targetDate = toStartOfDay(dateValue);
  if (!targetDate) return false;
  const schedule = normalizeRoutineSchedule(routine);

  if (schedule.repeat === ROUTINE_REPEAT.WEEKLY) {
    const weekdayLabels = normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.WEEKLY);
    if (!weekdayLabels.length) return true;
    return weekdayLabels.includes(DAY_INDEX_TO_LABEL[targetDate.getDay()]);
  }

  if (schedule.repeat === ROUTINE_REPEAT.MONTHLY) {
    const monthDays = normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.MONTHLY)
      .map((day) => Number(day))
      .filter((day) => Number.isInteger(day) && day >= 1 && day <= 31);
    if (!monthDays.length) return true;
    return monthDays.includes(targetDate.getDate());
  }

  return true;
};

const buildRoutineWindowForDate = (routine, dateValue = new Date()) => {
  const dayStart = toStartOfDay(dateValue);
  if (!dayStart) return null;
  if (!isRoutineScheduledForDate(routine, dayStart)) return null;

  const startValue =
    routine?.startTime ||
    routine?.start_time ||
    (Array.isArray(routine?.scheduledTimes) ? routine.scheduledTimes[0] : null) ||
    (Array.isArray(routine?.scheduled_times) ? routine.scheduled_times[0] : null);
  const endValue =
    routine?.endTime ||
    routine?.end_time ||
    (Array.isArray(routine?.scheduledTimes) ? routine.scheduledTimes[1] : null) ||
    (Array.isArray(routine?.scheduled_times) ? routine.scheduled_times[1] : null);

  const startMinutes = parseClockMinutes(startValue);
  const endMinutes = parseClockMinutes(endValue);
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) return null;

  const startAt = new Date(dayStart);
  startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  const endAt = new Date(dayStart);
  endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  const spansOvernight = endMinutes <= startMinutes;
  if (spansOvernight) {
    endAt.setDate(endAt.getDate() + 1);
  }

  return {
    startAt,
    endAt,
    spansOvernight,
    activeDateKey: startAt.toISOString().slice(0, 10),
  };
};

const getRoutineActivityStatus = (routine, nowValue = new Date()) => {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
  if (Number.isNaN(now.getTime())) {
    return {
      isActive: false,
      activeDateKey: null,
      windowStart: null,
      windowEnd: null,
    };
  }

  const todayWindow = buildRoutineWindowForDate(routine, now);
  if (todayWindow && now.getTime() >= todayWindow.startAt.getTime() && now.getTime() <= todayWindow.endAt.getTime()) {
    return {
      isActive: true,
      activeDateKey: todayWindow.activeDateKey,
      windowStart: todayWindow.startAt,
      windowEnd: todayWindow.endAt,
    };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayWindow = buildRoutineWindowForDate(routine, yesterday);
  if (
    yesterdayWindow &&
    yesterdayWindow.spansOvernight &&
    now.getTime() >= yesterdayWindow.startAt.getTime() &&
    now.getTime() <= yesterdayWindow.endAt.getTime()
  ) {
    return {
      isActive: true,
      activeDateKey: yesterdayWindow.activeDateKey,
      windowStart: yesterdayWindow.startAt,
      windowEnd: yesterdayWindow.endAt,
    };
  }

  return {
    isActive: false,
    activeDateKey: null,
    windowStart: null,
    windowEnd: null,
  };
};

const groupUpcomingNotifications = (items = []) => {
  const now = new Date();
  const today = toStartOfDay(now);
  const buckets = {
    today: [],
    tomorrow: [],
    thisWeek: [],
    later: [],
  };

  const sorted = [...(items || [])]
    .filter((item) => Number.isFinite(item?.sortTimeMs))
    .sort((a, b) => a.sortTimeMs - b.sortTimeMs);

  sorted.forEach((item) => {
    const date = item?.timestamp ? new Date(item.timestamp) : null;
    const dateStart = toStartOfDay(date);
    if (!dateStart || !today) return;
    const diffDays = Math.floor((dateStart.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

    if (diffDays <= 0) buckets.today.push(item);
    else if (diffDays === 1) buckets.tomorrow.push(item);
    else if (diffDays <= 7) buckets.thisWeek.push(item);
    else buckets.later.push(item);
  });

  const ordered = [];
  if (buckets.today.length) ordered.push({ label: 'Today', data: buckets.today });
  if (buckets.tomorrow.length) ordered.push({ label: 'Tomorrow', data: buckets.tomorrow });
  if (buckets.thisWeek.length) ordered.push({ label: 'This Week', data: buckets.thisWeek });
  if (buckets.later.length) ordered.push({ label: 'Later', data: buckets.later });
  return ordered;
};

const CLEAR_NOTIFICATIONS_KEY = '@pillaflow_notification_center_cleared_at';

const isAfterClearCutoff = (timestamp, cutoff) => {
  if (!cutoff) return true;
  if (!timestamp) return true;
  const ms = new Date(timestamp).getTime();
  if (Number.isNaN(ms)) return true;
  return ms > cutoff;
};

const NotificationCenterScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    themeColors,
    tasks,
    routines,
    groupRoutines,
    reminders,
    habits,
    isHabitCompletedToday,
    getRoutineCompletionForDate,
    friendRequests,
    taskInvites,
    groupInvites,
    respondToFriendRequest,
    respondToTaskInvite,
    respondToGroupInvite,
    ensureTasksLoaded,
    ensureRoutinesLoaded,
    ensureRemindersLoaded,
    ensureHabitsLoaded,
    ensureGroupDataLoaded,
    ensureFriendDataLoaded,
    ensureTaskInvitesLoaded,
    ensureGroupInvitesLoaded,
    authUser,
  } = useApp();
  const [respondingMap, setRespondingMap] = React.useState({});
  const [respondingTaskMap, setRespondingTaskMap] = React.useState({});
  const [respondingGroupMap, setRespondingGroupMap] = React.useState({});
  const [clearCutoff, setClearCutoff] = React.useState(null);
  const pendingRequests = friendRequests?.incoming || [];
  const responseNotifications = friendRequests?.responses || [];
  const pendingTaskInvites = taskInvites?.incoming || [];
  const taskInviteResponses = taskInvites?.responses || [];
  const pendingGroupInvites = groupInvites?.incoming || [];
  const groupInviteResponses = groupInvites?.responses || [];

  const storageKey = React.useMemo(
    () =>
      authUser?.id
        ? `${CLEAR_NOTIFICATIONS_KEY}_${authUser.id}`
        : CLEAR_NOTIFICATIONS_KEY,
    [authUser?.id]
  );

  React.useEffect(() => {
    let isMounted = true;
    const loadClearCutoff = async () => {
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        if (!isMounted) return;
        if (!stored) {
          setClearCutoff(null);
          return;
        }
        const parsed = Number(stored);
        setClearCutoff(Number.isFinite(parsed) ? parsed : null);
      } catch (err) {
        if (isMounted) setClearCutoff(null);
      }
    };

    loadClearCutoff();
    return () => {
      isMounted = false;
    };
  }, [storageKey]);

  React.useEffect(() => {
    ensureTasksLoaded();
    ensureRoutinesLoaded();
    ensureRemindersLoaded();
    ensureHabitsLoaded();
    ensureGroupDataLoaded();
    ensureFriendDataLoaded();
    ensureTaskInvitesLoaded();
    ensureGroupInvitesLoaded();
  }, [
    ensureFriendDataLoaded,
    ensureGroupDataLoaded,
    ensureGroupInvitesLoaded,
    ensureHabitsLoaded,
    ensureRemindersLoaded,
    ensureRoutinesLoaded,
    ensureTaskInvitesLoaded,
    ensureTasksLoaded,
  ]);

  const handleRespond = async (requestId, status) => {
    setRespondingMap((prev) => ({ ...prev, [requestId]: status }));
    try {
      await respondToFriendRequest(requestId, status);
    } catch (err) {
      Alert.alert('Unable to update request', err?.message || 'Please try again.');
    } finally {
      setRespondingMap((prev) => ({ ...prev, [requestId]: null }));
    }
  };

  const handleRespondTaskInvite = async (inviteId, status) => {
    setRespondingTaskMap((prev) => ({ ...prev, [inviteId]: status }));
    try {
      await respondToTaskInvite(inviteId, status);
    } catch (err) {
      Alert.alert('Unable to update invite', err?.message || 'Please try again.');
    } finally {
      setRespondingTaskMap((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const themedStyles = React.useMemo(() => createStyles(themeColors || colors), [themeColors]);
  const routineColor = themeColors?.routine || colors.routine || colors.warning;
  const reminderColor = themeColors?.health || colors.info;
  const habitColor = themeColors?.habits || colors.habits;

  const handleRespondGroup = async (inviteId, status) => {
    setRespondingGroupMap((prev) => ({ ...prev, [inviteId]: status }));
    try {
      await respondToGroupInvite(inviteId, status);
    } catch (err) {
      Alert.alert('Unable to update group invite', err?.message || 'Please try again.');
    } finally {
      setRespondingGroupMap((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const filteredPendingRequests = React.useMemo(
    () => pendingRequests.filter((item) => isAfterClearCutoff(item?.created_at, clearCutoff)),
    [pendingRequests, clearCutoff]
  );
  const filteredResponseNotifications = React.useMemo(
    () =>
      responseNotifications.filter((item) =>
        isAfterClearCutoff(item?.responded_at || item?.updated_at || item?.created_at, clearCutoff)
      ),
    [responseNotifications, clearCutoff]
  );
  const filteredPendingTaskInvites = React.useMemo(
    () => pendingTaskInvites.filter((item) => isAfterClearCutoff(item?.created_at, clearCutoff)),
    [pendingTaskInvites, clearCutoff]
  );
  const filteredTaskInviteResponses = React.useMemo(
    () =>
      taskInviteResponses.filter((item) =>
        isAfterClearCutoff(item?.responded_at || item?.updated_at || item?.created_at, clearCutoff)
      ),
    [taskInviteResponses, clearCutoff]
  );
  const filteredPendingGroupInvites = React.useMemo(
    () => pendingGroupInvites.filter((item) => isAfterClearCutoff(item?.created_at, clearCutoff)),
    [pendingGroupInvites, clearCutoff]
  );
  const filteredGroupInviteResponses = React.useMemo(
    () =>
      groupInviteResponses.filter((item) =>
        isAfterClearCutoff(item?.responded_at || item?.updated_at || item?.created_at, clearCutoff)
      ),
    [groupInviteResponses, clearCutoff]
  );

  const groupedUpcoming = React.useMemo(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const items = [];

    (tasks || []).forEach((task) => {
      if (!task || task.completed || !task.date) return;
      const dueAt = buildDateWithTime(task.date, task.time, 23, 59);
      if (!(dueAt instanceof Date) || Number.isNaN(dueAt.getTime())) return;
      if (dueAt.getTime() < nowMs) return;

      const title = task.title || 'Task';
      const priorityText = task.priority ? ` - ${String(task.priority).toLowerCase()} priority` : '';
      const key = `upcoming-task-${task.id || `${title}-${dueAt.getTime()}`}`;
      items.push({
        key,
        sortTimeMs: dueAt.getTime(),
        timestamp: dueAt.toISOString(),
        component: (
          <View key={key} style={themedStyles.card}>
            <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.tasks}15` }]}>
              <Feather name="clipboard" size={20} color={colors.tasks} />
            </View>
            <View style={themedStyles.textWrap}>
              <Text style={themedStyles.cardTitle}>Upcoming task</Text>
              <Text style={themedStyles.cardBody}>
                {title} - {formatFriendlyDateTime(dueAt)}
                {priorityText}
              </Text>
            </View>
          </View>
        ),
      });
    });

    const allRoutines = [
      ...(routines || []).map((routine) => ({ routine, isGroupRoutine: false })),
      ...(groupRoutines || []).map((routine) => ({ routine, isGroupRoutine: true })),
    ];
    const activeRoutineKeys = new Set();

    allRoutines.forEach(({ routine, isGroupRoutine }) => {
      if (!routine?.id) return;
      const routineKey = `${isGroupRoutine ? 'group' : 'personal'}:${routine.id}`;
      const activity = getRoutineActivityStatus(routine, now);
      if (!activity?.isActive || !activity?.activeDateKey) return;

      const completion = getRoutineCompletionForDate?.(routine.id, activity.activeDateKey, {
        isGroup: isGroupRoutine,
      });
      if (completion?.completed) return;

      const taskIds = Array.isArray(routine?.tasks)
        ? routine.tasks.map((task) => String(task?.id || '')).filter(Boolean)
        : [];
      const checkedTaskIds = new Set(
        (completion?.completedTaskIds || []).map((taskId) => String(taskId || '')).filter(Boolean)
      );
      const checkedCount = taskIds.reduce(
        (count, taskId) => (checkedTaskIds.has(taskId) ? count + 1 : count),
        0
      );
      const totalTasks = taskIds.length;
      const progressLabel = totalTasks
        ? `${checkedCount}/${totalTasks} tasks checked`
        : 'No tasks added yet';
      const actionLabel = totalTasks
        ? 'Check all routine tasks, then complete the routine.'
        : 'Add tasks in the routine and complete it while active.';
      const routineName = routine.name || 'Routine';
      const key = `active-routine-${routineKey}-${activity.activeDateKey}`;
      activeRoutineKeys.add(routineKey);

      items.push({
        key,
        sortTimeMs: nowMs - 1000,
        timestamp: new Date(nowMs - 1000).toISOString(),
        component: (
          <View key={key} style={themedStyles.card}>
            <View style={[themedStyles.iconWrap, { backgroundColor: `${routineColor}15` }]}>
              <Ionicons name="flash-outline" size={20} color={routineColor} />
            </View>
            <View style={themedStyles.textWrap}>
              <Text style={themedStyles.cardTitle}>
                {isGroupRoutine ? 'Group routine active now' : 'Routine active now'}
              </Text>
              <Text style={themedStyles.cardBody}>
                {routineName} is active. {progressLabel}. {actionLabel}
              </Text>
            </View>
          </View>
        ),
      });
    });

    allRoutines.forEach(({ routine, isGroupRoutine }) => {
      if (!routine) return;
      const routineKey = `${isGroupRoutine ? 'group' : 'personal'}:${routine.id}`;
      if (activeRoutineKeys.has(routineKey)) return;
      const nextAt = getRoutineNextOccurrence(routine, now);
      if (!(nextAt instanceof Date) || Number.isNaN(nextAt.getTime())) return;
      if (nextAt.getTime() < nowMs) return;

      const title = routine.name || 'Routine';
      const scheduleLabel = getRoutineScheduleLabel(routine?.repeat, routine?.days);
      const key = `upcoming-routine-${routineKey || `${title}-${nextAt.getTime()}`}`;
      items.push({
        key,
        sortTimeMs: nextAt.getTime(),
        timestamp: nextAt.toISOString(),
        component: (
          <View key={key} style={themedStyles.card}>
            <View style={[themedStyles.iconWrap, { backgroundColor: `${routineColor}15` }]}>
              <Ionicons name="repeat" size={20} color={routineColor} />
            </View>
            <View style={themedStyles.textWrap}>
              <Text style={themedStyles.cardTitle}>
                {isGroupRoutine ? 'Upcoming group routine' : 'Upcoming routine'}
              </Text>
              <Text style={themedStyles.cardBody}>
                {title} - {formatFriendlyDateTime(nextAt)} - {scheduleLabel}
              </Text>
            </View>
          </View>
        ),
      });
    });

    (reminders || []).forEach((reminder) => {
      if (!reminder) return;
      const reminderAt = buildDateWithTime(
        reminder.date || reminder.dateTime,
        reminder.time,
        DEFAULT_EVENT_TIME.hour,
        DEFAULT_EVENT_TIME.minute
      );
      if (!(reminderAt instanceof Date) || Number.isNaN(reminderAt.getTime())) return;
      if (reminderAt.getTime() < nowMs) return;

      const title = reminder.title || 'Reminder';
      const key = `upcoming-reminder-${reminder.id || `${title}-${reminderAt.getTime()}`}`;
      items.push({
        key,
        sortTimeMs: reminderAt.getTime(),
        timestamp: reminderAt.toISOString(),
        component: (
          <View key={key} style={themedStyles.card}>
            <View style={[themedStyles.iconWrap, { backgroundColor: `${reminderColor}15` }]}>
              <Ionicons name="notifications-outline" size={20} color={reminderColor} />
            </View>
            <View style={themedStyles.textWrap}>
              <Text style={themedStyles.cardTitle}>Upcoming reminder</Text>
              <Text style={themedStyles.cardBody}>
                {title} - {formatFriendlyDateTime(reminderAt)}
              </Text>
            </View>
          </View>
        ),
      });
    });

    const habitsDueToday = (habits || [])
      .filter((habit) => habit?.id)
      .filter((habit) => isHabitScheduledForDate(habit, now))
      .filter((habit) => !isHabitCompletedToday(habit.id))
      .sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || '')));

    habitsDueToday.forEach((habit, index) => {
      const title = habit.title || 'Habit';
      const itemTimestamp = new Date(nowMs + index * 1000);
      const key = `habit-due-${habit.id || `${title}-${index}`}`;
      items.push({
        key,
        sortTimeMs: itemTimestamp.getTime(),
        timestamp: itemTimestamp.toISOString(),
        component: (
          <View key={key} style={themedStyles.card}>
            <View style={[themedStyles.iconWrap, { backgroundColor: `${habitColor}15` }]}>
              <Feather name="check-square" size={20} color={habitColor} />
            </View>
            <View style={themedStyles.textWrap}>
              <Text style={themedStyles.cardTitle}>Habit to complete</Text>
              <Text style={themedStyles.cardBody}>{title} still needs to be completed today.</Text>
            </View>
          </View>
        ),
      });
    });

    return groupUpcomingNotifications(items);
  }, [
    tasks,
    routines,
    groupRoutines,
    reminders,
    habits,
    isHabitCompletedToday,
    getRoutineCompletionForDate,
    themedStyles,
    routineColor,
    reminderColor,
    habitColor,
  ]);

  const totalNotifications =
    filteredPendingRequests.length +
    filteredResponseNotifications.length +
    filteredPendingTaskInvites.length +
    filteredTaskInviteResponses.length +
    filteredPendingGroupInvites.length +
    filteredGroupInviteResponses.length;

  const handleClearAll = React.useCallback(() => {
    if (!totalNotifications) return;
    Alert.alert(
      'Clear notifications',
      'This will hide all current notifications in your centre.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const now = Date.now();
            setClearCutoff(now);
            try {
              await AsyncStorage.setItem(storageKey, String(now));
            } catch (err) {
            }
          },
        },
      ]
    );
  }, [storageKey, totalNotifications]);

  const groupedPending = React.useMemo(() => {
    const items = (filteredPendingRequests || []).map((item) => ({
      key: `pending-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name="user-plus" size={20} color={colors.primary} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.fromUser?.name || item.fromUser?.username || 'Someone')} added you as a friend
            </Text>
            <Text style={themedStyles.cardBody}>
              @{item.fromUser?.username || 'unknown'}
              {item.created_at ? ` - ${formatTimeAgo(item.created_at)}` : ''}
            </Text>
            <View style={themedStyles.actionRow}>
              <TouchableOpacity
                onPress={() => handleRespond(item.id, 'accepted')}
                style={themedStyles.primaryButton}
                disabled={!!respondingMap[item.id]}
              >
                {respondingMap[item.id] === 'accepted' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={themedStyles.primaryButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespond(item.id, 'declined')}
                style={themedStyles.secondaryButton}
                disabled={!!respondingMap[item.id]}
              >
                {respondingMap[item.id] === 'declined' ? (
                  <ActivityIndicator color={themedStyles.subduedText} size="small" />
                ) : (
                  <Text style={themedStyles.secondaryButtonText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ),
      timestamp: item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredPendingRequests, themedStyles, respondingMap]);

  const groupedResponses = React.useMemo(() => {
    const items = (filteredResponseNotifications || []).map((item) => ({
      key: `response-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]}>
            <Feather name={item.status === 'accepted' ? 'user-check' : 'user-minus'} size={20} color={colors.primary} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.toUser?.name || item.toUser?.username || 'Someone')}{' '}
              {item.status === 'accepted' ? 'accepted' : 'declined'} your request
            </Text>
            <Text style={themedStyles.cardBody}>
              @{item.toUser?.username || 'unknown'}
              {item.responded_at ? ` - ${formatTimeAgo(item.responded_at)}` : ''}
            </Text>
          </View>
        </View>
      ),
      timestamp: item.responded_at || item.updated_at || item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredResponseNotifications, themedStyles]);

  const groupedTaskInvites = React.useMemo(() => {
    const items = (filteredPendingTaskInvites || []).map((item) => ({
      key: `task-invite-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.tasks}15` }]}>
            <Feather name="clipboard" size={20} color={colors.tasks} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.fromUser?.name || item.fromUser?.username || 'Someone')} invited you to a task
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.task?.title || 'Task'}
              {item.created_at ? ` - ${formatTimeAgo(item.created_at)}` : ''}
            </Text>
            <View style={themedStyles.actionRow}>
              <TouchableOpacity
                onPress={() => handleRespondTaskInvite(item.id, 'accepted')}
                style={themedStyles.primaryButton}
                disabled={!!respondingTaskMap[item.id]}
              >
                {respondingTaskMap[item.id] === 'accepted' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={themedStyles.primaryButtonText}>Accept</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondTaskInvite(item.id, 'declined')}
                style={themedStyles.secondaryButton}
                disabled={!!respondingTaskMap[item.id]}
              >
                {respondingTaskMap[item.id] === 'declined' ? (
                  <ActivityIndicator color={themedStyles.subduedText} size="small" />
                ) : (
                  <Text style={themedStyles.secondaryButtonText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ),
      timestamp: item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredPendingTaskInvites, themedStyles, respondingTaskMap]);

  const groupedTaskResponses = React.useMemo(() => {
    const items = (filteredTaskInviteResponses || []).map((item) => ({
      key: `task-response-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.tasks}15` }]}>
            <Feather name={item.status === 'accepted' ? 'check-circle' : 'x-circle'} size={20} color={colors.tasks} />
          </View>
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.toUser?.name || item.toUser?.username || 'Someone')}{' '}
              {item.status === 'accepted' ? 'accepted' : 'declined'} your task invite
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.task?.title || 'Task'}
              {item.responded_at ? ` - ${formatTimeAgo(item.responded_at)}` : ''}
            </Text>
          </View>
        </View>
      ),
      timestamp: item.responded_at || item.updated_at || item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredTaskInviteResponses, themedStyles]);

  const groupedGroupInvites = React.useMemo(() => {
    const items = (filteredPendingGroupInvites || []).map((item) => ({
      key: `group-invite-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]} />
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.fromUser?.name || item.fromUser?.username || 'Someone')} invited you to{' '}
              {item.group?.name || 'a group'}
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.created_at ? `Sent ${formatTimeAgo(item.created_at)}` : ''}
            </Text>
            <View style={themedStyles.actionRow}>
              <TouchableOpacity
                onPress={() => handleRespondGroup(item.id, 'accepted')}
                style={themedStyles.primaryButton}
                disabled={!!respondingGroupMap[item.id]}
              >
                {respondingGroupMap[item.id] === 'accepted' ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={themedStyles.primaryButtonText}>Join</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleRespondGroup(item.id, 'declined')}
                style={themedStyles.secondaryButton}
                disabled={!!respondingGroupMap[item.id]}
              >
                {respondingGroupMap[item.id] === 'declined' ? (
                  <ActivityIndicator color={themedStyles.subduedText} size="small" />
                ) : (
                  <Text style={themedStyles.secondaryButtonText}>Decline</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ),
      timestamp: item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredPendingGroupInvites, themedStyles, respondingGroupMap]);

  const groupedGroupResponses = React.useMemo(() => {
    const items = (filteredGroupInviteResponses || []).map((item) => ({
      key: `group-response-${item.id}`,
      component: (
        <View key={item.id} style={themedStyles.card}>
          <View style={[themedStyles.iconWrap, { backgroundColor: `${colors.primary}15` }]} />
          <View style={themedStyles.textWrap}>
            <Text style={themedStyles.cardTitle}>
              {(item.toUser?.name || item.toUser?.username || 'Someone')}{' '}
              {item.status === 'accepted' ? 'joined' : 'declined'} {item.group?.name || 'your group'}
            </Text>
            <Text style={themedStyles.cardBody}>
              {item.responded_at ? `Updated ${formatTimeAgo(item.responded_at)}` : ''}
            </Text>
          </View>
        </View>
      ),
      timestamp: item.responded_at || item.updated_at || item.created_at,
    }));
    return groupNotifications(items);
  }, [filteredGroupInviteResponses, themedStyles]);

  return (
    <View style={[themedStyles.container, { paddingTop: insets.top || spacing.lg }]}>
      <View style={themedStyles.header}>
        <TouchableOpacity
          style={themedStyles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={22} color={themedStyles.iconColor} />
        </TouchableOpacity>
        <Text style={themedStyles.title}>Notification Centre</Text>
        <TouchableOpacity
          style={[
            themedStyles.clearButton,
            totalNotifications === 0 && themedStyles.clearButtonDisabled,
          ]}
          onPress={handleClearAll}
          disabled={totalNotifications === 0}
          accessibilityLabel="Clear notifications"
        >
          <Ionicons name="trash-outline" size={20} color={themedStyles.iconColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={themedStyles.scroll}
        contentContainerStyle={themedStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={themedStyles.sectionLabel}>Upcoming</Text>
        {groupedUpcoming.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="notifications-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              Upcoming tasks, routines, reminders, and habit prompts will appear here.
            </Text>
          </View>
        ) : (
          groupedUpcoming.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={themedStyles.sectionLabel}>Friend requests</Text>
        {filteredPendingRequests.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="notifications-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              No new notifications. Friend requests and task invites will appear here.
            </Text>
          </View>
        ) : (
          groupedPending.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Task invites</Text>
        {filteredPendingTaskInvites.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Feather name="clipboard" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              No task invites right now.
            </Text>
          </View>
        ) : (
          groupedTaskInvites.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Group invites</Text>
        {filteredPendingGroupInvites.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="people-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>No group invites right now.</Text>
          </View>
        ) : (
          groupedGroupInvites.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Updates</Text>
        {filteredResponseNotifications.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="information-circle-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              When someone responds to your friend request, it will appear here.
            </Text>
          </View>
        ) : (
          groupedResponses.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Task updates</Text>
        {filteredTaskInviteResponses.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="information-circle-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              When someone responds to your task invite, it will appear here.
            </Text>
          </View>
        ) : (
          groupedTaskResponses.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}

        <Text style={[themedStyles.sectionLabel, { marginTop: spacing.lg }]}>Group updates</Text>
        {filteredGroupInviteResponses.length === 0 ? (
          <View style={themedStyles.placeholderBox}>
            <Ionicons name="information-circle-outline" size={20} color={themedStyles.subduedText} />
            <Text style={themedStyles.placeholderText}>
              When someone responds to your group invite, it will appear here.
            </Text>
          </View>
        ) : (
          groupedGroupResponses.map((group) => (
            <View key={group.label}>
              <Text style={themedStyles.groupLabel}>{group.label}</Text>
              {group.data.map((n) => n.component)}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (themeColors) => {
  const baseText = themeColors?.text || colors.text;
  const subdued = themeColors?.textSecondary || colors.textSecondary;
  const primary = themeColors?.primary || colors.primary;
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeColors?.background || colors.background,
    },
    iconColor: baseText,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    title: {
      ...typography.h3,
      color: baseText,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    sectionLabel: {
      ...typography.caption,
      color: subdued,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      backgroundColor: themeColors?.card || colors.card,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      marginBottom: spacing.sm,
      ...shadows.small,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    textWrap: {
      flex: 1,
    },
    cardTitle: {
      ...typography.body,
      fontWeight: '700',
      marginBottom: 2,
      color: baseText,
    },
    cardBody: {
      ...typography.bodySmall,
      color: subdued,
      lineHeight: 18,
    },
    actionRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    primaryButton: {
      backgroundColor: primary,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      minWidth: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryButton: {
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
      paddingVertical: 10,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.md,
      marginLeft: spacing.sm,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      minWidth: 96,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      ...typography.body,
      color: '#ffffff',
      fontWeight: '700',
    },
    clearButton: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
    },
    clearButtonDisabled: {
      opacity: 0.4,
    },
    secondaryButtonText: {
      ...typography.body,
      color: baseText,
      fontWeight: '600',
    },
    placeholderBox: {
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: themeColors?.border || colors.border,
      backgroundColor: themeColors?.inputBackground || colors.inputBackground,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    placeholderText: {
      ...typography.bodySmall,
      color: subdued,
      flex: 1,
    },
    subduedText: subdued,
    groupLabel: {
      ...typography.caption,
      color: subdued,
      marginBottom: spacing.xs,
      marginTop: spacing.xs,
    },
  });
};

export default NotificationCenterScreen;
