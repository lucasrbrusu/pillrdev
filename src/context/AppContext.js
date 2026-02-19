import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { colors, typography } from '../utils/theme';
import themePresets from '../utils/themePresets';
import { supabase } from '../utils/supabaseClient';
import { addAppUsageMs, splitDurationByLocalDay } from '../utils/insightsTracking';
import { migrateLegacyStorageKeys } from '../utils/storageMigration';
import {
  requestNotificationPermissionAsync,
  cancelAllScheduledNotificationsAsync,
  cancelScheduledNotificationAsync,
  scheduleLocalNotificationAsync,
  buildDateWithTime,
  formatFriendlyDateTime,
  formatTimeFromDate,
  getExpoPushTokenAsync,
} from '../utils/notifications';
import uuid from 'react-native-uuid';
import { getPremiumEntitlementStatus, setRevenueCatUserId } from '../../RevenueCat';

const AppContext = createContext();

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

const STORAGE_KEYS = {
  HABITS: '@pillaflow_habits',
  TASKS: '@pillaflow_tasks',
  NOTES: '@pillaflow_notes',
  HEALTH: '@pillaflow_health',
  HEALTH_FOOD_LOGS: '@pillaflow_health_food_logs',
  ROUTINES: '@pillaflow_routines',
  CHORES: '@pillaflow_chores',
  REMINDERS: '@pillaflow_reminders',
  GROCERIES: '@pillaflow_groceries',
  FINANCES: '@pillaflow_finances',
  BUDGETS: '@pillaflow_budgets',
  BUDGET_ASSIGNMENTS: '@pillaflow_budget_assignments',
  PROFILE: '@pillaflow_profile',
  THEME: '@pillaflow_theme',
  AUTH_USER: '@pillaflow_auth_user',
  ONBOARDING: '@pillaflow_onboarding_complete',
  STREAK_FROZEN_PREFIX: '@pillaflow_streak_frozen_',
  LAST_ACTIVE_PREFIX: '@pillaflow_last_active_',
  PUSH_DEVICE_ID: '@pillaflow_push_device_id',
};

const SUPABASE_STORAGE_KEYS = [
  'supabase.auth.token',
  'sb-ueiptamivkuwhswotwpn-auth-token',
];

const defaultProfile = {
  name: 'User',
  username: '',
  email: 'user@pillaflow.app',
  photo: null,
  dailyCalorieGoal: 2000,
  preferredDailyCalorieGoal: 2000,
  dailyWaterGoal: 2,
  dailySleepGoal: 8,
  weightManagerUnit: 'kg',
  weightManagerCurrentWeight: null,
  weightManagerTargetWeight: null,
  weightManagerCurrentBodyType: 'muscular',
  weightManagerTargetBodyType: 'muscular',
  weightManagerTargetCalories: null,
  weightManagerProteinGrams: null,
  weightManagerCarbsGrams: null,
  weightManagerFatGrams: null,
  profileId: null,
  plan: 'free',
  premiumExpiresAt: null,
  isPremium: false,
  hasCompletedAppTutorial: false,
  appTutorialCompletedAt: null,
  hasCompletedHabitsTutorial: null,
  habitsTutorialCompletedAt: null,
};

const defaultHealthDay = () => ({
  mood: null,
  waterIntake: 0,
  sleepTime: null,
  wakeTime: null,
  sleepQuality: null,
  calorieGoal: null,
  proteinGoal: null,
  carbsGoal: null,
  fatGoal: null,
  calories: 0,
  foods: [],
  waterLogs: [],
  healthDayId: null,
  createdAt: null,
  updatedAt: null,
});

const defaultUserSettings = {
  id: null,
  themeName: 'default',
  notificationsEnabled: true,
  habitRemindersEnabled: true,
  taskRemindersEnabled: true,
  healthRemindersEnabled: true,
  defaultCurrencyCode: 'USD',
};

const DEFAULT_EVENT_TIME = { hour: 9, minute: 0 };
const REMINDER_LEAD_MINUTES = 30;
const HABIT_REMINDER_TIME = { hour: 8, minute: 0 };
const HEALTH_REMINDER_TIME = { hour: 20, minute: 0 };
const STREAK_FREEZE_REMINDER_TIME = { hour: 9, minute: 0 };
const STREAK_FREEZE_WINDOW_MS = 24 * 60 * 60 * 1000;
const IOS_MAX_SCHEDULED_NOTIFICATIONS = 60;
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;
// Poll less frequently to reduce Supabase egress (friend/user status checks).
const STATUS_POLL_INTERVAL_MS = 5 * 60 * 1000;
const PRESENCE_WRITE_INTERVAL_MS = 2 * 60 * 1000;
const DATA_REFRESH_TTL_MS = 5 * 60 * 1000;
const PROFILE_CACHE_TTL_MS = 30 * 60 * 1000;
const PUSH_REGISTRATION_TTL_MS = 12 * 60 * 60 * 1000;
const FRIEND_SEARCH_CACHE_TTL_MS = 30 * 1000;
const FRIEND_SEARCH_LIMIT = 20;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const computeIsPremium = (plan, premiumExpiresAt, explicitFlag) => {
  if (explicitFlag === true) return true;

  const normalizedPlan = (plan || '').toLowerCase();
  const isPremiumPlan =
    normalizedPlan === 'premium' ||
    normalizedPlan === 'pro' ||
    normalizedPlan === 'paid';
  if (!isPremiumPlan) return false;

  if (!premiumExpiresAt) return true;

  const coerceExpiryMs = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number') {
      // Heuristic: seconds vs milliseconds
      return value < 1e12 ? value * 1000 : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      if (/^\d+$/.test(trimmed)) {
        const n = Number(trimmed);
        if (!Number.isFinite(n)) return null;
        return n < 1e12 ? n * 1000 : n;
      }
      const parsed = new Date(trimmed).getTime();
      return Number.isNaN(parsed) ? null : parsed;
    }
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  };

  const expiryMs = coerceExpiryMs(premiumExpiresAt);
  if (!expiryMs) return true;
  return expiryMs > Date.now();
};

const normalizeRevenueCatExpiration = (entitlement, explicitExpiration) => {
  if (explicitExpiration) return explicitExpiration;
  if (!entitlement) return null;
  return (
    entitlement.expirationDate ||
    entitlement.expiresDate ||
    entitlement.expirationDateMillis ||
    entitlement.expirationDateMs ||
    entitlement.expiresDateMillis ||
    entitlement.expiresDateMs ||
    entitlement.expiration_date ||
    entitlement.expires_date ||
    null
  );
};

const getLastActiveKey = (userId) => `${STORAGE_KEYS.LAST_ACTIVE_PREFIX}${userId}`;
const getStreakFrozenKey = (userId) => `${STORAGE_KEYS.STREAK_FROZEN_PREFIX}${userId}`;
const getFoodLogsKey = (userId) => `${STORAGE_KEYS.HEALTH_FOOD_LOGS}_${userId || 'anon'}`;
const getProfileStorageKey = (userId) => `${STORAGE_KEYS.PROFILE}_${userId || 'anon'}`;

const readLastActive = async (userId) => {
  if (!userId) return null;
  const value = await AsyncStorage.getItem(getLastActiveKey(userId));
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const writeLastActive = async (userId, date = new Date()) => {
  if (!userId) return;
  await AsyncStorage.setItem(getLastActiveKey(userId), date.toISOString());
};

const readStreakFrozen = async (userId) => {
  if (!userId) return false;
  const value = await AsyncStorage.getItem(getStreakFrozenKey(userId));
  if (!value) return false;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'boolean') return parsed;
    return !!parsed?.frozen;
  } catch (e) {
    return false;
  }
};

const writeStreakFrozen = async (userId, frozen) => {
  if (!userId) return;
  if (frozen) {
    await AsyncStorage.setItem(
      getStreakFrozenKey(userId),
      JSON.stringify({ frozen: true, updatedAt: new Date().toISOString() })
    );
    return;
  }
  await AsyncStorage.removeItem(getStreakFrozenKey(userId));
};

const getOrCreatePushDeviceId = async () => {
  const cached = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_DEVICE_ID);
  if (cached) return cached;
  const generated = uuid.v4();
  const deviceId = typeof generated === 'string' ? generated : String(generated);
  await AsyncStorage.setItem(STORAGE_KEYS.PUSH_DEVICE_ID, deviceId);
  return deviceId;
};

const getExpoProjectId = () =>
  Constants?.easConfig?.projectId ||
  Constants?.expoConfig?.extra?.eas?.projectId ||
  Constants?.expoConfig?.projectId ||
  null;

const asNumber = (value, fallback = null) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string' && value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeFoodMacro = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const mapHealthRow = (row, fallback = defaultHealthDay()) => {
  if (!row) return { ...defaultHealthDay(), ...fallback };
  const calorieGoal =
    row.calorie_goal === null || row.calorie_goal === undefined
      ? fallback.calorieGoal
      : asNumber(row.calorie_goal, fallback.calorieGoal);
  const proteinGoal =
    row.protein_goal === null || row.protein_goal === undefined
      ? fallback.proteinGoal
      : asNumber(row.protein_goal, fallback.proteinGoal);
  const carbsGoal =
    row.carbs_goal === null || row.carbs_goal === undefined
      ? fallback.carbsGoal
      : asNumber(row.carbs_goal, fallback.carbsGoal);
  const fatGoal =
    row.fat_goal === null || row.fat_goal === undefined
      ? fallback.fatGoal
      : asNumber(row.fat_goal, fallback.fatGoal);
  return {
    ...fallback,
    mood: asNumber(row.mood, fallback.mood),
    waterIntake: asNumber(row.water_intake, fallback.waterIntake),
    sleepTime: row.sleep_time ?? fallback.sleepTime,
    wakeTime: row.wake_time ?? fallback.wakeTime,
    sleepQuality: row.sleep_quality ?? fallback.sleepQuality,
    calorieGoal,
    proteinGoal,
    carbsGoal,
    fatGoal,
    calories: asNumber(row.calories, fallback.calories),
    foods: Array.isArray(row.foods) ? row.foods : fallback.foods,
    healthDayId: row.id ?? fallback.healthDayId,
    createdAt: row.created_at ?? fallback.createdAt,
    updatedAt: row.updated_at ?? fallback.updatedAt,
  };
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const normalizeStreakGoalPeriod = (value) => {
  const normalized = String(value || 'day').toLowerCase();
  if (normalized === 'week' || normalized === 'month') return normalized;
  return 'day';
};

const toStartOfLocalDay = (value) => {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const toUtcDayNumberFromLocalDay = (value) => {
  const date = toStartOfLocalDay(value);
  if (!date) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
};

const getStreakPeriodIndex = (value, goalPeriod = 'day') => {
  const period = normalizeStreakGoalPeriod(goalPeriod);
  const dayStart = toStartOfLocalDay(value);
  if (!dayStart) return null;

  if (period === 'month') {
    return dayStart.getFullYear() * 12 + dayStart.getMonth();
  }

  const dayNumber = toUtcDayNumberFromLocalDay(dayStart);
  if (!Number.isFinite(dayNumber)) return null;
  if (period === 'week') return Math.floor((dayNumber + 3) / 7);
  return dayNumber;
};

const computeCurrentHabitStreak = (completedDates = [], goalPeriod = 'day', referenceDate = new Date()) => {
  const periodIndices = Array.from(
    new Set(
      (completedDates || [])
        .map((value) => getStreakPeriodIndex(value, goalPeriod))
        .filter((index) => Number.isFinite(index))
    )
  ).sort((a, b) => a - b);

  if (!periodIndices.length) return 0;

  const currentPeriodIndex = getStreakPeriodIndex(referenceDate, goalPeriod);
  if (!Number.isFinite(currentPeriodIndex)) return 0;

  const latestCompletedPeriod = periodIndices[periodIndices.length - 1];
  if (currentPeriodIndex - latestCompletedPeriod > 1) return 0;

  const periodSet = new Set(periodIndices);
  let streak = 0;
  let cursor = latestCompletedPeriod;
  while (periodSet.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
};

const isQuitHabit = (habit = {}) =>
  (habit?.habitType || habit?.habit_type || 'build') === 'quit';

const getHabitGoalValue = (habit = {}) =>
  Math.max(1, Number(habit?.goalValue ?? habit?.goal_value) || 1);

const resolveHabitStartDate = (habit = {}, referenceDate = new Date()) => {
  const candidates = [
    habit?.startDate,
    habit?.start_date,
    habit?.createdAt,
    habit?.created_at,
    referenceDate,
  ];
  for (const candidate of candidates) {
    const parsed = toStartOfLocalDay(candidate);
    if (parsed) return parsed;
  }
  return toStartOfLocalDay(referenceDate);
};

const computeQuitHabitStreak = (habit = {}, options = {}) => {
  const goalValue = getHabitGoalValue(habit);
  const goalPeriod = habit?.goalPeriod || habit?.goal_period || 'day';
  const referenceDate = options?.referenceDate || new Date();
  const progressByDate = options?.progressByDate || habit?.progressByDate || {};

  const currentPeriodIndex = getStreakPeriodIndex(referenceDate, goalPeriod);
  if (!Number.isFinite(currentPeriodIndex)) return 0;

  const startDate = resolveHabitStartDate(habit, referenceDate);
  const startPeriodIndex = getStreakPeriodIndex(startDate, goalPeriod);
  if (!Number.isFinite(startPeriodIndex) || currentPeriodIndex < startPeriodIndex) return 0;

  const failedPeriodIndices = new Set();
  Object.entries(progressByDate).forEach(([dateKey, rawAmount]) => {
    const amount = Number(rawAmount) || 0;
    if (amount <= goalValue) return;
    const periodIndex = getStreakPeriodIndex(dateKey, goalPeriod);
    if (!Number.isFinite(periodIndex)) return;
    if (periodIndex < startPeriodIndex || periodIndex > currentPeriodIndex) return;
    failedPeriodIndices.add(periodIndex);
  });

  let streak = 0;
  for (let cursor = currentPeriodIndex; cursor >= startPeriodIndex; cursor -= 1) {
    if (failedPeriodIndices.has(cursor)) break;
    streak += 1;
  }
  return streak;
};

const computeHabitStreak = (habit = {}, options = {}) => {
  const completedDates = options?.completedDates || habit?.completedDates || [];
  const progressByDate = options?.progressByDate || habit?.progressByDate || {};
  const goalPeriod = habit?.goalPeriod || habit?.goal_period || 'day';
  const referenceDate = options?.referenceDate || new Date();

  if (isQuitHabit(habit)) {
    return computeQuitHabitStreak(habit, { progressByDate, referenceDate });
  }
  return computeCurrentHabitStreak(completedDates, goalPeriod, referenceDate);
};

const isQuitAmountCompleted = (amount, goalValue) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return true;
  return numericAmount <= Math.max(1, Number(goalValue) || 1);
};

const getUniqueHabitPeriodIndices = (completedDates = [], goalPeriod = 'day') =>
  Array.from(
    new Set(
      (completedDates || [])
        .map((value) => getStreakPeriodIndex(value, goalPeriod))
        .filter((index) => Number.isFinite(index))
    )
  ).sort((a, b) => a - b);

const dayNumberToLocalDate = (dayNumber) => {
  if (!Number.isFinite(dayNumber)) return null;
  const utcDate = new Date(dayNumber * MS_PER_DAY);
  if (Number.isNaN(utcDate.getTime())) return null;
  return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
};

const getPeriodStartDateFromIndex = (periodIndex, goalPeriod = 'day') => {
  if (!Number.isFinite(periodIndex)) return null;
  const period = normalizeStreakGoalPeriod(goalPeriod);

  if (period === 'month') {
    const year = Math.floor(periodIndex / 12);
    const month = periodIndex - year * 12;
    return new Date(year, month, 1);
  }

  if (period === 'week') {
    const weekStartDayNumber = periodIndex * 7 - 3;
    return dayNumberToLocalDate(weekStartDayNumber);
  }

  return dayNumberToLocalDate(periodIndex);
};

const getMissedHabitPeriodMeta = (habit, referenceDate = new Date()) => {
  if (!habit || !habit.id) return null;
  if ((habit.streak || 0) <= 0) return null;
  if (isQuitHabit(habit)) return null;

  const goalPeriod = habit.goalPeriod || 'day';
  const periodIndices = getUniqueHabitPeriodIndices(habit.completedDates || [], goalPeriod);
  if (!periodIndices.length) return null;

  const latestCompletedPeriodIndex = periodIndices[periodIndices.length - 1];
  const currentPeriodIndex = getStreakPeriodIndex(referenceDate, goalPeriod);
  if (!Number.isFinite(currentPeriodIndex)) return null;

  const missedPeriodCount = currentPeriodIndex - latestCompletedPeriodIndex - 1;
  if (missedPeriodCount < 1) return null;

  const firstMissedPeriodIndex = latestCompletedPeriodIndex + 1;
  const firstMissedAt = getPeriodStartDateFromIndex(firstMissedPeriodIndex, goalPeriod);
  if (!firstMissedAt || Number.isNaN(firstMissedAt.getTime())) return null;

  return {
    habitId: habit.id,
    goalPeriod,
    missedPeriodCount,
    firstMissedAt,
  };
};

const getFoodEntryKey = (food, fallbackDate) => {
  if (!food) return '';
  const timestamp = food.timestamp || food.created_at || food.createdAt;
  if (timestamp) return `time:${timestamp}`;
  if (food.id) return `id:${food.id}`;
  const dateKey = normalizeDateKey(food.date || fallbackDate || timestamp);
  const name = (food.name || '').trim().toLowerCase();
  const calories = asNumber(food.calories, 0) || 0;
  return `fallback:${dateKey}:${name}:${calories}`;
};

const parseDateTimeParts = (value) => {
  if (!value) return { date: null, time: '', dateTimeISO: null };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return { date: value, time: '', dateTimeISO: null };
  }
  return {
    date: parsed.toISOString().slice(0, 10),
    time: formatTimeFromDate(parsed),
    dateTimeISO: parsed.toISOString(),
  };
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

const formatClockMinutes = (totalMinutes) => {
  if (!Number.isInteger(totalMinutes)) return '';
  const normalizedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  const nextDate = new Date();
  nextDate.setHours(hour, minute, 0, 0);
  return formatTimeFromDate(nextDate);
};

const normalizeRoutineTimeValue = (value) => {
  const parsedMinutes = parseClockMinutes(value);
  if (parsedMinutes === null) return '';
  return formatClockMinutes(parsedMinutes);
};

const normalizeRoutineScheduledTimes = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];

  value.forEach((item) => {
    const parsedMinutes = parseClockMinutes(item);
    if (parsedMinutes === null) return;
    const formatted = formatClockMinutes(parsedMinutes);
    if (!formatted || seen.has(formatted)) return;
    seen.add(formatted);
    normalized.push(formatted);
  });

  return normalized.sort((a, b) => {
    const aMinutes = parseClockMinutes(a);
    const bMinutes = parseClockMinutes(b);
    if (aMinutes === null && bMinutes === null) return 0;
    if (aMinutes === null) return 1;
    if (bMinutes === null) return -1;
    return aMinutes - bMinutes;
  });
};

const normalizeRoutineTimeRange = (source = {}) => {
  const fallbackTimes = normalizeRoutineScheduledTimes(
    source?.scheduledTimes !== undefined
      ? source.scheduledTimes
      : source?.scheduled_times
  );
  const startCandidate =
    source?.startTime !== undefined
      ? source.startTime
      : source?.start_time !== undefined
      ? source.start_time
      : fallbackTimes[0];
  const endCandidate =
    source?.endTime !== undefined
      ? source.endTime
      : source?.end_time !== undefined
      ? source.end_time
      : fallbackTimes[1];

  return {
    startTime: normalizeRoutineTimeValue(startCandidate),
    endTime: normalizeRoutineTimeValue(endCandidate),
  };
};

const mapWeightManagerLogRow = (row, unitFallback) => ({
  id: row?.id || null,
  userId: row?.user_id || null,
  weight: asNumber(row?.weight, null),
  unit: row?.unit || unitFallback || defaultProfile.weightManagerUnit,
  logDate: normalizeDateKey(row?.log_date || row?.date),
  createdAt: row?.created_at || null,
  updatedAt: row?.updated_at || null,
});

const sortWeightManagerLogs = (logs = []) =>
  [...logs].sort((a, b) => {
    const aDate = a?.logDate || '';
    const bDate = b?.logDate || '';
    if (aDate === bDate) {
      const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bCreated - aCreated;
    }
    return bDate.localeCompare(aDate);
  });

const normalizeNotificationIds = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (err) {
      // fall through for comma-separated values
    }
    return trimmed.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
};

const areNotificationIdsEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
};

const getNextDailyOccurrence = (hour, minute) => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
};

const getNextWeeklyOccurrence = (weekday, hour, minute) => {
  const now = new Date();
  const currentWeekday = now.getDay() + 1; // JS Sunday=0
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

const getAvatarPublicUrl = (path) => {
  if (!path) return null;
  if (typeof path !== 'string') return null;
  // Allow direct data URIs or remote URLs to be used as-is
  if (
    path.startsWith('data:image') ||
    path.startsWith('http://') ||
    path.startsWith('https://')
  ) {
    return path;
  }
  return null;
};

const pruneUndefined = (obj = {}) => {
  const clean = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v;
  });
  return clean;
};

const dedupeById = (items = []) => {
  const seen = new Set();
  return (items || []).filter((item) => {
    const key = item?.id || item?.sharedTaskId;
    if (!key) return false;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isInvalidRefreshTokenError = (error) => {
  if (!error) return false;
  const message = [error?.message, error?.error_description, error?.details]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return (
    message.includes('invalid refresh token') ||
    message.includes('refresh token not found')
  );
};

const TASK_ARCHIVE_WINDOW_MS = 24 * 60 * 60 * 1000;

const getTaskDueDateTime = (task) => {
  if (!task?.date) return null;
  return buildDateWithTime(task.date, task.time, 23, 59);
};

const getTaskSortMs = (task) => {
  const due = getTaskDueDateTime(task);
  if (due instanceof Date && !Number.isNaN(due.getTime())) return due.getTime();
  const created = new Date(task?.createdAt || task?.created_at || 0).getTime();
  if (Number.isFinite(created) && created > 0) return created;
  return 0;
};

const isTaskPastArchiveWindow = (task, nowMs = Date.now()) => {
  const due = getTaskDueDateTime(task);
  if (!(due instanceof Date) || Number.isNaN(due.getTime())) return false;
  return nowMs - due.getTime() >= TASK_ARCHIVE_WINDOW_MS;
};

const splitTaskBuckets = (items = [], nowMs = Date.now()) => {
  const active = [];
  const archived = [];
  const newlyArchivedIds = [];

  (items || []).forEach((task) => {
    const isPastArchiveWindow = isTaskPastArchiveWindow(task, nowMs);
    const isArchived = Boolean(task?.archivedAt) || isPastArchiveWindow;

    if (isArchived) {
      archived.push(task);
      if (!task?.archivedAt && isPastArchiveWindow && task?.id) {
        newlyArchivedIds.push(task.id);
      }
      return;
    }
    active.push(task);
  });

  active.sort((a, b) => getTaskSortMs(a) - getTaskSortMs(b));
  archived.sort((a, b) => getTaskSortMs(b) - getTaskSortMs(a));

  return {
    active: dedupeById(active),
    archived: dedupeById(archived),
    newlyArchivedIds: Array.from(new Set(newlyArchivedIds)),
  };
};


export const AppProvider = ({ children }) => {
  // Habits State
  const [habits, setHabits] = useState([]);
  const [habitCompletions, setHabitCompletions] = useState({});

  // Tasks State
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [notes, setNotes] = useState([]);

  // Health State
  const [healthData, setHealthData] = useState({});
  const [todayHealth, setTodayHealth] = useState(defaultHealthDay());
  const [foodLogs, setFoodLogs] = useState({});
  const [waterLogs, setWaterLogs] = useState({});
  const [weightManagerLogs, setWeightManagerLogs] = useState([]);

  // Routine State
  const [routines, setRoutines] = useState([]);
  const [chores, setChores] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [groceryLists, setGroceryLists] = useState([]);
  const [groceries, setGroceries] = useState([]);

  // Finance State
  const [finances, setFinances] = useState([]);
  const [budgetGroups, setBudgetGroups] = useState([]);
  const [budgetAssignments, setBudgetAssignments] = useState({});

  // Social/Friends State
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState({ incoming: [], outgoing: [], responses: [] });
  const [taskInvites, setTaskInvites] = useState({ incoming: [], outgoing: [], responses: [] });
  const [groups, setGroups] = useState([]);
  const [groupInvites, setGroupInvites] = useState({ incoming: [], outgoing: [], responses: [] });
  const [groupHabits, setGroupHabits] = useState([]);
  const [groupHabitCompletions, setGroupHabitCompletions] = useState({});
  const [groupRoutines, setGroupRoutines] = useState([]);
  const [userStatuses, setUserStatuses] = useState({});
const userStatusesRef = useRef({});
const lastPresenceUpdateRef = useRef(0);
const dataLoadTimestampsRef = useRef({});
const lastStatusPollRef = useRef(0);
const realtimePresenceChannelRef = useRef(null);
const realtimeFriendRequestChannelRef = useRef(null);
const realtimeFriendshipChannelRef = useRef(null);
const friendDataPromiseRef = useRef(null);
const healthDataPromiseRef = useRef(null);
const realtimeEnabledRef = useRef(false);
const profileCacheRef = useRef({});
const friendSearchCacheRef = useRef(new Map());
const friendSearchAbortControllerRef = useRef(null);
  const [blockedUsers, setBlockedUsers] = useState({ blocked: [], blockedBy: [] });
  const friendResponseSignatureRef = useRef('');
  const taskInviteResponseSignatureRef = useRef('');
  const groupInviteSignatureRef = useRef('');

 // Profile State
  const [profile, setProfile] = useState(defaultProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [userSettings, setUserSettings] = useState(defaultUserSettings);
  const [revenueCatPremium, setRevenueCatPremium] = useState({
    isActive: false,
    expiration: null,
    entitlementId: null,
    appUserId: null,
  });

  // Auth State
  const [authUser, setAuthUser] = useState(null);
  const [hasOnboarded, setHasOnboarded] = useState(false);
  const [themeName, setThemeName] = useState('default');
  const [themeColors, setThemeColors] = useState({ ...colors });
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    friendSearchCacheRef.current.clear();
    friendSearchAbortControllerRef.current?.abort?.();
    friendSearchAbortControllerRef.current = null;
  }, [authUser?.id]);

  const isPremiumUser = useMemo(
    () => {
      const rcMatchesUser =
        revenueCatPremium.isActive &&
        revenueCatPremium.appUserId &&
        authUser?.id &&
        revenueCatPremium.appUserId === String(authUser.id);
      const rcIsPremium =
        rcMatchesUser && computeIsPremium('premium', revenueCatPremium.expiration);
      return (
        rcIsPremium ||
        profile?.isPremium ||
        computeIsPremium(profile?.plan, profile?.premiumExpiresAt || profile?.premium_expires_at)
      );
    },
    [authUser?.id, profile, revenueCatPremium]
  );

  // Loading State
  const [isLoading, setIsLoading] = useState(true);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const streakCheckRanRef = useRef(false);
  const [streakFrozen, setStreakFrozen] = useState(false);
  const appStateRef = useRef(AppState.currentState);
  const appSessionStartMsRef = useRef(null);
  const notificationIdCacheRef = useRef({
    task: new Map(),
    reminder: new Map(),
    chore: new Map(),
    habit: new Map(),
    routine: new Map(),
  });
  const notificationColumnSupportRef = useRef({
    tasks: true,
    reminders: true,
    chores: true,
    habits: true,
    routines: true,
  });
  const pushRegistrationRef = useRef({
    userId: null,
    token: null,
    deviceId: null,
    lastAttemptMs: 0,
  });
  const reschedulingNotificationsRef = useRef(false);

  // Immutable snapshots of the original palettes and typography
  const defaultPaletteRef = useRef(
    JSON.parse(JSON.stringify(themePresets?.default?.colors || colors))
  );
  const darkPaletteRef = useRef(
    JSON.parse(JSON.stringify(themePresets?.dark?.colors || colors))
  );
  const baseTypographySnapshot = useRef(JSON.parse(JSON.stringify(typography)));

  const applyTheme = (name) => {
    const palette =
      name === 'dark' ? darkPaletteRef.current : defaultPaletteRef.current;

    // Reset shared colors to pristine default, then apply chosen palette
    Object.entries(defaultPaletteRef.current).forEach(([key, value]) => {
      colors[key] = value;
    });
    Object.entries(palette).forEach(([key, value]) => {
      colors[key] = value;
    });
    setThemeColors({ ...palette });

    // Reset typography and apply palette text colors
    Object.entries(baseTypographySnapshot.current).forEach(([key, value]) => {
      const isMuted = key === 'bodySmall' || key === 'caption';
      typography[key] = {
        ...value,
        color: isMuted ? (palette.textSecondary || palette.text) : palette.text,
      };
    });
  };

  const refreshRevenueCatPremium = useCallback(
    async (shouldAbort) => {
      const activeUserId = authUser?.id ? String(authUser.id) : null;
      try {
        if (!activeUserId) {
          await setRevenueCatUserId(null);
          if (!shouldAbort?.()) {
            setRevenueCatPremium({
              isActive: false,
              expiration: null,
              entitlementId: null,
              appUserId: null,
            });
          }
          return { entitlement: null, isActive: false, expiration: null, appUserId: null };
        }

        const configured = await setRevenueCatUserId(activeUserId);
        if (!configured) {
          if (!shouldAbort?.()) {
            setRevenueCatPremium({
              isActive: false,
              expiration: null,
              entitlementId: null,
              appUserId: activeUserId,
            });
          }
          return { entitlement: null, isActive: false, expiration: null, appUserId: activeUserId };
        }

        const { entitlement, isActive, expiration } = await getPremiumEntitlementStatus();
        if (shouldAbort?.()) return null;

        const normalizedExpiration = normalizeRevenueCatExpiration(entitlement, expiration);
        setRevenueCatPremium({
          isActive: !!isActive,
          expiration: normalizedExpiration,
          entitlementId: entitlement?.identifier || null,
          appUserId: activeUserId,
        });

        if (isActive && authUser?.id && String(authUser.id) === activeUserId) {
          setProfile((prev) => {
            if (shouldAbort?.()) return prev;
            const premiumExpiresAt =
              normalizedExpiration || prev.premiumExpiresAt || prev.premium_expires_at || null;
            return {
              ...prev,
              plan: prev.plan === 'premium' ? prev.plan : 'premium',
              premiumExpiresAt,
              premium_expires_at: premiumExpiresAt,
              isPremium: true,
            };
          });
        }

        return {
          entitlement,
          isActive: !!isActive,
          expiration: normalizedExpiration,
          appUserId: activeUserId,
        };
      } catch (error) {
        console.log('Error syncing RevenueCat entitlement:', error);
        return null;
      }
    },
    [authUser?.id, setProfile, setRevenueCatPremium]
  );

  // Load basic cached data and restore Supabase session on mount
  useEffect(() => {
    loadAllData();
  }, []);

  // Sync RevenueCat entitlement to local premium state
  useEffect(() => {
    let cancelled = false;
    refreshRevenueCatPremium(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [authUser?.id, refreshRevenueCatPremium]);

  const loadAllData = async () => {
  try {
    await migrateLegacyStorageKeys();

    const cachedTheme = await AsyncStorage.getItem(STORAGE_KEYS.THEME);
    if (cachedTheme) {
      setThemeName(cachedTheme);
      applyTheme(cachedTheme);
      setThemeReady(true);
    } else {
      // Apply default once so UI has a theme before async fetches return
      applyTheme('default');
      setThemeReady(true);
    }
    const storedRoutines = await AsyncStorage.getItem(STORAGE_KEYS.ROUTINES);

    if (storedRoutines) {
      try {
        const parsedRoutines = JSON.parse(storedRoutines);
        if (Array.isArray(parsedRoutines)) {
          setRoutines(
            parsedRoutines.map((routine) => ({
              ...routine,
              ...normalizeRoutineTimeRange(routine),
            }))
          );
        } else {
          setRoutines([]);
        }
      } catch (err) {
        console.log('Error parsing stored routines', err);
      }
    }

    // 🔐 Restore Supabase session (if user was logged in before)
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      const isInvalidRefresh = isInvalidRefreshTokenError(error);
      if (isInvalidRefresh) {
        await signOutLocal();
        await clearCachedSession();
        applyTheme('default');
      } else {
        console.log('Error getting Supabase session:', error);
      }
    } else if (session?.user) {
      await setActiveUser(session.user);
    } else {
      applyTheme('default');
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    if (!themeReady) setThemeReady(true);
    setIsLoading(false);
  }
  };

  const loadUserDataFromSupabase = async (userId) => {
  try {
    await Promise.all([
      fetchProfileFromSupabase(userId),
      fetchUserSettings(userId),
    ]);
  } catch (error) {
    console.error('Error loading user data from Supabase:', error);
  }
};

 useEffect(() => {
    if (authUser?.id) {
      // User logged in → load their data from Supabase
      loadUserDataFromSupabase(authUser.id);
    } else {
      // User logged out → clear in-memory state
      setHabits([]);
      setTasks([]);
      setArchivedTasks([]);
      setNotes([]);
      setHealthData({});
      setTodayHealth(defaultHealthDay());
      setWeightManagerLogs([]);
      setRoutines([]);
      setChores([]);
      setReminders([]);
      setGroceryLists([]);
      setGroceries([]);
      setFinances([]);
      setBudgetGroups([]);
      setBudgetAssignments({});
      setFriends([]);
      setFriendRequests({ incoming: [], outgoing: [], responses: [] });
      setTaskInvites({ incoming: [], outgoing: [], responses: [] });
      setGroups([]);
      setGroupInvites({ incoming: [], outgoing: [], responses: [] });
      setGroupHabits([]);
      setGroupHabitCompletions({});
      setGroupRoutines([]);
      setUserStatuses({});
      setBlockedUsers({ blocked: [], blockedBy: [] });
      setFoodLogs({});
      setWaterLogs({});
      setProfile(defaultProfile);
      setProfileLoaded(false);
      setUserSettings(defaultUserSettings);
      setRevenueCatPremium({
        isActive: false,
        expiration: null,
        entitlementId: null,
        appUserId: null,
      });
      setHasOnboarded(false);
      setThemeName('default');
      applyTheme('default');
    }
  }, [authUser]);

  // Track time spent in-app (foreground time) for Insights.
  useEffect(() => {
    const userId = authUser?.id;
    appStateRef.current = AppState.currentState;

    const flushSession = (endMs) => {
      if (!userId) return;
      const startMs = appSessionStartMsRef.current;
      if (!startMs || !endMs || endMs <= startMs) return;
      const parts = splitDurationByLocalDay(startMs, endMs);
      Object.entries(parts).forEach(([dateKey, ms]) => {
        addAppUsageMs(userId, dateKey, ms);
      });
    };

    if (!userId) {
      appSessionStartMsRef.current = null;
      return undefined;
    }

    if (AppState.currentState === 'active') {
      appSessionStartMsRef.current = Date.now();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;

      if (prevState === 'active' && nextState !== 'active') {
        flushSession(Date.now());
        appSessionStartMsRef.current = null;
        return;
      }

      if (prevState !== 'active' && nextState === 'active') {
        appSessionStartMsRef.current = Date.now();
      }
    });

    return () => {
      flushSession(Date.now());
      appSessionStartMsRef.current = null;
      sub?.remove?.();
    };
  }, [authUser?.id]);

  useEffect(() => {
    let isMounted = true;
    const hydrateStreakFreeze = async () => {
      if (!authUser?.id) {
        if (isMounted) setStreakFrozen(false);
        return;
      }
      const savedFrozen = await readStreakFrozen(authUser.id);
      if (isMounted) setStreakFrozen(!!savedFrozen);
    };

    hydrateStreakFreeze();
    return () => {
      isMounted = false;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return undefined;

    let isCancelled = false;
    let intervalId = null;

    const tick = async () => {
      if (isCancelled || appStateRef.current !== 'active') return;
      const now = Date.now();
      if (now - lastStatusPollRef.current < STATUS_POLL_INTERVAL_MS) return;
      lastStatusPollRef.current = now;
      await updateUserPresence();
      await fetchTaskInvites(authUser.id);
    };

    const startPolling = () => {
      if (intervalId) return;
      tick();
      intervalId = setInterval(tick, STATUS_POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    if (AppState.currentState === 'active') {
      startPolling();
    }

    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState === 'active') {
        startPolling();
      } else {
        stopPolling();
      }
    });

    return () => {
      isCancelled = true;
      stopPolling();
      sub?.remove?.();
    };
  }, [authUser?.id, fetchTaskInvites, refreshFriendStatuses, updateUserPresence]);

  useEffect(() => {
    userStatusesRef.current = userStatuses;
  }, [userStatuses]);

  // Supabase Realtime for presence + friend requests
  useEffect(() => {
    if (!authUser?.id) {
      realtimeEnabledRef.current = false;
      realtimePresenceChannelRef.current?.unsubscribe?.();
      realtimePresenceChannelRef.current = null;
      realtimeFriendRequestChannelRef.current?.unsubscribe?.();
      realtimeFriendRequestChannelRef.current = null;
      realtimeFriendshipChannelRef.current?.unsubscribe?.();
      realtimeFriendshipChannelRef.current = null;
      return undefined;
    }

    const handleStatusEvent = (payload) => {
      const row = payload?.new || payload?.old;
      const userId = row?.user_id;
      if (!userId) return;
      const lastSeen = row?.last_seen || null;
      setUserStatuses((prev) => ({ ...prev, [userId]: lastSeen }));
      setFriends((prev) =>
        prev.map((friend) => (friend.id === userId ? { ...friend, lastSeen } : friend))
      );
    };

    const presenceChannel = supabase
      .channel(`user:${authUser.id}:status`, { config: { broadcast: { self: true } }, type: 'private' })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_status' },
        handleStatusEvent
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeEnabledRef.current = true;
      });

    const friendRequestChannel = supabase
      .channel(`user:${authUser.id}:friend_requests`, { config: { broadcast: { self: true } }, type: 'private' })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        async () => {
          await fetchFriendRequests(authUser.id);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeEnabledRef.current = true;
      });

    const friendshipChannel = supabase
      .channel(`user:${authUser.id}:friendships`, { config: { broadcast: { self: true } }, type: 'private' })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships' },
        async () => {
          await refreshFriendData(authUser.id, { force: true });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') realtimeEnabledRef.current = true;
      });

    realtimePresenceChannelRef.current = presenceChannel;
    realtimeFriendRequestChannelRef.current = friendRequestChannel;
    realtimeFriendshipChannelRef.current = friendshipChannel;

    return () => {
      realtimeEnabledRef.current = false;
      presenceChannel?.unsubscribe?.();
      friendRequestChannel?.unsubscribe?.();
      friendshipChannel?.unsubscribe?.();
    };
  }, [authUser?.id, fetchFriendRequests, refreshFriendData, refreshFriendStatuses]);

  const shouldRefreshData = useCallback(
    (key, ttl = DATA_REFRESH_TTL_MS) => {
      const last = dataLoadTimestampsRef.current?.[key] || 0;
      return !last || Date.now() - last > ttl;
    },
    []
  );

const markDataLoaded = useCallback((key) => {
  dataLoadTimestampsRef.current[key] = Date.now();
}, []);

  const getCachedProfile = useCallback(
    (id) => {
      if (!id) return null;
      const entry = profileCacheRef.current?.[id];
      if (!entry) return null;
      const { data, ts } = entry;
      if (!data) return null;
      if (ts && Date.now() - ts > PROFILE_CACHE_TTL_MS) return null;
      return data;
    },
    []
  );

  const setCachedProfile = useCallback((id, data) => {
    if (!id || !data) return;
    profileCacheRef.current = {
      ...(profileCacheRef.current || {}),
      [id]: { data, ts: Date.now() },
    };
  }, []);

  // Save helpers
  const saveToStorage = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  const persistProfileLocally = useCallback(async (userId, profileData, onboardedValue) => {
    if (!userId || !profileData) return;
    const payload = pruneUndefined({
      profile: { ...defaultProfile, ...profileData },
      hasOnboarded: typeof onboardedValue === 'boolean' ? onboardedValue : undefined,
      cachedAt: new Date().toISOString(),
    });
    try {
      await AsyncStorage.setItem(getProfileStorageKey(userId), JSON.stringify(payload));
    } catch (err) {
      console.log('Error caching profile:', err);
    }
  }, []);

  const hydrateCachedProfile = useCallback(
    async (userId) => {
      if (!userId) return null;
      try {
        const storedProfile = await AsyncStorage.getItem(getProfileStorageKey(userId));
        if (!storedProfile) return null;

        const parsed = JSON.parse(storedProfile);
        const cachedProfile =
          parsed &&
          typeof parsed === 'object' &&
          parsed.profile &&
          typeof parsed.profile === 'object'
            ? parsed.profile
            : parsed;

        if (!cachedProfile || typeof cachedProfile !== 'object') return null;

        const mergedProfile = { ...defaultProfile, ...cachedProfile };
        setProfile(mergedProfile);
        setCachedProfile(userId, mergedProfile);
        if (typeof parsed?.hasOnboarded === 'boolean') {
          setHasOnboarded(parsed.hasOnboarded);
        }
        setProfileLoaded(true);
        return mergedProfile;
      } catch (err) {
        console.log('Error hydrating cached profile:', err);
        return null;
      }
    },
    [setCachedProfile]
  );

  const cacheThemeLocally = async (name) => {
    try {
      if (!name) {
        await AsyncStorage.removeItem(STORAGE_KEYS.THEME);
        return;
      }
      await AsyncStorage.setItem(STORAGE_KEYS.THEME, name);
    } catch (err) {
      console.log('Error caching theme:', err);
    }
  };

  const signOutLocal = async () => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      // Ignore sign-out failures; we'll clear local session keys anyway.
    }
  };

  const clearCachedSession = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter((key) => {
        if (key === STORAGE_KEYS.AUTH_USER) return true;
        if (SUPABASE_STORAGE_KEYS.includes(key)) return true;
        if (key.startsWith('sb-') && key.includes('-auth-token')) return true;
        return key.startsWith('supabase.auth');
      });
      if (!supabaseKeys.length) return;
      await AsyncStorage.multiRemove([...new Set(supabaseKeys)]);
    } catch (err) {
      console.log('Error clearing cached session keys:', err);
    }
  };

  const persistStreakFrozenState = useCallback(
    async (nextFrozen) => {
      setStreakFrozen(nextFrozen);
      if (authUser?.id) {
        await writeStreakFrozen(authUser.id, nextFrozen);
      }
    },
    [authUser?.id]
  );

  const persistRoutinesLocally = async (data) => {
    await saveToStorage(STORAGE_KEYS.ROUTINES, data);
  };

  const persistFoodLogsLocally = async (data, userId) => {
    if (!userId) return;
    await saveToStorage(getFoodLogsKey(userId), data);
  };

  const hydrateCachedFoodLogs = useCallback(async (userId) => {
    if (!userId) return null;
    const storedFoodLogs = await AsyncStorage.getItem(getFoodLogsKey(userId));
    if (!storedFoodLogs) return null;
    try {
      const parsed = JSON.parse(storedFoodLogs);
      setFoodLogs((prev) => {
        try {
          return JSON.stringify(prev || {}) === storedFoodLogs ? prev : parsed;
        } catch (serializeErr) {
          return parsed;
        }
      });
      return parsed;
    } catch (err) {
      console.log('Error parsing stored food logs', err);
      return null;
    }
  }, []);

const mapProfileSummary = (row) => ({
  id: row?.id || null,
  username: row?.username || '',
  name: row?.full_name || row?.name || row?.email || 'Unknown user',
  avatarUrl: getAvatarPublicUrl(row?.photo || row?.avatar_url || row?.avatar) || null,
});

const mapExternalProfile = (row) => ({
  id: row?.id || row?.user_id || null,
  username: row?.username || '',
  name: row?.full_name || row?.name || row?.email || 'Unknown user',
  email: row?.email || '',
  avatarUrl: getAvatarPublicUrl(row?.photo || row?.avatar_url || row?.avatar) || null,
  dailyCalorieGoal: row?.daily_calorie_goal ?? null,
  dailyWaterGoal: row?.daily_water_goal ?? null,
  dailySleepGoal: row?.daily_sleep_goal ?? null,
  plan: row?.plan || defaultProfile.plan,
  premiumExpiresAt: row?.premium_expires_at || row?.premiumExpiresAt || null,
});

  const updateUserPresence = useCallback(async () => {
    if (!authUser?.id) return;
    if (appStateRef.current !== 'active') return;

    const nowMs = Date.now();
    if (
      lastPresenceUpdateRef.current &&
      nowMs - lastPresenceUpdateRef.current < PRESENCE_WRITE_INTERVAL_MS
    ) {
      return;
    }
    lastPresenceUpdateRef.current = nowMs;

    const nowISO = new Date(nowMs).toISOString();
    setUserStatuses((prev) => ({ ...prev, [authUser.id]: nowISO }));
    try {
      const { error } = await supabase
        .from('user_status')
        .upsert({ user_id: authUser.id, last_seen: nowISO }, { onConflict: 'user_id' });

      // If FK fails because profile is missing, attempt to create the profile then retry once
      if (error?.code === '23503') {
        await upsertProfileRow({
          id: authUser.id,
          username: authUser?.user_metadata?.username || profile.username,
          full_name:
            authUser?.user_metadata?.full_name ||
            authUser?.user_metadata?.name ||
            profile.name ||
            authUser?.email,
          email: authUser?.email || profile.email,
        });
        const retry = await supabase
          .from('user_status')
          .upsert({ user_id: authUser.id, last_seen: nowISO }, { onConflict: 'user_id' });
        if (retry.error) {
          console.log('Error updating user status after profile upsert:', retry.error);
        }
      } else if (error) {
        console.log('Error updating user status:', error);
      }
    } catch (err) {
      console.log('Error updating user status:', err);
    }
  }, [authUser?.id, profile.name, profile.username, profile.email]);

  const fetchFriendships = useCallback(
    async (userIdParam, blockStateParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return [];

      const blockState = blockStateParam || blockedUsers;
      const blockedSet = new Set([
        ...((blockState?.blocked || [])),
        ...((blockState?.blockedBy || [])),
      ]);

      const { data, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching friendships:', error);
        return [];
      }

      const friendIds = Array.from(
        new Set(
          (data || [])
            .map((row) => (row.user_id === userId ? row.friend_id : row.user_id))
            .filter(Boolean)
        )
      ).filter((id) => !blockedSet.has(id));

      if (!friendIds.length) {
        setFriends([]);
        return [];
      }

      const profileMap = {};
      const missingIds = [];
      friendIds.forEach((id) => {
        const cached = getCachedProfile(id);
        if (cached) {
          profileMap[id] = cached;
        } else {
          missingIds.push(id);
        }
      });

      if (missingIds.length) {
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', missingIds);

        if (profileError) {
          console.log('Error fetching friend profiles:', profileError);
        } else {
          (profilesData || []).forEach((row) => {
            const mapped = mapProfileSummary(row);
            profileMap[row.id] = mapped;
            setCachedProfile(row.id, mapped);
          });
        }
      }

      const mapped = friendIds.map((id) => {
        const profileRow = profileMap[id] || {};
        return {
          id,
          ...mapProfileSummary(profileRow),
          lastSeen: (userStatusesRef.current || {})[id] || null,
        };
      });

      setFriends(mapped);
      return mapped;
    },
    [authUser?.id, blockedUsers.blocked, blockedUsers.blockedBy, getCachedProfile, setCachedProfile]
  );

  const fetchFriendRequests = useCallback(
    async (userIdParam, blockStateParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { incoming: [], outgoing: [], responses: [] };

      const blockState = blockStateParam || blockedUsers;
      const blockedSet = new Set([
        ...((blockState?.blocked || [])),
        ...((blockState?.blockedBy || [])),
      ]);

      const { data, error } = await supabase
        .from('friend_requests')
        .select('id, from_user_id, to_user_id, status, created_at')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.log('Error fetching friend requests:', error);
        return { incoming: [], outgoing: [] };
      }

      const involvedIds = Array.from(
        new Set(
          (data || [])
            .flatMap((row) => [row.from_user_id, row.to_user_id])
            .filter(Boolean)
        )
      );

      const profileLookup = {};
      const missingIds = [];
      involvedIds.forEach((id) => {
        const cached = getCachedProfile(id);
        if (cached) {
          profileLookup[id] = cached;
        } else {
          missingIds.push(id);
        }
      });

      if (missingIds.length) {
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', missingIds);

        if (profileError) {
          console.log('Error fetching friend request profiles:', profileError);
        } else {
          (profilesData || []).forEach((row) => {
            const mapped = mapProfileSummary(row);
            profileLookup[row.id] = mapped;
            setCachedProfile(row.id, mapped);
          });
        }
      }

      const mapped = (data || []).map((row) => ({
        ...row,
        fromUser: profileLookup[row.from_user_id] || null,
        toUser: profileLookup[row.to_user_id] || null,
      }));

      const filtered = mapped.filter(
        (row) => !blockedSet.has(row.from_user_id) && !blockedSet.has(row.to_user_id)
      );

      const incoming = filtered.filter(
        (row) => row.to_user_id === userId && row.status === 'pending'
      );
      const outgoing = filtered.filter(
        (row) => row.from_user_id === userId && row.status === 'pending'
      );
      const responses = filtered.filter(
        (row) => row.from_user_id === userId && row.status !== 'pending'
      );

      setFriendRequests({ incoming, outgoing, responses });

      const signature = responses.map((r) => `${r.id}:${r.status}`).join('|');
      if (signature !== friendResponseSignatureRef.current) {
        friendResponseSignatureRef.current = signature;
        if (responses.length) {
          // A response happened; refresh friendships so both sides see the new link
          await fetchFriendships(userId);
          if (!realtimeEnabledRef.current) {
            await refreshFriendStatuses();
          }
        }
      }

      return { incoming, outgoing, responses };
    },
    [authUser?.id, blockedUsers.blocked, blockedUsers.blockedBy, fetchFriendships, refreshFriendStatuses]
  );

  const isMissingRelationError = (error, relation) => {
    if (!error) return false;
    const message = (error.message || '').toLowerCase();
    const relationName = (relation || '').toLowerCase();
    return (
      error.code === '42P01' ||
      message.includes('does not exist') ||
      (relationName && message.includes(relationName))
    );
  };

  const isMissingFunctionError = (error, functionName) => {
    if (!error) return false;
    const message = (error.message || '').toLowerCase();
    const details = (error.details || '').toLowerCase();
    const hint = (error.hint || '').toLowerCase();
    const combined = `${message} ${details} ${hint}`;
    const fn = (functionName || '').toLowerCase();
    return (
      error.code === '42883' ||
      error.code === 'PGRST202' ||
      (combined.includes('could not find the function') && (!fn || combined.includes(fn))) ||
      (combined.includes('function') && combined.includes('does not exist') && (!fn || combined.includes(fn)))
    );
  };

  const fetchBlockedUsers = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { blocked: [], blockedBy: [] };

      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocker_id, blocked_user_id')
        .or(`blocker_id.eq.${userId},blocked_user_id.eq.${userId}`);

      if (error) {
        if (!isMissingRelationError(error, 'user_blocks')) {
          console.log('Error fetching blocked users:', error);
        }
        const empty = { blocked: [], blockedBy: [] };
        setBlockedUsers(empty);
        return empty;
      }

      const blocked = [];
      const blockedBy = [];
      (data || []).forEach((row) => {
        if (row.blocker_id === userId && row.blocked_user_id) {
          blocked.push(row.blocked_user_id);
        }
        if (row.blocked_user_id === userId && row.blocker_id) {
          blockedBy.push(row.blocker_id);
        }
      });
      const nextState = { blocked, blockedBy };
      setBlockedUsers(nextState);
      return nextState;
    },
    [authUser?.id, isMissingRelationError]
  );

  const fetchTaskInvites = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { incoming: [], outgoing: [], responses: [] };

      const { data, error } = await supabase
        .from('task_invites')
        .select(
          'id, from_user_id, to_user_id, status, task_id, task_title, task_description, task_priority, task_date, task_time, created_at'
        )
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (!isMissingRelationError(error, 'task_invites')) {
          console.log('Error fetching task invites:', error);
        }
        const empty = { incoming: [], outgoing: [], responses: [] };
        setTaskInvites(empty);
        return empty;
      }

      const invites = data || [];
      const involvedIds = Array.from(
        new Set(
          invites
            .flatMap((row) => [row.from_user_id, row.to_user_id])
            .filter(Boolean)
        )
      );

      let profileRows = [];
      if (involvedIds.length) {
        const { data: profilesData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, photo')
          .in('id', involvedIds);

        if (profileError) {
          console.log('Error fetching task invite profiles:', profileError);
        } else {
          profileRows = profilesData || [];
        }
      }

      const profileLookup = {};
      profileRows.forEach((row) => {
        profileLookup[row.id] = mapProfileSummary(row);
      });

      const mapped = invites.map((row) => ({
        ...row,
        fromUser: profileLookup[row.from_user_id] || null,
        toUser: profileLookup[row.to_user_id] || null,
        task: {
          id: row.task_id,
          title: row.task_title,
          description: row.task_description,
          priority: row.task_priority,
          date: row.task_date,
          time: row.task_time,
        },
      }));

      const incoming = mapped.filter(
        (row) => row.to_user_id === userId && row.status === 'pending'
      );
      const outgoing = mapped.filter(
        (row) => row.from_user_id === userId && row.status === 'pending'
      );
      const responses = mapped.filter(
        (row) => row.from_user_id === userId && row.status !== 'pending'
      );

      setTaskInvites({ incoming, outgoing, responses });

      const signature = responses.map((r) => `${r.id}:${r.status}`).join('|');
      if (signature !== taskInviteResponseSignatureRef.current) {
        taskInviteResponseSignatureRef.current = signature;
      }

      return { incoming, outgoing, responses };
    },
    [authUser?.id]
  );

  const fetchGroupMembers = useCallback(
    async (groupId) => {
      if (!authUser?.id || !groupId) return [];

      let memberRows = [];
      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, user_id, role')
        .eq('group_id', groupId);

      if (error) {
        console.log('Error fetching group members:', error);
      } else {
        memberRows = data || [];
      }

      let acceptedInvites = [];
      const { data: inviteRows, error: inviteError } = await supabase
        .from('group_invites')
        .select('group_id, to_user_id, from_user_id, status')
        .eq('group_id', groupId)
        .eq('status', 'accepted');

      if (inviteError) {
        console.log('Error fetching accepted group invites:', inviteError);
      } else {
        acceptedInvites = inviteRows || [];
      }

      const ids = Array.from(
        new Set(
          [
            ...memberRows.map((row) => row.user_id).filter(Boolean),
            ...acceptedInvites
              .flatMap((row) => [row.to_user_id, row.from_user_id])
              .filter(Boolean),
          ]
        )
      );

      if (!ids.length) return [];

      let profileMap = {};
      if (ids.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, photo')
          .in('id', ids);

        if (profileError) {
          console.log('Error fetching group member profiles:', profileError);
        } else {
          profileRows.forEach((row) => {
            profileMap[row.id] = mapProfileSummary(row);
          });
        }
      }

      const memberMap = {};
      const addMember = (userId, role = 'member') => {
        if (!userId || memberMap[userId]) return;
        memberMap[userId] = {
          id: userId,
          role,
          ...(profileMap[userId] || mapProfileSummary({ id: userId })),
        };
      };

      memberRows.forEach((row) => addMember(row.user_id, row.role || 'member'));
      acceptedInvites.forEach((row) => {
        addMember(row.from_user_id, row.role || 'member');
        addMember(row.to_user_id, 'member');
      });

      return Object.values(memberMap);
    },
    [authUser?.id]
  );

  const fetchGroups = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return [];

      const { data, error } = await supabase
        .from('group_members')
        .select('group_id, role, created_at, groups(id, name, owner_id, created_at)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error fetching groups:', error);
        setGroups([]);
        return [];
      }

      const groupIds = Array.from(
        new Set((data || []).map((row) => row.group_id || row.groups?.id).filter(Boolean))
      );

      let membersByGroup = {};
      let memberRows = [];
      let acceptedInvites = [];
      if (groupIds.length) {
        const [memberResult, inviteResult] = await Promise.all([
          supabase
            .from('group_members')
            .select('group_id, user_id, role')
            .in('group_id', groupIds),
          supabase
            .from('group_invites')
            .select('group_id, to_user_id, from_user_id, status')
            .in('group_id', groupIds)
            .eq('status', 'accepted'),
        ]);

        if (memberResult.error) {
          console.log('Error fetching group member roster:', memberResult.error);
        } else {
          memberRows = memberResult.data || [];
        }

        if (inviteResult.error) {
          console.log('Error fetching accepted group invites:', inviteResult.error);
        } else {
          acceptedInvites = inviteResult.data || [];
        }

        const ids = Array.from(
          new Set(
            [
              ...memberRows.map((row) => row.user_id).filter(Boolean),
              ...acceptedInvites
                .flatMap((row) => [row.to_user_id, row.from_user_id])
                .filter(Boolean),
            ]
          )
        );
        let profileMap = {};
        if (ids.length) {
          const { data: profileRows, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, photo')
            .in('id', ids);

          if (profileError) {
            console.log('Error fetching roster profiles:', profileError);
          } else {
            profileRows.forEach((row) => {
              profileMap[row.id] = mapProfileSummary(row);
            });
          }
        }

        const addMemberToGroup = (groupId, userId, role = 'member') => {
          if (!groupId || !userId) return;
          const list = membersByGroup[groupId] || [];
          if (list.some((m) => m.id === userId)) return;
          list.push({
            id: userId,
            role,
            ...(profileMap[userId] || mapProfileSummary({ id: userId })),
          });
          membersByGroup[groupId] = list;
        };

        memberRows.forEach((row) =>
          addMemberToGroup(row.group_id, row.user_id, row.role || 'member')
        );
        acceptedInvites.forEach((row) => {
          addMemberToGroup(row.group_id, row.from_user_id, row.role || 'member');
          addMemberToGroup(row.group_id, row.to_user_id, 'member');
        });
      }

      const mapped = (data || []).map((row) => {
        const id = row.group_id || row.groups?.id;
        return {
          id,
          name: row.groups?.name || 'Group',
          ownerId: row.groups?.owner_id || null,
          role: row.role || 'member',
          createdAt: row.groups?.created_at || row.created_at,
          members: membersByGroup[id] || [],
        };
      });

      setGroups(mapped);
      return mapped;
    },
    [authUser?.id]
  );

  const fetchGroupInvites = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return { incoming: [], outgoing: [], responses: [] };

      const { data, error } = await supabase
        .from('group_invites')
        .select('id, group_id, from_user_id, to_user_id, status, created_at')
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        if (!isMissingRelationError(error, 'group_invites')) {
          console.log('Error fetching group invites:', error);
        }
        const empty = { incoming: [], outgoing: [], responses: [] };
        setGroupInvites(empty);
        return empty;
      }

      const groupIds = Array.from(new Set((data || []).map((row) => row.group_id).filter(Boolean)));
      const userIds = Array.from(
        new Set(
          (data || [])
            .flatMap((row) => [row.from_user_id, row.to_user_id])
            .filter(Boolean)
        )
      );

      let groupMap = {};
      if (groupIds.length) {
        const { data: groupRows, error: groupError } = await supabase
          .from('groups')
          .select('id, name, owner_id, created_at')
          .in('id', groupIds);

        if (groupError) {
          console.log('Error fetching invite groups:', groupError);
        } else {
          groupRows.forEach((row) => {
            groupMap[row.id] = row;
          });
        }
      }

      let profileMap = {};
      if (userIds.length) {
        const { data: profileRows, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, photo')
          .in('id', userIds);

        if (profileError) {
          console.log('Error fetching group invite profiles:', profileError);
        } else {
          profileRows.forEach((row) => {
            profileMap[row.id] = mapProfileSummary(row);
          });
        }
      }

      const mapped = (data || []).map((row) => ({
        ...row,
        group: groupMap[row.group_id] || null,
        fromUser: profileMap[row.from_user_id] || null,
        toUser: profileMap[row.to_user_id] || null,
      }));

      const incoming = mapped.filter(
        (row) => row.to_user_id === userId && row.status === 'pending'
      );
      const outgoing = mapped.filter(
        (row) => row.from_user_id === userId && row.status === 'pending'
      );
      const responses = mapped.filter(
        (row) => row.from_user_id === userId && row.status !== 'pending'
      );

      setGroupInvites({ incoming, outgoing, responses });

      const signature = responses.map((r) => `${r.id}:${r.status}`).join('|');
      if (signature !== groupInviteSignatureRef.current) {
        groupInviteSignatureRef.current = signature;
      }

      return { incoming, outgoing, responses };
    },
    [authUser?.id]
  );

  const refreshGroupData = useCallback(
    async (userIdParam) => {
      const userId = userIdParam || authUser?.id;
      const fetchedGroups = await fetchGroups(userId);
      await Promise.all([
        fetchGroupInvites(userId),
        fetchGroupHabits(userId, fetchedGroups),
        fetchGroupRoutines(userId, fetchedGroups),
      ]);
      return fetchedGroups;
    },
    [authUser?.id, fetchGroups, fetchGroupInvites, fetchGroupHabits, fetchGroupRoutines]
  );

  const createGroup = useCallback(
    async ({ name, inviteUserIds = [] }) => {
      if (!authUser?.id) throw new Error('You must be logged in to create a group.');
      if (!isPremiumUser) throw new Error('Only premium users can create groups.');
      const trimmedName = (name || '').trim();
      if (!trimmedName) throw new Error('Group name is required.');

      const { data, error } = await supabase
        .from('groups')
        .insert({ name: trimmedName, owner_id: authUser.id })
        .select()
        .single();

      if (error) {
        console.log('Error creating group:', error);
        throw error;
      }

      const groupId = data.id;

      const { error: ownerMembershipError } = await supabase
        .from('group_members')
        .upsert({ group_id: groupId, user_id: authUser.id, role: 'owner' }, { onConflict: 'group_id,user_id' });

      if (ownerMembershipError) {
        console.log('Error adding owner to group_members:', ownerMembershipError);
        throw new Error(ownerMembershipError.message || 'Unable to create the group membership.');
      }

      if (inviteUserIds.length) {
        await supabase.from('group_invites').insert(
          inviteUserIds.map((id) => ({
            group_id: groupId,
            from_user_id: authUser.id,
            to_user_id: id,
            status: 'pending',
          }))
        );
      }

      await refreshGroupData(authUser.id);
      return data;
    },
    [authUser?.id, isPremiumUser, refreshGroupData]
  );

  const sendGroupInvites = useCallback(
    async ({ groupId, userIds }) => {
      if (!authUser?.id || !groupId) throw new Error('Missing group.');
      if (!isPremiumUser) throw new Error('Only premium users can invite to groups.');
      const ids = Array.from(new Set(userIds || [])).filter(Boolean);
      if (!ids.length) return [];

      const { data, error } = await supabase
        .from('group_invites')
        .insert(
          ids.map((id) => ({
            group_id: groupId,
            from_user_id: authUser.id,
            to_user_id: id,
            status: 'pending',
          }))
        )
        .select();

      if (error) {
        console.log('Error sending group invites:', error);
        throw error;
      }

      await fetchGroupInvites(authUser.id);
      return data;
    },
    [authUser?.id, fetchGroupInvites]
  );

  const respondToGroupInvite = useCallback(
    async (inviteId, status) => {
      if (!authUser?.id) throw new Error('You must be logged in.');
      if (!inviteId) throw new Error('Invalid invite.');
      const normalizedStatus = (status || '').toLowerCase();
      if (!['accepted', 'declined'].includes(normalizedStatus)) {
        throw new Error('Invalid response.');
      }

      const { data: invite, error: inviteError } = await supabase
        .from('group_invites')
        .select('id, group_id, to_user_id')
        .eq('id', inviteId)
        .single();

      if (inviteError || !invite) {
        console.log('Error loading group invite:', inviteError);
        throw new Error('Unable to load invite.');
      }

      if (invite.to_user_id !== authUser.id) {
        throw new Error('You cannot respond to this invite.');
      }

      const respondedAt = new Date().toISOString();

      if (normalizedStatus === 'accepted') {
        const { error: memberUpsertError } = await supabase
          .from('group_members')
          .upsert(
            { group_id: invite.group_id, user_id: authUser.id, role: 'member' },
            { onConflict: 'group_id,user_id' }
          );

        if (memberUpsertError) {
          console.log('Error adding accepted invite user to group_members:', memberUpsertError);
          throw new Error(memberUpsertError.message || 'Unable to join this group.');
        }
      }

      const { error: updateError } = await supabase
        .from('group_invites')
        .update({ status: normalizedStatus, responded_at: respondedAt })
        .eq('id', inviteId);

      if (updateError) {
        console.log('Error updating group invite:', updateError);
      }

      await refreshGroupData(authUser.id);
      return true;
    },
    [authUser?.id, refreshGroupData]
  );

  const deleteGroup = useCallback(
    async (groupId) => {
      if (!authUser?.id) throw new Error('You must be logged in to delete a group.');
      if (!groupId) throw new Error('Missing group.');

      const { data: groupRow, error: groupError } = await supabase
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (groupError) {
        console.log('Error loading group before delete:', groupError);
        throw new Error('Unable to delete this group right now.');
      }

      if (!groupRow || groupRow.owner_id !== authUser.id) {
        throw new Error('Only the group owner can delete this group.');
      }

      let habitIds = [];
      const { data: habitRows, error: habitError } = await supabase
        .from('group_habits')
        .select('id')
        .eq('group_id', groupId);

      if (habitError && !isMissingRelationError(habitError, 'group_habits')) {
        console.log('Error loading group habits before delete:', habitError);
      } else {
        habitIds = (habitRows || []).map((h) => h.id).filter(Boolean);
      }

      let routineIds = [];
      const { data: routineRows, error: routineError } = await supabase
        .from('group_routines')
        .select('id')
        .eq('group_id', groupId);

      if (routineError && !isMissingRelationError(routineError, 'group_routines')) {
        console.log('Error loading group routines before delete:', routineError);
      } else {
        routineIds = (routineRows || []).map((r) => r.id).filter(Boolean);
      }

      if (habitIds.length) {
        const { error: completionDeleteError } = await supabase
          .from('group_habit_completions')
          .delete()
          .in('group_habit_id', habitIds);
        if (
          completionDeleteError &&
          !isMissingRelationError(completionDeleteError, 'group_habit_completions')
        ) {
          console.log('Error deleting group habit completions:', completionDeleteError);
        }
      }

      if (routineIds.length) {
        const { error: taskDeleteError } = await supabase
          .from('group_routine_tasks')
          .delete()
          .in('group_routine_id', routineIds);
        if (taskDeleteError && !isMissingRelationError(taskDeleteError, 'group_routine_tasks')) {
          console.log('Error deleting group routine tasks:', taskDeleteError);
        }
      }

      const { error: habitDeleteError } = await supabase
        .from('group_habits')
        .delete()
        .eq('group_id', groupId);
      if (habitDeleteError && !isMissingRelationError(habitDeleteError, 'group_habits')) {
        console.log('Error deleting group habits:', habitDeleteError);
      }

      const { error: routineDeleteError } = await supabase
        .from('group_routines')
        .delete()
        .eq('group_id', groupId);
      if (routineDeleteError && !isMissingRelationError(routineDeleteError, 'group_routines')) {
        console.log('Error deleting group routines:', routineDeleteError);
      }

      const { error: inviteDeleteError } = await supabase
        .from('group_invites')
        .delete()
        .eq('group_id', groupId);
      if (inviteDeleteError && !isMissingRelationError(inviteDeleteError, 'group_invites')) {
        console.log('Error deleting group invites:', inviteDeleteError);
      }

      const { error: memberDeleteError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);
      if (memberDeleteError) {
        console.log('Error deleting group members:', memberDeleteError);
      }

      const { error: groupDeleteError } = await supabase.from('groups').delete().eq('id', groupId);
      if (groupDeleteError) {
        console.log('Error deleting group:', groupDeleteError);
        throw new Error('Unable to delete this group.');
      }

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      setGroupHabits((prev) => prev.filter((h) => h.groupId !== groupId));
      setGroupHabitCompletions((prev) => {
        if (!habitIds.length) return prev;
        const next = { ...prev };
        habitIds.forEach((id) => {
          if (next[id]) {
            delete next[id];
          }
        });
        return next;
      });
      setGroupRoutines((prev) => prev.filter((r) => r.groupId !== groupId));
      await refreshGroupData(authUser.id);
      return true;
    },
    [authUser?.id, refreshGroupData, isMissingRelationError]
  );

  const updateGroupName = useCallback(
    async (groupId, name) => {
      if (!authUser?.id) throw new Error('You must be logged in to update a group.');
      if (!groupId) throw new Error('Missing group.');
      const trimmedName = (name || '').trim();
      if (!trimmedName) throw new Error('Group name is required.');

      const { data: groupRow, error: groupError } = await supabase
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (groupError || !groupRow) {
        console.log('Error loading group before update:', groupError);
        throw new Error('Unable to update this group right now.');
      }

      if (groupRow.owner_id !== authUser.id) {
        throw new Error('Only the group admin can update this group.');
      }

      const { error } = await supabase
        .from('groups')
        .update({ name: trimmedName })
        .eq('id', groupId);

      if (error) {
        console.log('Error updating group:', error);
        throw new Error(error.message || 'Unable to update group.');
      }

      await refreshGroupData(authUser.id);
      return true;
    },
    [authUser?.id, refreshGroupData]
  );

  const removeGroupMember = useCallback(
    async (groupId, memberId) => {
      if (!authUser?.id) throw new Error('You must be logged in to remove a member.');
      if (!groupId || !memberId) throw new Error('Missing group or member.');

      const { data: groupRow, error: groupError } = await supabase
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (groupError || !groupRow) {
        console.log('Error loading group before removing member:', groupError);
        throw new Error('Unable to update this group right now.');
      }

      if (groupRow.owner_id !== authUser.id) {
        throw new Error('Only the group admin can remove members.');
      }

      if (memberId === groupRow.owner_id) {
        throw new Error('You cannot remove the group admin.');
      }

      const { error: kickRpcError } = await supabase.rpc('kick_group_member', {
        p_group_id: groupId,
        p_member_id: memberId,
      });

      if (kickRpcError && !isMissingFunctionError(kickRpcError, 'kick_group_member')) {
        console.log('Error kicking group member via RPC:', kickRpcError);
        throw new Error(kickRpcError.message || 'Unable to remove member.');
      }

      if (kickRpcError && isMissingFunctionError(kickRpcError, 'kick_group_member')) {
        // Backward-compatible fallback until the SQL function is applied.
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', memberId);

        if (error) {
          console.log('Error removing group member (fallback):', error);
          throw new Error(error.message || 'Unable to remove member.');
        }

        const { error: inviteCleanupError } = await supabase
          .from('group_invites')
          .delete()
          .eq('group_id', groupId)
          .or(`to_user_id.eq.${memberId},from_user_id.eq.${memberId}`);

        if (
          inviteCleanupError &&
          !isMissingRelationError(inviteCleanupError, 'group_invites')
        ) {
          console.log('Error removing kicked member invites (fallback):', inviteCleanupError);
          throw new Error(inviteCleanupError.message || 'Unable to fully remove member access.');
        }
      }

      await refreshGroupData(authUser.id);
      return true;
    },
    [authUser?.id, refreshGroupData, isMissingRelationError, isMissingFunctionError]
  );

  const leaveGroup = useCallback(
    async (groupId) => {
      if (!authUser?.id) throw new Error('You must be logged in to leave a group.');
      if (!groupId) throw new Error('Missing group.');

      const { data: groupRow, error: groupError } = await supabase
        .from('groups')
        .select('id, owner_id')
        .eq('id', groupId)
        .single();

      if (groupError || !groupRow) {
        console.log('Error loading group before leaving:', groupError);
        throw new Error('Unable to leave this group right now.');
      }

      if (groupRow.owner_id === authUser.id) {
        throw new Error('Admins must delete the group instead of leaving.');
      }

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', authUser.id);

      if (error) {
        console.log('Error leaving group:', error);
        throw new Error(error.message || 'Unable to leave this group.');
      }

      const { error: inviteCleanupError } = await supabase
        .from('group_invites')
        .delete()
        .eq('group_id', groupId)
        .or(`to_user_id.eq.${authUser.id},from_user_id.eq.${authUser.id}`);

      if (
        inviteCleanupError &&
        !isMissingRelationError(inviteCleanupError, 'group_invites')
      ) {
        console.log('Error removing group invites on leave:', inviteCleanupError);
      }

      await refreshGroupData(authUser.id);
      return true;
    },
    [authUser?.id, refreshGroupData, isMissingRelationError]
  );

  const fetchGroupHabits = useCallback(
    async (userIdParam, groupListParam) => {
      const userId = userIdParam || authUser?.id;
      const groupList = groupListParam || groups;
      const groupIds = (groupList || []).map((g) => g.id).filter(Boolean);
      if (!userId || !groupIds.length) {
        setGroupHabits([]);
        setGroupHabitCompletions({});
        return [];
      }

      const requiredColumns = [
        'id',
        'group_id',
        'title',
        'category',
        'description',
        'repeat',
        'days',
        'created_at',
        'created_by',
      ];
      const optionalColumns = [
        'color',
        'emoji',
        'habit_type',
        'goal_period',
        'goal_value',
        'goal_unit',
        'time_range',
        'reminders_enabled',
        'reminder_times',
        'reminder_message',
        'task_days_mode',
        'task_days_count',
        'month_days',
        'show_memo_after_completion',
        'chart_type',
        'start_date',
        'end_date',
        'source_habit_id',
      ];

      const fetchGroupHabitRows = async (columnList = []) =>
        supabase
          .from('group_habits')
          .select(columnList.join(', '))
          .in('group_id', groupIds)
          .order('created_at', { ascending: false });

      let data = null;
      let error = null;
      let remainingOptionalColumns = [...optionalColumns];

      for (
        let attemptIndex = 0;
        attemptIndex <= optionalColumns.length + 1;
        attemptIndex += 1
      ) {
        const selectColumns = [...requiredColumns, ...remainingOptionalColumns];
        ({ data, error } = await fetchGroupHabitRows(selectColumns));

        if (!error) break;
        if (!isMissingColumnError(error)) break;

        const missingColumn = extractMissingColumnName(error);
        if (
          missingColumn &&
          remainingOptionalColumns.includes(missingColumn)
        ) {
          remainingOptionalColumns = remainingOptionalColumns.filter(
            (columnName) => columnName !== missingColumn
          );
          continue;
        }

        if (!remainingOptionalColumns.length) break;
        remainingOptionalColumns = remainingOptionalColumns.slice(0, -1);
      }

      if (error) {
        if (!isMissingRelationError(error, 'group_habits')) {
          console.log('Error fetching group habits:', error);
        }
        setGroupHabits([]);
        setGroupHabitCompletions({});
        return [];
      }

      const habitIds = (data || []).map((h) => h.id).filter(Boolean);
      const completionMap = {};

      if (habitIds.length) {
        let { data: completionRows, error: completionError } = await supabase
          .from('group_habit_completions')
          .select('group_habit_id, user_id, date, amount')
          .in('group_habit_id', habitIds);

        if (completionError && isMissingColumnError(completionError, 'amount')) {
          ({ data: completionRows, error: completionError } = await supabase
            .from('group_habit_completions')
            .select('group_habit_id, user_id, date')
            .in('group_habit_id', habitIds));
        }

        if (completionError) {
          if (!isMissingRelationError(completionError, 'group_habit_completions')) {
            console.log('Error fetching group habit completions:', completionError);
          }
        } else {
          (completionRows || []).forEach((row) => {
            if (!row?.group_habit_id) return;
            const list = completionMap[row.group_habit_id] || [];
            list.push({
              habitId: row.group_habit_id,
              userId: row.user_id,
              date: normalizeDateKey(row.date),
              amount: Number(row.amount) || null,
            });
            completionMap[row.group_habit_id] = list;
          });
        }
      }

      const mapped = (data || []).map((h) => {
        const goalValue = Number(h.goal_value) || 1;
        return {
          id: h.id,
          groupId: h.group_id,
          title: h.title,
          category: h.category || 'Group',
          description: h.description,
          repeat: h.repeat || 'Daily',
          days: Array.isArray(h.days) ? h.days : [],
          createdAt: h.created_at,
          createdBy: h.created_by,
          habitType: h.habit_type || 'build',
          goalPeriod: h.goal_period || 'day',
          goalValue,
          goalUnit: h.goal_unit || 'times',
          timeRange: h.time_range || 'all_day',
          remindersEnabled: h.reminders_enabled ?? false,
          reminderTimes: Array.isArray(h.reminder_times) ? h.reminder_times : [],
          reminderMessage: h.reminder_message || '',
          taskDaysMode: h.task_days_mode || 'every_day',
          taskDaysCount: Number(h.task_days_count) || 3,
          monthDays: Array.isArray(h.month_days) ? h.month_days : [],
          showMemoAfterCompletion: h.show_memo_after_completion ?? false,
          chartType: h.chart_type || 'bar',
          startDate: h.start_date || null,
          endDate: h.end_date || null,
          sourceHabitId: h.source_habit_id || null,
          color: h.color ?? null,
          emoji: typeof h.emoji === 'string' ? h.emoji : '',
        };
      });

      setGroupHabits(mapped);
      setGroupHabitCompletions(completionMap);
      return mapped;
    },
    [authUser?.id, groups]
  );

  const addGroupHabit = useCallback(
    async ({
      groupId,
      title,
      category,
      description,
      repeat,
      days,
      emoji,
      color,
      habitType,
      goalPeriod,
      goalValue,
      goalUnit,
      timeRange,
      remindersEnabled,
      reminderTimes,
      reminderMessage,
      taskDaysMode,
      taskDaysCount,
      monthDays,
      showMemoAfterCompletion,
      chartType,
      startDate,
      endDate,
      sourceHabitId,
    }) => {
      if (!authUser?.id) throw new Error('You must be logged in to create a group habit.');
      if (!groupId) throw new Error('Select a group to share this habit with.');
      const trimmedTitle = (title || '').trim();
      if (!trimmedTitle) throw new Error('Habit title is required.');

      const compactObject = (value) =>
        Object.fromEntries(
          Object.entries(value || {}).filter(([, entry]) => entry !== undefined)
        );

      const baseInsert = {
        group_id: groupId,
        created_by: authUser.id,
        title: trimmedTitle,
        category: category || 'Group',
        description: description?.trim() || null,
        repeat: repeat || 'Daily',
        days: days || [],
        color: color || colors.habits,
        emoji: emoji || null,
      };
      const advancedInsert = {
        habit_type: habitType,
        goal_period: goalPeriod,
        goal_value: goalValue,
        goal_unit: goalUnit,
        time_range: timeRange,
        reminders_enabled: remindersEnabled,
        reminder_times: reminderTimes,
        reminder_message: reminderMessage,
        task_days_mode: taskDaysMode,
        task_days_count: taskDaysCount,
        month_days: monthDays,
        show_memo_after_completion: showMemoAfterCompletion,
        chart_type: chartType,
        start_date: startDate,
        end_date: endDate,
        source_habit_id: sourceHabitId || null,
      };

      let data = null;
      let error = null;
      const requiredColumns = new Set(['group_id', 'created_by', 'title']);
      const optionalDropOrder = [
        'chart_type',
        'show_memo_after_completion',
        'month_days',
        'task_days_count',
        'task_days_mode',
        'reminder_message',
        'reminder_times',
        'reminders_enabled',
        'time_range',
        'goal_unit',
        'goal_value',
        'goal_period',
        'habit_type',
        'end_date',
        'start_date',
        'emoji',
        'color',
        'source_habit_id',
        'days',
        'repeat',
        'description',
        'category',
      ];
      let payload = compactObject({ ...baseInsert, ...advancedInsert });

      for (
        let attemptIndex = 0;
        attemptIndex <= optionalDropOrder.length + 1;
        attemptIndex += 1
      ) {
        if (!Object.keys(payload).length) break;
        ({ data, error } = await supabase
          .from('group_habits')
          .insert(payload)
          .select()
          .single());

        if (!error) break;
        if (!isMissingColumnError(error)) break;

        const missingColumn = extractMissingColumnName(error);
        let removed = false;
        if (
          missingColumn &&
          Object.prototype.hasOwnProperty.call(payload, missingColumn) &&
          !requiredColumns.has(missingColumn)
        ) {
          delete payload[missingColumn];
          removed = true;
        } else {
          const fallbackColumn = optionalDropOrder.find(
            (columnName) =>
              Object.prototype.hasOwnProperty.call(payload, columnName) &&
              !requiredColumns.has(columnName)
          );
          if (fallbackColumn) {
            delete payload[fallbackColumn];
            removed = true;
          }
        }

        if (!removed) break;
      }

      if (error) {
        console.log('Error creating group habit:', error);
        throw error;
      }

      await fetchGroupHabits(authUser.id);
      return data;
    },
    [authUser?.id, fetchGroupHabits]
  );

  const updateGroupHabit = useCallback(
    async (habitId, updates = {}) => {
      if (!authUser?.id || !habitId) return;

      const existingHabit = (groupHabits || []).find((habit) => habit.id === habitId) || null;
      const updateData = {};
      const directFields = ['title', 'category', 'description', 'repeat', 'days', 'color', 'emoji'];
      directFields.forEach((key) => {
        if (updates[key] !== undefined) updateData[key] = updates[key];
      });
      if (updates.habitType !== undefined) updateData.habit_type = updates.habitType;
      if (updates.goalPeriod !== undefined) updateData.goal_period = updates.goalPeriod;
      if (updates.goalValue !== undefined) updateData.goal_value = updates.goalValue;
      if (updates.goalUnit !== undefined) updateData.goal_unit = updates.goalUnit;
      if (updates.timeRange !== undefined) updateData.time_range = updates.timeRange;
      if (updates.remindersEnabled !== undefined) updateData.reminders_enabled = updates.remindersEnabled;
      if (updates.reminderTimes !== undefined) updateData.reminder_times = updates.reminderTimes;
      if (updates.reminderMessage !== undefined) updateData.reminder_message = updates.reminderMessage;
      if (updates.taskDaysMode !== undefined) updateData.task_days_mode = updates.taskDaysMode;
      if (updates.taskDaysCount !== undefined) updateData.task_days_count = updates.taskDaysCount;
      if (updates.monthDays !== undefined) updateData.month_days = updates.monthDays;
      if (updates.showMemoAfterCompletion !== undefined)
        updateData.show_memo_after_completion = updates.showMemoAfterCompletion;
      if (updates.chartType !== undefined) updateData.chart_type = updates.chartType;
      if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
      if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
      if (updates.sourceHabitId !== undefined) updateData.source_habit_id = updates.sourceHabitId;

      if (Object.keys(updateData).length) {
        const optionalDropOrder = [
          'chart_type',
          'show_memo_after_completion',
          'month_days',
          'task_days_count',
          'task_days_mode',
          'reminder_message',
          'reminder_times',
          'reminders_enabled',
          'time_range',
          'goal_unit',
          'goal_value',
          'goal_period',
          'habit_type',
          'end_date',
          'start_date',
          'emoji',
          'color',
          'source_habit_id',
          'days',
          'repeat',
          'description',
          'category',
          'title',
        ];
        let payload = { ...updateData };
        let error = null;

        for (
          let attemptIndex = 0;
          attemptIndex <= optionalDropOrder.length + 1;
          attemptIndex += 1
        ) {
          if (!Object.keys(payload).length) {
            error = null;
            break;
          }
          let query = supabase.from('group_habits').update(payload).eq('id', habitId);
          if (existingHabit?.groupId) query = query.eq('group_id', existingHabit.groupId);
          ({ error } = await query);
          if (!error) break;
          if (!isMissingColumnError(error)) break;

          const missingColumn = extractMissingColumnName(error);
          if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
            delete payload[missingColumn];
            continue;
          }

          const fallbackColumn = optionalDropOrder.find((columnName) =>
            Object.prototype.hasOwnProperty.call(payload, columnName)
          );
          if (!fallbackColumn) break;
          delete payload[fallbackColumn];
        }

        if (error) {
          console.log('Error updating group habit:', error);
          return;
        }
      }

      setGroupHabits((prev) =>
        (prev || []).map((habit) => (habit.id === habitId ? { ...habit, ...updates } : habit))
      );
    },
    [authUser?.id, groupHabits]
  );

  const deleteGroupHabit = useCallback(
    async (habitId) => {
      if (!authUser?.id || !habitId) return false;

      const groupHabit = (groupHabits || []).find((habit) => habit.id === habitId) || null;
      const linkedSourceHabitId = groupHabit?.sourceHabitId || null;
      const linkedSourceHabit =
        linkedSourceHabitId && Array.isArray(habits)
          ? (habits || []).find((habit) => habit.id === linkedSourceHabitId) || null
          : null;
      const canDeleteLinkedSourceHabit = Boolean(
        linkedSourceHabit &&
          (!linkedSourceHabit.ownerId || linkedSourceHabit.ownerId === authUser.id)
      );

      // For mirrored personal/group habits, deleting either side should remove the source habit too.
      if (canDeleteLinkedSourceHabit) {
        await deleteHabit(linkedSourceHabitId);
        return true;
      }

      const { data: deletedRows, error } = await supabase
        .from('group_habits')
        .delete()
        .eq('id', habitId)
        .select('id');

      if (error) {
        console.log('Error deleting group habit:', error);
        throw error;
      }
      if (!Array.isArray(deletedRows) || !deletedRows.length) {
        throw new Error('Unable to delete this group habit from the database.');
      }

      setGroupHabits((prev) => (prev || []).filter((habit) => habit.id !== habitId));
      setGroupHabitCompletions((prev) => {
        if (!prev || !Object.prototype.hasOwnProperty.call(prev, habitId)) return prev;
        const next = { ...prev };
        delete next[habitId];
        return next;
      });
      return true;
    },
    [authUser?.id, groupHabits, habits]
  );

  const toggleGroupHabitCompletion = useCallback(
    async (habitId, options = {}) => {
      if (!authUser?.id || !habitId) return;
      const providedDate = normalizeDateKey(options?.dateISO);
      const targetDateISO = providedDate || new Date().toISOString().slice(0, 10);
      const amountOverride =
        options?.amount === null || options?.amount === undefined
          ? null
          : Math.max(0, Number(options.amount) || 0);
      const shouldSyncSourceHabit = options?.syncSourceHabit !== false;
      const groupHabit = (groupHabits || []).find((habit) => habit.id === habitId) || null;

      const completions = groupHabitCompletions[habitId] || [];
      const existing = completions.find(
        (c) => c.userId === authUser.id && normalizeDateKey(c.date) === targetDateISO
      );
      const nextAmount =
        amountOverride !== null
          ? amountOverride
          : existing
          ? 0
          : Math.max(1, Number(groupHabit?.goalValue) || 1);

      if (nextAmount <= 0) {
        const { error } = await supabase
          .from('group_habit_completions')
          .delete()
          .eq('group_habit_id', habitId)
          .eq('user_id', authUser.id)
          .eq('date', targetDateISO);

        if (error) {
          console.log('Error removing group habit completion:', error);
          return;
        }

        setGroupHabitCompletions((prev) => {
          const list = prev[habitId] || [];
          return {
            ...prev,
            [habitId]: list.filter(
              (c) => !(c.userId === authUser.id && normalizeDateKey(c.date) === targetDateISO)
            ),
          };
        });

        if (shouldSyncSourceHabit && groupHabit?.sourceHabitId) {
          await setHabitProgress(groupHabit.sourceHabitId, 0, targetDateISO, {
            syncLinkedGroupHabits: false,
          });
        }
        return;
      }

      await supabase
        .from('group_habit_completions')
        .delete()
        .eq('group_habit_id', habitId)
        .eq('user_id', authUser.id)
        .eq('date', targetDateISO);

      let { error } = await supabase
        .from('group_habit_completions')
        .insert({ group_habit_id: habitId, user_id: authUser.id, date: targetDateISO, amount: nextAmount });

      if (error && isMissingColumnError(error, 'amount')) {
        ({ error } = await supabase
          .from('group_habit_completions')
          .insert({ group_habit_id: habitId, user_id: authUser.id, date: targetDateISO }));
      }

      if (error) {
        console.log('Error adding group habit completion:', error);
        return;
      }

      setGroupHabitCompletions((prev) => {
        const list = (prev[habitId] || []).filter(
          (c) => !(c.userId === authUser.id && normalizeDateKey(c.date) === targetDateISO)
        );
        return {
          ...prev,
          [habitId]: [...list, { habitId, userId: authUser.id, date: targetDateISO, amount: nextAmount }],
        };
      });

      if (shouldSyncSourceHabit && groupHabit?.sourceHabitId) {
        await setHabitProgress(groupHabit.sourceHabitId, nextAmount, targetDateISO, {
          syncLinkedGroupHabits: false,
        });
      }
    },
    [authUser?.id, groupHabitCompletions, groupHabits, habits]
  );

  const fetchGroupRoutines = useCallback(
    async (userIdParam, groupListParam) => {
      const userId = userIdParam || authUser?.id;
      const groupList = groupListParam || groups;
      const groupIds = (groupList || []).map((g) => g.id).filter(Boolean);
      if (!userId || !groupIds.length) {
        setGroupRoutines([]);
        return [];
      }

      const requiredColumns = ['id', 'group_id', 'name', 'created_at', 'created_by'];
      const optionalColumns = ['start_time', 'end_time', 'scheduled_times'];
      const fetchGroupRoutineRows = async (columnList = []) =>
        supabase
          .from('group_routines')
          .select(columnList.join(', '))
          .in('group_id', groupIds)
          .order('created_at', { ascending: true });

      let data = null;
      let error = null;
      let remainingOptionalColumns = [...optionalColumns];

      for (
        let attemptIndex = 0;
        attemptIndex <= optionalColumns.length + 1;
        attemptIndex += 1
      ) {
        const selectColumns = [...requiredColumns, ...remainingOptionalColumns];
        ({ data, error } = await fetchGroupRoutineRows(selectColumns));

        if (!error) break;
        if (!isMissingColumnError(error)) break;

        const missingColumn = extractMissingColumnName(error);
        if (missingColumn && remainingOptionalColumns.includes(missingColumn)) {
          remainingOptionalColumns = remainingOptionalColumns.filter(
            (columnName) => columnName !== missingColumn
          );
          continue;
        }

        if (!remainingOptionalColumns.length) break;
        remainingOptionalColumns = remainingOptionalColumns.slice(0, -1);
      }

      if (error) {
        if (!isMissingRelationError(error, 'group_routines')) {
          console.log('Error fetching group routines:', error);
        }
        setGroupRoutines([]);
        return [];
      }

      const routineIds = (data || []).map((r) => r.id).filter(Boolean);
      let tasksByRoutine = {};
      if (routineIds.length) {
        const { data: taskRows, error: taskError } = await supabase
          .from('group_routine_tasks')
          .select('id, group_routine_id, name, position, created_at, created_by, user_id')
          .in('group_routine_id', routineIds)
          .order('position', { ascending: true });

        if (taskError) {
          if (!isMissingRelationError(taskError, 'group_routine_tasks')) {
            console.log('Error fetching group routine tasks:', taskError);
          }
        } else {
          tasksByRoutine = (taskRows || []).reduce((acc, row) => {
            const list = acc[row.group_routine_id] || [];
            list.push({
              id: row.id,
              name: row.name,
              position: row.position ?? list.length,
              createdAt: row.created_at,
              addedBy: row.created_by || row.user_id,
            });
            acc[row.group_routine_id] = list.sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0)
            );
            return acc;
          }, {});
        }
      }

      const mapped = (data || []).map((row) => ({
        id: row.id,
        groupId: row.group_id,
        name: row.name,
        createdAt: row.created_at,
        createdBy: row.created_by,
        ...normalizeRoutineTimeRange(row),
        tasks: tasksByRoutine[row.id] || [],
      }));

      setGroupRoutines(mapped);
      return mapped;
    },
    [authUser?.id, groups]
  );

  const addGroupRoutine = useCallback(
    async ({ groupId, name, startTime, endTime, scheduledTimes }) => {
      if (!authUser?.id) throw new Error('You must be logged in to create a group routine.');
      if (!groupId) throw new Error('Select a group for this routine.');
      const trimmedName = (name || '').trim();
      if (!trimmedName) throw new Error('Routine name is required.');
      const normalizedRange = normalizeRoutineTimeRange({
        startTime,
        endTime,
        scheduledTimes,
      });
      if (!normalizedRange.startTime || !normalizedRange.endTime) {
        throw new Error('Routine start and end times are required.');
      }

      const insertData = {
        group_id: groupId,
        name: trimmedName,
        created_by: authUser.id,
      };
      if (normalizedRange.startTime) {
        insertData.start_time = normalizedRange.startTime;
      }
      if (normalizedRange.endTime) {
        insertData.end_time = normalizedRange.endTime;
      }

      let { data, error } = await supabase
        .from('group_routines')
        .insert(insertData)
        .select()
        .single();

      if (
        error &&
        (insertData.start_time || insertData.end_time) &&
        (isMissingColumnError(error, 'start_time') || isMissingColumnError(error, 'end_time'))
      ) {
        const fallbackData = { ...insertData };
        delete fallbackData.start_time;
        delete fallbackData.end_time;
        ({ data, error } = await supabase
          .from('group_routines')
          .insert(fallbackData)
          .select()
          .single());
      }

      if (error) {
        console.log('Error creating group routine:', error);
        throw error;
      }

      await fetchGroupRoutines(authUser.id);
      return data;
    },
    [authUser?.id, fetchGroupRoutines]
  );

  const updateGroupRoutine = useCallback(
    async (routineId, updates = {}) => {
      if (!authUser?.id || !routineId) return null;
      const current = groupRoutines.find((item) => item.id === routineId);
      if (!current) return null;

      const nextName =
        updates.name !== undefined ? String(updates.name || '').trim() : current.name;
      if (!nextName) throw new Error('Routine name is required.');

      const hasTimeRangeUpdate =
        updates.startTime !== undefined ||
        updates.endTime !== undefined ||
        updates.start_time !== undefined ||
        updates.end_time !== undefined ||
        updates.scheduledTimes !== undefined ||
        updates.scheduled_times !== undefined;
      const nextTimeRange = hasTimeRangeUpdate
        ? normalizeRoutineTimeRange({
            ...current,
            ...updates,
          })
        : normalizeRoutineTimeRange(current);
      if (hasTimeRangeUpdate && (!nextTimeRange.startTime || !nextTimeRange.endTime)) {
        throw new Error('Routine start and end times are required.');
      }

      const updateData = { name: nextName };
      if (hasTimeRangeUpdate) {
        updateData.start_time = nextTimeRange.startTime || null;
        updateData.end_time = nextTimeRange.endTime || null;
      }

      let { error } = await supabase
        .from('group_routines')
        .update(updateData)
        .eq('id', routineId);

      if (
        error &&
        (hasTimeRangeUpdate || updateData.start_time || updateData.end_time) &&
        (isMissingColumnError(error, 'start_time') || isMissingColumnError(error, 'end_time'))
      ) {
        const fallbackData = { ...updateData };
        delete fallbackData.start_time;
        delete fallbackData.end_time;
        ({ error } = await supabase
          .from('group_routines')
          .update(fallbackData)
          .eq('id', routineId));
      }

      if (error && !isMissingRelationError(error, 'group_routines')) {
        console.log('Error updating group routine:', error);
        throw error;
      }

      const nextRoutine = {
        ...current,
        name: nextName,
        ...nextTimeRange,
      };

      setGroupRoutines((prev) =>
        prev.map((item) => (item.id === routineId ? nextRoutine : item))
      );

      return nextRoutine;
    },
    [authUser?.id, groupRoutines]
  );

  const deleteGroupRoutine = useCallback(
    async (routineId) => {
      if (!authUser?.id || !routineId) return;

      await supabase.from('group_routine_tasks').delete().eq('group_routine_id', routineId);
      const { error } = await supabase.from('group_routines').delete().eq('id', routineId);
      if (error && !isMissingRelationError(error, 'group_routines')) {
        console.log('Error deleting group routine:', error);
      }

      setGroupRoutines((prev) => prev.filter((r) => r.id !== routineId));
    },
    [authUser?.id]
  );

  const addTaskToGroupRoutine = useCallback(
    async (routineId, task) => {
      if (!authUser?.id || !routineId) return;

      const routine = groupRoutines.find((r) => r.id === routineId);
      if (!routine) return;

      const nextPosition = routine.tasks?.length || 0;
      const { data, error } = await supabase
        .from('group_routine_tasks')
        .insert({
          group_routine_id: routineId,
          name: task.name,
          position: nextPosition,
          created_by: authUser.id,
        })
        .select()
        .single();

      if (error) {
        console.log('Error adding task to group routine:', error);
        return;
      }

      const newTask = {
        id: data.id,
        name: data.name,
        position: data.position ?? nextPosition,
        createdAt: data.created_at,
        addedBy: data.created_by,
      };

      const updatedTasks = [...(routine.tasks || []), newTask].sort(
        (a, b) => (a.position ?? 0) - (b.position ?? 0)
      );

      setGroupRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, tasks: updatedTasks } : r))
      );
    },
    [authUser?.id, groupRoutines]
  );

  const removeTaskFromGroupRoutine = useCallback(
    async (routineId, taskId) => {
      if (!authUser?.id || !routineId || !taskId) return;

      const routine = groupRoutines.find((r) => r.id === routineId);
      if (!routine) return;

      const updatedTasks = (routine.tasks || []).filter((t) => t.id !== taskId);
      const resequenced = updatedTasks.map((t, idx) => ({ ...t, position: idx }));

      await supabase.from('group_routine_tasks').delete().eq('id', taskId);
      await Promise.all(
        resequenced.map((t) =>
          supabase.from('group_routine_tasks').update({ position: t.position }).eq('id', t.id)
        )
      );

      setGroupRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, tasks: resequenced } : r))
      );
    },
    [authUser?.id, groupRoutines]
  );

  const reorderGroupRoutineTasks = useCallback(
    async (routineId, newTaskOrder) => {
      if (!authUser?.id || !routineId) return;

      const routine = groupRoutines.find((r) => r.id === routineId);
      if (!routine) return;

      const resequenced = (newTaskOrder || []).map((t, idx) => ({ ...t, position: idx }));

      await Promise.all(
        resequenced.map((t) =>
          supabase.from('group_routine_tasks').update({ position: t.position }).eq('id', t.id)
        )
      );

      setGroupRoutines((prev) =>
        prev.map((r) => (r.id === routineId ? { ...r, tasks: resequenced } : r))
      );
    },
    [authUser?.id, groupRoutines]
  );

  const ensureTaskParticipant = async (taskId, participantTaskId, role = 'participant') => {
    if (!authUser?.id || !taskId) return;
    const { error } = await supabase
      .from('task_participants')
      .upsert(
        pruneUndefined({
          task_id: taskId,
          user_id: authUser.id,
          participant_task_id: participantTaskId ?? null,
          role,
        }),
        { onConflict: 'task_id,user_id' }
      );

    if (error && !isMissingRelationError(error, 'task_participants')) {
      console.log('Error ensuring task participant:', error);
    }
  };

  const shareTaskWithGroup = async ({ groupId, task }) => {
    if (!authUser?.id) throw new Error('You must be logged in to share a task with a group.');
    if (!groupId) throw new Error('Select a group.');
    if (!task?.title || !task?.date || !task?.time) {
      throw new Error('Task title, date, and time are required.');
    }

    const { data, error } = await supabase.rpc('share_task_with_group', {
      p_group_id: groupId,
      p_title: task.title,
      p_description: task.description || null,
      p_priority: task.priority || 'medium',
      p_date: task.date,
      p_time: task.time,
    });

    if (error) {
      if (isMissingFunctionError(error, 'share_task_with_group')) {
        throw new Error('Group task sharing is not enabled yet. Run supabase/group-task-sharing.sql.');
      }
      console.log('Error sharing task with group:', error);
      throw new Error(error.message || 'Unable to share this task with the selected group.');
    }

    const createdTask = {
      id: data.id,
      title: data.title,
      description: data.description || '',
      priority: data.priority || 'medium',
      date: data.date,
      time: data.time,
      completed: Boolean(data.completed),
      createdAt: data.created_at,
      archivedAt: data.archived_at || null,
      sharedTaskId: data.shared_task_id || data.id,
      groupId: data.group_id || groupId,
    };

    setTasks((prev) => dedupeById([...prev, createdTask]));
    setArchivedTasks((prev) => prev.filter((item) => item.id !== createdTask.id));
    return createdTask;
  };

  const sendTaskInvite = async ({ task, toUserId }) => {
    if (!authUser?.id) throw new Error('You must be logged in to invite someone.');
    if (!task?.id) throw new Error('Task is required.');
    if (!toUserId) throw new Error('Invalid user.');
    if (toUserId === authUser.id) throw new Error('You cannot invite yourself.');

    await ensureTaskParticipant(task.id, task.id, 'owner');

    const { data, error } = await supabase
      .from('task_invites')
      .insert(
        pruneUndefined({
          task_id: task.id,
          from_user_id: authUser.id,
          to_user_id: toUserId,
          task_title: task.title,
          task_description: task.description || null,
          task_priority: task.priority || 'medium',
          task_date: task.date || null,
          task_time: task.time || null,
          status: 'pending',
        })
      )
      .select()
      .single();

    if (error) {
      console.log('Error sending task invite:', error);
      throw error;
    }

    await fetchTaskInvites(authUser.id);
    return data;
  };

  const respondToTaskInvite = async (inviteId, status) => {
    if (!authUser?.id) throw new Error('You must be logged in.');
    if (!inviteId) throw new Error('Invalid invite.');

    const normalizedStatus = (status || '').toLowerCase();
    if (!['accepted', 'declined'].includes(normalizedStatus)) {
      throw new Error('Invalid response.');
    }

    const { data: invite, error: inviteError } = await supabase
      .from('task_invites')
      .select(
        'id, to_user_id, task_id, task_title, task_description, task_priority, task_date, task_time, status'
      )
      .eq('id', inviteId)
      .single();

    if (inviteError || !invite) {
      console.log('Error loading task invite:', inviteError);
      throw new Error('Unable to load invite.');
    }

    if (invite.to_user_id !== authUser.id) {
      throw new Error('You cannot respond to this invite.');
    }

    const respondedAt = new Date().toISOString();

    if (normalizedStatus === 'accepted') {
      if (!invite.task_date || !invite.task_time) {
        throw new Error('This invite is missing a date/time and cannot be scheduled.');
      }
      const { data: newRow, error: createError } = await supabase
        .from('tasks')
        .insert({
          user_id: authUser.id,
          title: invite.task_title,
          description: invite.task_description || null,
          priority: invite.task_priority || 'medium',
          date: invite.task_date,
          time: invite.task_time,
          completed: false,
        })
        .select()
        .single();

      if (createError) {
        console.log('Error creating invited task:', createError);
        throw new Error('Unable to create task.');
      }

      await ensureTaskParticipant(invite.task_id, newRow?.id, 'participant');

      const newTask = {
        id: newRow.id,
        title: newRow.title,
        description: newRow.description,
        priority: newRow.priority || 'medium',
        date: newRow.date,
        time: newRow.time,
        completed: newRow.completed,
        createdAt: newRow.created_at,
        archivedAt: newRow.archived_at || null,
        sharedTaskId: invite.task_id,
        groupId: newRow.group_id || null,
      };

      setTasks((prev) => dedupeById([...prev, newTask]));
    }

    const { error: updateError } = await supabase
      .from('task_invites')
      .update({ status: normalizedStatus, responded_at: respondedAt })
      .eq('id', inviteId);

    if (updateError) {
      console.log('Error updating task invite:', updateError);
    }

    await fetchTaskInvites(authUser.id);
    return true;
  };

  const fetchTaskParticipants = useCallback(
    async (taskId) => {
      if (!taskId || !authUser?.id) return [];

      // Resolve the shared/base task id even when we're looking at a participant's "copy"
      // task (participant_task_id). This avoids relying on local `sharedTaskId` being set.
      let baseTaskId = taskId;
      try {
        const { data: linkRow, error: linkError } = await supabase
          .from('task_participants')
          .select('task_id')
          .eq('user_id', authUser.id)
          .or(`task_id.eq.${taskId},participant_task_id.eq.${taskId}`)
          .limit(1)
          .maybeSingle();

        if (!linkError && linkRow?.task_id) {
          baseTaskId = linkRow.task_id;
        } else if (linkError && !isMissingRelationError(linkError, 'task_participants')) {
          console.log('Error resolving shared task id:', linkError);
        }
      } catch (err) {
        // ignore
      }

      const { data, error } = await supabase
        .from('task_participants')
        .select('user_id')
        .eq('task_id', baseTaskId);

      if (error) {
        if (!isMissingRelationError(error, 'task_participants')) {
          console.log('Error fetching task participants:', error);
        }
        return [];
      }

      const userIds = Array.from(new Set((data || []).map((r) => r.user_id).filter(Boolean)));
      if (!userIds.length) return [];

      // Profiles schema can be either id=auth.uid() or user_id=auth.uid(); try both without
      // assuming the non-existent column. Start with id-based select to avoid 42703 logs.
      const byIdSelect = 'id, username, full_name, avatar_url, photo';

      const { data: byIdData, error: byIdError } = await supabase
        .from('profiles')
        .select(byIdSelect)
        .in('id', userIds);

      if (!byIdError && Array.isArray(byIdData) && byIdData.length) {
        return byIdData.map((row) => mapProfileSummary(row));
      }

      if (byIdError && !isMissingColumnError(byIdError, 'id')) {
        console.log('Error fetching participant profiles (by id):', byIdError);
      }

      // Fallback for schemas that use user_id as the PK
      const userIdSelect = 'user_id, username, full_name, avatar_url, photo';
      const { data: byUserIdData, error: byUserIdError } = await supabase
        .from('profiles')
        .select(userIdSelect)
        .in('user_id', userIds);

      if (byUserIdError) {
        if (!isMissingColumnError(byUserIdError, 'user_id')) {
        console.log('Error fetching participant profiles (by user_id):', byUserIdError);
        }
        return [];
      }

      return (byUserIdData || []).map((row) =>
        mapProfileSummary({ ...row, id: row.user_id || row.id })
      );
    },
    [authUser?.id]
  );

  const refreshFriendStatuses = useCallback(
    async () => {
      // Status now updates exclusively via Supabase Realtime events to avoid REST egress.
      return;
    },
    []
  );

  const refreshFriendData = useCallback(
    async (userIdParam, { force } = {}) => {
      const userId = userIdParam || authUser?.id;
      if (!userId) return;
      if (!force && friendDataPromiseRef.current) return friendDataPromiseRef.current;

      const run = (async () => {
        const blockState = await fetchBlockedUsers(userId);
        const friendList = await fetchFriendships(userId, blockState);
        await fetchFriendRequests(userId, blockState);
        return { blockState, friendList };
      })();

      friendDataPromiseRef.current = run;
      try {
        return await run;
      } finally {
        if (friendDataPromiseRef.current === run) {
          friendDataPromiseRef.current = null;
        }
      }
      // User status updates now come only via Realtime, so skip REST status fetches.
    },
    [authUser?.id, fetchBlockedUsers, fetchFriendships, fetchFriendRequests, refreshFriendStatuses]
  );

  const ensureFriendDataLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('friends', ttl)) return;
      await refreshFriendData(userId, { force });
      markDataLoaded('friends');
    },
    [authUser?.id, markDataLoaded, refreshFriendData, shouldRefreshData]
  );

  const ensureTaskInvitesLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('taskInvites', ttl)) return;
      await fetchTaskInvites(userId);
      markDataLoaded('taskInvites');
    },
    [authUser?.id, fetchTaskInvites, markDataLoaded, shouldRefreshData]
  );

  const ensureGroupInvitesLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('groupInvites', ttl)) return;
      await fetchGroupInvites(userId);
      markDataLoaded('groupInvites');
    },
    [authUser?.id, fetchGroupInvites, markDataLoaded, shouldRefreshData]
  );

  const ensureTasksLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('tasks', ttl)) return;
      await fetchTasksFromSupabase(userId);
      markDataLoaded('tasks');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureNotesLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('notes', ttl)) return;
      await fetchNotesFromSupabase(userId);
      markDataLoaded('notes');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureHabitsLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('habits', ttl)) return;
      await fetchHabitsFromSupabase(userId);
      markDataLoaded('habits');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureHealthLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && healthDataPromiseRef.current) return healthDataPromiseRef.current;
      if (!force && !shouldRefreshData('health', ttl)) return;

      const run = (async () => {
        const cachedFoodLogs = await hydrateCachedFoodLogs(userId);
        await fetchHealthFromSupabase(userId, cachedFoodLogs);
        markDataLoaded('health');
      })();

      healthDataPromiseRef.current = run;
      try {
        return await run;
      } finally {
        if (healthDataPromiseRef.current === run) {
          healthDataPromiseRef.current = null;
        }
      }
    },
    [authUser?.id, hydrateCachedFoodLogs, markDataLoaded, shouldRefreshData]
  );

  const ensureWeightManagerLogsLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('weightManagerLogs', ttl)) return;
      await fetchWeightManagerLogsFromSupabase(userId);
      markDataLoaded('weightManagerLogs');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureRoutinesLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('routines', ttl)) return;
      await fetchRoutinesFromSupabase(userId);
      markDataLoaded('routines');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureChoresLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('chores', ttl)) return;
      await fetchChoresFromSupabase(userId);
      markDataLoaded('chores');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureRemindersLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('reminders', ttl)) return;
      await fetchRemindersFromSupabase(userId);
      markDataLoaded('reminders');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureGroceriesLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('groceries', ttl)) return;
      await fetchGroceriesFromSupabase(userId);
      markDataLoaded('groceries');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureFinancesLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('finances', ttl)) return;
      await Promise.all([
        fetchFinancesFromSupabase(userId),
        fetchBudgetGroupsFromSupabase(userId),
        fetchBudgetAssignmentsFromSupabase(userId),
      ]);
      markDataLoaded('finances');
      markDataLoaded('budgets');
    },
    [authUser?.id, markDataLoaded, shouldRefreshData]
  );

  const ensureGroupDataLoaded = useCallback(
    async ({ force, ttl } = {}) => {
      const userId = authUser?.id;
      if (!userId) return;
      if (!force && !shouldRefreshData('groups', ttl)) return;
      await refreshGroupData(userId);
      markDataLoaded('groups');
      markDataLoaded('groupInvites');
    },
    [authUser?.id, markDataLoaded, refreshGroupData, shouldRefreshData]
  );

  const ensureHomeDataLoaded = useCallback(async () => {
    await Promise.all([
      ensureTasksLoaded(),
      ensureHabitsLoaded(),
      ensureNotesLoaded(),
      ensureChoresLoaded(),
      ensureRemindersLoaded(),
      ensureGroceriesLoaded(),
      ensureFriendDataLoaded(),
      ensureGroupDataLoaded(),
      ensureTaskInvitesLoaded(),
    ]);
  }, [
    ensureChoresLoaded,
    ensureFriendDataLoaded,
    ensureGroupDataLoaded,
    ensureGroceriesLoaded,
    ensureHabitsLoaded,
    ensureNotesLoaded,
    ensureRemindersLoaded,
    ensureTaskInvitesLoaded,
    ensureTasksLoaded,
  ]);

  const isUserOnline = useCallback(
    (userId) => {
      const lastSeen = userStatuses[userId];
      if (!lastSeen) return false;
      const last = new Date(lastSeen).getTime();
      if (Number.isNaN(last)) return false;
      return Date.now() - last <= ONLINE_THRESHOLD_MS;
    },
    [userStatuses]
  );

  const isUserBlocked = useCallback(
    (userId) => (blockedUsers?.blocked || []).includes(userId),
    [blockedUsers.blocked]
  );

  const isBlockedByUser = useCallback(
    (userId) => (blockedUsers?.blockedBy || []).includes(userId),
    [blockedUsers.blockedBy]
  );

  const getFriendRelationship = useCallback(
    (userId) => {
      const blocked = isUserBlocked(userId);
      const blockedBy = isBlockedByUser(userId);
      if (blocked || blockedBy) {
        return { isFriend: false, incoming: null, outgoing: null, blocked, blockedBy };
      }
      const isFriend = friends.some((f) => f.id === userId);
      const incoming = friendRequests.incoming.find(
        (r) => r.from_user_id === userId && r.status === 'pending'
      );
      const outgoing = friendRequests.outgoing.find(
        (r) => r.to_user_id === userId && r.status === 'pending'
      );
      return { isFriend, incoming, outgoing, blocked, blockedBy };
    },
    [friends, friendRequests, isBlockedByUser, isUserBlocked]
  );

  const searchUsersByUsername = useCallback(
    async (query) => {
      if (!authUser?.id) return [];
      const trimmed = (query || '').trim().toLowerCase();
      if (trimmed.length < 2) {
        friendSearchAbortControllerRef.current?.abort?.();
        friendSearchAbortControllerRef.current = null;
        return [];
      }

      const nowMs = Date.now();
      const searchCache = friendSearchCacheRef.current;
      const cached = searchCache.get(trimmed);
      if (cached && cached.expiresAt > nowMs) {
        return (cached.rows || [])
          .map((row) => {
            const relationship = getFriendRelationship(row.id);
            if (relationship.blocked || relationship.blockedBy) return null;
            return {
              ...mapProfileSummary(row),
              isFriend: relationship.isFriend,
              pendingIncoming: !!relationship.incoming,
              pendingOutgoing: !!relationship.outgoing,
              isBlocked: relationship.blocked,
              blockedBy: relationship.blockedBy,
            };
          })
          .filter(Boolean);
      }

      searchCache.forEach((entry, key) => {
        if (!entry || entry.expiresAt <= nowMs) {
          searchCache.delete(key);
        }
      });

      friendSearchAbortControllerRef.current?.abort?.();
      const abortController =
        typeof AbortController !== 'undefined' ? new AbortController() : null;
      friendSearchAbortControllerRef.current = abortController;

      const prefixPattern = `${trimmed}%`;
      let queryBuilder = supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .ilike('username', prefixPattern)
        .neq('id', authUser.id)
        .order('username', { ascending: true })
        .limit(FRIEND_SEARCH_LIMIT);

      if (abortController?.signal) {
        queryBuilder = queryBuilder.abortSignal(abortController.signal);
      }

      let data = null;
      let error = null;
      try {
        ({ data, error } = await queryBuilder);
      } catch (err) {
        const combined = `${err?.name || ''} ${err?.message || ''}`.toLowerCase();
        if (combined.includes('abort')) return [];
        console.log('Error searching users:', err);
        return [];
      } finally {
        if (friendSearchAbortControllerRef.current === abortController) {
          friendSearchAbortControllerRef.current = null;
        }
      }

      const rows = data || [];
      if (error) {
        const combined = `${error?.name || ''} ${error?.message || ''}`.toLowerCase();
        if (combined.includes('abort')) return [];
        console.log('Error searching users:', error);
        return [];
      }

      searchCache.set(trimmed, {
        rows,
        expiresAt: nowMs + FRIEND_SEARCH_CACHE_TTL_MS,
      });

      return (rows || [])
        .map((row) => {
          const relationship = getFriendRelationship(row.id);
          if (relationship.blocked || relationship.blockedBy) return null;
          return {
            ...mapProfileSummary(row),
            isFriend: relationship.isFriend,
            pendingIncoming: !!relationship.incoming,
            pendingOutgoing: !!relationship.outgoing,
            isBlocked: relationship.blocked,
            blockedBy: relationship.blockedBy,
          };
        })
        .filter(Boolean);
    },
    [authUser?.id, getFriendRelationship]
  );

  const sendFriendRequest = useCallback(
    async (toUserId) => {
      if (!authUser?.id) throw new Error('You must be logged in to add a friend.');
      if (!toUserId) throw new Error('Invalid user.');
      if (toUserId === authUser.id) throw new Error('You cannot add yourself.');
      const existing = getFriendRelationship(toUserId);
      if (existing.blocked) throw new Error('You have blocked this user.');
      if (existing.blockedBy) throw new Error('This user has blocked you.');
      if (existing.isFriend) throw new Error('Already friends.');
      if (existing.incoming) {
        await respondToFriendRequest(existing.incoming.id, 'accepted');
        return existing.incoming;
      }
      if (existing.outgoing) return existing.outgoing;

      const { data, error } = await supabase
        .from('friend_requests')
        .insert({
          from_user_id: authUser.id,
          to_user_id: toUserId,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        console.log('Error sending friend request:', error);
        throw new Error(error.message || 'Unable to send friend request.');
      }

      await fetchFriendRequests(authUser.id);
      return data;
    },
    [authUser?.id, getFriendRelationship, fetchFriendRequests, respondToFriendRequest]
  );

  const respondToFriendRequest = useCallback(
    async (requestId, responseStatus = 'declined') => {
      if (!authUser?.id) throw new Error('You must be logged in to respond.');
      const normalized = responseStatus === 'accepted' ? 'accepted' : 'declined';
      const nowISO = new Date().toISOString();

      const { data, error } = await supabase
        .from('friend_requests')
        .update({ status: normalized, responded_at: nowISO })
        .eq('id', requestId)
        .eq('to_user_id', authUser.id)
        .select()
        .single();

      if (error) {
        console.log('Error responding to friend request:', error);
        throw new Error(error.message || 'Unable to respond to request.');
      }

      if (normalized === 'accepted' && data?.from_user_id) {
        const { error: friendError } = await supabase
          .from('friendships')
          .upsert(
            { user_id: authUser.id, friend_id: data.from_user_id, created_at: nowISO },
            { onConflict: 'user_id,friend_id' }
          );

        if (friendError && friendError.code !== '23505') {
          console.log('Error creating friendship:', friendError);
        }
      }

      await refreshFriendData(authUser.id);
      return data;
    },
    [authUser?.id, refreshFriendData]
  );

  const deleteFriend = useCallback(
    async (friendId) => {
      if (!authUser?.id || !friendId) return;
      const ids = [authUser.id, friendId];
      try {
        const { error } = await supabase
          .from('friendships')
          .delete()
          .or(
            `and(user_id.eq.${ids[0]},friend_id.eq.${ids[1]}),and(user_id.eq.${ids[1]},friend_id.eq.${ids[0]})`
          );
        if (error) {
          console.log('Error deleting friendship:', error);
          throw error;
        }
      } catch (err) {
        console.log('Error deleting friendship:', err);
        throw err;
      }
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
      await refreshFriendData(authUser.id);
    },
    [authUser?.id, refreshFriendData]
  );

  const blockUser = useCallback(
    async (targetUserId) => {
      if (!authUser?.id) throw new Error('You must be logged in to block someone.');
      if (!targetUserId || targetUserId === authUser.id) throw new Error('Invalid user.');
      const payload = {
        blocker_id: authUser.id,
        blocked_user_id: targetUserId,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_blocks')
        .upsert(payload, { onConflict: 'blocker_id,blocked_user_id' });

      if (error && !isMissingRelationError(error, 'user_blocks')) {
        console.log('Error blocking user:', error);
        throw new Error(error.message || 'Unable to block this user.');
      }

      try {
        await supabase
          .from('friendships')
          .delete()
          .or(
            `and(user_id.eq.${authUser.id},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${authUser.id})`
          );
      } catch (err) {
        if (!isMissingRelationError(err, 'friendships')) {
          console.log('Error clearing friendships while blocking:', err);
        }
      }

      try {
        await supabase
          .from('friend_requests')
          .delete()
          .or(
            `and(from_user_id.eq.${authUser.id},to_user_id.eq.${targetUserId}),and(from_user_id.eq.${targetUserId},to_user_id.eq.${authUser.id})`
          );
      } catch (err) {
        if (!isMissingRelationError(err, 'friend_requests')) {
          console.log('Error clearing friend requests while blocking:', err);
        }
      }

      setBlockedUsers((prev) => ({
        blocked: Array.from(new Set([...(prev?.blocked || []), targetUserId])),
        blockedBy: prev?.blockedBy || [],
      }));
      setFriends((prev) => prev.filter((f) => f.id !== targetUserId));
      setFriendRequests((prev) => ({
        incoming: prev.incoming.filter(
          (r) => r.from_user_id !== targetUserId && r.to_user_id !== targetUserId
        ),
        outgoing: prev.outgoing.filter(
          (r) => r.from_user_id !== targetUserId && r.to_user_id !== targetUserId
        ),
        responses: prev.responses.filter(
          (r) => r.from_user_id !== targetUserId && r.to_user_id !== targetUserId
        ),
      }));
      await refreshFriendData(authUser.id);
    },
    [authUser?.id, isMissingRelationError, refreshFriendData]
  );

  const unblockUser = useCallback(
    async (targetUserId) => {
      if (!authUser?.id || !targetUserId) return;
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', authUser.id)
        .eq('blocked_user_id', targetUserId);

      if (error && !isMissingRelationError(error, 'user_blocks')) {
        console.log('Error unblocking user:', error);
        throw new Error(error.message || 'Unable to unblock this user.');
      }

      setBlockedUsers((prev) => ({
        blocked: (prev?.blocked || []).filter((id) => id !== targetUserId),
        blockedBy: prev?.blockedBy || [],
      }));
      await refreshFriendData(authUser.id);
    },
    [authUser?.id, isMissingRelationError, refreshFriendData]
  );

  const submitFriendReport = useCallback(
    async (reportedUserId, description) => {
      if (!authUser?.id) throw new Error('You must be logged in to report someone.');
      if (!reportedUserId) throw new Error('Invalid user.');
      const cleanDescription = (description || '').trim();

      let insertedRow = null;
      const { data, error } = await supabase
        .from('friend_reports')
        .insert({
          reporter_id: authUser.id,
          reported_user_id: reportedUserId,
          description: cleanDescription || null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error && !isMissingRelationError(error, 'friend_reports')) {
        console.log('Error submitting friend report:', error);
        throw new Error(error.message || 'Unable to submit report.');
      }

      insertedRow = data || null;

      try {
        await supabase.functions.invoke('send-report-email', {
          body: {
            reporterId: authUser.id,
            reportedUserId: reportedUserId,
            description: cleanDescription,
          },
        });
      } catch (err) {
        console.log('Error invoking report email function:', err);
      }

      return insertedRow;
    },
    [authUser?.id, isMissingRelationError]
  );

  const getUserProfileById = useCallback(
    async (userId) => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, user_id, username, full_name, email, avatar_url, photo, daily_calorie_goal, daily_water_goal, daily_sleep_goal, weight_manager_unit, weight_manager_current_weight, weight_manager_target_weight, weight_manager_current_body_type, weight_manager_target_body_type, weight_manager_target_calories, weight_manager_protein_grams, weight_manager_carbs_grams, weight_manager_fat_grams, plan, premium_expires_at, is_premium, has_onboarded, has_completed_app_tutorial, app_tutorial_completed_at, created_at, updated_at'
        )
        .or(`id.eq.${userId},user_id.eq.${userId}`)
        .limit(1);

      if (error) {
        if (!isMissingColumnError(error, 'id') && !isMissingColumnError(error, 'user_id')) {
          console.log('Error fetching profile for user:', error);
        }
        return null;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;

      const lastSeen = userStatusesRef.current[userId] || null;

      return { ...mapExternalProfile(row), lastSeen };
    },
    [isMissingColumnError]
  );

  const onlineFriends = useMemo(
    () => friends.filter((f) => isUserOnline(f.id)),
    [friends, isUserOnline]
  );

const fetchHabitsFromSupabase = async (userId, _groupListParam) => {
  const habitSelectBase =
    'id, user_id, title, category, description, repeat, days, streak, created_at, notification_ids, color';
  const habitSelectWithEmoji = `${habitSelectBase}, emoji`;
  const habitSelectAdvanced = `${habitSelectWithEmoji}, habit_type, goal_period, goal_value, goal_unit, time_range, reminders_enabled, reminder_times, reminder_message, task_days_mode, task_days_count, month_days, show_memo_after_completion, chart_type, start_date, end_date`;

  const fetchHabitRows = async (buildQuery) => {
    let result = await buildQuery(habitSelectAdvanced);
    if (result.error && isMissingColumnError(result.error)) {
      result = await buildQuery(habitSelectWithEmoji);
    }
    if (result.error && isMissingColumnError(result.error)) {
      result = await buildQuery(habitSelectBase);
    }
    if (result.error && isMissingColumnError(result.error)) {
      result = await buildQuery(
        'id, user_id, title, category, description, repeat, days, streak, created_at'
      );
    }
    return result;
  };

  const {
    data: ownedHabitRows,
    error: ownedHabitError,
  } = await fetchHabitRows((selectClause) =>
    supabase
      .from('habits')
      .select(selectClause)
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
  );

  if (ownedHabitError) {
    console.log('Error fetching habits:', ownedHabitError);
    return;
  }

  let sharedHabitIds = [];
  const { data: participantRows, error: participantError } = await supabase
    .from('habit_participants')
    .select('habit_id')
    .eq('user_id', userId);

  if (participantError) {
    if (!isMissingRelationError(participantError, 'habit_participants')) {
      console.log('Error fetching shared habits:', participantError);
    }
  } else {
    sharedHabitIds = Array.from(
      new Set((participantRows || []).map((row) => row?.habit_id).filter(Boolean))
    );
  }

  let sharedHabitRows = [];
  if (sharedHabitIds.length) {
    const { data: sharedRows, error: sharedError } = await fetchHabitRows((selectClause) =>
      supabase
        .from('habits')
        .select(selectClause)
        .in('id', sharedHabitIds)
        .order('created_at', { ascending: true })
    );

    if (sharedError) {
      console.log('Error fetching shared habit rows:', sharedError);
    } else {
      sharedHabitRows = sharedRows || [];
    }
  }

  const dedupedRowMap = new Map();
  [...(ownedHabitRows || []), ...(sharedHabitRows || [])].forEach((row) => {
    if (!row?.id) return;
    dedupedRowMap.set(row.id, row);
  });
  const habitRows = Array.from(dedupedRowMap.values()).sort(
    (a, b) => new Date(a?.created_at || 0) - new Date(b?.created_at || 0)
  );

  seedNotificationCacheFromRows('habit', habitRows || []);

  // Get all completions for this user
  let { data: completionRows, error: completionError } = await supabase
    .from('habit_completions')
    .select('habit_id, date, amount')
    .eq('user_id', userId);

  if (completionError && isMissingColumnError(completionError, 'amount')) {
    ({ data: completionRows, error: completionError } = await supabase
      .from('habit_completions')
      .select('habit_id, date')
      .eq('user_id', userId));
  }

  if (completionError) {
    console.log('Error fetching habit completions:', completionError);
  }

  const completionRowsByHabit = {};
  const progressByHabit = {};
  (completionRows || []).forEach((row) => {
    const key = row.habit_id;
    const dateString = new Date(row.date).toDateString();
    if (!completionRowsByHabit[key]) completionRowsByHabit[key] = [];
    completionRowsByHabit[key].push({
      dateString,
      amount: row.amount,
    });
    if (!progressByHabit[key]) progressByHabit[key] = {};
    progressByHabit[key][dateString] = Number(row.amount) || 0;
  });

  const mappedHabits = (habitRows || []).map((h) => {
    const goalValue = Number(h.goal_value) || 1;
    const goalPeriod = h.goal_period || 'day';
    const habitType = h.habit_type || 'build';
    const quitHabit = habitType === 'quit';
    const habitProgressByDate = progressByHabit[h.id] || {};
    const completedDates = (completionRowsByHabit[h.id] || [])
      .filter((entry) => {
        if (entry.amount === null || entry.amount === undefined) return true;
        return quitHabit
          ? isQuitAmountCompleted(entry.amount, goalValue)
          : (Number(entry.amount) || 0) >= goalValue;
      })
      .map((entry) => entry.dateString);

    const mappedHabit = {
      id: h.id,
      ownerId: h.user_id || null,
      isOwned: h.user_id === userId,
      isShared: Boolean(h.user_id && h.user_id !== userId),
      title: h.title,
      category: h.category,
      description: h.description,
      repeat: h.repeat,
      days: h.days || [],
      streak: h.streak || 0,
      createdAt: h.created_at,
      completedDates,
      progressByDate: habitProgressByDate,
      habitType,
      goalPeriod,
      goalValue,
      goalUnit: h.goal_unit || 'times',
      timeRange: h.time_range || 'all_day',
      remindersEnabled: h.reminders_enabled ?? false,
      reminderTimes: Array.isArray(h.reminder_times) ? h.reminder_times : [],
      reminderMessage: h.reminder_message || '',
      taskDaysMode: h.task_days_mode || 'every_day',
      taskDaysCount: Number(h.task_days_count) || 3,
      monthDays: Array.isArray(h.month_days) ? h.month_days : [],
      showMemoAfterCompletion: h.show_memo_after_completion ?? false,
      chartType: h.chart_type || 'bar',
      startDate: h.start_date || null,
      endDate: h.end_date || null,
      color: h.color || colors.habits,
      emoji: h.emoji || '',
    };
    if (quitHabit) {
      mappedHabit.streak = computeHabitStreak(mappedHabit, {
        progressByDate: habitProgressByDate,
      });
    }
    return mappedHabit;
  });

  setHabits(mappedHabits);
};

  const resetHabitStreaksByIds = useCallback(
    async (habitIds = []) => {
      if (!authUser?.id) return;
      const targetIds = Array.from(new Set((habitIds || []).filter(Boolean)));
      if (!targetIds.length) return;

      const targetSet = new Set(targetIds);
      setHabits((prev) =>
        (prev || []).map((habit) =>
          targetSet.has(habit?.id) ? { ...habit, streak: 0 } : habit
        )
      );

      const { error } = await supabase
        .from('habits')
        .update({ streak: 0 })
        .eq('user_id', authUser.id)
        .in('id', targetIds);
      if (error) {
        console.log('Error resetting selected habit streaks:', error);
      }
    },
    [authUser?.id]
  );

  // HABIT FUNCTIONS
const shareHabitWithFriends = async (habitId, friendIds = []) => {
  if (!authUser?.id || !habitId) return [];

  const normalizedIds = Array.from(
    new Set((friendIds || []).filter((id) => id && id !== authUser.id))
  );
  if (!normalizedIds.length) return [];

  const friendSet = new Set((friends || []).map((friend) => friend?.id).filter(Boolean));
  const validFriendIds = normalizedIds.filter((id) => friendSet.has(id));
  if (!validFriendIds.length) return [];

  const { data: habitRow, error: habitError } = await supabase
    .from('habits')
    .select('id, user_id')
    .eq('id', habitId)
    .single();

  if (habitError) {
    console.log('Error validating habit before sharing:', habitError);
    throw habitError;
  }

  if (habitRow?.user_id !== authUser.id) {
    throw new Error('Only the habit owner can share this habit.');
  }

  const upsertRows = validFriendIds.map((friendId) => ({
    habit_id: habitId,
    owner_user_id: authUser.id,
    user_id: friendId,
  }));

  const { error: shareError } = await supabase
    .from('habit_participants')
    .upsert(upsertRows, { onConflict: 'habit_id,user_id' });

  if (shareError) {
    if (isMissingRelationError(shareError, 'habit_participants')) {
      throw new Error('Habit sharing table is missing. Run the habit-sharing SQL migration first.');
    }
    console.log('Error sharing habit with friends:', shareError);
    throw shareError;
  }

  return validFriendIds;
  };

const addHabit = async (habit) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a habit.');
  }

  const baseInsert = {
    user_id: authUser.id,
    title: habit.title,
    category: habit.category || 'Personal',
    description: habit.description || null,
    repeat: habit.repeat || 'Daily',
    days: habit.days || [],
    streak: 0,
    color: habit.color || colors.habits,
    emoji: habit.emoji || null,
  };
  const advancedInsert = {
    habit_type: habit.habitType,
    goal_period: habit.goalPeriod,
    goal_value: habit.goalValue,
    goal_unit: habit.goalUnit,
    time_range: habit.timeRange,
    reminders_enabled: habit.remindersEnabled,
    reminder_times: habit.reminderTimes,
    reminder_message: habit.reminderMessage,
    task_days_mode: habit.taskDaysMode,
    task_days_count: habit.taskDaysCount,
    month_days: habit.monthDays,
    show_memo_after_completion: habit.showMemoAfterCompletion,
    chart_type: habit.chartType,
    start_date: habit.startDate,
    end_date: habit.endDate,
  };

  let { data, error } = await supabase
    .from('habits')
    .insert({ ...baseInsert, ...advancedInsert })
    .select()
    .single();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('habits')
      .insert(baseInsert)
      .select()
      .single());
  }

  if (error && isMissingColumnError(error)) {
    const legacyInsert = { ...baseInsert };
    const lowerMessage = (error.message || '').toLowerCase();
    if (lowerMessage.includes('color') || !lowerMessage.includes('emoji')) delete legacyInsert.color;
    if (lowerMessage.includes('emoji') || !lowerMessage.includes('color')) delete legacyInsert.emoji;
    ({ data, error } = await supabase
      .from('habits')
      .insert(legacyInsert)
      .select()
      .single());
  }

  if (error) {
    console.log('Error adding habit:', error);
    throw error;
  }

  const newHabit = {
    ...habit,
    id: data.id,
    createdAt: data.created_at,
    streak: data.streak || 0,
    completedDates: [],
    progressByDate: {},
  };
  if (isQuitHabit(newHabit)) {
    newHabit.streak = computeHabitStreak(newHabit, { progressByDate: {} });
  }

  setHabits((prev) => [...prev, newHabit]);
  return newHabit;
};

const updateHabit = async (habitId, updates) => {
  if (!authUser?.id) return;

  const existingHabit = (habits || []).find((habit) => habit.id === habitId) || null;
  const localUpdates = { ...(updates || {}) };
  const existingGoalPeriod = existingHabit?.goalPeriod || 'day';
  const goalPeriodChanged =
    localUpdates.goalPeriod !== undefined &&
    normalizeStreakGoalPeriod(localUpdates.goalPeriod) !== normalizeStreakGoalPeriod(existingGoalPeriod);
  const existingHabitType = existingHabit?.habitType || 'build';
  const nextHabitType = localUpdates.habitType || existingHabitType;
  const habitTypeChanged = localUpdates.habitType !== undefined && nextHabitType !== existingHabitType;
  if ((goalPeriodChanged || habitTypeChanged) && localUpdates.streak === undefined) {
    const mergedHabit = { ...(existingHabit || {}), ...localUpdates };
    localUpdates.streak = computeHabitStreak(mergedHabit, {
      completedDates: existingHabit?.completedDates || [],
      progressByDate: existingHabit?.progressByDate || {},
    });
  }

  const updateData = {};
  const directFields = ['title', 'category', 'description', 'repeat', 'days', 'streak', 'color', 'emoji'];
  directFields.forEach((key) => {
    if (localUpdates[key] !== undefined) updateData[key] = localUpdates[key];
  });
  if (localUpdates.habitType !== undefined) updateData.habit_type = localUpdates.habitType;
  if (localUpdates.goalPeriod !== undefined) updateData.goal_period = localUpdates.goalPeriod;
  if (localUpdates.goalValue !== undefined) updateData.goal_value = localUpdates.goalValue;
  if (localUpdates.goalUnit !== undefined) updateData.goal_unit = localUpdates.goalUnit;
  if (localUpdates.timeRange !== undefined) updateData.time_range = localUpdates.timeRange;
  if (localUpdates.remindersEnabled !== undefined) updateData.reminders_enabled = localUpdates.remindersEnabled;
  if (localUpdates.reminderTimes !== undefined) updateData.reminder_times = localUpdates.reminderTimes;
  if (localUpdates.reminderMessage !== undefined) updateData.reminder_message = localUpdates.reminderMessage;
  if (localUpdates.taskDaysMode !== undefined) updateData.task_days_mode = localUpdates.taskDaysMode;
  if (localUpdates.taskDaysCount !== undefined) updateData.task_days_count = localUpdates.taskDaysCount;
  if (localUpdates.monthDays !== undefined) updateData.month_days = localUpdates.monthDays;
  if (localUpdates.showMemoAfterCompletion !== undefined)
    updateData.show_memo_after_completion = localUpdates.showMemoAfterCompletion;
  if (localUpdates.chartType !== undefined) updateData.chart_type = localUpdates.chartType;
  if (localUpdates.startDate !== undefined) updateData.start_date = localUpdates.startDate;
  if (localUpdates.endDate !== undefined) updateData.end_date = localUpdates.endDate;

  if (Object.keys(updateData).length > 0) {
    let { error } = await supabase
      .from('habits')
      .update(updateData)
      .eq('id', habitId)
      .eq('user_id', authUser.id);

    if (error && isMissingColumnError(error)) {
      const fallbackData = {};
      directFields.forEach((key) => {
        if (localUpdates[key] !== undefined) fallbackData[key] = localUpdates[key];
      });
      if (Object.keys(fallbackData).length) {
        ({ error } = await supabase
          .from('habits')
          .update(fallbackData)
          .eq('id', habitId)
          .eq('user_id', authUser.id));

        if (error && isMissingColumnError(error)) {
          const legacyFallbackData = { ...fallbackData };
          const lowerMessage = (error.message || '').toLowerCase();
          if (lowerMessage.includes('color') || !lowerMessage.includes('emoji')) delete legacyFallbackData.color;
          if (lowerMessage.includes('emoji') || !lowerMessage.includes('color')) delete legacyFallbackData.emoji;
          if (Object.keys(legacyFallbackData).length) {
            ({ error } = await supabase
              .from('habits')
              .update(legacyFallbackData)
              .eq('id', habitId)
              .eq('user_id', authUser.id));
          }
        }
      }
    }

    if (error) {
      console.log('Error updating habit:', error);
    }
  }

  setHabits((prev) =>
    prev.map((h) => (h.id === habitId ? { ...h, ...localUpdates } : h))
  );
};

const deleteHabit = async (habitId) => {
  if (!authUser?.id) return false;
  const deletingHabit = (habits || []).find((habit) => habit.id === habitId) || null;

  await cancelItemNotifications('habits', 'habit', habitId);

  const { error: completionError } = await supabase
    .from('habit_completions')
    .delete()
    .eq('habit_id', habitId);

  if (completionError && !isMissingRelationError(completionError, 'habit_completions')) {
    console.log('Error deleting habit completions:', completionError);
    throw completionError;
  }

  const { error: participantError } = await supabase
    .from('habit_participants')
    .delete()
    .eq('habit_id', habitId);

  if (participantError && !isMissingRelationError(participantError, 'habit_participants')) {
    console.log('Error deleting habit participants:', participantError);
    throw participantError;
  }

  let linkedGroupHabitIds = [];
  const { data: linkedGroupRows, error: linkedGroupRowsError } = await supabase
    .from('group_habits')
    .select('id')
    .eq('source_habit_id', habitId)
    .eq('created_by', authUser.id);

  if (linkedGroupRowsError) {
    if (
      !isMissingRelationError(linkedGroupRowsError, 'group_habits') &&
      !isMissingColumnError(linkedGroupRowsError, 'source_habit_id')
    ) {
      console.log('Error loading linked group habits before delete:', linkedGroupRowsError);
      throw linkedGroupRowsError;
    }
  } else {
    linkedGroupHabitIds = (linkedGroupRows || []).map((row) => row?.id).filter(Boolean);
  }

  // Backward compatibility: older group_habits rows may not have source_habit_id.
  // In that case, best-effort match likely mirrored rows created at the same time.
  if (!linkedGroupHabitIds.length && deletingHabit?.title) {
    const { data: maybeLinkedRows, error: maybeLinkedError } = await supabase
      .from('group_habits')
      .select('id, title, description, repeat, created_at')
      .eq('created_by', authUser.id)
      .eq('title', deletingHabit.title)
      .eq('repeat', deletingHabit.repeat || 'Daily');

    if (maybeLinkedError) {
      if (!isMissingRelationError(maybeLinkedError, 'group_habits')) {
        console.log('Error loading possible linked group habits:', maybeLinkedError);
      }
    } else {
      const habitCreatedAtMs = new Date(deletingHabit.createdAt || Date.now()).getTime();
      const habitDescription = deletingHabit.description || null;
      linkedGroupHabitIds = (maybeLinkedRows || [])
        .filter((row) => {
          const rowDescription = row?.description || null;
          if (rowDescription !== habitDescription) return false;
          const rowCreatedAtMs = new Date(row?.created_at || 0).getTime();
          if (!Number.isFinite(rowCreatedAtMs) || !Number.isFinite(habitCreatedAtMs)) return false;
          return Math.abs(rowCreatedAtMs - habitCreatedAtMs) <= 10 * 60 * 1000;
        })
        .map((row) => row?.id)
        .filter(Boolean);
    }
  }

  if (linkedGroupHabitIds.length) {
    const { data: deletedLinkedGroupRows, error: linkedGroupDeleteError } = await supabase
      .from('group_habits')
      .delete()
      .in('id', linkedGroupHabitIds)
      .eq('created_by', authUser.id)
      .select('id');

    if (linkedGroupDeleteError) {
      if (!isMissingRelationError(linkedGroupDeleteError, 'group_habits')) {
        console.log('Error deleting linked group habits:', linkedGroupDeleteError);
        throw linkedGroupDeleteError;
      }
    } else {
      const deletedIdSet = new Set(
        (deletedLinkedGroupRows || []).map((row) => row?.id).filter(Boolean)
      );
      const missingLinkedIds = linkedGroupHabitIds.filter((id) => !deletedIdSet.has(id));
      if (missingLinkedIds.length) {
        throw new Error('Unable to delete linked group habits from the database.');
      }
    }
  }

  const { data: deletedHabitRows, error: deleteError } = await supabase
    .from('habits')
    .delete()
    .eq('id', habitId)
    .eq('user_id', authUser.id)
    .select('id');

  if (deleteError) {
    console.log('Error deleting habit:', deleteError);
    throw deleteError;
  }
  if (!Array.isArray(deletedHabitRows) || !deletedHabitRows.length) {
    throw new Error('Unable to delete this habit from the database.');
  }

  setHabits((prev) => prev.filter((h) => h.id !== habitId));
  if (linkedGroupHabitIds.length) {
    const linkedIdSet = new Set(linkedGroupHabitIds);
    setGroupHabits((prev) =>
      (prev || []).filter(
        (habit) => !linkedIdSet.has(habit.id) && habit?.sourceHabitId !== habitId
      )
    );
    setGroupHabitCompletions((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      linkedGroupHabitIds.forEach((id) => {
        if (Object.prototype.hasOwnProperty.call(next, id)) {
          delete next[id];
        }
      });
      return next;
    });
  }
  return true;
};

const toggleHabitCompletion = async (habitId) => {
  if (!authUser?.id) return;

  const today = new Date();
  const todayKey = today.toDateString();
  const todayISO = today.toISOString().slice(0, 10);

  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return;

  const goalValue = Math.max(Number(habit.goalValue) || 1, 1);
  const quitHabit = isQuitHabit(habit);
  const todayAmount = Number((habit.progressByDate || {})[todayKey]) || 0;
  const isCompletedToday = quitHabit
    ? isQuitAmountCompleted(todayAmount, goalValue)
    : habit.completedDates?.includes(todayKey);
  const nextAmount = isCompletedToday
    ? quitHabit
      ? goalValue + 1
      : 0
    : quitHabit
      ? 0
      : goalValue;
  await setHabitProgress(habitId, nextAmount, todayISO);
};

const setHabitProgress = async (habitId, amount = 0, dateISO = null, options = {}) => {
  if (!authUser?.id || !habitId) return;

  const dateValue = dateISO || new Date().toISOString().slice(0, 10);
  const dateKey = new Date(dateValue).toDateString();
  const todayKey = new Date().toDateString();
  const syncLinkedGroupHabits = options?.syncLinkedGroupHabits !== false;
  const numericAmount = Math.max(0, Number(amount) || 0);
  const habit = habits.find((item) => item.id === habitId);
  if (!habit) return;
  const goalValue = Math.max(Number(habit.goalValue) || 1, 1);
  const quitHabit = isQuitHabit(habit);
  const shouldComplete = quitHabit
    ? isQuitAmountCompleted(numericAmount, goalValue)
    : numericAmount >= goalValue;
  const isTargetToday = dateKey === todayKey;
  const existingAmountOnDate = Number((habit.progressByDate || {})[dateKey]) || 0;
  const wasCompletedOnTargetDate = quitHabit
    ? isQuitAmountCompleted(existingAmountOnDate, goalValue)
    : (habit.completedDates || []).includes(dateKey);

  await supabase
    .from('habit_completions')
    .delete()
    .eq('habit_id', habitId)
    .eq('user_id', authUser.id)
    .eq('date', dateValue);

  if (numericAmount > 0) {
    let { error } = await supabase
      .from('habit_completions')
      .insert({
        habit_id: habitId,
        user_id: authUser.id,
        date: dateValue,
        amount: numericAmount,
      });
    if (error && isMissingColumnError(error, 'amount')) {
      ({ error } = await supabase
        .from('habit_completions')
        .insert({
          habit_id: habitId,
          user_id: authUser.id,
          date: dateValue,
        }));
    }
    if (error) {
      console.log('Error setting habit progress:', error);
    }
  }

  const nextCompletedDates = (() => {
    const current = Array.isArray(habit.completedDates) ? [...habit.completedDates] : [];
    if (shouldComplete && !current.includes(dateKey)) return [...current, dateKey];
    if (!shouldComplete && current.includes(dateKey)) {
      return current.filter((value) => value !== dateKey);
    }
    return current;
  })();
  const nextProgressByDate = {
    ...(habit.progressByDate || {}),
    [dateKey]: numericAmount,
  };
  const shouldPreserveFrozenStreak =
    !quitHabit && streakFrozen && isTargetToday && shouldComplete && !wasCompletedOnTargetDate;
  const computedNextStreak = computeHabitStreak(
    {
      ...habit,
      completedDates: nextCompletedDates,
      progressByDate: nextProgressByDate,
    },
    {
      completedDates: nextCompletedDates,
      progressByDate: nextProgressByDate,
    }
  );
  const nextStreak = shouldPreserveFrozenStreak
    ? Math.max(computedNextStreak, (habit.streak || 0) + 1)
    : computedNextStreak;

  setHabits((prev) =>
    prev.map((item) => {
      if (item.id !== habitId) return item;
      let itemCompletedDates = item.completedDates || [];
      if (shouldComplete && !itemCompletedDates.includes(dateKey)) {
        itemCompletedDates = [...itemCompletedDates, dateKey];
      }
      if (!shouldComplete && itemCompletedDates.includes(dateKey)) {
        itemCompletedDates = itemCompletedDates.filter((value) => value !== dateKey);
      }
      const itemNextProgressByDate = {
        ...(item.progressByDate || {}),
        [dateKey]: numericAmount,
      };
      const itemComputedStreak = computeHabitStreak(
        {
          ...item,
          completedDates: itemCompletedDates,
          progressByDate: itemNextProgressByDate,
        },
        {
          completedDates: itemCompletedDates,
          progressByDate: itemNextProgressByDate,
        }
      );

      return {
        ...item,
        completedDates: itemCompletedDates,
        streak: shouldPreserveFrozenStreak
          ? Math.max(
              itemComputedStreak,
              (item.streak || 0) + 1
            )
          : itemComputedStreak,
        progressByDate: itemNextProgressByDate,
      };
    })
  );

  await supabase
    .from('habits')
    .update({ streak: nextStreak })
    .eq('id', habitId)
    .eq('user_id', authUser.id);

  if (syncLinkedGroupHabits) {
    const linkedGroupHabits = (groupHabits || []).filter(
      (groupHabit) => groupHabit?.sourceHabitId === habitId
    );
    for (const linkedGroupHabit of linkedGroupHabits) {
      await toggleGroupHabitCompletion(linkedGroupHabit.id, {
        amount: numericAmount,
        dateISO: dateValue,
        syncSourceHabit: false,
      });
    }
  }

};

const isHabitCompletedToday = (habitId) => {
  const habit = habits.find((h) => h.id === habitId);
  if (!habit) return false;
  const today = new Date().toDateString();
  if (isQuitHabit(habit)) {
    const amount = Number((habit.progressByDate || {})[today]) || 0;
    return isQuitAmountCompleted(amount, getHabitGoalValue(habit));
  }
  return habit.completedDates?.includes(today) || false;
};

  const applyStreakFreezeIfNeeded = useCallback(async () => {
    if (!authUser?.id || !profileLoaded) return;

    const userId = authUser.id;
    const now = new Date();
    const streakingHabits = (habits || []).filter((habit) => (habit?.streak || 0) > 0);
    if (!streakingHabits.length) {
      if (streakFrozen) {
        await persistStreakFrozenState(false);
      }
      await writeLastActive(userId, now);
      return;
    }

    const missedMeta = streakingHabits
      .map((habit) => getMissedHabitPeriodMeta(habit, now))
      .filter(Boolean);
    if (!missedMeta.length) {
      if (streakFrozen) {
        await persistStreakFrozenState(false);
      }
      await writeLastActive(userId, now);
      return;
    }

    const isPremiumUser =
      profile?.isPremium ||
      computeIsPremium(profile?.plan, profile?.premiumExpiresAt || profile?.premium_expires_at);

    if (!isPremiumUser) {
      await resetHabitStreaksByIds(missedMeta.map((meta) => meta.habitId));
      if (streakFrozen) {
        await persistStreakFrozenState(false);
      }
      await writeLastActive(userId, now);
      return;
    }

    const expiredHabitIds = [];
    let hasActiveFreezeWindow = false;
    missedMeta.forEach((meta) => {
      const missedAtMs = meta.firstMissedAt.getTime();
      if (now.getTime() - missedAtMs >= STREAK_FREEZE_WINDOW_MS) {
        expiredHabitIds.push(meta.habitId);
      } else {
        hasActiveFreezeWindow = true;
      }
    });

    if (expiredHabitIds.length) {
      await resetHabitStreaksByIds(expiredHabitIds);
    }

    if (hasActiveFreezeWindow) {
      if (!streakFrozen) {
        await persistStreakFrozenState(true);
      }
    } else if (streakFrozen) {
      await persistStreakFrozenState(false);
    }

    await writeLastActive(userId, now);
  }, [
    authUser?.id,
    profile?.isPremium,
    profile?.plan,
    profile?.premiumExpiresAt,
    profile?.premium_expires_at,
    profileLoaded,
    persistStreakFrozenState,
    resetHabitStreaksByIds,
    streakFrozen,
    habits,
  ]);

const TASK_SELECT_FIELDS_BASE =
  'id,title,description,priority,date,time,completed,created_at,shared_task_id';
const TASK_SELECT_FIELDS_BASE_NO_DESC =
  'id,title,priority,date,time,completed,created_at,shared_task_id';
const TASK_SELECT_FIELDS_BASE_MINIMAL =
  'id,title,date,time,completed,created_at,shared_task_id';
const TASK_SELECT_FIELDS_ARCHIVE_BASE = `${TASK_SELECT_FIELDS_BASE},archived_at`;
const TASK_SELECT_FIELDS_ARCHIVE_BASE_NO_DESC = `${TASK_SELECT_FIELDS_BASE_NO_DESC},archived_at`;
const TASK_SELECT_FIELDS_ARCHIVE_BASE_MINIMAL = `${TASK_SELECT_FIELDS_BASE_MINIMAL},archived_at`;
const TASK_SELECT_FIELDS = `${TASK_SELECT_FIELDS_BASE},notification_ids`;
const TASK_SELECT_FIELDS_NO_DESC = `${TASK_SELECT_FIELDS_BASE_NO_DESC},notification_ids`;
const TASK_SELECT_FIELDS_MINIMAL = `${TASK_SELECT_FIELDS_BASE_MINIMAL},notification_ids`;
const TASK_SELECT_FIELDS_ARCHIVE = `${TASK_SELECT_FIELDS_ARCHIVE_BASE},notification_ids`;
const TASK_SELECT_FIELDS_ARCHIVE_NO_DESC = `${TASK_SELECT_FIELDS_ARCHIVE_BASE_NO_DESC},notification_ids`;
const TASK_SELECT_FIELDS_ARCHIVE_MINIMAL = `${TASK_SELECT_FIELDS_ARCHIVE_BASE_MINIMAL},notification_ids`;
const withTaskGroupIdField = (selectFields) => `${selectFields},group_id`;

const TASK_SELECT_VARIANTS_WITH_ARCHIVE = [
  TASK_SELECT_FIELDS_ARCHIVE,
  TASK_SELECT_FIELDS_ARCHIVE_NO_DESC,
  TASK_SELECT_FIELDS_ARCHIVE_MINIMAL,
  TASK_SELECT_FIELDS_ARCHIVE_BASE,
  TASK_SELECT_FIELDS_ARCHIVE_BASE_NO_DESC,
  TASK_SELECT_FIELDS_ARCHIVE_BASE_MINIMAL,
];

const TASK_SELECT_VARIANTS_LEGACY = [
  TASK_SELECT_FIELDS,
  TASK_SELECT_FIELDS_NO_DESC,
  TASK_SELECT_FIELDS_MINIMAL,
  TASK_SELECT_FIELDS_BASE,
  TASK_SELECT_FIELDS_BASE_NO_DESC,
  TASK_SELECT_FIELDS_BASE_MINIMAL,
];
const TASK_SELECT_VARIANTS_WITH_ARCHIVE_GROUP = TASK_SELECT_VARIANTS_WITH_ARCHIVE.map(
  withTaskGroupIdField
);
const TASK_SELECT_VARIANTS_LEGACY_GROUP = TASK_SELECT_VARIANTS_LEGACY.map(
  withTaskGroupIdField
);

const fetchTasksFromSupabase = async (userId) => {
  const buildQuery = (table, selectFields) =>
    supabase
      .from(table)
      .select(selectFields)
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

  const attempts = [];
  ['tasks_list', 'tasks'].forEach((table) => {
    TASK_SELECT_VARIANTS_WITH_ARCHIVE_GROUP.forEach((fields) => {
      attempts.push({ table, fields });
    });
  });
  ['tasks_list', 'tasks'].forEach((table) => {
    TASK_SELECT_VARIANTS_LEGACY_GROUP.forEach((fields) => {
      attempts.push({ table, fields });
    });
  });
  ['tasks_list', 'tasks'].forEach((table) => {
    TASK_SELECT_VARIANTS_WITH_ARCHIVE.forEach((fields) => {
      attempts.push({ table, fields });
    });
  });
  ['tasks_list', 'tasks'].forEach((table) => {
    TASK_SELECT_VARIANTS_LEGACY.forEach((fields) => {
      attempts.push({ table, fields });
    });
  });

  let data = null;
  let error = null;
  let selectedAttempt = null;
  for (const attempt of attempts) {
    ({ data, error } = await buildQuery(attempt.table, attempt.fields));
    if (error) {
      if (
        error.code === '42703' ||
        isMissingColumnError(error) ||
        (attempt.table === 'tasks_list' && isMissingRelationError(error, 'tasks_list'))
      ) {
        continue;
      }
      break;
    }
    selectedAttempt = attempt;
    break;
  }

  if (error) {
    console.log('Error fetching tasks:', error);
    return;
  }

  seedNotificationCacheFromRows('task', data || []);

  let mappedTasks = (data || []).map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description ?? t.task_description ?? '',
    priority: t.priority || 'medium',
    date: t.date, // stored as date string YYYY-MM-DD
    time: t.time,
    completed: t.completed,
    createdAt: t.created_at,
    archivedAt: t.archived_at || null,
    sharedTaskId: t.shared_task_id || t.id,
    groupId: t.group_id || null,
  }));

  if (mappedTasks.length) {
    try {
      const taskIds = mappedTasks.map((t) => t.id).filter(Boolean);
      const { data: linkRows, error: linkError } = await supabase
        .from('task_participants')
        .select('task_id, participant_task_id')
        .eq('user_id', userId)
        .in('participant_task_id', taskIds);

      if (!linkError && Array.isArray(linkRows) && linkRows.length) {
        const linkMap = {};
        linkRows.forEach((row) => {
          if (row?.participant_task_id && row?.task_id) {
            linkMap[row.participant_task_id] = row.task_id;
          }
        });
        mappedTasks = mappedTasks.map((task) => ({
          ...task,
          sharedTaskId: linkMap[task.id] || task.sharedTaskId,
        }));
      } else if (linkError && !isMissingRelationError(linkError, 'task_participants')) {
        console.log('Error fetching task participant links:', linkError);
      }
    } catch (err) {
      console.log('Error enriching tasks with participant links:', err);
    }
  }

  const { active, archived, newlyArchivedIds } = splitTaskBuckets(mappedTasks);
  setTasks(active);
  setArchivedTasks(archived);

  const supportsArchivedAt = Boolean(selectedAttempt?.fields?.includes('archived_at'));
  if (supportsArchivedAt && newlyArchivedIds.length) {
    const archiveTimestamp = new Date().toISOString();
    const { error: archiveError } = await supabase
      .from('tasks')
      .update({ archived_at: archiveTimestamp })
      .in('id', newlyArchivedIds)
      .eq('user_id', userId)
      .is('archived_at', null);

    if (archiveError && !isMissingColumnError(archiveError, 'archived_at')) {
      console.log('Error auto-archiving overdue tasks:', archiveError);
    }
  }
};



  // TASK FUNCTIONS
  const addTask = async (task) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a task.');
  }
  if (!task?.date || Number.isNaN(new Date(task.date).getTime())) {
    throw new Error('A date is required to schedule a task.');
  }
  if (!task?.time) {
    throw new Error('A time is required to schedule a task.');
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(pruneUndefined({
      user_id: authUser.id,
      title: task.title,
      description: task.description || null,
      priority: task.priority || 'medium',
      date: task.date,
      time: task.time,
      completed: false,
      shared_task_id: task.sharedTaskId ?? undefined,
      group_id: task.groupId ?? undefined,
    }))
    .select()
    .single();

  if (error) {
    console.log('Error adding task:', error);
    throw error;
  }

  const newTask = {
    id: data.id,
    title: data.title,
    description: data.description,
    priority: data.priority,
    date: data.date,
    time: data.time,
    completed: data.completed,
    createdAt: data.created_at,
    archivedAt: data.archived_at || null,
    sharedTaskId: data.shared_task_id || data.id,
    groupId: data.group_id || task.groupId || null,
  };

  setTasks((prev) => dedupeById([...prev, newTask]));
  setArchivedTasks((prev) => prev.filter((t) => t.id !== newTask.id));
  return newTask;
};


//Updates task
  const updateTask = async (taskId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  [
    ['title', 'title'],
    ['description', 'description'],
    ['priority', 'priority'],
    ['date', 'date'],
    ['time', 'time'],
    ['completed', 'completed'],
    ['archivedAt', 'archived_at'],
  ].forEach(([sourceKey, targetKey]) => {
    if (updates[sourceKey] !== undefined) {
      updateData[targetKey] = updates[sourceKey];
    }
  });

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating task:', error);
    }
  }

  setTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
  );
  setArchivedTasks((prev) =>
    prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
  );

  if (updates.completed === true) {
    await cancelItemNotifications('tasks', 'task', taskId);
  }
};




//Deletes task

  const deleteTask = async (taskId) => {
  if (!authUser?.id) return;

  await cancelItemNotifications('tasks', 'task', taskId);

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting task:', error);
  }

  // Best-effort cleanup for collaboration links if this task is a shared copy.
  try {
    await supabase
      .from('task_participants')
      .delete()
      .eq('participant_task_id', taskId)
      .eq('user_id', authUser.id);
  } catch (err) {
    // ignore
  }

  setTasks((prev) => prev.filter((t) => t.id !== taskId));
  setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
};



  //Completes task
  const toggleTaskCompletion = async (taskId) => {
  const task = tasks.find((t) => t.id === taskId) || archivedTasks.find((t) => t.id === taskId);
  if (!task || !authUser?.id) return;

  const newCompleted = !task.completed;

  const { error } = await supabase
    .from('tasks')
    .update({ completed: newCompleted })
    .eq('id', taskId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error toggling task completion:', error);
    return;
  }

  setTasks((prev) =>
    prev.map((t) =>
      t.id === taskId ? { ...t, completed: newCompleted } : t
    )
  );
  setArchivedTasks((prev) =>
    prev.map((t) =>
      t.id === taskId ? { ...t, completed: newCompleted } : t
    )
  );

  if (newCompleted) {
    await cancelItemNotifications('tasks', 'task', taskId);
  }
};

//Fetch Notes
const fetchNotesFromSupabase = async (userId) => {
  const { data, error } = await supabase
    .from('notes')
    .select('id, title, content, password_hash, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching notes:', error);
    return;
  }

  const mappedNotes = (data || []).map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    password: n.password_hash || null, // not secure yet, but matches your existing shape
    createdAt: n.created_at,
    updatedAt: n.updated_at || n.created_at,
  }));

  setNotes(mappedNotes);
};





  // NOTE FUNCTIONS
  // NOTE FUNCTIONS
const addNote = async (note) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a note.');
  }

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: authUser.id,
      title: note.title,
      content: note.content || '',
      password_hash: null,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding note:', error);
    throw error;
  }

  const newNote = {
    id: data.id,
    title: data.title,
    content: data.content,
    password: data.password_hash || null,
    createdAt: data.created_at,
    updatedAt: data.updated_at || data.created_at,
  };

  setNotes((prev) => [...prev, newNote]);
  return newNote;
};

const updateNote = async (noteId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  ['title', 'content'].forEach((key) => {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  });

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('notes')
      .update(updateData)
      .eq('id', noteId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating note:', error);
    }
  }

  setNotes((prev) =>
    prev.map((n) =>
      n.id === noteId
        ? { ...n, ...updates, updatedAt: new Date().toISOString() }
        : n
    )
  );
};

const deleteNote = async (noteId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', noteId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting note:', error);
  }

  setNotes((prev) => prev.filter((n) => n.id !== noteId));
};

const verifyNotePassword = (noteId, password) => {
  const note = notes.find((n) => n.id === noteId);
  if (!note) return false;
  if (!note.password) return true;
  return note.password === password;
};

const setNotePassword = async (noteId, newPassword, currentPassword) => {
  const note = notes.find((n) => n.id === noteId);
  if (!note) throw new Error('Note not found');

  if (note.password && note.password !== currentPassword) {
    throw new Error('Incorrect password');
  }

  if (!authUser?.id) return;

  const { error } = await supabase
    .from('notes')
    .update({
      password_hash: newPassword || null,
    })
    .eq('id', noteId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error updating note password:', error);
  }

  const updatedNotes = notes.map((n) =>
    n.id === noteId
      ? { ...n, password: newPassword || null, updatedAt: new Date().toISOString() }
      : n
  );
  setNotes(updatedNotes);
};



const fetchHealthFromSupabase = async (userId, cachedFoodLogs = null) => {
  const baseSelectFields =
    'id, user_id, date, mood, water_intake, sleep_time, wake_time, sleep_quality, calories, foods, created_at, updated_at';
  const selectWithGoal =
    `${baseSelectFields}, calorie_goal, protein_goal, carbs_goal, fat_goal`;
  let { data, error } = await supabase
    .from('health_daily')
    .select(selectWithGoal)
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (error && /calorie_goal|protein_goal|carbs_goal|fat_goal/i.test(error.message || '')) {
    ({ data, error } = await supabase
      .from('health_daily')
      .select(baseSelectFields)
      .eq('user_id', userId)
      .order('date', { ascending: true }));
  }

  let { data: foodEntries, error: foodError } = await supabase
    .from('health_food_entries')
    .select(
      'id, name, calories, protein_grams, carbs_grams, fat_grams, created_at, health_day_id, date'
    )
    .eq('user_id', userId)
    .order('date', { ascending: true });

  if (foodError && /protein_grams|carbs_grams|fat_grams/i.test(foodError.message || '')) {
    ({ data: foodEntries, error: foodError } = await supabase
      .from('health_food_entries')
      .select('id, name, calories, created_at, health_day_id, date')
      .eq('user_id', userId)
      .order('date', { ascending: true }));
  }

  if (error) {
    console.log('Error fetching health data:', error);
    return;
  }

  if (foodError) {
    console.log('Error fetching food entries:', foodError);
  }

  let { data: waterEntries, error: waterError } = await supabase
    .from('health_water_entries')
    .select('id, amount_ml, label, created_at, health_day_id, date')
    .eq('user_id', userId)
    .order('date', { ascending: true })
    .order('created_at', { ascending: false });

  if (waterError && !isMissingRelationError(waterError, 'health_water_entries')) {
    console.log('Error fetching water entries:', waterError);
  }

  const effectiveFoodLogs = cachedFoodLogs || foodLogs || {};

  const healthMap = {};
  (data || []).forEach((row) => {
    const key = normalizeDateKey(row.date);
    if (!key) return;
    healthMap[key] = mapHealthRow(row);
  });

  const foodMap = {};
  (foodEntries || []).forEach((row) => {
    const key = normalizeDateKey(row.date);
    if (!key) return;
    if (!foodMap[key]) foodMap[key] = [];
    foodMap[key].push({
      id: row.id,
      name: row.name,
      calories: row.calories,
      proteinGrams: asNumber(row.protein_grams, null),
      carbsGrams: asNumber(row.carbs_grams, null),
      fatGrams: asNumber(row.fat_grams, null),
      timestamp: row.created_at,
      healthDayId: row.health_day_id,
      date: row.date,
    });
  });

  const waterMap = {};
  (waterEntries || []).forEach((row) => {
    const key = normalizeDateKey(row.date);
    if (!key) return;
    if (!waterMap[key]) waterMap[key] = [];
    waterMap[key].push({
      id: row.id,
      amountMl: asNumber(row.amount_ml, 0) || 0,
      label: row.label || '',
      timestamp: row.created_at,
      healthDayId: row.health_day_id,
      date: row.date,
    });
  });

  Object.entries(foodMap).forEach(([dateKey, foods]) => {
    const base = healthMap[dateKey] || defaultHealthDay();
    const combined = [...(base.foods || []), ...(foods || [])];
    const deduped = [];
    const seen = new Set();
    combined.forEach((f) => {
      const foodWithDate = f?.date ? f : { ...f, date: dateKey };
      const key = getFoodEntryKey(foodWithDate, dateKey);
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(foodWithDate);
    });
    const totalCalories = deduped.reduce((sum, f) => sum + (f.calories || 0), 0);
    healthMap[dateKey] = {
      ...base,
      foods: deduped,
      calories: totalCalories || base.calories || 0,
      healthDayId: base.healthDayId || deduped[0]?.healthDayId || null,
    };
  });

  const existingFoodKeys = new Set();
  Object.entries(foodMap).forEach(([dateKey, foods]) => {
    (foods || []).forEach((f) => {
      const key = getFoodEntryKey(f, dateKey);
      if (key) existingFoodKeys.add(key);
    });
  });

  const pendingFoodUploads = [];
  const queueFoodUpload = (food, dateKey) => {
    if (!food) return;
    const foodWithDate = food?.date ? food : { ...food, date: dateKey };
    const key = getFoodEntryKey(foodWithDate, dateKey);
    if (!key || existingFoodKeys.has(key)) return;
    existingFoodKeys.add(key);
    pendingFoodUploads.push(foodWithDate);
  };

  Object.entries(healthMap).forEach(([dateKey, day]) => {
    (day?.foods || []).forEach((food) => queueFoodUpload(food, dateKey));
  });

  Object.entries(effectiveFoodLogs || {}).forEach(([dateKey, foods]) => {
    (foods || []).forEach((food) => queueFoodUpload(food, dateKey));
  });

  if (pendingFoodUploads.length && !foodError) {
    // Backfill cached food logs to Supabase so history is saved to the account.
    const healthDayIdCache = {};
    for (const food of pendingFoodUploads) {
      const dateKey = normalizeDateKey(food?.date || food?.timestamp || new Date());
      if (!dateKey || !food?.name) continue;
      const cachedId = healthDayIdCache[dateKey];
      let healthDayId =
        cachedId || food?.healthDayId || healthMap[dateKey]?.healthDayId || null;
      if (!healthDayId) {
        const base = healthMap[dateKey] || defaultHealthDay();
        const record = await upsertHealthDayRecord(dateKey, base);
        healthDayId = record?.id || base.healthDayId || null;
        healthDayIdCache[dateKey] = healthDayId;
      }

      const createdAt =
        food?.timestamp || food?.created_at || food?.createdAt || new Date().toISOString();
      const calories = asNumber(food.calories, 0) || 0;
      const payload = pruneUndefined({
        user_id: userId,
        health_day_id: healthDayId,
        date: dateKey,
        name: food.name,
        calories,
        protein_grams: normalizeFoodMacro(food.proteinGrams),
        carbs_grams: normalizeFoodMacro(food.carbsGrams),
        fat_grams: normalizeFoodMacro(food.fatGrams),
        created_at: createdAt,
      });

      const insertFoodEntry = async (payloadToInsert) =>
        supabase.from('health_food_entries').insert(payloadToInsert).select().single();

      let { error: insertError } = await insertFoodEntry(payload);

      if (insertError && insertError.code === '42703') {
        const fallbackPayload = pruneUndefined({
          user_id: userId,
          health_day_id: healthDayId,
          date: dateKey,
          name: food.name,
          calories,
          created_at: createdAt,
        });
        const retry = await insertFoodEntry(fallbackPayload);
        insertError = retry.error;
      }

      if (insertError && !isMissingRelationError(insertError, 'health_food_entries')) {
        console.log('Error syncing cached food entry:', insertError);
      }
    }
  }

  // Merge locally cached food logs to retain entries across sessions/logouts
  Object.entries(effectiveFoodLogs || {}).forEach(([dateKey, foods]) => {
    const combined = [...(healthMap[dateKey]?.foods || []), ...(foods || [])];
    const seen = new Set();
    const deduped = [];
    combined.forEach((f) => {
      const foodWithDate = f?.date ? f : { ...f, date: dateKey };
      const key = getFoodEntryKey(foodWithDate, dateKey);
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(foodWithDate);
    });
    const totalCalories = deduped.reduce((sum, f) => sum + (f.calories || 0), 0);
    const base = healthMap[dateKey] || defaultHealthDay();
    healthMap[dateKey] = {
      ...base,
      foods: deduped,
      calories: totalCalories || base.calories || 0,
    };
  });

  setHealthData(healthMap);
  setWaterLogs(waterMap);

  const todayISO = new Date().toISOString().slice(0, 10);
  if (healthMap[todayISO]) {
    setTodayHealth(healthMap[todayISO]);
  } else {
    setTodayHealth(defaultHealthDay());
  }
};

const fetchWeightManagerLogsFromSupabase = async (userId) => {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('weight_manager_logs')
    .select('id, user_id, log_date, weight, unit, created_at, updated_at')
    .eq('user_id', userId)
    .order('log_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(90);

  if (error) {
    if (!isMissingRelationError(error, 'weight_manager_logs')) {
      console.log('Error fetching weight manager logs:', error);
    }
    setWeightManagerLogs([]);
    return [];
  }

  const unitFallback = profile?.weightManagerUnit || defaultProfile.weightManagerUnit;
  const mapped = (data || [])
    .map((row) => mapWeightManagerLogRow(row, unitFallback))
    .filter((row) => row.logDate && Number.isFinite(row.weight));
  const sorted = sortWeightManagerLogs(mapped);
  setWeightManagerLogs(sorted);
  return sorted;
};



  // HEALTH FUNCTIONS
  // HEALTH FUNCTIONS
const upsertHealthDayRecord = async (dateISO, healthDay) => {
  const nowISO = new Date().toISOString();
  const createdAt = healthDay?.createdAt || nowISO;
    const payload = {
      user_id: authUser.id,
      date: dateISO,
      mood: healthDay?.mood,
      water_intake: healthDay?.waterIntake,
      sleep_time: healthDay?.sleepTime,
      wake_time: healthDay?.wakeTime,
      sleep_quality: healthDay?.sleepQuality,
      calorie_goal: healthDay?.calorieGoal,
      protein_goal: healthDay?.proteinGoal,
      carbs_goal: healthDay?.carbsGoal,
      fat_goal: healthDay?.fatGoal,
      calories: healthDay?.calories,
      foods: healthDay?.foods,
      created_at: createdAt,
      updated_at: nowISO,
    };

  // Only include primary key when we actually have one; sending null violates NOT NULL.
  if (healthDay?.healthDayId) {
    payload.id = healthDay.healthDayId;
  }

    let { data, error } = await supabase
      .from('health_daily')
      .upsert(payload, { onConflict: 'user_id,date' })
      .select()
      .single();

    if (error && /calorie_goal|protein_goal|carbs_goal|fat_goal/i.test(error.message || '')) {
      const {
        calorie_goal: _ignoredCalorie,
        protein_goal: _ignoredProtein,
        carbs_goal: _ignoredCarbs,
        fat_goal: _ignoredFat,
        ...fallbackPayload
      } = payload;
      ({ data, error } = await supabase
        .from('health_daily')
        .upsert(fallbackPayload, { onConflict: 'user_id,date' })
        .select()
        .single());
    }

  if (error) {
    console.log('Error saving health data:', error);
  }

  return data || null;
};

  const addWeightManagerLog = async ({ weight, unit, logDate } = {}) => {
    if (!authUser?.id) {
      throw new Error('You must be logged in to log weight.');
    }

    const parsedWeight = Number(weight);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      throw new Error('Weight must be a positive number.');
    }

    const logDateKey = normalizeDateKey(logDate || new Date());
    if (!logDateKey) {
      throw new Error('Invalid log date.');
    }

    const logUnit = unit || profile?.weightManagerUnit || defaultProfile.weightManagerUnit;
    const payload = {
      user_id: authUser.id,
      log_date: logDateKey,
      weight: parsedWeight,
      unit: logUnit,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('weight_manager_logs')
      .upsert(payload, { onConflict: 'user_id,log_date' })
      .select()
      .single();

    if (error) {
      if (!isMissingRelationError(error, 'weight_manager_logs')) {
        console.log('Error saving weight manager log:', error);
      }
      throw error;
    }

    const mapped = mapWeightManagerLogRow(data || payload, logUnit);
    setWeightManagerLogs((prev) =>
      sortWeightManagerLogs([
        ...(prev || []).filter((log) => log.logDate !== mapped.logDate),
        mapped,
      ])
    );
    return mapped;
  };

  const clearWeightManagerLogs = async () => {
    if (!authUser?.id) {
      throw new Error('You must be logged in to clear weight logs.');
    }
    const { error } = await supabase
      .from('weight_manager_logs')
      .delete()
      .eq('user_id', authUser.id);

    if (error) {
      if (!isMissingRelationError(error, 'weight_manager_logs')) {
        console.log('Error clearing weight manager logs:', error);
      }
      throw error;
    }

    setWeightManagerLogs([]);
  };

  const updateHealthForDate = async (dateISO, updates = {}) => {
    if (!authUser?.id) {
      throw new Error('You must be logged in to update health data.');
    }

    const normalizedDate = normalizeDateKey(dateISO);
    const { energy: _ignoreEnergy, waterIntakeDelta, ...updatesWithoutEnergy } = updates || {};
    const nowISO = new Date().toISOString();
    const todayISO = new Date().toISOString().slice(0, 10);
    let newHealth = null;

    setHealthData((prev) => {
      const base = prev[normalizedDate] || defaultHealthDay();
      const { energy: _ignoreBaseEnergy, ...baseWithoutEnergy } = base;
      const createdAt = baseWithoutEnergy.createdAt || updatesWithoutEnergy?.createdAt || nowISO;
      const merged = {
        ...baseWithoutEnergy,
        ...updatesWithoutEnergy,
      };

      const baseWater = asNumber(baseWithoutEnergy.waterIntake, 0) || 0;
      const explicitWater = updatesWithoutEnergy.waterIntake;
      const coercedWater =
        explicitWater !== undefined ? asNumber(explicitWater, baseWater) : baseWater;
      const deltaValue =
        waterIntakeDelta !== undefined ? asNumber(waterIntakeDelta, 0) : null;
      const newWaterIntake = deltaValue !== null ? coercedWater + deltaValue : coercedWater;
      const coerceGoal = (key, baseValue) => {
        if (!Object.prototype.hasOwnProperty.call(updatesWithoutEnergy, key)) {
          return baseValue ?? null;
        }
        const rawGoal = updatesWithoutEnergy[key];
        if (rawGoal === null || rawGoal === undefined || rawGoal === '') {
          return null;
        }
        const parsedGoal = Number(rawGoal);
        return Number.isFinite(parsedGoal) ? Math.max(0, parsedGoal) : baseValue ?? null;
      };

      const nextCalorieGoal = coerceGoal('calorieGoal', baseWithoutEnergy.calorieGoal);
      const nextProteinGoal = coerceGoal('proteinGoal', baseWithoutEnergy.proteinGoal);
      const nextCarbsGoal = coerceGoal('carbsGoal', baseWithoutEnergy.carbsGoal);
      const nextFatGoal = coerceGoal('fatGoal', baseWithoutEnergy.fatGoal);

      newHealth = {
        ...merged,
        mood: asNumber(updatesWithoutEnergy.mood, baseWithoutEnergy.mood),
        waterIntake: Math.max(0, newWaterIntake),
        calorieGoal: nextCalorieGoal,
        proteinGoal: nextProteinGoal,
        carbsGoal: nextCarbsGoal,
        fatGoal: nextFatGoal,
        createdAt,
        updatedAt: nowISO,
      };

      return { ...prev, [normalizedDate]: newHealth };
    });

    if (normalizedDate === todayISO && newHealth) {
      setTodayHealth(newHealth);
    }

    // Persist food logs locally so they survive logout/app close
    if (updates.foods !== undefined) {
      const updatedFoodLogs = { ...(foodLogs || {}) };
      updatedFoodLogs[normalizedDate] = updates.foods;
      setFoodLogs(updatedFoodLogs);
      await persistFoodLogsLocally(updatedFoodLogs, authUser.id);
    }

    if (!newHealth) {
      return;
    }

    const healthDayRecord = await upsertHealthDayRecord(normalizedDate, newHealth);
    if (healthDayRecord) {
      const persistedHealth = mapHealthRow(healthDayRecord, newHealth);
      setHealthData((prev) => ({
        ...prev,
        [normalizedDate]: persistedHealth,
      }));
      if (normalizedDate === todayISO) {
        setTodayHealth(persistedHealth);
      }
    }
  };

const updateTodayHealth = async (updates) => {
  const todayISO = new Date().toISOString().slice(0, 10);
  await updateHealthForDate(todayISO, updates);
};

const addFoodEntryForDate = async (dateISO, food) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to log food.');
  }
  const dayKey = normalizeDateKey(dateISO);
  const baseDay = healthData[dayKey] || defaultHealthDay();

  const healthDayRecord = await upsertHealthDayRecord(dayKey, baseDay);
  const healthDayId = healthDayRecord?.id || baseDay.healthDayId;

  const normalizedFood = {
    ...food,
    calories: asNumber(food.calories, 0) || 0,
    proteinGrams: normalizeFoodMacro(food.proteinGrams),
    carbsGrams: normalizeFoodMacro(food.carbsGrams),
    fatGrams: normalizeFoodMacro(food.fatGrams),
  };

  const nowISO = new Date().toISOString();
  const newFood = {
    ...normalizedFood,
    id: Date.now().toString(),
    timestamp: nowISO,
    date: dayKey,
  };

  const insertPayload = pruneUndefined({
    user_id: authUser?.id,
    health_day_id: healthDayId,
    date: dayKey,
    name: newFood.name,
    calories: newFood.calories,
    protein_grams: newFood.proteinGrams,
    carbs_grams: newFood.carbsGrams,
    fat_grams: newFood.fatGrams,
    created_at: nowISO,
  });

  const insertFoodEntry = async (payload) =>
    supabase.from('health_food_entries').insert(payload).select().single();

  let foodRow = null;
  let insertError = null;
  const firstInsert = await insertFoodEntry(insertPayload);
  foodRow = firstInsert.data;
  insertError = firstInsert.error;

  // If macro columns are missing in the DB, retry without them so food logging still works
  if (insertError && insertError.code === '42703') {
    const fallbackPayload = {
      user_id: authUser?.id,
      health_day_id: healthDayId,
      date: dayKey,
      name: newFood.name,
      calories: newFood.calories,
      created_at: nowISO,
    };
    const retry = await insertFoodEntry(fallbackPayload);
    foodRow = retry.data;
    insertError = retry.error;
  }

  if (insertError) {
    console.log('Error saving food entry:', insertError);
  }

  const savedFood = {
    ...newFood,
    id: foodRow?.id || newFood.id,
  };

  const updatedFoods = [...(baseDay.foods || []), savedFood];
  const totalCalories = updatedFoods.reduce(
    (sum, f) => sum + (f.calories || 0),
    0
  );

  await updateHealthForDate(dayKey, {
    healthDayId,
    foods: updatedFoods,
    calories: totalCalories,
    createdAt: healthDayRecord?.created_at || baseDay.createdAt,
    updatedAt: healthDayRecord?.updated_at || baseDay.updatedAt,
  });
};

const deleteFoodEntryForDate = async (dateISO, foodId) => {
  if (!authUser?.id) return;
  const dayKey = normalizeDateKey(dateISO);
  const baseDay = healthData[dayKey] || defaultHealthDay();
  const updatedFoods = (baseDay.foods || []).filter((f) => f.id !== foodId);
  const totalCalories = updatedFoods.reduce((sum, f) => sum + (f.calories || 0), 0);

  if (foodId) {
    const { error } = await supabase
      .from('health_food_entries')
      .delete()
      .eq('id', foodId);
    if (error) {
      console.log('Error deleting food entry:', error);
    }
  }

  await updateHealthForDate(dayKey, {
    foods: updatedFoods,
    calories: totalCalories,
  });
};

const addFoodEntry = async (food) => {
  const targetDate = new Date().toISOString().slice(0, 10);
  await addFoodEntryForDate(targetDate, food);
};

const addWaterLogEntryForDate = async (dateISO, entry) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to log water.');
  }
  const dayKey = normalizeDateKey(dateISO);
  const baseDay = healthData[dayKey] || defaultHealthDay();

  const amountMl = asNumber(entry?.amountMl ?? entry?.amount_ml ?? entry?.amount, null);
  if (!Number.isFinite(amountMl) || amountMl <= 0) {
    throw new Error('Water amount must be a positive number.');
  }

  const healthDayRecord = await upsertHealthDayRecord(dayKey, baseDay);
  const healthDayId = healthDayRecord?.id || baseDay.healthDayId;

  const nowISO = new Date().toISOString();
  const label = (entry?.label || '').trim();
  const newEntry = {
    id: Date.now().toString(),
    amountMl,
    label,
    timestamp: nowISO,
    date: dayKey,
    healthDayId,
  };

  const insertPayload = pruneUndefined({
    user_id: authUser?.id,
    health_day_id: healthDayId,
    date: dayKey,
    amount_ml: amountMl,
    label: label || null,
    created_at: nowISO,
  });

  let insertError = null;
  let insertedRow = null;
  const insertResult = await supabase
    .from('health_water_entries')
    .insert(insertPayload)
    .select()
    .single();
  insertError = insertResult.error;
  insertedRow = insertResult.data;

  if (insertError && !isMissingRelationError(insertError, 'health_water_entries')) {
    console.log('Error saving water entry:', insertError);
  }

  const savedEntry = {
    ...newEntry,
    id: insertedRow?.id || newEntry.id,
  };

  setWaterLogs((prev) => {
    const next = { ...(prev || {}) };
    const current = next[dayKey] || [];
    next[dayKey] = [savedEntry, ...current];
    return next;
  });

  await updateHealthForDate(dayKey, {
    waterIntakeDelta: amountMl / 1000,
    healthDayId,
    createdAt: healthDayRecord?.created_at || baseDay.createdAt,
    updatedAt: healthDayRecord?.updated_at || baseDay.updatedAt,
  });
};

const deleteWaterLogEntryForDate = async (dateISO, entryId) => {
  if (!authUser?.id) return;
  const dayKey = normalizeDateKey(dateISO);
  const entries = waterLogs?.[dayKey] || [];
  const target = entries.find((item) => item.id === entryId);
  if (!target) return;

  if (entryId) {
    const { error } = await supabase
      .from('health_water_entries')
      .delete()
      .eq('id', entryId);
    if (error && !isMissingRelationError(error, 'health_water_entries')) {
      console.log('Error deleting water entry:', error);
    }
  }

  setWaterLogs((prev) => {
    const next = { ...(prev || {}) };
    next[dayKey] = (next[dayKey] || []).filter((item) => item.id !== entryId);
    return next;
  });

  await updateHealthForDate(dayKey, {
    waterIntakeDelta: -(asNumber(target.amountMl, 0) / 1000),
  });
};

const addWaterLogEntry = async (entry) => {
  const targetDate = new Date().toISOString().slice(0, 10);
  await addWaterLogEntryForDate(targetDate, entry);
};

const resetWaterLogForDate = async (dateISO) => {
  if (!authUser?.id) return;
  const dayKey = normalizeDateKey(dateISO);
  const todayISO = new Date().toISOString().slice(0, 10);
  const nowISO = new Date().toISOString();

  setHealthData((prev) => {
    const base = prev[dayKey] || defaultHealthDay();
    const updated = {
      ...base,
      waterIntake: 0,
      updatedAt: nowISO,
    };
    return { ...prev, [dayKey]: updated };
  });

  if (dayKey === todayISO) {
    setTodayHealth((prev) => ({
      ...(prev || defaultHealthDay()),
      waterIntake: 0,
      updatedAt: nowISO,
    }));
  }

  const { error } = await supabase
    .from('health_water_entries')
    .delete()
    .eq('user_id', authUser.id)
    .eq('date', dayKey);

  if (error && !isMissingRelationError(error, 'health_water_entries')) {
    console.log('Error resetting water entries:', error);
  }

  setWaterLogs((prev) => {
    const next = { ...(prev || {}) };
    next[dayKey] = [];
    return next;
  });

  await updateHealthForDate(dayKey, { waterIntake: 0 });
};

  const getAverageWater = () => {
    const entries = Object.values(healthData);
    if (entries.length === 0) return 0;
    const total = entries.reduce((sum, day) => sum + (Number(day.waterIntake) || 0), 0);
    return Math.round((total / entries.length) * 100) / 100;
  };

  const getAverageSleep = () => {
    const entries = Object.values(healthData).filter(
      (day) => day.sleepTime && day.wakeTime
    );
    if (entries.length === 0) return 0;
    // Simplified calculation - would need proper time parsing in production
    return 7.5; // Placeholder
  };





const ROUTINE_TASKS_TABLE = 'routine_tasks';

const fetchRoutinesFromSupabase = async (userId) => {
  const requiredColumns = ['id', 'name', 'created_at'];
  const optionalColumns = ['start_time', 'end_time', 'scheduled_times', 'notification_ids'];
  const fetchRoutineRows = async (columnList = []) =>
    supabase
      .from('routines')
      .select(columnList.join(', '))
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

  let routineRows = null;
  let error = null;
  let remainingOptionalColumns = [...optionalColumns];

  for (
    let attemptIndex = 0;
    attemptIndex <= optionalColumns.length + 1;
    attemptIndex += 1
  ) {
    const selectColumns = [...requiredColumns, ...remainingOptionalColumns];
    ({ data: routineRows, error } = await fetchRoutineRows(selectColumns));

    if (!error) break;
    if (!isMissingColumnError(error)) break;

    const missingColumn = extractMissingColumnName(error);
    if (missingColumn && remainingOptionalColumns.includes(missingColumn)) {
      remainingOptionalColumns = remainingOptionalColumns.filter(
        (columnName) => columnName !== missingColumn
      );
      continue;
    }

    if (!remainingOptionalColumns.length) break;
    remainingOptionalColumns = remainingOptionalColumns.slice(0, -1);
  }

  if (error) {
    console.log('Error fetching routines:', error);
    return;
  }

  const routinesMap = (routineRows || []).map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    ...normalizeRoutineTimeRange(r),
    tasks: [],
  }));

  const routineIds = routinesMap.map((r) => r.id).filter(Boolean);

  let tasksByRoutine = {};
  if (routineIds.length > 0) {
    const { data: taskRows, error: taskError } = await supabase
      .from(ROUTINE_TASKS_TABLE)
      .select('id, routine_id, name, position, created_at')
      .in('routine_id', routineIds)
      .order('position', { ascending: true });

    if (taskError) {
      console.log('Error fetching routine tasks:', taskError);
    } else {
      tasksByRoutine = (taskRows || []).reduce((acc, row) => {
        const list = acc[row.routine_id] || [];
        list.push({
          id: row.id,
          name: row.name,
          position: row.position ?? list.length,
          createdAt: row.created_at,
        });
        acc[row.routine_id] = list.sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0)
        );
        return acc;
      }, {});
    }
  }

  const combined = routinesMap.map((r) => ({
    ...r,
    tasks: tasksByRoutine[r.id] || [],
  }));

  seedNotificationCacheFromRows('routine', routineRows || []);
  setRoutines(combined);
  await persistRoutinesLocally(combined);
};



  // ROUTINE FUNCTIONS
  const addRoutine = async (routine) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create a routine.');
  }
  const normalizedRange = normalizeRoutineTimeRange({
    startTime: routine?.startTime,
    endTime: routine?.endTime,
    start_time: routine?.start_time,
    end_time: routine?.end_time,
    scheduledTimes: routine?.scheduledTimes,
    scheduled_times: routine?.scheduled_times,
  });
  if (!normalizedRange.startTime || !normalizedRange.endTime) {
    throw new Error('Routine start and end times are required.');
  }
  const insertData = {
    user_id: authUser.id,
    name: routine.name,
  };
  if (normalizedRange.startTime) {
    insertData.start_time = normalizedRange.startTime;
  }
  if (normalizedRange.endTime) {
    insertData.end_time = normalizedRange.endTime;
  }

  let { data, error } = await supabase
    .from('routines')
    .insert(insertData)
    .select()
    .single();

  if (
    error &&
    (insertData.start_time || insertData.end_time) &&
    (isMissingColumnError(error, 'start_time') || isMissingColumnError(error, 'end_time'))
  ) {
    const fallbackInsertData = { ...insertData };
    delete fallbackInsertData.start_time;
    delete fallbackInsertData.end_time;
    ({ data, error } = await supabase
      .from('routines')
      .insert(fallbackInsertData)
      .select()
      .single());
  }

  if (error) {
    console.log('Error adding routine:', error);
    throw error;
  }

  const newRoutine = {
    id: data.id,
    name: data.name,
    createdAt: data.created_at,
    ...normalizedRange,
    tasks: [],
    };

    setRoutines((prev) => {
      const next = [...prev, newRoutine];
      persistRoutinesLocally(next);
      return next;
    });
    return newRoutine;
  };

  const updateRoutine = async (routineId, updates) => {
    if (!authUser?.id) return;

    const routine = routines.find((r) => r.id === routineId);
    if (!routine) return;

    const hasTimeRangeUpdate =
      updates?.startTime !== undefined ||
      updates?.endTime !== undefined ||
      updates?.start_time !== undefined ||
      updates?.end_time !== undefined ||
      updates?.scheduledTimes !== undefined ||
      updates?.scheduled_times !== undefined;
    const normalizedRange = hasTimeRangeUpdate
      ? normalizeRoutineTimeRange({ ...routine, ...updates })
      : normalizeRoutineTimeRange(routine);
    if (hasTimeRangeUpdate && (!normalizedRange.startTime || !normalizedRange.endTime)) {
      throw new Error('Routine start and end times are required.');
    }
    const updated = {
      ...routine,
      ...updates,
      ...normalizedRange,
      name: updates?.name !== undefined ? String(updates.name || '').trim() : routine.name,
    };

    if (!updated.name) {
      throw new Error('Routine name is required.');
    }

    const updateData = {
      name: updated.name,
    };
    if (hasTimeRangeUpdate) {
      updateData.start_time = normalizedRange.startTime || null;
      updateData.end_time = normalizedRange.endTime || null;
    }

    let { error } = await supabase
      .from('routines')
      .update(updateData)
      .eq('id', routineId)
      .eq('user_id', authUser.id);

    if (
      error &&
      hasTimeRangeUpdate &&
      (isMissingColumnError(error, 'start_time') || isMissingColumnError(error, 'end_time'))
    ) {
      const fallbackUpdateData = { ...updateData };
      delete fallbackUpdateData.start_time;
      delete fallbackUpdateData.end_time;
      ({ error } = await supabase
        .from('routines')
        .update(fallbackUpdateData)
        .eq('id', routineId)
        .eq('user_id', authUser.id));
    }

    if (error) {
      console.log('Error updating routine:', error);
    }

    setRoutines((prev) => {
      const next = prev.map((r) => (r.id === routineId ? updated : r));
      persistRoutinesLocally(next);
      return next;
    });
  };

const deleteRoutine = async (routineId) => {
  if (!authUser?.id) return;

  await cancelItemNotifications('routines', 'routine', routineId);

  // Remove tasks first to keep data clean
  await supabase.from(ROUTINE_TASKS_TABLE).delete().eq('routine_id', routineId).eq('user_id', authUser.id);

  const { error } = await supabase
    .from('routines')
    .delete()
      .eq('id', routineId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error deleting routine:', error);
    }

    setRoutines((prev) => {
      const next = prev.filter((r) => r.id !== routineId);
      persistRoutinesLocally(next);
      return next;
    });
  };

const addTaskToRoutine = async (routineId, task) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const nextPosition = (routine.tasks?.length || 0);
  const { data, error } = await supabase
    .from(ROUTINE_TASKS_TABLE)
    .insert({
      user_id: authUser.id,
      routine_id: routineId,
      name: task.name,
      position: nextPosition,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding task to routine:', error);
    return;
  }

  const newTask = {
    id: data.id,
    name: data.name,
    position: data.position ?? nextPosition,
    createdAt: data.created_at,
  };

  const updatedTasks = [...(routine.tasks || []), newTask].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0)
  );
  const updatedRoutine = { ...routine, tasks: updatedTasks };

  setRoutines((prev) => {
    const next = prev.map((r) => (r.id === routineId ? updatedRoutine : r));
    persistRoutinesLocally(next);
    return next;
  });
};

const removeTaskFromRoutine = async (routineId, taskId) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const updatedTasks = (routine.tasks || []).filter((t) => t.id !== taskId);
  const resequenced = updatedTasks.map((t, idx) => ({ ...t, position: idx }));
  const updatedRoutine = { ...routine, tasks: resequenced };

  await supabase.from(ROUTINE_TASKS_TABLE).delete().eq('id', taskId).eq('user_id', authUser.id);

  // update positions for remaining tasks
  await Promise.all(
    resequenced.map((t) =>
      supabase
        .from(ROUTINE_TASKS_TABLE)
        .update({ position: t.position })
        .eq('id', t.id)
        .eq('user_id', authUser.id)
    )
  );

  setRoutines((prev) => {
    const next = prev.map((r) => (r.id === routineId ? updatedRoutine : r));
    persistRoutinesLocally(next);
    return next;
  });
};

const reorderRoutineTasks = async (routineId, newTaskOrder) => {
  if (!authUser?.id) return;

  const routine = routines.find((r) => r.id === routineId);
  if (!routine) return;

  const resequenced = (newTaskOrder || []).map((t, idx) => ({
    ...t,
    position: idx,
  }));

  await Promise.all(
    resequenced.map((t) =>
      supabase
        .from(ROUTINE_TASKS_TABLE)
        .update({ position: t.position })
        .eq('id', t.id)
        .eq('user_id', authUser.id)
    )
  );

  const updatedRoutine = { ...routine, tasks: resequenced };

  setRoutines((prev) => {
    const next = prev.map((r) => (r.id === routineId ? updatedRoutine : r));
    persistRoutinesLocally(next);
    return next;
  });
};



const fetchChoresFromSupabase = async (userId) => {
  const choreSelectFields = 'id, title, date, completed, created_at, notification_ids';
  let { data, error } = await supabase
    .from('chores')
    .select(choreSelectFields)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error && isMissingColumnError(error, 'notification_ids')) {
    ({ data, error } = await supabase
      .from('chores')
      .select('id, title, date, completed, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }));
  }

  if (error) {
    console.log('Error fetching chores:', error);
    return;
  }

  seedNotificationCacheFromRows('chore', data || []);

  const mapped = (data || []).map((c) => ({
    id: c.id,
    title: c.title,
    date: c.date,
    completed: c.completed,
    createdAt: c.created_at,
  }));

  setChores(mapped);
};

  // CHORE FUNCTIONS
const addChore = async (chore) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a chore.');
  }

  const { data, error } = await supabase
    .from('chores')
    .insert({
      user_id: authUser.id,
      title: chore.title,
      date: chore.date || null,
      completed: false,
    })
    .select()
    .single();

  if (error) {
    console.log('Error adding chore:', error);
    throw error;
  }

  const newChore = {
    id: data.id,
    title: data.title,
    date: data.date,
    completed: data.completed,
    createdAt: data.created_at,
  };

  setChores((prev) => [...prev, newChore]);
  return newChore;
};

const updateChore = async (choreId, updates) => {
  if (!authUser?.id) return;

  const updateData = {};
  ['title', 'date', 'completed'].forEach((key) => {
    if (updates[key] !== undefined) {
      updateData[key] = updates[key];
    }
  });

  if (Object.keys(updateData).length > 0) {
    const { error } = await supabase
      .from('chores')
      .update(updateData)
      .eq('id', choreId)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error updating chore:', error);
    }
  }

  setChores((prev) =>
    prev.map((c) => (c.id === choreId ? { ...c, ...updates } : c))
  );

  if (updates.completed === true) {
    await cancelItemNotifications('chores', 'chore', choreId);
  }
};

const deleteChore = async (choreId) => {
  if (!authUser?.id) return;

  await cancelItemNotifications('chores', 'chore', choreId);

  const { error } = await supabase
    .from('chores')
    .delete()
    .eq('id', choreId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting chore:', error);
  }

  setChores((prev) => prev.filter((c) => c.id !== choreId));
};

const mapReminderRow = (row) => {
  const parts = parseDateTimeParts(row?.date || null);
  return {
    id: row?.id,
    title: row?.title,
    description: row?.description || '',
    date: parts.date,
    time: row?.time || parts.time,
    dateTime: parts.dateTimeISO,
    createdAt: row?.created_at,
  };
};

const fetchRemindersFromSupabase = async (userId) => {
  const reminderSelectFields = 'id, title, description, date, time, created_at, notification_ids';
  let { data, error } = await supabase
    .from('reminders')
    .select(reminderSelectFields)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error && isMissingColumnError(error, 'notification_ids')) {
    ({ data, error } = await supabase
      .from('reminders')
      .select('id, title, description, date, time, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }));
  }

  if (error) {
    console.log('Error fetching reminders:', error);
    return;
  }

  seedNotificationCacheFromRows('reminder', data || []);

  const mapped = (data || []).map((r) => mapReminderRow(r));

  setReminders(mapped);
};

  // REMINDER FUNCTIONS
const addReminder = async (reminder) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a reminder.');
  }

  const combinedDate = buildDateWithTime(
    reminder.date || reminder.dateTime,
    reminder.time,
    DEFAULT_EVENT_TIME.hour,
    DEFAULT_EVENT_TIME.minute
  );

  const payload = {
    user_id: authUser.id,
    title: reminder.title,
    description: reminder.description || null,
  };

  if (combinedDate) {
    payload.date = combinedDate.toISOString().slice(0, 10);
    payload.time = reminder.time || formatTimeFromDate(combinedDate);
  } else {
    payload.date = reminder.dateTime || reminder.date || null;
    if (reminder.time) payload.time = reminder.time;
  }

  const { data, error } = await supabase
    .from('reminders')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.log('Error adding reminder:', error);
    throw error;
  }

  const newReminder = mapReminderRow({
    ...data,
    description: data?.description ?? reminder.description,
    time: data?.time ?? reminder.time,
  });

  setReminders((prev) => [...prev, newReminder]);
  return newReminder;
};

const deleteReminder = async (reminderId) => {
  if (!authUser?.id) return;

  await cancelItemNotifications('reminders', 'reminder', reminderId);

  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', reminderId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting reminder:', error);
  }

  setReminders((prev) => prev.filter((r) => r.id !== reminderId));
};



const GROCERY_DEFAULT_LIST_EMOJI = '\uD83D\uDED2';

const mapGroceryListRow = (row) => ({
  id: row?.id,
  name: row?.name || 'Untitled List',
  emoji: row?.emoji || GROCERY_DEFAULT_LIST_EMOJI,
  dueDate: row?.due_date || null,
  dueTime: row?.due_time || null,
  createdAt: row?.created_at || null,
});

const fetchGroceriesFromSupabase = async (userId) => {
  let listData = [];
  let listResult = await supabase
    .from('grocery_lists')
    .select('id, name, emoji, due_date, due_time, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (
    listResult.error &&
    (isMissingColumnError(listResult.error, 'due_date') ||
      isMissingColumnError(listResult.error, 'due_time'))
  ) {
    listResult = await supabase
      .from('grocery_lists')
      .select('id, name, emoji, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
  }

  if (listResult.error) {
    if (!isMissingRelationError(listResult.error, 'grocery_lists')) {
      console.log('Error fetching grocery lists:', listResult.error);
    }
  } else {
    listData = listResult.data || [];
  }

  const groceryAttempts = [
    { fields: 'id, name, completed, created_at, list_id, due_date, due_time', includesListId: true, includesDue: true },
    { fields: 'id, name, completed, created_at, list_id', includesListId: true, includesDue: false },
    { fields: 'id, name, completed, created_at, due_date, due_time', includesListId: false, includesDue: true },
    { fields: 'id, name, completed, created_at', includesListId: false, includesDue: false },
  ];

  let groceryRows = [];
  let selectWithListId = true;
  let selectWithDue = true;
  let groceryError = null;
  for (const attempt of groceryAttempts) {
    const result = await supabase
      .from('groceries')
      .select(attempt.fields)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (!result.error) {
      groceryRows = result.data || [];
      selectWithListId = attempt.includesListId;
      selectWithDue = attempt.includesDue;
      groceryError = null;
      break;
    }

    groceryError = result.error;
    if (
      isMissingColumnError(result.error, 'list_id') ||
      isMissingColumnError(result.error, 'due_date') ||
      isMissingColumnError(result.error, 'due_time')
    ) {
      continue;
    }
    break;
  }

  if (groceryError) {
    console.log('Error fetching groceries:', groceryError);
    return;
  }

  const mappedLists = (listData || [])
    .map(mapGroceryListRow)
    .filter((list) => !!list?.id);
  const validListIds = new Set(mappedLists.map((list) => list.id));
  const fallbackListId = mappedLists[0]?.id || null;
  const mappedItems = groceryRows.map((g) => {
    const rawListId = selectWithListId ? g.list_id : null;
    const resolvedListId =
      rawListId && validListIds.has(rawListId) ? rawListId : fallbackListId;
    return {
      id: g.id,
      name: g.name,
      completed: g.completed,
      createdAt: g.created_at,
      listId: resolvedListId,
      dueDate: selectWithDue ? g.due_date || null : null,
      dueTime: selectWithDue ? g.due_time || null : null,
    };
  });

  setGroceryLists(mappedLists);
  setGroceries(mappedItems);
};

const addGroceryList = async (name, emoji = GROCERY_DEFAULT_LIST_EMOJI, options = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to create grocery lists.');
  }

  const listName = String(name || '').trim();
  const listEmoji = String(emoji || '').trim() || GROCERY_DEFAULT_LIST_EMOJI;
  const dueDate = String(options?.dueDate || '').trim() || null;
  const dueTime = String(options?.dueTime || '').trim() || null;
  if (!listName) {
    throw new Error('List name is required.');
  }

  const listInsertAttempts = [
    { includeDue: true, fields: 'id, name, emoji, due_date, due_time, created_at' },
    { includeDue: false, fields: 'id, name, emoji, created_at' },
  ];

  let data = null;
  let error = null;
  for (const attempt of listInsertAttempts) {
    const payload = {
      user_id: authUser.id,
      name: listName,
      emoji: listEmoji,
    };
    if (attempt.includeDue) {
      payload.due_date = dueDate;
      payload.due_time = dueTime;
    }

    const result = await supabase
      .from('grocery_lists')
      .insert(payload)
      .select(attempt.fields)
      .single();

    data = result.data;
    error = result.error;
    if (!error) break;

    if (
      attempt.includeDue &&
      (isMissingColumnError(error, 'due_date') || isMissingColumnError(error, 'due_time'))
    ) {
      continue;
    }
    break;
  }

  if (error) {
    if (isMissingRelationError(error, 'grocery_lists')) {
      throw new Error('Missing grocery lists table. Run the new grocery list SQL migration first.');
    }
    console.log('Error adding grocery list:', error);
    throw error;
  }

  const newList = mapGroceryListRow(data);
  setGroceryLists((prev) => [...prev, newList]);
  return newList;
};

const updateGroceryList = async (listId, updates = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to edit grocery lists.');
  }
  if (!listId) {
    throw new Error('List id is required.');
  }

  const payload = {};
  if (updates?.name !== undefined) {
    const nextName = String(updates.name || '').trim();
    if (!nextName) {
      throw new Error('List name is required.');
    }
    payload.name = nextName;
  }
  if (updates?.emoji !== undefined) {
    payload.emoji = String(updates.emoji || '').trim() || GROCERY_DEFAULT_LIST_EMOJI;
  }
  if (updates?.dueDate !== undefined) {
    payload.due_date = String(updates.dueDate || '').trim() || null;
  }
  if (updates?.dueTime !== undefined) {
    payload.due_time = String(updates.dueTime || '').trim() || null;
  }

  if (!Object.keys(payload).length) {
    return groceryLists.find((list) => list.id === listId) || null;
  }

  const listUpdateAttempts = [
    { includeDue: true, fields: 'id, name, emoji, due_date, due_time, created_at' },
    { includeDue: false, fields: 'id, name, emoji, created_at' },
  ];

  let data = null;
  let error = null;
  for (const attempt of listUpdateAttempts) {
    const attemptPayload = { ...payload };
    if (!attempt.includeDue) {
      delete attemptPayload.due_date;
      delete attemptPayload.due_time;
    }

    const result = await supabase
      .from('grocery_lists')
      .update(attemptPayload)
      .eq('id', listId)
      .eq('user_id', authUser.id)
      .select(attempt.fields)
      .single();

    data = result.data;
    error = result.error;
    if (!error) break;

    if (
      attempt.includeDue &&
      (isMissingColumnError(error, 'due_date') || isMissingColumnError(error, 'due_time'))
    ) {
      continue;
    }
    break;
  }

  if (error) {
    console.log('Error updating grocery list:', error);
    throw error;
  }

  const updatedList = mapGroceryListRow(data);
  setGroceryLists((prev) =>
    prev.map((list) => (list.id === listId ? updatedList : list))
  );
  return updatedList;
};

const deleteGroceryList = async (listId) => {
  if (!authUser?.id || !listId) return;

  const { error } = await supabase
    .from('grocery_lists')
    .delete()
    .eq('id', listId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting grocery list:', error);
    throw error;
  }

  setGroceryLists((prev) => prev.filter((list) => list.id !== listId));
  setGroceries((prev) => prev.filter((item) => item.listId !== listId));
};

const addGroceryItem = async (item, listIdParam, options = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add groceries.');
  }

  const name = String(item || '').trim();
  const dueDate = String(options?.dueDate || '').trim() || null;
  const dueTime = String(options?.dueTime || '').trim() || null;
  if (!name) {
    throw new Error('Item name is required.');
  }

  const normalizedListId = listIdParam || null;
  const fallbackListId =
    normalizedListId ||
    groceryLists[0]?.id ||
    null;

  const itemInsertAttempts = [
    {
      includeListId: true,
      includeDue: true,
      fields: 'id, name, completed, created_at, list_id, due_date, due_time',
    },
    {
      includeListId: true,
      includeDue: false,
      fields: 'id, name, completed, created_at, list_id',
    },
    {
      includeListId: false,
      includeDue: true,
      fields: 'id, name, completed, created_at, due_date, due_time',
    },
    {
      includeListId: false,
      includeDue: false,
      fields: 'id, name, completed, created_at',
    },
  ];

  let data = null;
  let error = null;
  let insertedWithDue = false;
  for (const attempt of itemInsertAttempts) {
    const payload = {
      user_id: authUser.id,
      name,
      completed: false,
    };
    if (attempt.includeListId && fallbackListId) {
      payload.list_id = fallbackListId;
    }
    if (attempt.includeDue) {
      payload.due_date = dueDate;
      payload.due_time = dueTime;
    }

    const result = await supabase
      .from('groceries')
      .insert(payload)
      .select(attempt.fields)
      .single();

    data = result.data;
    error = result.error;
    insertedWithDue = attempt.includeDue;
    if (!error) break;

    if (
      isMissingColumnError(error, 'list_id') ||
      isMissingColumnError(error, 'due_date') ||
      isMissingColumnError(error, 'due_time')
    ) {
      continue;
    }
    break;
  }

  if (error) {
    console.log('Error adding grocery item:', error);
    throw error;
  }

  const newItem = {
    id: data.id,
    name: data.name,
    completed: data.completed,
    createdAt: data.created_at,
    listId: data.list_id || fallbackListId || groceryLists[0]?.id || null,
    dueDate: insertedWithDue ? data.due_date || null : null,
    dueTime: insertedWithDue ? data.due_time || null : null,
  };

  setGroceries((prev) => [...prev, newItem]);
  return newItem;
};

const toggleGroceryItem = async (itemId) => {
  if (!authUser?.id) return;

  const item = groceries.find((g) => g.id === itemId);
  if (!item) return;

  const newCompleted = !item.completed;

  const { error } = await supabase
    .from('groceries')
    .update({ completed: newCompleted })
    .eq('id', itemId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error toggling grocery item:', error);
    return;
  }

  setGroceries((prev) =>
    prev.map((g) =>
      g.id === itemId ? { ...g, completed: newCompleted } : g
    )
  );
};

const deleteGroceryItem = async (itemId) => {
  if (!authUser?.id) return;

  const { error } = await supabase
    .from('groceries')
    .delete()
    .eq('id', itemId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting grocery item:', error);
  }

  setGroceries((prev) => prev.filter((g) => g.id !== itemId));
};

const clearCompletedGroceries = async (listId = null) => {
  if (!authUser?.id) return;

  const completedIds = groceries
    .filter((g) => g.completed && (!listId || g.listId === listId))
    .map((g) => g.id);

  if (completedIds.length > 0) {
    const { error } = await supabase
      .from('groceries')
      .delete()
      .in('id', completedIds)
      .eq('user_id', authUser.id);

    if (error) {
      console.log('Error clearing completed groceries:', error);
    }
  }

  setGroceries((prev) =>
    prev.filter((g) => !g.completed || (listId && g.listId !== listId))
  );
};





const getBudgetStorageKey = (userId) =>
  `${STORAGE_KEYS.BUDGETS}_${userId || 'anon'}`;

const persistBudgetGroupsLocally = async (data, userIdParam) => {
  const userId = userIdParam || authUser?.id;
  if (!userId) return;
  await saveToStorage(getBudgetStorageKey(userId), data);
};

const hydrateBudgetGroups = async (userId) => {
  if (!userId) {
    setBudgetGroups([]);
    return;
  }

  const stored = await AsyncStorage.getItem(getBudgetStorageKey(userId));
  if (!stored) {
    setBudgetGroups([]);
    return;
  }

  try {
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      setBudgetGroups(parsed);
    } else {
      setBudgetGroups([]);
    }
  } catch (err) {
    console.log('Error parsing cached budgets', err);
    setBudgetGroups([]);
  }
};

const fetchBudgetGroupsFromSupabase = async (userId) => {
  if (!userId) return;
  const { data, error } = await supabase
    .from('budget_groups')
    .select(
      'id, name, type, cadence, target, categories, currency, note, recurring_payments, start_date, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('Error fetching budget groups:', error);
    await hydrateBudgetGroups(userId);
    return;
  }

  const mapped = (data || []).map((row) => ({
    id: row.id,
    name: row.name || 'Budget group',
    type: row.type || 'budget',
    cadence: row.cadence || 'monthly',
    target: Number(row.target) || 0,
    categories: Array.isArray(row.categories)
      ? row.categories
      : row.categories
      ? [].concat(row.categories)
      : [],
    currency: row.currency || userSettings.defaultCurrencyCode || 'USD',
    note: row.note || '',
    recurringPayments: Array.isArray(row.recurring_payments)
      ? row.recurring_payments
      : [],
    startDate: row.start_date || row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  setBudgetGroups(mapped);
  persistBudgetGroupsLocally(mapped, userId);
};

const getBudgetWindow = (cadence = 'monthly', referenceDate = new Date()) => {
  const today = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const start = new Date(today);
  const end = new Date(today);

  if (cadence === 'weekly') {
    const day = today.getDay();
    start.setDate(today.getDate() - day);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  if (cadence === 'yearly') {
    start.setMonth(0, 1);
    start.setHours(0, 0, 0, 0);
    end.setFullYear(start.getFullYear() + 1, 0, 1);
    end.setHours(0, 0, 0, 0);
    return { start, end };
  }

  // Default monthly
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  end.setMonth(start.getMonth() + 1, 1);
  end.setHours(0, 0, 0, 0);
  return { start, end };
};

const getBudgetAssignmentKey = (userId) =>
  `${STORAGE_KEYS.BUDGET_ASSIGNMENTS}_${userId || 'anon'}`;

const persistBudgetAssignmentsLocally = async (data, userIdParam) => {
  const userId = userIdParam || authUser?.id;
  if (!userId) return;
  await saveToStorage(getBudgetAssignmentKey(userId), data);
};

const hydrateBudgetAssignments = async (userId) => {
  if (!userId) {
    setBudgetAssignments({});
    return;
  }
  const stored = await AsyncStorage.getItem(getBudgetAssignmentKey(userId));
  if (!stored) {
    setBudgetAssignments({});
    return;
  }
  try {
    const parsed = JSON.parse(stored);
    setBudgetAssignments(parsed && typeof parsed === 'object' ? parsed : {});
  } catch (err) {
    console.log('Error parsing budget assignments', err);
    setBudgetAssignments({});
  }
};

const fetchBudgetAssignmentsFromSupabase = async (userId) => {
  if (!userId) return;
  const { data, error } = await supabase
    .from('budget_group_transactions')
    .select('transaction_id, group_id')
    .eq('user_id', userId);

  if (error) {
    console.log('Error fetching budget assignments:', error);
    await hydrateBudgetAssignments(userId);
    return;
  }

  const map = {};
  (data || []).forEach((row) => {
    const txId = row.transaction_id;
    if (!txId) return;
    if (!map[txId]) map[txId] = [];
    map[txId].push(row.group_id);
  });

  setBudgetAssignments(map);
  persistBudgetAssignmentsLocally(map, userId);
};

const getBudgetSpendForGroup = useCallback(
  (group, referenceDate = new Date()) => {
    if (!group) {
      return { spent: 0, start: null, end: null, income: 0 };
    }

    const { start, end } = getBudgetWindow(group.cadence, referenceDate);

    const inWindow = finances.filter((t) => {
      const ts = new Date(t.date || t.createdAt);
      return ts >= start && ts < end;
    });

    const spent = inWindow
      .filter((t) => t.type === 'expense')
      .filter((t) => {
        const assigned = budgetAssignments?.[t.id] || [];
        return assigned.includes(group.id);
      })
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const income = 0;

    return { spent, start, end, income };
  },
  [finances, budgetAssignments]
);

const linkTransactionToBudgetGroups = async (transactionId, groupIds = []) => {
  if (!authUser?.id || !transactionId) return;
  const clean = Array.isArray(groupIds)
    ? groupIds.filter(Boolean)
    : [];
  try {
    await supabase
      .from('budget_group_transactions')
      .delete()
      .eq('user_id', authUser.id)
      .eq('transaction_id', transactionId);

    if (clean.length) {
      const rows = clean.map((groupId) => ({
        id: uuid.v4(),
        user_id: authUser.id,
        transaction_id: transactionId,
        group_id: groupId,
      }));
      await supabase
        .from('budget_group_transactions')
        .upsert(rows, { onConflict: 'transaction_id,group_id' });
    }
  } catch (err) {
    console.log('Error syncing budget assignments:', err);
  }

  setBudgetAssignments((prev) => {
    const next = { ...prev };
    if (!clean.length) {
      delete next[transactionId];
    } else {
      next[transactionId] = clean;
    }
    persistBudgetAssignmentsLocally(next, authUser.id);
    return next;
  });
};

const addBudgetGroup = async (payload = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a budget.');
  }

  const nowISO = new Date().toISOString();
  const insertPayload = {
    user_id: authUser.id,
    name: payload.name?.trim() || 'Budget group',
    type: payload.type === 'recurring' ? 'recurring' : 'budget',
    cadence: payload.cadence || 'monthly',
    target: Number(payload.target) || 0,
    categories: Array.isArray(payload.categories)
      ? payload.categories.filter(Boolean)
      : [],
    currency: payload.currency || userSettings.defaultCurrencyCode || 'USD',
    note: payload.note || '',
    recurring_payments: Array.isArray(payload.recurringPayments)
      ? payload.recurringPayments
      : [],
    start_date: payload.startDate || nowISO,
  };

  const { data, error } = await supabase
    .from('budget_groups')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    console.log('Error adding budget group:', error);
    throw error;
  }

  const newGroup = {
    id: data.id,
    name: data.name,
    type: data.type,
    cadence: data.cadence,
    target: Number(data.target) || 0,
    categories: Array.isArray(data.categories) ? data.categories : [],
    currency: data.currency,
    note: data.note,
    recurringPayments: Array.isArray(data.recurring_payments)
      ? data.recurring_payments
      : [],
    startDate: data.start_date || nowISO,
    createdAt: data.created_at || nowISO,
    updatedAt: data.updated_at || nowISO,
  };

  setBudgetGroups((prev) => {
    const next = [...prev, newGroup];
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  return newGroup;
};

const updateBudgetGroup = async (groupId, updates = {}) => {
  if (!authUser?.id) return null;
  let updated = null;

  const updatePayload = {
    name: updates.name,
    type: updates.type,
    cadence: updates.cadence,
    target: updates.target,
    categories: updates.categories,
    currency: updates.currency,
    note: updates.note,
    recurring_payments: updates.recurringPayments,
    start_date: updates.startDate,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('budget_groups')
    .update(updatePayload)
    .eq('id', groupId)
    .eq('user_id', authUser.id);

  setBudgetGroups((prev) => {
    const next = prev.map((group) => {
      if (group.id !== groupId) return group;
      updated = {
        ...group,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  return updated;
};

const deleteBudgetGroup = async (groupId) => {
  if (!authUser?.id) return;

  await supabase
    .from('budget_group_transactions')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', authUser.id);

  await supabase
    .from('budget_groups')
    .delete()
    .eq('id', groupId)
    .eq('user_id', authUser.id);

  setBudgetGroups((prev) => {
    const next = prev.filter((g) => g.id !== groupId);
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  setBudgetAssignments((prev) => {
    const next = {};
    Object.entries(prev || {}).forEach(([txId, groupIds]) => {
      const filtered = (groupIds || []).filter((gid) => gid !== groupId);
      if (filtered.length) next[txId] = filtered;
    });
    persistBudgetAssignmentsLocally(next, authUser.id);
    return next;
  });
};

const addRecurringPaymentToGroup = async (groupId, payment = {}) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add recurring payments.');
  }

  const newPayment = {
    id: payment.id || uuid.v4(),
    name: payment.name?.trim() || 'Recurring payment',
    amount: Number(payment.amount) || 0,
    cadence: payment.cadence || 'monthly',
    nextDueDate: payment.nextDueDate || null,
    startDate: payment.startDate || new Date().toISOString(),
  };

  setBudgetGroups((prev) => {
    const next = prev.map((group) => {
      if (group.id !== groupId) return group;
      const recurringPayments = Array.isArray(group.recurringPayments)
        ? [...group.recurringPayments, newPayment]
        : [newPayment];
      supabase
        .from('budget_groups')
        .update({ recurring_payments: recurringPayments, updated_at: new Date().toISOString() })
        .eq('id', groupId)
        .eq('user_id', authUser.id);
      return {
        ...group,
        recurringPayments,
        updatedAt: new Date().toISOString(),
      };
    });
    persistBudgetGroupsLocally(next, authUser.id);
    return next;
  });

  return newPayment;
};


const fetchFinancesFromSupabase = async (userId) => {
  const fetchAttempts = [
    {
      select: 'id, type, amount, category, currency, date, reference, note, created_at',
      hasReference: true,
    },
    {
      select: 'id, type, amount, category, currency, date, note, created_at',
      hasReference: false,
    },
  ];

  let rows = [];
  for (const attempt of fetchAttempts) {
    const { data, error } = await supabase
      .from('finance_transactions')
      .select(attempt.select)
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (error && attempt.hasReference && isMissingColumnError(error, 'reference')) {
      continue;
    }

    if (error) {
      console.log('Error fetching finances:', error);
      return;
    }

    rows = data || [];
    break;
  }

  const mapped = rows.map((t) => ({
    id: t.id,
    type: t.type,
    amount: Number(t.amount),
    category: t.category,
    currency: t.currency,
    date: t.date,
    reference: t.reference || t.note || null,
    note: t.note,
    createdAt: t.created_at,
  }));

  setFinances(mapped);
};



  // FINANCE FUNCTIONS
const addTransaction = async (transaction) => {
  if (!authUser?.id) {
    throw new Error('You must be logged in to add a transaction.');
  }

  const basePayload = {
    user_id: authUser.id,
    type: transaction.type, // 'income' or 'expense'
    amount: transaction.amount,
    category: transaction.category || null,
    currency: transaction.currency || 'GBP',
    date: transaction.date,
    reference: transaction.reference || null,
    note: transaction.note || null,
  };

  const insertAttempts = [
    { payload: basePayload, hasReference: true },
    {
      payload: {
        user_id: authUser.id,
        type: transaction.type,
        amount: transaction.amount,
        category: transaction.category || null,
        currency: transaction.currency || 'GBP',
        date: transaction.date,
        note: transaction.note || null,
      },
      hasReference: false,
    },
  ];

  let data = null;
  let finalError = null;
  for (const attempt of insertAttempts) {
    const result = await supabase
      .from('finance_transactions')
      .insert(attempt.payload)
      .select()
      .single();

    if (result.error && attempt.hasReference && isMissingColumnError(result.error, 'reference')) {
      continue;
    }

    data = result.data;
    finalError = result.error;
    break;
  }

  if (finalError) {
    console.log('Error adding transaction:', finalError);
    throw finalError;
  }

  const newTransaction = {
    id: data.id,
    type: data.type,
    amount: Number(data.amount),
    category: data.category,
    currency: data.currency,
    date: data.date,
    reference: data.reference || transaction.reference || data.note || null,
    note: data.note,
    createdAt: data.created_at,
  };

  setFinances((prev) => [...prev, newTransaction]);

  if (transaction.type === 'expense') {
    const budgetGroupIds = Array.isArray(transaction.budgetGroupIds)
      ? transaction.budgetGroupIds.filter(Boolean)
      : [];
    await linkTransactionToBudgetGroups(newTransaction.id, budgetGroupIds);
  }

  return newTransaction;
};

const deleteTransaction = async (transactionId) => {
  if (!authUser?.id) return;

  await supabase
    .from('budget_group_transactions')
    .delete()
    .eq('transaction_id', transactionId)
    .eq('user_id', authUser.id);

  const { error } = await supabase
    .from('finance_transactions')
    .delete()
    .eq('id', transactionId)
    .eq('user_id', authUser.id);

  if (error) {
    console.log('Error deleting transaction:', error);
  }

  setFinances((prev) => prev.filter((f) => f.id !== transactionId));
  setBudgetAssignments((prev) => {
    if (!prev[transactionId]) return prev;
    const next = { ...prev };
    delete next[transactionId];
    persistBudgetAssignmentsLocally(next, authUser.id);
    return next;
  });
};

const getTransactionsForDate = (date) => {
  const dateString = new Date(date).toDateString();
  return finances.filter(
    (f) => new Date(f.date).toDateString() === dateString
  );
};

const getFinanceSummaryForDate = (date) => {
  const transactions = getTransactionsForDate(date);
  const income = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  return {
    income,
    expenses,
    balance: income - expenses,
  };
};

  // PROFILE FUNCTIONS
  const isMissingColumnError = (error, column) => {
    if (!error) return false;
    const message = (error.message || '').toLowerCase();
    const details = (error.details || '').toLowerCase();
    const hint = (error.hint || '').toLowerCase();
    const combined = `${message} ${details} ${hint}`;
    const columnName = (column || '').toLowerCase();
    return (
      error.code === '42703' ||
      error.code === 'PGRST204' ||
      combined.includes('does not exist') ||
      (combined.includes('could not find') && combined.includes('column')) ||
      (combined.includes('schema cache') && combined.includes('column')) ||
      (columnName && combined.includes(columnName))
    );
  };

  const extractMissingColumnName = (error) => {
    if (!error) return null;
    const parts = [error.message, error.details, error.hint]
      .filter((value) => typeof value === 'string' && value.trim())
      .join(' ');
    if (!parts) return null;

    const patterns = [
      /could not find the ['"]([^'"]+)['"] column/i,
      /column ['"]([^'"]+)['"] does not exist/i,
      /column\s+([a-z0-9_.]+)\s+does not exist/i,
    ];

    for (const pattern of patterns) {
      const match = parts.match(pattern);
      if (!match?.[1]) continue;
      const normalized = String(match[1])
        .split('.')
        .pop()
        .replace(/[^a-z0-9_]/gi, '')
        .toLowerCase();
      if (normalized) return normalized;
    }

    return null;
  };

const mapProfileRow = (row) => {
  const preferredDailyCalorieGoal =
    row?.daily_calorie_goal ?? defaultProfile.dailyCalorieGoal;
  const weightManagerTargetCalories = asNumber(
    row?.weight_manager_target_calories,
    defaultProfile.weightManagerTargetCalories
  );
  const hasWeightManagerGoal =
    Number.isFinite(weightManagerTargetCalories) && weightManagerTargetCalories > 0;
  const dailyCalorieGoal = hasWeightManagerGoal
    ? weightManagerTargetCalories
    : preferredDailyCalorieGoal;
  const hasCompletedFromTimestamp =
    row?.app_tutorial_completed_at || row?.appTutorialCompletedAt ? true : undefined;
  const hasCompletedAppTutorial =
    row?.has_completed_app_tutorial ??
    row?.hasCompletedAppTutorial ??
    hasCompletedFromTimestamp ??
    profile.hasCompletedAppTutorial ??
    defaultProfile.hasCompletedAppTutorial;
  const appTutorialCompletedAt =
    row?.app_tutorial_completed_at ??
    row?.appTutorialCompletedAt ??
    profile.appTutorialCompletedAt ??
    defaultProfile.appTutorialCompletedAt;
  const hasCompletedHabitsFromTimestamp =
    row?.habits_tutorial_completed_at || row?.habitsTutorialCompletedAt ? true : undefined;
  const hasCompletedHabitsTutorial =
    row?.has_completed_habits_tutorial ??
    row?.hasCompletedHabitsTutorial ??
    hasCompletedHabitsFromTimestamp ??
    profile.hasCompletedHabitsTutorial ??
    defaultProfile.hasCompletedHabitsTutorial;
  const normalizedHasCompletedHabitsTutorial =
    hasCompletedHabitsTutorial === null || hasCompletedHabitsTutorial === undefined
      ? null
      : !!hasCompletedHabitsTutorial;
  const habitsTutorialCompletedAt =
    row?.habits_tutorial_completed_at ??
    row?.habitsTutorialCompletedAt ??
    profile.habitsTutorialCompletedAt ??
    defaultProfile.habitsTutorialCompletedAt;

  return {
    profileId: row?.id || null,
    name:
      row?.full_name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      authUser?.email ||
      defaultProfile.name,
    username: row?.username || authUser?.user_metadata?.username || '',
    email: row?.email || authUser?.email || profile.email || defaultProfile.email,
    photo: getAvatarPublicUrl(row?.photo || row?.avatar_url || row?.avatar) || null,
    dailyCalorieGoal,
    preferredDailyCalorieGoal,
    dailyWaterGoal: row?.daily_water_goal ?? defaultProfile.dailyWaterGoal,
    dailySleepGoal: row?.daily_sleep_goal ?? defaultProfile.dailySleepGoal,
    weightManagerUnit: row?.weight_manager_unit ?? defaultProfile.weightManagerUnit,
    weightManagerCurrentWeight: asNumber(
      row?.weight_manager_current_weight,
      defaultProfile.weightManagerCurrentWeight
    ),
    weightManagerTargetWeight: asNumber(
      row?.weight_manager_target_weight,
      defaultProfile.weightManagerTargetWeight
    ),
    weightManagerCurrentBodyType:
      row?.weight_manager_current_body_type ?? defaultProfile.weightManagerCurrentBodyType,
    weightManagerTargetBodyType:
      row?.weight_manager_target_body_type ?? defaultProfile.weightManagerTargetBodyType,
    weightManagerTargetCalories,
    weightManagerProteinGrams: asNumber(
      row?.weight_manager_protein_grams,
      defaultProfile.weightManagerProteinGrams
    ),
    weightManagerCarbsGrams: asNumber(
      row?.weight_manager_carbs_grams,
      defaultProfile.weightManagerCarbsGrams
    ),
    weightManagerFatGrams: asNumber(
      row?.weight_manager_fat_grams,
      defaultProfile.weightManagerFatGrams
    ),
    plan: row?.plan || defaultProfile.plan,
    premiumExpiresAt: row?.premium_expires_at || row?.premiumExpiresAt || defaultProfile.premiumExpiresAt,
    premium_expires_at: row?.premium_expires_at || row?.premiumExpiresAt || defaultProfile.premiumExpiresAt,
    isPremium: computeIsPremium(
      row?.plan || defaultProfile.plan,
      row?.premium_expires_at || row?.premiumExpiresAt,
      row?.is_premium ?? row?.isPremium
    ),
    hasCompletedAppTutorial: !!hasCompletedAppTutorial,
    appTutorialCompletedAt,
    app_tutorial_completed_at: appTutorialCompletedAt,
    hasCompletedHabitsTutorial: normalizedHasCompletedHabitsTutorial,
    habitsTutorialCompletedAt,
    habits_tutorial_completed_at: habitsTutorialCompletedAt,
  };
};

  // Ensure profile state has at least auth-derived values when we gain an auth user
  useEffect(() => {
    if (!authUser) return;
    setProfile((prev) => {
      const nextName =
        prev?.name && prev.name !== defaultProfile.name
          ? prev.name
          : authUser.user_metadata?.full_name ||
            authUser.user_metadata?.name ||
            authUser.email ||
            defaultProfile.name;
      const nextEmail =
        prev?.email && prev.email !== defaultProfile.email
          ? prev.email
          : authUser.email || defaultProfile.email;
      if (nextName === prev.name && nextEmail === prev.email) return prev;
      return { ...prev, name: nextName, email: nextEmail };
    });
  }, [authUser]);

  const fetchProfileFromSupabase = async (userId) => {
    if (!userId) return null;

    const fetchByColumn = async (column) => {
      const selectableColumns = [
        'id',
        'user_id',
        'username',
        'full_name',
        'email',
        'avatar_url',
        'photo',
        'daily_calorie_goal',
        'daily_water_goal',
        'daily_sleep_goal',
        'weight_manager_unit',
        'weight_manager_current_weight',
        'weight_manager_target_weight',
        'weight_manager_current_body_type',
        'weight_manager_target_body_type',
        'weight_manager_target_calories',
        'weight_manager_protein_grams',
        'weight_manager_carbs_grams',
        'weight_manager_fat_grams',
        'plan',
        'premium_expires_at',
        'is_premium',
        'has_onboarded',
        'has_completed_app_tutorial',
        'app_tutorial_completed_at',
        'has_completed_habits_tutorial',
        'habits_tutorial_completed_at',
        'created_at',
        'updated_at',
      ];

      let selectedColumns = [...selectableColumns];
      while (selectedColumns.length) {
        const { data, error } = await supabase
          .from('profiles')
          .select(selectedColumns.join(', '))
          .eq(column, userId)
          .limit(1);

        if (error && isMissingColumnError(error)) {
          const missingColumn = extractMissingColumnName(error);
          if (!missingColumn) return { row: null, error };
          const nextColumns = selectedColumns.filter(
            (name) => name.toLowerCase() !== missingColumn
          );
          if (nextColumns.length === selectedColumns.length) {
            return { row: null, error };
          }
          selectedColumns = nextColumns;
          continue;
        }

        if (error) return { row: null, error };
        const row = Array.isArray(data) ? data[0] : data;
        return { row: row || null, error: null };
      }

      return { row: null, error: null };
    };

    const pickBestProfileRow = (rows) => {
      const candidates = (rows || []).filter(Boolean);
      if (!candidates.length) return null;

      const parseTime = (value) => {
        if (!value) return null;
        const ms = new Date(value).getTime();
        return Number.isNaN(ms) ? null : ms;
      };

      const normalizeExpiry = (row) =>
        row?.premium_expires_at ?? row?.premiumExpiresAt ?? row?.premiumExpires ?? null;

      const scoreRow = (row) => {
        const plan = row?.plan || '';
        const expiry = normalizeExpiry(row);
        let score = 0;

        if (computeIsPremium(plan, expiry)) score += 100;
        const normalizedPlan = String(plan || '').toLowerCase();
        if (normalizedPlan === 'premium' || normalizedPlan === 'pro') score += 25;
        if (expiry) score += 5;
        if (row?.user_id) score += 2;
        if (row?.id === userId) score += 1;

        return score;
      };

      return candidates
        .slice()
        .sort((a, b) => {
          const scoreDiff = scoreRow(b) - scoreRow(a);
          if (scoreDiff) return scoreDiff;
          const updatedDiff = (parseTime(b?.updated_at) || 0) - (parseTime(a?.updated_at) || 0);
          if (updatedDiff) return updatedDiff;
          return (parseTime(b?.created_at) || 0) - (parseTime(a?.created_at) || 0);
        })[0];
    };

    let row = null;
    let lastError = null;

    const [byIdResult, byUserIdResult] = await Promise.all([
      fetchByColumn('id'),
      fetchByColumn('user_id'),
    ]);
    const { row: byIdRow, error: byIdError } = byIdResult;
    if (byIdError && !isMissingColumnError(byIdError, 'id')) {
      lastError = byIdError;
    }

    const { row: byUserIdRow, error: byUserIdError } = byUserIdResult;
    if (byUserIdError && !isMissingColumnError(byUserIdError, 'user_id')) {
      lastError = byUserIdError;
    }

    row = pickBestProfileRow([byIdRow, byUserIdRow]);

    if (!row && lastError) {
      console.log('Error fetching profile:', lastError);
    }

    if (!row) {
      row = await upsertProfileRow({
        id: userId,
        full_name:
          profile.name ||
          authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          authUser?.email,
        email: authUser?.email || profile.email,
      });
    }

    if (row) {
      const mapped = mapProfileRow(row);
      setProfile(mapped);
      setHasOnboarded(!!row.has_onboarded);
      setProfileLoaded(true);
      setCachedProfile(userId, mapped);
      persistProfileLocally(userId, mapped, !!row.has_onboarded);
    }

    return row;
  };

  const upsertProfileRow = async (fields = {}) => {
    const userId = authUser?.id || fields.id;
    if (!userId) return null;
    const nowISO = new Date().toISOString();

    const resolveFullName = () => {
      const candidates = [
        fields.full_name,
        fields.name,
        authUser?.user_metadata?.full_name,
        authUser?.user_metadata?.name,
        profile?.name,
      ];

      for (const value of candidates) {
        if (!value) continue;
        const trimmed = String(value).trim();
        if (!trimmed) continue;
        if (trimmed.toLowerCase() === defaultProfile.name.toLowerCase()) continue;
        return trimmed;
      }

      return undefined;
    };

    const fullName = resolveFullName();

    const basePayload = {
      id: userId,
      full_name: fullName,
      username:
        fields.username ??
        authUser?.user_metadata?.username ??
        profile.username ??
        null,
      email: fields.email ?? authUser?.email ?? profile.email ?? defaultProfile.email,
      avatar_url: fields.avatar_url ?? fields.photo ?? profile.photo ?? undefined,
      photo: fields.photo ?? profile.photo ?? undefined,
      has_onboarded: fields.has_onboarded ?? hasOnboarded,
      daily_calorie_goal:
        fields.daily_calorie_goal ??
        fields.dailyCalorieGoal ??
        profile.preferredDailyCalorieGoal ??
        profile.dailyCalorieGoal,
      daily_water_goal: fields.daily_water_goal ?? fields.dailyWaterGoal ?? profile.dailyWaterGoal,
      daily_sleep_goal: fields.daily_sleep_goal ?? fields.dailySleepGoal ?? profile.dailySleepGoal,
      weight_manager_unit:
        fields.weight_manager_unit ?? fields.weightManagerUnit ?? profile.weightManagerUnit,
      weight_manager_current_weight:
        fields.weight_manager_current_weight ??
        fields.weightManagerCurrentWeight ??
        profile.weightManagerCurrentWeight,
      weight_manager_target_weight:
        fields.weight_manager_target_weight ??
        fields.weightManagerTargetWeight ??
        profile.weightManagerTargetWeight,
      weight_manager_current_body_type:
        fields.weight_manager_current_body_type ??
        fields.weightManagerCurrentBodyType ??
        profile.weightManagerCurrentBodyType,
      weight_manager_target_body_type:
        fields.weight_manager_target_body_type ??
        fields.weightManagerTargetBodyType ??
        profile.weightManagerTargetBodyType,
      weight_manager_target_calories:
        fields.weight_manager_target_calories ??
        fields.weightManagerTargetCalories ??
        profile.weightManagerTargetCalories,
      weight_manager_protein_grams:
        fields.weight_manager_protein_grams ??
        fields.weightManagerProteinGrams ??
        profile.weightManagerProteinGrams,
      weight_manager_carbs_grams:
        fields.weight_manager_carbs_grams ??
        fields.weightManagerCarbsGrams ??
        profile.weightManagerCarbsGrams,
      weight_manager_fat_grams:
        fields.weight_manager_fat_grams ??
        fields.weightManagerFatGrams ??
        profile.weightManagerFatGrams,
      updated_at: nowISO,
    };

    // Don't overwrite subscription fields unless explicitly provided.
    // This prevents early boot/profile-creation upserts from resetting values
    // that may be managed externally (e.g. Supabase dashboard, webhooks).
    if (Object.prototype.hasOwnProperty.call(fields, 'plan')) {
      if (fields.plan !== undefined) basePayload.plan = fields.plan;
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, 'premium_expires_at') ||
      Object.prototype.hasOwnProperty.call(fields, 'premiumExpiresAt')
    ) {
      const nextPremiumExpiresAt = Object.prototype.hasOwnProperty.call(fields, 'premium_expires_at')
        ? fields.premium_expires_at
        : fields.premiumExpiresAt;
      if (nextPremiumExpiresAt !== undefined) {
        basePayload.premium_expires_at = nextPremiumExpiresAt;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, 'has_completed_app_tutorial') ||
      Object.prototype.hasOwnProperty.call(fields, 'hasCompletedAppTutorial')
    ) {
      const hasCompletedAppTutorial = Object.prototype.hasOwnProperty.call(
        fields,
        'has_completed_app_tutorial'
      )
        ? fields.has_completed_app_tutorial
        : fields.hasCompletedAppTutorial;
      if (hasCompletedAppTutorial !== undefined) {
        basePayload.has_completed_app_tutorial = !!hasCompletedAppTutorial;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, 'app_tutorial_completed_at') ||
      Object.prototype.hasOwnProperty.call(fields, 'appTutorialCompletedAt')
    ) {
      const appTutorialCompletedAt = Object.prototype.hasOwnProperty.call(
        fields,
        'app_tutorial_completed_at'
      )
        ? fields.app_tutorial_completed_at
        : fields.appTutorialCompletedAt;
      if (appTutorialCompletedAt !== undefined) {
        basePayload.app_tutorial_completed_at = appTutorialCompletedAt;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, 'has_completed_habits_tutorial') ||
      Object.prototype.hasOwnProperty.call(fields, 'hasCompletedHabitsTutorial')
    ) {
      const hasCompletedHabitsTutorial = Object.prototype.hasOwnProperty.call(
        fields,
        'has_completed_habits_tutorial'
      )
        ? fields.has_completed_habits_tutorial
        : fields.hasCompletedHabitsTutorial;
      if (hasCompletedHabitsTutorial !== undefined) {
        basePayload.has_completed_habits_tutorial = !!hasCompletedHabitsTutorial;
      }
    }
    if (
      Object.prototype.hasOwnProperty.call(fields, 'habits_tutorial_completed_at') ||
      Object.prototype.hasOwnProperty.call(fields, 'habitsTutorialCompletedAt')
    ) {
      const habitsTutorialCompletedAt = Object.prototype.hasOwnProperty.call(
        fields,
        'habits_tutorial_completed_at'
      )
        ? fields.habits_tutorial_completed_at
        : fields.habitsTutorialCompletedAt;
      if (habitsTutorialCompletedAt !== undefined) {
        basePayload.habits_tutorial_completed_at = habitsTutorialCompletedAt;
      }
    }

    const payload = pruneUndefined(basePayload);

    const attemptUpsert = async (payload, onConflict) => {
      const options = onConflict ? { onConflict } : undefined;
      return supabase.from('profiles').upsert(payload, options).select().single();
    };

    let data = null;
    let error = null;

    // First try a schema that has user_id as the unique key
    ({ data, error } = await attemptUpsert({ ...payload, user_id: userId }, 'user_id'));

    // If that fails because the column is missing or not unique, fall back to the id-based schema
    if (error) {
      if (isMissingColumnError(error, 'user_id') || error.code === '23505') {
        ({ data, error } = await attemptUpsert(payload, 'id'));
      }
    }

    if (error) {
      console.log('Error saving profile:', error);
      return null;
    }

    const mapped = mapProfileRow(data);
    setProfile(mapped);
    setHasOnboarded(!!data.has_onboarded);
    setProfileLoaded(true);
    setCachedProfile(userId, mapped);
    persistProfileLocally(userId, mapped, !!data.has_onboarded);
    return data;
  };

  const updateProfile = async (updates) => {
    const merged = { ...profile, ...updates };
    const weightManagerTargetCaloriesValue = Number(merged.weightManagerTargetCalories);
    const hasWeightManagerGoal =
      Number.isFinite(weightManagerTargetCaloriesValue) && weightManagerTargetCaloriesValue > 0;
    const hasExplicitDailyGoal =
      Object.prototype.hasOwnProperty.call(updates, 'dailyCalorieGoal') ||
      Object.prototype.hasOwnProperty.call(updates, 'daily_calorie_goal');
    const explicitDailyGoal = Object.prototype.hasOwnProperty.call(updates, 'daily_calorie_goal')
      ? updates.daily_calorie_goal
      : updates.dailyCalorieGoal;
    const resolvePreferredGoal = () => {
      if (hasExplicitDailyGoal) {
        if (explicitDailyGoal === null || explicitDailyGoal === undefined || explicitDailyGoal === '') {
          return null;
        }
        const parsed = Number(explicitDailyGoal);
        return Number.isFinite(parsed) ? parsed : null;
      }
      const existingPreferred =
        profile.preferredDailyCalorieGoal ?? profile.dailyCalorieGoal;
      const parsedPreferred = Number(existingPreferred);
      return Number.isFinite(parsedPreferred) ? parsedPreferred : null;
    };
    const nextPreferredDailyCalorieGoal = resolvePreferredGoal();

    let avatarUrl = merged.photo;
    if (updates.photo) {
      const uploadResult = await uploadProfilePhoto(updates.photo);
      avatarUrl = uploadResult?.url || avatarUrl;
    }

    const newLocalProfile = {
      ...merged,
      photo: avatarUrl,
      avatar_url: avatarUrl,
      preferredDailyCalorieGoal: nextPreferredDailyCalorieGoal,
      dailyCalorieGoal: hasWeightManagerGoal
        ? weightManagerTargetCaloriesValue
        : nextPreferredDailyCalorieGoal ?? merged.dailyCalorieGoal,
    };
    setProfile(newLocalProfile);
    if (authUser?.id) {
      setCachedProfile(authUser.id, newLocalProfile);
      persistProfileLocally(authUser.id, newLocalProfile, hasOnboarded);
    }

    const dailyGoalForProfile = hasExplicitDailyGoal
      ? nextPreferredDailyCalorieGoal
      : nextPreferredDailyCalorieGoal ?? newLocalProfile.dailyCalorieGoal;
    const payload = {
      ...updates,
      name: newLocalProfile.name,
      username: newLocalProfile.username,
      email: newLocalProfile.email,
      avatar_url: avatarUrl,
      photo: avatarUrl,
      dailyCalorieGoal: dailyGoalForProfile,
      dailyWaterGoal: newLocalProfile.dailyWaterGoal,
      dailySleepGoal: newLocalProfile.dailySleepGoal,
      weightManagerUnit: newLocalProfile.weightManagerUnit,
      weightManagerCurrentWeight: newLocalProfile.weightManagerCurrentWeight,
      weightManagerTargetWeight: newLocalProfile.weightManagerTargetWeight,
      weightManagerCurrentBodyType: newLocalProfile.weightManagerCurrentBodyType,
      weightManagerTargetBodyType: newLocalProfile.weightManagerTargetBodyType,
      weightManagerTargetCalories: newLocalProfile.weightManagerTargetCalories,
      weightManagerProteinGrams: newLocalProfile.weightManagerProteinGrams,
      weightManagerCarbsGrams: newLocalProfile.weightManagerCarbsGrams,
      weightManagerFatGrams: newLocalProfile.weightManagerFatGrams,
    };

    return upsertProfileRow(payload);
  };

  // USER SETTINGS FUNCTIONS
  const mapSettingsRow = (row) => ({
    id: row?.id || null,
    themeName: row?.theme_name || 'default',
    notificationsEnabled: row?.notifications_enabled ?? defaultUserSettings.notificationsEnabled,
    habitRemindersEnabled: row?.habit_reminders_enabled ?? defaultUserSettings.habitRemindersEnabled,
    taskRemindersEnabled: row?.task_reminders_enabled ?? defaultUserSettings.taskRemindersEnabled,
    healthRemindersEnabled: row?.health_reminders_enabled ?? defaultUserSettings.healthRemindersEnabled,
    defaultCurrencyCode: row?.default_currency_code || defaultUserSettings.defaultCurrencyCode,
  });

  const fetchUserSettings = async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('user_settings')
      .select(
        'id, user_id, theme_name, notifications_enabled, habit_reminders_enabled, task_reminders_enabled, health_reminders_enabled, default_currency_code'
      )
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.log('Error fetching user settings:', error);
      return null;
    }

    let row = data;

    if (!row) {
      row = await upsertUserSettings({ ...defaultUserSettings }, userId);
    }

    if (row) {
      const mapped = mapSettingsRow(row);
      setUserSettings(mapped);
      const themeToApply = mapped.themeName || 'default';
      setThemeName(themeToApply);
      applyTheme(themeToApply);
      cacheThemeLocally(themeToApply);
    }

    return row;
  };

  const upsertUserSettings = async (overrides = {}, userIdParam) => {
    const userId = userIdParam || authUser?.id;
    if (!userId) return null;
    const nowISO = new Date().toISOString();
    const payload = {
      id: overrides.id || userSettings.id || undefined,
      user_id: userId,
      theme_name: overrides.themeName ?? userSettings.themeName ?? defaultUserSettings.themeName,
      notifications_enabled: overrides.notificationsEnabled ?? userSettings.notificationsEnabled ?? defaultUserSettings.notificationsEnabled,
      habit_reminders_enabled: overrides.habitRemindersEnabled ?? userSettings.habitRemindersEnabled ?? defaultUserSettings.habitRemindersEnabled,
      task_reminders_enabled: overrides.taskRemindersEnabled ?? userSettings.taskRemindersEnabled ?? defaultUserSettings.taskRemindersEnabled,
      health_reminders_enabled: overrides.healthRemindersEnabled ?? userSettings.healthRemindersEnabled ?? defaultUserSettings.healthRemindersEnabled,
      default_currency_code: overrides.defaultCurrencyCode ?? userSettings.defaultCurrencyCode ?? defaultUserSettings.defaultCurrencyCode,
      language: 'en',
      updated_at: nowISO,
    };

    if (!payload.id) {
      delete payload.id;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.log('Error saving user settings:', error);
      return null;
    }

    const mapped = mapSettingsRow(data);
    setUserSettings(mapped);
    return data;
  };

  const updateUserSettings = async (updates) => {
    const merged = { ...userSettings, ...updates };
    setUserSettings(merged);
    return upsertUserSettings(merged);
  };

  const t = (text) => text;

  const uploadProfilePhoto = async (uri) => {
    if (!uri) return { url: null };
    // If already a remote URL or data URI, keep as-is (no upload)
    if (uri.startsWith('http') || uri.startsWith('data:image')) {
      return { url: uri };
    }
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64Promise = new Promise((resolve, reject) => {
        reader.onerror = reject;
        reader.onloadend = () => resolve(reader.result);
      });
      reader.readAsDataURL(blob);
      const dataUrl = (await base64Promise) || uri;
      return { url: typeof dataUrl === 'string' ? dataUrl : uri };
    } catch (err) {
      console.log('Error preparing avatar upload:', err);
      return { url: uri };
    }
  };

  // AUTH FUNCTIONS
  const persistOnboarding = async (value) => {
    setHasOnboarded(value);
    await upsertProfileRow({ has_onboarded: value });
  };

  const completeAppTutorial = useCallback(async () => {
    if (!authUser?.id) return;
    const completedAt = new Date().toISOString();
    const nextProfile = {
      ...profile,
      hasCompletedAppTutorial: true,
      appTutorialCompletedAt: completedAt,
      app_tutorial_completed_at: completedAt,
    };

    setProfile(nextProfile);
    setCachedProfile(authUser.id, nextProfile);
    persistProfileLocally(authUser.id, nextProfile, hasOnboarded);

    await upsertProfileRow({
      has_completed_app_tutorial: true,
      app_tutorial_completed_at: completedAt,
    });
  }, [
    authUser?.id,
    hasOnboarded,
    profile,
    setCachedProfile,
    upsertProfileRow,
    persistProfileLocally,
  ]);

  const completeHabitsTutorial = useCallback(async () => {
    if (!authUser?.id) return;
    const completedAt = new Date().toISOString();
    const nextProfile = {
      ...profile,
      hasCompletedHabitsTutorial: true,
      habitsTutorialCompletedAt: completedAt,
      habits_tutorial_completed_at: completedAt,
    };

    setProfile(nextProfile);
    setCachedProfile(authUser.id, nextProfile);
    persistProfileLocally(authUser.id, nextProfile, hasOnboarded);

    await upsertProfileRow({
      has_completed_habits_tutorial: true,
      habits_tutorial_completed_at: completedAt,
    });
  }, [
    authUser?.id,
    hasOnboarded,
    profile,
    setCachedProfile,
    upsertProfileRow,
    persistProfileLocally,
  ]);

  const setActiveUser = async (user) => {
    // `user` is a Supabase auth user object
    const isSameUser = authUser?.id && user?.id && String(authUser.id) === String(user.id);
    setProfileLoaded(false);
    dataLoadTimestampsRef.current = {};
    friendDataPromiseRef.current = null;
    healthDataPromiseRef.current = null;
    lastPresenceUpdateRef.current = 0;

    // Optional: keep a local copy (offline cache)
    await saveToStorage(STORAGE_KEYS.AUTH_USER, user);

    setProfile((prev) => ({
      ...(isSameUser ? prev : defaultProfile),
      name:
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.username ||
        user.email ||
        (isSameUser ? prev.name : defaultProfile.name),
      username:
        user.user_metadata?.username ||
        (isSameUser ? prev.username : defaultProfile.username),
      email: user.email || (isSameUser ? prev.email : defaultProfile.email),
    }));

    await hydrateCachedProfile(user.id);
    setAuthUser(user);
  };

  const validatePasswordRequirements = (password) => {
    if (!password || password.length < 6) {
      return 'Password must be at least 6 characters and include at least one uppercase letter and one symbol.';
    }

    if (!/[A-Z]/.test(password)) {
      return 'Password must include at least one uppercase letter.';
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      return 'Password must include at least one symbol.';
    }

    return null;
  };

  const signIn = async ({ identifier, password }) => {
    // We now sign in with EMAIL (identifier is email)
    const email = identifier?.trim().toLowerCase();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message || 'Unable to sign in.');
    }

    const { user, session } = data || {};
    let activeSession = session;
    if (!activeSession?.access_token || !activeSession?.refresh_token) {
      const { data: sessionData } = await supabase.auth.getSession();
      activeSession = sessionData?.session || activeSession;
    }
    if (user) {
      await setActiveUser(user);
    }
    return { user, session: activeSession };
  };

  const signUp = async ({ fullName, username, email, password }) => {
    const trimmedEmail = email?.trim().toLowerCase();
    const passwordError = validatePasswordRequirements(password);
    if (passwordError) {
      throw new Error(passwordError);
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          username,
        },
      },
    });

    if (error) {
      throw new Error(error.message || 'Unable to create account.');
    }

    const { user, session } = data || {};
    let activeSession = session;
    if (!activeSession?.access_token || !activeSession?.refresh_token) {
      const { data: sessionData } = await supabase.auth.getSession();
      activeSession = sessionData?.session || activeSession;
    }

    // If email confirmation is required, user can exist while session is still null.
    // Only activate app-side user state once we have an authenticated session.
    if (user && activeSession?.access_token && activeSession?.refresh_token) {
      await setActiveUser(user);
    }

    return { user, session: activeSession };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        await signOutLocal();
      } else {
        console.log('Error signing out:', error);
      }
    }
    await clearCachedSession();
    await setRevenueCatUserId(null);
    dataLoadTimestampsRef.current = {};
    friendDataPromiseRef.current = null;
    healthDataPromiseRef.current = null;
    lastPresenceUpdateRef.current = 0;
    setAuthUser(null);
    pushRegistrationRef.current = {
      ...pushRegistrationRef.current,
      userId: null,
      token: null,
      lastAttemptMs: 0,
    };
    setHasOnboarded(false);
    setProfile(defaultProfile);
    setUserSettings(defaultUserSettings);
    setThemeName('default');
    applyTheme('default');
    cacheThemeLocally('default');
  };

  const deleteAccount = async () => {
    if (!authUser?.id) {
      throw new Error('You must be signed in to delete your account.');
    }

    try {
      const { error: deleteError } = await supabase.rpc('delete_account');

      if (deleteError) {
        throw deleteError;
      }

      await signOut();
    } catch (error) {
      const message = error?.message || 'Unable to delete account.';
      throw new Error(message);
    }
  };

  const changeTheme = async (name) => {
    setThemeName(name);
    applyTheme(name);
    cacheThemeLocally(name);
    await upsertUserSettings({ ...userSettings, themeName: name });
  };

  const seedNotificationCacheFromRows = (type, rows = []) => {
    const cache = notificationIdCacheRef.current[type];
    if (!cache || !Array.isArray(rows)) return;
    const hasNotificationField = rows.some((row) =>
      Object.prototype.hasOwnProperty.call(row || {}, 'notification_ids')
    );
    if (!hasNotificationField) return;
    const seen = new Set();
    rows.forEach((row) => {
      const id = row?.id;
      if (!id) return;
      seen.add(id);
      const ids = normalizeNotificationIds(row?.notification_ids);
      if (ids.length) {
        cache.set(id, ids);
      } else {
        cache.delete(id);
      }
    });
    Array.from(cache.keys()).forEach((id) => {
      if (!seen.has(id)) cache.delete(id);
    });
  };

  const getCachedNotificationIds = (type, itemId) => {
    const cache = notificationIdCacheRef.current[type];
    if (!cache || !itemId) return [];
    return cache.get(itemId) || [];
  };

  const clearNotificationIdsForItem = async (table, cacheType, itemId) => {
    if (!itemId) return;
    const cache = notificationIdCacheRef.current[cacheType];
    cache?.delete(itemId);
    if (!authUser?.id || notificationColumnSupportRef.current[table] === false) {
      return;
    }
    const { error } = await supabase
      .from(table)
      .update({ notification_ids: null })
      .eq('id', itemId)
      .eq('user_id', authUser.id);

    if (error) {
      if (isMissingColumnError(error, 'notification_ids')) {
        notificationColumnSupportRef.current[table] = false;
        return;
      }
      console.log(`Error clearing ${table} notification ids:`, error);
    }
  };

  const cancelItemNotifications = async (table, cacheType, itemId) => {
    const ids = getCachedNotificationIds(cacheType, itemId);
    if (ids.length) {
      await Promise.all(ids.map((id) => cancelScheduledNotificationAsync(id)));
    }
    await clearNotificationIdsForItem(table, cacheType, itemId);
  };

  const syncNotificationIdsForItems = async ({
    table,
    cacheType,
    items,
    idsById,
  }) => {
    const cache = notificationIdCacheRef.current[cacheType];
    if (!cache || !Array.isArray(items)) return;

    const normalizedMap = new Map();
    items.forEach((item) => {
      if (!item?.id) return;
      const nextIds = normalizeNotificationIds(idsById?.get(item.id));
      normalizedMap.set(item.id, nextIds);
    });

    const updates = [];
    normalizedMap.forEach((nextIds, id) => {
      const prevIds = cache.get(id) || [];
      if (!areNotificationIdsEqual(prevIds, nextIds)) {
        updates.push({ id, ids: nextIds });
      }
    });

    if (
      authUser?.id &&
      notificationColumnSupportRef.current[table] !== false &&
      updates.length
    ) {
      for (const update of updates) {
        const payload = {
          notification_ids: update.ids.length ? update.ids : null,
        };
        const { error } = await supabase
          .from(table)
          .update(payload)
          .eq('id', update.id)
          .eq('user_id', authUser.id);

        if (error) {
          if (isMissingColumnError(error, 'notification_ids')) {
            notificationColumnSupportRef.current[table] = false;
            break;
          }
          console.log(`Error updating ${table} notification ids:`, error);
        }
      }
    }

    const seen = new Set(normalizedMap.keys());
    normalizedMap.forEach((nextIds, id) => {
      if (nextIds.length) {
        cache.set(id, nextIds);
      } else {
        cache.delete(id);
      }
    });
    Array.from(cache.keys()).forEach((id) => {
      if (!seen.has(id)) cache.delete(id);
    });
  };

  const clearAllNotificationIds = async () =>
    Promise.all([
      syncNotificationIdsForItems({
        table: 'tasks',
        cacheType: 'task',
        items: tasks,
        idsById: new Map(),
      }),
      syncNotificationIdsForItems({
        table: 'chores',
        cacheType: 'chore',
        items: chores,
        idsById: new Map(),
      }),
      syncNotificationIdsForItems({
        table: 'reminders',
        cacheType: 'reminder',
        items: reminders,
        idsById: new Map(),
      }),
      syncNotificationIdsForItems({
        table: 'habits',
        cacheType: 'habit',
        items: habits,
        idsById: new Map(),
      }),
      syncNotificationIdsForItems({
        table: 'routines',
        cacheType: 'routine',
        items: routines,
        idsById: new Map(),
      }),
    ]);

  const registerPushTokenIfNeeded = useCallback(
    async (force = false) => {
      if (
        !authUser?.id ||
        !userSettings.notificationsEnabled ||
        !hasNotificationPermission ||
        Platform.OS === 'web'
      ) {
        return null;
      }

      const nowMs = Date.now();
      if (
        !force &&
        pushRegistrationRef.current.lastAttemptMs &&
        nowMs - pushRegistrationRef.current.lastAttemptMs < PUSH_REGISTRATION_TTL_MS
      ) {
        return pushRegistrationRef.current.token;
      }

      pushRegistrationRef.current.lastAttemptMs = nowMs;

      const projectId = getExpoProjectId();
      if (!projectId) {
        console.log('Missing Expo project id; cannot register push token.');
        return null;
      }

      let deviceId = pushRegistrationRef.current.deviceId;
      if (!deviceId) {
        deviceId = await getOrCreatePushDeviceId();
        pushRegistrationRef.current.deviceId = deviceId;
      }

      let token = null;
      try {
        token = await getExpoPushTokenAsync(projectId);
      } catch (error) {
        console.log('Error fetching Expo push token:', error);
        return null;
      }
      if (!token) return null;

      if (
        !force &&
        pushRegistrationRef.current.token === token &&
        pushRegistrationRef.current.userId === authUser.id
      ) {
        return token;
      }

      const nowISO = new Date().toISOString();
      const payload = {
        user_id: authUser.id,
        device_id: deviceId,
        expo_push_token: token,
        platform: Platform.OS,
        updated_at: nowISO,
        last_seen_at: nowISO,
      };

      const { error } = await supabase
        .from('push_tokens')
        .upsert(payload, { onConflict: 'user_id,device_id' });

      if (error) {
        if (!isMissingRelationError(error, 'push_tokens')) {
          console.log('Error registering push token:', error);
        }
        return null;
      }

      pushRegistrationRef.current.userId = authUser.id;
      pushRegistrationRef.current.token = token;
      return token;
    },
    [authUser?.id, hasNotificationPermission, userSettings.notificationsEnabled]
  );

  // NOTIFICATION HELPERS
  const buildDueNotificationCandidates = ({
    itemType,
    itemId,
    titlePrefix,
    itemTitle,
    scheduledAt,
  }) => {
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return [];
    const now = Date.now();
    const candidates = [];
    const dueTimeMs = scheduledAt.getTime();

    if (dueTimeMs > now) {
      candidates.push({
        itemType,
        itemId,
        kind: 'due',
        priority: 1,
        sortTimeMs: dueTimeMs,
        title: `${titlePrefix} due`,
        body: `${itemTitle} is due now.`,
        data: { type: itemType, id: itemId, kind: 'due' },
        trigger: scheduledAt,
      });
    }

    const reminderAt = new Date(dueTimeMs - REMINDER_LEAD_MINUTES * 60 * 1000);
    if (reminderAt.getTime() > now) {
      candidates.push({
        itemType,
        itemId,
        kind: 'reminder',
        priority: 2,
        sortTimeMs: reminderAt.getTime(),
        title: `Upcoming ${titlePrefix.toLowerCase()}`,
        body: `${itemTitle} - Due ${formatFriendlyDateTime(scheduledAt)}`,
        data: { type: itemType, id: itemId, kind: 'reminder' },
        trigger: reminderAt,
      });
    }

    return candidates;
  };

  const buildTaskNotificationCandidates = () => {
    const pendingTasks = (tasks || []).filter((t) => t.date && !t.completed);
    const candidates = [];

    for (const task of pendingTasks) {
      const scheduledAt = buildDateWithTime(
        task.date,
        task.time,
        DEFAULT_EVENT_TIME.hour,
        DEFAULT_EVENT_TIME.minute
      );
      if (!scheduledAt) continue;
      const taskTitle = task.title || 'Task';
      candidates.push(
        ...buildDueNotificationCandidates({
          itemType: 'task',
          itemId: task.id,
          titlePrefix: 'Task',
          itemTitle: taskTitle,
          scheduledAt,
        })
      );
    }

    return candidates;
  };

  const buildReminderNotificationCandidates = () => {
    const candidates = [];
    for (const reminder of reminders || []) {
      const reminderDate = buildDateWithTime(
        reminder.date || reminder.dateTime,
        reminder.time,
        DEFAULT_EVENT_TIME.hour,
        DEFAULT_EVENT_TIME.minute
      );
      if (!reminderDate) continue;
      const reminderTitle = reminder.title || 'Reminder';
      candidates.push(
        ...buildDueNotificationCandidates({
          itemType: 'reminder',
          itemId: reminder.id,
          titlePrefix: 'Reminder',
          itemTitle: reminderTitle,
          scheduledAt: reminderDate,
        })
      );
    }
    return candidates;
  };

  const buildChoreNotificationCandidates = () => {
    const pendingChores = (chores || []).filter((c) => c.date && !c.completed);
    const candidates = [];

    for (const chore of pendingChores) {
      const scheduledAt = buildDateWithTime(
        chore.date,
        null,
        DEFAULT_EVENT_TIME.hour,
        DEFAULT_EVENT_TIME.minute
      );
      if (!scheduledAt) continue;
      const choreTitle = chore.title || 'Chore';
      candidates.push(
        ...buildDueNotificationCandidates({
          itemType: 'chore',
          itemId: chore.id,
          titlePrefix: 'Chore',
          itemTitle: choreTitle,
          scheduledAt,
        })
      );
    }

    return candidates;
  };

  const weekdayMap = {
    Sun: 1,
    Mon: 2,
    Tue: 3,
    Wed: 4,
    Thu: 5,
    Fri: 6,
    Sat: 7,
  };

  const buildHabitNotificationCandidates = () => {
    const habitsToSchedule = habits || [];
    if (!habitsToSchedule.length) return [];

    const parseReminderTime = (value) => {
      if (!value || typeof value !== 'string') {
        return { hour: HABIT_REMINDER_TIME.hour, minute: HABIT_REMINDER_TIME.minute };
      }
      const match = value.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/i);
      if (!match) {
        return { hour: HABIT_REMINDER_TIME.hour, minute: HABIT_REMINDER_TIME.minute };
      }
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2] || '0', 10) || 0;
      const suffix = (match[3] || '').toUpperCase();
      if (suffix === 'PM' && hour < 12) hour += 12;
      if (suffix === 'AM' && hour === 12) hour = 0;
      return { hour, minute };
    };

    const candidates = [];
    for (const habit of habitsToSchedule) {
      if (habit.remindersEnabled === false) continue;

      const days = Array.isArray(habit.days) && habit.days.length ? habit.days : [];
      const scheduleDaily =
        habit.repeat === 'Daily' || days.length === 0 || days.length === 7;
      const habitTitle = habit.title || 'Habit';
      const reminderTimes =
        Array.isArray(habit.reminderTimes) && habit.reminderTimes.length
          ? habit.reminderTimes
          : [`${HABIT_REMINDER_TIME.hour}:${HABIT_REMINDER_TIME.minute}`];

      if (scheduleDaily) {
        reminderTimes.forEach((time) => {
          const parsed = parseReminderTime(time);
          const nextTime = getNextDailyOccurrence(parsed.hour, parsed.minute);
          candidates.push({
            itemType: 'habit',
            itemId: habit.id,
            kind: 'habit',
            priority: 3,
            sortTimeMs: nextTime.getTime(),
            title: 'Habit reminder',
            body: habit.reminderMessage || `${habitTitle} - due today.`,
            data: { type: 'habit', id: habit.id },
            trigger: {
              hour: parsed.hour,
              minute: parsed.minute,
              repeats: true,
            },
          });
        });
        continue;
      }

      const weekdaysToSchedule = new Set();
      days.forEach((day) => {
        const weekday = weekdayMap[day] || weekdayMap[day?.slice(0, 3)];
        if (weekday) weekdaysToSchedule.add(weekday);
      });

      if (!weekdaysToSchedule.size) {
        reminderTimes.forEach((time) => {
          const parsed = parseReminderTime(time);
          const nextTime = getNextDailyOccurrence(parsed.hour, parsed.minute);
          candidates.push({
            itemType: 'habit',
            itemId: habit.id,
            kind: 'habit',
            priority: 3,
            sortTimeMs: nextTime.getTime(),
            title: 'Habit reminder',
            body: habit.reminderMessage || `${habitTitle} - due today.`,
            data: { type: 'habit', id: habit.id },
            trigger: {
              hour: parsed.hour,
              minute: parsed.minute,
              repeats: true,
            },
          });
        });
        continue;
      }

      for (const weekday of weekdaysToSchedule) {
        reminderTimes.forEach((time) => {
          const parsed = parseReminderTime(time);
          const nextTime = getNextWeeklyOccurrence(weekday, parsed.hour, parsed.minute);
          candidates.push({
            itemType: 'habit',
            itemId: habit.id,
            kind: 'habit',
            priority: 3,
            sortTimeMs: nextTime.getTime(),
            title: 'Habit reminder',
            body: habit.reminderMessage || `${habitTitle} - due today.`,
            data: { type: 'habit', id: habit.id },
            trigger: {
              weekday,
              hour: parsed.hour,
              minute: parsed.minute,
              repeats: true,
            },
          });
        });
      }
    }

    return candidates;
  };

  const buildRoutineNotificationCandidates = () => {
    const candidates = [];
    const parseRoutineStart = (routine) => {
      const normalized = normalizeRoutineTimeRange(routine);
      const startMinutes = parseClockMinutes(normalized.startTime);
      if (startMinutes === null) return null;
      const hour = Math.floor(startMinutes / 60);
      const minute = startMinutes % 60;
      return { ...normalized, hour, minute };
    };

    for (const routine of routines || []) {
      const parsed = parseRoutineStart(routine);
      if (!parsed) continue;
      const nextTime = getNextDailyOccurrence(parsed.hour, parsed.minute);
      const routineTitle = routine.name || 'Routine';
      const body = parsed.endTime
        ? `${routineTitle} starts at ${parsed.startTime} and ends at ${parsed.endTime}.`
        : `${routineTitle} starts at ${parsed.startTime}.`;
      candidates.push({
        itemType: 'routine',
        itemId: routine.id,
        kind: 'routine',
        priority: 3,
        sortTimeMs: nextTime.getTime(),
        title: 'Routine reminder',
        body,
        data: { type: 'routine', id: routine.id },
        trigger: {
          hour: parsed.hour,
          minute: parsed.minute,
          repeats: true,
        },
      });
    }

    for (const groupRoutine of groupRoutines || []) {
      const parsed = parseRoutineStart(groupRoutine);
      if (!parsed) continue;
      const nextTime = getNextDailyOccurrence(parsed.hour, parsed.minute);
      const routineTitle = groupRoutine.name || 'Group routine';
      const body = parsed.endTime
        ? `${routineTitle} starts at ${parsed.startTime} and ends at ${parsed.endTime}.`
        : `${routineTitle} starts at ${parsed.startTime}.`;
      candidates.push({
        itemType: 'group_routine',
        itemId: groupRoutine.id,
        kind: 'group_routine',
        priority: 3,
        sortTimeMs: nextTime.getTime(),
        title: 'Group routine reminder',
        body,
        data: { type: 'group_routine', id: groupRoutine.id },
        trigger: {
          hour: parsed.hour,
          minute: parsed.minute,
          repeats: true,
        },
      });
    }

    return candidates;
  };

  const buildHealthNotificationCandidate = () => {
    const now = new Date();
    const hasMood = Number.isFinite(todayHealth?.mood);
    const scheduledAt = new Date(now);
    scheduledAt.setHours(
      HEALTH_REMINDER_TIME.hour,
      HEALTH_REMINDER_TIME.minute,
      0,
      0
    );

    if (hasMood || scheduledAt.getTime() <= now.getTime()) {
      scheduledAt.setDate(scheduledAt.getDate() + 1);
    }

    return {
      itemType: 'health',
      itemId: 'mood',
      kind: 'health',
      priority: 4,
      sortTimeMs: scheduledAt.getTime(),
      title: 'Mood check-in',
      body: 'Take a moment to log your mood for today.',
      data: { type: 'health', id: 'mood' },
      trigger: scheduledAt,
    };
  };

  const buildStreakFreezeNotificationCandidate = async () => {
    if (!authUser?.id || !isPremiumUser || streakFrozen) return;
    const hasAnyStreak = habits.some((h) => (h.streak || 0) > 0);
    if (!hasAnyStreak) return;

    const lastActive = await readLastActive(authUser.id);
    if (!lastActive) return;

    const scheduledAt = new Date(lastActive);
    scheduledAt.setHours(0, 0, 0, 0);
    scheduledAt.setDate(scheduledAt.getDate() + 1);
    scheduledAt.setHours(
      STREAK_FREEZE_REMINDER_TIME.hour,
      STREAK_FREEZE_REMINDER_TIME.minute,
      0,
      0
    );

    if (scheduledAt.getTime() <= Date.now()) return null;

    return {
      itemType: 'streak_freeze',
      itemId: 'streak_freeze',
      kind: 'streak_freeze',
      priority: 5,
      sortTimeMs: scheduledAt.getTime(),
      title: 'Streak frozen',
      body: 'Complete a habit today to unfreeze your streak.',
      data: { type: 'streak_freeze' },
      trigger: scheduledAt,
    };
  };

  const rescheduleAllNotifications = useCallback(async () => {
    if (reschedulingNotificationsRef.current) return;
    reschedulingNotificationsRef.current = true;

    try {
      if (!userSettings.notificationsEnabled || !authUser || !hasNotificationPermission) {
        await cancelAllScheduledNotificationsAsync();
        await clearAllNotificationIds();
        return;
      }

      await cancelAllScheduledNotificationsAsync();

      const candidates = [];
      if (userSettings.taskRemindersEnabled) {
        candidates.push(...buildTaskNotificationCandidates());
        candidates.push(...buildChoreNotificationCandidates());
        candidates.push(...buildReminderNotificationCandidates());
        candidates.push(...buildRoutineNotificationCandidates());
      }

      if (userSettings.habitRemindersEnabled) {
        candidates.push(...buildHabitNotificationCandidates());
      }

      if (userSettings.healthRemindersEnabled) {
        const healthCandidate = buildHealthNotificationCandidate();
        if (healthCandidate) candidates.push(healthCandidate);
      }

      if (userSettings.habitRemindersEnabled) {
        const streakCandidate = await buildStreakFreezeNotificationCandidate();
        if (streakCandidate) candidates.push(streakCandidate);
      }

      const maxScheduled =
        Platform.OS === 'ios' ? IOS_MAX_SCHEDULED_NOTIFICATIONS : Number.POSITIVE_INFINITY;

      const selected = candidates
        .filter((candidate) => candidate && candidate.trigger)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return (a.sortTimeMs || 0) - (b.sortTimeMs || 0);
        })
        .slice(0, maxScheduled);

      const idsByType = {
        task: new Map(),
        chore: new Map(),
        reminder: new Map(),
        habit: new Map(),
        routine: new Map(),
      };

      for (const candidate of selected) {
        const id = await scheduleLocalNotificationAsync({
          title: candidate.title,
          body: candidate.body,
          data: candidate.data,
          trigger: candidate.trigger,
        });

        if (!candidate.itemType || !candidate.itemId) continue;
        if (!idsByType[candidate.itemType]) continue;
        const existing = idsByType[candidate.itemType].get(candidate.itemId) || [];
        existing.push(id);
        idsByType[candidate.itemType].set(candidate.itemId, existing);
      }

      await Promise.all([
        syncNotificationIdsForItems({
          table: 'tasks',
          cacheType: 'task',
          items: tasks,
          idsById: idsByType.task,
        }),
        syncNotificationIdsForItems({
          table: 'chores',
          cacheType: 'chore',
          items: chores,
          idsById: idsByType.chore,
        }),
        syncNotificationIdsForItems({
          table: 'reminders',
          cacheType: 'reminder',
          items: reminders,
          idsById: idsByType.reminder,
        }),
        syncNotificationIdsForItems({
          table: 'habits',
          cacheType: 'habit',
          items: habits,
          idsById: idsByType.habit,
        }),
        syncNotificationIdsForItems({
          table: 'routines',
          cacheType: 'routine',
          items: routines,
          idsById: idsByType.routine,
        }),
      ]);
    } finally {
      reschedulingNotificationsRef.current = false;
    }
  }, [
    authUser,
    hasNotificationPermission,
    chores,
    todayHealth?.mood,
    reminders,
    routines,
    groupRoutines,
    tasks,
    habits,
    isPremiumUser,
    streakFrozen,
    userSettings.notificationsEnabled,
    userSettings.taskRemindersEnabled,
    userSettings.habitRemindersEnabled,
    userSettings.healthRemindersEnabled,
  ]);

  useEffect(() => {
    const syncPermission = async () => {
      if (!authUser || !userSettings.notificationsEnabled) {
        setHasNotificationPermission(false);
        await cancelAllScheduledNotificationsAsync();
        await clearAllNotificationIds();
        return;
      }
      const granted = await requestNotificationPermissionAsync();
      setHasNotificationPermission(granted);
      if (!granted) {
        await cancelAllScheduledNotificationsAsync();
        await clearAllNotificationIds();
      }
    };

    syncPermission();
  }, [authUser, userSettings.notificationsEnabled]);

  useEffect(() => {
    if (!authUser?.id || !userSettings.notificationsEnabled || !hasNotificationPermission) {
      return;
    }
    registerPushTokenIfNeeded();
  }, [
    authUser?.id,
    userSettings.notificationsEnabled,
    hasNotificationPermission,
    registerPushTokenIfNeeded,
  ]);

  useEffect(() => {
    if (isLoading || !authUser?.id || !profileLoaded) return;
    applyStreakFreezeIfNeeded();
  }, [isLoading, authUser?.id, profileLoaded, applyStreakFreezeIfNeeded]);

  useEffect(() => {
    if (isLoading) return;
    rescheduleAllNotifications();
  }, [
    isLoading,
    rescheduleAllNotifications,
    tasks,
    habits,
    routines,
    groupRoutines,
    chores,
    reminders,
    todayHealth?.mood,
    userSettings.notificationsEnabled,
    userSettings.taskRemindersEnabled,
    userSettings.habitRemindersEnabled,
    userSettings.healthRemindersEnabled,
    hasNotificationPermission,
  ]);

  useEffect(() => {
    if (!authUser?.id) return undefined;
    const onStateChange = (nextState) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextState;
      if (prevState !== 'active' && nextState === 'active') {
        rescheduleAllNotifications();
        registerPushTokenIfNeeded(true);
      }
    };

    const sub = AppState.addEventListener('change', onStateChange);
    return () => sub?.remove?.();
  }, [authUser?.id, rescheduleAllNotifications, registerPushTokenIfNeeded]);

  // COMPUTED VALUES
  const getBestStreak = () => {
    if (habits.length === 0) return 0;
    return Math.max(...habits.map((h) => h.streak || 0));
  };

  const getTodayHabitsCount = () => {
    const today = new Date().toDateString();
    const completedToday = habits.filter((habit) => {
      if (isQuitHabit(habit)) {
        const amount = Number((habit.progressByDate || {})[today]) || 0;
        return isQuitAmountCompleted(amount, getHabitGoalValue(habit));
      }
      return habit.completedDates?.includes(today);
    }).length;
    return `${completedToday}/${habits.length}`;
  };

  const getTodayTasks = () => {
    const today = new Date().toDateString();
    return tasks.filter(
      (t) =>
        new Date(t.date).toDateString() === today &&
        !t.completed &&
        !isTaskPastArchiveWindow(t)
    );
  };

  const getUpcomingTasks = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks
      .filter(
        (t) =>
          new Date(t.date) >= today &&
          !t.completed &&
          !isTaskPastArchiveWindow(t)
      )
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const computedProfile = useMemo(() => {
    const bestName =
      profile.name && profile.name !== defaultProfile.name
        ? profile.name
        : authUser?.user_metadata?.full_name ||
          authUser?.user_metadata?.name ||
          authUser?.user_metadata?.username ||
          authUser?.email ||
          profile.name ||
          defaultProfile.name;

    const bestEmail =
      profile.email && profile.email !== defaultProfile.email
        ? profile.email
        : authUser?.email || profile.email || defaultProfile.email;

    const bestUsername =
      profile.username ||
      authUser?.user_metadata?.username ||
      '';

    const rcMatchesUser =
      revenueCatPremium.appUserId &&
      authUser?.id &&
      revenueCatPremium.appUserId === String(authUser.id);
    const rcIsPremium =
      rcMatchesUser &&
      revenueCatPremium.isActive &&
      computeIsPremium('premium', revenueCatPremium.expiration);
    const rcExpiration = rcMatchesUser ? revenueCatPremium.expiration || null : null;
    const plan = (rcIsPremium ? 'premium' : profile.plan) || defaultProfile.plan;
    const premiumExpiresAt =
      rcExpiration ||
      profile.premiumExpiresAt ||
      profile.premium_expires_at ||
      defaultProfile.premiumExpiresAt;
    const isPremium = rcIsPremium || computeIsPremium(plan, premiumExpiresAt);

    return {
      ...profile,
      name: bestName,
      email: bestEmail,
      username: bestUsername,
      plan,
      premiumExpiresAt,
      premium_expires_at: premiumExpiresAt,
      isPremium,
    };
  }, [profile, authUser, revenueCatPremium]);

  const value = {
    profile: computedProfile,
    isPremium: computedProfile?.isPremium,

    // Loading
    isLoading,
    themeReady,
    hasNotificationPermission,
    profileLoaded,

    // Data loaders
    ensureHomeDataLoaded,
    ensureTasksLoaded,
    ensureHabitsLoaded,
    ensureNotesLoaded,
    ensureHealthLoaded,
    ensureWeightManagerLogsLoaded,
    ensureRoutinesLoaded,
    ensureChoresLoaded,
    ensureRemindersLoaded,
    ensureGroceriesLoaded,
    ensureFinancesLoaded,
    ensureGroupDataLoaded,
    ensureFriendDataLoaded,
    ensureTaskInvitesLoaded,
    ensureGroupInvitesLoaded,

    // Habits
    habits,
    addHabit,
    shareHabitWithFriends,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    setHabitProgress,
    isHabitCompletedToday,
    getBestStreak,
    getTodayHabitsCount,
    streakFrozen,

    // Tasks
    tasks,
    archivedTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    getTodayTasks,
    getUpcomingTasks,

    // Task collaboration
    taskInvites,
    shareTaskWithGroup,
    sendTaskInvite,
    respondToTaskInvite,
    fetchTaskParticipants,

    // Notes
    notes,
    addNote,
    updateNote,
    deleteNote,
    verifyNotePassword,
    setNotePassword,

    // Health
    healthData,
    todayHealth,
    weightManagerLogs,
    waterLogs,
    updateTodayHealth,
    updateHealthForDate,
    addWeightManagerLog,
    clearWeightManagerLogs,
    addFoodEntry,
    addFoodEntryForDate,
    deleteFoodEntryForDate,
    addWaterLogEntry,
    addWaterLogEntryForDate,
    deleteWaterLogEntryForDate,
    resetWaterLogForDate,
    getAverageWater,
    getAverageSleep,

    // Routines
    routines,
    addRoutine,
    updateRoutine,
    deleteRoutine,
    addTaskToRoutine,
    removeTaskFromRoutine,
    reorderRoutineTasks,

    // Chores
    chores,
    addChore,
    updateChore,
    deleteChore,

    // Reminders
    reminders,
    addReminder,
    deleteReminder,

    // Groceries
    groceryLists,
    groceries,
    addGroceryList,
    updateGroceryList,
    deleteGroceryList,
    addGroceryItem,
    toggleGroceryItem,
    deleteGroceryItem,
    clearCompletedGroceries,

    // Finances
    finances,
    budgetGroups,
    budgetAssignments,
    addBudgetGroup,
    updateBudgetGroup,
    deleteBudgetGroup,
    addRecurringPaymentToGroup,
    getBudgetSpendForGroup,
    linkTransactionToBudgetGroups,
    addTransaction,
    deleteTransaction,
    getTransactionsForDate,
    getFinanceSummaryForDate,

    // Friends
    friends,
    onlineFriends,
    friendRequests,
    blockedUsers,
    isUserOnline,
    isUserBlocked,
    isBlockedByUser,
    deleteFriend,
    blockUser,
    unblockUser,
    fetchBlockedUsers,
    refreshFriendData,
    searchUsersByUsername,
    sendFriendRequest,
    respondToFriendRequest,
    getFriendRelationship,
    submitFriendReport,
    getUserProfileById,
    groups,
    groupInvites,
    groupHabits,
    groupHabitCompletions,
    groupRoutines,
    fetchGroupMembers,
    refreshGroupData,
    createGroup,
    sendGroupInvites,
    deleteGroup,
    respondToGroupInvite,
    addGroupHabit,
    updateGroupHabit,
    deleteGroupHabit,
    toggleGroupHabitCompletion,
    addGroupRoutine,
    updateGroupRoutine,
    deleteGroupRoutine,
    addTaskToGroupRoutine,
    removeTaskFromGroupRoutine,
    reorderGroupRoutineTasks,
    removeGroupMember,
    leaveGroup,
    updateGroupName,

    // Profile
    revenueCatPremium,
    refreshRevenueCatPremium,
    updateProfile,
    completeAppTutorial,
    completeHabitsTutorial,
    userSettings,
    updateUserSettings,
    t,

    // Auth
    authUser,
    hasOnboarded,
    signIn,
    signUp,
    signOut,
    deleteAccount,
    persistOnboarding,

    // Theme
    themeName,
    themeColors,
    changeTheme,
    isPremiumUser,
  };

  if (!themeReady) {
    return null;
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export default AppContext;



