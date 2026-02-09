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

export const toWeightManagerKg = (value, unit = DEFAULT_WEIGHT_MANAGER_UNIT) => {
  if (!Number.isFinite(value)) return null;
  return unit === 'kg' ? value : value / 2.20462;
};

export const computeWeightManagerPlan = ({
  currentWeight,
  targetWeight,
  unit = DEFAULT_WEIGHT_MANAGER_UNIT,
  currentBodyTypeKey = DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
  targetBodyTypeKey = DEFAULT_WEIGHT_MANAGER_BODY_TYPE,
}) => {
  const parsedCurrent = parseFloat(currentWeight);
  const parsedTarget = parseFloat(targetWeight);
  if (!Number.isFinite(parsedCurrent) || parsedCurrent <= 0) return null;
  if (!Number.isFinite(parsedTarget) || parsedTarget <= 0) return null;

  const currentKg = toWeightManagerKg(parsedCurrent, unit);
  const targetKg = toWeightManagerKg(parsedTarget, unit);
  if (!Number.isFinite(currentKg) || !Number.isFinite(targetKg)) return null;

  const currentType = WEIGHT_MANAGER_BODY_TYPE_MAP[currentBodyTypeKey] || WEIGHT_MANAGER_BODY_TYPES[1];
  const targetType = WEIGHT_MANAGER_BODY_TYPE_MAP[targetBodyTypeKey] || WEIGHT_MANAGER_BODY_TYPES[1];

  const currentMaintenance = currentKg * currentType.maintenanceMultiplier;
  const targetMaintenance = targetKg * targetType.maintenanceMultiplier;
  const maintenanceCalories = Math.round((currentMaintenance + targetMaintenance) / 2);
  const diffKg = targetKg - currentKg;
  const absDiff = Math.abs(diffKg);
  let adjustment = 0;

  if (absDiff >= 0.5) {
    const base = Math.min(750, 250 + absDiff * 25);
    adjustment = diffKg > 0 ? base : -base;
  }

  const targetCalories = Math.max(
    1200,
    Math.round(maintenanceCalories + adjustment + (targetType.calorieBias || 0))
  );
  const proteinGrams = Math.round(targetType.proteinMultiplier * targetKg);
  const fatCalories = Math.round(targetCalories * targetType.fatRatio);
  const fatGrams = Math.round(fatCalories / 9);
  const proteinCalories = proteinGrams * 4;
  const carbCalories = Math.max(0, targetCalories - proteinCalories - fatCalories);
  const carbsGrams = Math.round(carbCalories / 4);
  const weightDiffKg = targetKg - currentKg;
  const dailyDelta = targetCalories - maintenanceCalories;
  let estimatedDays = null;

  if (Number.isFinite(weightDiffKg) && weightDiffKg !== 0 && Number.isFinite(dailyDelta) && dailyDelta !== 0) {
    const directionMatches =
      (weightDiffKg > 0 && dailyDelta > 0) || (weightDiffKg < 0 && dailyDelta < 0);
    if (directionMatches) {
      estimatedDays = Math.round(Math.abs(weightDiffKg) * 7700 / Math.abs(dailyDelta));
    }
  }

  return {
    maintenanceCalories,
    targetCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    currentKg,
    targetKg,
    estimatedDays,
  };
};

export const getWeightManagerOverview = ({
  state,
  logs,
  unitFallback = DEFAULT_WEIGHT_MANAGER_UNIT,
} = {}) => {
  const weightManagerUnit = state?.weightUnit || unitFallback;
  const weightManagerPlan = computeWeightManagerPlan({
    currentWeight: state?.currentWeight,
    targetWeight: state?.targetWeight,
    unit: weightManagerUnit,
    currentBodyTypeKey: state?.currentBodyType,
    targetBodyTypeKey: state?.targetBodyType,
  });
  const weightManagerTargetBody = WEIGHT_MANAGER_BODY_TYPES.find(
    (type) => type.key === state?.targetBodyType
  );
  const weightManagerLatestLog = logs?.length ? logs[0] : null;
  const weightManagerEarliestLog = logs?.length ? logs[logs.length - 1] : null;
  const startingWeightValue = Number(state?.currentWeight);
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
