import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useApp } from '../context/AppContext';
import {
  Card,
  Modal,
  Button,
  Input,
  ChipGroup,
  PlatformScrollView,
  PlatformTimePicker,
} from '../components';
import { borderRadius, spacing, typography } from '../utils/theme';
import { formatTimeFromDate } from '../utils/notifications';
import {
  ROUTINE_REPEAT,
  ROUTINE_REPEAT_OPTIONS,
  ROUTINE_WEEKDAY_LABELS,
  normalizeRoutineDays,
  normalizeRoutineRepeat,
  normalizeRoutineSchedule,
  getRoutineDaysForRepeat,
  isRoutineScheduleValid,
  getRoutineScheduleLabel,
} from '../utils/routineSchedule';

const QUICK_ROUTINE_TIMES = ['06:00', '09:00', '12:00', '18:00', '21:00'];
const ROUTINE_MONTH_DAY_OPTIONS = Array.from({ length: 31 }).map((_, index) => index + 1);
const CALENDAR_WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const toStartOfDay = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toIsoDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const parseClockMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value
    .trim()
    .match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
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

const normalizeRoutineTimeValue = (value) => {
  const minutes = parseClockMinutes(value);
  if (minutes === null) return '';
  const nextDate = new Date();
  nextDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return formatTimeFromDate(nextDate);
};

const normalizeRoutineTimeRange = (source = {}) => {
  const legacyTimes = Array.isArray(source?.scheduledTimes)
    ? source.scheduledTimes
    : Array.isArray(source?.scheduled_times)
    ? source.scheduled_times
    : [];
  const startCandidate =
    source?.startTime !== undefined
      ? source.startTime
      : source?.start_time !== undefined
      ? source.start_time
      : legacyTimes[0];
  const endCandidate =
    source?.endTime !== undefined
      ? source.endTime
      : source?.end_time !== undefined
      ? source.end_time
      : legacyTimes[1];

  return {
    startTime: normalizeRoutineTimeValue(startCandidate),
    endTime: normalizeRoutineTimeValue(endCandidate),
  };
};

const getRoutineDurationLabel = (startTime, endTime) => {
  const startMinutes = parseClockMinutes(startTime);
  const endMinutes = parseClockMinutes(endTime);
  if (startMinutes === null || endMinutes === null) return '';

  const diffMinutes = ((endMinutes - startMinutes) + 1440) % 1440;
  if (!diffMinutes) return '24h';
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
};

const formatRoutineTimeRangeSummary = (routine) => {
  const { startTime, endTime } = normalizeRoutineTimeRange(routine);
  if (!startTime && !endTime) return 'No range set';
  if (!startTime) return `Ends ${endTime}`;
  if (!endTime) return `Starts ${startTime}`;
  const duration = getRoutineDurationLabel(startTime, endTime);
  return duration
    ? `${startTime} - ${endTime} (${duration})`
    : `${startTime} - ${endTime}`;
};

const formatRoutineScheduleSummary = (routine) => {
  const scheduleLabel = getRoutineScheduleLabel(routine?.repeat, routine?.days);
  const timeLabel = formatRoutineTimeRangeSummary(routine);
  if (!timeLabel) return scheduleLabel;
  return `${scheduleLabel} - ${timeLabel}`;
};

const isRoutineScheduledForDate = (routine, dateValue = new Date()) => {
  const targetDate = toStartOfDay(dateValue);
  if (!targetDate) return false;

  const schedule = normalizeRoutineSchedule(routine);
  if (schedule.repeat === ROUTINE_REPEAT.WEEKLY) {
    const weekdayLabels = normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.WEEKLY);
    if (!weekdayLabels.length) return true;
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][targetDate.getDay()];
    return weekdayLabels.includes(weekday);
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
  const baseDate = toStartOfDay(dateValue);
  if (!baseDate) return null;
  if (!isRoutineScheduledForDate(routine, baseDate)) return null;

  const { startTime, endTime } = normalizeRoutineTimeRange(routine);
  const startMinutes = parseClockMinutes(startTime);
  const endMinutes = parseClockMinutes(endTime);
  if (!Number.isInteger(startMinutes) || !Number.isInteger(endMinutes)) return null;

  const startAt = new Date(baseDate);
  startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

  const endAt = new Date(baseDate);
  endAt.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
  const spansOvernight = endMinutes <= startMinutes;
  if (spansOvernight) endAt.setDate(endAt.getDate() + 1);

  return {
    startAt,
    endAt,
    spansOvernight,
    activeDateKey: toIsoDateKey(startAt),
  };
};

const getRoutineActivityStatus = (routine, nowValue = new Date()) => {
  const now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
  if (!routine || Number.isNaN(now.getTime())) {
    return {
      isActive: false,
      activeDateKey: '',
      windowStart: null,
      windowEnd: null,
      nextStartAt: null,
      isScheduledToday: false,
    };
  }

  const todayWindow = buildRoutineWindowForDate(routine, now);
  const isTodayScheduled = isRoutineScheduledForDate(routine, now);
  if (
    todayWindow &&
    now.getTime() >= todayWindow.startAt.getTime() &&
    now.getTime() <= todayWindow.endAt.getTime()
  ) {
    return {
      isActive: true,
      activeDateKey: todayWindow.activeDateKey,
      windowStart: todayWindow.startAt,
      windowEnd: todayWindow.endAt,
      nextStartAt: null,
      isScheduledToday: isTodayScheduled,
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
      nextStartAt: null,
      isScheduledToday: isTodayScheduled,
    };
  }

  let nextStartAt = null;
  for (let offset = 0; offset <= 40; offset += 1) {
    const day = new Date(now);
    day.setDate(day.getDate() + offset);
    const window = buildRoutineWindowForDate(routine, day);
    if (!window) continue;
    if (window.startAt.getTime() > now.getTime()) {
      nextStartAt = window.startAt;
      break;
    }
  }

  return {
    isActive: false,
    activeDateKey: '',
    windowStart: null,
    windowEnd: null,
    nextStartAt,
    isScheduledToday: isTodayScheduled,
  };
};

const RoutineDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const {
    routines,
    routineCompletions,
    groupRoutines,
    groups,
    addTaskToRoutine,
    addTaskToGroupRoutine,
    removeTaskFromRoutine,
    removeTaskFromGroupRoutine,
    reorderRoutineTasks,
    reorderGroupRoutineTasks,
    updateRoutine,
    updateGroupRoutine,
    deleteRoutine,
    deleteGroupRoutine,
    getRoutineCompletionForDate,
    setRoutineCompletionProgress,
    completeRoutineForDate,
    ensureRoutinesLoaded,
    themeName,
    themeColors,
  } = useApp();
  const { routineId, isGroup } = route.params || {};
  const isDark = themeName === 'dark';

  const routine = useMemo(() => {
    if (!routineId) return null;
    return isGroup
      ? groupRoutines.find((item) => item.id === routineId)
      : routines.find((item) => item.id === routineId);
  }, [groupRoutines, isGroup, routineId, routines]);

  const groupName = useMemo(() => {
    if (!isGroup || !routine?.groupId) return null;
    const match = (groups || []).find((group) => group.id === routine.groupId);
    return match?.name || 'Group';
  }, [groups, isGroup, routine?.groupId]);

  const detailTheme = useMemo(() => {
    if (isGroup) {
      return isDark
        ? {
            card: '#232447',
            header: '#2E2B56',
            border: '#3C3B69',
            accent: themeColors.tasks,
            actionBg: '#2E2B56',
            actionText: '#DDE1FF',
            itemBg: '#303158',
            itemBorder: 'rgba(99, 102, 241, 0.45)',
            muted: '#C8CEFF',
          }
        : {
            card: '#EEF0FF',
            header: '#DDE2FF',
            border: '#C9D1FF',
            accent: themeColors.tasks,
            actionBg: '#E4E8FF',
            actionText: themeColors.tasks,
            itemBg: '#FFFFFF',
            itemBorder: '#D5DBFF',
            muted: '#5157B7',
          };
    }
    return isDark
      ? {
          card: '#2E2538',
          header: '#3C2E4A',
          border: '#4B3A5E',
          accent: themeColors.routine,
          actionBg: '#4A3560',
          actionText: '#F4E5FF',
          itemBg: '#3C304A',
          itemBorder: 'rgba(245, 158, 11, 0.45)',
          muted: '#E2C48C',
        }
      : {
          card: '#FFF4E3',
          header: '#FFE8C6',
          border: '#F6D7A7',
          accent: themeColors.routine,
          actionBg: '#EFE5FF',
          actionText: themeColors.primary,
          itemBg: '#FFFDF7',
          itemBorder: '#F3D5A2',
          muted: '#8B6F45',
        };
  }, [isDark, isGroup, themeColors]);

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRoutineTimePicker, setShowRoutineTimePicker] = useState(false);
  const [routineTimePickerTarget, setRoutineTimePickerTarget] = useState(null);
  const [editRoutineName, setEditRoutineName] = useState('');
  const [editRoutineStartTime, setEditRoutineStartTime] = useState('');
  const [editRoutineEndTime, setEditRoutineEndTime] = useState('');
  const [editRoutineRepeat, setEditRoutineRepeat] = useState(ROUTINE_REPEAT.DAILY);
  const [editRoutineWeekDays, setEditRoutineWeekDays] = useState([]);
  const [editRoutineMonthDays, setEditRoutineMonthDays] = useState([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const [calendarMonthAnchor, setCalendarMonthAnchor] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => toIsoDateKey(new Date()));

  useEffect(() => {
    ensureRoutinesLoaded();
  }, [ensureRoutinesLoaded]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!routine) {
      setEditRoutineName('');
      setEditRoutineStartTime('');
      setEditRoutineEndTime('');
      setEditRoutineRepeat(ROUTINE_REPEAT.DAILY);
      setEditRoutineWeekDays([]);
      setEditRoutineMonthDays([]);
      return;
    }
    const range = normalizeRoutineTimeRange(routine);
    const schedule = normalizeRoutineSchedule(routine);
    const normalizedWeekDays =
      schedule.repeat === ROUTINE_REPEAT.WEEKLY
        ? normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.WEEKLY)
        : [];
    const normalizedMonthDays =
      schedule.repeat === ROUTINE_REPEAT.MONTHLY
        ? normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.MONTHLY).map((day) => Number(day))
        : [];
    setEditRoutineName(routine.name || '');
    setEditRoutineStartTime(range.startTime);
    setEditRoutineEndTime(range.endTime);
    setEditRoutineRepeat(schedule.repeat);
    setEditRoutineWeekDays(normalizedWeekDays);
    setEditRoutineMonthDays(normalizedMonthDays);
  }, [routine]);

  useEffect(() => {
    const today = new Date();
    setCalendarMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedCalendarDate(toIsoDateKey(today));
  }, [routine?.id]);

  const handleAddTask = async () => {
    if (!taskName.trim() || !routine) return;
    if (isGroup) {
      await addTaskToGroupRoutine(routine.id, { name: taskName.trim() });
    } else {
      await addTaskToRoutine(routine.id, { name: taskName.trim() });
    }
    setTaskName('');
    setShowTaskModal(false);
  };

  const handleSelectRoutineTime = (value) => {
    const normalized =
      value instanceof Date ? formatTimeFromDate(value) : value;
    if (routineTimePickerTarget === 'start') {
      setEditRoutineStartTime(normalizeRoutineTimeValue(normalized));
    }
    if (routineTimePickerTarget === 'end') {
      setEditRoutineEndTime(normalizeRoutineTimeValue(normalized));
    }
    setShowRoutineTimePicker(false);
    setRoutineTimePickerTarget(null);
  };

  const openRoutineTimePicker = (target) => {
    setRoutineTimePickerTarget(target);
    setShowRoutineTimePicker(true);
  };

  const handleQuickRoutineTime = (value, target) => {
    const normalized = normalizeRoutineTimeValue(value);
    if (!normalized) return;
    if (target === 'start') {
      setEditRoutineStartTime(normalized);
      return;
    }
    if (target === 'end') {
      setEditRoutineEndTime(normalized);
    }
  };

  const handleEditRoutineRepeatSelect = (value) => {
    setEditRoutineRepeat(normalizeRoutineRepeat(value));
  };

  const toggleEditRoutineWeekDay = (dayLabel) => {
    setEditRoutineWeekDays((prev) => {
      const next = prev.includes(dayLabel)
        ? prev.filter((value) => value !== dayLabel)
        : [...prev, dayLabel];
      return normalizeRoutineDays(next, ROUTINE_REPEAT.WEEKLY);
    });
  };

  const toggleEditRoutineMonthDay = (day) => {
    const dayLabel = String(day);
    setEditRoutineMonthDays((prev) => {
      const next = prev.map((value) => String(value));
      const updated = next.includes(dayLabel)
        ? next.filter((value) => value !== dayLabel)
        : [...next, dayLabel];
      return normalizeRoutineDays(updated, ROUTINE_REPEAT.MONTHLY).map((value) => Number(value));
    });
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setShowRoutineTimePicker(false);
    setRoutineTimePickerTarget(null);
    const range = normalizeRoutineTimeRange(routine);
    const schedule = normalizeRoutineSchedule(routine);
    const normalizedWeekDays =
      schedule.repeat === ROUTINE_REPEAT.WEEKLY
        ? normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.WEEKLY)
        : [];
    const normalizedMonthDays =
      schedule.repeat === ROUTINE_REPEAT.MONTHLY
        ? normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.MONTHLY).map((day) => Number(day))
        : [];
    setEditRoutineName(routine?.name || '');
    setEditRoutineStartTime(range.startTime);
    setEditRoutineEndTime(range.endTime);
    setEditRoutineRepeat(schedule.repeat);
    setEditRoutineWeekDays(normalizedWeekDays);
    setEditRoutineMonthDays(normalizedMonthDays);
  };

  const handleSaveRoutine = async () => {
    if (!routine || !editRoutineName.trim() || !editRoutineStartTime || !editRoutineEndTime) {
      return;
    }
    const routineDays = getRoutineDaysForRepeat({
      repeat: editRoutineRepeat,
      weekDays: editRoutineWeekDays,
      monthDays: editRoutineMonthDays,
    });
    if (!isRoutineScheduleValid(editRoutineRepeat, routineDays)) {
      Alert.alert(
        'Select routine days',
        editRoutineRepeat === ROUTINE_REPEAT.MONTHLY
          ? 'Choose at least one day of the month for this routine.'
          : 'Choose at least one weekday for this routine.'
      );
      return;
    }
    const updates = {
      name: editRoutineName.trim(),
      startTime: editRoutineStartTime,
      endTime: editRoutineEndTime,
      repeat: normalizeRoutineRepeat(editRoutineRepeat),
      days: routineDays,
    };

    try {
      if (isGroup) {
        await updateGroupRoutine(routine.id, updates);
      } else {
        await updateRoutine(routine.id, updates);
      }
      setShowRoutineTimePicker(false);
      setRoutineTimePickerTarget(null);
      setShowEditModal(false);
    } catch (error) {
      Alert.alert('Unable to update routine', error?.message || 'Please try again.');
    }
  };

  const handleDeleteRoutine = () => {
    if (!routine) return;
    Alert.alert(
      'Delete routine',
      'Are you sure you want to delete this routine and all tasks?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (isGroup) {
              await deleteGroupRoutine(routine.id);
            } else {
              await deleteRoutine(routine.id);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleMoveTask = (index, direction) => {
    if (!routine?.tasks?.length) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= routine.tasks.length) return;
    const newOrder = [...routine.tasks];
    const [item] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, item);
    if (isGroup) {
      reorderGroupRoutineTasks(routine.id, newOrder);
    } else {
      reorderRoutineTasks(routine.id, newOrder);
    }
  };

  const handleRemoveTask = (taskId) => {
    if (!routine || !taskId) return;
    if (isGroup) {
      removeTaskFromGroupRoutine(routine.id, taskId);
    } else {
      removeTaskFromRoutine(routine.id, taskId);
    }
  };

  const handleToggleRoutineTask = async (taskId) => {
    if (!routine?.id || !taskId) return;
    if (!routineActivity?.isActive || !activeDateKey || isRoutineCompletedForActiveDate) return;

    const currentTaskIds = new Set(activeCheckedTaskIds);
    const normalizedTaskId = String(taskId);
    if (currentTaskIds.has(normalizedTaskId)) {
      currentTaskIds.delete(normalizedTaskId);
    } else {
      currentTaskIds.add(normalizedTaskId);
    }

    await setRoutineCompletionProgress({
      routineId: routine.id,
      isGroup: Boolean(isGroup),
      date: activeDateKey,
      completedTaskIds: Array.from(currentTaskIds),
      completed: false,
    });
  };

  const handleCompleteRoutineNow = async () => {
    if (!routine?.id || !routineActivity?.isActive || !activeDateKey) return;
    if (activeTaskIds.length === 0) {
      Alert.alert(
        'Add tasks first',
        'Add and check routine tasks before completing this routine.'
      );
      return;
    }
    if (!allActiveTasksChecked) {
      Alert.alert(
        'Complete all tasks first',
        'Check all routine tasks before completing this routine.'
      );
      return;
    }

    try {
      await completeRoutineForDate({
        routineId: routine.id,
        isGroup: Boolean(isGroup),
        date: activeDateKey,
        completedTaskIds: Array.from(activeCheckedTaskIds),
      });
    } catch (error) {
      Alert.alert('Unable to complete routine', error?.message || 'Please try again.');
    }
  };

  const shiftCalendarMonth = (offset) => {
    const nextAnchor = new Date(
      calendarMonthAnchor.getFullYear(),
      calendarMonthAnchor.getMonth() + offset,
      1
    );
    setCalendarMonthAnchor(nextAnchor);
    setSelectedCalendarDate(toIsoDateKey(nextAnchor));
  };

  const formattedDate = routine?.createdAt
    ? new Date(routine.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;
  const editRoutineSelectedDays = getRoutineDaysForRepeat({
    repeat: editRoutineRepeat,
    weekDays: editRoutineWeekDays,
    monthDays: editRoutineMonthDays,
  });
  const isEditRoutineScheduleSelectionValid = isRoutineScheduleValid(
    editRoutineRepeat,
    editRoutineSelectedDays
  );
  const scheduleSummary = formatRoutineScheduleSummary(routine);
  const routineActivity = useMemo(
    () => getRoutineActivityStatus(routine, new Date(nowTick)),
    [nowTick, routine]
  );
  const activeDateKey = routineActivity?.activeDateKey || '';
  const activeCompletion = useMemo(
    () =>
      routine?.id && activeDateKey
        ? getRoutineCompletionForDate(routine.id, activeDateKey, { isGroup: Boolean(isGroup) })
        : null,
    [activeDateKey, getRoutineCompletionForDate, isGroup, routine?.id]
  );
  const activeTaskIds = useMemo(
    () =>
      (routine?.tasks || [])
        .map((task) => String(task?.id || ''))
        .filter(Boolean),
    [routine?.tasks]
  );
  const activeCheckedTaskIds = useMemo(
    () => new Set((activeCompletion?.completedTaskIds || []).map((taskId) => String(taskId || ''))),
    [activeCompletion?.completedTaskIds]
  );
  const checkedTaskCount = useMemo(
    () =>
      activeTaskIds.reduce(
        (count, taskId) => (activeCheckedTaskIds.has(taskId) ? count + 1 : count),
        0
      ),
    [activeCheckedTaskIds, activeTaskIds]
  );
  const isRoutineCompletedForActiveDate = Boolean(activeCompletion?.completed);
  const allActiveTasksChecked = activeTaskIds.length > 0 && checkedTaskCount === activeTaskIds.length;
  const canCompleteRoutineNow =
    routineActivity?.isActive &&
    !isRoutineCompletedForActiveDate &&
    activeTaskIds.length > 0 &&
    allActiveTasksChecked;

  const completionMapKey = `${isGroup ? 'group' : 'personal'}:${routine?.id || ''}`;
  const routineCompletionByDate = routineCompletions?.[completionMapKey] || {};
  const todayStart = useMemo(() => toStartOfDay(new Date(nowTick)), [nowTick]);
  const calendarCells = useMemo(() => {
    const year = calendarMonthAnchor.getFullYear();
    const month = calendarMonthAnchor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];

    for (let index = 0; index < firstDay; index += 1) {
      cells.push({ type: 'spacer', key: `spacer-${index}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const isoKey = toIsoDateKey(date);
      const scheduled = isRoutineScheduledForDate(routine, date);
      const completion = routineCompletionByDate?.[isoKey] || null;
      const completed = scheduled && Boolean(completion?.completed);
      const isFuture = todayStart ? date.getTime() > todayStart.getTime() : false;
      const missed = scheduled && !completed && !isFuture;
      cells.push({
        type: 'day',
        key: `day-${isoKey}`,
        day,
        isoKey,
        scheduled,
        completed,
        missed,
        isFuture,
      });
    }

    return cells;
  }, [calendarMonthAnchor, routine, routineCompletionByDate, todayStart]);
  const scheduledDaysCount = useMemo(
    () => calendarCells.filter((cell) => cell.type === 'day' && cell.scheduled).length,
    [calendarCells]
  );
  const completedDaysCount = useMemo(
    () => calendarCells.filter((cell) => cell.type === 'day' && cell.scheduled && cell.completed).length,
    [calendarCells]
  );
  const selectedCalendarCell = useMemo(
    () =>
      calendarCells.find((cell) => cell.type === 'day' && cell.isoKey === selectedCalendarDate) ||
      null,
    [calendarCells, selectedCalendarDate]
  );
  const selectedCalendarDateLabel = useMemo(() => {
    if (!selectedCalendarDate) return '';
    const parsed = new Date(`${selectedCalendarDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return selectedCalendarDate;
    return parsed.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [selectedCalendarDate]);
  const activeWindowLabel =
    routineActivity?.windowStart && routineActivity?.windowEnd
      ? `${formatTimeFromDate(routineActivity.windowStart)} - ${formatTimeFromDate(
          routineActivity.windowEnd
        )}`
      : '';
  const nextStartLabel = routineActivity?.nextStartAt
    ? new Date(routineActivity.nextStartAt).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';

  if (!routine) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Routine not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[styles.navButton, { borderColor: themeColors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={18} color={themeColors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Routine Details</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.navButton, { borderColor: detailTheme.itemBorder }]}
              onPress={() => {
                const range = normalizeRoutineTimeRange(routine);
                const schedule = normalizeRoutineSchedule(routine);
                setEditRoutineName(routine?.name || '');
                setEditRoutineStartTime(range.startTime);
                setEditRoutineEndTime(range.endTime);
                setEditRoutineRepeat(schedule.repeat);
                setEditRoutineWeekDays(
                  schedule.repeat === ROUTINE_REPEAT.WEEKLY
                    ? normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.WEEKLY)
                    : []
                );
                setEditRoutineMonthDays(
                  schedule.repeat === ROUTINE_REPEAT.MONTHLY
                    ? normalizeRoutineDays(schedule.days, ROUTINE_REPEAT.MONTHLY).map((day) =>
                        Number(day)
                      )
                    : []
                );
                setRoutineTimePickerTarget(null);
                setShowEditModal(true);
              }}
            >
              <Ionicons name="create-outline" size={18} color={detailTheme.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.headerActionButton, { borderColor: detailTheme.itemBorder }]}
              onPress={handleDeleteRoutine}
            >
              <Ionicons name="trash-outline" size={18} color={detailTheme.accent} />
            </TouchableOpacity>
          </View>
        </View>

        <Card
          style={[
            styles.infoCard,
            { backgroundColor: detailTheme.card, borderColor: detailTheme.border },
          ]}
        >
          <Text style={[styles.infoTitle, { color: detailTheme.accent }]}>
            {routine.name}
          </Text>
          <Text style={[styles.infoMeta, { color: detailTheme.muted }]}>
            {formattedDate ? `Created ${formattedDate}` : 'Created date unavailable'}
          </Text>
          {groupName ? (
            <Text style={[styles.infoMeta, { color: detailTheme.muted }]}>
              Group: {groupName}
            </Text>
          ) : null}
          <Text style={[styles.infoMeta, { color: detailTheme.muted }]}>
            Schedule: {scheduleSummary}
          </Text>
          <View style={styles.infoStats}>
            <View style={styles.infoStat}>
              <Text style={[styles.infoStatLabel, { color: detailTheme.muted }]}>Tasks</Text>
              <Text style={[styles.infoStatValue, { color: themeColors.text }]}>
                {routine.tasks?.length || 0}
              </Text>
            </View>
            <View style={styles.infoStat}>
              <Text style={[styles.infoStatLabel, { color: detailTheme.muted }]}>
                Routine type
              </Text>
              <Text style={[styles.infoStatValue, { color: themeColors.text }]}>
                {isGroup ? 'Group' : 'Personal'}
              </Text>
            </View>
          </View>
        </Card>

        <Card
          style={[
            styles.activeCard,
            { backgroundColor: detailTheme.card, borderColor: detailTheme.border },
          ]}
        >
          <View style={styles.activeHeaderRow}>
            <Text style={[styles.activeTitle, { color: themeColors.text }]}>Routine Status</Text>
            <View
              style={[
                styles.activeBadge,
                {
                  backgroundColor: routineActivity?.isActive
                    ? `${themeColors.success}22`
                    : `${themeColors.textLight}26`,
                  borderColor: routineActivity?.isActive
                    ? `${themeColors.success}66`
                    : `${themeColors.textLight}55`,
                },
              ]}
            >
              <Text
                style={[
                  styles.activeBadgeText,
                  { color: routineActivity?.isActive ? themeColors.success : themeColors.textLight },
                ]}
              >
                {routineActivity?.isActive ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </View>

          {routineActivity?.isActive ? (
            <Text style={[styles.activeDescription, { color: detailTheme.muted }]}>
              This routine is active right now. Check every task, then complete the routine.
            </Text>
          ) : (
            <Text style={[styles.activeDescription, { color: detailTheme.muted }]}>
              {nextStartLabel
                ? `Next active window starts ${nextStartLabel}.`
                : 'No upcoming active window found with the current schedule and time range.'}
            </Text>
          )}
          {activeWindowLabel ? (
            <Text style={[styles.activeWindowText, { color: themeColors.textLight }]}>
              Window: {activeWindowLabel}
            </Text>
          ) : null}

          <View style={styles.activeChecklist}>
            {(routine.tasks || []).length ? (
              (routine.tasks || []).map((task, index) => {
                const taskId = String(task?.id || '');
                const checked = activeCheckedTaskIds.has(taskId);
                const disabled =
                  !routineActivity?.isActive || isRoutineCompletedForActiveDate || !taskId;
                return (
                  <TouchableOpacity
                    key={`active-task-${task?.id || index}`}
                    style={[
                      styles.activeTaskRow,
                      {
                        borderColor: detailTheme.itemBorder,
                        backgroundColor: detailTheme.itemBg,
                        opacity: disabled ? 0.75 : 1,
                      },
                    ]}
                    onPress={() => handleToggleRoutineTask(task.id)}
                    activeOpacity={0.85}
                    disabled={disabled}
                  >
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={checked ? themeColors.success : detailTheme.accent}
                    />
                    <Text style={[styles.activeTaskText, { color: themeColors.text }]}>
                      {task.name}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={[styles.activeTaskHint, { color: themeColors.textLight }]}>
                Add tasks to this routine to use guided active completion.
              </Text>
            )}
          </View>

          <Text style={[styles.activeProgressText, { color: themeColors.textLight }]}>
            Progress: {checkedTaskCount}/{activeTaskIds.length || 0} tasks checked
          </Text>
          {isRoutineCompletedForActiveDate ? (
            <Text style={[styles.activeDoneText, { color: themeColors.success }]}>
              Routine completed for this active window.
            </Text>
          ) : null}
          <Button
            title={isRoutineCompletedForActiveDate ? 'Routine Completed' : 'Complete Routine'}
            onPress={handleCompleteRoutineNow}
            disabled={!canCompleteRoutineNow}
            style={styles.completeRoutineButton}
          />
        </Card>

        <Card
          style={[
            styles.tasksCard,
            { backgroundColor: detailTheme.card, borderColor: detailTheme.border },
          ]}
        >
          <View style={styles.tasksHeader}>
            <Text style={[styles.tasksTitle, { color: themeColors.text }]}>Tasks</Text>
            <TouchableOpacity
              style={[styles.addTaskButton, { backgroundColor: detailTheme.actionBg }]}
              onPress={() => setShowTaskModal(true)}
            >
              <Ionicons name="add" size={16} color={detailTheme.actionText} />
              <Text style={[styles.addTaskText, { color: detailTheme.actionText }]}>
                Add Task
              </Text>
            </TouchableOpacity>
          </View>

          {routine.tasks?.length ? (
            routine.tasks.map((task, index) => (
              <View
                key={task.id || `${task.name}-${index}`}
                style={[
                  styles.taskRow,
                  {
                    backgroundColor: detailTheme.itemBg,
                    borderColor: detailTheme.itemBorder,
                  },
                ]}
              >
                <View style={styles.taskOrderControls}>
                  <TouchableOpacity
                    style={[styles.orderButton, { borderColor: detailTheme.itemBorder }]}
                    onPress={() => handleMoveTask(index, -1)}
                    disabled={index === 0}
                  >
                    <Ionicons
                      name="chevron-up"
                      size={16}
                      color={index === 0 ? themeColors.textLight : detailTheme.accent}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.orderButton, { borderColor: detailTheme.itemBorder }]}
                    onPress={() => handleMoveTask(index, 1)}
                    disabled={index === routine.tasks.length - 1}
                  >
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={
                        index === routine.tasks.length - 1
                          ? themeColors.textLight
                          : detailTheme.accent
                      }
                    />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.taskText, { color: themeColors.text }]}>
                  {task.name}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveTask(task.id)}>
                  <Ionicons name="close" size={18} color={themeColors.textLight} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.emptyTaskText}>No tasks yet. Add your first one.</Text>
          )}
        </Card>

        <Card
          style={[
            styles.calendarCard,
            { backgroundColor: detailTheme.card, borderColor: detailTheme.border },
          ]}
        >
          <View style={styles.calendarHeader}>
            <Text style={[styles.calendarTitle, { color: themeColors.text }]}>Routine Calendar</Text>
            <View style={styles.calendarNav}>
              <TouchableOpacity
                style={[styles.calendarNavBtn, { borderColor: detailTheme.itemBorder }]}
                onPress={() => shiftCalendarMonth(-1)}
              >
                <Ionicons name="chevron-back" size={16} color={themeColors.text} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthText, { color: themeColors.text }]}>
                {calendarMonthAnchor.toLocaleDateString(undefined, {
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <TouchableOpacity
                style={[styles.calendarNavBtn, { borderColor: detailTheme.itemBorder }]}
                onPress={() => shiftCalendarMonth(1)}
              >
                <Ionicons name="chevron-forward" size={16} color={themeColors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.calendarMeta, { color: themeColors.textSecondary }]}>
            {completedDaysCount}/{scheduledDaysCount} scheduled days completed this month
          </Text>

          <View style={styles.calendarWeekRow}>
            {CALENDAR_WEEK_LABELS.map((day, index) => (
              <Text
                key={`routine-calendar-week-${day}-${index}`}
                style={[styles.calendarWeekDayText, { color: themeColors.textLight }]}
              >
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarCells.map((cell) => {
              if (cell.type === 'spacer') {
                return <View key={cell.key} style={styles.calendarCell} />;
              }
              const selected = cell.isoKey === selectedCalendarDate;
              const backgroundColor = !cell.scheduled
                ? themeColors.inputBackground
                : cell.completed
                ? `${themeColors.success}CC`
                : cell.missed
                ? `${themeColors.danger}CC`
                : `${themeColors.warning}CC`;
              const borderColor = selected
                ? themeColors.primary
                : !cell.scheduled
                ? themeColors.border
                : backgroundColor;

              return (
                <TouchableOpacity
                  key={cell.key}
                  style={styles.calendarCell}
                  activeOpacity={0.85}
                  onPress={() => setSelectedCalendarDate(cell.isoKey)}
                >
                  <View
                    style={[
                      styles.calendarDot,
                      {
                        backgroundColor,
                        borderColor,
                        borderWidth: selected ? 2 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.calendarDotText, { color: cell.scheduled ? '#FFFFFF' : themeColors.text }]}>
                      {cell.day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.calendarSelectedCard,
              {
                borderColor: detailTheme.itemBorder,
                backgroundColor: detailTheme.itemBg,
              },
            ]}
          >
            <Text style={[styles.calendarSelectedTitle, { color: themeColors.text }]}>
              {selectedCalendarDateLabel || 'Select a day'}
            </Text>
            {selectedCalendarCell ? (
              <Text style={[styles.calendarSelectedMeta, { color: themeColors.textSecondary }]}>
                {!selectedCalendarCell.scheduled
                  ? 'Not a scheduled routine day.'
                  : selectedCalendarCell.completed
                  ? 'Completed.'
                  : selectedCalendarCell.isFuture
                  ? 'Scheduled.'
                  : 'Not completed.'}
              </Text>
            ) : (
              <Text style={[styles.calendarSelectedMeta, { color: themeColors.textSecondary }]}>
                Select a day to view status.
              </Text>
            )}
          </View>
        </Card>
      </PlatformScrollView>

      <Modal
        visible={showEditModal}
        onClose={closeEditModal}
        title="Edit Routine"
      >
        <Input
          label="Routine Name"
          value={editRoutineName}
          onChangeText={setEditRoutineName}
          placeholder="e.g., Morning Routine"
        />
        <Text style={[styles.editLabel, { color: themeColors.text }]}>Time range</Text>
        <Text style={[styles.editHint, { color: themeColors.textLight }]}>
          Set when this routine starts and ends.
        </Text>
        <View style={styles.rangeRow}>
          <TouchableOpacity
            style={[styles.timeButton, { borderColor: themeColors.border }]}
            onPress={() => openRoutineTimePicker('start')}
            activeOpacity={0.85}
          >
            <Text style={[styles.timeButtonLabel, { color: themeColors.textLight }]}>Start</Text>
            <Text style={[styles.timeButtonValue, !editRoutineStartTime && styles.timeButtonPlaceholder]}>
              {editRoutineStartTime || 'Select time'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeButton, styles.timeButtonLast, { borderColor: themeColors.border }]}
            onPress={() => openRoutineTimePicker('end')}
            activeOpacity={0.85}
          >
            <Text style={[styles.timeButtonLabel, { color: themeColors.textLight }]}>End</Text>
            <Text style={[styles.timeButtonValue, !editRoutineEndTime && styles.timeButtonPlaceholder]}>
              {editRoutineEndTime || 'Select time'}
            </Text>
          </TouchableOpacity>
        </View>
        {editRoutineStartTime && editRoutineEndTime ? (
          <Text style={[styles.rangePreview, { color: themeColors.textLight }]}>
            {formatRoutineScheduleSummary({
              startTime: editRoutineStartTime,
              endTime: editRoutineEndTime,
              repeat: editRoutineRepeat,
              days: editRoutineSelectedDays,
            })}
          </Text>
        ) : null}

        <Text style={[styles.editLabel, { color: themeColors.text }]}>Routine days</Text>
        <Text style={[styles.editHint, { color: themeColors.textLight }]}>
          Choose whether this routine runs daily, on specific weekdays, or on specific month days.
        </Text>
        <ChipGroup
          options={ROUTINE_REPEAT_OPTIONS}
          selectedValue={editRoutineRepeat}
          onSelect={handleEditRoutineRepeatSelect}
          style={styles.scheduleChipGroup}
          color={detailTheme.accent}
        />
        {editRoutineRepeat === ROUTINE_REPEAT.WEEKLY ? (
          <View style={styles.scheduleChipWrap}>
            {ROUTINE_WEEKDAY_LABELS.map((dayLabel) => {
              const selected = editRoutineWeekDays.includes(dayLabel);
              return (
                <TouchableOpacity
                  key={`edit-weekday-${dayLabel}`}
                  style={[
                    styles.scheduleChip,
                    {
                      borderColor: selected ? detailTheme.accent : themeColors.border,
                      backgroundColor: selected ? detailTheme.actionBg : 'transparent',
                    },
                  ]}
                  onPress={() => toggleEditRoutineWeekDay(dayLabel)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.scheduleChipText,
                      { color: selected ? detailTheme.accent : themeColors.textLight },
                    ]}
                  >
                    {dayLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {editRoutineRepeat === ROUTINE_REPEAT.MONTHLY ? (
          <View style={styles.scheduleChipWrap}>
            {ROUTINE_MONTH_DAY_OPTIONS.map((day) => {
              const dayLabel = String(day);
              const selected = editRoutineMonthDays
                .map((value) => String(value))
                .includes(dayLabel);
              return (
                <TouchableOpacity
                  key={`edit-month-day-${day}`}
                  style={[
                    styles.scheduleChip,
                    {
                      borderColor: selected ? detailTheme.accent : themeColors.border,
                      backgroundColor: selected ? detailTheme.actionBg : 'transparent',
                    },
                  ]}
                  onPress={() => toggleEditRoutineMonthDay(day)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.scheduleChipText,
                      { color: selected ? detailTheme.accent : themeColors.textLight },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {!isEditRoutineScheduleSelectionValid ? (
          <Text style={[styles.scheduleValidationHint, { color: themeColors.danger }]}>
            {editRoutineRepeat === ROUTINE_REPEAT.MONTHLY
              ? 'Select at least one day of the month.'
              : 'Select at least one weekday.'}
          </Text>
        ) : null}

        <Text style={[styles.editLabel, { color: themeColors.text }]}>Quick start times</Text>
        <View style={styles.timeChipWrap}>
          {QUICK_ROUTINE_TIMES.map((time) => {
            const normalizedQuickTime = normalizeRoutineTimeValue(time);
            const selected = editRoutineStartTime === normalizedQuickTime;
            return (
              <TouchableOpacity
                key={time}
                style={[
                  styles.timeChip,
                  {
                    borderColor: selected ? detailTheme.accent : themeColors.border,
                    backgroundColor: selected ? detailTheme.actionBg : 'transparent',
                  },
                ]}
                onPress={() => handleQuickRoutineTime(normalizedQuickTime, 'start')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    { color: selected ? detailTheme.accent : themeColors.textLight },
                  ]}
                >
                  {normalizedQuickTime}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.editLabel, { color: themeColors.text }]}>Quick end times</Text>
        <View style={styles.timeChipWrap}>
          {QUICK_ROUTINE_TIMES.map((time) => {
            const normalizedQuickTime = normalizeRoutineTimeValue(time);
            const selected = editRoutineEndTime === normalizedQuickTime;
            return (
              <TouchableOpacity
                key={`end-${time}`}
                style={[
                  styles.timeChip,
                  {
                    borderColor: selected ? detailTheme.accent : themeColors.border,
                    backgroundColor: selected ? detailTheme.actionBg : 'transparent',
                  },
                ]}
                onPress={() => handleQuickRoutineTime(normalizedQuickTime, 'end')}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.timeChipText,
                    { color: selected ? detailTheme.accent : themeColors.textLight },
                  ]}
                >
                  {normalizedQuickTime}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={closeEditModal}
            style={styles.modalButton}
          />
          <Button
            title="Save"
            onPress={handleSaveRoutine}
            disabled={
              !editRoutineName.trim() ||
              !editRoutineStartTime ||
              !editRoutineEndTime ||
              !isEditRoutineScheduleSelectionValid
            }
            style={styles.modalButton}
          />
        </View>
      </Modal>

      <PlatformTimePicker
        visible={showRoutineTimePicker}
        value={routineTimePickerTarget === 'end' ? editRoutineEndTime : editRoutineStartTime}
        onChange={handleSelectRoutineTime}
        onClose={() => {
          setShowRoutineTimePicker(false);
          setRoutineTimePickerTarget(null);
        }}
        accentColor={detailTheme.accent}
      />

      <Modal
        visible={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setTaskName('');
        }}
        title="Add Task"
      >
        <Input
          label="Task Name"
          value={taskName}
          onChangeText={setTaskName}
          placeholder="e.g., Brush teeth"
        />
        <View style={styles.modalButtons}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={() => {
              setShowTaskModal(false);
              setTaskName('');
            }}
            style={styles.modalButton}
          />
          <Button
            title="Add"
            onPress={handleAddTask}
            disabled={!taskName.trim()}
            style={styles.modalButton}
          />
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (themeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    ...typography.h3,
    color: themeColors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    marginLeft: spacing.sm,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  infoTitle: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  infoMeta: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  infoStats: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  infoStat: {
    flex: 1,
  },
  infoStatLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  infoStatValue: {
    ...typography.body,
    fontWeight: '600',
  },
  activeCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  activeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  activeTitle: {
    ...typography.h3,
  },
  activeBadge: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  activeBadgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  activeDescription: {
    ...typography.bodySmall,
    marginBottom: spacing.xs,
  },
  activeWindowText: {
    ...typography.caption,
    marginBottom: spacing.sm,
  },
  activeChecklist: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  activeTaskRow: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeTaskText: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
    flex: 1,
  },
  activeTaskHint: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  activeProgressText: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  activeDoneText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  completeRoutineButton: {
    marginTop: spacing.xs,
  },
  tasksCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  tasksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  tasksTitle: {
    ...typography.h3,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
  },
  addTaskText: {
    ...typography.bodySmall,
    fontWeight: '600',
    marginLeft: spacing.xs,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  taskOrderControls: {
    marginRight: spacing.sm,
    alignItems: 'center',
  },
  orderButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginVertical: 2,
  },
  taskText: {
    flex: 1,
    ...typography.body,
  },
  emptyTaskText: {
    ...typography.bodySmall,
    color: themeColors.textLight,
  },
  calendarCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  calendarTitle: {
    ...typography.h3,
  },
  calendarNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarNavBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthText: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginHorizontal: spacing.sm,
  },
  calendarMeta: {
    ...typography.caption,
    marginBottom: spacing.sm,
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
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDotText: {
    ...typography.caption,
    fontWeight: '700',
  },
  calendarSelectedCard: {
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.md,
  },
  calendarSelectedTitle: {
    ...typography.bodySmall,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  calendarSelectedMeta: {
    ...typography.bodySmall,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  editLabel: {
    ...typography.label,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  editHint: {
    ...typography.bodySmall,
    marginBottom: spacing.sm,
  },
  rangeRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
  },
  timeButtonLast: {
    marginRight: 0,
  },
  timeButtonLabel: {
    ...typography.caption,
    marginBottom: 2,
  },
  timeButtonValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: themeColors.text,
  },
  timeButtonPlaceholder: {
    color: themeColors.placeholder,
  },
  rangePreview: {
    ...typography.bodySmall,
    marginBottom: spacing.md,
  },
  scheduleChipGroup: {
    marginBottom: spacing.md,
  },
  scheduleChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  scheduleChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  scheduleChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  scheduleValidationHint: {
    ...typography.caption,
    marginBottom: spacing.md,
    marginTop: -spacing.sm,
  },
  timeChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  timeChip: {
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  timeChipText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    ...typography.h3,
    color: themeColors.text,
    marginBottom: spacing.md,
  },
});

export default RoutineDetailScreen;
