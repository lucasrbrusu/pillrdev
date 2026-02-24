import { computeWeightManagerPlan, DEFAULT_WEIGHT_MANAGER_BODY_TYPE, DEFAULT_WEIGHT_MANAGER_UNIT } from './weightManager';

const HISTORY_STORAGE_PREFIX = 'weight_manager_journey_history';
const STATE_STORAGE_PREFIX = 'weight_manager_state';

const normalizeWeightValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 10) / 10;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  const raw = String(value);
  const parsed =
    value instanceof Date
      ? value
      : raw.includes('T')
      ? new Date(raw)
      : new Date(`${raw}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const toIsoTimestamp = (value = new Date()) => {
  const parsed = value instanceof Date ? value : new Date(value || Date.now());
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
};

const normalizeUnit = (value) => (value === 'lb' ? 'lb' : DEFAULT_WEIGHT_MANAGER_UNIT);

const normalizeGoalMode = (value) => (value === 'date' ? 'date' : 'duration');

const normalizeStatus = (value) => (value === 'active' ? 'active' : 'completed');

const resolveUserId = ({ authUserId, profileId, profileUserId } = {}) =>
  authUserId || profileId || profileUserId || 'default';

const normalizeCheckIns = (entries = []) =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const loggedAt = toIsoTimestamp(entry?.loggedAt || entry?.logDate || entry?.created_at);
      const weight = normalizeWeightValue(entry?.weight);
      if (!Number.isFinite(weight)) return null;
      return {
        loggedAt,
        dateKey: normalizeDateKey(loggedAt),
        weight,
        unit: normalizeUnit(entry?.unit),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));

const toFiniteOrNull = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

export const getWeightManagerStateStorageKey = ({ authUserId, profileId, profileUserId } = {}) => {
  const userId = resolveUserId({ authUserId, profileId, profileUserId });
  return `${STATE_STORAGE_PREFIX}:${userId}`;
};

export const getWeightJourneyHistoryStorageKey = ({ authUserId, profileId, profileUserId } = {}) => {
  const userId = resolveUserId({ authUserId, profileId, profileUserId });
  return `${HISTORY_STORAGE_PREFIX}:${userId}`;
};

export const hasJourneyState = (state = {}) => {
  const currentWeight = normalizeWeightValue(state?.currentWeight);
  const targetWeight = normalizeWeightValue(state?.targetWeight);
  return Number.isFinite(currentWeight) && Number.isFinite(targetWeight);
};

export const normalizeJourneyEntry = (entry = {}) => {
  const id = String(entry?.id || '').trim();
  if (!id) return null;

  const createdAt = toIsoTimestamp(entry?.createdAt || entry?.completedAt || new Date());
  const completedAt = entry?.completedAt ? toIsoTimestamp(entry.completedAt) : null;

  return {
    id,
    status: normalizeStatus(entry?.status),
    completedReason: entry?.completedReason || null,
    createdAt,
    completedAt,
    unit: normalizeUnit(entry?.unit),
    startingWeight: normalizeWeightValue(entry?.startingWeight),
    currentWeight: normalizeWeightValue(entry?.currentWeight),
    targetWeight: normalizeWeightValue(entry?.targetWeight),
    currentBodyType: entry?.currentBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    targetBodyType: entry?.targetBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    journeyGoalMode: normalizeGoalMode(entry?.journeyGoalMode),
    journeyDurationWeeks: normalizeNumber(entry?.journeyDurationWeeks),
    journeyGoalDate: normalizeDateKey(entry?.journeyGoalDate),
    timelineTargetDays: toFiniteOrNull(entry?.timelineTargetDays),
    estimatedDays: toFiniteOrNull(entry?.estimatedDays),
    projectedEndDateISO: normalizeDateKey(entry?.projectedEndDateISO),
    targetCalories: toFiniteOrNull(entry?.targetCalories),
    maintenanceCalories: toFiniteOrNull(entry?.maintenanceCalories),
    proteinGrams: toFiniteOrNull(entry?.proteinGrams),
    carbsGrams: toFiniteOrNull(entry?.carbsGrams),
    fatGrams: toFiniteOrNull(entry?.fatGrams),
    dailyCalorieDelta: toFiniteOrNull(entry?.dailyCalorieDelta),
    weeklyWeightChangeKg: toFiniteOrNull(entry?.weeklyWeightChangeKg),
    timelineGoalMet:
      typeof entry?.timelineGoalMet === 'boolean' ? entry.timelineGoalMet : null,
    checkIns: normalizeCheckIns(entry?.checkIns),
  };
};

export const normalizeJourneyHistoryEntries = (entries = []) => {
  const byId = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const normalized = normalizeJourneyEntry(entry);
    if (!normalized) return;
    byId.set(normalized.id, normalized);
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aDate = a.completedAt || a.createdAt;
    const bDate = b.completedAt || b.createdAt;
    return bDate.localeCompare(aDate);
  });
};

export const parseWeightJourneyHistoryPayload = (payload) => {
  if (Array.isArray(payload)) return normalizeJourneyHistoryEntries(payload);
  if (payload && Array.isArray(payload.journeys)) {
    return normalizeJourneyHistoryEntries(payload.journeys);
  }
  return [];
};

export const appendJourneyHistoryEntry = (entries = [], nextEntry) =>
  normalizeJourneyHistoryEntries([...(Array.isArray(entries) ? entries : []), nextEntry]);

const buildPlanForState = (state = {}) => {
  if (!hasJourneyState(state)) return null;
  const journeyWeeks = normalizeNumber(state?.journeyDurationWeeks);
  const journeyDurationDays =
    normalizeGoalMode(state?.journeyGoalMode) === 'duration' && Number.isFinite(journeyWeeks)
      ? Math.max(1, Math.round(journeyWeeks * 7))
      : null;
  const journeyEndDate =
    normalizeGoalMode(state?.journeyGoalMode) === 'date'
      ? normalizeDateKey(state?.journeyGoalDate)
      : '';
  return computeWeightManagerPlan({
    startingWeight: state?.startingWeight,
    currentWeight: state?.currentWeight,
    targetWeight: state?.targetWeight,
    unit: normalizeUnit(state?.weightUnit),
    currentBodyTypeKey: state?.currentBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    targetBodyTypeKey: state?.targetBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    journeyDurationDays,
    journeyEndDate: journeyEndDate || null,
  });
};

const buildBaseJourneyEntry = ({ id, status, state = {}, plan = null, createdAt = null }) => {
  const resolvedPlan = plan || buildPlanForState(state);
  const normalizedGoalMode = normalizeGoalMode(state?.journeyGoalMode);

  return {
    id,
    status,
    createdAt: toIsoTimestamp(createdAt || new Date()),
    unit: normalizeUnit(state?.weightUnit),
    startingWeight: normalizeWeightValue(state?.startingWeight),
    currentWeight: normalizeWeightValue(state?.currentWeight),
    targetWeight: normalizeWeightValue(state?.targetWeight),
    currentBodyType: state?.currentBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    targetBodyType: state?.targetBodyType || DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
    journeyGoalMode: normalizedGoalMode,
    journeyDurationWeeks:
      normalizedGoalMode === 'duration' ? normalizeNumber(state?.journeyDurationWeeks) : null,
    journeyGoalDate:
      normalizedGoalMode === 'date' ? normalizeDateKey(state?.journeyGoalDate) : '',
    timelineTargetDays: toFiniteOrNull(resolvedPlan?.timelineTargetDays),
    estimatedDays: toFiniteOrNull(resolvedPlan?.estimatedDays),
    projectedEndDateISO: normalizeDateKey(resolvedPlan?.projectedEndDateISO),
    targetCalories: toFiniteOrNull(resolvedPlan?.targetCalories),
    maintenanceCalories: toFiniteOrNull(resolvedPlan?.maintenanceCalories),
    proteinGrams: toFiniteOrNull(resolvedPlan?.proteinGrams),
    carbsGrams: toFiniteOrNull(resolvedPlan?.carbsGrams),
    fatGrams: toFiniteOrNull(resolvedPlan?.fatGrams),
    dailyCalorieDelta: toFiniteOrNull(resolvedPlan?.dailyCalorieDelta),
    weeklyWeightChangeKg: toFiniteOrNull(resolvedPlan?.weeklyWeightChangeKg),
    timelineGoalMet:
      typeof resolvedPlan?.timelineGoalMet === 'boolean' ? resolvedPlan.timelineGoalMet : null,
  };
};

export const buildCurrentJourneyEntry = ({ state = {}, plan = null, logs = [] } = {}) => {
  if (!hasJourneyState(state)) return null;
  const createdAt = toIsoTimestamp(state?.savedAt || new Date());
  return normalizeJourneyEntry({
    ...buildBaseJourneyEntry({
      id: 'current-journey',
      status: 'active',
      state,
      plan,
      createdAt,
    }),
    checkIns: normalizeCheckIns(logs),
  });
};

export const createCompletedJourneyEntry = ({
  state = {},
  plan = null,
  logs = [],
  completedAt = new Date(),
  completedReason = 'goal_achieved',
} = {}) => {
  if (!hasJourneyState(state)) return null;
  const completionTimestamp = toIsoTimestamp(completedAt);
  const id = `journey-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return normalizeJourneyEntry({
    ...buildBaseJourneyEntry({
      id,
      status: 'completed',
      state,
      plan,
      createdAt: state?.savedAt || completionTimestamp,
    }),
    completedAt: completionTimestamp,
    completedReason,
    checkIns: normalizeCheckIns(logs),
  });
};
