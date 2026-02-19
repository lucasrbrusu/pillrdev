import AsyncStorage from '@react-native-async-storage/async-storage';
import { toLocalDateKey } from './insights';

const FOCUS_SESSIONS_PREFIX = '@pillaflow_focus_sessions_';
const APP_USAGE_PREFIX = '@pillaflow_app_usage_';

const getUserKey = (prefix, userId) => `${prefix}${userId || 'anon'}`;

const pruneByMinDate = (sessions, minDateMs) =>
  (Array.isArray(sessions) ? sessions : []).filter((s) => {
    const t = new Date(s?.endAt || s?.endedAt || s?.startAt || s?.startedAt).getTime();
    if (!Number.isFinite(t)) return false;
    return t >= minDateMs;
  });

export const readFocusSessions = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(getUserKey(FOCUS_SESSIONS_PREFIX, userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
};

export const appendFocusSession = async (userId, session) => {
  const key = getUserKey(FOCUS_SESSIONS_PREFIX, userId);
  const now = Date.now();
  const minDateMs = now - 180 * 24 * 60 * 60 * 1000; // keep ~6 months

  const nextSession = {
    id: session?.id || `focus-${now}`,
    startAt: session?.startAt || null,
    endAt: session?.endAt || session?.endedAt || new Date().toISOString(),
    durationMs: Number(session?.durationMs) || 0,
  };

  const prev = await readFocusSessions(userId);
  const merged = pruneByMinDate([...prev, nextSession], minDateMs);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(merged));
  } catch (e) {
    // ignore persistence errors
  }

  return merged;
};

export const readAppUsageByDay = async (userId) => {
  try {
    const raw = await AsyncStorage.getItem(getUserKey(APP_USAGE_PREFIX, userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
};

export const addAppUsageMs = async (userId, dateKey, deltaMs) => {
  const key = getUserKey(APP_USAGE_PREFIX, userId);
  const safeDelta = Math.max(0, Number(deltaMs) || 0);
  if (!safeDelta) return null;

  const usage = await readAppUsageByDay(userId);
  const current = Number(usage?.[dateKey]) || 0;
  const next = {
    ...(usage || {}),
    [dateKey]: current + safeDelta,
  };

  // Prune older than 6 months
  const now = Date.now();
  const minDateMs = now - 180 * 24 * 60 * 60 * 1000;
  Object.keys(next).forEach((k) => {
    const d = new Date(`${k}T12:00:00`).getTime();
    if (!Number.isFinite(d) || d < minDateMs) delete next[k];
  });

  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch (e) {
    // ignore persistence errors
  }
  return next;
};

export const splitDurationByLocalDay = (startMs, endMs) => {
  const start = Number(startMs);
  const end = Number(endMs);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return {};

  const result = {};
  let cursor = start;

  while (cursor < end) {
    const cursorDate = new Date(cursor);
    const dateKey = toLocalDateKey(cursorDate);
    const nextMidnight = new Date(
      cursorDate.getFullYear(),
      cursorDate.getMonth(),
      cursorDate.getDate() + 1,
      0,
      0,
      0,
      0
    ).getTime();

    const chunkEnd = Math.min(end, nextMidnight);
    const delta = Math.max(0, chunkEnd - cursor);
    result[dateKey] = (Number(result[dateKey]) || 0) + delta;
    cursor = chunkEnd;
  }

  return result;
};

