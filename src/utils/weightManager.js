export const WEIGHT_MANAGER_BODY_TYPES = [
  {
    key: 'lean',
    label: 'Lean',
    maintenanceMultiplier: 31,
    proteinMultiplier: 2.2,
    fatRatio: 0.2,
    calorieBias: -150,
    silhouette: { shoulders: 42, torso: 34, waist: 28 },
  },
  {
    key: 'muscular',
    label: 'Muscular',
    maintenanceMultiplier: 33,
    proteinMultiplier: 2.4,
    fatRatio: 0.25,
    calorieBias: 150,
    silhouette: { shoulders: 52, torso: 44, waist: 36 },
  },
  {
    key: 'bulky',
    label: 'Bulky',
    maintenanceMultiplier: 35,
    proteinMultiplier: 1.9,
    fatRatio: 0.28,
    calorieBias: 300,
    silhouette: { shoulders: 60, torso: 52, waist: 48 },
  },
];

export const WEIGHT_MANAGER_BODY_TYPE_MAP = WEIGHT_MANAGER_BODY_TYPES.reduce(
  (acc, bodyType) => {
    acc[bodyType.key] = bodyType;
    return acc;
  },
  {}
);

export const WEIGHT_MANAGER_WEIGHT_UNITS = [
  { key: 'kg', label: 'kg' },
  { key: 'lb', label: 'lb' },
];

export const DEFAULT_WEIGHT_MANAGER_BODY_TYPE = 'muscular';
export const DEFAULT_WEIGHT_MANAGER_UNIT = 'kg';
const KCAL_PER_KG = 7700;
const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

const normalizeDateValue = (value) => {
  if (!value) return null;
  const parsed =
    value instanceof Date
      ? value
      : new Date(typeof value === 'string' ? `${value}T12:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const toDateKey = (value) => {
  const date = normalizeDateValue(value);
  if (!date) return '';
  return date.toISOString().slice(0, 10);
};

export const toWeightManagerKg = (value, unit = DEFAULT_WEIGHT_MANAGER_UNIT) => {
  if (!Number.isFinite(value)) return null;
  return unit === 'kg' ? value : value / 2.20462;
};

export const computeWeightManagerPlan = ({
  startingWeight,
  currentWeight,
  targetWeight,
  unit = DEFAULT_WEIGHT_MANAGER_UNIT,
  currentBodyTypeKey = DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  targetBodyTypeKey = DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  journeyDurationDays,
  journeyEndDate,
  now = new Date(),
}) => {
  const parsedCurrent = toPositiveNumber(currentWeight);
  const parsedTarget = toPositiveNumber(targetWeight);
  if (!Number.isFinite(parsedCurrent)) return null;
  if (!Number.isFinite(parsedTarget)) return null;

  const parsedStarting = toPositiveNumber(startingWeight) ?? parsedCurrent;

  const currentKg = toWeightManagerKg(parsedCurrent, unit);
  const targetKg = toWeightManagerKg(parsedTarget, unit);
  const startingKg = toWeightManagerKg(parsedStarting, unit);
  if (!Number.isFinite(currentKg) || !Number.isFinite(targetKg) || !Number.isFinite(startingKg)) {
    return null;
  }

  const currentType = WEIGHT_MANAGER_BODY_TYPE_MAP[currentBodyTypeKey] || WEIGHT_MANAGER_BODY_TYPES[1];
  const targetType = WEIGHT_MANAGER_BODY_TYPE_MAP[targetBodyTypeKey] || WEIGHT_MANAGER_BODY_TYPES[1];

  const currentMaintenance = currentKg * currentType.maintenanceMultiplier;
  const targetMaintenance = targetKg * targetType.maintenanceMultiplier;
  const maintenanceCalories = Math.round(currentMaintenance * 0.75 + targetMaintenance * 0.25);

  const remainingKg = targetKg - currentKg;
  const remainingAbsKg = Math.abs(remainingKg);
  const totalJourneyKg = Math.abs(targetKg - startingKg);
  const completedJourneyKg = Math.min(totalJourneyKg, Math.abs(currentKg - startingKg));
  const progressRatio = totalJourneyKg > 0 ? completedJourneyKg / totalJourneyKg : 1;
  const direction = remainingKg > 0 ? 1 : remainingKg < 0 ? -1 : 0;

  const today = normalizeDateValue(now) || new Date();
  const targetDate = normalizeDateValue(journeyEndDate);
  const providedDurationDays = toPositiveNumber(journeyDurationDays);
  const derivedDurationDays =
    targetDate && targetDate > today
      ? Math.max(1, Math.ceil((targetDate.getTime() - today.getTime()) / DAY_MS))
      : null;
  const timelineTargetDays = Number.isFinite(providedDurationDays)
    ? Math.max(1, Math.round(providedDurationDays))
    : derivedDurationDays;

  const maxDeficit = Math.max(250, Math.min(1100, maintenanceCalories * 0.35));
  const maxSurplus = Math.max(100, Math.min(650, maintenanceCalories * 0.2));
  const minDeficit = 120;
  const minSurplus = 80;

  let requestedDailyDelta = null;
  if (timelineTargetDays && direction !== 0) {
    requestedDailyDelta = (remainingKg * KCAL_PER_KG) / timelineTargetDays;
  }

  let appliedDailyDelta = 0;
  if (direction === 0 || remainingAbsKg < 0.05) {
    appliedDailyDelta = 0;
  } else if (Number.isFinite(requestedDailyDelta)) {
    if (direction < 0) {
      appliedDailyDelta = -clamp(Math.abs(requestedDailyDelta), minDeficit, maxDeficit);
    } else {
      appliedDailyDelta = clamp(Math.abs(requestedDailyDelta), minSurplus, maxSurplus);
    }
  } else {
    const adaptiveWeeklyRateKg =
      direction < 0
        ? clamp(0.25 + remainingAbsKg * 0.08 + (1 - progressRatio) * 0.05, 0.25, 0.9)
        : clamp(0.15 + remainingAbsKg * 0.06, 0.1, 0.45);
    const adaptiveDelta = (adaptiveWeeklyRateKg * KCAL_PER_KG) / 7;
    if (direction < 0) {
      appliedDailyDelta = -clamp(adaptiveDelta, minDeficit, maxDeficit);
    } else {
      appliedDailyDelta = clamp(adaptiveDelta, minSurplus, maxSurplus);
    }
  }

  const unclampedTargetCalories = maintenanceCalories + appliedDailyDelta;
  const targetCalories = Math.round(clamp(unclampedTargetCalories, 1200, 5000));
  const dailyDelta = targetCalories - maintenanceCalories;

  const isCut = dailyDelta < -10;
  const isBulk = dailyDelta > 10;
  const minProteinPerKg = isCut ? 1.8 : 1.6;
  const targetProteinPerKg = isCut ? 2.2 - progressRatio * 0.15 : isBulk ? 1.85 : 1.9;
  const minFatPerKg = 0.55;
  const targetFatPerKg = isCut ? 0.8 : isBulk ? 0.9 : 0.85;

  let proteinGrams = Math.round(Math.max(currentKg * minProteinPerKg, currentKg * targetProteinPerKg));
  let fatGrams = Math.round(Math.max(currentKg * minFatPerKg, currentKg * targetFatPerKg));

  const proteinCalories = proteinGrams * 4;
  let fatCalories = fatGrams * 9;
  let carbCalories = targetCalories - proteinCalories - fatCalories;

  if (carbCalories < 0) {
    const minimumFatGrams = Math.round(currentKg * minFatPerKg);
    fatGrams = Math.max(minimumFatGrams, Math.round((targetCalories - proteinCalories) / 9));
    fatCalories = fatGrams * 9;
    carbCalories = targetCalories - proteinCalories - fatCalories;
  }

  if (carbCalories < 0) {
    const minimumProteinGrams = Math.round(currentKg * minProteinPerKg);
    proteinGrams = Math.max(minimumProteinGrams, Math.round((targetCalories - fatCalories) / 4));
    carbCalories = targetCalories - proteinGrams * 4 - fatCalories;
  }

  const carbsGrams = Math.round(carbCalories / 4);
  const safeCarbsGrams = Math.max(0, carbsGrams);
  let estimatedDays = 0;

  if (direction !== 0 && Math.abs(dailyDelta) >= 1) {
    estimatedDays = Math.max(1, Math.round((remainingAbsKg * KCAL_PER_KG) / Math.abs(dailyDelta)));
  }

  const projectedEndDate = estimatedDays
    ? new Date(today.getTime() + estimatedDays * DAY_MS)
    : today;

  const timelineGoalMet = timelineTargetDays
    ? estimatedDays <= timelineTargetDays
    : true;

  const weeklyWeightChangeKg =
    dailyDelta === 0 ? 0 : (Math.abs(dailyDelta) * 7) / KCAL_PER_KG * (dailyDelta < 0 ? -1 : 1);

  return {
    maintenanceCalories,
    targetCalories,
    proteinGrams,
    carbsGrams: safeCarbsGrams,
    fatGrams,
    startingKg,
    currentKg,
    targetKg,
    estimatedDays,
    timelineTargetDays: timelineTargetDays || null,
    timelineGoalMet,
    journeyEndDateISO: targetDate ? toDateKey(targetDate) : '',
    projectedEndDateISO: toDateKey(projectedEndDate),
    dailyCalorieDelta: Math.round(dailyDelta),
    requestedDailyCalorieDelta: Number.isFinite(requestedDailyDelta)
      ? Math.round(requestedDailyDelta)
      : null,
    weeklyWeightChangeKg,
    journeyTotalKg: totalJourneyKg,
    journeyCompletedKg: completedJourneyKg,
    journeyRemainingKg: remainingAbsKg,
    journeyProgressPercent: Math.round(progressRatio * 100),
  };
};

export const getWeightManagerOverview = ({
  state,
  logs,
  unitFallback = DEFAULT_WEIGHT_MANAGER_UNIT,
} = {}) => {
  const weightManagerUnit = state?.weightUnit || unitFallback;
  const parsedJourneyWeeks = toPositiveNumber(state?.journeyDurationWeeks);
  const journeyDurationDays =
    state?.journeyGoalMode === 'duration' && Number.isFinite(parsedJourneyWeeks)
      ? Math.round(parsedJourneyWeeks * 7)
      : null;
  const journeyEndDate =
    state?.journeyGoalMode === 'date' && typeof state?.journeyGoalDate === 'string'
      ? state.journeyGoalDate
      : null;
  const weightManagerPlan = computeWeightManagerPlan({
    startingWeight: state?.startingWeight,
    currentWeight: state?.currentWeight,
    targetWeight: state?.targetWeight,
    unit: weightManagerUnit,
    currentBodyTypeKey: state?.currentBodyType,
    targetBodyTypeKey: state?.targetBodyType,
    journeyDurationDays,
    journeyEndDate,
  });
  const weightManagerTargetBody = WEIGHT_MANAGER_BODY_TYPES.find(
    (type) => type.key === state?.targetBodyType
  );
  const weightManagerLatestLog = logs?.length ? logs[0] : null;
  const weightManagerEarliestLog = logs?.length ? logs[logs.length - 1] : null;
  const startingWeightValue = Number(state?.startingWeight ?? state?.currentWeight);
  const weightManagerStartingValue = Number.isFinite(startingWeightValue)
    ? { value: startingWeightValue, unit: weightManagerUnit }
    : Number.isFinite(weightManagerEarliestLog?.weight)
      ? {
          value: weightManagerEarliestLog.weight,
          unit: weightManagerEarliestLog.unit || weightManagerUnit,
        }
      : null;
  const weightManagerCurrentValue = Number.isFinite(weightManagerLatestLog?.weight)
    ? { value: weightManagerLatestLog.weight, unit: weightManagerLatestLog.unit || weightManagerUnit }
    : weightManagerStartingValue;
  const weightManagerStartingDisplay = weightManagerStartingValue
    ? `${weightManagerStartingValue.value} ${weightManagerStartingValue.unit}`
    : '--';
  const weightManagerCurrentDisplay = weightManagerCurrentValue
    ? `${weightManagerCurrentValue.value} ${weightManagerCurrentValue.unit}`
    : '--';
  const weightManagerTargetDisplay = state?.targetWeight
    ? `${state.targetWeight} ${weightManagerUnit}`
    : '--';

  return {
    weightManagerUnit,
    weightManagerPlan,
    weightManagerTargetBody,
    weightManagerLatestLog,
    weightManagerEarliestLog,
    weightManagerStartingValue,
    weightManagerCurrentValue,
    weightManagerStartingDisplay,
    weightManagerCurrentDisplay,
    weightManagerTargetDisplay,
  };
};
