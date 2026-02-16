
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  TextInput,
  Switch,
  Modal as RNModal,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import {
  Card,
  Modal,
  ChipGroup,
  PlatformScrollView,
  PlatformTimePicker,
  PlatformDatePicker,
} from '../components';
import { colors, borderRadius, spacing, typography, shadows, habitCategories } from '../utils/theme';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_RANGE_OPTIONS = [
  { label: 'All Day', value: 'all_day' },
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
];
const GOAL_PERIOD_OPTIONS = [
  { label: 'Day-Long', value: 'day' },
  { label: 'Week-Long', value: 'week' },
  { label: 'Month-Long', value: 'month' },
];
const HABIT_COLOR_OPTIONS = [
  '#9B59B6',
  '#3B82F6',
  '#10B981',
  '#F97316',
  '#EF4444',
  '#14B8A6',
  '#E11D48',
  '#8B5CF6',
];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const toISODate = (date) => (date instanceof Date ? date : new Date(date || Date.now())).toISOString().slice(0, 10);
const toDateKey = (date) => (date instanceof Date ? date : new Date(date || Date.now())).toDateString();
const addDays = (date, amount) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};
const isSameDay = (a, b) => toDateKey(a) === toDateKey(b);
const parseNumber = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};
const withAlpha = (hexColor, alpha = 0.15) => {
  if (!hexColor || typeof hexColor !== 'string') return `rgba(155,89,182,${alpha})`;
  const clean = hexColor.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  if (full.length !== 6) return `rgba(155,89,182,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
};
const shadeColor = (hexColor, amount = 0) => {
  const clean = (hexColor || '#9B59B6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const base = full.length === 6 ? full : '9B59B6';
  const toChannel = (index) => {
    const raw = parseInt(base.slice(index, index + 2), 16);
    const next = Math.round(raw + amount * 255);
    return clamp(next, 0, 255);
  };
  const r = toChannel(0).toString(16).padStart(2, '0');
  const g = toChannel(2).toString(16).padStart(2, '0');
  const b = toChannel(4).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
};
const getReadableTextColor = (hexColor) => {
  const clean = (hexColor || '#9B59B6').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => `${ch}${ch}`).join('') : clean;
  const base = full.length === 6 ? full : '9B59B6';
  const toLinear = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const r = parseInt(base.slice(0, 2), 16);
  const g = parseInt(base.slice(2, 4), 16);
  const b = parseInt(base.slice(4, 6), 16);
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance < 0.43 ? '#F8FAFC' : '#111827';
};

const withDefaults = (habit) => ({
  ...habit,
  habitType: habit?.habitType || 'build',
  goalPeriod: habit?.goalPeriod || 'day',
  goalValue: parseNumber(habit?.goalValue, 1) || 1,
  goalUnit: habit?.goalUnit || 'times',
  timeRange: habit?.timeRange || 'all_day',
  taskDaysMode: habit?.taskDaysMode || 'every_day',
  taskDaysCount: parseNumber(habit?.taskDaysCount, 3),
  monthDays: Array.isArray(habit?.monthDays) ? habit.monthDays : [],
  remindersEnabled: Boolean(habit?.remindersEnabled),
  reminderTimes: Array.isArray(habit?.reminderTimes) ? habit.reminderTimes : [],
  reminderMessage: habit?.reminderMessage || '',
  showMemoAfterCompletion: Boolean(habit?.showMemoAfterCompletion),
  chartType: habit?.chartType || 'bar',
  startDate: habit?.startDate || toISODate(new Date()),
  endDate: habit?.endDate || null,
  color: habit?.color || habit?.habitColor || colors.habits,
});

const getGoalValue = (habit) => Math.max(1, parseNumber(habit?.goalValue, 1));

const getDateProgressAmount = (habit, dateKey, localMap) => {
  const key = `${habit.id}|${dateKey}`;
  if (Object.prototype.hasOwnProperty.call(localMap, key)) {
    return parseNumber(localMap[key], 0);
  }
  const map = habit.progressByDate || {};
  if (Object.prototype.hasOwnProperty.call(map, dateKey)) return parseNumber(map[dateKey], 0);
  if ((habit.completedDates || []).includes(dateKey)) return getGoalValue(habit);
  return 0;
};

const getCompletionRatio = (habit, amount) => {
  const goal = getGoalValue(habit);
  if ((habit?.habitType || 'build') === 'quit') {
    if (amount <= 0) return 0;
    if (amount <= goal) return 1;
    return clamp(1 - (amount - goal) / goal, 0, 1);
  }
  return clamp(amount / goal, 0, 1);
};

const isCompletedForDate = (habit, dateKey, amount) => {
  if ((habit.completedDates || []).includes(dateKey)) return true;
  if ((habit?.habitType || 'build') === 'quit') {
    return amount > 0 && amount <= getGoalValue(habit);
  }
  return amount >= getGoalValue(habit);
};

const formatTaskDaysSummary = ({ taskDaysMode, taskDaysCount, days, monthDays }) => {
  if (taskDaysMode === 'specific_weekdays') return days.length ? days.join(' ') : 'Select weekdays';
  if (taskDaysMode === 'days_per_week') return `${taskDaysCount} days/week`;
  if (taskDaysMode === 'specific_month_days')
    return monthDays.length ? monthDays.slice().sort((a, b) => a - b).join(', ') : 'Select days';
  if (taskDaysMode === 'days_per_month') return `${taskDaysCount} days/month`;
  return 'Every day';
};
const computeBestStreakFromDateKeys = (dateKeys = []) => {
  const dayNumbers = Array.from(
    new Set(
      (dateKeys || [])
        .map((value) => new Date(value))
        .filter((date) => !Number.isNaN(date.getTime()))
        .map((date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000))
    )
  ).sort((a, b) => a - b);

  if (!dayNumbers.length) return 0;

  let best = 1;
  let current = 1;
  for (let index = 1; index < dayNumbers.length; index += 1) {
    if (dayNumbers[index] - dayNumbers[index - 1] === 1) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
};

const SwipeHabitCard = ({
  habit,
  progress,
  ratio,
  completed,
  isInteractive,
  onTap,
  onEdit,
  onSkip,
  onReset,
  onSwipeAdd,
  onSwipeInteractionChange,
  styles,
  palette,
}) => {
  const ACTION_RAIL_WIDTH = 228;
  const FILL_SWIPE_DISTANCE = 165;
  const { width: windowWidth } = useWindowDimensions();
  const rowWidth = Math.max(1, windowWidth - spacing.lg * 2);
  const translateX = useRef(new Animated.Value(0)).current;
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dragFillRatio, setDragFillRatio] = useState(0);
  const dragFillRatioRef = useRef(0);
  const swipeActiveRef = useRef(false);
  const fillRafRef = useRef(null);
  const fillResetTimeoutRef = useRef(null);

  const flushDragFillToState = useCallback(() => {
    if (fillRafRef.current !== null) {
      cancelAnimationFrame(fillRafRef.current);
      fillRafRef.current = null;
    }
    setDragFillRatio(dragFillRatioRef.current);
  }, []);

  const setDragFillPreview = useCallback((next, { instant = false } = {}) => {
    if (fillResetTimeoutRef.current) {
      clearTimeout(fillResetTimeoutRef.current);
      fillResetTimeoutRef.current = null;
    }
    const clamped = clamp(next, 0, 1);
    const previous = dragFillRatioRef.current;
    const eased = instant ? clamped : previous + (clamped - previous) * 0.42;
    if (!instant && Math.abs(eased - previous) < 0.0015) return;
    dragFillRatioRef.current = eased;

    if (instant) {
      flushDragFillToState();
      return;
    }

    if (fillRafRef.current !== null) return;
    fillRafRef.current = requestAnimationFrame(() => {
      fillRafRef.current = null;
      setDragFillRatio(dragFillRatioRef.current);
    });
  }, [flushDragFillToState]);

  const clearDragFillPreview = useCallback(({ deferMs = 0 } = {}) => {
    if (fillResetTimeoutRef.current) {
      clearTimeout(fillResetTimeoutRef.current);
      fillResetTimeoutRef.current = null;
    }

    const clearNow = () => {
      dragFillRatioRef.current = 0;
      flushDragFillToState();
    };

    if (deferMs > 0) {
      fillResetTimeoutRef.current = setTimeout(clearNow, deferMs);
      return;
    }

    clearNow();
  }, [flushDragFillToState]);

  const setSwipeInteractionActive = useCallback(
    (active) => {
      if (swipeActiveRef.current === active) return;
      swipeActiveRef.current = active;
      if (typeof onSwipeInteractionChange === 'function') {
        onSwipeInteractionChange(active);
      }
    },
    [onSwipeInteractionChange]
  );

  useEffect(
    () => () => {
      if (fillResetTimeoutRef.current) {
        clearTimeout(fillResetTimeoutRef.current);
        fillResetTimeoutRef.current = null;
      }
      if (fillRafRef.current !== null) {
        cancelAnimationFrame(fillRafRef.current);
        fillRafRef.current = null;
      }
      setSwipeInteractionActive(false);
    },
    [setSwipeInteractionActive]
  );

  const closeActions = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start(() => setActionsOpen(false));
  }, [translateX]);

  const openActions = useCallback(() => {
    Animated.spring(translateX, {
      toValue: -ACTION_RAIL_WIDTH,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start(() => setActionsOpen(true));
  }, [ACTION_RAIL_WIDTH, translateX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          isInteractive && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 7,
        onPanResponderGrant: () => {
          if (!isInteractive) return;
          setSwipeInteractionActive(true);
        },
        onPanResponderMove: (_, g) => {
          if (!isInteractive) return;

          if (actionsOpen) {
            clearDragFillPreview();
            if (g.dx >= 0) {
              translateX.setValue(clamp(-ACTION_RAIL_WIDTH + g.dx, -ACTION_RAIL_WIDTH, 0));
            } else {
              translateX.setValue(-ACTION_RAIL_WIDTH);
            }
            return;
          }

          if (g.dx < 0) {
            clearDragFillPreview();
            translateX.setValue(clamp(g.dx, -ACTION_RAIL_WIDTH, 0));
            return;
          }

          // Right swipe should fill progress only; card stays in place.
          translateX.setValue(0);
          setDragFillPreview(g.dx / FILL_SWIPE_DISTANCE);
        },
        onPanResponderRelease: (_, g) => {
          setSwipeInteractionActive(false);
          if (!isInteractive) {
            clearDragFillPreview();
            closeActions();
            return;
          }

          if (actionsOpen) {
            clearDragFillPreview();
            const shouldClose = g.dx > 32 || g.vx > 0.35;
            if (shouldClose) {
              closeActions();
            } else {
              openActions();
            }
            return;
          }

          if (g.dx < 0) {
            clearDragFillPreview();
            const shouldOpen = g.dx < -42 || g.vx < -0.35;
            if (shouldOpen) {
              openActions();
            } else {
              closeActions();
            }
            return;
          }

          if (g.dx >= 12) {
            const swipeRatio = clamp(
              Math.max(dragFillRatioRef.current, g.dx / FILL_SWIPE_DISTANCE),
              0,
              1
            );
            if (swipeRatio < 0.03) {
              closeActions();
              return;
            }
            const targetRatio = Math.max(ratio, swipeRatio);
            setDragFillPreview(targetRatio, { instant: true });
            onSwipeAdd(habit, Math.max(1, Math.round(getGoalValue(habit) * targetRatio)));
            clearDragFillPreview({ deferMs: 120 });
            closeActions();
            return;
          }

          clearDragFillPreview();
          closeActions();
        },
        onPanResponderTerminate: () => {
          setSwipeInteractionActive(false);
          clearDragFillPreview();
          if (actionsOpen) {
            openActions();
          } else {
            closeActions();
          }
        },
      }),
    [
      ACTION_RAIL_WIDTH,
      FILL_SWIPE_DISTANCE,
      actionsOpen,
      clearDragFillPreview,
      closeActions,
      dragFillRatioRef,
      habit,
      isInteractive,
      onSwipeAdd,
      setSwipeInteractionActive,
      openActions,
      ratio,
      setDragFillPreview,
      translateX,
    ]
  );

  const displayRatio = clamp(Math.max(ratio, dragFillRatio), 0, 1);
  const fillWidth = rowWidth * displayRatio;
  const habitColor = habit.color || palette.habits;
  const tintedTrack = withAlpha(habitColor, 0.16);
  const tintedSurface = withAlpha(habitColor, completed ? 0.18 : 0.1);
  const habitTextColor = getReadableTextColor(habitColor);
  const habitSubTextColor = withAlpha(habitTextColor, 0.8);
  const habitHintColor = withAlpha(habitTextColor, 0.72);

  return (
    <View style={styles.swipeRow}>
      <Animated.View
        style={[
          styles.swipeTrack,
          {
            width: rowWidth + ACTION_RAIL_WIDTH,
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.habitWrapper, { width: rowWidth }]}>
          <View style={[styles.fillTrack, { backgroundColor: tintedTrack }]}>
            <View style={[styles.fillValue, { width: fillWidth, backgroundColor: habitColor }]} />
          </View>
          <TouchableOpacity
            style={[
              styles.habitCard,
              {
                borderColor: habitColor,
                backgroundColor: tintedSurface,
                opacity: isInteractive ? 1 : 0.78,
              },
            ]}
            onPress={() => {
              if (actionsOpen) {
                closeActions();
                return;
              }
              onTap(habit);
            }}
            activeOpacity={0.9}
          >
            <View style={styles.habitRow}>
              <View style={[styles.habitAvatar, { backgroundColor: withAlpha(habitColor, 0.2) }]}>
                <Text style={[styles.habitAvatarText, { color: habitTextColor }]}>
                  {habit.title?.slice(0, 1)?.toUpperCase() || 'H'}
                </Text>
              </View>
              <View style={styles.habitInfo}>
                <Text style={[styles.habitTitle, { color: habitTextColor }]} numberOfLines={1}>{habit.title}</Text>
                <Text style={[styles.habitMeta, { color: habitSubTextColor }]}>
                  {Math.round(progress)} / {getGoalValue(habit)} {habit.goalUnit || 'times'}
                </Text>
              </View>
              <View style={[styles.progressBadge, { borderColor: habitColor }]}>
                <Text style={[styles.progressBadgeText, { color: habitColor }]}>
                  {Math.round(ratio * 100)}%
                </Text>
              </View>
            </View>
            <Text style={[styles.habitHint, { color: habitHintColor }]}>
              Swipe right to add progress - Swipe left for actions - Tap for exact amount
            </Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.actionRailInline, { width: ACTION_RAIL_WIDTH }]}>
          <TouchableOpacity style={[styles.actionTile, styles.actionTileEdit]} onPress={() => { closeActions(); onEdit(habit); }}>
            <Feather name="edit-2" size={17} color="#2D6BFF" />
            <Text style={[styles.actionText, { color: '#2D6BFF' }]}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionTile, styles.actionTileSkip]} onPress={() => { closeActions(); onSkip(habit); }}>
            <Ionicons name="play-skip-forward" size={17} color="#FF8A1F" />
            <Text style={[styles.actionText, { color: '#FF8A1F' }]}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionTile, styles.actionTileReset]} onPress={() => { closeActions(); onReset(habit); }}>
            <Ionicons name="refresh" size={17} color="#16A34A" />
            <Text style={[styles.actionText, { color: '#16A34A' }]}>Reset</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const HabitsScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    habits,
    addHabit,
    addGroupHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    toggleGroupHabitCompletion,
    getBestStreak,
    isHabitCompletedToday,
    groups,
    groupHabits,
    groupHabitCompletions,
    authUser,
    themeName,
    themeColors,
    ensureHabitsLoaded,
    setHabitProgress,
  } = useApp();

  const isDark = themeName === 'dark';
  const palette = useMemo(
    () => ({
      habits: themeColors?.habits || colors.habits,
      success: themeColors?.success || colors.success,
      card: isDark ? '#1F1A2D' : '#FFFFFF',
      cardBorder: isDark ? '#3C3551' : '#E8DDF7',
      fillTrack: isDark ? '#2D2540' : '#F3EDFA',
      text: themeColors?.text || colors.text,
      textMuted: themeColors?.textSecondary || colors.textSecondary,
      textLight: themeColors?.textLight || colors.textLight,
      background: isDark ? '#120F1B' : '#F6F2FB',
      mutedSurface: isDark ? '#1A1626' : '#F8F4FC',
      switchTrack: isDark ? '#483A63' : '#E5D8F5',
    }),
    [isDark, themeColors]
  );
  const styles = useMemo(() => createStyles(palette), [palette]);

  useEffect(() => {
    ensureHabitsLoaded();
  }, [ensureHabitsLoaded]);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTimeRange, setSelectedTimeRange] = useState('all_day');
  const [localProgressMap, setLocalProgressMap] = useState({});
  const [isHabitSwipeActive, setIsHabitSwipeActive] = useState(false);
  const [isDateStripInteracting, setIsDateStripInteracting] = useState(false);

  const [activeHabitId, setActiveHabitId] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAmount, setManualAmount] = useState('');
  const [manualAutoComplete, setManualAutoComplete] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [isEditingHabit, setIsEditingHabit] = useState(false);

  const [showGoalPeriodSheet, setShowGoalPeriodSheet] = useState(false);
  const [showTaskDaysSheet, setShowTaskDaysSheet] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [editingReminderTimeIndex, setEditingReminderTimeIndex] = useState(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const [habitTitle, setHabitTitle] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitCategory, setHabitCategory] = useState('Personal');
  const [habitGroupId, setHabitGroupId] = useState(null);
  const [habitType, setHabitType] = useState('build');
  const [habitColor, setHabitColor] = useState(colors.habits);
  const [goalPeriod, setGoalPeriod] = useState('day');
  const [goalValueInput, setGoalValueInput] = useState('1');
  const [goalUnit, setGoalUnit] = useState('times');
  const [taskDaysMode, setTaskDaysMode] = useState('every_day');
  const [taskDaysCount, setTaskDaysCount] = useState(3);
  const [selectedDays, setSelectedDays] = useState(DAYS);
  const [selectedMonthDays, setSelectedMonthDays] = useState([new Date().getDate()]);
  const [timeRange, setTimeRange] = useState('all_day');
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [reminderTimes, setReminderTimes] = useState([]);
  const [reminderMessage, setReminderMessage] = useState('');
  const [showMemoAfterCompletion, setShowMemoAfterCompletion] = useState(false);
  const [chartType, setChartType] = useState('bar');
  const [startDate, setStartDate] = useState(toISODate(new Date()));
  const [endDate, setEndDate] = useState(null);

  const [monthAnchor, setMonthAnchor] = useState(new Date());

  const selectedDateKey = toDateKey(selectedDate);
  const selectedDateISO = toISODate(selectedDate);
  const isSelectedDateToday = isSameDay(selectedDate, new Date());
  const dateStrip = useMemo(() => Array.from({ length: 14 }, (_, index) => addDays(new Date(), index - 6)), []);

  const habitsWithDefaults = useMemo(() => (habits || []).map(withDefaults), [habits]);
  const selectedHabit = useMemo(
    () => habitsWithDefaults.find((habit) => habit.id === activeHabitId) || null,
    [activeHabitId, habitsWithDefaults]
  );
  const selectedHabitColor = selectedHabit?.color || palette.habits;
  const detailCardColor = useMemo(
    () => shadeColor(selectedHabitColor, -0.4),
    [selectedHabitColor]
  );
  const selectedHabitAmount = selectedHabit
    ? getDateProgressAmount(selectedHabit, selectedDateKey, localProgressMap)
    : 0;
  const selectedHabitRatio = selectedHabit
    ? getCompletionRatio(selectedHabit, selectedHabitAmount)
    : 0;
  const selectedHabitPercent = Math.round(selectedHabitRatio * 100);
  const selectedHabitGoalValue = selectedHabit ? getGoalValue(selectedHabit) : 1;
  const selectedHabitCompletions = selectedHabit?.completedDates?.length || 0;
  const selectedHabitBestStreak = useMemo(
    () => computeBestStreakFromDateKeys(selectedHabit?.completedDates || []),
    [selectedHabit?.completedDates]
  );
  const selectedHabitGoalsThisMonth = useMemo(() => {
    if (!selectedHabit) return 0;
    return (selectedHabit.completedDates || []).filter((key) => {
      const date = new Date(key);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === monthAnchor.getFullYear() &&
        date.getMonth() === monthAnchor.getMonth()
      );
    }).length;
  }, [monthAnchor, selectedHabit]);
  const selectedHabitCompletedForDate = selectedHabit
    ? isCompletedForDate(selectedHabit, selectedDateKey, selectedHabitAmount)
    : false;
  const selectedDatePrimaryLabel = isSameDay(selectedDate, new Date())
    ? 'Today'
    : selectedDate.toLocaleDateString(undefined, { weekday: 'short' });
  const selectedDateSecondaryLabel = selectedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const categoryOptions = useMemo(() => {
    const values = new Set(habitsWithDefaults.map((habit) => habit.category || 'Personal'));
    return ['All', ...Array.from(values)];
  }, [habitsWithDefaults]);

  const filteredHabits = useMemo(
    () =>
      habitsWithDefaults
        .filter((habit) => (selectedCategory === 'All' ? true : (habit.category || 'Personal') === selectedCategory))
        .filter((habit) => (selectedTimeRange === 'all_day' ? true : habit.timeRange === selectedTimeRange))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)),
    [habitsWithDefaults, selectedCategory, selectedTimeRange]
  );

  const completedCount = useMemo(
    () =>
      filteredHabits.filter((habit) => {
        const amount = getDateProgressAmount(habit, selectedDateKey, localProgressMap);
        return isCompletedForDate(habit, selectedDateKey, amount);
      }).length,
    [filteredHabits, selectedDateKey, localProgressMap]
  );

  const resetForm = () => {
    setHabitTitle('');
    setHabitDescription('');
    setHabitCategory('Personal');
    setHabitGroupId(null);
    setHabitType('build');
    setHabitColor(palette.habits);
    setGoalPeriod('day');
    setGoalValueInput('1');
    setGoalUnit('times');
    setTaskDaysMode('every_day');
    setTaskDaysCount(3);
    setSelectedDays(DAYS);
    setSelectedMonthDays([new Date().getDate()]);
    setTimeRange('all_day');
    setRemindersEnabled(false);
    setReminderTimes([]);
    setReminderMessage('');
    setShowMemoAfterCompletion(false);
    setChartType('bar');
    setStartDate(toISODate(new Date()));
    setEndDate(null);
    setIsEditingHabit(false);
  };

  const fillFormFromHabit = (habit) => {
    setHabitTitle(habit.title || '');
    setHabitDescription(habit.description || '');
    setHabitCategory(habit.category || 'Personal');
    setHabitGroupId(null);
    setHabitType(habit.habitType || 'build');
    setHabitColor(habit.color || palette.habits);
    setGoalPeriod(habit.goalPeriod || 'day');
    setGoalValueInput(String(getGoalValue(habit)));
    setGoalUnit(habit.goalUnit || 'times');
    setTaskDaysMode(habit.taskDaysMode || 'every_day');
    setTaskDaysCount(parseNumber(habit.taskDaysCount, 3));
    setSelectedDays(Array.isArray(habit.days) ? habit.days.filter((d) => DAYS.includes(d)) : DAYS);
    setSelectedMonthDays(Array.isArray(habit.monthDays) && habit.monthDays.length ? habit.monthDays : [new Date().getDate()]);
    setTimeRange(habit.timeRange || 'all_day');
    setRemindersEnabled(Boolean(habit.remindersEnabled));
    setReminderTimes(Array.isArray(habit.reminderTimes) ? habit.reminderTimes : []);
    setReminderMessage(habit.reminderMessage || '');
    setShowMemoAfterCompletion(Boolean(habit.showMemoAfterCompletion));
    setChartType(habit.chartType || 'bar');
    setStartDate(habit.startDate || toISODate(new Date()));
    setEndDate(habit.endDate || null);
    setIsEditingHabit(true);
    setActiveHabitId(habit.id);
  };

  const openCreateModal = () => {
    resetForm();
    setActiveHabitId(null);
    setShowFormModal(true);
  };

  const openEditFromDetail = () => {
    if (!selectedHabit) return;
    fillFormFromHabit(selectedHabit);
    setShowDetailModal(false);
    setShowFormModal(true);
  };

  const applyProgress = async (habit, amountValue) => {
    const amount = Math.max(0, parseNumber(amountValue, 0));
    const localKey = `${habit.id}|${selectedDateKey}`;
    setLocalProgressMap((prev) => ({ ...prev, [localKey]: amount }));

    if (typeof setHabitProgress === 'function' && isSelectedDateToday) {
      await setHabitProgress(habit.id, amount, selectedDateISO);
      return;
    }

    const nowCompleted = isHabitCompletedToday(habit.id);
    const shouldBeCompleted =
      (habit.habitType || 'build') === 'quit'
        ? amount > 0 && amount <= getGoalValue(habit)
        : amount >= getGoalValue(habit);
    if (isSelectedDateToday && nowCompleted !== shouldBeCompleted) {
      await toggleHabitCompletion(habit.id);
    }
  };

  const submitManualAmount = async () => {
    if (!selectedHabit || !isSelectedDateToday) {
      setShowManualModal(false);
      setManualAutoComplete(false);
      return;
    }
    const amountToApply = manualAutoComplete ? getGoalValue(selectedHabit) : manualAmount;
    await applyProgress(selectedHabit, amountToApply);
    setShowManualModal(false);
    setManualAutoComplete(false);
  };

  const submitHabit = async () => {
    if (!habitTitle.trim()) return;
    const goalValue = Math.max(1, parseNumber(goalValueInput, 1));

    let repeat = 'Daily';
    if (goalPeriod === 'week') repeat = 'Weekly';
    if (goalPeriod === 'month') repeat = 'Monthly';

    let days = DAYS;
    if (taskDaysMode === 'specific_weekdays') days = selectedDays.length ? selectedDays : DAYS;
    if (taskDaysMode === 'specific_month_days') days = selectedMonthDays.map((day) => String(day));
    if (repeat === 'Monthly' && taskDaysMode !== 'specific_month_days') days = [String(selectedMonthDays[0] || 1)];

    const payload = {
      title: habitTitle.trim(),
      category: habitCategory,
      description: habitDescription.trim(),
      repeat,
      days,
      habitType,
      color: habitColor,
      goalPeriod,
      goalValue,
      goalUnit: goalUnit.trim() || 'times',
      taskDaysMode,
      taskDaysCount,
      monthDays: selectedMonthDays,
      timeRange,
      remindersEnabled,
      reminderTimes,
      reminderMessage: reminderMessage.trim(),
      showMemoAfterCompletion,
      chartType,
      startDate,
      endDate,
    };

    if (isEditingHabit && selectedHabit) {
      await updateHabit(selectedHabit.id, payload);
    } else if (habitGroupId) {
      await addGroupHabit({ groupId: habitGroupId, ...payload });
    } else {
      await addHabit(payload);
    }

    setShowFormModal(false);
    resetForm();
  };

  const removeSelectedHabit = async () => {
    if (!selectedHabit) return;
    await deleteHabit(selectedHabit.id);
    setShowDetailModal(false);
    setActiveHabitId(null);
  };

  const toggleWeekday = (day) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((value) => value !== day);
      return [...prev, day];
    });
  };

  const toggleMonthDay = (day) => {
    setSelectedMonthDays((prev) => {
      if (prev.includes(day)) return prev.filter((value) => value !== day);
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const monthCells = useMemo(() => {
    const year = monthAnchor.getFullYear();
    const month = monthAnchor.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push({ type: 'spacer', key: `s-${i}` });
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      cells.push({ type: 'day', key: `d-${day}`, day, date, dateKey: toDateKey(date) });
    }
    return cells;
  }, [monthAnchor]);

  return (
    <View style={[styles.container, { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm }]}>
      <PlatformScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!isHabitSwipeActive && !isDateStripInteracting}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: palette.text }]}>Habits</Text>
            <Text style={[styles.pageSubtitle, { color: palette.textMuted }]}>Build better, quit worse</Text>
          </View>
          <TouchableOpacity
            style={[styles.headerAddButton, { backgroundColor: palette.habits }]}
            onPress={openCreateModal}
            activeOpacity={0.9}
          >
            <Ionicons name="add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <PlatformScrollView
          horizontal
          style={styles.dateStrip}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          directionalLockEnabled
          alwaysBounceVertical={false}
          bounces={false}
          onTouchStart={() => setIsDateStripInteracting(true)}
          onTouchEnd={() => setIsDateStripInteracting(false)}
          onTouchCancel={() => setIsDateStripInteracting(false)}
          onScrollBeginDrag={() => setIsDateStripInteracting(true)}
          onScrollEndDrag={() => setIsDateStripInteracting(false)}
          onMomentumScrollEnd={() => setIsDateStripInteracting(false)}
        >
          {dateStrip.map((date) => {
            const selected = isSameDay(date, selectedDate);
            return (
              <TouchableOpacity
                key={toISODate(date)}
                style={[
                  styles.datePill,
                  {
                    backgroundColor: selected ? palette.habits : palette.card,
                    borderColor: selected ? palette.habits : palette.cardBorder,
                  },
                ]}
                onPress={() => setSelectedDate(date)}
              >
                <Text style={[styles.datePillDay, { color: selected ? '#FFFFFF' : palette.textMuted }]}>
                  {date.toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
                <Text style={[styles.datePillNum, { color: selected ? '#FFFFFF' : palette.text }]}>{date.getDate()}</Text>
              </TouchableOpacity>
            );
          })}
        </PlatformScrollView>

        <View style={styles.statsRow}>
          <Card style={[styles.statCard, styles.statStreak]}>
            <Ionicons name="flame" size={16} color="#F97316" />
            <Text style={styles.statLabel}>Best streak</Text>
            <Text style={styles.statValue}>{getBestStreak()}</Text>
          </Card>
          <Card style={[styles.statCard, styles.statToday]}>
            <Feather name="target" size={16} color="#10B981" />
            <Text style={styles.statLabel}>Due today</Text>
            <Text style={styles.statValue}>{completedCount}/{filteredHabits.length}</Text>
          </Card>
          <Card style={[styles.statCard, styles.statTotal]}>
            <Ionicons name="stats-chart" size={16} color="#2563EB" />
            <Text style={styles.statLabel}>Total</Text>
            <Text style={styles.statValue}>{habitsWithDefaults.length}</Text>
          </Card>
        </View>

        <PlatformScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {categoryOptions.map((category) => {
            const selected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? palette.habits : palette.card,
                    borderColor: selected ? palette.habits : palette.cardBorder,
                  },
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.filterChipText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>{category}</Text>
              </TouchableOpacity>
            );
          })}
        </PlatformScrollView>

        <PlatformScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {TIME_RANGE_OPTIONS.map((option) => {
            const selected = selectedTimeRange === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: selected ? palette.habits : palette.card,
                    borderColor: selected ? palette.habits : palette.cardBorder,
                  },
                ]}
                onPress={() => setSelectedTimeRange(option.value)}
              >
                <Text style={[styles.filterChipText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </PlatformScrollView>

        {!isSelectedDateToday ? (
          <View style={[styles.notice, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
            <Ionicons name="information-circle-outline" size={15} color={palette.textMuted} />
            <Text style={[styles.noticeText, { color: palette.textMuted }]}>
              Progress edits and swipe actions are available for today only.
            </Text>
          </View>
        ) : null}

        {filteredHabits.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
            <Feather name="target" size={34} color={palette.habits} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No habits found</Text>
            <TouchableOpacity style={[styles.emptyButton, { backgroundColor: palette.habits }]} onPress={openCreateModal}>
              <Text style={styles.emptyButtonText}>Create Habit</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredHabits.map((habit) => {
            const amount = getDateProgressAmount(habit, selectedDateKey, localProgressMap);
            const ratio = getCompletionRatio(habit, amount);
            const completed = isCompletedForDate(habit, selectedDateKey, amount);
            return (
              <SwipeHabitCard
                key={habit.id}
                habit={habit}
                progress={amount}
                ratio={ratio}
                completed={completed}
                isInteractive={isSelectedDateToday}
                onTap={(item) => {
                  setActiveHabitId(item.id);
                  setManualAmount(String(Math.round(getDateProgressAmount(item, selectedDateKey, localProgressMap))));
                  setManualAutoComplete(false);
                  setShowManualModal(true);
                }}
                onEdit={(item) => {
                  setActiveHabitId(item.id);
                  setShowDetailModal(true);
                }}
                onSkip={async (item) => {
                  await applyProgress(item, 0);
                }}
                onReset={async (item) => {
                  await applyProgress(item, 0);
                }}
                onSwipeAdd={applyProgress}
                onSwipeInteractionChange={setIsHabitSwipeActive}
                styles={styles}
                palette={palette}
              />
            );
          })
        )}
      </PlatformScrollView>

      <Modal
        visible={showManualModal}
        onClose={() => {
          setShowManualModal(false);
          setManualAutoComplete(false);
        }}
        hideHeader
      >
        {selectedHabit ? (
          <View style={[styles.manualCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[styles.manualTitle, { color: palette.text }]}>{selectedHabit.title}</Text>
            <Text style={[styles.manualSub, { color: palette.textMuted }]}>Add progress manually</Text>
            <TextInput
              style={[styles.manualInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]}
              value={manualAmount}
              onChangeText={setManualAmount}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={palette.textLight}
            />
            <Text style={[styles.manualGoal, { color: palette.textMuted }]}>
              Goal: {getGoalValue(selectedHabit)} {selectedHabit.goalUnit || 'times'}
            </Text>
            <View style={styles.manualButtons}>
              <TouchableOpacity
                style={[styles.manualBtn, { backgroundColor: palette.mutedSurface }]}
                onPress={() => {
                  setShowManualModal(false);
                  setManualAutoComplete(false);
                }}
              >
                <Text style={[styles.manualBtnText, { color: palette.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.manualCheckButton,
                  {
                    backgroundColor: manualAutoComplete ? '#16A34A' : palette.mutedSurface,
                    borderColor: manualAutoComplete ? '#16A34A' : palette.cardBorder,
                  },
                ]}
                onPress={() => {
                  const next = !manualAutoComplete;
                  setManualAutoComplete(next);
                  if (next) {
                    setManualAmount(String(getGoalValue(selectedHabit)));
                  }
                }}
                activeOpacity={0.9}
              >
                <Ionicons
                  name={manualAutoComplete ? 'checkbox' : 'square-outline'}
                  size={20}
                  color={manualAutoComplete ? '#FFFFFF' : '#16A34A'}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.manualBtn, { backgroundColor: selectedHabitColor }]}
                onPress={submitManualAmount}
              >
                <Text style={styles.manualBtnTextWhite}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Modal>

      <Modal visible={showFormModal} onClose={() => setShowFormModal(false)} hideHeader fullScreen contentStyle={{ paddingHorizontal: 0 }}>
        <View style={[styles.formScreen, { backgroundColor: palette.background, paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.formTop}>
            <TouchableOpacity style={[styles.iconButton, { borderColor: palette.cardBorder, backgroundColor: palette.card }]} onPress={() => setShowFormModal(false)}>
              <Ionicons name="chevron-back" size={20} color={palette.text} />
            </TouchableOpacity>
            <Text style={[styles.formTitle, { color: palette.text }]}>{isEditingHabit ? 'Edit Habit' : 'New Habit'}</Text>
            <View style={styles.formSpacer} />
          </View>

          <View style={styles.formBody}>
            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <TextInput style={[styles.formInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} placeholder="Habit title" placeholderTextColor={palette.textLight} value={habitTitle} onChangeText={setHabitTitle} />
              <TextInput style={[styles.formInput, styles.formTextArea, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} placeholder="Description (optional)" placeholderTextColor={palette.textLight} value={habitDescription} onChangeText={setHabitDescription} multiline />
              <ChipGroup options={habitCategories} selectedValue={habitCategory} onSelect={setHabitCategory} color={palette.habits} />
              <Text style={[styles.sectionTitle, { color: palette.text, marginTop: spacing.xs }]}>Habit color</Text>
              <View style={styles.colorRow}>
                {HABIT_COLOR_OPTIONS.map((option) => {
                  const selected = habitColor === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.colorSwatch,
                        {
                          backgroundColor: option,
                          borderColor: selected ? '#FFFFFF' : 'transparent',
                        },
                      ]}
                      onPress={() => setHabitColor(option)}
                    >
                      {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Habit type</Text>
              <View style={[styles.segmentWrap, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                <TouchableOpacity style={[styles.segment, habitType === 'build' && { backgroundColor: palette.habits }]} onPress={() => setHabitType('build')}>
                  <Text style={[styles.segmentText, { color: habitType === 'build' ? '#FFFFFF' : palette.textMuted }]}>Build</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.segment, habitType === 'quit' && { backgroundColor: '#C7712A' }]} onPress={() => setHabitType('quit')}>
                  <Text style={[styles.segmentText, { color: habitType === 'quit' ? '#FFFFFF' : palette.textMuted }]}>Quit</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.rowLine} onPress={() => setShowGoalPeriodSheet(true)}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Goal period</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>
                  {GOAL_PERIOD_OPTIONS.find((item) => item.value === goalPeriod)?.label || 'Day-Long'}
                </Text>
              </TouchableOpacity>
              <View style={styles.rowLine}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Goal value</Text>
                <View style={styles.goalInputs}>
                  <TextInput style={[styles.goalInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} value={goalValueInput} onChangeText={setGoalValueInput} keyboardType="numeric" />
                  <TextInput style={[styles.goalInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} value={goalUnit} onChangeText={setGoalUnit} />
                </View>
              </View>
              <TouchableOpacity style={styles.rowLine} onPress={() => setShowTaskDaysSheet(true)}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Task days</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>
                  {formatTaskDaysSummary({ taskDaysMode, taskDaysCount, days: selectedDays, monthDays: selectedMonthDays })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Time range</Text>
              <View style={styles.wrapRow}>
                {TIME_RANGE_OPTIONS.map((option) => {
                  const selected = timeRange === option.value;
                  return (
                    <TouchableOpacity key={option.value} style={[styles.pill, { backgroundColor: selected ? palette.habits : palette.mutedSurface, borderColor: selected ? palette.habits : palette.cardBorder }]} onPress={() => setTimeRange(option.value)}>
                      <Text style={[styles.pillText, { color: selected ? '#FFFFFF' : palette.textMuted }]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Reminders</Text>
                <Switch value={remindersEnabled} onValueChange={setRemindersEnabled} trackColor={{ false: palette.switchTrack, true: palette.habits }} />
              </View>
              {remindersEnabled ? (
                <>
                  <View style={styles.wrapRow}>
                    {reminderTimes.map((time, index) => (
                      <TouchableOpacity key={`${time}-${index}`} style={[styles.pill, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]} onPress={() => { setEditingReminderTimeIndex(index); setShowReminderTimePicker(true); }}>
                        <Text style={[styles.pillText, { color: palette.habits }]}>{time}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={[styles.pill, { borderColor: palette.habits, backgroundColor: palette.card }]} onPress={() => { setEditingReminderTimeIndex(null); setShowReminderTimePicker(true); }}>
                      <Text style={[styles.pillText, { color: palette.habits }]}>+ Time</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput style={[styles.formInput, { borderColor: palette.cardBorder, color: palette.text, backgroundColor: palette.mutedSurface }]} placeholder="Reminder message" placeholderTextColor={palette.textLight} value={reminderMessage} onChangeText={setReminderMessage} />
                </>
              ) : null}
            </View>

            <View style={[styles.sectionCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Show memo after completion</Text>
                <Switch value={showMemoAfterCompletion} onValueChange={setShowMemoAfterCompletion} trackColor={{ false: palette.switchTrack, true: palette.habits }} />
              </View>
              <View style={styles.rowLine}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Chart type</Text>
                <View style={[styles.segmentWrapSmall, { borderColor: palette.cardBorder, backgroundColor: palette.mutedSurface }]}>
                  <TouchableOpacity style={[styles.segmentSmall, chartType === 'bar' && { backgroundColor: palette.habits }]} onPress={() => setChartType('bar')}>
                    <Ionicons name="bar-chart" size={16} color={chartType === 'bar' ? '#FFFFFF' : palette.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.segmentSmall, chartType === 'line' && { backgroundColor: palette.habits }]} onPress={() => setChartType('line')}>
                    <Ionicons name="stats-chart" size={16} color={chartType === 'line' ? '#FFFFFF' : palette.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
              <TouchableOpacity style={styles.rowLine} onPress={() => setShowStartDatePicker(true)}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>Start date</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>{startDate}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rowLine} onPress={() => setShowEndDatePicker(true)}>
                <Text style={[styles.rowLabel, { color: palette.text }]}>End date</Text>
                <Text style={[styles.rowValue, { color: palette.textMuted }]}>{endDate || 'No end'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.saveButton, { backgroundColor: habitTitle.trim() ? palette.habits : palette.cardBorder }]} onPress={submitHabit} disabled={!habitTitle.trim()}>
              <Text style={styles.saveButtonText}>{isEditingHabit ? 'Save changes' : 'Create habit'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        hideHeader
        fullScreen
        containerStyle={{ paddingBottom: 0 }}
        contentStyle={{ paddingHorizontal: 0 }}
        contentContainerStyle={{ paddingBottom: 0, paddingTop: 0 }}
      >
        {selectedHabit ? (
          <View style={[styles.detailScreen, { backgroundColor: palette.background }]}>
            <PlatformScrollView
              style={styles.detailScroll}
              contentContainerStyle={[styles.detailScrollContent, { paddingTop: 0, paddingBottom: insets.bottom }]}
              automaticallyAdjustContentInsets={false}
              bounces={false}
              alwaysBounceVertical={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
            >
              <LinearGradient colors={[palette.background, palette.background]} style={[styles.detailHeader, { paddingTop: insets.top }]}>
                <View style={[styles.detailHeroGlowLeft, { backgroundColor: withAlpha(selectedHabitColor, 0.2) }]} />
                <View style={[styles.detailHeroGlowRight, { backgroundColor: withAlpha(selectedHabitColor, 0.14) }]} />
                <View style={styles.detailTopRow}>
                  <TouchableOpacity
                    style={[styles.detailIconButton, { backgroundColor: withAlpha(selectedHabitColor, 0.16), borderWidth: 1, borderColor: withAlpha(selectedHabitColor, 0.28) }]}
                    onPress={() => setShowDetailModal(false)}
                  >
                    <Ionicons name="arrow-back" size={20} color={selectedHabitColor} />
                  </TouchableOpacity>
                  <View style={styles.detailTopActions}>
                    <TouchableOpacity
                      style={[styles.detailIconButton, styles.detailTopActionButton, { backgroundColor: withAlpha(selectedHabitColor, 0.16), borderWidth: 1, borderColor: withAlpha(selectedHabitColor, 0.28) }]}
                      onPress={openEditFromDetail}
                    >
                      <Feather name="edit-2" size={16} color={selectedHabitColor} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.detailIconButton, styles.detailTopActionButton, { backgroundColor: withAlpha(selectedHabitColor, 0.16), borderWidth: 1, borderColor: withAlpha(selectedHabitColor, 0.28) }]}
                      onPress={removeSelectedHabit}
                    >
                      <Ionicons name="trash-outline" size={17} color={selectedHabitColor} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.detailIdentityRow}>
                  <View style={[styles.detailHabitGlyph, { backgroundColor: withAlpha(selectedHabitColor, 0.14), borderColor: withAlpha(selectedHabitColor, 0.32) }]}>
                    <Text style={[styles.detailHabitGlyphText, { color: selectedHabitColor }]}>
                      {selectedHabit.title?.slice(0, 1)?.toUpperCase() || 'H'}
                    </Text>
                  </View>
                  <View style={styles.detailHeaderText}>
                    <Text style={[styles.detailHeaderTitle, { color: palette.text }]}>{selectedHabit.title}</Text>
                    <Text style={[styles.detailHeaderSub, { color: palette.textMuted }]}>{selectedHabit.category || 'Personal'}</Text>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.detailProgressCardWrap}>
                <View style={[styles.progressCard, { borderColor: palette.cardBorder, backgroundColor: palette.card }]}>
                  <View style={styles.progressDateHeader}>
                    <TouchableOpacity
                      style={[styles.progressDateNav, { backgroundColor: palette.mutedSurface }]}
                      onPress={() => setSelectedDate((prev) => addDays(prev, -1))}
                    >
                      <Ionicons name="chevron-back" size={17} color={palette.textMuted} />
                    </TouchableOpacity>
                    <View style={styles.progressDateTexts}>
                      <Text style={[styles.progressDatePrimary, { color: palette.text }]}>{selectedDatePrimaryLabel}</Text>
                      <Text style={[styles.progressDateSecondary, { color: palette.textMuted }]}>{selectedDateSecondaryLabel}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.progressDateNav, { backgroundColor: palette.mutedSurface }]}
                      onPress={() => setSelectedDate((prev) => addDays(prev, 1))}
                    >
                      <Ionicons name="chevron-forward" size={17} color={palette.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.progressCircle, { borderColor: selectedHabitColor }]}>
                    <View style={[styles.progressCircleInner, { backgroundColor: withAlpha(selectedHabitColor, 0.07) }]}>
                      <Text style={[styles.progressPercent, { color: palette.text }]}>{selectedHabitPercent}%</Text>
                      <Text style={[styles.progressAmountTextLight, { color: palette.textMuted }]}>
                        {Math.round(selectedHabitAmount)}/{selectedHabitGoalValue} {selectedHabit.goalUnit || 'times'}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.markBtn,
                      {
                        backgroundColor: isSelectedDateToday ? selectedHabitColor : palette.cardBorder,
                        borderColor: isSelectedDateToday ? selectedHabitColor : palette.cardBorder,
                      },
                    ]}
                    onPress={() => {
                      if (!isSelectedDateToday) return;
                      toggleHabitCompletion(selectedHabit.id);
                    }}
                    disabled={!isSelectedDateToday}
                  >
                    <Text style={styles.markBtnText}>
                      {!isSelectedDateToday
                        ? 'Only today can be updated'
                        : selectedHabitCompletedForDate
                          ? 'Mark as incomplete'
                          : 'Mark as complete'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailMiniStatsRow}>
                <View style={[styles.detailMiniStatCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <Ionicons name="flame-outline" size={16} color="#F97316" />
                  <Text style={[styles.detailMiniStatLabel, { color: palette.textMuted }]}>Current</Text>
                  <Text style={[styles.detailMiniStatValue, { color: palette.text }]}>{selectedHabit.streak || 0}</Text>
                  <Text style={[styles.detailMiniStatSuffix, { color: palette.textLight }]}>days</Text>
                </View>
                <View style={[styles.detailMiniStatCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <Feather name="target" size={16} color="#10B981" />
                  <Text style={[styles.detailMiniStatLabel, { color: palette.textMuted }]}>Goals</Text>
                  <Text style={[styles.detailMiniStatValue, { color: palette.text }]}>{selectedHabitGoalsThisMonth}</Text>
                  <Text style={[styles.detailMiniStatSuffix, { color: palette.textLight }]}>this month</Text>
                </View>
                <View style={[styles.detailMiniStatCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
                  <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
                  <Text style={[styles.detailMiniStatLabel, { color: palette.textMuted }]}>Best</Text>
                  <Text style={[styles.detailMiniStatValue, { color: palette.text }]}>{selectedHabitBestStreak}</Text>
                  <Text style={[styles.detailMiniStatSuffix, { color: palette.textLight }]}>days</Text>
                </View>
              </View>

              <View style={[styles.detailLowerSection, { backgroundColor: palette.background }]}>
                <View style={[styles.detailStreakCard, { backgroundColor: detailCardColor }]}>
                  <Text style={styles.detailStreakBig}>{selectedHabit.streak || 0} days</Text>
                  <Text style={styles.detailStreakLabel}>Current streak</Text>
                  <View style={styles.detailStreakStatsRow}>
                    <View style={styles.detailStreakStat}>
                      <Text style={styles.detailStreakStatValue}>{selectedHabitCompletions}</Text>
                      <Text style={styles.detailStreakStatLabel}>Goals met</Text>
                    </View>
                    <View style={styles.detailStreakStat}>
                      <Text style={styles.detailStreakStatValue}>{selectedHabitBestStreak}</Text>
                      <Text style={styles.detailStreakStatLabel}>Best streak</Text>
                    </View>
                  </View>
                </View>

                <View style={[styles.calendarCard, { backgroundColor: shadeColor(selectedHabitColor, -0.42), borderColor: withAlpha('#FFFFFF', 0.12) }]}>
                  <View style={styles.calendarHeader}>
                    <Text style={[styles.calendarTitle, { color: '#EAF2FF' }]}>Monthly Progress</Text>
                    <View style={styles.calendarNav}>
                      <TouchableOpacity
                        style={[styles.calendarNavBtn, { backgroundColor: withAlpha('#FFFFFF', 0.12) }]}
                        onPress={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1))}
                      >
                        <Ionicons name="chevron-back" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <Text style={styles.calendarMonthText}>
                        {monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                      </Text>
                      <TouchableOpacity
                        style={[styles.calendarNavBtn, { backgroundColor: withAlpha('#FFFFFF', 0.12) }]}
                        onPress={() => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1))}
                      >
                        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.calendarWeekRow}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                      <Text key={`${day}-${index}`} style={styles.calendarWeekDayText}>{day}</Text>
                    ))}
                  </View>
                  <View style={styles.calendarGrid}>
                    {monthCells.map((cell) => {
                      if (cell.type === 'spacer') return <View key={cell.key} style={styles.calendarCell} />;
                      const completed = (selectedHabit.completedDates || []).includes(cell.dateKey);
                      const selectedDay = cell.dateKey === selectedDateKey;
                      return (
                        <View key={cell.key} style={styles.calendarCell}>
                          <View
                            style={[
                              styles.calendarDot,
                              {
                                backgroundColor: completed ? selectedHabitColor : withAlpha('#FFFFFF', 0.1),
                                borderWidth: selectedDay ? 2 : 0,
                                borderColor: selectedDay ? '#FFFFFF' : 'transparent',
                              },
                            ]}
                          >
                            <Text style={[styles.calendarDotText, { color: '#F8FAFF' }]}>{cell.day}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </View>
            </PlatformScrollView>
          </View>
        ) : null}
      </Modal>

      <RNModal visible={showGoalPeriodSheet} transparent animationType="slide" onRequestClose={() => setShowGoalPeriodSheet(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setShowGoalPeriodSheet(false)} activeOpacity={1} />
          <View style={[styles.sheetCard, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Goal period</Text>
            {GOAL_PERIOD_OPTIONS.map((option) => (
              <TouchableOpacity key={option.value} style={[styles.sheetOption, { borderColor: goalPeriod === option.value ? palette.habits : palette.cardBorder }]} onPress={() => { setGoalPeriod(option.value); setShowGoalPeriodSheet(false); }}>
                <Text style={[styles.sheetOptionText, { color: palette.text }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </RNModal>

      <RNModal visible={showTaskDaysSheet} transparent animationType="slide" onRequestClose={() => setShowTaskDaysSheet(false)}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setShowTaskDaysSheet(false)} activeOpacity={1} />
          <View style={[styles.sheetCardLarge, { backgroundColor: palette.card, borderColor: palette.cardBorder }]}>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Task days</Text>
            <TouchableOpacity style={[styles.sheetOption, { borderColor: taskDaysMode === 'every_day' ? palette.habits : palette.cardBorder }]} onPress={() => setTaskDaysMode('every_day')}>
              <Text style={[styles.sheetOptionText, { color: palette.text }]}>Every day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetOption, { borderColor: taskDaysMode === 'specific_weekdays' ? palette.habits : palette.cardBorder }]} onPress={() => setTaskDaysMode('specific_weekdays')}>
              <Text style={[styles.sheetOptionText, { color: palette.text }]}>Specific weekdays</Text>
            </TouchableOpacity>
            {taskDaysMode === 'specific_weekdays' ? (
              <View style={styles.wrapRow}>
                {DAYS.map((day) => (
                  <TouchableOpacity key={day} style={[styles.pill, { backgroundColor: selectedDays.includes(day) ? palette.habits : palette.mutedSurface, borderColor: selectedDays.includes(day) ? palette.habits : palette.cardBorder }]} onPress={() => toggleWeekday(day)}>
                    <Text style={[styles.pillText, { color: selectedDays.includes(day) ? '#FFFFFF' : palette.textMuted }]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TouchableOpacity style={[styles.sheetOption, { borderColor: taskDaysMode === 'specific_month_days' ? palette.habits : palette.cardBorder }]} onPress={() => setTaskDaysMode('specific_month_days')}>
              <Text style={[styles.sheetOptionText, { color: palette.text }]}>Specific month days</Text>
            </TouchableOpacity>
            {taskDaysMode === 'specific_month_days' ? (
              <View style={styles.monthDaysGrid}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <TouchableOpacity key={day} style={[styles.monthDayChip, { backgroundColor: selectedMonthDays.includes(day) ? palette.habits : palette.mutedSurface, borderColor: selectedMonthDays.includes(day) ? palette.habits : palette.cardBorder }]} onPress={() => toggleMonthDay(day)}>
                    <Text style={[styles.monthDayChipText, { color: selectedMonthDays.includes(day) ? '#FFFFFF' : palette.textMuted }]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <TouchableOpacity style={[styles.sheetDone, { backgroundColor: palette.habits }]} onPress={() => setShowTaskDaysSheet(false)}>
              <Text style={styles.sheetDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </RNModal>

      <PlatformTimePicker
        visible={showReminderTimePicker}
        value={new Date()}
        onClose={() => setShowReminderTimePicker(false)}
        onChange={(date) => {
          const value = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setReminderTimes((prev) => {
            if (editingReminderTimeIndex !== null && prev[editingReminderTimeIndex]) {
              const updated = [...prev];
              updated[editingReminderTimeIndex] = value;
              return Array.from(new Set(updated));
            }
            return Array.from(new Set([...prev, value]));
          });
        }}
      />
      <PlatformDatePicker visible={showStartDatePicker} value={startDate} onClose={() => setShowStartDatePicker(false)} onChange={(date) => setStartDate(toISODate(date))} />
      <PlatformDatePicker visible={showEndDatePicker} value={endDate || new Date()} onClose={() => setShowEndDatePicker(false)} onChange={(date) => setEndDate(toISODate(date))} />
    </View>
  );
};

const createStyles = (palette) =>
  StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.lg },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
    pageTitle: { ...typography.h1, fontSize: 34, fontWeight: '700' },
    pageSubtitle: { ...typography.bodySmall, marginTop: 2 },
    iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerAddButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.small,
    },
    dateStrip: { marginBottom: spacing.md },
    datePill: { width: 66, borderRadius: borderRadius.lg, paddingVertical: spacing.sm, borderWidth: 1, alignItems: 'center', marginRight: spacing.sm },
    datePillDay: { ...typography.caption, textTransform: 'capitalize' },
    datePillNum: { ...typography.h3, fontWeight: '700', marginTop: 2 },
    statsRow: { flexDirection: 'row', marginBottom: spacing.md },
    statCard: { flex: 1, marginHorizontal: 4, borderRadius: borderRadius.lg, borderWidth: 1, padding: spacing.md },
    statStreak: { backgroundColor: '#FFF0E2', borderColor: '#F6D7B7' },
    statToday: { backgroundColor: '#E8F8EE', borderColor: '#CFEFD8' },
    statTotal: { backgroundColor: '#E8F0FF', borderColor: '#CCDAFF' },
    statLabel: { ...typography.caption, marginTop: spacing.xs },
    statValue: { ...typography.h2, marginTop: 2, fontWeight: '700', color: '#1F2937' },
    filterRow: { marginBottom: spacing.sm },
    filterChip: { borderRadius: borderRadius.full, borderWidth: 1, paddingVertical: 9, paddingHorizontal: spacing.md, marginRight: spacing.sm },
    filterChipText: { ...typography.bodySmall, fontWeight: '600' },
    notice: { borderRadius: borderRadius.md, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
    noticeText: { ...typography.bodySmall, marginLeft: spacing.sm, flex: 1 },
    emptyState: { borderRadius: borderRadius.xl, borderWidth: 1, alignItems: 'center', padding: spacing.xl, marginBottom: spacing.md },
    emptyTitle: { ...typography.h3, fontWeight: '700', marginTop: spacing.sm, marginBottom: spacing.md },
    emptyButton: { borderRadius: borderRadius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
    emptyButtonText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    swipeRow: { minHeight: 122, marginBottom: spacing.md, justifyContent: 'center', overflow: 'hidden' },
    swipeTrack: { flexDirection: 'row', alignItems: 'center' },
    actionRailInline: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.sm },
    actionTile: { width: 64, height: 86, borderRadius: borderRadius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
    actionTileEdit: { backgroundColor: '#EAF1FF', borderColor: '#D7E5FF' },
    actionTileSkip: { backgroundColor: '#FFF3E7', borderColor: '#FFE2C9' },
    actionTileReset: { backgroundColor: '#E9F8F3', borderColor: '#CDEFE2' },
    actionText: { ...typography.caption, fontWeight: '700', marginTop: spacing.xs },
    habitWrapper: { borderRadius: borderRadius.xl, overflow: 'hidden', ...shadows.small },
    fillTrack: { ...StyleSheet.absoluteFillObject, borderRadius: borderRadius.xl, overflow: 'hidden' },
    fillValue: { height: '100%' },
    habitCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, minHeight: 110, backgroundColor: palette.card },
    habitRow: { flexDirection: 'row', alignItems: 'center' },
    habitAvatar: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
    habitAvatarText: { ...typography.h3, fontWeight: '700' },
    habitInfo: { flex: 1, marginRight: spacing.md },
    habitTitle: { ...typography.h3, fontWeight: '700', marginBottom: spacing.xs },
    habitMeta: { ...typography.caption, fontWeight: '600' },
    progressBadge: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.75)' },
    progressBadgeText: { ...typography.caption, fontWeight: '700' },
    habitHint: { ...typography.caption, marginTop: spacing.sm, textAlign: 'center' },
    manualCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg },
    manualTitle: { ...typography.h3, fontWeight: '700' },
    manualSub: { ...typography.bodySmall, marginTop: 2, marginBottom: spacing.sm },
    manualInput: { borderWidth: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, paddingHorizontal: spacing.md, ...typography.body },
    manualGoal: { ...typography.caption, marginTop: spacing.sm },
    manualButtons: { flexDirection: 'row', marginTop: spacing.lg },
    manualBtn: { flex: 1, borderRadius: borderRadius.lg, paddingVertical: spacing.md, alignItems: 'center', marginHorizontal: spacing.xs },
    manualCheckButton: {
      width: 48,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.xs,
    },
    manualBtnText: { ...typography.bodySmall, fontWeight: '700' },
    manualBtnTextWhite: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    formScreen: { flex: 1 },
    formTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
    formTitle: { ...typography.h3, fontWeight: '700' },
    formSpacer: { width: 38, height: 38 },
    formBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
    sectionCard: { borderRadius: borderRadius.xl, borderWidth: 1, padding: spacing.md, marginBottom: spacing.md },
    sectionTitle: { ...typography.body, fontWeight: '700', marginBottom: spacing.sm },
    formInput: { borderWidth: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, ...typography.body, marginBottom: spacing.sm },
    formTextArea: { minHeight: 84, textAlignVertical: 'top' },
    colorRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xs },
    colorSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentWrap: { flexDirection: 'row', borderRadius: borderRadius.full, borderWidth: 1, padding: 3, marginBottom: spacing.sm },
    segment: { flex: 1, borderRadius: borderRadius.full, alignItems: 'center', paddingVertical: 9 },
    segmentText: { ...typography.body, fontWeight: '700' },
    rowLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,120,120,0.25)' },
    rowLabel: { ...typography.body, fontWeight: '600', flex: 1, marginRight: spacing.sm },
    rowValue: { ...typography.bodySmall, fontWeight: '600' },
    goalInputs: { flexDirection: 'row' },
    goalInput: { width: 76, borderWidth: 1, borderRadius: borderRadius.full, textAlign: 'center', paddingVertical: 6, marginLeft: spacing.xs, ...typography.bodySmall },
    wrapRow: { flexDirection: 'row', flexWrap: 'wrap' },
    pill: { borderRadius: borderRadius.full, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 7, marginRight: spacing.sm, marginBottom: spacing.sm },
    pillText: { ...typography.bodySmall, fontWeight: '600' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
    segmentWrapSmall: { width: 120, borderRadius: borderRadius.full, borderWidth: 1, flexDirection: 'row', padding: 3 },
    segmentSmall: { flex: 1, borderRadius: borderRadius.full, alignItems: 'center', paddingVertical: 7 },
    saveButton: { borderRadius: borderRadius.full, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.xl },
    saveButtonText: { ...typography.body, color: '#FFFFFF', fontWeight: '700' },
    detailScreen: { flex: 1 },
    detailScroll: { flex: 1 },
    detailScrollContent: { paddingBottom: 0 },
    detailHeader: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      borderBottomLeftRadius: 34,
      borderBottomRightRadius: 34,
      overflow: 'hidden',
      ...shadows.medium,
    },
    detailHeroGlowLeft: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: 'rgba(255,255,255,0.14)',
      top: -34,
      left: -46,
    },
    detailHeroGlowRight: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(255,255,255,0.1)',
      top: 84,
      right: -34,
    },
    detailTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    detailTopActions: { flexDirection: 'row' },
    detailTopActionButton: { marginLeft: spacing.sm },
    detailIconButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    detailIdentityRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
    detailHabitGlyph: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: 'rgba(255,255,255,0.2)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.28)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    detailHabitGlyphText: { ...typography.h1, color: '#FFFFFF', fontWeight: '700' },
    detailHeaderText: { flex: 1 },
    detailHeaderTitle: { ...typography.h1, color: '#FFFFFF', fontWeight: '800', fontSize: 36 },
    detailHeaderSub: { ...typography.bodySmall, color: 'rgba(255,255,255,0.88)', marginTop: 2, fontWeight: '700' },
    detailProgressCardWrap: {
      marginHorizontal: spacing.lg,
      marginTop: -12,
      borderRadius: borderRadius.xl,
      ...shadows.large,
    },
    progressCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.lg,
      alignItems: 'center',
    },
    progressDateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: spacing.md },
    progressDateTexts: { alignItems: 'center' },
    progressDatePrimary: { ...typography.body, fontWeight: '700' },
    progressDateSecondary: { ...typography.caption, marginTop: 2 },
    detailGaugeSection: { alignItems: 'center', marginTop: spacing.lg },
    progressCircle: {
      width: 194,
      height: 194,
      borderRadius: 97,
      borderWidth: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    progressCircleInner: {
      width: 152,
      height: 152,
      borderRadius: 76,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(8, 15, 31, 0.18)',
    },
    progressPercent: { ...typography.h1, fontWeight: '800', fontSize: 48 },
    progressAmountText: { ...typography.bodySmall, color: 'rgba(255,255,255,0.86)', marginTop: 4, fontWeight: '700' },
    progressAmountTextLight: { ...typography.bodySmall, marginTop: 4, fontWeight: '700' },
    markBtn: {
      borderRadius: borderRadius.full,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderWidth: 1,
    },
    markBtnText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    progressDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
    progressDateNav: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: spacing.md,
    },
    progressDateTextHero: { ...typography.h3, color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.7 },
    detailMiniStatsRow: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, marginBottom: spacing.sm },
    detailMiniStatCard: {
      flex: 1,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginHorizontal: 4,
      minHeight: 110,
    },
    detailMiniStatLabel: { ...typography.caption, marginTop: spacing.xs },
    detailMiniStatValue: { ...typography.h2, fontWeight: '700', marginTop: 2 },
    detailMiniStatSuffix: { ...typography.caption, marginTop: 2 },
    detailLowerSection: {
      marginTop: spacing.md,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
    },
    detailStreakCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.13)',
      padding: spacing.lg,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    detailStreakBig: { ...typography.h1, color: '#DFF2FF', fontWeight: '800', fontSize: 44 },
    detailStreakLabel: { ...typography.body, color: 'rgba(223,242,255,0.82)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2, marginBottom: spacing.md },
    detailStreakStatsRow: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
    detailStreakStat: { flex: 1, alignItems: 'center' },
    detailStreakStatValue: { ...typography.h2, color: '#FFFFFF', fontWeight: '800' },
    detailStreakStatLabel: { ...typography.caption, color: 'rgba(223,242,255,0.7)', marginTop: 2, textTransform: 'uppercase' },
    calendarCard: {
      borderRadius: borderRadius.xl,
      borderWidth: 1,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    calendarTitle: { ...typography.body, fontWeight: '700' },
    calendarNav: { flexDirection: 'row', alignItems: 'center' },
    calendarMonthText: { ...typography.bodySmall, color: '#EAF2FF', fontWeight: '700', marginHorizontal: spacing.sm },
    calendarNavBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm, paddingHorizontal: 2 },
    calendarWeekDayText: { ...typography.caption, color: 'rgba(234,242,255,0.65)', width: '14.2%', textAlign: 'center' },
    calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calendarCell: { width: '14.2%', alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
    calendarDot: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    calendarDotText: { ...typography.caption, fontWeight: '700' },
    detailActions: { marginTop: spacing.xs },
    detailActionBtn: { borderRadius: borderRadius.lg, alignItems: 'center', paddingVertical: spacing.md, borderWidth: 1 },
    detailActionText: { ...typography.bodySmall, fontWeight: '700' },
    sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
    sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
    sheetCard: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg, maxHeight: '65%' },
    sheetCardLarge: { borderTopLeftRadius: borderRadius.xl, borderTopRightRadius: borderRadius.xl, borderWidth: 1, padding: spacing.lg, maxHeight: '82%' },
    sheetTitle: { ...typography.h3, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
    sheetOption: { borderRadius: borderRadius.md, borderWidth: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginBottom: spacing.sm },
    sheetOptionText: { ...typography.body, fontWeight: '600' },
    monthDaysGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    monthDayChip: { width: '13%', aspectRatio: 1, borderWidth: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
    monthDayChipText: { ...typography.caption, fontWeight: '700' },
    sheetDone: { borderRadius: borderRadius.full, alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
    sheetDoneText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
  });

export default HabitsScreen;
