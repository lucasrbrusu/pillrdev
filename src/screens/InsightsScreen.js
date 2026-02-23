import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { G, Circle, Path } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { Button, Card } from '../components';
import {
  addDays,
  addMonths,
  clamp,
  formatDurationHuman,
  formatRangeLabel,
  getSleepDurationMinutes,
  isWithinRange,
  parseDateOnlyToLocalNoon,
  startOfMonth,
  startOfWeekMonday,
} from '../utils/insights';
import { readAppUsageByDay, readFocusSessions } from '../utils/insightsTracking';
import { colors, borderRadius, spacing, typography, shadows } from '../utils/theme';

const MAX_HISTORY = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

const sum = (arr) => arr.reduce((acc, n) => acc + (Number(n) || 0), 0);

const withAlpha = (hex, alpha) => {
  if (!hex || typeof hex !== 'string') return hex;
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return hex;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const coerceDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.length >= 10) {
    const parsed = parseDateOnlyToLocalNoon(value.slice(0, 10));
    if (parsed) return parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getItemDate = (item) =>
  coerceDate(
    item?.completedAt ||
      item?.completed_at ||
      item?.completedDate ||
      item?.completed_date ||
      item?.createdAt ||
      item?.created_at ||
      item?.date
  );

const getPercentChange = (current, previous) => {
  const prev = Number(previous) || 0;
  if (prev <= 0) return null;
  const curr = Number(current) || 0;
  const diff = ((curr - prev) / prev) * 100;
  if (!Number.isFinite(diff)) return null;
  return Math.round(diff);
};

const safeCurrency = (n) => {
  const value = Number(n) || 0;
  const abs = Math.abs(value);
  const rounded = abs >= 100 ? Math.round(abs) : Math.round(abs * 100) / 100;
  return `${value < 0 ? '-' : ''}${rounded}`;
};

const TabPill = ({ label, active, onPress, styles, gradient }) => (
  <TouchableOpacity style={styles.tabPillWrap} onPress={onPress} activeOpacity={0.9}>
    {active ? (
      <LinearGradient colors={gradient} style={styles.tabPillActive}>
        <Text style={styles.tabTextActive}>{label}</Text>
      </LinearGradient>
    ) : (
      <View style={styles.tabPillInactive}>
        <Text style={styles.tabText}>{label}</Text>
      </View>
    )}
  </TouchableOpacity>
);

const TrendBadge = ({ value, styles, upColor, downColor }) => {
  if (value === null || value === undefined) return null;
  const isUp = value >= 0;
  const label = `${isUp ? '+' : ''}${Math.abs(value)}%`;
  const iconColor = isUp ? upColor : downColor;
  return (
    <View style={[styles.metricBadge, isUp ? styles.metricBadgeUp : styles.metricBadgeDown]}>
      <Ionicons
        name={isUp ? 'trending-up' : 'trending-down'}
        size={12}
        color={iconColor}
      />
      <Text style={[styles.metricBadgeText, { color: iconColor }]}>
        {label}
      </Text>
    </View>
  );
};

const ActivityChart = ({ width, height, labels, series, gridColor, styles }) => {
  const padding = 16;
  const values = series.flatMap((item) => item.values || []);
  const maxValue = Math.max(1, ...values);
  const stepX = labels.length > 1 ? (width - padding * 2) / (labels.length - 1) : 0;

  const getPoint = (value, index) => {
    const ratio = Math.max(0, Math.min(1, (Number(value) || 0) / maxValue));
    const x = padding + stepX * index;
    const y = padding + (1 - ratio) * (height - padding * 2);
    return { x, y };
  };

  const buildLine = (valuesList) =>
    valuesList
      .map((value, index) => {
        const { x, y } = getPoint(value, index);
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

  const buildArea = (valuesList) => {
    if (!valuesList.length) return '';
    const line = buildLine(valuesList);
    const lastPoint = getPoint(valuesList[valuesList.length - 1], valuesList.length - 1);
    const firstPoint = getPoint(valuesList[0], 0);
    const baseY = height - padding;
    return `${line} L ${lastPoint.x} ${baseY} L ${firstPoint.x} ${baseY} Z`;
  };

  return (
    <View>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map((ratio) => {
          const y = padding + (height - padding * 2) * ratio;
          return (
            <Path
              key={`grid-${ratio}`}
              d={`M ${padding} ${y} H ${width - padding}`}
              stroke={gridColor}
              strokeWidth={1}
            />
          );
        })}
        {series.map((item) => (
          <G key={item.label}>
            <Path d={buildArea(item.values)} fill={withAlpha(item.color, 0.12)} />
            <Path
              d={buildLine(item.values)}
              stroke={item.color}
              strokeWidth={2.5}
              fill="none"
            />
          </G>
        ))}
      </Svg>
      <View style={styles.chartLabelsRow}>
        {labels.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.chartLabel}>
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
};

const DonutChart = ({ size = 150, stroke = 18, data, trackColor }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = sum(data.map((item) => item.value));
  let offset = 0;

  return (
    <Svg width={size} height={size}>
      <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        {total > 0 &&
          data.map((item) => {
            const segment = (item.value / total) * circumference;
            if (!Number.isFinite(segment) || segment <= 0) return null;
            const dasharray = `${segment} ${circumference - segment}`;
            const strokeDashoffset = -offset;
            offset += segment;
            return (
              <Circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={item.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={dasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            );
          })}
      </G>
    </Svg>
  );
};

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();
  const {
    profile,
    tasks,
    habits,
    getCurrentStreak,
    chores,
    healthData,
    notes,
    reminders,
    groceries,
    finances,
    authUser,
    themeColors,
    themeName,
    ensureTasksLoaded,
    ensureHabitsLoaded,
    ensureHealthLoaded,
    ensureFinancesLoaded,
    ensureChoresLoaded,
    ensureNotesLoaded,
    ensureRemindersLoaded,
    ensureGroceriesLoaded,
  } = useApp();
  const theme = themeColors || colors;
  const isDark =
    (themeName || '').toLowerCase() === 'dark' || theme.background === '#000000';
  const textColor = theme.text || colors.text;
  const styles = React.useMemo(() => createStyles(theme, isDark), [theme, isDark]);
  const chartWidth = Math.min(
    Math.max(240, width - spacing.xl * 2 - spacing.lg * 2),
    420
  );

  const isPremium = !!profile?.isPremium;
  const [tab, setTab] = React.useState('weekly'); // weekly | monthly
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [monthOffset, setMonthOffset] = React.useState(0);
  const [focusSessions, setFocusSessions] = React.useState([]);
  const [appUsageByDay, setAppUsageByDay] = React.useState({});

  React.useEffect(() => {
    ensureTasksLoaded();
    ensureHabitsLoaded();
    ensureHealthLoaded();
    ensureFinancesLoaded();
    ensureChoresLoaded();
    ensureNotesLoaded();
    ensureRemindersLoaded();
    ensureGroceriesLoaded();
  }, [
    ensureChoresLoaded,
    ensureFinancesLoaded,
    ensureGroceriesLoaded,
    ensureHabitsLoaded,
    ensureHealthLoaded,
    ensureNotesLoaded,
    ensureRemindersLoaded,
    ensureTasksLoaded,
  ]);

  const userId = authUser?.id || null;

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [sessions, usage] = await Promise.all([
        readFocusSessions(userId),
        readAppUsageByDay(userId),
      ]);
      if (cancelled) return;
      setFocusSessions(Array.isArray(sessions) ? sessions : []);
      setAppUsageByDay(usage && typeof usage === 'object' ? usage : {});
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activeOffset = tab === 'weekly' ? weekOffset : monthOffset;
  const setActiveOffset = (next) => {
    const clamped = clamp(next, 0, MAX_HISTORY);
    if (tab === 'weekly') setWeekOffset(clamped);
    else setMonthOffset(clamped);
  };

  const rangeStart = React.useMemo(() => {
    if (tab === 'weekly') return startOfWeekMonday(new Date(), weekOffset);
    return startOfMonth(new Date(), monthOffset);
  }, [tab, weekOffset, monthOffset]);

  const rangeEndExclusive = React.useMemo(() => {
    if (tab === 'weekly') return addDays(rangeStart, 7);
    return addMonths(rangeStart, 1);
  }, [tab, rangeStart]);

  const rangeLabel = React.useMemo(
    () => formatRangeLabel(rangeStart, rangeEndExclusive),
    [rangeStart, rangeEndExclusive]
  );

  const buildInsights = React.useCallback(
    (start, end) => {
      const tasksCreated = (tasks || []).filter((t) =>
        isWithinRange(t?.createdAt, start, end)
      );
      const tasksCompleted = tasksCreated.filter((t) => !!t?.completed);

      const choresCreated = (chores || []).filter((c) =>
        isWithinRange(c?.createdAt, start, end)
      );
      const choresCompleted = choresCreated.filter((c) => !!c?.completed);

      const habitsCreated = (habits || []).filter((h) =>
        isWithinRange(h?.createdAt, start, end)
      );

      const habitCheckins = sum(
        (habits || []).map((h) => {
          const dates = Array.isArray(h?.completedDates) ? h.completedDates : [];
          return dates.filter((dateStr) =>
            isWithinRange(coerceDate(dateStr), start, end)
          ).length;
        })
      );

      const sessionsInRange = (focusSessions || []).filter((s) =>
        isWithinRange(s?.endAt || s?.endedAt, start, end)
      );
      const focusMs = sum(sessionsInRange.map((s) => s?.durationMs));

      const appUsageMs = sum(
        Object.entries(appUsageByDay || {}).map(([dateKey, ms]) => {
          const keyDate = parseDateOnlyToLocalNoon(dateKey);
          if (!keyDate) return 0;
          return isWithinRange(keyDate, start, end) ? ms : 0;
        })
      );

      const healthEntriesInRange = Object.entries(healthData || {})
        .map(([dateKey, day]) => ({ dateKey, day }))
        .filter(({ dateKey }) => {
          const keyDate = parseDateOnlyToLocalNoon(dateKey);
          if (!keyDate) return false;
          return isWithinRange(keyDate, start, end);
        });

      const sleepMinutesList = healthEntriesInRange
        .map(({ day }) => getSleepDurationMinutes(day?.sleepTime, day?.wakeTime))
        .filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0);

      const totalSleepMinutes = sum(sleepMinutesList);
      const sleepNights = sleepMinutesList.length;
      const avgSleepMinutes = sleepNights ? totalSleepMinutes / sleepNights : 0;

      const waterTotal = sum(
        healthEntriesInRange.map(({ day }) => Number(day?.waterIntake) || 0)
      );
      const waterAvg = healthEntriesInRange.length
        ? waterTotal / healthEntriesInRange.length
        : 0;

      const caloriesTotal = sum(
        healthEntriesInRange.map(({ day }) => Number(day?.calories) || 0)
      );

      const notesCreated = (notes || []).filter((n) =>
        isWithinRange(n?.createdAt, start, end)
      );

      const remindersCreated = (reminders || []).filter((r) =>
        isWithinRange(r?.createdAt, start, end)
      );

      const groceriesAdded = (groceries || []).filter((g) =>
        isWithinRange(g?.createdAt, start, end)
      );
      const groceriesCompleted = groceriesAdded.filter((g) => !!g?.completed);

      const transactionsInRange = (finances || []).filter((t) =>
        isWithinRange(t?.createdAt || t?.date, start, end)
      );
      const expenses = transactionsInRange
        .filter((t) => t?.type === 'expense')
        .reduce((acc, t) => acc + (Number(t?.amount) || 0), 0);
      const income = transactionsInRange
        .filter((t) => t?.type === 'income')
        .reduce((acc, t) => acc + (Number(t?.amount) || 0), 0);

      return {
        tasksCreatedCount: tasksCreated.length,
        tasksCompletedCount: tasksCompleted.length,
        habitsCreatedCount: habitsCreated.length,
        habitCheckinsCount: habitCheckins,
        choresCreatedCount: choresCreated.length,
        choresCompletedCount: choresCompleted.length,
        focusMs,
        appUsageMs,
        totalSleepMinutes,
        avgSleepMinutes,
        sleepNights,
        waterTotal,
        waterAvg,
        caloriesTotal,
        notesCreatedCount: notesCreated.length,
        remindersCreatedCount: remindersCreated.length,
        groceriesAddedCount: groceriesAdded.length,
        groceriesCompletedCount: groceriesCompleted.length,
        transactionsCount: transactionsInRange.length,
        income,
        expenses,
      };
    },
    [
      tasks,
      habits,
      chores,
      healthData,
      notes,
      reminders,
      groceries,
      finances,
      focusSessions,
      appUsageByDay,
    ]
  );

  const insights = React.useMemo(
    () => buildInsights(rangeStart, rangeEndExclusive),
    [buildInsights, rangeStart, rangeEndExclusive]
  );

  const prevRangeStart = React.useMemo(() => {
    if (tab === 'weekly') return addDays(rangeStart, -7);
    return addMonths(rangeStart, -1);
  }, [tab, rangeStart]);

  const prevInsights = React.useMemo(
    () => buildInsights(prevRangeStart, rangeStart),
    [buildInsights, prevRangeStart, rangeStart]
  );

  const periodDays = Math.max(
    1,
    Math.round((rangeEndExclusive.getTime() - rangeStart.getTime()) / DAY_MS)
  );
  const prevPeriodDays = Math.max(
    1,
    Math.round((rangeStart.getTime() - prevRangeStart.getTime()) / DAY_MS)
  );

  const accent = React.useMemo(
    () => ({
      tasks: isDark ? '#C4B5FD' : '#9C6BFF',
      habits: isDark ? '#FDA4AF' : '#FF4FA0',
      chores: isDark ? '#93C5FD' : '#4C8DFF',
      focus: isDark ? '#FCD34D' : '#F59E0B',
      app: isDark ? '#C084FC' : '#8B5CF6',
      sleep: isDark ? '#A5B4FC' : '#6366F1',
      water: isDark ? '#7DD3FC' : '#38BDF8',
      calories: isDark ? '#FDBA74' : '#F97316',
      notes: isDark ? '#93C5FD' : '#3B82F6',
      reminders: isDark ? '#F9A8D4' : '#EC4899',
      groceries: isDark ? '#6EE7B7' : '#10B981',
      finances: isDark ? '#4ADE80' : '#16A34A',
    }),
    [isDark]
  );

  const gradients = React.useMemo(
    () => ({
      hero: isDark ? ['#5B21B6', '#BE185D'] : ['#B14DFF', '#F43F8C'],
      streak: isDark ? ['#F97316', '#EF4444'] : ['#FF8A3D', '#FF4F6D'],
      completion: isDark ? ['#2563EB', '#38BDF8'] : ['#2F80FF', '#00C2FF'],
      insight: isDark ? ['#6D28D9', '#EC4899'] : ['#8B5CF6', '#EC4899'],
      tab: isDark ? ['#6D28D9', '#EC4899'] : ['#B14DFF', '#F43F8C'],
    }),
    [isDark]
  );

  const trendColors = React.useMemo(
    () => ({
      up: isDark ? '#86EFAC' : '#22C55E',
      down: isDark ? '#FCA5A5' : '#EF4444',
    }),
    [isDark]
  );

  const chartGridColor = isDark
    ? 'rgba(148, 163, 184, 0.25)'
    : 'rgba(148, 163, 184, 0.2)';
  const donutTrack = isDark ? 'rgba(255,255,255,0.12)' : '#F1F0F7';

  const focusTargetHours = tab === 'weekly' ? 6 : 24;

  const computeProductivityScore = React.useCallback(
    (data, days) => {
      const taskRate = data.tasksCreatedCount
        ? data.tasksCompletedCount / data.tasksCreatedCount
        : 0;
      const habitRate = data.habitsCreatedCount
        ? data.habitCheckinsCount / (data.habitsCreatedCount * days)
        : 0;
      const choreRate = data.choresCreatedCount
        ? data.choresCompletedCount / data.choresCreatedCount
        : 0;
      const focusRate = focusTargetHours
        ? data.focusMs / (focusTargetHours * 60 * 60 * 1000)
        : 0;

      const score =
        clamp(taskRate, 0, 1) * 0.35 +
        clamp(habitRate, 0, 1) * 0.25 +
        clamp(choreRate, 0, 1) * 0.2 +
        clamp(focusRate, 0, 1) * 0.2;

      return Math.round(score * 100);
    },
    [focusTargetHours]
  );

  const productivityScore = React.useMemo(
    () => computeProductivityScore(insights, periodDays),
    [computeProductivityScore, insights, periodDays]
  );
  const prevProductivityScore = React.useMemo(
    () => computeProductivityScore(prevInsights, prevPeriodDays),
    [computeProductivityScore, prevInsights, prevPeriodDays]
  );
  const productivityDelta = getPercentChange(
    productivityScore,
    prevProductivityScore
  );

  const completionRate = React.useMemo(() => {
    const taskRate = insights.tasksCreatedCount
      ? insights.tasksCompletedCount / insights.tasksCreatedCount
      : 0;
    const habitRate = insights.habitsCreatedCount
      ? insights.habitCheckinsCount / (insights.habitsCreatedCount * periodDays)
      : 0;
    const choreRate = insights.choresCreatedCount
      ? insights.choresCompletedCount / insights.choresCreatedCount
      : 0;
    const rate =
      clamp(taskRate, 0, 1) * 0.5 +
      clamp(choreRate, 0, 1) * 0.3 +
      clamp(habitRate, 0, 1) * 0.2;
    return Math.round(rate * 100);
  }, [insights, periodDays]);

  const currentStreak = getCurrentStreak ? getCurrentStreak() : 0;

  const activityData = React.useMemo(() => {
    const dayCount = Math.max(
      1,
      Math.round((rangeEndExclusive.getTime() - rangeStart.getTime()) / DAY_MS)
    );
    const bucketSize = tab === 'weekly' ? 1 : 7;
    const bucketCount = Math.max(1, Math.ceil(dayCount / bucketSize));

    const labels = Array.from({ length: bucketCount }).map((_, index) => {
      if (bucketSize === 1) {
        const date = addDays(rangeStart, index);
        return date.toLocaleDateString(undefined, { weekday: 'short' });
      }
      return `W${index + 1}`;
    });

    const tasksBuckets = new Array(bucketCount).fill(0);
    const choresBuckets = new Array(bucketCount).fill(0);
    const habitsBuckets = new Array(bucketCount).fill(0);

    const addToBucket = (date, buckets) => {
      if (!date) return;
      const dayIndex = Math.floor(
        (date.getTime() - rangeStart.getTime()) / DAY_MS
      );
      if (dayIndex < 0 || dayIndex >= dayCount) return;
      const bucketIndex = Math.floor(dayIndex / bucketSize);
      buckets[bucketIndex] += 1;
    };

    (tasks || []).forEach((task) => addToBucket(getItemDate(task), tasksBuckets));
    (chores || []).forEach((chore) => addToBucket(getItemDate(chore), choresBuckets));
    (habits || []).forEach((habit) => {
      const dates = Array.isArray(habit?.completedDates) ? habit.completedDates : [];
      dates.forEach((dateStr) => addToBucket(coerceDate(dateStr), habitsBuckets));
    });

    const totals = labels.map(
      (_, index) =>
        tasksBuckets[index] + habitsBuckets[index] + choresBuckets[index]
    );
    const bestIndex = totals.reduce(
      (bestIdx, value, index) => (value > totals[bestIdx] ? index : bestIdx),
      0
    );

    return {
      labels,
      bestIndex,
      totals,
      series: [
        { label: 'Tasks', values: tasksBuckets, color: accent.tasks },
        { label: 'Habits', values: habitsBuckets, color: accent.habits },
        { label: 'Chores', values: choresBuckets, color: accent.chores },
      ],
    };
  }, [tasks, habits, chores, rangeStart, rangeEndExclusive, tab, accent]);

  const focusHours = Math.round(insights.focusMs / (60 * 60 * 1000));

  const breakdownItems = React.useMemo(
    () => [
      {
        label: 'Tasks',
        value: insights.tasksCompletedCount,
        display: `${insights.tasksCompletedCount}`,
        color: accent.tasks,
      },
      {
        label: 'Habits',
        value: insights.habitCheckinsCount,
        display: `${insights.habitCheckinsCount}`,
        color: accent.habits,
      },
      {
        label: 'Chores',
        value: insights.choresCompletedCount,
        display: `${insights.choresCompletedCount}`,
        color: accent.chores,
      },
      {
        label: 'Focus',
        value: focusHours,
        display: `${focusHours}h`,
        color: accent.focus,
      },
    ],
    [
      insights.tasksCompletedCount,
      insights.habitCheckinsCount,
      insights.choresCompletedCount,
      focusHours,
      accent,
    ]
  );

  const keyMetrics = React.useMemo(
    () => [
      {
        key: 'tasks',
        title: 'Tasks Completed',
        value: `${insights.tasksCompletedCount}`,
        subtitle: `${insights.tasksCreatedCount} created this period`,
        icon: 'checkmark-done-outline',
        accent: accent.tasks,
        change: getPercentChange(
          insights.tasksCompletedCount,
          prevInsights.tasksCompletedCount
        ),
      },
      {
        key: 'habits',
        title: 'Habit Check-ins',
        value: `${insights.habitCheckinsCount}`,
        subtitle: `${habits?.length || 0} active habits`,
        icon: 'flame-outline',
        accent: accent.habits,
        change: getPercentChange(
          insights.habitCheckinsCount,
          prevInsights.habitCheckinsCount
        ),
      },
      {
        key: 'chores',
        title: 'Chores Done',
        value: `${insights.choresCompletedCount}`,
        subtitle: `${insights.choresCreatedCount} created`,
        icon: 'home-outline',
        accent: accent.chores,
        change: getPercentChange(
          insights.choresCompletedCount,
          prevInsights.choresCompletedCount
        ),
      },
      {
        key: 'focus',
        title: 'Focus Time',
        value: formatDurationHuman(insights.focusMs),
        subtitle: 'Time spent focusing',
        icon: 'timer-outline',
        accent: accent.focus,
        change: getPercentChange(insights.focusMs, prevInsights.focusMs),
      },
      {
        key: 'app',
        title: 'App Time',
        value: formatDurationHuman(insights.appUsageMs),
        subtitle: 'Time in the app',
        icon: 'phone-portrait-outline',
        accent: accent.app,
        change: getPercentChange(insights.appUsageMs, prevInsights.appUsageMs),
      },
      {
        key: 'sleep',
        title: 'Sleep',
        value: formatDurationHuman(insights.totalSleepMinutes * 60000),
        subtitle: insights.sleepNights
          ? `Avg ${Math.round((insights.avgSleepMinutes / 60) * 10) / 10}h/night`
          : 'No sleep logs',
        icon: 'moon-outline',
        accent: accent.sleep,
        change: getPercentChange(
          insights.totalSleepMinutes,
          prevInsights.totalSleepMinutes
        ),
      },
    ],
    [
      insights,
      prevInsights,
      habits,
      accent,
    ]
  );

  const additionalMetrics = React.useMemo(
    () => [
      {
        key: 'calories',
        title: 'Calories Logged',
        value: `${Math.round(insights.caloriesTotal)}`,
        subtitle: 'From health logs',
        icon: 'nutrition-outline',
        accent: accent.calories,
      },
      {
        key: 'notes',
        title: 'Notes',
        value: `${insights.notesCreatedCount}`,
        subtitle: 'Created',
        icon: 'document-text-outline',
        accent: accent.notes,
      },
      {
        key: 'reminders',
        title: 'Reminders',
        value: `${insights.remindersCreatedCount}`,
        subtitle: 'Created',
        icon: 'notifications-outline',
        accent: accent.reminders,
      },
      {
        key: 'groceries',
        title: 'Groceries',
        value: `${insights.groceriesAddedCount} added`,
        subtitle: `${insights.groceriesCompletedCount} completed`,
        icon: 'basket-outline',
        accent: accent.groceries,
      },
      {
        key: 'finances',
        title: 'Finances',
        value: `${insights.transactionsCount} tx`,
        subtitle: `+${safeCurrency(insights.income)} / -${safeCurrency(
          insights.expenses
        )}`,
        icon: 'cash-outline',
        accent: accent.finances,
      },
    ],
    [insights, accent]
  );

  const insightMessage = React.useMemo(() => {
    const focusChange = getPercentChange(insights.focusMs, prevInsights.focusMs);
    if (focusChange !== null && focusChange >= 10) {
      return `Your focus time is up ${focusChange}% from last period. Keep protecting deep work blocks.`;
    }
    const bestLabel = activityData.labels[activityData.bestIndex];
    if (bestLabel && activityData.totals[activityData.bestIndex] > 0) {
      return `You're most productive on ${bestLabel}. Consider scheduling your most important tasks then.`;
    }
    return 'Small wins add up. Aim for one meaningful task each day to build momentum.';
  }, [activityData, insights.focusMs, prevInsights.focusMs]);

  const productivityDeltaText =
    productivityDelta === null
      ? 'No prior data yet'
      : `${productivityDelta >= 0 ? '+' : ''}${productivityDelta}% from last period`;
  const productivityDeltaIcon =
    productivityDelta === null
      ? 'sparkles-outline'
      : productivityDelta >= 0
      ? 'trending-up'
      : 'trending-down';

  const rangeTitle =
    activeOffset === 0 ? 'Current period' : `${activeOffset} back`;
  const activityTitle = tab === 'weekly' ? 'Weekly Activity' : 'Monthly Activity';

  const goPrev = () => setActiveOffset(activeOffset + 1);
  const goNext = () => setActiveOffset(activeOffset - 1);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="stats-chart" size={18} color={accent.app} />
          </View>
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.tabs}>
        <TabPill
          label="Weekly"
          active={tab === 'weekly'}
          onPress={() => setTab('weekly')}
          styles={styles}
          gradient={gradients.tab}
        />
        <TabPill
          label="Monthly"
          active={tab === 'monthly'}
          onPress={() => setTab('monthly')}
          styles={styles}
          gradient={gradients.tab}
        />
      </View>

      <View style={styles.rangeCard}>
        <TouchableOpacity
          onPress={goPrev}
          disabled={activeOffset >= MAX_HISTORY}
          style={[styles.rangeButton, activeOffset >= MAX_HISTORY && styles.rangeButtonDisabled]}
        >
          <Ionicons name="chevron-back" size={18} color={textColor} />
        </TouchableOpacity>
        <View style={styles.rangeTextWrap}>
          <Text style={styles.rangeTitle}>{rangeTitle}</Text>
          <Text style={styles.rangeSubtitle}>{rangeLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={goNext}
          disabled={activeOffset <= 0}
          style={[styles.rangeButton, activeOffset <= 0 && styles.rangeButtonDisabled]}
        >
          <Ionicons name="chevron-forward" size={18} color={textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {!isPremium ? (
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.lockedCard}
          >
            <View style={styles.lockedIconWrap}>
              <Ionicons name="lock-closed" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.lockedTitle}>Become a Premium member to access your insights!</Text>
            <Text style={styles.lockedSubtitle}>
              Weekly and monthly reports help you track progress across tasks, habits, sleep, focus mode, and more.
            </Text>
            <Button
              title="Upgrade to Premium"
              onPress={() => navigation.navigate('Paywall', { source: 'insights' })}
              icon="star"
              style={styles.upgradeButton}
              disableTranslation
            />
          </LinearGradient>
        ) : (
          <>
            <LinearGradient
              colors={gradients.hero}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>Productivity Score</Text>
                <View style={styles.heroScoreRow}>
                  <Text style={styles.heroScore}>{productivityScore}</Text>
                  <Text style={styles.heroScoreUnit}>/100</Text>
                </View>
                <View style={styles.heroDeltaRow}>
                  <Ionicons name={productivityDeltaIcon} size={14} color="#FFFFFF" />
                  <Text style={styles.heroDeltaText}>{productivityDeltaText}</Text>
                </View>
              </View>
              <View style={styles.heroBadge}>
                <Ionicons name="ribbon-outline" size={22} color="#FFFFFF" />
              </View>
            </LinearGradient>

            <View style={styles.quickStatsRow}>
              <LinearGradient
                colors={gradients.streak}
                style={[styles.quickStatCard, styles.quickStatCardFirst]}
              >
                <View style={styles.quickStatIcon}>
                  <Ionicons name="flame" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickStatValue}>{currentStreak}</Text>
                <Text style={styles.quickStatLabel}>Current streak</Text>
              </LinearGradient>
              <LinearGradient colors={gradients.completion} style={styles.quickStatCard}>
                <View style={styles.quickStatIcon}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.quickStatValue}>{completionRate}%</Text>
                <Text style={styles.quickStatLabel}>Completion</Text>
              </LinearGradient>
            </View>

            <Card style={styles.activityCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{activityTitle}</Text>
                <View style={styles.legendRow}>
                  {activityData.series.map((item) => (
                    <View key={item.label} style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <Text style={styles.legendLabel}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <ActivityChart
                width={chartWidth}
                height={160}
                labels={activityData.labels}
                series={activityData.series}
                gridColor={chartGridColor}
                styles={styles}
              />
            </Card>

            <Card style={styles.breakdownCard}>
              <Text style={styles.sectionTitle}>Productivity Breakdown</Text>
              <View style={styles.breakdownRow}>
                <DonutChart size={150} stroke={18} data={breakdownItems} trackColor={donutTrack} />
                <View style={styles.breakdownLegend}>
                  {breakdownItems.map((item) => (
                    <View key={item.label} style={styles.breakdownItem}>
                      <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                      <View>
                        <Text style={styles.breakdownLabel}>{item.label}</Text>
                        <Text style={styles.breakdownValue}>{item.display}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </Card>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Key Metrics</Text>
              {keyMetrics.map((item) => (
                <Card key={item.key} style={styles.metricRow}>
                  <View style={styles.metricRowContent}>
                    <View
                      style={[
                        styles.metricIconWrap,
                        { backgroundColor: withAlpha(item.accent, 0.16) },
                      ]}
                    >
                      <Ionicons name={item.icon} size={18} color={item.accent} />
                    </View>
                    <View style={styles.metricText}>
                      <Text style={styles.metricTitle}>{item.title}</Text>
                      <Text style={styles.metricValue}>{item.value}</Text>
                      <Text style={styles.metricSubtitle}>{item.subtitle}</Text>
                    </View>
                    <TrendBadge
                      value={item.change}
                      styles={styles}
                      upColor={trendColors.up}
                      downColor={trendColors.down}
                    />
                  </View>
                </Card>
              ))}
            </View>

            <View style={styles.sectionBlock}>
              <Text style={styles.sectionHeading}>Additional Metrics</Text>
              {additionalMetrics.map((item) => (
                <Card key={item.key} style={styles.additionalRow}>
                  <View style={styles.additionalRowContent}>
                    <View
                      style={[
                        styles.metricIconWrap,
                        { backgroundColor: withAlpha(item.accent, 0.16) },
                      ]}
                    >
                      <Ionicons name={item.icon} size={18} color={item.accent} />
                    </View>
                    <View style={styles.additionalText}>
                      <Text style={styles.additionalTitle}>{item.title}</Text>
                      <Text style={styles.additionalSubtitle}>{item.subtitle}</Text>
                    </View>
                    <Text style={styles.additionalValue}>{item.value}</Text>
                  </View>
                </Card>
              ))}
            </View>

            <LinearGradient
              colors={gradients.insight}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.insightCard}
            >
              <View style={styles.insightTitleRow}>
                <View style={styles.insightIconWrap}>
                  <Ionicons name="bulb" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.insightTitle}>Insight of the Week</Text>
              </View>
              <Text style={styles.insightText}>{insightMessage}</Text>
            </LinearGradient>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (themeColorsParam, isDark = false) => {
  const theme = themeColorsParam || colors;
  const text = theme.text || colors.text;
  const textSecondary = theme.textSecondary || colors.textSecondary;
  const background = isDark ? theme.background : '#F6F4FF';
  const card = isDark ? '#121826' : '#FFFFFF';
  const softCard = isDark ? '#1C2333' : '#F2EFFB';
  const border = isDark ? 'rgba(148,163,184,0.2)' : '#E9E4FF';
  const mutedText = isDark ? '#A7AEC0' : textSecondary;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softCard,
    },
    headerTitleWrap: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    headerIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? '#2A213D' : '#EFE7FF',
      marginRight: spacing.sm,
    },
    headerTitle: { ...typography.h2, color: text },
    headerSpacer: { width: 36 },
    tabs: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.xl,
      padding: spacing.xs,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: softCard,
    },
    tabPillWrap: { flex: 1 },
    tabPillActive: {
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabPillInactive: {
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tabText: { ...typography.bodySmall, color: mutedText, fontWeight: '700' },
    tabTextActive: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
    rangeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: border,
      backgroundColor: card,
      ...shadows.small,
    },
    rangeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: softCard,
    },
    rangeButtonDisabled: { opacity: 0.4 },
    rangeTextWrap: { flex: 1, alignItems: 'center' },
    rangeTitle: { ...typography.body, fontWeight: '700', color: text },
    rangeSubtitle: { ...typography.caption, color: mutedText, marginTop: 2 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
    heroCard: {
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      ...shadows.large,
    },
    heroContent: { flex: 1 },
    heroLabel: { ...typography.bodySmall, color: 'rgba(255,255,255,0.9)' },
    heroScoreRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginTop: spacing.sm,
    },
    heroScore: { fontSize: 36, fontWeight: '700', color: '#FFFFFF' },
    heroScoreUnit: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.75)',
      marginLeft: spacing.xs,
      marginBottom: 4,
    },
    heroDeltaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    heroDeltaText: {
      ...typography.caption,
      color: '#FFFFFF',
      marginLeft: spacing.xs,
    },
    heroBadge: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginLeft: spacing.md,
    },
    quickStatsRow: {
      flexDirection: 'row',
      marginTop: spacing.lg,
      justifyContent: 'space-between',
    },
    quickStatCard: {
      flex: 1,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      ...shadows.medium,
    },
    quickStatCardFirst: {
      marginRight: spacing.md,
    },
    quickStatIcon: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.2)',
      marginBottom: spacing.sm,
    },
    quickStatValue: { fontSize: 24, fontWeight: '700', color: '#FFFFFF' },
    quickStatLabel: {
      ...typography.caption,
      color: 'rgba(255,255,255,0.85)',
      marginTop: 2,
    },
    activityCard: { marginTop: spacing.lg, padding: spacing.lg },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    sectionTitle: { ...typography.h3, color: text },
    legendRow: { flexDirection: 'row', alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginLeft: spacing.sm },
    legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
    legendLabel: { ...typography.caption, color: mutedText },
    chartLabelsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
    },
    chartLabel: { ...typography.caption, color: mutedText },
    breakdownCard: { marginTop: spacing.lg, padding: spacing.lg },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
    breakdownLegend: { flex: 1, marginLeft: spacing.lg },
    breakdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    breakdownLabel: { ...typography.caption, color: mutedText },
    breakdownValue: { ...typography.body, fontWeight: '700', color: text },
    sectionBlock: { marginTop: spacing.lg },
    sectionHeading: { ...typography.h3, color: text, marginBottom: spacing.sm },
    metricRow: { padding: spacing.md, marginBottom: spacing.md },
    metricRowContent: { flexDirection: 'row', alignItems: 'center' },
    metricIconWrap: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    metricText: { flex: 1 },
    metricTitle: { ...typography.bodySmall, fontWeight: '700', color: text },
    metricValue: { ...typography.h3, color: text, marginTop: 2 },
    metricSubtitle: { ...typography.caption, color: mutedText, marginTop: 2 },
    metricBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: borderRadius.full,
      borderWidth: 1,
    },
    metricBadgeUp: {
      backgroundColor: withAlpha(colors.success, isDark ? 0.2 : 0.15),
      borderColor: withAlpha(colors.success, isDark ? 0.4 : 0.3),
    },
    metricBadgeDown: {
      backgroundColor: withAlpha(colors.danger, isDark ? 0.2 : 0.15),
      borderColor: withAlpha(colors.danger, isDark ? 0.4 : 0.3),
    },
    metricBadgeText: { ...typography.caption, fontWeight: '700', marginLeft: 4 },
    additionalRow: { padding: spacing.md, marginBottom: spacing.md },
    additionalRowContent: { flexDirection: 'row', alignItems: 'center' },
    additionalText: { flex: 1 },
    additionalTitle: { ...typography.bodySmall, fontWeight: '700', color: text },
    additionalSubtitle: { ...typography.caption, color: mutedText, marginTop: 2 },
    additionalValue: { ...typography.body, fontWeight: '700', color: text },
    insightCard: {
      marginTop: spacing.lg,
      marginBottom: spacing.xl,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      ...shadows.large,
    },
    insightTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    insightIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.25)',
      marginRight: spacing.sm,
    },
    insightTitle: { ...typography.h3, color: '#FFFFFF' },
    insightText: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.9)',
      lineHeight: 20,
    },
    lockedCard: {
      marginTop: spacing.lg,
      borderRadius: borderRadius.xl,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
      overflow: 'hidden',
      ...shadows.large,
    },
    lockedIconWrap: {
      width: 46,
      height: 46,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    lockedTitle: { ...typography.h3, color: '#FFFFFF' },
    lockedSubtitle: {
      ...typography.bodySmall,
      color: 'rgba(255,255,255,0.85)',
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    upgradeButton: {
      backgroundColor: '#FACC15',
      borderWidth: 1,
      borderColor: '#b8860b',
    },
  });
};
