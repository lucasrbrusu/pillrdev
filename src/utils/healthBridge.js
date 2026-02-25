import { Platform } from 'react-native';

const HEALTH_LINK_MODULE = 'react-native-health-link';
const DEFAULT_BRIDGE_TIMEOUT_MS = 12000;
const AVAILABILITY_TIMEOUT_MS = 8000;
const PERMISSION_TIMEOUT_MS = 45000;
const READ_TIMEOUT_MS = 5000;
const WRITE_TIMEOUT_MS = 5000;

let cachedHealthLinkModule = null;
let didTryLoadHealthLinkModule = false;

const loadHealthLinkModule = () => {
  if (didTryLoadHealthLinkModule) {
    return cachedHealthLinkModule;
  }

  didTryLoadHealthLinkModule = true;
  try {
    // Dynamic require keeps the app bootable if native dependency is missing.
    // eslint-disable-next-line global-require, import/no-dynamic-require
    cachedHealthLinkModule = require(HEALTH_LINK_MODULE);
  } catch (err) {
    cachedHealthLinkModule = null;
  }
  return cachedHealthLinkModule;
};

const pickEnumValue = (enumObj, candidates = []) => {
  if (!enumObj || typeof enumObj !== 'object') return null;
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(enumObj, candidate)) {
      return enumObj[candidate];
    }
  }
  return null;
};

const asFiniteNumber = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoString = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
};

const startOfLocalDay = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const endOfLocalDay = (value = new Date()) => {
  const start = startOfLocalDay(value);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return end;
};

const getSampleValue = (sample = {}) => {
  const directCandidates = [
    sample?.value,
    sample?.steps,
    sample?.count,
    sample?.quantity,
    sample?.total,
    sample?.calories,
    sample?.energy,
    sample?.activeEnergyBurned,
    sample?.activeCaloriesBurned,
    sample?.kilocalories,
    sample?.kcal,
  ];

  for (const candidate of directCandidates) {
    const parsed = asFiniteNumber(candidate, null);
    if (parsed !== null) return parsed;
  }

  const nestedCandidates = [
    sample?.metadata?.value,
    sample?.metadata?.quantity,
    sample?.quantitySample?.value,
    sample?.measurement?.value,
  ];

  for (const candidate of nestedCandidates) {
    const parsed = asFiniteNumber(candidate, null);
    if (parsed !== null) return parsed;
  }

  return null;
};

const withTimeout = (promiseLike, timeoutMs, timeoutReason) => {
  const resolvedTimeout =
    Math.max(1, asFiniteNumber(timeoutMs, DEFAULT_BRIDGE_TIMEOUT_MS) || DEFAULT_BRIDGE_TIMEOUT_MS);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(timeoutReason || 'health_bridge_timeout'));
    }, resolvedTimeout);

    Promise.resolve(promiseLike)
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
};

const isTimeoutError = (error, timeoutReason) =>
  Boolean(
    timeoutReason &&
      typeof error?.message === 'string' &&
      error.message.toLowerCase() === String(timeoutReason).toLowerCase()
  );

const getProviderFromPlatform = () =>
  Platform.OS === 'ios' ? 'apple_health' : 'health_connect';

const getProviderLabelFromPlatform = () =>
  Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

const resolveHealthLinkSchema = () => {
  const moduleRef = loadHealthLinkModule();
  const permissionsEnum = moduleRef?.HealthLinkPermissions || {};
  const dataTypeEnum = moduleRef?.HealthLinkDataType || {};

  const stepsPermission = pickEnumValue(permissionsEnum, [
    'Steps',
    'StepCount',
    'Step',
    'WalkingStepCount',
  ]);
  const activeCaloriesPermission = pickEnumValue(permissionsEnum, [
    'ActiveEnergyBurned',
    'ActiveCaloriesBurned',
    'ActiveEnergy',
  ]);
  const nutritionPermission = pickEnumValue(permissionsEnum, [
    'Nutrition',
    'DietaryEnergyConsumed',
    'DietaryProtein',
    'DietaryCarbohydrates',
    'DietaryFatTotal',
    'Calories',
  ]);

  const stepsDataType = pickEnumValue(dataTypeEnum, [
    'Steps',
    'StepCount',
    'Step',
    'WalkingStepCount',
  ]);
  const activeCaloriesDataType = pickEnumValue(dataTypeEnum, [
    'ActiveEnergyBurned',
    'ActiveCaloriesBurned',
    'ActiveEnergy',
  ]);
  const nutritionDataTypes = {
    calories: pickEnumValue(dataTypeEnum, [
      'Nutrition',
      'DietaryEnergyConsumed',
      'Calories',
      'CalorieIntake',
    ]),
    protein: pickEnumValue(dataTypeEnum, ['DietaryProtein', 'Protein']),
    carbs: pickEnumValue(dataTypeEnum, ['DietaryCarbohydrates', 'Carbohydrates', 'Carbs']),
    fat: pickEnumValue(dataTypeEnum, ['DietaryFatTotal', 'FatTotal', 'Fat']),
  };

  return {
    moduleRef,
    permissions: {
      steps: stepsPermission,
      activeCalories: activeCaloriesPermission,
      nutrition: nutritionPermission,
    },
    dataTypes: {
      steps: stepsDataType,
      activeCalories: activeCaloriesDataType,
      nutrition: nutritionDataTypes,
    },
  };
};

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.records)) return value.records;
  if (Array.isArray(value?.samples)) return value.samples;
  return [];
};

const readSamples = async (dataType, dateValue = new Date()) => {
  const { moduleRef } = resolveHealthLinkSchema();
  if (!moduleRef || typeof moduleRef.read !== 'function' || !dataType) {
    return [];
  }

  const startDate = toIsoString(startOfLocalDay(dateValue));
  const endDate = toIsoString(endOfLocalDay(dateValue));
  const optionCandidates = [
    { startDate, endDate },
    { startTime: startDate, endTime: endDate },
    { from: startDate, to: endDate },
  ];

  for (const options of optionCandidates) {
    try {
      const result = await withTimeout(
        moduleRef.read(dataType, options),
        READ_TIMEOUT_MS,
        'health_read_timeout'
      );
      const rows = toArray(result);
      if (rows.length || result !== undefined) {
        return rows;
      }
    } catch (err) {
      if (isTimeoutError(err, 'health_read_timeout')) {
        break;
      }
      // Try the next argument shape.
    }
  }

  return [];
};

const writeSample = async (dataType, payload = {}) => {
  const { moduleRef } = resolveHealthLinkSchema();
  if (!moduleRef || typeof moduleRef.write !== 'function' || !dataType) {
    return false;
  }

  const nowISO = toIsoString();
  const payloadCandidates = [
    payload,
    {
      ...payload,
      startDate: payload.startDate || payload.date || nowISO,
      endDate: payload.endDate || payload.date || nowISO,
    },
    {
      ...payload,
      date: payload.date || payload.startDate || nowISO,
    },
  ];

  for (const candidate of payloadCandidates) {
    try {
      const result = await withTimeout(
        moduleRef.write(dataType, candidate),
        WRITE_TIMEOUT_MS,
        'health_write_timeout'
      );
      if (result === false) continue;
      return true;
    } catch (err) {
      if (isTimeoutError(err, 'health_write_timeout')) {
        return false;
      }
      // Try next payload shape.
    }
  }
  return false;
};

export const getHealthProviderDetails = () => ({
  platform: Platform.OS,
  provider: getProviderFromPlatform(),
  label: getProviderLabelFromPlatform(),
  connectLabel: Platform.OS === 'ios' ? 'Connect Apple Health' : 'Connect Health Connect',
});

export const isHealthBridgeInstalled = () => Boolean(loadHealthLinkModule());

export const checkHealthAvailability = async () => {
  const moduleRef = loadHealthLinkModule();
  if (!moduleRef) {
    return {
      available: false,
      reason: 'health_link_module_missing',
    };
  }

  if (typeof moduleRef.isAvailable !== 'function') {
    return {
      available: false,
      reason: 'health_link_is_available_missing',
    };
  }

  try {
    const result = await withTimeout(
      moduleRef.isAvailable(),
      AVAILABILITY_TIMEOUT_MS,
      'health_availability_timeout'
    );
    if (typeof result === 'boolean') {
      return {
        available: result,
        reason: result ? null : 'platform_health_not_available',
      };
    }

    if (result && typeof result === 'object') {
      const available = Boolean(
        result.available ?? result.isAvailable ?? result.success ?? false
      );
      return {
        available,
        reason:
          available
            ? null
            : result.reason || result.error || 'platform_health_not_available',
      };
    }

    return {
      available: false,
      reason: 'platform_health_not_available',
    };
  } catch (err) {
    return {
      available: false,
      reason: err?.message || 'platform_health_not_available',
    };
  }
};

export const requestHealthPermissions = async ({
  includeNutritionWrite = true,
} = {}) => {
  const {
    moduleRef,
    permissions: permissionSchema,
    dataTypes: dataTypeSchema,
  } = resolveHealthLinkSchema();
  if (!moduleRef) {
    return {
      granted: false,
      reason: 'health_link_module_missing',
      capabilities: {
        canReadSteps: false,
        canReadActiveCalories: false,
        canWriteNutrition: false,
      },
    };
  }

  if (typeof moduleRef.initializeHealth !== 'function') {
    return {
      granted: false,
      reason: 'health_link_initialize_missing',
      capabilities: {
        canReadSteps: false,
        canReadActiveCalories: false,
        canWriteNutrition: false,
      },
    };
  }

  const readPermissions = [];
  if (permissionSchema.steps) readPermissions.push(permissionSchema.steps);
  if (permissionSchema.activeCalories) readPermissions.push(permissionSchema.activeCalories);

  const writePermissions = [];
  if (includeNutritionWrite && permissionSchema.nutrition) {
    writePermissions.push(permissionSchema.nutrition);
  }

  const requestedPermissionCount = readPermissions.length + writePermissions.length;
  if (!requestedPermissionCount) {
    return {
      granted: false,
      reason: 'health_permissions_not_supported',
      capabilities: {
        canReadSteps: Boolean(dataTypeSchema.steps),
        canReadActiveCalories: Boolean(dataTypeSchema.activeCalories),
        canWriteNutrition: false,
      },
      metadata: {
        readPermissionsRequested: 0,
        writePermissionsRequested: 0,
      },
    };
  }

  try {
    const initResult = await withTimeout(
      moduleRef.initializeHealth({
        read: readPermissions,
        write: writePermissions,
      }),
      PERMISSION_TIMEOUT_MS,
      'health_permission_timeout'
    );
    const granted =
      typeof initResult === 'boolean'
        ? initResult
        : Boolean(initResult?.granted ?? initResult?.success ?? true);

    return {
      granted,
      reason: granted ? null : 'permission_denied',
      capabilities: {
        canReadSteps: Boolean(dataTypeSchema.steps),
        canReadActiveCalories: Boolean(dataTypeSchema.activeCalories),
        canWriteNutrition: Boolean(
          includeNutritionWrite &&
            (dataTypeSchema.nutrition.calories ||
              dataTypeSchema.nutrition.protein ||
              dataTypeSchema.nutrition.carbs ||
              dataTypeSchema.nutrition.fat)
        ),
      },
      metadata: {
        readPermissionsRequested: readPermissions.length,
        writePermissionsRequested: writePermissions.length,
      },
    };
  } catch (err) {
    return {
      granted: false,
      reason: err?.message || 'permission_request_failed',
      capabilities: {
        canReadSteps: Boolean(dataTypeSchema.steps),
        canReadActiveCalories: Boolean(dataTypeSchema.activeCalories),
        canWriteNutrition: false,
      },
    };
  }
};

export const readTodayStepsFromHealth = async (dateValue = new Date()) => {
  const { dataTypes } = resolveHealthLinkSchema();
  if (!dataTypes.steps) {
    return { steps: null, supported: false };
  }

  const rows = await readSamples(dataTypes.steps, dateValue);
  if (!rows.length) {
    return { steps: 0, supported: true };
  }

  const steps = rows.reduce((sum, row) => {
    const value = asFiniteNumber(getSampleValue(row), 0) || 0;
    return sum + Math.max(0, value);
  }, 0);

  return {
    steps: Math.round(steps),
    supported: true,
    sampleCount: rows.length,
  };
};

export const readTodayActiveCaloriesFromHealth = async (dateValue = new Date()) => {
  const { dataTypes } = resolveHealthLinkSchema();
  if (!dataTypes.activeCalories) {
    return { activeCalories: null, supported: false };
  }

  const rows = await readSamples(dataTypes.activeCalories, dateValue);
  if (!rows.length) {
    return { activeCalories: 0, supported: true };
  }

  const activeCalories = rows.reduce((sum, row) => {
    const value = asFiniteNumber(getSampleValue(row), 0) || 0;
    return sum + Math.max(0, value);
  }, 0);

  return {
    activeCalories: Math.round(activeCalories * 10) / 10,
    supported: true,
    sampleCount: rows.length,
  };
};

export const writeDailyNutritionToHealth = async ({
  dateISO,
  calories,
  protein,
  carbs,
  fat,
} = {}) => {
  const { dataTypes } = resolveHealthLinkSchema();
  const targetDate = dateISO ? new Date(`${dateISO}T12:00:00`) : new Date();
  const startDate = toIsoString(startOfLocalDay(targetDate));
  const endDate = toIsoString(endOfLocalDay(targetDate));

  const payloadByField = {
    calories: {
      dataType: dataTypes.nutrition.calories,
      value: Math.max(0, asFiniteNumber(calories, 0) || 0),
      unit: 'kcal',
    },
    protein: {
      dataType: dataTypes.nutrition.protein,
      value: Math.max(0, asFiniteNumber(protein, 0) || 0),
      unit: 'g',
    },
    carbs: {
      dataType: dataTypes.nutrition.carbs,
      value: Math.max(0, asFiniteNumber(carbs, 0) || 0),
      unit: 'g',
    },
    fat: {
      dataType: dataTypes.nutrition.fat,
      value: Math.max(0, asFiniteNumber(fat, 0) || 0),
      unit: 'g',
    },
  };

  const writtenFields = [];
  const skippedFields = [];

  for (const [field, config] of Object.entries(payloadByField)) {
    if (!config.dataType) {
      skippedFields.push(field);
      continue;
    }
    if (!Number.isFinite(config.value)) {
      skippedFields.push(field);
      continue;
    }
    const success = await writeSample(config.dataType, {
      value: config.value,
      unit: config.unit,
      startDate,
      endDate,
      date: startDate,
    });
    if (success) {
      writtenFields.push(field);
    } else {
      skippedFields.push(field);
    }
  }

  return {
    written: writtenFields.length > 0,
    writtenFields,
    skippedFields,
  };
};
