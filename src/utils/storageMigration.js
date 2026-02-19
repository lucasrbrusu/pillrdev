import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_PREFIX = '@pillarup';
const CURRENT_PREFIX = '@pillaflow';
const BRAND_STORAGE_MIGRATION_KEY = '@pillaflow_storage_migration_v1';
const BATCH_SIZE = 100;

const toBatches = (items = [], size = BATCH_SIZE) => {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
};

const toCurrentKey = (legacyKey) => {
  if (typeof legacyKey !== 'string' || !legacyKey.startsWith(LEGACY_PREFIX)) {
    return null;
  }
  return `${CURRENT_PREFIX}${legacyKey.slice(LEGACY_PREFIX.length)}`;
};

export const migrateLegacyStorageKeys = async () => {
  try {
    const migrationFlag = await AsyncStorage.getItem(BRAND_STORAGE_MIGRATION_KEY);
    if (migrationFlag === '1') {
      return { migrated: 0, removed: 0 };
    }

    const allKeys = await AsyncStorage.getAllKeys();
    const legacyKeys = allKeys.filter((key) => key?.startsWith(LEGACY_PREFIX));

    if (!legacyKeys.length) {
      await AsyncStorage.setItem(BRAND_STORAGE_MIGRATION_KEY, '1');
      return { migrated: 0, removed: 0 };
    }

    const keyPairs = legacyKeys
      .map((legacyKey) => ({ legacyKey, currentKey: toCurrentKey(legacyKey) }))
      .filter((pair) => pair.currentKey && pair.currentKey !== pair.legacyKey);

    const currentKeys = Array.from(new Set(keyPairs.map((pair) => pair.currentKey)));

    const [legacyEntries, currentEntries] = await Promise.all([
      AsyncStorage.multiGet(keyPairs.map((pair) => pair.legacyKey)),
      AsyncStorage.multiGet(currentKeys),
    ]);

    const legacyMap = new Map(legacyEntries);
    const currentMap = new Map(currentEntries);
    const writes = [];
    const removals = [];

    keyPairs.forEach(({ legacyKey, currentKey }) => {
      const legacyValue = legacyMap.get(legacyKey);
      if (legacyValue === null || legacyValue === undefined) return;

      const currentValue = currentMap.get(currentKey);
      if (currentValue === null || currentValue === undefined) {
        writes.push([currentKey, legacyValue]);
      }
      removals.push(legacyKey);
    });

    for (const batch of toBatches(writes)) {
      await AsyncStorage.multiSet(batch);
    }

    for (const batch of toBatches(removals)) {
      await AsyncStorage.multiRemove(batch);
    }

    await AsyncStorage.setItem(BRAND_STORAGE_MIGRATION_KEY, '1');
    return { migrated: writes.length, removed: removals.length };
  } catch (error) {
    console.log('Error migrating legacy PillarUp storage keys:', error);
    return { migrated: 0, removed: 0 };
  }
};
